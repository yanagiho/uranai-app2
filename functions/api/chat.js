import { casts } from "../../src/casts.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, castId, text } = await request.json();
    const user = await env.DB.prepare("SELECT last_name, first_name, dob FROM Users WHERE id = ?").bind(userId).first();
    const cast = casts[castId];

    if (!user || !cast) return new Response(JSON.stringify({ error: "カルテの再登録が必要です" }));

    const systemPrompt = `${cast.systemPrompt}
【相談者データ】氏名：${user.last_name} ${user.first_name} / 生年月日：${user.dob}
あなたは実在する熟練の占い師です。初回の挨拶（textが空の場合）では必ず相談者のフルネームを呼び、誕生日から導き出された運命を既に見通している神秘性を出してください。キャラクターを完璧に維持し、AIモデル名などには一切触れないでください。`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${env.GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: text || "（お告げを待っている）" }] }],
        system_instruction: { parts: [{ text: systemPrompt }] }
      })
    });
    const data = await response.json();
    return new Response(JSON.stringify({ reply: data.candidates[0].content.parts[0].text }));
  } catch (err) {
    return new Response(JSON.stringify({ error: "システムエラー" }), { status: 500 });
  }
}
