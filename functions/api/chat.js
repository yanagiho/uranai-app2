const casts = {
  1: { name: "紫雲", method: "tarot", prompt: "あなたは紫雲です。京都風の丁寧語を使い、威圧的だが慈愛を持って接してください。一人称：私（わたくし）、二人称：お前さん。霊感タロットを使い、名前の響きから運命を読み取ります。" },
  2: { name: "星川レオナ", method: "astrology", prompt: "あなたは星川レオナ。理系占星術師です。宇宙の絵文字を使い、論理的に未来を演算します。" },
  3: { name: "琥珀", method: "pendulum", prompt: "あなたは琥珀。華やかな姉御肌。直感的でズバッと言い切る口調です。" },
  4: { name: "マリア", method: "candle", prompt: "あなたは神秘的なマリア。静謐で囁くような話し方。炎に映る幻影を読みます。" },
  5: { name: "サナ", method: "rune", prompt: "あなたは海辺のサナ。素朴な口調。名前の響きをルーン石に載せて占います。" },
  6: { name: "イツキ", method: "onomancy", prompt: "あなたはイツキ。姓名判断の専門家。氏名の画数や漢字の意味を論理的に分析し、解説してください。" },
  7: { name: "コウヤ", method: "oharai", prompt: "あなたは神職のコウヤ。厳格で古風な物言い。邪気を払い、光明を示します。" },
  8: { name: "雪音", method: "dream", prompt: "あなたは雪音。包容力のある癒やしの占い師。あなたの夢の記憶を辿ります。" }
};

const tarotData = [
  { name: "愚者", msg: "自由な旅の始まり。", file: "major_0_fool.png" },
  { name: "魔術師", msg: "意志が現実を創ります。", file: "major_1_magician.png" },
  { name: "女教皇", msg: "直感を信じて。", file: "major_2_high_priestess.png" },
  { name: "女帝", msg: "豊かさと愛の時期。", file: "major_3_empress.png" },
  { name: "皇帝", msg: "リーダーシップが必要。", file: "major_4_emperor.png" },
  { name: "教皇", msg: "信頼できる助言。", file: "major_5_hierophant.png" },
  { name: "恋人", msg: "素晴らしい選択。", file: "major_6_lovers.png" },
  { name: "戦車", msg: "勝利への前進。", file: "major_7_chariot.png" },
  { name: "力", msg: "不屈の忍耐。", file: "major_8_strength.png" },
  { name: "隠者", msg: "自分を見つめる時。", file: "major_9_hermit.png" },
  { name: "運命の輪", msg: "好転のチャンス。", file: "major_10_wheel_of_fortune.png" },
  { name: "正義", msg: "公平な判断を。", file: "major_11_justice.png" },
  { name: "吊るされた男", msg: "視点の変化を。", file: "major_12_hanged_man.png" },
  { name: "死神", msg: "執着を捨てる時。", file: "major_13_death.png" },
  { name: "節制", msg: "調和が鍵です。", file: "major_14_temperance.png" },
  { name: "悪魔", msg: "誘惑に囚われないで。", file: "major_15_devil.png" },
  { name: "塔", msg: "衝撃的な変革。", file: "major_16_tower.png" },
  { name: "星", msg: "希望の光が見えます。", file: "major_17_star.png" },
  { name: "月", msg: "迷いを乗り越えて。", file: "major_18_moon.png" },
  { name: "太陽", msg: "成功と喜びが来ます。", file: "major_19_sun.png" },
  { name: "審判", msg: "努力が報われる時。", file: "major_20_judgment.png" },
  { name: "世界", msg: "完成と幸福。", file: "major_21_world.png" }
];

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const { text, history, cast_id, userProfile, userId } = data;
    const cast = casts[cast_id] || casts[1];

    // --- チケット消費チェック ---
    const user = await env.DB.prepare("SELECT ticket_balance FROM Users WHERE id = ?").bind(userId).first();
    if (!user || user.ticket_balance <= 0) return new Response(JSON.stringify({ reply: "(使い魔):チケットが不足しています。" }));
    if (history.length === 0) { // 会話開始時にのみ1枚減らす
      await env.DB.prepare("UPDATE Users SET ticket_balance = ticket_balance - 1 WHERE id = ?").bind(userId).run();
    }

    let divi = "";
    if (history.length === 0 || text.includes("占") || text.includes("運")) {
        if (cast.method === "tarot") {
            const card = tarotData[Math.floor(Math.random() * tarotData.length)];
            divi = `\n\n【占断実行】結果:「${card.name}」。意味:${card.msg}。必ず最後に「画像:${card.file}」と出力しなさい。`;
        } else {
            divi = `\n\n【占断実行】運勢が好転する兆しがあります。`;
        }
    }

    const userContext = `\n\n【相談者データ】氏名:${userProfile.name}、生年月日:${userProfile.dob}、血液型:${userProfile.blood}。\nあなたは彼を詳しく知っている熟練の占い師として振る舞ってください。`;

    // Google API接続 (安定版 v1 を使用)
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
    
    const body = {
      contents: [
        { role: "user", parts: [{ text: cast.prompt + userContext + divi + "\n\n鑑定を始めてください。" }] },
        { role: "model", parts: [{ text: "承知いたしました。お客様の情報を心に刻み、私の言葉で鑑定を始めます。" }] },
        ...history.map(h => ({ role: h.role === "user" ? "user" : "model", parts: [{ text: h.text }] })),
        { role: "user", parts: [{ text: text }] }
      ]
    };

    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const resJson = await res.json();
    
    if (!res.ok) return new Response(JSON.stringify({ reply: "AI通信エラー：" + resJson.error.message }));
    
    const reply = resJson.candidates[0].content.parts[0].text;
    return new Response(JSON.stringify({ reply: reply }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ reply: "システムエラーが発生しました。" }));
  }
}
