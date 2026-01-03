export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, amount } = await request.json();

    const priceId = amount === 10 ? env.STRIPE_PRICE_ID_10 : env.STRIPE_PRICE_ID_1;
    const stripeKey = env.STRIPE_SECRET_KEY;

    if (!priceId || !stripeKey) {
      throw new Error("Stripeの設定（価格IDまたは秘密鍵）が不足しています。");
    }

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        "success_url": `${env.BASE_URL || 'https://uranai-app2.pages.dev'}?payment=success`,
        "cancel_url": `${env.BASE_URL || 'https://uranai-app2.pages.dev'}?payment=cancel`,
        "payment_method_types[]": "card",
        "mode": "payment",
        "client_reference_id": userId,
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1"
      })
    });

    const session = await response.json();
    if (session.error) throw new Error(session.error.message);

    return new Response(JSON.stringify({ url: session.url }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
