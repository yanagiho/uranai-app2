export async function onRequestGet(context) {
  const API_KEY = context.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
  
  const res = await fetch(url);
  const data = await res.json();
  
  // 使えるモデルの一覧を画面に表示する
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" }
  });
}
