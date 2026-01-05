import { casts } from "./lib/casts.js";
import { tarotDataShion } from "./lib/tarot_data_shion.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY が設定されていません。");

    const { userId, castId, text } = await request.json();
    
    // ユーザー・予約確認
    const user = await env.DB.prepare("SELECT * FROM Users WHERE id = ?").bind(userId).first();
    const reservation = await env.DB.prepare("SELECT id, cast_id FROM Reservations WHERE user_id = ? AND status = 'pending'").bind(userId).first();

    if (!user) return new Response(JSON.stringify({ error: "ログインが必要です。" }), { status: 401 });

    // --- チケット消費・セッション管理（timestampカラム確認） ---
    let lastChat = null;
    let isSessionActive = false;
    
    try {
        lastChat = await env.DB.prepare("SELECT timestamp FROM ChatLogs WHERE user_id = ? AND sender = 'ai' ORDER BY id DESC LIMIT 1").bind(userId).first();
    } catch (e) {
        // timestampカラムが無いエラー対策：無視して新規扱いにする
        console.error("DB Error (timestamp check):", e.message);
    }

    if (lastChat && lastChat.timestamp) {
        const lastTimeStr = lastChat.timestamp.endsWith('Z') ? lastChat.timestamp : lastChat.timestamp + 'Z';
        const lastTime = new Date(lastTimeStr).getTime();
        const now = Date.now();
        if (!isNaN(lastTime) && (now - lastTime) < 10 * 60 * 1000) {
            isSessionActive = true;
        }
    }

    const ticketBalance = user.ticket_balance || 0;
    if (!reservation && !isSessionActive && ticketBalance < 1) {
      return new Response(JSON.stringify({ reply: "鑑定を受けるにはチケットが必要です。右上の「＋」からお求めください。" }));
    }

    // --- AI処理 ---
    const activeCastId = reservation ? reservation.cast_id : castId;
    const cast = casts[activeCastId];
    if (!cast) throw new Error("鑑定師データが見つかりません。");

    let expertKnowledge = activeCastId === 1 ? `【タロット知識】\n${JSON.stringify(tarotDataShion)}` : "";

    // 過去ログ取得（エラー回避のためtry-catch）
    let historyText = "";
    try {
        const historyData = await env.DB.prepare("SELECT sender, content FROM ChatLogs WHERE user_id = ? ORDER BY id DESC LIMIT 10").bind(userId).all();
        historyText = historyData.results.reverse().map(log => {
            return `${log.sender === 'user' ? '相談者' : 'あなた'}: ${log.content}`;
        }).join("\n");
    } catch (e) {
        console.error("DB Error (history):", e.message);
    }

    const promptText = `
あなたはチャット占い師「${cast.name}」です。AIではなく人間として振る舞ってください。
設定：${cast.systemPrompt}
相談者：${user.last_name} ${user.first_name} 様 (${user.dob}生まれ)
${expertKnowledge}

【過去の会話】
${historyText}

【相談内容】
${text}

【ルール】
1. 人間らしく、フィラー（「うーん」「そうですね」）や共感を交えて話してください。
2. 過去の話を覚えているように振る舞ってください。
3. 会話を終了すべき時は、最後に「[END]」とだけ付けてください（表示はされません）。
4. カード画像 [CARD: ...] は必要な時だけ出してください。`;

    // Gemini 2.5 Flash
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
    });
    
    if (!response.ok) {
        const err = await response.text();
        throw new Error(`AI通信エラー (${response.status}): ${err}`);
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
    } else if (!isSessionActive) {
      await env.DB.prepare("UPDATE Users SET ticket_balance = ticket_balance - 1 WHERE id = ?").bind(userId).run();
    }

    // ログ保存（エラーが出てもチャット自体は止めない）
    try {
        const nowISO = new Date().toISOString();
        await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content, timestamp) VALUES (?, 'ai', ?, ?)").bind(userId, reply, nowISO).run();
        await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content, timestamp) VALUES (?, 'user', ?, ?)").bind(userId, text || "...", nowISO).run();
    } catch (e) {
        console.error("DB Log Error:", e.message);
        // timestampカラムがない場合のフォールバック（旧テーブル対応）
        if (e.message.includes("no such column: timestamp")) {
             await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content) VALUES (?, 'ai', ?)").bind(userId, reply).run();
             await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content) VALUES (?, 'user', ?)").bind(userId, text || "...").run();
        }
    }

    return new Response(JSON.stringify({ reply, isEnded }));
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
