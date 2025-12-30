export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, name, dob, email, blood } = await request.json();

    // ユーザー情報を保存・更新（メールアドレスを含む）
    await env.DB.prepare(`
      INSERT INTO Users (id, name, dob, email, blood, ticket_balance) 
      VALUES (?, ?, ?, ?, ?, 10)
      ON CONFLICT(id) DO UPDATE SET 
        name = excluded.name, 
        dob = excluded.dob, 
        email = excluded.email,
        blood = excluded.blood
    `).bind(userId, name, dob, email, blood).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
