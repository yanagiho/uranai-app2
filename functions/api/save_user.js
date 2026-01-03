export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, lastName, firstName, dob, auth_type } = await request.json();

    // INSERT時は0枚、既にレコード（Stripe購入分）があればその枚数を維持（excluded.ticket_balanceを使わない） 🎁
    await env.DB.prepare(`
      INSERT INTO Users (id, last_name, first_name, dob, auth_type, ticket_balance) 
      VALUES (?, ?, ?, ?, ?, 0)
      ON CONFLICT(id) DO UPDATE SET 
        last_name = excluded.last_name, 
        first_name = excluded.first_name, 
        dob = excluded.dob,
        auth_type = excluded.auth_type
    `).bind(userId, lastName, firstName, dob, auth_type).run();

    return new Response(JSON.stringify({ success: true }));
  } catch (e) { return new Response(JSON.stringify({ error: e.message }), { status: 500 }); }
}
