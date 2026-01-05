import { casts } from "./lib/casts.js";
import { tarotDataShion } from "./lib/tarot_data_shion.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY が設定されていません。");

    const { userId, castId, text } = await request.json();
    
    const user = await env.DB.prepare("SELECT * FROM Users WHERE id = ?").bind(userId).first();
    const reservation = await env.DB.prepare("SELECT id, cast_id FROM Reservations WHERE user_id = ? AND status = 'pending'").bind(userId).first();

    if (!user) return new Response(JSON.stringify({ error: "ログインが必要です。" }), { status: 401 });

    // --- チケット・セッション管理 ---
    const lastChat = await env.DB.prepare("SELECT timestamp FROM ChatLogs WHERE user_id = ? AND sender = 'ai' ORDER BY id DESC LIMIT 1").bind(userId).first();
    let isSessionActive = false;
    
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
    const historyData = await env.DB.prepare("SELECT sender, content FROM ChatLogs WHERE user_id = ? ORDER BY id DESC LIMIT 10").bind(userId).all();
    const historyText = historyData.results.reverse().map(log => {
        return `${log.sender === 'user' ? '相談者' : 'あなた'}: ${log.content}`;
    }).join("\n");

    // ★人間らしさと終了シーケンスを強化したプロンプト★
    const promptText = `
あなたはチャット占い師「${cast.name}」です。AIではありません。生身の人間として振る舞ってください。
設定：${cast.systemPrompt}
相談者：${user.last_name} ${user.first_name} 様 (${user.dob}生まれ)
${expertKnowledge}

【過去の会話】
${historyText}

【相談内容】
${text}

【絶対的な対話ルール】
1. **人間らしさの追求**:
   - 完璧な回答をしないでください。「うーん…」「そうですねぇ…」といったフィラー（言葉の綾）や、「それはお辛いですね」といった共感の言葉を自然に混ぜてください。
   - 相手の話をよく聞き、一度に全て解決しようとせず、会話のキャッチボールを重視してください。
2. **記憶の活用**:
   - 過去ログにある話題が出たら「先ほど仰っていた〜」と触れてください。
3. **終了の判断**:
   - 相談者が満足した様子を見せる、または「ありがとう」「これで頑張ってみます」といった発言をした場合、温かい応援の言葉で会話を締めくくってください。
   - **会話を終了すべきと判断した場合のみ、発言の最後に必ず「[END]」という文字列を付けてください。**（これはシステムへの合図です。相談者には見えません）
4. **カード演出**:
   - ここぞという場面でのみ [CARD: 画像ファイル名] を出力してください。乱発しないでください。`;

    // Gemini 2.5 Flash
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
    });
    
    if (!response.ok) {
        const err = await response.text();
        console.error(err);
        throw new Error(`AI通信エラー (${response.status})`);
    }
    
    const data = await response.json();
    let reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) throw new Error("AIからの応答が空でした。");

    // ★終了フラグの検知★
    let isEnded = false;
    if (reply.includes("[END]")) {
        isEnded = true;
        reply = reply.replace("[END]", "").trim(); // 表示用テキストからは削除
    }

    // --- ログ保存・チケット消費 ---
    if (reservation) {
      await env.DB.prepare("UPDATE Reservations SET status = 'completed' WHERE id = ?").bind(reservation.id).run();
    } else if (!isSessionActive) {
      await env.DB.prepare("UPDATE Users SET ticket_balance = ticket_balance - 1 WHERE id = ?").bind(userId).run();
    }

    const nowISO = new Date().toISOString();
    await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content, timestamp) VALUES (?, 'ai', ?, ?)").bind(userId, reply, nowISO).run();
    await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content, timestamp) VALUES (?, 'user', ?, ?)").bind(userId, text || "(スタンプ/無言)", nowISO).run();

    // クライアントに終了フラグも返す
    return new Response(JSON.stringify({ reply, isEnded }));
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
