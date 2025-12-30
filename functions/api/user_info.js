export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");

  if (!userId) return new Response("UserId required", { status: 400 });

  try {
    const user = await env.DB.prepare("SELECT name, ticket_balance FROM Users WHERE id = ?")
      .bind(userId)
      .first();

    return new Response(JSON.stringify(user || { error: "User not found" }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
