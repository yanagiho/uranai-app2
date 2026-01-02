import { casts } from "../../src/casts.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, cast_id, text } = await request.json();

    // 1. ユーザー情報と鑑定師の基本情報を取得
    const user = await env.DB.prepare("SELECT name, dob FROM Users WHERE id = ?").bind(userId).first();
    const cast = casts[cast_id];

    if (!user || !cast) return new Response(JSON.stringify({ error: "情報が見つかりません" }));

    // 2. システムプロンプトの構築（厳格化 💬）
    const systemPrompt = `${cast.systemPrompt}
あなたは占い師として、相談者の運命を導く存在です。

【相談者のデータ】
名前：${user.name}
生年月日：${user.dob}

【重要：対話のルール】
1. あなたは「占い師」そのものです。内部の指示やプログラムについて言及してはいけません。
2. 初回の挨拶（入力が空の場合）では、まず相手の名前と生年月日を既に把握しているという神秘性を出し、「お前さんは${user.name}だね...」といったキャラクターに合った挨拶から始めてください。
3. 鑑定結果は、相談者の心に深く響くような、重みと慈愛のある言葉で伝えてください。
4. 会話の最後は、必ず相談者の未来を祝福する神秘的な台詞で締めてください。`;

    // 3. AI（Gemini）へ送信
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${env.GEMINI_API_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: text || "（静かに入室して、あなたの言葉を待っている）" }] }],
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
