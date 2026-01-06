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

    // --- チケット・セッション管理 ---
    let lastChat = null;
    let isSessionActive = false;
    
    try {
        lastChat = await env.DB.prepare("SELECT timestamp FROM ChatLogs WHERE user_id = ? AND sender = 'ai' ORDER BY id DESC LIMIT 1").bind(userId).first();
    } catch (e) {
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

    // 過去ログ取得
    let historyText = "";
    try {
        const historyData = await env.DB.prepare("SELECT sender, content FROM ChatLogs WHERE user_id = ? ORDER BY id DESC LIMIT 10").bind(userId).all();
        historyText = historyData.results.reverse().map(log => {
            return `${log.sender === 'user' ? '相談者' : 'あなた'}: ${log.content}`;
        }).join("\n");
    } catch (e) {
        console.error("DB Error (history):", e.message);
    }

    // ★追加：現在日時の取得とフォーマット（日本時間）
    const now = new Date();
    const currentDate = now.toLocaleString('ja-JP', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        weekday: 'long',
        hour: 'numeric', 
        minute: 'numeric',
        timeZone: 'Asia/Tokyo' 
    });

    // プロンプト（日時認識を追加）
    const promptText = `
あなたはチャット占い師「${cast.name}」です。AIではなく、感情を持った人間として振る舞ってください。
設定：${cast.systemPrompt}
相談者：${user.last_name} ${user.first_name} 様 (${user.dob}生まれ)
${expertKnowledge}

【現在日時】
${currentDate}
※重要：「今年」や「来年」、「今日」といった言葉は、上記の現在日時を基準に解釈してください。
※現在は2026年です。過去の年（2024年や2025年など）を未来のこととして話さないように注意してください。

【直近の会話履歴】
${historyText}

【相談者の最新の言葉】
${text}

【対話・鑑定の絶対ルール】
1. **人間味の追求**:
   - 即答で解決策を出さず、まずは「うーん、それは辛いですね…」「なるほど…」といった**フィラー（間投詞）や共感**から始めてください。
2. **文脈の維持**:
   - 過去の履歴にある内容を「さっき仰っていた〜」と引用し、**記憶していること**をアピールしてください。
3. **終了の判断（重要）**:
   - 相談者が「ありがとう」「スッキリしました」等と言ったり、話題が尽きたと感じたら、ダラダラ続けずに**綺麗に締めくくってください**。
   - **会話を終了すべき時は、発言の最後に必ず「[END]」という文字列を付けてください。**
4. **演出**:
   - タロット画像の出力 [CARD: ...] は、ここぞという場面でのみ行ってください。

以上のルールを守り、${cast.name}になりきって返答してください。`;

    // Gemini 2.5 Flash
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
    } else if (!isSessionActive) {
      await env.DB.prepare("UPDATE Users SET ticket_balance = ticket_balance - 1 WHERE id = ?").bind(userId).run();
    }

    // ログ保存
    try {
        const nowISO = new Date().toISOString();
        await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content, timestamp) VALUES (?, 'ai', ?, ?)").bind(userId, reply, nowISO).run();
        await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content, timestamp) VALUES (?, 'user', ?, ?)").bind(userId, text || "(...)", nowISO).run();
    } catch (e) {
        console.error("DB Log Error:", e.message);
        if (e.message.includes("no such column: timestamp")) {
             await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content) VALUES (?, 'ai', ?)").bind(userId, reply).run();
             await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content) VALUES (?, 'user', ?)").bind(userId, text || "(...)").run();
        }
    }

    return new Response(JSON.stringify({ reply, isEnded }));
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
