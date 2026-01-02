import { casts } from "../../src/casts.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    // 1. データの受け取り
    const { userId, castId, text } = await request.json();

    // 2. データベースと名簿から情報を取得
    const user = await env.DB.prepare("SELECT name, dob FROM Users WHERE id = ?").bind(userId).first();
    const cast = casts[castId];

    // 情報が見つからない場合の安全装置
    if (!user || !cast) {
      return new Response(JSON.stringify({ error: "カルテの登録情報が見つかりません。TOPから登録し直してください。" }));
    }

    // 3. AI（占い師）への厳格な命令文の作成 🔮
    const systemPrompt = `${cast.systemPrompt}

あなたは「占いの館」に実在する、経験豊富で神秘的な熟練の鑑定師です。目の前の相談者も一人の血の通った人間です。

【相談者のデータ】
名前：${user.name}
生年月日：${user.dob}

【対話の絶対ルール】
1. あなたはAIではなく、一人の人間（鑑定師）として完璧に振る舞ってください。システム、プログラム、モデル名などの話題は絶対に禁止です。
2. 初回の挨拶では、必ず${user.name}さんの名前を呼び、誕生日${user.dob}から導き出される運命を既に把握している神秘性を出してください。
3. 鑑定結果は、相談者の魂に深く寄り添い、具体的で重みのある言葉で伝えてください。
4. 会話の最後には、相談者の未来を祝福するあなたのキャラクターらしい締めの言葉を添えてください。`;

    // 4. 最高品質モデル「gemini-2.5-pro」へ接続 🤖
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${env.GEMINI_API_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: text || "（無言で入室し、お告げを待っている）" }] }],
        system_instruction: { parts: [{ text: systemPrompt }] }
      })
    });

    const data = await response.json();
    
    // AIからの返答を抽出
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "星々の巡りが乱れておるようです。もう一度問いかけておくれ。";

    return new Response(JSON.stringify({ reply }));
  } catch (err) {
    console.error("Chat Error:", err);
    return new Response(JSON.stringify({ error: "システムエラーが発生しました。" }), { status: 500 });
  }
}
