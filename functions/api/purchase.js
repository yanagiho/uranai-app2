export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, token, item_type } = await request.json();

    if (!userId || !token || !item_type) {
        return new Response(JSON.stringify({ error: "必須パラメータが不足しています" }), { status: 400 });
    }

    // ★★★ 価格設定の変更箇所 ★★★
    let amount = 0;
    let ticketsToAdd = 0;

    if (item_type === 10) {
        // 10枚セット: 4,500円
        amount = 4500;
        ticketsToAdd = 10;
    } else {
        // 1枚単発: 500円
        amount = 500;
        ticketsToAdd = 1;
    }

    // PAY.JPへ決済リクエスト
    const auth = btoa(`${env.PAYJP_SECRET_KEY}:`);
    
    const payRes = await fetch('https://api.pay.jp/v1/charges', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            amount: amount.toString(),
            currency: 'jpy',
            card: token,
            description: `運命の回廊 チケット購入 (${ticketsToAdd}枚)`
        })
    });

    const payData = await payRes.json();

    if (!payRes.ok) {
        console.error("PAY.JP Error:", payData);
        return new Response(JSON.stringify({ error: payData.error.message || "カード決済に失敗しました" }), { status: 400 });
    }

    // 決済成功 -> チケット付与
    await env.DB.prepare(`
        INSERT INTO Users (id, ticket_balance) 
        VALUES (?, ?)
        ON CONFLICT(id) DO UPDATE SET 
          ticket_balance = Users.ticket_balance + excluded.ticket_balance
    `).bind(userId, ticketsToAdd).run();

    return new Response(JSON.stringify({ success: true, chargeId: payData.id }), { headers: { "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
