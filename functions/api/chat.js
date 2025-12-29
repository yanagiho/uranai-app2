// 占い師の設定
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

// タロットデータ（紫雲用）
const tarotData = [
  { name: '愚者', position: '正位置', message: 'ふふ、新しい旅の始まりですね。', imageFile: 'major_0_fool.png' },
  { name: '魔術師', position: '正位置', message: '準備は整いました。', imageFile: 'major_1_magician.png' },
  { name: '女教皇', position: '正位置', message: '答えはあなたの直感の中にあります。', imageFile: 'major_2_high_priestess.png' },
  { name: '隠者', position: '正位置', message: '自分自身の真実と向き合う時です。', imageFile: 'major_9_hermit.png' }
  // ※他のカードも同様ですが、一旦主要なものをサンプルとして入れています。
];

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { text, history = [], cast_id = 1 } = await request.json();
    const API_KEY = env.GEMINI_API_KEY;
    const cast = casts[cast_id] || casts[1];

    // 占い実行判定
    let divinationResult = "";
    const isInfoProvided = (text.includes("年") || text.includes("/") || text.match(/\d{4}/));
    
    // 会話が一定以上（挨拶の次）で、かつ情報が提供された場合
    if (isInfoProvided) {
      if (cast.method === "tarot") {
        const card = tarotData[Math.floor(Math.random() * tarotData.length)];
        divinationResult = `\n\n【システム：占断実行】結果：${card.name}（${card.position}）。メッセージ：${card.message}。最後に必ず「画像：${card.imageFile}」と書きなさい。`;
      } else {
        divinationResult = `\n\n【システム：占断実行】結果：あなたの運命に吉兆が現れています。`;
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

    // 500エラーを直すための重要な修正（headersを追加）
    const response = await fetch(url, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body) 
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Gemini API Error");
    
    const aiReply = data.candidates[0].content.parts[0].text;

    // DB保存
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
