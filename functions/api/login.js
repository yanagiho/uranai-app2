export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { email, auth_type, userId } = await request.json();
    
    let user = await env.DB.prepare("SELECT * FROM Users WHERE id = ? OR email = ?")
      .bind(userId, email).first();

    if (user) {
      // ユーザーが存在し、かつ名前と生年月日が埋まっているかチェック
      const isComplete = !!(user.name && user.dob);
      return new Response(JSON.stringify({ 
        success: true, userId: user.id, isComplete, user 
      }));
    } else {
      return new Response(JSON.stringify({ success: true, isComplete: false }));
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
