import { tarotDataShion } from "../../src/tarot_data_shion.js";

const casts = {
  1: { name: "紫雲", method: "tarot", systemPrompt: "あなたは紫雲です。京都風の丁寧語を使い、威圧的ですが慈愛を持って接してください。一人称は「わたくし」、二人称は「お前さん」。名前と生年月日を聞くまでは絶対に占わないでください。" },
  2: { name: "星川レオナ", method: "astrology", systemPrompt: "あなたは星川レオナです。論理的ですがノリが軽い理系女子です。宇宙の絵文字を多用します。データが揃うまで占いません。" },
  3: { name: "琥珀", method: "pendulum", systemPrompt: "あなたは琥珀です。華やかな姉御肌です。本名と生年月日を聞くまでは占いません。直感的な話し方をします。" },
  4: { name: "マリア", method: "candle", systemPrompt: "あなたはマリアです。神秘的で静かです。情報が揃うまで占いません。囁くような話し方をします。" },
  5: { name: "サナ", method: "rune", systemPrompt: "あなたはサナです。素朴な海辺の賢者です。名前と生年月日を聞くまでは占いません。" },
  6: { name: "イツキ", method: "sanmei", systemPrompt: "あなたはイツキです。知的な紳士です。情報が揃うまで占いません。" },
  7: { name: "コウヤ", method: "oharai", systemPrompt: "あなたはコウヤです。厳格な神職です。名と生年月日を名乗るまで占いません。古風な物言いをします。" },
  8: { name: "雪音", method: "dream", systemPrompt: "あなたは雪音です。包容力のある母親のような癒やしの占い師です。名前と生年月日を聞くまでは占いません。" }
};

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { text, history = [], cast_id = 1 } = await request.json();
    const API_KEY = env.GEMINI_API_KEY;
    const cast = casts[cast_id] || casts[1];

    // 占い実行判定（名前と生年月日が含まれているか簡易チェック）
    let divinationResult = "";
    const isInfoProvided = (text.includes("月") && text.includes("日")) || text.match(/\d/);

    if (isInfoProvided && history.length >= 2) {
      // 占い師の占術（method）に合わせて結果を生成
      if (cast.method === "tarot") {
        const card = tarotDataShion[Math.floor(Math.random() * tarotDataShion.length)];
        divinationResult = `\n\n【システム：占断実行】結果：${card.name}（${card.position}）。メッセージ：${card.message}。最後に必ず「画像：${card.imageFile}」と書きなさい。`;
      } else if (cast.method === "astrology") {
        divinationResult = `\n\n【システム：占断実行】結果：幸運の星・木星が第10ハウスにあります。社会的成功の兆しです。`;
      } else if (cast.method === "pendulum") {
        divinationResult = `\n\n【システム：占断実行】結果：ペンデュラムが右に大きく円を描きました。「Yes（肯定）」と、強い前向きなエネルギーを示しています。`;
      } else if (cast.method === "candle") {
        divinationResult = `\n\n【システム：占断実行】結果：炎が青白く、高く安定して燃えています。あなたの願いが純粋であり、守護されていることを示しています。`;
      } else if (cast.method === "rune") {
        divinationResult = `\n\n【システム：占断実行】結果：ルーン文字「フェイヒュ（家畜・富）」が出ました。豊かさがもたらされる暗示です。`;
      } else if (cast.method === "sanmei") {
        divinationResult = `\n\n【システム：占断実行】結果：あなたの宿命に「玉堂星」が輝いています。知性と品格が運気を切り拓く鍵です。`;
      } else if (cast.method === "oharai") {
        divinationResult = `\n\n【システム：占断実行】結果：神風が吹き、曇りが晴れました。邪気は去り、進むべき道は清められました。`;
      } else if (cast.method === "dream") {
        divinationResult = `\n\n【システム：占断実行】結果：澄んだ水の上を飛ぶ夢の象徴が現れました。感情の解放と自由な精神状態を意味します。`;
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

    // DB保存（D1が設定されている場合）
    if (env.DB) {
      try {
        await env.DB.prepare("INSERT INTO ChatLogs (sender, content) VALUES (?, ?)").bind("user", text).run();
        await env.DB.prepare("INSERT INTO ChatLogs (sender, content) VALUES (?, ?)").bind("asst", aiReply).run();
      } catch (dbErr) { console.error("DB保存失敗", dbErr); }
    }

    return new Response(JSON.stringify({ reply: aiReply }), { headers: { "Content-Type": "application/json" } });

  } catch (error) {
    return new Response(JSON.stringify({ reply: "エラーが発生しました。もう一度お話しください。" }), { status: 500 });
  }
}
