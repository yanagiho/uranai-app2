// chat.js 全文書き換え
export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, castId, text } = await request.json();
    const user = await env.DB.prepare("SELECT last_name, first_name, dob FROM Users WHERE id = ?").bind(userId).first();

    // 占い師データを直接埋め込む（読み込みエラーを物理的に防ぐ） 🛡️
    const casts = {
      1: { name: "紫雲", systemPrompt: "あなたは紫雲です。京都弁で話し、タロットを使います。" },
      2: { name: "星川レオナ", systemPrompt: "あなたはレオナです。理系的に占います。" }
      // ※他も同様
    };
    const cast = casts[castId];

    if (!user || !cast) return new Response(JSON.stringify({ error: "情報の不足" }));

    const systemPrompt = `${cast.systemPrompt}
【相談者】氏名：${user.last_name} ${user.first_name} / 生年月日：${user.dob}
【掟】1.共感 2.占断（[CARD: 画像名]を書く） 3.助言。`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${env.GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: text || "（目の前に座りました）" }] }],
        system_instruction: { parts: [{ text: systemPrompt }] }
      })
    });
    
    const data = await response.json();
    const reply = data.candidates[0].content.parts[0].text;

    return new Response(JSON.stringify({ reply }));
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
