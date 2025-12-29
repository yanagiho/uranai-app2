export async function onRequestGet(context) {
  const { env } = context;
  
  // データベースから占い師一覧を取得する
  try {
    const { results } = await env.DB.prepare("SELECT * FROM Casts ORDER BY id ASC").all();
    
    // 画面表示に必要な画像名などを補完して返却する
    const casts = results.map(c => ({
      id: c.id,
      name: c.name,
      role: c.system_prompt.split(' / ')[0], // 「/」より前を役割にする
      intro: c.system_prompt.split(' / ')[1], // 「/」より後を紹介文にする
      img: getImgFileName(c.id)
    }));

    return new Response(JSON.stringify(casts), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

// IDから画像ファイル名を決める補助機能
function getImgFileName(id) {
  const names = ["", "shiun.png", "leona.png", "kohaku.png", "maria.png", "sana.png", "itsuki.png", "koya.png", "yukine.png"];
  return names[id] || "shiun.png";
}
