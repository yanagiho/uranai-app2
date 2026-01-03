export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.text();
    const event = JSON.parse(body);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.client_reference_id;
      
      // 価格判定の修正：27,000円以上なら10枚、それ以外は1枚 💰
      const amount = session.amount_total >= 27000 ? 10 : 1;

      // ユーザーが存在しない場合でもレコードを作成し、チケットを加算します（UPSERT）
      await env.DB.prepare(`
        INSERT INTO Users (id, ticket_balance) 
        VALUES (?, ?)
        ON CONFLICT(id) DO UPDATE SET 
          ticket_balance = Users.ticket_balance + excluded.ticket_balance
      `).bind(userId, amount).run();
    }

    return new Response(JSON.stringify({ received: true }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
