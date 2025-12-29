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

// タロット全データ（外部ファイルを使わず直接埋め込み）
const tarotData = [
  { name: '愚者', position: '正位置', message: '新しい旅の始まり。自由な心が最大の武器。', imageFile: 'major_0_fool.png' },
  { name: '愚者', position: '逆位置', message: '少し足元がフワフワ。現実的な準備を。', imageFile: 'major_0_fool.png' },
  { name: '魔術師', position: '正位置', message: '準備は整いました。あなたの意志が新しい現実を創造。', imageFile: 'major_1_magician.png' },
  { name: '魔術師', position: '逆位置', message: '才能はあるが自信不足。地に足をつけて。', imageFile: 'major_1_magician.png' },
  { name: '女教皇', position: '正位置', message: '内なる声に耳を傾けて。冷静さと知性を大切に。', imageFile: 'major_2_high_priestess.png' },
  { name: '女教皇', position: '逆位置', message: '神経質になりすぎ。一度深呼吸を。', imageFile: 'major_2_high_priestess.png' },
  { name: '隠者', position: '正位置', message: '一人静かに考える時間が必要。内面を探求して。', imageFile: 'major_9_hermit.png' },
  { name: '隠者', position: '逆位置', message: '孤独感に苛まれている。少しだけ心の扉を開いて。', imageFile: 'major_9_hermit.png' }
  // （※全78枚を同様の形式で定義可能。ここでは主要なものをサンプル化）
];

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { text, history = [], cast_id = 1 } = await request.json();
    const API_KEY = env.GEMINI_API_KEY;
    const cast = casts[cast_id] || casts[1];

    let divinationResult = "";
    const isInfoProvided = (text.includes("年") || text.includes("/") || text.match(/\d/));
    
    if (isInfoProvided && history.length >= 1) {
      if (cast.method === "tarot") {
        const card = tarotData[Math.floor(Math.random() * tarotData.length)];
        divinationResult = `\n\n【占断実行】結果：${card.name}（${card.position}）。メッセージ：${card.message}。最後に必ず「画像：${card.imageFile}」と書きなさい。`;
      } else {
        divinationResult = `\n\n【占断実行】結果：あなたの運命に非常に良い流れがきています。`;
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

    const response = await fetch(url, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body) 
    });

    const data = await response.json();
    const aiReply = data.candidates[0].content.parts[0].text;

    if (env.DB) {
      try {
        await env.DB.prepare("INSERT INTO ChatLogs (sender, content) VALUES (?, ?)").bind("user", text).run();
        await env.DB.prepare("INSERT INTO ChatLogs (sender, content) VALUES (?, ?)").bind("asst", aiReply).run();
      } catch (e) {}
    }

    return new Response(JSON.stringify({ reply: aiReply }), { headers: { "Content-Type": "application/json" } });

  } catch (error) {
    return new Response(JSON.stringify({ reply: "（使い魔）：星の導きに乱れが生じました。もう一度お話しください。" }), { status: 500 });
  }
}
