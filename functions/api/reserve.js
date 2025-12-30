export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, castId, scheduledAt } = await request.json();

    // チケット確認
    const user = await env.DB.prepare("SELECT ticket_balance FROM Users WHERE id = ?").bind(userId).first();
    if (!user || user.ticket_balance <= 0) return new Response(JSON.stringify({ error: "チケットが不足しています" }));

    // 予約を登録
    await env.DB.prepare("INSERT INTO Reservations (user_id, cast_id, scheduled_at) VALUES (?, ?, ?)")
      .bind(userId, castId, scheduledAt).run();

    // 予約時にチケット1枚消費（商用モデル）
    await env.DB.prepare("UPDATE Users SET ticket_balance = ticket_balance - 1 WHERE id = ?").bind(userId).run();

    // TODO: ここでEmailやLINEの通知APIを叩く
    console.log(`Notification sent to ${userId}: Your session starts at ${scheduledAt}`);

    return new Response(JSON.stringify({ success: true }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
