export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { email, auth_type, userId } = await request.json();
    
    // IDまたはメールアドレスで検索
    const user = await env.DB.prepare("SELECT * FROM Users WHERE id = ? OR email = ?")
      .bind(userId, email).first();

    if (user) {
      // データベースにある名前と誕生日が埋まっているか確認
      const isComplete = !!(user.name && user.dob);
      return new Response(JSON.stringify({ 
        success: true, userId: user.id, isComplete 
      }));
    } else {
      // 新規ユーザー（まだ登録が済んでいない状態）
      return new Response(JSON.stringify({ success: true, isComplete: false }));
    }
  } catch (e) {
    console.error("Login Error:", e.message);
    return new Response(JSON.stringify({ error: "ログイン処理でエラーが発生しました。" }), { status: 500 });
  }
}
