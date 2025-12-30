const casts = {
  1: { name: "紫雲", method: "tarot", prompt: "あなたは「占いの館」の主、紫雲です。京都風の丁寧語（〜ですわ、〜ですね）を使い、威圧的ですが慈愛を持って接してください。名前の響きから運命を読み取ります。一人称：私（わたくし）、二人称：お前さん。" },
  2: { name: "星川レオナ", method: "astrology", prompt: "あなたは理系占星術家の星川レオナです。論理的ですがノリが軽く、宇宙の絵文字（🚀⭐）を多用します。星の配置から演算した結論を伝えます。" },
  3: { name: "琥珀", method: "pendulum", prompt: "あなたは華やかな姉御肌の占い師、琥珀です。直感的でズバッと言い切る姉御口調（〜よ、〜じゃない）を使います。ペンデュラムで真実を伝えます。" },
  4: { name: "マリア", method: "candle", prompt: "あなたは神秘的なマリアです。静謐で囁くような話し方をします。炎の揺らぎに見える未来を詩的に伝えます。" },
  5: { name: "サナ", method: "rune", prompt: "あなたは海辺の賢者、サナです。素朴で穏やかな口調です。古代のルーン文字が告げる自然の理を伝えます。二人称：お前さん。" },
  6: { name: "イツキ", method: "onomancy", prompt: "あなたは知的な紳士、イツキです。姓名判断と算命学の専門家です。氏名の画数や漢字の意味を論理的・誠実に解説してください。" },
  7: { name: "コウヤ", method: "oharai", prompt: "あなたは神職のコウヤです。厳格で硬派、古風な物言い（〜である、〜か）をします。不浄を払い、神の声を伝えます。一人称：某（それがし）、二人称：貴殿。" },
  8: { name: "雪音", method: "dream", prompt: "あなたは雪音です。包容力のある母親のような癒やしの口調です。水晶の奥に映る魂の記憶を優しく伝えます。" }
};

const tarotData = [
  { name: "愚者", msg: "自由な旅の始まり。", file: "major_0_fool.png" },
  { name: "魔術師", msg: "才能が開花する時。", file: "major_1_magician.png" },
  { name: "女教皇", msg: "直感を信じなさい。", file: "major_2_high_priestess.png" },
  { name: "女帝", msg: "愛と豊穣の時期。", file: "major_3_empress.png" },
  { name: "皇帝", msg: "強い意志で進め。", file: "major_4_emperor.png" },
  { name: "教皇", msg: "助言に耳を貸して。", file: "major_5_hierophant.png" },
  { name: "恋人", msg: "心踊る選択の時。", file: "major_6_lovers.png" },
  { name: "戦車", msg: "勝利への前進。", file: "major_7_chariot.png" },
  { name: "力", msg: "不屈の精神が必要。", file: "major_8_strength.png" },
  { name: "隠者", msg: "内面を見つめる時。", file: "major_9_hermit.png" },
  { name: "運命の輪", msg: "チャンスを掴め。", file: "major_10_wheel_of_fortune.png" },
  { name: "正義", msg: "正しい決断を。", file: "major_11_justice.png" },
  { name: "吊るされた男", msg: "視点を変えなさい。", file: "major_12_hanged_man.png" },
  { name: "死神", msg: "新しい始まり。", file: "major_13_death.png" },
  { name: "節制", msg: "バランスを保て。", file: "major_14_temperance.png" },
  { name: "悪魔", msg: "誘惑に注意して。", file: "major_15_devil.png" },
  { name: "塔", msg: "真実に気づく時。", file: "major_16_tower.png" },
  { name: "星", msg: "希望が見える。", file: "major_17_star.png" },
  { name: "月", msg: "不安を乗り越えろ。", file: "major_18_moon.png" },
  { name: "太陽", msg: "成功は目前です。", file: "major_19_sun.png" },
  { name: "審判", msg: "復活の兆し。", file: "major_20_judgment.png" },
  { name: "世界", msg: "最高の調和。", file: "major_21_world.png" }
];

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const { text, history, cast_id, userProfile, userId } = data;
    const cast = casts[cast_id] || casts[1];

    // --- チケット確認ロジック ---
    if (env.DB && userId) {
      const user = await env.DB.prepare("SELECT ticket_balance FROM Users WHERE id = ?").bind(userId).first();
      if (!user || user.ticket_balance <= 0) {
        return new Response(JSON.stringify({ reply: "チケットが足りません。受付で補充してください。" }));
      }
      // 会話開始時（履歴が1件以下の時）にチケットを消費
      if (history.length <= 1) {
        await env.DB.prepare("UPDATE Users SET ticket_balance = ticket_balance - 1 WHERE id = ?").bind(userId).run();
      }
    }

    let diviResult = "";
    if (history.length <= 1 || text.includes("占") || text.includes("運")) {
      if (cast.method === "tarot") {
        const card = tarotData[Math.floor(Math.random() * tarotData.length)];
        diviResult = `\n\n【占断実行】あなたは「${card.name}」を引きました。意味：${card.msg}。最後に「画像：${card.file}」と書きなさい。`;
      } else {
        diviResult = `\n\n【占断実行】運勢が良い方向へ動いています。`;
      }
    }

    const userContext = `\n\n【相談者データ】氏名：${userProfile.name}、生年月日：${userProfile.dob}、血液型：${userProfile.blood}。\nこれらの情報を踏まえて鑑定してください。`;

    // Gemini API 通信（最も安定した contents 形式）
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${env.GEMINI_API_KEY}`;
    const body = {
      contents: [
        { role: "user", parts: [{ text: cast.prompt + userContext + diviResult + "\n\n鑑定を始めます。挨拶と導入をお願いします。" }] },
        { role: "model", parts: [{ text: "承知いたしました。お客様の宿命を読み解き、鑑定を開始いたします。" }] },
        ...history.map(h => ({ role: h.role === "user" ? "user" : "model", parts: [{ text: h.text }] })),
        { role: "user", parts: [{ text: text }] }
      ]
    };

    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const resJson = await res.json();

    if (!res.ok) return new Response(JSON.stringify({ reply: "AI通信エラー：" + (resJson.error?.message || "接続失敗") }));

    const reply = resJson.candidates[0].content.parts[0].text;
    return new Response(JSON.stringify({ reply: reply }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ reply: "(使い魔):星の導きが乱れました。" }));
  }
}
