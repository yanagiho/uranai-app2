export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { email, auth_type, userId } = await request.json();
    
    let user;
    if (email) {
      // メールログインの場合
      user = await env.DB.prepare("SELECT id FROM Users WHERE email = ?").bind(email).first();
    } else {
      // SNSログインの場合（ブラウザ保存のIDで照合）
      user = await env.DB.prepare("SELECT id FROM Users WHERE id = ? AND auth_type = ?").bind(userId, auth_type).first();
    }

    if (user) {
      return new Response(JSON.stringify({ success: true, userId: user.id, isNew: false }));
    } else {
      return new Response(JSON.stringify({ success: true, isNew: true }));
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
