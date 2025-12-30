export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");

  try {
    const { results } = await env.DB.prepare(`
      SELECT cast_name, card_name, card_image, datetime(created_at, 'unixepoch', 'localtime') as time 
      FROM ChatLogs 
      WHERE user_id = ? AND card_name IS NOT NULL 
      ORDER BY created_at DESC 
      LIMIT 30
    `).bind(userId).all();

    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
