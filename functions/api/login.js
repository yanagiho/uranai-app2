export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { email, auth_type, userId } = await request.json();
    
    // IDまたはメールアドレスで既存ユーザーを検索
    const user = await env.DB.prepare("SELECT * FROM Users WHERE id = ? OR email = ?")
      .bind(userId, email).first();

    if (user) {
      // 名前と生年月日の両方が登録されているか確認
      const isComplete = !!(user.name && user.dob);
      return new Response(JSON.stringify({ 
        success: true, userId: user.id, isComplete, user 
      }));
    } else {
      // 完全に新規のユーザー
      return new Response(JSON.stringify({ success: true, isComplete: false }));
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
