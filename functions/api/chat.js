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
        // UTCとして解釈して時刻比較（念のため "Z" を付与して補正）
        const lastTimeStr = lastChat.timestamp.endsWith('Z') ? lastChat.timestamp : lastChat.timestamp + 'Z';
        const lastTime = new Date(lastTimeStr).getTime();
        const now = Date.now();
        // 10分以内ならセッション継続
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

    const promptText = `
あなたは占い師「${cast.name}」として振る舞ってください。
設定：${cast.systemPrompt}
相談者：${user.last_name} ${user.first_name} 様 (${user.dob}生まれ)
${expertKnowledge}

【過去の会話】
${historyText}

【相談内容】
${text}

【ルール】
1. すぐに結論を出さず、質問をして情報を引き出し、人間味を出してください。
2. 過去の会話を踏まえて話してください。
3. 話が解決したと感じたら、温かい言葉で締めくくってください。
4. カード画像 [CARD: ...] は、本当に必要な時だけ出してください。`;

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
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) throw new Error("AIからの応答が空でした。");

    // --- ログ保存・チケット消費 ---
    if (reservation) {
      await env.DB.prepare("UPDATE Reservations SET status = 'completed' WHERE id = ?").bind(reservation.id).run();
    } else if (!isSessionActive) {
      await env.DB.prepare("UPDATE Users SET ticket_balance = ticket_balance - 1 WHERE id = ?").bind(userId).run();
    }

    // 現在時刻(ISO形式)を取得
    const nowISO = new Date().toISOString();

    // AIの返答を保存
    await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content, timestamp) VALUES (?, 'ai', ?, ?)").bind(userId, reply, nowISO).run();
    // ユーザーの発言も保存（空文字対策済み）
    await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content, timestamp) VALUES (?, 'user', ?, ?)").bind(userId, text || "(スタンプ/無言)", nowISO).run();

    return new Response(JSON.stringify({ reply }));
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
