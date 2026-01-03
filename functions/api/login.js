export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId } = await request.json();
    if (!userId) return new Response(JSON.stringify({ isComplete: false }));

    // データベースからユーザーを取得（カラム不足でもエラーにしない）
    const user = await env.DB.prepare("SELECT * FROM Users WHERE id = ?").bind(userId).first();

    if (user && user.last_name && user.first_name && user.dob) {
      return new Response(JSON.stringify({ success: true, isComplete: true }));
    } else {
      return new Response(JSON.stringify({ success: true, isComplete: false }));
    }
  } catch (e) {
    // データベースが未完成の場合は「未登録」として扱う（500エラーを回避）
    return new Response(JSON.stringify({ isComplete: false, error: "DB_NOT_READY" }));
  }
}
