export async function onRequest(context) {
  try {
    const results = await context.env.DB.prepare("SELECT * FROM Casts").all();
    return new Response(JSON.stringify(results.results), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(e.message, { status: 500 });
  }
}
