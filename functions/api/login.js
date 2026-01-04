export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, email } = await request.json();
    // IDまたはメールアドレスで既存ユーザーを検索 🔍
    const user = await env.DB.prepare("SELECT * FROM Users WHERE id = ? OR email = ?").bind(userId, email).first();

    if (user && user.last_name && user.first_name && user.dob) {
      return new Response(JSON.stringify({ success: true, isComplete: true }));
    }
    return new Response(JSON.stringify({ success: true, isComplete: false }));
  } catch (e) { 
    return new Response(JSON.stringify({ success: true, isComplete: false, error: e.message })); 
  }
}
