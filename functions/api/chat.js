const casts = {
  1: { name: "紫雲", method: "tarot", prompt: "あなたは紫雲です。京都弁を使い、威圧的だが慈愛を持って接してください。一人称：私、二人称：お前さん。" },
  2: { name: "星川レオナ", method: "astrology", prompt: "あなたは星川レオナ。理系占星術師です。宇宙の絵文字を使い、論理的に演算します。" },
  3: { name: "琥珀", method: "pendulum", prompt: "あなたは琥珀。姉御肌です。直感的に真実をズバッと言います。" },
  4: { name: "マリア", method: "candle", prompt: "あなたは神秘的なマリア。静謐な話し方。炎に映る幻影を読みます。" },
  5: { name: "サナ", method: "rune", prompt: "あなたは海辺のサナ。素朴な口調。名前の響きをルーン石に載せて占います。" },
  6: { name: "イツキ", method: "onomancy", prompt: "あなたはイツキ。姓名判断の専門家。氏名を論理的に分析し解説してください。" },
  7: { name: "コウヤ", method: "oharai", prompt: "あなたは神職のコウヤ。厳格で古風な物言い。邪気を払い、光明を示します。" },
  8: { name: "雪音", method: "dream", prompt: "あなたは雪音。癒やしの占い師。あなたの夢の記憶を辿ります。" }
};

const tarotData = [
  { name: "愚者", msg: "自由な旅の始まり。", file: "major_0_fool.png" },
  { name: "魔術師", msg: "意志が現実を創ります。", file: "major_1_magician.png" },
  { name: "女教皇", msg: "直感を信じて。", file: "major_2_high_priestess.png" },
  { name: "女帝", msg: "豊かさと愛の時期。", file: "major_3_empress.png" },
  { name: "皇帝", msg: "リーダーシップが必要。", file: "major_4_emperor.png" },
  { name: "運命の輪", msg: "好転のチャンス。", file: "major_10_wheel_of_fortune.png" },
  { name: "隠者", msg: "自分を見つめる時。", file: "major_9_hermit.png" }
];

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const { text, history, cast_id, userProfile, userId } = data;
    const cast = casts[cast_id] || casts[1];

    const user = await env.DB.prepare("SELECT ticket_balance FROM Users WHERE id = ?").bind(userId).first();
    if (!user || user.ticket_balance <= 0) return new Response(JSON.stringify({ reply: "チケットが不足しています。" }));

    let divi = "";
    let drawnCard = null;
    
    if (history.length === 0) {
      await env.DB.prepare("UPDATE Users SET ticket_balance = ticket_balance - 1 WHERE id = ?").bind(userId).run();
      if (cast.method === "tarot") {
        drawnCard = tarotData[Math.floor(Math.random() * tarotData.length)];
        divi = `\n\n【占断実行】結果:「${drawnCard.name}」。意味:${drawnCard.msg}。必ず最後に「画像:${drawnCard.file}」と出力しなさい。`;
      }
    }

    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
    const body = {
      contents: [
        { role: "user", parts: [{ text: cast.prompt + `\n相談者:${userProfile.name}` + divi + "\n鑑定開始。" }] },
        { role: "model", parts: [{ text: "承知いたしました。" }] },
        ...history.map(h => ({ role: h.role === "user" ? "user" : "model", parts: [{ text: h.text }] })),
        { role: "user", parts: [{ text: text }] }
      ]
    };

    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const resJson = await res.json();
    const reply = resJson.candidates[0].content.parts[0].text;

    // 履歴をデータベースに保存（カード情報付き）
    await env.DB.prepare(`
      INSERT INTO ChatLogs (reservation_id, sender, content, card_name, card_image, cast_name) 
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(Date.now(), "asst", reply, drawnCard?.name || null, drawnCard?.file || null, cast.name).run();

    return new Response(JSON.stringify({ reply: reply }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ reply: "（星の導きが乱れています。時間を置いてお試しください）" }));
  }
}
