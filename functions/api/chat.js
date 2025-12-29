const casts = {
  1: { name: "紫雲", method: "tarot", systemPrompt: "あなたは紫雲です。京都弁を使い、威圧的だが慈愛を持って接してください。名前と生年月日を聞くまでは絶対に占わないでください。" },
  2: { name: "星川レオナ", method: "astrology", systemPrompt: "あなたは星川レオナです。理系で宇宙の絵文字を多用します。データが揃うまで占いません。" },
  3: { name: "琥珀", method: "pendulum", systemPrompt: "あなたは琥珀です。華やかな姉御肌です。本名と生年月日を聞くまでは占いません。" },
  4: { name: "マリア", method: "candle", systemPrompt: "あなたはマリアです。神秘的で静かです。情報が揃うまで占いません。" },
  5: { name: "サナ", method: "rune", systemPrompt: "あなたはサナです。素朴な海辺の賢者です。名前と生年月日を聞くまでは占いません。" },
  6: { name: "イツキ", method: "sanmei", systemPrompt: "あなたはイツキです。知的な紳士です。情報が揃うまで占いません。" },
  7: { name: "コウヤ", method: "oharai", systemPrompt: "あなたはコウヤです。厳格な神職です。名と生年月日を名乗るまで占いません。" },
  8: { name: "雪音", method: "dream", systemPrompt: "あなたは雪音です。癒やしの占い師です。名前と生年月日を聞くまでは占いません。" }
};

const tarotData = [
  { name: "愚者", position: "正位置", message: "自由な心が武器。", imageFile: "major_0_fool.png" },
  { name: "魔術師", position: "正位置", message: "意志が現実を創る。", imageFile: "major_1_magician.png" },
  { name: "女教皇", position: "正位置", message: "直感を信じて。", imageFile: "major_2_high_priestess.png" },
  { name: "女帝", position: "正位置", message: "愛に満ちた時期。", imageFile: "major_3_empress.png" },
  { name: "皇帝", position: "正位置", message: "強い意志が必要。", imageFile: "major_4_emperor.png" },
  { name: "教皇", position: "正位置", message: "助言に従うと吉。", imageFile: "major_5_hierophant.png" },
  { name: "恋人", position: "正位置", message: "調和の時。", imageFile: "major_6_lovers.png" },
  { name: "戦車", position: "正位置", message: "前進あるのみ。", imageFile: "major_7_chariot.png" },
  { name: "力", position: "正位置", message: "忍耐が鍵。", imageFile: "major_8_strength.png" },
  { name: "隠者", position: "正位置", message: "内省の時。", imageFile: "major_9_hermit.png" },
  { name: "運命の輪", position: "正位置", message: "好転の兆し。", imageFile: "major_10_wheel_of_fortune.png" }
];

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { text, history = [], cast_id = 1 } = await request.json();
    const API_KEY = env.GEMINI_API_KEY;
    const cast = casts[cast_id] || casts[1];

    let diviText = "";
    if ((text.includes("年") || text.match(/\d{4}/)) && history.length >= 1) {
      if (cast.method === "tarot") {
        const card = tarotData[Math.floor(Math.random() * tarotData.length)];
        diviText = "\n\n【占断実行】結果:" + card.name + "。意味:" + card.message + "。最後に必ず「画像:" + card.imageFile + "」と書きなさい。";
      } else {
        diviText = "\n\n【占断実行】良い流れがきています。";
      }
    }

    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=" + API_KEY;
    const body = {
      contents: [
        { role: "user", parts: [{ text: cast.systemPrompt + diviText }] },
        ...history.map(h => ({ role: h.role === "user" ? "user" : "model", parts: [{ text: h.text }] })),
        { role: "user", parts: [{ text: text }] }
      ]
    };

    const response = await fetch(url, { 
      method: "POST", 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body) 
    });

    const data = await response.json();
    if (!data.candidates || data.candidates.length === 0) throw new Error("AI応答なし");
    const aiReply = data.candidates[0].content.parts[0].text;

    if (env.DB) {
      try {
        await env.DB.prepare("INSERT INTO ChatLogs (sender, content) VALUES (?, ?)").bind("user", text).run();
        await env.DB.prepare("INSERT INTO ChatLogs (sender, content) VALUES (?, ?)").bind("asst", aiReply).run();
      } catch (e) {}
    }

    return new Response(JSON.stringify({ reply: aiReply }), { headers: { "Content-Type": "application/json" } });

  } catch (error) {
    return new Response(JSON.stringify({ reply: "(使い魔):星の導きに乱れが生じました。もう一度お話しください。" }), { status: 500 });
  }
}
