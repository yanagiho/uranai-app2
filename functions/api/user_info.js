export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");

  try {
    const user = await env.DB.prepare("SELECT last_name, first_name, ticket_balance FROM Users WHERE id = ?").bind(userId).first();
    // ★修正: scheduled_at も取得する
    const res = await env.DB.prepare("SELECT cast_id, scheduled_at FROM Reservations WHERE user_id = ? AND status = 'pending'").bind(userId).first();

    return new Response(JSON.stringify({
      lastName: user?.last_name || "",
      firstName: user?.first_name || "ゲスト",
      ticket_balance: user?.ticket_balance || 0,
      hasPendingReservation: !!res,
      pendingCastId: res?.cast_id || null,
      reservationTime: res?.scheduled_at || null // ★追加
    }), { headers: { "Content-Type": "application/json" } });
  } catch (e) { 
    return new Response(JSON.stringify({ error: e.message }), { status: 500 }); 
  }
}
