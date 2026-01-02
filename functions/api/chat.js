import { casts } from "../../src/casts.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, castId, text } = await request.json();

    // 1. データベースからユーザー情報（名前・誕生日）を取得
    const user = await env.DB.prepare("SELECT name, dob FROM Users WHERE id = ?").bind(userId).first();
    const cast = casts[castId];

    if (!user || !cast) {
        return new Response(JSON.stringify({ error: "カルテ情報が見つかりません。TOPから再登録してください。" }));
    }

    // 2. AI（熟練占い師）への厳格な指示 🔮
    const systemPrompt = `${cast.systemPrompt}
あなたは「占いの館」の熟練鑑定師です。目の前に相談者がいます。
【絶対ルール】
1. あなたは人間です。AI、プログラム、モデル名などの無機質な話題は一切禁止です。
2. 初回の挨拶では、必ず相手の名前「${user.name}さん」を呼び、誕生日「${user.dob}」から運命を見通している神秘的な態度で接してください。
3. 鑑定は具体的で、相談者の心に深く寄り添う重みのある言葉で行ってください。
4. 最後は、キャラクターらしい祝福の言葉で締めてください。`;

    // 3. Gemini 2.5 Pro モデルへ接続 🤖
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
    console.error("Chat Error:", err);
    return new Response(JSON.stringify({ error: "システムエラーが発生しました。" }), { status: 500 });
  }
}
