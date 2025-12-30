export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, castId, scheduledAt } = await request.json();

    // 1. 重複予約チェック（一人の占い師を予約していると他は不可）
    const existing = await env.DB.prepare("SELECT id FROM Reservations WHERE user_id = ? AND status = 'pending'").bind(userId).first();
    if (existing) return new Response(JSON.stringify({ error: "既に他の予約があります。現在の鑑定が終了してから次をご予約ください。" }));

    // 2. チケット確認
    const user = await env.DB.prepare("SELECT ticket_balance FROM Users WHERE id = ?").bind(userId).first();
    if (!user || user.ticket_balance <= 0) return new Response(JSON.stringify({ error: "チケットが不足しています" }));

    // 3. 予約登録
    await env.DB.prepare("INSERT INTO Reservations (user_id, cast_id, scheduled_at) VALUES (?, ?, ?)").bind(userId, castId, scheduledAt).run();
    await env.DB.prepare("UPDATE Users SET ticket_balance = ticket_balance - 1 WHERE id = ?").bind(userId).run();

    return new Response(JSON.stringify({ success: true }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
