export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, name, dob, email } = await request.json();

    // データベースの項目(id, name, dob, email)に合わせて保存します
    await env.DB.prepare(`
      INSERT INTO Users (id, name, dob, email, ticket_balance) 
      VALUES (?, ?, ?, ?, 10)
      ON CONFLICT(id) DO UPDATE SET 
        name = excluded.name, 
        dob = excluded.dob, 
        email = excluded.email
    `).bind(userId, name, dob, email).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
