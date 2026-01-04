import { casts } from "./lib/casts.js"; // 修正 🚀

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, castId, scheduledAt } = await request.json();
    const user = await env.DB.prepare("SELECT ticket_balance FROM Users WHERE id = ?").bind(userId).first();
    
    if (!user || user.ticket_balance < 1) return new Response(JSON.stringify({ error: "チケットが足りません。" }));

    await env.DB.prepare("INSERT INTO Reservations (user_id, cast_id, scheduled_at, status) VALUES (?, ?, ?, 'pending')").bind(userId, castId, scheduledAt).run();
    await env.DB.prepare("UPDATE Users SET ticket_balance = ticket_balance - 1 WHERE id = ?").bind(userId).run();

    return new Response(JSON.stringify({ success: true }));
  } catch (e) { return new Response(JSON.stringify({ error: e.message }), { status: 500 }); }
}
