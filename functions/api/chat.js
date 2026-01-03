import { casts } from "../../src/casts.js";
import { tarotDataShion } from "../../src/tarot_data_shion.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, castId, text } = await request.json();
    const user = await env.DB.prepare("SELECT last_name, first_name, dob FROM Users WHERE id = ?").bind(userId).first();
    const cast = casts[castId];

    if (!user || !cast) return new Response(JSON.stringify({ error: "情報の不足" }));

    // 1. 過去の履歴を5件取得して文脈を作る
    const history = await env.DB.prepare(
      "SELECT sender, content FROM ChatLogs WHERE user_id = ? ORDER BY created_at DESC LIMIT 5"
    ).bind(userId).all();
    
    let chatHistory = history.results.reverse().map(h => ({
      role: h.sender === "ai" ? "model" : "user",
      parts: [{ text: h.content }]
    }));

    // 2. 鑑定師ごとの専門知識（ナレッジ）を構築
    let expertKnowledge = "";
    if (castId === 1) {
      expertKnowledge = `【あなたのタロットデータ】使用するカードとメッセージの一覧です。占断時は必ずここから1枚選び、メッセージを引用してください。
      ${JSON.stringify(tarotDataShion)}`;
    }

    // 3. 鑑定フロー（3つの関所）の指示
    const systemPrompt = `${cast.systemPrompt}
【相談者】氏名：${user.last_name} ${user.first_name} / 生年月日：${user.dob}
【ナレッジ】${expertKnowledge}

【鑑定の掟（3つの関所）】
1. 導入：最初は相談者の悩みに深く寄り添い、共感を示してください。まだ占わないでください。
2. 占断：対話が進んだら「カードを引きます」と宣言し、ナレッジから1枚選び、結果を伝えてください。
   ※画像を表示させるため、必ず最後に [CARD: 画像ファイル名] と記述してください。
3. 結び：結果を踏まえた具体的な助言を行い、相談者の背中を押して鑑定を終えてください。

【重要】AIであること、モデル名などは絶対に秘密です。`;

    // 4. Gemini 2.5 Pro にリクエスト
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${env.GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [...chatHistory, { role: "user", parts: [{ text: text || "（あなたの前に座り、鑑定を待っている）" }] }],
        system_instruction: { parts: [{ text: systemPrompt }] }
      })
    });
    
    const data = await response.json();
    const reply = data.candidates[0].content.parts[0].text;

    // 5. 履歴をD1に保存（将来の文脈用）
    if (text) {
      await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content) VALUES (?, 'user', ?)")
        .bind(userId, text).run();
    }
    await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content) VALUES (?, 'ai', ?)")
      .bind(userId, reply).run();

    return new Response(JSON.stringify({ reply }));
  } catch (err) {
    return new Response(JSON.stringify({ error: "星の導きが途切れました。再送してください。" }), { status: 500 });
  }
}
