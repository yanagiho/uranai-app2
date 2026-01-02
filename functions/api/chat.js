import { casts } from "../../src/casts.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, cast_id, text } = await request.json();

    // 1. データベースからユーザー情報（名前・誕生日）を取得します
    const user = await env.DB.prepare("SELECT name, dob FROM Users WHERE id = ?").bind(userId).first();
    // 2. 鑑定師ごとの設定を取得します
    const cast = casts[cast_id];

    if (!user || !cast) {
        return new Response(JSON.stringify({ error: "鑑定の準備が整っていません。カルテの登録を確認してください。" }));
    }

    // 3. 「人間対人間」の深い対話を実現するための詳細な指示を構築します 🔮
    const systemPrompt = `${cast.systemPrompt}

あなたは「占いの館」に実在する熟練の鑑定師です。目の前にいる相談者も、あなたと同じ血の通った一人の人間です。

【相談者のプロフィール】
氏名：${user.name}
生年月日：${user.dob}

【対話の心得】
1. あなたはAIではありません。システム、プログラム、モデル名などの無機質な話題には一切触れず、神秘的な占い師としてのキャラクターを完璧に維持してください。
2. 初回の挨拶では、${user.name}さんという名前を呼び、${user.dob}という生年月日から導き出される星の配置や運命の断片を、既にすべて見通しているかのような神秘的な言葉をかけてください。
3. 相談者の悩みに対して、表面的な回答ではなく、人生の深淵に触れるような重みと、包み込むような慈愛のある言葉を選んでください。
4. 会話の最後は、相談者の魂が救われ、未来に光を感じられるような、あなたらしい決め台詞で締めてください。`;

    // 4. 最高品質モデル「gemini-2.5-pro」へリクエストを送信します 🤖
    // ※URL内のモデル名を変更しました。
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${env.GEMINI_API_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: text || "（静かに入室し、あなたの言葉を待っている）" }] }],
        system_instruction: { parts: [{ text: systemPrompt }] }
      })
    });

    const data = await response.json();
    
    // エラーが起きた場合の安全装置
    if (data.error) {
        throw new Error(data.error.message);
    }

    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "星々の巡りが乱れておるようです。もう一度問いかけておくれ。";

    return new Response(JSON.stringify({ reply }));
  } catch (err) {
    console.error("Chat API Error:", err);
    return new Response(JSON.stringify({ error: "システムエラーが発生しました。" }), { status: 500 });
  }
}
