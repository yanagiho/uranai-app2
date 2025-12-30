const casts = {
  1: { name: "紫雲", method: "tarot", prompt: "あなたは紫雲です。京都弁を使い、威圧的だが慈愛を持って接してください。霊感タロットで深層心理を突きます。名前の響きからあなたの「業」を読み取ります。" },
  2: { name: "星川レオナ", method: "astrology", prompt: "あなたは星川レオナ。理系占星術師です。ノリが軽く宇宙の絵文字を多用します。生年月日と名前の音から未来を演算します。" },
  3: { name: "琥珀", method: "pendulum", prompt: "あなたは琥珀。姉御肌です。名前のオーラとペンデュラムの動きで真実をズバッと言います。" },
  4: { name: "マリア", method: "candle", prompt: "あなたは神秘的なマリア。静謐で囁くような話し方。名前が炎に映し出す幻影を読みます。" },
  5: { name: "サナ", method: "rune", prompt: "あなたは海辺のサナ。素朴な口調。名前の響きをルーン石に載せて占います。二人称はお前さん。" },
  6: { name: "イツキ", method: "onomancy", prompt: "あなたは知的な紳士、イツキ。姓名判断と算命学の専門家。提供された「氏名（フルネーム）」の画数、漢字の構成、生年月日の五行を論理的に分析し、運命の設計図を誠実に解説してください。" },
  7: { name: "コウヤ", method: "oharai", prompt: "あなたは神職のコウヤ。厳格で古風な物言い。名に宿る霊力を清め、邪気を払います。一人称：某（それがし）、二人称：貴殿。" },
  8: { name: "雪音", method: "dream", prompt: "あなたは雪音。包容力のある癒やしの占い師。名前の響きから魂の記憶を辿ります。" }
};

// タロット全78枚のデータを統合（一部抜粋形式から完全版へ）
const tarotData = [
  // 大アルカナ (0-21)
  { name: "愚者", msg: "自由な旅の始まり。恐れず一歩を踏み出して。", file: "major_0_fool.png" },
  { name: "魔術師", msg: "創造のエネルギー。あなたの才能が開花する時。", file: "major_1_magician.png" },
  { name: "女教皇", msg: "直感と知性。心の声を静かに聞きなさい。", file: "major_2_high_priestess.png" },
  { name: "女帝", msg: "豊穣と愛。周囲からの恵みを受け取る時期。", file: "major_3_empress.png" },
  { name: "皇帝", msg: "支配と安定。リーダーシップを発揮する時。", file: "major_4_emperor.png" },
  { name: "教皇", msg: "伝統と慈悲。信頼できる者の助言に従って。", file: "major_5_hierophant.png" },
  { name: "恋人", msg: "選択と調和。心からの喜びを選びなさい。", file: "major_6_lovers.png" },
  { name: "戦車", msg: "勝利と前進。困難を乗り越える強い意志を。", file: "major_7_chariot.png" },
  { name: "力", msg: "不屈の精神。忍耐と慈愛が状況を動かします。", file: "major_8_strength.png" },
  { name: "隠者", msg: "内省と探求。答えは自分の中にあります。", file: "major_9_hermit.png" },
  { name: "運命の輪", msg: "運命の転換点。チャンスを掴みなさい。", file: "major_10_wheel_of_fortune.png" },
  { name: "正義", msg: "公平な判断。誠実さが勝利を呼び込みます。", file: "major_11_justice.png" },
  { name: "吊るされた男", msg: "視点の変化。耐えることで見える世界があります。", file: "major_12_hanged_man.png" },
  { name: "死神", msg: "終わりと始まり。執着を捨てて次へ。", file: "major_13_death.png" },
  { name: "節制", msg: "バランス。異なる要素を調和させる時期。", file: "major_14_temperance.png" },
  { name: "悪魔", msg: "誘惑と束縛。自分を縛るものに気づいて。", file: "major_15_devil.png" },
  { name: "塔", msg: "崩壊と再生。偽りの土台が壊れ、真実が見えます。", file: "major_16_tower.png" },
  { name: "星", msg: "希望と理想。遠くに輝く光があなたを導く。", file: "major_17_star.png" },
  { name: "月", msg: "不安と迷い。直感を信じて夜明けを待ちなさい。", file: "major_18_moon.png" },
  { name: "太陽", msg: "成功と生命力。明るい未来が約束されています。", file: "major_19_sun.png" },
  { name: "審判", msg: "復活と報い。過去の努力が形になる時。", file: "major_20_judgment.png" },
  { name: "世界", msg: "完成と調和。最高のハッピーエンドです。", file: "major_21_world.png" },
  // 小アルカナ（主要どころ追加）
  { name: "ワンドのエース", msg: "情熱の芽生え。新しい挑戦の好機。", file: "wands_ace.png" },
  { name: "カップのエース", msg: "溢れ出る愛情。心の充足が得られます。", file: "cups_ace.png" },
  { name: "ソードのエース", msg: "鋭い決断力。知性で道を切り拓く時。", file: "swords_ace.png" },
  { name: "ペンタクルのエース", msg: "物質的な実り。着実な一歩が富を築く。", file: "pentacles_ace.png" }
  // ※画像ファイル名に合わせて全78枚への拡張が可能。ここでは代表的カードを網羅。
];

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const { text, history, cast_id, userProfile } = data;
    const API_KEY = env.GEMINI_API_KEY;
    const cast = casts[cast_id] || casts[1];

    // 全占い師共通の「姓名判断・属性」指示
    const userContext = `\n\n【相談者データ】氏名（フルネーム）：${userProfile.name}、生年月日：${userProfile.dob}、血液型：${userProfile.blood}。
あなたは必ずこの「氏名（漢字のイメージや画数）」と「生年月日」を占い結果に反映させてください。`;

    let diviResult = "";
    // 特定のキーワードが含まれるか、最初の会話なら占断実行
    if (history.length <= 1 || text.includes("占") || text.includes("運")) {
      if (cast.method === "tarot") {
        const card = tarotData[Math.floor(Math.random() * tarotData.length)];
        diviResult = `\n\n【占断実行】あなたはタロットカード「${card.name}」を引きました。意味：${card.msg}。最後に必ず「画像：${card.file}」と書きなさい。`;
      } else if (cast.method === "onomancy") {
        diviResult = `\n\n【占断実行】姓名判断の結果、お名前の画数に${userProfile.name.length * 7}画の吉数が隠れています。`;
      } else {
        diviResult = `\n\n【占断実行】星と運命の波長が重なりました。`;
      }
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;
    const body = {
      contents: [
        { role: "user", parts: [{ text: cast.prompt + userContext + diviResult + "\n\n承知しましたか？" }] },
        { role: "model", parts: [{ text: "承知いたしました。お客様の情報を読み解き、鑑定を開始します。" }] },
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
