export async function onRequestGet(context) {
  const API_KEY = context.env.GEMINI_API_KEY;
  // v1beta を使って、全ての利用可能モデルを問い合わせる
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    
    // 見やすく整理して表示する
    return new Response(JSON.stringify(data, null, 2), {
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
