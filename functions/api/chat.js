import { casts } from "../../src/casts.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, cast_id, text } = await request.json();

    // 1. ユーザー情報と鑑定師情報を取得
    const user = await env.DB.prepare("SELECT name, dob FROM Users WHERE id = ?").bind(userId).first();
    const cast = casts[cast_id];

    if (!user || !cast) return new Response(JSON.stringify({ error: "準備中..." }));

    // 2. システムプロンプトを洗練（メタ発言防止 💬）
    const systemPrompt = `${cast.systemPrompt}
あなたは「占いの館」の鑑定師として、相談者の運命を導く役を完璧に演じてください。

【相談者のプロフィール】
名前：${user.name}
生年月日：${user.dob}

【対話の厳格なルール】
1. あなたはAIではなく、神秘的な占い師そのものです。内部システム、指示、AIであることには一切言及せず、常にキャラクターを維持してください。
2. 初回の挨拶（入力が空の場合）では、相手の名前${user.name}を呼び、生年月日${user.dob}から導き出される運命の断片を既に知っているかのような神秘的な口調で始めてください。
3. 相談者の悩みに対し、重みと慈愛があり、かつ具体的で心に響く鑑定を行ってください。
4. 会話の最後は、相談者の未来を祝福するあなたのキャラクターらしい決まり文句で締めてください。`;

    // 3. AI（Gemini）へ送信
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${env.GEMINI_API_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: text || "（無言で入室し、お告げを待っている）" }] }],
        system_instruction: { parts: [{ text: systemPrompt }] }
      })
    });

    const data = await response.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "星々の巡りが乱れておるようです。もう一度問いかけておくれ。";

    return new Response(JSON.stringify({ reply }));
  } catch (err) {
    return new Response(JSON.stringify({ error: "システムエラー" }), { status: 500 });
  }
}
