export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId } = await request.json();
    // チケットを10枚増やす
    await env.DB.prepare("UPDATE Users SET ticket_balance = ticket_balance + 10 WHERE id = ?").bind(userId).run();
    return new Response(JSON.stringify({ success: true }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
