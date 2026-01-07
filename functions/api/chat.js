import { casts } from "./lib/casts.js";
import { tarotDataShion } from "./lib/tarot_data_shion.js";

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
    // 過去のログを多めに取得して、現在の会話セッションがいつ始まったかを分析します
    const logs = await env.DB.prepare(`
        SELECT * FROM ChatLogs 
        WHERE user_id = ? AND cast_id = ? 
        ORDER BY id DESC LIMIT 50
    `).bind(userId, activeCastId).all();

    // ログを古い順（時系列）に並べ替え
    const historyLogs = logs.results.reverse();

    let currentSessionLogs = [];
    let lastTime = 0;

    // 「10分以上間隔が空いたら新しいセッション」とみなして、今のセッションのログだけ抽出
    for (const log of historyLogs) {
        const logTime = new Date(log.timestamp.endsWith('Z') ? log.timestamp : log.timestamp + 'Z').getTime();
        if (lastTime > 0 && (logTime - lastTime) > 10 * 60 * 1000) {
            currentSessionLogs = []; // 間隔が空いたのでリセット
        }
        currentSessionLogs.push(log);
        lastTime = logTime;
    }

    // --- 現在の状況計算 ---
    const now = Date.now();
    let sessionStartTime = now;
    let turnCount = 0; // ユーザーの発言回数

    if (currentSessionLogs.length > 0) {
        // セッション開始時刻
        const firstLog = currentSessionLogs[0];
        sessionStartTime = new Date(firstLog.timestamp.endsWith('Z') ? firstLog.timestamp : firstLog.timestamp + 'Z').getTime();
        
        // ラリー数のカウント
        turnCount = currentSessionLogs.filter(l => l.sender === 'user').length;
    }

    const elapsedMinutes = (now - sessionStartTime) / (1000 * 60); // 経過分数
    
    // --- チケット消費判定 ---
    // 新規セッション開始時のみチケット消費
    const ticketBalance = user.ticket_balance || 0;
    if (!reservation && currentSessionLogs.length === 0 && ticketBalance < 1) {
      return new Response(JSON.stringify({ reply: "鑑定を受けるにはチケットが必要です。右上の「＋」からお求めください。" }));
    }

    // --- AIへの状況指示（ディレクション）作成 ---
    let systemDirection = "";
    // 通常の防御指示（初回と終了間際以外で使用）
    const defaultSafetyInstruction = `
    【防御指示】
    もし相談者の入力が「あ」や「test」などの無意味な文字列、または占いに無関係な暴言やスパムだと判断した場合は、
    まともに取り合わず、「星が曇って声が届かないようです…」といったニュアンス（キャラの口調で）で返し、
    **即座に [END] をつけて会話を強制終了してください。**
    `;
    let safetyInstruction = defaultSafetyInstruction;

    // ▼▼▼ ロジック変更部分 ▼▼▼

    // 1. 導入パート（初回 Turn 0）: 絶対に占わない
    if (turnCount === 0) {
        systemDirection = `
        【重要指示：導入と流れの説明】
        **現在は会話の冒頭です。絶対にまだ占いをしないでください。カード画像 [CARD:...] も表示しないでください。**
        まずは相談者との信頼関係を築き、今後の流れを説明してください：
        1. 相談者の名前と生年月日を確認し、親しみを込めて挨拶する。
        2. 「占いの精度を高めるために、性別も教えていただけますか？」と自然に尋ねる。
        3. **「お悩みをお聞かせください。しっかりお話を伺ってから、タロットで占わせていただきますね。」と伝える。**
        4. 相手の返事を待つ短い問いかけで終えること。
        `;
        safetyInstruction = ""; // 初回は防御オフ
    } 
    // 2. 終了フェーズ（時間・回数オーバー）
    else if (elapsedMinutes >= 25 || turnCount >= 15) {
        systemDirection = `
        【重要指示：鑑定終了】
        鑑定時間は終了しました。これ以上、新しい占いや質問への回答はしないでください。
        **「${cast.name}」らしい口調で別れの挨拶をし、最後に必ず [END] をつけて終了してください。**
        `;
    } else if (elapsedMinutes >= 20 || turnCount >= 12) {
        systemDirection = `
        【重要指示：そろそろ終了】
        鑑定時間が残りわずかです。
        回答の最後に、「そろそろお時間ですが、最後に一つだけ聞きたいことはありますか？」と付け加え、次で終わるように誘導してください。
        まだ [END] はつけないでください。
        `;
        safetyInstruction = ""; // 終了間際は防御オフ
    }
    // 3. ヒアリング専用フェーズ（Turn 1〜2）: まだ占わない ★追加★
    // 少なくとも2回はユーザーの話を聞くまでは占いを禁止します。
    else if (turnCount < 3) {
        systemDirection = `
        【重要指示：ヒアリング徹底（まだ占わない）】
        **まだ占いの段階ではありません。カード画像 [CARD:...] も表示しないでください。**
        相談者のお悩みや状況を深く理解するために、カウンセリングのように話を聴いてください。
        （例：「それはいつ頃からですか？」「具体的にどんな状況でしたか？」）
        焦って結論を出そうとせず、相手が話しやすい雰囲気を作ってください。
        `;
    }
    // 4. 通常フェーズ（Turn 3以降）: 状況に応じて占い開始
    else {
        systemDirection = `
        【重要指示：ヒアリングと占いの開始判断】
        引き続きヒアリングを行うか、いよいよタロット占いを行うかを判断してください。

        **以下のいずれかの場合、直ちにヒアリングを終了し、タロット占いを行ってください。**
        1. **相談者が「占って」「カード引いて」「結果教えて」など、明確に占いを求めた場合（最優先）。**
        2. あなたが「状況は十分に把握できた、今が占うタイミングだ」と判断した場合。
        3. (会話が長引いているがまだ占っていない場合)「そろそろタロットで見てみましょうか？」と提案し、占いを始める。

        **占いを行う時だけ**、必ずカードの画像（例: [CARD: ... ]）を提示し、そのカードに基づいた鑑定結果を伝えてください。
        それ以外はまだヒアリングを続けてください。
        `;
    }
    // ▲▲▲ ロジック変更ここまで ▲▲▲

    // --- プロンプト構築 ---
    const expertKnowledge = activeCastId === 1 ? `【タロット知識】\n${JSON.stringify(tarotDataShion)}` : "";
    
    // 過去ログテキスト化（直近10件）
    const recentHistory = currentSessionLogs.slice(-10).map(log => {
        return `${log.sender === 'user' ? '相談者' : 'あなた'}: ${log.content}`;
    }).join("\n");

    const currentDate = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    
    // ユーザー名・生年月日処理
    let lastName = user.last_name;
    let firstName = user.first_name;
    if (lastName === "null" || !lastName) lastName = "";
    if (firstName === "null" || !firstName) firstName = "";
    const userName = (lastName && firstName) ? `${lastName} ${firstName} 様` : "お客様";
    const userDobInfo = user.dob ? `${user.dob}生まれ` : "生年月日不明";

    // 初回などの空テキスト対策
    const userTextContent = text ? text : "（会話開始・入室）";

    const promptText = `
あなたはチャット占い師「${cast.name}」です。AIではなく、感情を持った人間として振る舞ってください。
設定：${cast.systemPrompt}

【相談者データ】
名前：${userName}
生年月日：${userDobInfo}

【現在日時】
${currentDate} (※現在は2026年です)

【現在の会話状況】
- 経過時間: 約${Math.floor(elapsedMinutes)}分
- やり取り回数: ${turnCount}回（※Turn 0-2はヒアリング期間）
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
4. **演出**: タロット画像 [CARD: ...] は必要な時だけ出してください。**指示がない限り出してはいけません。**
5. **名前**: 「${userName.replace(" 様", "")}さん」と呼んでください。

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
      // 新規セッション開始時のみチケット消費
      await env.DB.prepare("UPDATE Users SET ticket_balance = ticket_balance - 1 WHERE id = ?").bind(userId).run();
    }

    try {
        const nowISO = new Date().toISOString();
        await env.DB.prepare("INSERT INTO ChatLogs (user_id, cast_id, sender, content, timestamp) VALUES (?, ?, 'ai', ?, ?)").bind(userId, activeCastId, reply, nowISO).run();
        await env.DB.prepare("INSERT INTO ChatLogs (user_id, cast_id, sender, content, timestamp) VALUES (?, ?, 'user', ?, ?)").bind(userId, activeCastId, text || "(会話開始)", nowISO).run();
    } catch (e) {
        console.error("DB Log Error:", e.message);
        // DB更新前などでカラムがない場合のフォールバック
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
