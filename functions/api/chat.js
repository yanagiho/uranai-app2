import { tarotDataShion } from "../../src/tarot_data_shion.js";

const casts = {
  1: { name: "紫雲", method: "tarot", systemPrompt: "あなたは紫雲です。京都風の丁寧語を使い、威圧的ですが慈愛を持って接してください。一人称は「わたくし」、二人称は「お前さん」。名前と生年月日を聞くまでは絶対に占わないでください。" },
  2: { name: "星川レオナ", method: "astrology", systemPrompt: "あなたは星川レオナです。論理的ですがノリが軽い理系女子です。データが揃うまで占いません。" },
  3: { name: "琥珀", method: "pendulum", systemPrompt: "あなたは琥珀です。華やかな姉御肌です。本名と生年月日を聞くまでは占いません。" },
  4: { name: "マリア", method: "candle", systemPrompt: "あなたはマリアです。神秘的で静かです。情報が揃うまで占いません。" },
  5: { name: "サナ", method: "rune", systemPrompt: "あなたはサナです。素朴な海辺の賢者です。名前と生年月日を聞くまでは占いません。" },
  6: { name: "イツキ", method: "sanmei", systemPrompt: "あなたはイツキです。知的な紳士です。情報が揃うまで占いません。" },
  7: { name: "コウヤ", method: "oharai", systemPrompt: "あなたはコウヤです。厳格な神職です。名と生年月日を名乗るまで占いません。" },
  8: { name: "雪音", method: "dream", systemPrompt: "あなたは雪音です。癒やしの占い師です。名前と生年月日を聞くまでは占いません。" }
};

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { text, history = [], cast_id = 1, user_id = "guest" } = await request.json();
    const API_KEY = env.GEMINI_API_KEY;
    const cast = casts[cast_id] || casts[1];

    // 占い実行判定（簡易：名前と生年月日っぽい言葉が含まれているか）
    let divinationResult = "";
    const isInfoProvided = (text.includes("年") || text.includes("/") || text.includes("-")) && text.length > 5;

    if (isInfoProvided && history.length >= 2) {
      if (cast.method === "tarot") {
        const card = tarotDataShion[Math.floor(Math.random() * tarotDataShion.length)];
        divinationResult = `\n\n【システム：占断実行】
お前さんが引いたカード：${card.name}（${card.position}）
メッセージ：${card.message}
画像ファイル：${card.imageFile}
※この結果を紫雲として深く解説し、最後に必ず「画像：${card.imageFile}」と書きなさい。`;
      }
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;
    const body = {
      contents: [
        { role: "user", parts: [{ text: cast.systemPrompt + divinationResult }] },
        ...history.map(h => ({ role: h.role === "user" ? "user" : "model", parts: [{ text: h.text }] })),
        { role: "user", parts: [{ text: text }] }
      ]
    };

    const response = await fetch(url, { method: 'POST', body: JSON.stringify(body) });
    const data = await response.json();
    const aiReply = data.candidates[0].content.parts[0].text;

    // DB保存（D1が設定されている場合のみ）
    if (env.DB) {
      await env.DB.prepare("INSERT INTO ChatLogs (sender, content) VALUES (?, ?)").bind("user", text).run();
      await env.DB.prepare("INSERT INTO ChatLogs (sender, content) VALUES (?, ?)").bind("asst", aiReply).run();
    }

    return new Response(JSON.stringify({ reply: aiReply }), { headers: { "Content-Type": "application/json" } });

  } catch (error) {
    return new Response(JSON.stringify({ reply: "エラー: " + error.message }), { status: 500 });
  }
}
