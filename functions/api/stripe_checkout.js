export async function onRequestPost(context) {
  const { request, env } = context;
  const { userId, amount } = await request.json();

  const priceId = amount === 10 ? env.STRIPE_PRICE_ID_10 : env.STRIPE_PRICE_ID_1;
  const stripeKey = env.STRIPE_SECRET_KEY;

  // Stripe Checkout Session作成
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
      "client_reference_id": userId, // ここにユーザーIDを入れることで後で誰が買ったか判別する
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1"
    })
  });

  const session = await response.json();
  return new Response(JSON.stringify({ url: session.url }));
}
