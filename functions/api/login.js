export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { email } = await request.json();
    
    // メールアドレスでユーザーを検索
    const user = await env.DB.prepare("SELECT id, name FROM Users WHERE email = ?")
      .bind(email).first();

    if (user) {
      // ユーザーがいた場合：ログイン成功としてIDを返す
      return new Response(JSON.stringify({ success: true, userId: user.id, isNew: false }));
    } else {
      // ユーザーがいない場合：新規登録へ進ませる
      return new Response(JSON.stringify({ success: true, isNew: true }));
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
