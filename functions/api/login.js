export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, email, auth_type } = await request.json();

    // 1. ユーザーがいなければ枠だけ作る（ID登録）
    // 名前などはまだNULLの状態
    await env.DB.prepare(
      "INSERT OR IGNORE INTO Users (id, email) VALUES (?, ?)"
    ).bind(userId, email || null).run();

    // 2. 現在のユーザー情報を取得
    const user = await env.DB.prepare("SELECT * FROM Users WHERE id = ?").bind(userId).first();

    // 3. ★修正ポイント：登録完了フラグ(isComplete)の判定
    // last_name, first_name, dob がすべて揃っていないと「未完了」とみなす
    // これにより、データが欠けている人は必ず登録画面(setup-screen)に飛ばされる
    const isComplete = !!(user && user.last_name && user.first_name && user.dob);

    return new Response(JSON.stringify({ 
      isComplete, 
      user 
    }));
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
