export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, name, dob, email, auth_type } = await request.json();

    await env.DB.prepare(`
      INSERT INTO Users (id, name, dob, email, auth_type, ticket_balance) 
      VALUES (?, ?, ?, ?, ?, 10)
      ON CONFLICT(id) DO UPDATE SET 
        name = excluded.name, 
        dob = excluded.dob, 
        email = excluded.email,
        auth_type = excluded.auth_type
    `).bind(userId, name, dob, email, auth_type).run();

    return new Response(JSON.stringify({ success: true }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
