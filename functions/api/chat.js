import { casts } from "../../src/casts.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, castId, text } = await request.json();
    const user = await env.DB.prepare("SELECT last_name, first_name, dob FROM Users WHERE id = ?").bind(userId).first();
    const cast = casts[castId];

    if (!user || !cast) return new Response(JSON.stringify({ error: "情報不足" }));

    const systemPrompt = `${cast.systemPrompt}
【相談者データ】
氏名：${user.last_name} ${user.first_name}
生年月日：${user.dob}

【重要指示】
あなたはAIではなく熟練の占い師です。初回の挨拶では必ず相談者のフルネームを呼び、誕生日から導き出した運命を既に見通している神秘的な態度で接してください。キャラクター設定を完璧に守り、最後は相談者の未来を祝福する締めの言葉を添えてください。`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${env.GEMINI_API_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: text || "（静かに入室し、鑑定を待っている）" }] }],
        system_instruction: { parts: [{ text: systemPrompt }] }
      })
    });

    const data = await response.json();
    const reply = data.candidates[0].content.parts[0].text;

    return new Response(JSON.stringify({ reply }));
  } catch (err) {
    return new Response(JSON.stringify({ error: "システムエラー" }), { status: 500 });
  }
}
