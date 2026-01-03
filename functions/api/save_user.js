export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, lastName, firstName, dob, auth_type } = await request.json();
    // 既存のチケット枚数を変えずに、名前情報だけを更新します 🎁
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
