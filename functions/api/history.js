export async function onRequestGet(context) {
  const { env } = context;

  try {
    // データベースから最新のチャットログを50件取得する
    const { results } = await env.DB.prepare(
      "SELECT sender, content, datetime(created_at, 'unixepoch', 'localtime') as time FROM ChatLogs ORDER BY created_at DESC LIMIT 50"
    ).all();

    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
