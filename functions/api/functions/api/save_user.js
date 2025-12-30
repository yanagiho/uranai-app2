export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const { userId, name, dob, blood } = await request.json();

    // ユーザー情報を追加、または既に存在すれば更新する（UPSERT）
    await env.DB.prepare(`
      INSERT INTO Users (id, name, dob, blood) 
      VALUES (?, ?, ?, ?)
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
