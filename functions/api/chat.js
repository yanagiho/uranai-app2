const casts = {
  1: { name: "紫雲", method: "tarot", systemPrompt: "あなたは紫雲です。京都風の丁寧語を使い、威圧的ですが慈愛を持って接してください。名前と生年月日を聞くまでは絶対に占わないでください。" },
  2: { name: "星川レオナ", method: "astrology", systemPrompt: "あなたは星川レオナです。理系女子で宇宙の絵文字を多用します。データが揃うまで占いません。" },
  3: { name: "琥珀", method: "pendulum", systemPrompt: "あなたは琥珀です。華やかな姉御肌です。本名と生年月日を聞くまでは占いません。" },
  4: { name: "マリア", method: "candle", systemPrompt: "あなたはマリアです。神秘的で静かです。情報が揃うまで占いません。" },
  5: { name: "サナ", method: "rune", systemPrompt: "あなたはサナです。素朴な海辺の賢者です。名前と生年月日を聞くまでは占いません。" },
  6: { name: "イツキ", method: "sanmei", systemPrompt: "あなたはイツキです。知的な紳士です。情報が揃うまで占いません。" },
  7: { name: "コウヤ", method: "oharai", systemPrompt: "あなたはコウヤです。厳格な神職です。名と生年月日を名乗るまで占いません。" },
  8: { name: "雪音", method: "dream", systemPrompt: "あなたは雪音です。癒やしの占い師です。名前と生年月日を聞くまでは占いません。" }
};

// 大アルカナ22枚（主要なカード）を内蔵
const tarotData = [
  { name: "愚者", message: "自由な旅の始まり。自由な心があなたの武器。", file: "major_0_fool.png" },
  { name: "魔術師", message: "準備は整いました。あなたの意志が現実を創ります。", file: "major_1_magician.png" },
  { name: "女教皇", message: "内なる声を聞く時。直感を大切に。", file: "major_2_high_priestess.png" },
  { name: "女帝", message: "豊かさと愛に満ちています。実りを楽しみなさい。", file: "major_3_empress.png" },
  { name: "皇帝", message: "揺るぎない意志とリーダーシップが必要です。", file: "major_4_emperor.png" },
  { name: "教皇", message: "信頼できる助言に従うことで道が開けます。", file: "major_5_hierophant.png" },
  { name: "恋人", message: "素晴らしい選択の時。喜びを享受しなさい。", file: "major_6_lovers.png" },
  { name: "戦車", message: "前進あるのみ。スピード感が鍵となります。", file: "major_7_chariot.png" },
  { name: "力", message: "忍耐強く自分を律しなさい。それが真の強さです。", file: "major_8_strength.png" },
  { name: "隠者", message: "一人静かに考える時間が必要。内面を見つめて。", file: "major_9_hermit.png" },
  { name: "運命の輪", message: "運命の好転。チャンスの波に乗りなさい。", file: "major_10_wheel_of_fortune.png" },
  { name: "正義", message: "客観的な判断を。バランスを見極めるのです。", file: "major_11_justice.png" },
  { name: "吊るされた男", message: "今は修行の時。視点を変えて物事を見なさい。", file: "major_12_hanged_man.png" },
  { name: "死神", message: "一つのサイクルの終了。執着を手放しなさい。", file: "major_13_death.png" },
  { name: "節制", message: "調和が鍵。穏やかな姿勢が物事を進めます。", file: "major_14_temperance.png" },
  { name: "悪魔", message: "誘惑に囚われています。その鎖は自分で切れます。", file: "major_15_devil.png" },
  { name: "塔", message: "衝撃的な変化。偽りの基盤が壊れただけです。", file: "major_16_tower.png" },
  { name: "星", message: "希望の光。理想に向かって純粋な気持ちを。", file: "major_17_star.png" },
  { name: "月", message: "先が見えず不安な時。霧が晴れるのを待って。", file: "major_18_moon.png" },
  { name: "太陽", message: "成功と喜び。ポジティブなエネルギーの時。", file: "major_19_sun.png" },
  { name: "審判", message: "努力が報われる再生のチャンスが訪れます。", file: "major_20_judgment.png" },
  { name: "世界", message: "最高のハッピーエンド。満足と調和の完成。", file: "major_21_world.png" }
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

    if (!API_KEY) throw new Error("APIキーがありません");

    let diviInfo = "";
    // 年、月、日のいずれかが含まれていれば「情報提供」とみなす
    if ((text.includes("年") || text.includes("月") || text.includes("日")) && history.length >= 1) {
      if (cast.method === "tarot") {
        const card = tarotData[Math.floor(Math.random() * tarotData.length)];
        diviInfo = "\n\n【占断実行】結果:" + card.name + "。意味:" + card.message + "。最後に必ず「画像:" + card.file + "」と書きなさい。";
      } else {
        diviInfo = "\n\n【占断実行】良い運気の流れが来ています。";
      }
    }

    // AIへの送信データ作成（role alternating errorを防ぐ最新の書き方）
    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=" + API_KEY;
    const body = {
      system_instruction: { parts: [{ text: cast.systemPrompt + diviInfo }] },
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
    if (!res.ok) throw new Error(result.error?.message || "AI通信失敗");
    
    const reply = result.candidates[0].content.parts[0].text;

    // D1への保存（任意）
    if (env.DB) {
      try {
        await env.DB.prepare("INSERT INTO ChatLogs (sender, content) VALUES (?, ?)").bind("user", text).run();
        await env.DB.prepare("INSERT INTO ChatLogs (sender, content) VALUES (?, ?)").bind("asst", reply).run();
      } catch (dbErr) {}
    }

    return new Response(JSON.stringify({ reply: reply }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ reply: "(使い魔):星の導きに乱れが生じました。APIキーの設定や通信を確認してください。" }), { status: 500 });
  }
}
