export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");

  try {
    // ユーザー基本情報
    const user = await env.DB.prepare("SELECT name, ticket_balance FROM Users WHERE id = ?").bind(userId).first();
    
    // 現在有効な（まだ完了していない）予約があるか
    const reservation = await env.DB.prepare("SELECT id FROM Reservations WHERE user_id = ? AND status = 'pending'").bind(userId).first();

    return new Response(JSON.stringify({
      name: user?.name || "ゲスト",
      ticket_balance: user?.ticket_balance || 0,
      hasPendingReservation: !!reservation // 予約があれば true
    }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
