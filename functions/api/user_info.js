export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");

  if (!userId) return new Response("UserId required", { status: 400 });

  try {
    // データベースからユーザーの情報を1件取得
    const user = await env.DB.prepare("SELECT name, ticket_balance FROM Users WHERE id = ?")
      .bind(userId)
      .first();

    // ユーザーが見つからない場合は新規作成用の初期値を返す
    const data = user || { name: "新規客", ticket_balance: 10 };

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
