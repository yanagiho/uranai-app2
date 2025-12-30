export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId } = await request.json();

    // 1. 予約があるか確認
    const res = await env.DB.prepare("SELECT id FROM Reservations WHERE user_id = ? AND status = 'pending'").bind(userId).first();
    if (!res) return new Response(JSON.stringify({ error: "予約が見つかりません。" }));

    // 2. 予約を削除し、チケットを1枚戻す（原子性を保つため1つのトランザクションが理想）
    await env.DB.prepare("DELETE FROM Reservations WHERE user_id = ?").bind(userId).run();
    await env.DB.prepare("UPDATE Users SET ticket_balance = ticket_balance + 1 WHERE id = ?").bind(userId).run();

    return new Response(JSON.stringify({ success: true }));
  } catch (e) {
    return new Response(JSON.stringify({ error: "キャンセル処理に失敗しました。" }));
  }
}
