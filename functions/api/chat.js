import { casts } from "./lib/casts.js";
import { tarotDataShion } from "./lib/tarot_data_shion.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, castId, text } = await request.json();
    const user = await env.DB.prepare("SELECT * FROM Users WHERE id = ?").bind(userId).first();
    const reservation = await env.DB.prepare("SELECT cast_id, id FROM Reservations WHERE user_id = ? AND status = 'pending'").bind(userId).first();

    if (!user) return new Response(JSON.stringify({ error: "ログインが必要です" }), { status: 401 });

    // チケット・予約チェック 🎟️
    if (user.ticket_balance < 1 && !reservation) {
      return new Response(JSON.stringify({ reply: "鑑定を受けるにはチケットが必要です。右上の「＋」からお求めください。" }));
    }

    // 占い師を特定（予約がある場合は予約した占い師を優先）
    const activeCastId = reservation ? reservation.cast_id : castId;
    const cast = casts[activeCastId];
    if (!cast) throw new Error("鑑定師情報が見つかりません");

    let expertKnowledge = activeCastId === 1 ? `【タロット知識】\n${JSON.stringify(tarotDataShion)}` : "";

    const systemPrompt = `${cast.systemPrompt}\n【相談者】${user.last_name}${user.first_name}様 (${user.dob})\n掟：1.深く共感 2.占断し最後に必ず [CARD: 画像名.png] と書く 3.具体的な助言。`;

    // 🚀 モデル名を実在する gemini-1.5-pro に修正
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: text || "鑑定をお願いします" }] }],
        system_instruction: { parts: [{ text: systemPrompt }] }
      })
    });
    
    const data = await response.json();
    if (!data.candidates) throw new Error(data.error?.message || "AI応答エラー");
    const reply = data.candidates[0].content.parts[0].text;

    // 予約の完了処理 or チケット消費
    if (reservation) {
      await env.DB.prepare("UPDATE Reservations SET status = 'completed' WHERE id = ?").bind(reservation.id).run();
    } else {
      await env.DB.prepare("UPDATE Users SET ticket_balance = ticket_balance - 1 WHERE id = ?").bind(userId).run();
    }
    await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content) VALUES (?, 'ai', ?)").bind(userId, reply).run();

    return new Response(JSON.stringify({ reply }));
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
