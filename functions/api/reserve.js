import { casts } from "../../src/casts.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, castId, scheduledAt } = await request.json();

    // 修正：last_name, first_name を取得するように変更 🚀
    const user = await env.DB.prepare("SELECT last_name, first_name, email, ticket_balance FROM Users WHERE id = ?").bind(userId).first();
    if (!user || user.ticket_balance < 1) return new Response(JSON.stringify({ error: "チケットが足りません。" }));

    await env.DB.prepare("INSERT INTO Reservations (user_id, cast_id, scheduled_at, status) VALUES (?, ?, ?, 'pending')").bind(userId, castId, scheduledAt).run();
    await env.DB.prepare("UPDATE Users SET ticket_balance = ticket_balance - 1 WHERE id = ?").bind(userId).run();

    if (user.email) {
      const cast = casts[castId];
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "AI占いの館 <onboarding@resend.dev>",
          to: [user.email],
          subject: "【予約完了】鑑定の準備が整いました",
          text: `${user.last_name} ${user.first_name} 様\n\n鑑定師：${cast.name}\n日時：${scheduledAt.replace('T', ' ')}`
        })
      });
    }
    return new Response(JSON.stringify({ success: true }));
  } catch (e) { return new Response(JSON.stringify({ error: e.message }), { status: 500 }); }
}
