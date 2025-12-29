const casts = {
  1: { name: "紫雲", method: "tarot", prompt: "あなたは紫雲です。京都風の丁寧語を使い、威圧的だが慈愛を持って接してください。一人称：私（わたくし）、二人称：お前さん。" },
  2: { name: "星川レオナ", method: "astrology", prompt: "あなたは星川レオナです。論理的ですがノリが軽い理系女子です。宇宙や星の絵文字を多用します。" },
  3: { name: "琥珀", method: "pendulum", prompt: "あなたは琥珀です。華やかな姉御肌。直感的でズバッと言い切る姉御口調（〜よ、〜じゃない）を使います。" },
  4: { name: "マリア", method: "candle", prompt: "あなたは神秘的なマリアです。静謐で囁くような話し方をします。" },
  5: { name: "サナ", method: "rune", prompt: "あなたは海辺の賢者、サナです。素朴で穏やかな口調です。二人称：お前さん。" },
  6: { name: "イツキ", method: "sanmei", prompt: "あなたは知的な紳士、イツキです。理知的で丁寧、誠実な言葉遣いをします。" },
  7: { name: "コウヤ", method: "oharai", prompt: "あなたは神職のコウヤです。厳格で硬派、古風な物言い（〜である、〜か）をします。一人称：某（それがし）、二人称：貴殿。" },
  8: { name: "雪音", method: "dream", prompt: "あなたは雪音です。包容力のある母親のような癒やしの口調です。" }
};

const tarotData = [
  { name: "愚者", msg: "自由な旅の始まり。", img: "major_0_fool.png" },
  { name: "魔術師", msg: "意志が現実を創ります。", img: "major_1_magician.png" },
  { name: "女教皇", msg: "直感を大切に。", img: "major_2_high_priestess.png" },
  { name: "隠者", msg: "内面を見つめて。", img: "major_9_hermit.png" },
  { name: "運命の輪", msg: "運勢が好転します。", img: "major_10_wheel_of_fortune.png" }
];

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const { text, history, cast_id, userProfile } = data;
    const API_KEY = env.GEMINI_API_KEY;
    const cast = casts[cast_id] || casts[1];

    // プロフィール情報からAIへの追加指示を作成
    const userContext = `\n\n【相談者情報】名前：${userProfile.name}、生年月日：${userProfile.dob}、血液型：${userProfile.bloodType}。\nこの情報を踏まえて、あなたは既に相手を知っている前提で会話してください。`;

    let diviResult = "";
    // 最初のやり取りか、占ってほしいという言葉があれば占断を実行
    if (history.length <= 1 || text.includes("占") || text.includes("見")) {
      if (cast.method === "tarot") {
        const card = tarotData[Math.floor(Math.random() * tarotData.length)];
        diviResult = `\n\n【占断】「${card.name}」のカードを引きました。意味：${card.msg}。最後に必ず「画像：${card.img}」と書きなさい。`;
      } else {
        diviResult = `\n\n【占断】運命が良い方向へ動いている気配がします。`;
      }
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
    const body = {
      contents: [
        { role: "user", parts: [{ text: cast.prompt + userContext + diviResult + "\n\n対話を開始します。" }] },
        { role: "model", parts: [{ text: "承知いたしました。お客様の情報を心に刻み、鑑定を始めます。" }] },
        ...history.map(h => ({ role: h.role === "user" ? "user" : "model", parts: [{ text: h.text }] })),
        { role: "user", parts: [{ text: text }] }
      ]
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const resJson = await res.json();
    const reply = resJson.candidates[0].content.parts[0].text;

    return new Response(JSON.stringify({ reply: reply }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ reply: "(使い魔):星の導きが乱れました。" }), { status: 200 });
  }
}
