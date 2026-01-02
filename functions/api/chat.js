import { casts } from "../../src/casts.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, castId, text } = await request.json();

    // 1. ユーザー情報と鑑定師の基本情報を取得
    const user = await env.DB.prepare("SELECT name, dob FROM Users WHERE id = ?").bind(userId).first();
    const cast = casts[castId];

    if (!user || !cast) return new Response(JSON.stringify({ error: "情報が見つかりません" }));

    // 2. AIへの命令を強化（名前と誕生日を最初から教える）
    const systemPrompt = `${cast.systemPrompt}
【相談者のプロフィール】
氏名：${user.name}
生年月日：${user.dob}

【重要指示】
1. 初回（textが空の場合）は、相手の名前と誕生日を既に知っているという神秘的な挨拶から始めてください。
2. 占いの結果は、必ずあなたのキャラクターに合った威厳や慈愛のある言葉で伝えてください。
3. 会話の最後には、ユーザーの未来を祝福する「締めの言葉」を必ず添えてください。`;

    // 3. AI（Gemini）へ送信
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${env.GEMINI_API_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: text || "（静かに入室して、鑑定を待っている）" }] }],
        system_instruction: { parts: [{ text: systemPrompt }] }
      })
    });

    const data = await response.json();
    const reply = data.candidates[0].content.parts[0].text;

    return new Response(JSON.stringify({ reply }));
  } catch (err) {
    return new Response(JSON.stringify({ error: "星々の巡りが乱れ、返答が得られません" }), { status: 500 });
  }
}
