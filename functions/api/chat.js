import { casts } from "./lib/casts.js";
import { tarotDataShion } from "./lib/tarot_data_shion.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, castId, text } = await request.json();
    const user = await env.DB.prepare("SELECT last_name, first_name, dob FROM Users WHERE id = ?").bind(userId).first();
    const cast = casts[castId];

    if (!user || !cast) return new Response(JSON.stringify({ error: "情報の不足" }));

    let chatHistory = [];
    try {
        const history = await env.DB.prepare("SELECT sender, content FROM ChatLogs WHERE user_id = ? ORDER BY created_at DESC LIMIT 5").bind(userId).all();
        chatHistory = (history.results || []).reverse().map(h => ({ role: h.sender === "ai" ? "model" : "user", parts: [{ text: h.content }] }));
    } catch (e) {}

    let expertKnowledge = castId === 1 ? `【タロットデータ】${JSON.stringify(tarotDataShion)}` : "";

    const systemPrompt = `${cast.systemPrompt}
【相談者】氏名：${user.last_name} ${user.first_name} / 生年月日：${user.dob}
${expertKnowledge}
【掟】1.共感 2.占断（[CARD: 画像名]を最後に書く） 3.具体的な助言。AIであることは秘密。`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${env.GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [...chatHistory, { role: "user", parts: [{ text: text || "（鑑定を待っている）" }] }],
        system_instruction: { parts: [{ text: systemPrompt }] }
      })
    });
    
    const data = await response.json();
    const reply = data.candidates[0].content.parts[0].text;

    if (text) await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content) VALUES (?, 'user', ?)").bind(userId, text).run();
    await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content) VALUES (?, 'ai', ?)").bind(userId, reply).run();

    return new Response(JSON.stringify({ reply }));
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
