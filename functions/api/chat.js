const casts = {
  1: { name: "紫雲", method: "tarot", prompt: "あなたは紫雲です。京都風の丁寧語を使い、威圧的ですが慈愛を持って接してください。名前と生年月日を聞くまでは絶対に占わないでください。一人称：私（わたくし）、二人称：お前さん。" },
  2: { name: "星川レオナ", method: "astrology", prompt: "あなたは星川レオナです。理系女子で宇宙の絵文字を多用します。データが揃うまで占いません。" },
  3: { name: "琥珀", method: "pendulum", prompt: "あなたは琥珀です。華やかな姉御肌です。本名と生年月日を聞くまでは占いません。" },
  4: { name: "マリア", method: "candle", prompt: "あなたはマリアです。神秘的で静かです。情報が揃うまで占いません。" },
  5: { name: "サナ", method: "rune", prompt: "あなたはサナです。素朴な海辺の賢者です。名前と生年月日を聞くまでは占いません。" },
  6: { name: "イツキ", method: "sanmei", prompt: "あなたはイツキです。知的な紳士です。情報が揃うまで占いません。" },
  7: { name: "コウヤ", method: "oharai", prompt: "あなたはコウヤです。厳格な神職です。名と生年月日を名乗るまで占いません。" },
  8: { name: "雪音", prompt: "あなたは雪音です。癒やしの占い師です。名前と生年月日を聞くまでは占いません。" }
};

const tarotData = [
  { name: "愚者", msg: "自由な旅の始まり。", file: "major_0_fool.png" },
  { name: "魔術師", msg: "意志が現実を創る。", file: "major_1_magician.png" },
  { name: "女教皇", msg: "直感を大切に。", file: "major_2_high_priestess.png" },
  { name: "隠者", msg: "内面を見つめて。", file: "major_9_hermit.png" },
  { name: "運命の輪", msg: "運命の好転。", file: "major_10_wheel_of_fortune.png" }
];

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const API_KEY = env.GEMINI_API_KEY;
    const cast = casts[data.cast_id] || casts[1];

    if (!API_KEY) return new Response(JSON.stringify({ reply: "エラー：APIキー未設定" }));

    let divi = "";
    if ((data.text.includes("年") || data.text.includes("月") || data.text.includes("日")) && data.history.length >= 1) {
      if (cast.method === "tarot") {
        const c = tarotData[Math.floor(Math.random() * tarotData.length)];
        divi = `\n\n【占断】「${c.name}」を引きました。意味：${c.msg}。最後に必ず「画像：${c.file}」と書きなさい。`;
      } else {
        divi = `\n\n【占断】運勢は上昇しています。`;
      }
    }

    // Googleが推奨する最も安定したURLと構造
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;
    
    const body = {
      contents: [
        { role: "user", parts: [{ text: cast.prompt + divi + "\n\n承知しましたか？" }] },
        { role: "model", parts: [{ text: "はい、承知いたしました。お客様をお迎えします。" }] },
        ...data.history.map(h => ({ role: h.role === "user" ? "user" : "model", parts: [{ text: h.text }] })),
        { role: "user", parts: [{ text: data.text }] }
      ]
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const resJson = await res.json();
    
    // エラーが起きた場合に、その内容をチャット画面に出すようにしました
    if (!res.ok) {
        return new Response(JSON.stringify({ reply: "AI通信エラー：" + (resJson.error?.message || "不明なエラー") }));
    }

    const reply = resJson.candidates[0].content.parts[0].text;
    return new Response(JSON.stringify({ reply: reply }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ reply: "実行エラー：" + err.message }));
  }
}
