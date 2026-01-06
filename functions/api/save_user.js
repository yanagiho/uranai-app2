export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    // 画面から送られてくるデータを受け取る
    const { userId, lastName, firstName, dob, auth_type } = await request.json();

    // 必須項目のチェック
    if (!userId || !lastName || !firstName || !dob) {
      return new Response(JSON.stringify({ error: "入力情報が不足しています" }), { status: 400 });
    }

    // ★修正ポイント：
    // 画面の「lastName」を、DBの「last_name」カラムに正しく入れる
    // 画面の「firstName」を、DBの「first_name」カラムに正しく入れる
    
    // まずはUPDATE（更新）を試みる
    const result = await env.DB.prepare(
      "UPDATE Users SET last_name = ?, first_name = ?, dob = ? WHERE id = ?"
    ).bind(lastName, firstName, dob, userId).run();

    // もし更新対象がなかった（まだIDがDBにない）場合は、新規登録(INSERT)を行う
    if (result.meta.changes === 0) {
       await env.DB.prepare(
         "INSERT INTO Users (id, last_name, first_name, dob, ticket_balance) VALUES (?, ?, ?, ?, 0)"
       ).bind(userId, lastName, firstName, dob).run();
    }

    return new Response(JSON.stringify({ success: true }));
  } catch (err) {
    console.error("Save User Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
