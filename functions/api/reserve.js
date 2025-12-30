export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, castId, scheduledAt } = await request.json();

    // 予約実行（UNIQUE制約により、既に予約があれば自動的にエラーになる）
    await env.DB.prepare("INSERT INTO Reservations (user_id, cast_id, scheduled_at) VALUES (?, ?, ?)")
      .bind(userId, castId, scheduledAt).run();

    await env.DB.prepare("UPDATE Users SET ticket_balance = ticket_balance - 1 WHERE id = ?")
      .bind(userId).run();

    return new Response(JSON.stringify({ success: true }));
  } catch (e) {
    // 既に予約がある場合のエラーハンドリング
    return new Response(JSON.stringify({ error: "現在、既に一つの鑑定予約が入っています。終了するまで新しい予約はできません。" }), { status: 400 });
  }
}
