export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, lastName, firstName, dob, auth_type } = await request.json();
    await env.DB.prepare(`
      UPDATE Users SET 
        last_name = ?, first_name = ?, dob = ?, auth_type = ? 
      WHERE id = ?
    `).bind(lastName, firstName, dob, auth_type, userId).run();
    return new Response(JSON.stringify({ success: true }));
  } catch (e) { 
    return new Response(JSON.stringify({ error: e.message }), { status: 500 }); 
  }
}
