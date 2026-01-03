export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId } = await request.json();
    // データベースから最新の姓名情報を取得
    const user = await env.DB.prepare("SELECT last_name, first_name, dob FROM Users WHERE id = ?").bind(userId).first();

    if (user) {
      // 姓・名・誕生日が揃っていれば「登録済み」として true を返す
      const isComplete = !!(user.last_name && user.first_name && user.dob);
      return new Response(JSON.stringify({ success: true, isComplete }));
    } else {
      return new Response(JSON.stringify({ success: true, isComplete: false }));
    }
  } catch (e) {
    // データベースのカラムがない場合でもエラーにせず false を返す
    return new Response(JSON.stringify({ success: true, isComplete: false, error: e.message }));
  }
}
