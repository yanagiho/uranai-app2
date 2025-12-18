export async function onRequestPost(context) {
  try {
    const { message, castId, cardName } = await context.request.json();
    const db = context.env.DB;
    const apiKey = context.env.GEMINI_API_KEY;

    if (!apiKey) return new Response(JSON.stringify({ reply: "【エラー】APIキー設定なし" }));

    // 1. 占い師データの取得
    const cast = await db.prepare("SELECT * FROM Casts WHERE id = ?").bind(castId).first();
    if (!cast) return new Response(JSON.stringify({ reply: "【エラー】占い師データなし" }));

    // 2. プロンプト作成
    let userMessage = `相談者: ${message}`;
    if (cardName) {
      userMessage += `\n\n【状況】\n相談者はタロットカードを引き、「${cardName}」が出ました。\nこのカードの意味（正位置）を踏まえて、相談者の悩みにアドバイスしてください。カードの描写も交えると効果的です。`;
    }

    const systemPrompt = cast.system_prompt;
    
    // ★ここが最終決定版！リストにあった「標準版」を使います
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    
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

    // ★エラーが起きたら、日本語で詳細を表示（デバッグ用）
    if (data.error) {
      const modelName = apiUrl.split('models/')[1].split(':')[0];
      return new Response(JSON.stringify({ 
        reply: `【AIエラー報告】\nモデル: ${modelName}\n内容: ${data.error.message}\n(この画面をスクショしてください)` 
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "（AIからの応答が空でした）";

    return new Response(JSON.stringify({ reply }), { headers: { "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ reply: `【システムエラー】: ${e.message}` }), { status: 500 });
  }
}
