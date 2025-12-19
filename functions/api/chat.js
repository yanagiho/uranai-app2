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

    // ★ここが修正点！
    // 「systemInstruction」機能を使わず、会話の履歴として自然に設定を読み込ませます。
    
    let contents = [];

    // 1. 最初の命令（ユーザー役として設定を送りつける）
    contents.push({
      role: "user",
      parts: [{ text: `【命令】以下の設定になりきって振る舞ってください。\n\n${systemPromptText}` }]
    });

    // 2. AIの承諾（AI役として承諾させることで、設定を固定する）
    contents.push({
      role: "model",
      parts: [{ text: "承知いたしました。私はその設定の占い師として振る舞います。" }]
    });

    // 3. 実際の過去の会話履歴を追加
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

    // 接続先は、さきほどモデルが見つかった「v1（安定版）」を使います
    const apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    // payloadから systemInstruction を削除し、シンプルにしました
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
      return new Response(JSON.stringify({ 
        reply: `【エラー】\nモデル: ${apiUrl.split('models/')[1].split(':')[0]}\n原因: ${data.error.message}` 
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
