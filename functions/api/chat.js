import { casts } from "./lib/casts.js";
import { tarotDataShion } from "./lib/tarot_data_shion.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, castId, text } = await request.json();
    const user = await env.DB.prepare("SELECT last_name, first_name, dob, ticket_balance FROM Users WHERE id = ?").bind(userId).first();
    const reservation = await env.DB.prepare("SELECT id FROM Reservations WHERE user_id = ? AND status = 'pending'").bind(userId).first();

    if (!user) return new Response(JSON.stringify({ error: "ログインが必要です。" }));
    // チケットも予約（決済済み）も無い場合は拒否 🎟️
    if (user.ticket_balance < 1 && !reservation) {
        return new Response(JSON.stringify({ reply: "鑑定にはチケットが必要です。右上の「＋」からお求めください。" }));
    }

    const cast = casts[castId];
    let expertKnowledge = castId === 1 ? `【ナレッジ】\n${JSON.stringify(tarotDataShion)}` : "";

    const systemPrompt = `${cast.systemPrompt}\n【相談者】${user.last_name} ${user.first_name} / ${user.dob}\n${expertKnowledge}\n掟：1.共感 2.占断（[CARD: 画像名.png]を最後に書く） 3.助言。`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: text || "鑑定をお願いします。" }] }], system_instruction: { parts: [{ text: systemPrompt }] } })
    });
    
    const data = await response.json();
    const reply = data.candidates[0].content.parts[0].text;

    // 予約を完了状態にする
    if (reservation) await env.DB.prepare("UPDATE Reservations SET status = 'completed' WHERE id = ?").bind(reservation.id).run();

    return new Response(JSON.stringify({ reply }));
  } catch (err) { return new Response(JSON.stringify({ error: "星の導きが途切れました。" }), { status: 500 }); }
}
