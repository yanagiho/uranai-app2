export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId } = await request.json();

    const res = await env.DB.prepare("SELECT id FROM Reservations WHERE user_id = ? AND status = 'pending'").bind(userId).first();
    if (!res) return new Response(JSON.stringify({ error: "予約が見つかりません。" }));

    // 予約削除とチケット返却
    await env.DB.prepare("DELETE FROM Reservations WHERE user_id = ?").bind(userId).run();
    await env.DB.prepare("UPDATE Users SET ticket_balance = ticket_balance + 1 WHERE id = ?").bind(userId).run();

    return new Response(JSON.stringify({ success: true }));
  } catch (e) {
    return new Response(JSON.stringify({ error: "キャンセルに失敗しました。" }), { status: 500 });
  }
}
