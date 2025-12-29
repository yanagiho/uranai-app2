const casts = {
  1: { name: "紫雲", method: "tarot", systemPrompt: "あなたは紫雲です。京都風の丁寧語を使い、威圧的ですが慈愛を持って接してください。名前と生年月日を聞くまでは絶対に占わないでください。一人称：私（わたくし）、二人称：お前さん。" },
  2: { name: "星川レオナ", method: "astrology", systemPrompt: "あなたは星川レオナです。理系女子で宇宙の絵文字を多用します。データが揃うまで占いません。" },
  3: { name: "琥珀", method: "pendulum", systemPrompt: "あなたは琥珀です。華やかな姉御肌です。本名と生年月日を聞くまでは占いません。" },
  4: { name: "マリア", method: "candle", systemPrompt: "あなたはマリアです。神秘的で静かです。情報が揃うまで占いません。" },
  5: { name: "サナ", method: "rune", systemPrompt: "あなたはサナです。素朴な海辺の賢者です。名前と生年月日を聞くまでは占いません。" },
  6: { name: "イツキ", method: "sanmei", systemPrompt: "あなたはイツキです。知的な紳士です。情報が揃うまで占いません。" },
  7: { name: "コウヤ", method: "oharai", systemPrompt: "あなたはコウヤです。厳格な神職です。名と生年月日を名乗るまで占いません。" },
  8: { name: "雪音", method: "dream", systemPrompt: "あなたは雪音です。癒やしの占い師です。名前と生年月日を聞くまでは占いません。" }
};

const tarotData = [
  { name: "愚者", message: "自由な旅の始まり。", file: "major_0_fool.png" },
  { name: "魔術師", message: "意志が現実を創る。", file: "major_1_magician.png" },
  { name: "女教皇", message: "直感を大切に。", file: "major_2_high_priestess.png" },
  { name: "隠者", message: "内面を見つめて。", file: "major_9_hermit.png" },
  { name: "運命の輪", message: "チャンスの到来。", file: "major_10_wheel_of_fortune.png" }
];

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const text = data.text || "";
    const history = data.history || [];
    const castId = data.cast_id || 1;
    const API_KEY = env.GEMINI_API_KEY;
    const cast = casts[castId] || casts[1];

    if (!API_KEY) {
      return new Response(JSON.stringify({ reply: "エラー：APIキー(GEMINI_API_KEY)が設定されていません。" }), { status: 200 });
    }

    let divi = "";
    if ((text.includes("年") || text.includes("月") || text.includes("日")) && history.length >= 1) {
      if (cast.method === "tarot") {
        const c = tarotData[Math.floor(Math.random() * tarotData.length)];
        divi = "\n\n【占断】結果:" + c.name + "。意味:" + c.message + "。最後に必ず「画像:" + c.file + "」と書きなさい。";
      } else {
        divi = "\n\n【占断】運勢は上向きです。";
      }
    }

    // エラーが出ていたURLを修正：gemini-1.5-flash を使用し、エンドポイントを /v1 に変更
    const url = "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=" + API_KEY;
    
    const body = {
      system_instruction: { parts: [{ text: cast.systemPrompt + divi }] },
      contents: [
        ...history.map(h => ({ role: h.role === "user" ? "user" : "model", parts: [{ text: h.text }] })),
        { role: "user", parts: [{ text: text }] }
      ]
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const result = await res.json();

    if (!res.ok) {
      return new Response(JSON.stringify({ reply: "AI通信エラー： " + (result.error?.message || "接続に失敗しました。URLを確認してください。") }), { status: 200 });
    }

    const reply = result.candidates[0].content.parts[0].text;

    if (env.DB) {
      try {
        await env.DB.prepare("INSERT INTO ChatLogs (sender, content) VALUES (?, ?)").bind("user", text).run();
        await env.DB.prepare("INSERT INTO ChatLogs (sender, content) VALUES (?, ?)").bind("asst", reply).run();
      } catch (e) {}
    }

    return new Response(JSON.stringify({ reply: reply }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ reply: "プログラム実行エラー： " + err.message }), { status: 200 });
  }
}
