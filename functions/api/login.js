export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { email, userId } = await request.json();
    // データベースからユーザーを検索
    const user = await env.DB.prepare("SELECT * FROM Users WHERE id = ? OR email = ?").bind(userId, email).first();

    if (user) {
      // 姓、名、誕生日のすべてが埋まっていれば「登録完了」とみなす 🚀
      const isComplete = !!(user.last_name && user.first_name && user.dob);
      return new Response(JSON.stringify({ success: true, userId: user.id, isComplete }));
    } else {
      return new Response(JSON.stringify({ success: true, isComplete: false }));
    }
  } catch (e) { 
    // カラムがないなどのエラーを回避
    return new Response(JSON.stringify({ error: e.message }), { status: 500 }); 
  }
}
