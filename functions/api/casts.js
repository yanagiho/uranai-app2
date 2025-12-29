export async function onRequestGet() {
  const casts = [
    { id: 1, name: "紫雲", role: "霊感タロット", img: "shiun.png", intro: "全てを見透かす冷徹な女将。" },
    { id: 2, name: "星川レオナ", role: "理系占星術", img: "leona.png", intro: "星の配置から論理的に未来を演算します。" },
    { id: 3, name: "琥珀", role: "宝石・ペンデュラム", img: "kohaku.png", intro: "あんたの運命、石の輝きで丸見えよ。" },
    { id: 4, name: "マリア", role: "秘術・キャンドル", img: "maria.png", intro: "炎の揺らぎに、あなたの魂を映します。" },
    { id: 5, name: "サナ", role: "ルーン・自然", img: "sana.png", intro: "波の音と石の文字が、道を教えてくれるわ。" },
    { id: 6, name: "イツキ", role: "算命学・易", img: "itsuki.png", intro: "宿命の設計図を、誠実に紐解きましょう。" },
    { id: 7, name: "コウヤ", role: "神道・お祓い", img: "koya.png", intro: "何用だ。不浄を払い、神の声を伝えるのみ。" },
    { id: 8, name: "雪音", role: "夢占い・水晶", img: "yukine.png", intro: "あなたの夢の欠片を、優しく水晶に映します。" }
  ];
  return new Response(JSON.stringify(casts), {
    headers: { "Content-Type": "application/json" }
  });
}
