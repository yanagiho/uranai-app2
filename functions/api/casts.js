export async function onRequestGet(context) {
  // データベース（D1）がうまく動かない場合でも、確実に8人を表示するためのデータ
  const casts = [
    { 
      id: 1, 
      name: "紫雲", 
      role: "霊感タロット", 
      img: "shiun.png", 
      intro: "全てを見透かす冷徹な女将。京都風の丁寧な物言いで、あなたの深層心理を紐解きます。" 
    },
    { 
      id: 2, 
      name: "星川レオナ", 
      role: "理系占星術", 
      img: "leona.png", 
      intro: "星の配置を論理的に演算する新時代の占星術師。宇宙の視点から未来を予測します。" 
    },
    { 
      id: 3, 
      name: "琥珀", 
      role: "宝石・ペンデュラム", 
      img: "kohaku.png", 
      intro: "石の輝きと揺らぎから真実をズバッと言い当てる。飾り気のない姉御肌の鑑定が人気。" 
    },
    { 
      id: 4, 
      name: "マリア", 
      role: "秘術・キャンドル", 
      img: "maria.png", 
      intro: "揺らめく炎の先に、あなたの魂が望む本当の道を見出します。静謐で神秘的な時間を提供。" 
    },
    { 
      id: 5, 
      name: "サナ", 
      role: "ルーン・自然", 
      img: "sana.png", 
      intro: "北欧の古い文字「ルーン」に刻まれた、自然の声を届けます。海辺の賢者のような穏やかな語り。" 
    },
    { 
      id: 6, 
      name: "イツキ", 
      role: "算命学・易", 
      img: "itsuki.png", 
      intro: "生年月日から導き出される宿命の設計図を誠実に解説。紳士的で信頼の厚い鑑定師。" 
    },
    { 
      id: 7, 
      name: "コウヤ", 
      role: "神道・お祓い", 
      img: "koya.png", 
      intro: "不浄を払い、神々の声を伝える厳格な神職。あなたを惑わす邪気を断ち切り、光明を示します。" 
    },
    { 
      id: 8, 
      name: "雪音", 
      role: "夢占い・水晶", 
      img: "yukine.png", 
      intro: "水晶の奥に映る光と、あなたの夢の欠片を繋ぎ合わせます。包容力溢れる母のような鑑定。" 
    }
  ];

  return new Response(JSON.stringify(casts), {
    headers: { "Content-Type": "application/json" }
  });
}
