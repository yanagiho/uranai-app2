export async function onRequestPost(context) {
  try {
    const { message, castId, cardName } = await context.request.json();
    const db = context.env.DB;
    const apiKey = context.env.GEMINI_API_KEY;

    // APIキーの確認
    if (!apiKey) return new Response(JSON.stringify({ reply: "【エラー】APIキーが設定されていません" }));

    // 1. 占い師データの取得
    const cast = await db.prepare("SELECT * FROM Casts WHERE id = ?").bind(castId).first();
    if (!cast) return new Response(JSON.stringify({ reply: "【エラー】占い師が見つかりません" }));

    // 2. プロンプトの作成
    let userMessage = `相談者: ${message}`;
    if (cardName) {
      userMessage += `\n\n【状況】\n相談者はタロットカードを引き、「${cardName}」が出ました。\nこのカードの意味（正位置）を踏まえて、相談者の悩みにアドバイスしてください。カードの描写も交えると効果的です。`;
    }

    const systemPrompt = cast.system_prompt;
    
    // ★ここが修正点！確実に動く「プレビュー版」の正式名称を指定
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

    // ★重要：更新されたか確認するための「目印」をつけました
    if (data.error) {
      // エラーメッセージを日本語にして、モデル名も表示させます
      const errorMsg = `【最新版デバッグ】\nモデル: ${apiUrl.split('models/')[1].split(':')[0]}\nエラー: ${data.error.message}`;
      return new Response(JSON.stringify({ reply: errorMsg }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "（AIからの応答が空でした）";

    return new Response(JSON.stringify({ reply }), { headers: { "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ reply: `【システムエラー】: ${e.message}` }), { status: 500 });
  }
}
