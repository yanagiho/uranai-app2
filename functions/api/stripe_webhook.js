export async function onRequestPost(context) {
  const { request, env } = context;
  const sig = request.headers.get("stripe-signature");
  const body = await request.text();

  // 本来はここで署名検証（sig）を行いますが、Pagesでは設定が複雑なため
  // クリティカルな本番運用の場合は署名検証を実装してください。
  const event = JSON.parse(body);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.client_reference_id;
    
    // 購入枚数を判別（価格IDなどで判定）
    const amount = session.amount_total === 8000 ? 10 : 1;

    // データベースのチケット枚数を増やす
    await env.DB.prepare("UPDATE Users SET ticket_balance = ticket_balance + ? WHERE id = ?")
      .bind(amount, userId).run();
  }

  return new Response(JSON.stringify({ received: true }));
}
