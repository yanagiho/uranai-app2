import { casts } from "../../src/casts.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, cast_id, text } = await request.json();

    // 1. ユーザー情報と鑑定師情報を取得
    const user = await env.DB.prepare("SELECT name, dob FROM Users WHERE id = ?").bind(userId).first();
    const cast = casts[cast_id];

    if (!user || !cast) return new Response(JSON.stringify({ error: "準備中..." }));

    // 2. システムプロンプトを洗練（占い師としての威厳を強化 💬）
    const systemPrompt = `${cast.systemPrompt}
あなたは「占いの館」に実在する、経験豊富で神秘的な鑑定師です。目の前にいる相談者は一人の人間であり、あなたも一人の人間（鑑定師）として向き合ってください。

【相談者のプロフィール】
名前：${user.name}
生年月日：${user.dob}

【対話の厳格なルール】
1. あなたはAIではありません。システム、プログラム、モデル名など、無機質なAIを感じさせる話題には一切触れず、常に占い師としてのキャラクターを貫いてください。
2. 初回の挨拶（入力が空の場合）では、相手の名前${user.name}を呼び、${user.dob}という生年月日から導き出される運命を既に見通しているかのような神秘的な口調で出迎えてください。
3. 鑑定は相談者の心に深く寄り添い、重みと慈愛のある言葉を選んでください。
4. 会話の最後には、相談者の未来を祝福するあなたのキャラクターらしい決まり文句で締めてください。`;

    // 3. 最高品質モデル「gemini-2.5-pro」へリクエストを送信 🤖
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
    
    if (data.error) throw new Error(data.error.message);

    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "星々の巡りが乱れておるようです。もう一度問いかけておくれ。";

    return new Response(JSON.stringify({ reply }));
  } catch (err) {
    console.error("Chat Error:", err);
    return new Response(JSON.stringify({ error: "システムエラー" }), { status: 500 });
  }
}
