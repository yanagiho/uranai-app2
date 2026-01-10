export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, lastName, firstName, dob, gender } = await request.json();

    if (!userId || !lastName || !firstName || !dob) {
      return new Response(JSON.stringify({ error: "必須項目が不足しています" }), { status: 400 });
    }

    // 更新を試みる
    const result = await env.DB.prepare(
      "UPDATE Users SET last_name = ?, first_name = ?, dob = ?, gender = ? WHERE id = ?"
    ).bind(lastName, firstName, dob, gender, userId).run();

    // 更新対象がなければ新規作成
    if (result.meta.changes === 0) {
       await env.DB.prepare(
         "INSERT INTO Users (id, last_name, first_name, dob, gender, ticket_balance) VALUES (?, ?, ?, ?, ?, 0)"
       ).bind(userId, lastName, firstName, dob, gender).run();
    }

    return new Response(JSON.stringify({ success: true }));
  } catch (err) {
    console.error("Save User Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
