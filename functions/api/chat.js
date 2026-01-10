import { casts } from "./lib/casts.js";
import { tarotDataShion } from "./lib/tarot_data_shion.js";
import { buildSystemDirection } from "./lib/prompt_builder.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY が設定されていません。");

    const { userId, castId, text } = await request.json();
    
    // --- ユーザー認証と予約確認 ---
    const user = await env.DB.prepare("SELECT * FROM Users WHERE id = ?").bind(userId).first();
    const reservation = await env.DB.prepare("SELECT id, cast_id FROM Reservations WHERE user_id = ? AND status = 'pending'").bind(userId).first();

    if (!user) return new Response(JSON.stringify({ error: "ログインが必要です。" }), { status: 401 });

    // 今回話す相手を特定
    const activeCastId = reservation ? reservation.cast_id : castId;
    const cast = casts[activeCastId];
    if (!cast) throw new Error("鑑定師データが見つかりません。");

    // --- セッション履歴の取得と分析 ---
    const logs = await env.DB.prepare(`
        SELECT * FROM ChatLogs 
        WHERE user_id = ? AND cast_id = ? 
        ORDER BY id DESC LIMIT 50
    `).bind(userId, activeCastId).all();

    const historyLogs = logs.results.reverse();
    let currentSessionLogs = [];
    const SESSION_TIMEOUT_MS = 20 * 60 * 1000;
    const now = Date.now();

    // セッションリセット判定
    let isNewSession = false;
    if (historyLogs.length > 0) {
        const lastLog = historyLogs[historyLogs.length - 1];
        const lastLogTime = new Date(lastLog.timestamp.endsWith('Z') ? lastLog.timestamp : lastLog.timestamp + 'Z').getTime();
        if (now - lastLogTime > SESSION_TIMEOUT_MS) {
            isNewSession = true;
            currentSessionLogs = []; 
        }
    }

    if (!isNewSession) {
        let lastTime = 0;
        for (const log of historyLogs) {
            const logTime = new Date(log.timestamp.endsWith('Z') ? log.timestamp : log.timestamp + 'Z').getTime();
            if (lastTime > 0 && (logTime - lastTime) > SESSION_TIMEOUT_MS) {
                currentSessionLogs = []; 
            }
            currentSessionLogs.push(log);
            lastTime = logTime;
        }
    }

    // --- 現在の状況計算 ---
    let sessionStartTime = now;
    let turnCount = 0;

    if (currentSessionLogs.length > 0) {
        const firstLog = currentSessionLogs[0];
        sessionStartTime = new Date(firstLog.timestamp.endsWith('Z') ? firstLog.timestamp : firstLog.timestamp + 'Z').getTime();
        turnCount = currentSessionLogs.filter(l => l.sender === 'user').length;
    }

    const elapsedMinutes = (now - sessionStartTime) / (1000 * 60);
    
    // --- チケット消費判定 ---
    const ticketBalance = user.ticket_balance || 0;
    if (!reservation && currentSessionLogs.length === 0 && ticketBalance < 1) {
      return new Response(JSON.stringify({ reply: "鑑定を受けるにはチケットが必要です。右上の「＋」からお求めください。" }));
    }

    // --- AIへの状況指示（ディレクション）作成 ---
    // ★修正: prompt_builderにcastIdを渡すように変更
    const { systemDirection, safetyInstruction } = buildSystemDirection(turnCount, elapsedMinutes, cast.name, activeCastId);

    // --- プロンプト構築 ---
    // ★修正: タロット知識は紫雲(ID:1)の時だけ渡す
    const expertKnowledge = activeCastId === 1 ? `【タロット知識】\n${JSON.stringify(tarotDataShion)}` : "";
    
    // 過去ログ
    const recentHistory = currentSessionLogs.slice(-10).map(log => {
        return `${log.sender === 'user' ? '相談者' : 'あなた'}: ${log.content}`;
    }).join("\n");

    const currentDate = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    
    let lastName = user.last_name || "";
    let firstName = user.first_name || "";
    const userName = (lastName && firstName) ? `${lastName} ${firstName} 様` : "お客様";
    const userDobInfo = user.dob ? `${user.dob}生まれ` : "（生年月日はまだ聞いていません）";
    const userGenderInfo = user.gender ? `性別：${user.gender}` : "（性別はまだ聞いていません）";

    const userTextContent = text ? text : "（会話開始・入室）";

    const promptText = `
あなたはチャット占い師「${cast.name}」です。AIではなく、感情を持った人間として振る舞ってください。
設定：${cast.systemPrompt}

【相談者データ】
名前：${userName}
生年月日：${userDobInfo}
${userGenderInfo}
※データがある場合はそれを前提に話してください。「忘れた」などと言わないでください。

【現在日時】
${currentDate}

【現在の会話状況】
- 経過時間: 約${Math.floor(elapsedMinutes)}分
- やり取り回数: ${turnCount}回
${systemDirection}
${safetyInstruction}

${expertKnowledge}

【直近の会話履歴】
${recentHistory}

【相談者の最新の言葉】
${userTextContent}

【対話・鑑定の絶対ルール】
1. **人間味の追求**: まずは「うーん…」「なるほど…」といったフィラーや共感から始めてください。
2. **文脈の維持**: 過去の話を覚えているように振る舞ってください。
3. **終了処理**: 指示に従い、会話を終える時は最後に [END] を付けてください。
4. **名前**: 「${userName.replace(" 様", "")}さん」と呼んでください。

以上のルールと状況指示を守り、${cast.name}になりきって返答してください。`;

    // --- Gemini API 呼び出し ---
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
    });
    
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`AI通信エラー (${response.status}): ${errText}`);
    }
    
    const data = await response.json();
    let reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) throw new Error("AIからの応答が空でした。");

    // 終了フラグ処理
    let isEnded = false;
    if (reply.includes("[END]")) {
        isEnded = true;
        reply = reply.replace("[END]", "").trim();
    }

    // --- ログ保存・チケット消費 ---
    if (reservation) {
      await env.DB.prepare("UPDATE Reservations SET status = 'completed' WHERE id = ?").bind(reservation.id).run();
    } else if (currentSessionLogs.length === 0) {
      await env.DB.prepare("UPDATE Users SET ticket_balance = ticket_balance - 1 WHERE id = ?").bind(userId).run();
    }

    try {
        const nowISO = new Date().toISOString();
        await env.DB.prepare("INSERT INTO ChatLogs (user_id, cast_id, sender, content, timestamp) VALUES (?, ?, 'ai', ?, ?)").bind(userId, activeCastId, reply, nowISO).run();
        await env.DB.prepare("INSERT INTO ChatLogs (user_id, cast_id, sender, content, timestamp) VALUES (?, ?, 'user', ?, ?)").bind(userId, activeCastId, text || "(会話開始)", nowISO).run();
    } catch (e) {
        console.error("DB Log Error:", e.message);
        // フォールバック
        if (e.message.includes("has no column named cast_id") || e.message.includes("no such column: cast_id")) {
             await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content) VALUES (?, 'ai', ?)").bind(userId, reply).run();
             await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content) VALUES (?, 'user', ?)").bind(userId, text || "(会話開始)").run();
        }
    }

    return new Response(JSON.stringify({ reply, isEnded }));
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
