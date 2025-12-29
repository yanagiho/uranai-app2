// 占い師のデータ（人格と鑑定フロー）
const casts = {
  1: {
    name: "紫雲",
    method: "tarot", // 紫雲はタロット
    systemPrompt: `あなたは占い師の紫雲です。京都風の丁寧語を使い、威圧的ですが慈愛を持って接してください。
【最優先ルール】
1. 名前と生年月日を聞き出すまで、絶対に占術の結果を出さないこと。
2. 顧客から情報を受け取り、「占う価値がある」と判断したら、システムから渡される【占断結果】を読み解き、お前さんの言葉で伝えなさい。
一人称：私（わたくし）、二人称：お前さん。`
  },
  // 他の占い師も同様に定義（前回の内容を保持）
  2: { name: "星川レオナ", method: "astrology", systemPrompt: "（中略：前回と同じレオナの人格）" },
  3: { name: "琥珀", method: "pendulum", systemPrompt: "（中略）" },
  4: { name: "マリア", method: "candle", systemPrompt: "（中略）" },
  5: { name: "サナ", method: "rune", systemPrompt: "（中略）" },
  6: { name: "イツキ", method: "sanmei", systemPrompt: "（中略）" },
  7: { name: "コウヤ", method: "oharai", systemPrompt: "（中略）" },
  8: { name: "雪音", method: "dream", systemPrompt: "（中略）" }
};

// 【重要】紫雲用のタロットデータ（src/tarot_data_shion.js の内容を一部抜粋して統合）
const tarotData = [
  { name: "愚者", position: "正位置", message: "自由な旅の始まりです。恐れずに一歩踏み出しなさい。" },
  { name: "魔術師", position: "正位置", message: "準備は整いました。あなたの意志が現実を創ります。" },
  { name: "女教皇", position: "正位置", message: "静かに内なる声を聞きなさい。直感が答えを知っています。" },
  // ※ ここに78枚分のデータを順次追加していきます
];

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { text, history = [], cast_id = 1 } = await request.json();
    const API_KEY = env.GEMINI_API_KEY;

    // 1. 占い師の特定
    const cast = casts[cast_id] || casts[1];

    // 2. 占断ロジック：ユーザーが情報を入力したか判定
    let divinationResult = "";
    const hasInfo = text.includes("月") && text.includes("日"); // 簡易的な判定（生年月日が含まれるか）
    
    if (hasInfo && history.length >= 2) {
      // 紫雲（タロット）の場合、ランダムに1枚引く
      if (cast.method === "tarot") {
        const card = tarotData[Math.floor(Math.random() * tarotData.length)];
        divinationResult = `\n\n【占断結果：あなたは今、このカードを引きました】\nカード名：${card.name}\n状態：${card.position}\n基本の意味：${card.message}\n※この結果を紫雲として、お前さんの言葉で深く解説しなさい。`;
      }
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

    const body = {
      contents: [
        { role: "user", parts: [{ text: cast.systemPrompt + divinationResult + "\n\n対話を開始します。" }] },
        ...history.map(h => ({
          role: h.role === "user" ? "user" : "model",
          parts: [{ text: h.text }]
        })),
        { role: "user", parts: [{ text: text || "（沈黙）" }] }
      ]
    };

    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json();
    const aiReply = data.candidates[0].content.parts[0].text;

    return new Response(JSON.stringify({ reply: aiReply }), { headers: { "Content-Type": "application/json" } });

  } catch (error) {
    return new Response(JSON.stringify({ reply: "APIエラー詳細: " + error.message }), { headers: { "Content-Type": "application/json" } });
  }
}
