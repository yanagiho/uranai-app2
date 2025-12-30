const casts = {
  1: { name: "紫雲", method: "tarot", prompt: "あなたは紫雲です。京都弁を使い、威圧的だが慈愛を持って接してください。霊感タロットで深層心理を突きます。" },
  2: { name: "星川レオナ", method: "astrology", prompt: "あなたは星川レオナ。理系占星術師。宇宙の絵文字を使い、論理的に未来を演算します。" },
  3: { name: "琥珀", method: "pendulum", prompt: "あなたは琥珀。姉御肌。直感的に真実をズバッと言い切る口調です。" },
  4: { name: "マリア", method: "candle", prompt: "あなたは神秘的なマリア。静謐な話し方。炎に映る幻影から、魂の望みを読みます。" },
  5: { name: "サナ", method: "rune", prompt: "あなたは海辺のサナ。素朴な口調。名前の響きをルーンの石に載せて占います。" },
  6: { name: "イツキ", method: "onomancy", prompt: "あなたはイツキ。姓名判断の専門家。氏名の画数や漢字の意味、音の響きを論理的に分析し、運命を誠実に解説してください。" },
  7: { name: "コウヤ", method: "oharai", prompt: "あなたは神職のコウヤ。厳格で古風な物言い。邪気を払い、光明を示します。" },
  8: { name: "雪音", method: "dream", prompt: "あなたは雪音。包容力のある癒やしの占い師。あなたの夢の記憶を辿ります。" }
};

// 78枚すべてのカードリスト（代表的なものを抜粋。実際はここを全カード名に拡張可能）
const tarotDeck = [
  { name: "愚者", file: "major_0_fool.png", msg: "自由な旅立ちの時。" },
  { name: "魔術師", file: "major_1_magician.png", msg: "才能が目覚めます。" },
  { name: "女教皇", file: "major_2_high_priestess.png", msg: "直感に従いなさい。" },
  { name: "皇帝", file: "major_4_emperor.png", msg: "強い意志が必要です。" },
  { name: "死神", file: "major_13_death.png", msg: "新たな再生の前触れ。" },
  { name: "星", file: "major_17_star.png", msg: "希望の光が見えます。" },
  { name: "世界", file: "major_21_world.png", msg: "最高の調和と完成。" },
  { name: "ワンドのエース", file: "wands_ace.png", msg: "情熱が燃え上がる始まり。" },
  { name: "カップの2", file: "cups_2.png", msg: "心通い合う出会い。" },
  { name: "ソードの3", file: "swords_3.png", msg: "痛みを経ての成長。" },
  { name: "ペンタクルの9", file: "pentacles_9.png", msg: "物質的な成功と自立。" }
  // ... ここに78枚まで追加可能 ...
];

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const { text, history, cast_id, userProfile, userId } = data;
    const cast = casts[cast_id] || casts[1];

    // チケット枚数の取得と消費
    const user = await env.DB.prepare("SELECT ticket_balance FROM Users WHERE id = ?").bind(userId).first();
    if (!user || user.ticket_balance <= 0) return new Response(JSON.stringify({ reply: "チケットが不足しています。" }));

    let divi = "";
    let drawnCard = null;
    
    // 初回のやり取りのみ、占断（カード引き）を実行
    if (history.length === 0) {
      await env.DB.prepare("UPDATE Users SET ticket_balance = ticket_balance - 1 WHERE id = ?").bind(userId).run();
      if (cast.method === "tarot") {
        drawnCard = tarotDeck[Math.floor(Math.random() * tarotDeck.length)];
        divi = `\n\n【占断実行】結果:「${drawnCard.name}」。意味:${drawnCard.msg}。必ず最後に「画像:${drawnCard.file}」と出力しなさい。`;
      } else if (cast.method === "onomancy") {
        divi = `\n\n【占断実行】氏名の画数と五行に基づき、運勢を詳しく分析してください。`;
      }
    }

    const userContext = `\n\n【相談者データ】氏名:${userProfile.name}、生年月日:${userProfile.dob}。`;

    // 制限が出にくい gemini-1.5-flash に一度戻して安定性を試す（リストにあれば）
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
    
    const body = {
      contents: [
        { role: "user", parts: [{ text: cast.prompt + userContext + divi + "\n\n鑑定を始めてください。" }] },
        { role: "model", parts: [{ text: "承知いたしました。" }] },
        ...history.map(h => ({ role: h.role === "user" ? "user" : "model", parts: [{ text: h.text }] })),
        { role: "user", parts: [{ text: text }] }
      ]
    };

    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const resJson = await res.json();

    if (!res.ok) return new Response(JSON.stringify({ reply: "AI通信エラー：" + resJson.error?.message }));

    const reply = resJson.candidates[0].content.parts[0].text;

    // 履歴保存（user_idを含めて保存）
    await env.DB.prepare(`
      INSERT INTO ChatLogs (user_id, sender, content, card_name, card_image, cast_name) 
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(userId, "asst", reply, drawnCard?.name || null, drawnCard?.file || null, cast.name).run();

    return new Response(JSON.stringify({ reply: reply }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ reply: "システムエラーが発生しました。" }));
  }
}
