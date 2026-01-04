export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, email, auth_type } = await request.json();
    
    // 既存ユーザーを検索
    let user = await env.DB.prepare("SELECT * FROM Users WHERE id = ?").bind(userId).first();

    if (!user) {
      // 未登録なら仮登録
      await env.DB.prepare("INSERT INTO Users (id, email, auth_type, ticket_balance) VALUES (?, ?, ?, 0)")
        .bind(userId, email || "", auth_type || "")
        .run();
      return new Response(JSON.stringify({ success: true, isComplete: false }));
    }

    // 姓名と誕生日が埋まっているかチェック
    const isComplete = !!(user.last_name && user.first_name && user.dob);
    return new Response(JSON.stringify({ success: true, isComplete }));
    
  } catch (e) { 
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500 }); 
  }
}
