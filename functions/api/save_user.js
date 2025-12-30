export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, name, dob, blood } = await request.json();

    // すでにユーザーがいる場合は、名前などの情報だけ更新し、チケット枚数は維持する
    await env.DB.prepare(`
      INSERT INTO Users (id, name, dob, blood, ticket_balance) 
      VALUES (?, ?, ?, ?, 10)
      ON CONFLICT(id) DO UPDATE SET 
        name = excluded.name, 
        dob = excluded.dob, 
        blood = excluded.blood
    `).bind(userId, name, dob, blood).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
