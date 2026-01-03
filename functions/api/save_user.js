export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, lastName, firstName, dob, auth_type } = await request.json();

    // 初回登録なら10枚付与、すでにチケット（購入分）があれば合算 🎁
    await env.DB.prepare(`
      INSERT INTO Users (id, last_name, first_name, dob, auth_type, ticket_balance) 
      VALUES (?, ?, ?, ?, ?, 10)
      ON CONFLICT(id) DO UPDATE SET 
        last_name = excluded.last_name, 
        first_name = excluded.first_name, 
        dob = excluded.dob,
        auth_type = excluded.auth_type,
        ticket_balance = Users.ticket_balance + excluded.ticket_balance
    `).bind(userId, lastName, firstName, dob, auth_type).run();

    return new Response(JSON.stringify({ success: true }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
