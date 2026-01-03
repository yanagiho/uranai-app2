export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId } = await request.json();
    const user = await env.DB.prepare("SELECT last_name, first_name, dob FROM Users WHERE id = ?").bind(userId).first();
    if (user && user.last_name && user.first_name && user.dob) {
      return new Response(JSON.stringify({ success: true, isComplete: true }));
    }
    return new Response(JSON.stringify({ success: true, isComplete: false }));
  } catch (e) { return new Response(JSON.stringify({ isComplete: false, error: e.message })); }
}
