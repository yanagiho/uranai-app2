export async function onRequestPost(context) {
  try {
    const { message, castId, cardName, history } = await context.request.json();
    const db = context.env.DB;
    const apiKey = context.env.GEMINI_API_KEY;

    if (!apiKey) return new Response(JSON.stringify({ reply: "【エラー】APIキー設定なし" }));

    const cast = await db.prepare("SELECT * FROM Casts WHERE id = ?").bind(castId).first();
    if (!cast) return new Response(JSON.stringify({ reply: "【エラー】占い師データなし" }));

    // キャラクター設定の文章
    const systemPromptText = `
    あなたは占い師「${cast.name}」です。以下の設定とルールを厳守し、徹底的に演じ切ってください。

    【キャラクター設定】
    ${cast.system_prompt}

    【会話のルール（絶対厳守）】
    1. **すぐに占うな**: ユーザーの悩みが浅い場合、すぐにカードの意味を教えないでください。
    2. **情報を引き出せ**: 「コールドリーディング」のテクニックを使い、「図星をつくような指摘」や「揺さぶり」をかけて、ユーザーの本心を暴いてください。
    3. **圧をかけろ**: ただ優しいだけの占い師ではありません。威圧的な態度や、意味深な沈黙（……）を交えてください。
    4. **適当な入力への対応**:
       - 「あ」などの無意味な入力 -> 「は？ 冷やかしか？」「疲れてるのか？」とあしらう。
       - 空文字（沈黙） -> 「……。（無言の圧）」「黙っていては分からんぞ」と反応する。

    【タロットカードについて】
    今回は「${cardName || "まだ引いていない"}」が出ています。
    `;

    // 会話データ（contents）の作成
    let contents = [];

    // 1. 設定を「ユーザーからの命令」として擬似的に送る
    contents.push({
      role: "user",
      parts: [{ text: `【システム命令】\n${systemPromptText}` }]
    });

    // 2. AIに承諾させる（これで設定が固定されます）
    contents.push({
      role: "model",
      parts: [{ text: "承知いたしました。その設定になりきって対話します。" }]
    });

    // 3. 過去の会話履歴を追加
    if (history && history.length > 0) {
      history.forEach(h => {
        contents.push({
          role: h.role === 'bot' ? 'model' : 'user',
          parts: [{ text: h.text }]
        });
      });
    }

    // 4. 今回のユーザーの発言を追加
    const currentInput = message ? message : "（相談者は黙ってこちらを見ている...）";
    contents.push({
      role: "user",
      parts: [{ text: currentInput }]
    });

    // ★接続先は「v1（安定版）」
    // ここが v1beta になっていると Not Found になります
    const apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const payload = {
      contents: contents
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.error) {
      // エラー時に「どのバージョンに接続したか」を表示して確認できるようにします
      return new Response(JSON.stringify({ 
        reply: `【接続エラー】\n接続先: ${apiUrl.includes('/v1/') ? 'v1(正)' : 'v1beta(誤)'}\n内容: ${data.error.message}` 
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "（...気配が消えた）";

    return new Response(JSON.stringify({ reply }), { headers: { "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ reply: `【システムエラー】: ${e.message}` }), { status: 500 });
  }
}
