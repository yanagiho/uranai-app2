export async function onRequest(context) {
  try {
    // データベースから占い師を一人呼んでみる
    const result = await context.env.DB.prepare("SELECT name FROM Casts LIMIT 1").first();
    return new Response(JSON.stringify({ message: `接続成功！占い師「${result.name}」が待機中です。` }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ message: "DB接続エラー: " + e.message }), { status: 500 });
  }
}