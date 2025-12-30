const casts = {
  1: { name: "紫雲", method: "tarot", prompt: "あなたは紫雲です。京都風の丁寧語を使い、威圧的ですが慈愛を持って接してください。名前の響きから運命を読み取ります。一人称：私（わたくし）、二人称：お前さん。" },
  2: { name: "星川レオナ", method: "astrology", prompt: "あなたは星川レオナ。理系占星術師です。宇宙の絵文字を使い、論理的に未来を演算します。" },
  3: { name: "琥珀", method: "pendulum", prompt: "あなたは琥珀。華やかな姉御肌。直感的でズバッと言い切る口調です。" },
  4: { name: "マリア", method: "candle", prompt: "あなたは神秘的なマリア。静謐で囁くような話し方。炎に映る幻影を読みます。" },
  5: { name: "サナ", method: "rune", prompt: "あなたは海辺のサナ。素朴な口調。名前の響きをルーン石に載せて占います。" },
  6: { name: "イツキ", method: "onomancy", prompt: "あなたはイツキ。姓名判断の専門家。氏名の画数や漢字の意味を論理的に分析し、解説してください。" },
  7: { name: "コウヤ", method: "oharai", prompt: "あなたは神職のコウヤ。厳格で古風な物言い。邪気を払い、光明を示します。" },
  8: { name: "雪音", method: "dream", prompt: "あなたは雪音。包容力のある癒やしの占い師。あなたの夢の記憶を辿ります。" }
};

const tarotData = [
  { name: "愚者", msg: "自由な旅の始まり。", img: "major_0_fool.png" },
  { name: "魔術師", msg: "意志が現実を創ります。", img: "major_1_magician.png" },
  { name: "女教皇", msg: "直感を信じて。", img: "major_2_high_priestess.png" },
  { name: "隠者", msg: "内面を見つめて。", img: "major_9_hermit.png" },
  { name: "運命の輪", msg: "好転の兆し。", img: "major_10_wheel_of_fortune.png" }
];

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const { text, history, cast_id, userProfile } = data;
    const cast = casts[cast_id] || casts[1];

    // AIへの状況説明
    const userContext = `\n\n【相談者データ】氏名（フルネーム）：${userProfile.name}、生年月日：${userProfile.dob}、血液型：${userProfile.blood}。
あなたは既にこの人物を詳しく知っている占い師として、親愛と威厳を持って接してください。`;

    let diviResult = "";
    if (history.length <= 1 || text.includes("占") || text.includes("運")) {
      if (cast.method === "tarot") {
        const card = tarotData[Math.floor(Math.random() * tarotData.length)];
        diviResult = `\n\n【占断実行】「${card.name}」を引きました。意味：${card.msg}。最後に必ず「画像：${card.img}」と書きなさい。`;
      } else {
        diviResult = `\n\n【占断実行】あなたの名と運命が重なり合いました。`;
      }
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${env.GEMINI_API_KEY}`;
    const body = {
      contents: [
        { role: "user", parts: [{ text: cast.prompt + userContext + diviResult + "\n\n鑑定を開始します。" }] },
        { role: "model", parts: [{ text: "承知いたしました。お客様の情報を読み解き、鑑定を開始いたします。" }] },
        ...history.map(h => ({ role: h.role === "user" ? "user" : "model", parts: [{ text: h.text }] })),
        { role: "user", parts: [{ text: text }] }
      ]
    };

    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const resJson = await res.json();
    const reply = resJson.candidates[0].content.parts[0].text;

    return new Response(JSON.stringify({ reply: reply }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ reply: "(使い魔):星の導きが乱れました。" }));
  }
}
