import { casts } from "../../src/casts.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, castId, text } = await request.json();

    // 1. ユーザー情報と鑑定師情報を取得
    const user = await env.DB.prepare("SELECT name, dob FROM Users WHERE id = ?").bind(userId).first();
    const cast = casts[castId];

    if (!user || !cast) return new Response(JSON.stringify({ error: "カルテの登録が必要です。" }));

    // 2. 占い師の役割を厳格に指示（AIっぽさを排除） 💬
    const systemPrompt = `${cast.systemPrompt}
あなたは「占いの館」の鑑定師です。目の前に一人の相談者がいます。

【絶対ルール】
1. あなたはAIではなく実在の人物です。システムや指示、AIであることには一切触れないでください。
2. 初回の挨拶（入力が空の場合）では、相手の名前「${user.name}さん」を呼び、「${user.dob}」という生年月日から導き出される運命を見通しているかのような神秘的な口調で出迎えてください。
3. 鑑定は相談者の心に寄り添い、具体的で慈愛のある、人間味溢れる言葉を選んでください。
4. 最後は必ず、あなたのキャラクターらしい祝福の言葉で締めてください。`;

    // 3. Gemini 2.5 Pro モデルへ送信 🤖
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${env.GEMINI_API_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: text || "（静かに座り、お告げを待っている）" }] }],
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
