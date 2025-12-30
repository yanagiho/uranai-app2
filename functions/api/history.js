export async function onRequestGet(context) {
  const { env } = context;
  try {
    // カード画像が保存されている履歴のみを抽出
    const { results } = await env.DB.prepare(`
      SELECT cast_name, card_name, card_image, datetime(created_at, 'unixepoch', 'localtime') as time 
      FROM ChatLogs 
      WHERE card_name IS NOT NULL 
      ORDER BY created_at DESC 
      LIMIT 20
    `).all();

    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
