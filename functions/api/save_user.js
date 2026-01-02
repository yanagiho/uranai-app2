export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, name, dob, email, auth_type } = await request.json();

    // データベースの新しい項目（name, dob, auth_type）に合わせて保存します
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
    console.error("Save User Error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
