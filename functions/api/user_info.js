export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");

  try {
    // 修正：name ではなく last_name, first_name を取得するように変更 🚀
    const user = await env.DB.prepare("SELECT last_name, first_name, ticket_balance FROM Users WHERE id = ?").bind(userId).first();
    const res = await env.DB.prepare("SELECT id FROM Reservations WHERE user_id = ? AND status = 'pending'").bind(userId).first();

    return new Response(JSON.stringify({
      firstName: user?.first_name || "ゲスト",
      ticket_balance: user?.ticket_balance || 0,
      hasPendingReservation: !!res
    }), { headers: { "Content-Type": "application/json" } });
  } catch (e) { 
    return new Response(JSON.stringify({ error: e.message }), { status: 500 }); 
  }
}
