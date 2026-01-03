export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.text();
  const event = JSON.parse(body);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.client_reference_id;
    
    // 金額で枚数を判定（8000円なら10枚、それ以外は1枚）
    const amount = session.amount_total >= 8000 ? 10 : 1;

    await env.DB.prepare("UPDATE Users SET ticket_balance = ticket_balance + ? WHERE id = ?")
      .bind(amount, userId).run();
  }

  return new Response(JSON.stringify({ received: true }));
}
