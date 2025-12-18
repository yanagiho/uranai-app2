export async function onRequestPost(context) {
  try {
    // message（悩み）に加え、cardName（引いたカード）も受け取るようにする
    const { message, castId, cardName } = await context.request.json();
    const db = context.env.DB;
    const apiKey = context.env.GEMINI_API_KEY;

    if (!apiKey) return new Response(JSON.stringify({ reply: "APIキーが設定されていません" }));

    // 1. 占い師データの取得
    const cast = await db.prepare("SELECT * FROM Casts WHERE id = ?").bind(castId).first();
    if (!cast) return new Response(JSON.stringify({ reply: "占い師が見つかりません" }));

    // 2. プロンプトの作成
    let userMessage = `相談者: ${message}`;
    
    // ★もしカードが引かれていたら、AIにその情報を渡す
    if (cardName) {
      userMessage += `\n\n【状況】\n相談者はタロットカードを引き、「${cardName}」が出ました。\nこのカードの意味（正位置）を踏まえて、相談者の悩みにアドバイスしてください。カードの描写も交えると効果的です。`;
    }

    const systemPrompt = cast.system_prompt;
    // 成功した「Lite」モデルを使用
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite-preview-02-05:generateContent?key=${apiKey}`;
    
    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: `あなたは「${cast.name}」として振る舞ってください。\n設定:\n${systemPrompt}\n\n${userMessage}` }]
        }
      ]
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "（星の言葉が届きませんでした...）";

    return new Response(JSON.stringify({ reply }), { headers: { "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ reply: `エラー: ${e.message}` }), { status: 500 });
  }
}
