export async function onRequestGet(context) {
  const { env } = context;
  
  try {
    // D1データベースから占い師を取得
    const { results } = await env.DB.prepare("SELECT * FROM Casts ORDER BY id ASC").all();
    
    if (!results || results.length === 0) {
      throw new Error("データベースが空です");
    }

    const casts = results.map(c => {
      // system_promptを「役職 / 紹介文」の形で分割して読み込む
      const parts = c.system_prompt ? c.system_prompt.split(' / ') : ["占い師", "準備中..."];
      return {
        id: c.id,
        name: c.name,
        role: parts[0],
        intro: parts[1] || "",
        img: getImgFileName(c.id)
      };
    });

    return new Response(JSON.stringify(casts), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    // データベースが失敗したとき用のバックアップデータ（画面を止めないため）
    const backup = [
      { id: 1, name: "紫雲", role: "霊感タロット", intro: "全てを見透かす冷徹な女将。", img: "shiun.png" }
    ];
    return new Response(JSON.stringify(backup), {
      headers: { "Content-Type": "application/json" }
    });
  }
}

function getImgFileName(id) {
  const names = ["", "shiun.png", "leona.png", "kohaku.png", "maria.png", "sana.png", "itsuki.png", "koya.png", "yukine.png"];
  return names[id] || "shiun.png";
}
