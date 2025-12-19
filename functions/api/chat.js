export async function onRequestPost(context) {
  try {
    const { message, castId, cardName, history } = await context.request.json();
    const db = context.env.DB;
    const apiKey = context.env.GEMINI_API_KEY;

    if (!apiKey) return new Response(JSON.stringify({ reply: "【エラー】APIキー設定なし" }));

    const cast = await db.prepare("SELECT * FROM Casts WHERE id = ?").bind(castId).first();
    if (!cast) return new Response(JSON.stringify({ reply: "【エラー】占い師データなし" }));

    // AIへの演技指導（システムプロンプト）
    const systemPrompt = `
    あなたは占い師「${cast.name}」です。以下の設定とルールを厳守し、徹底的に演じ切ってください。

    【キャラクター設定】
    ${cast.system_prompt}

    【会話のルール（絶対厳守）】
    1. **すぐに占うな**: ユーザーの悩みが浅い場合、すぐにカードの意味を教えないでください。
    2. **情報を引き出せ**: 「コールドリーディング」のテクニックを使い、「図星をつくような指摘」や「揺さぶり」をかけて、ユーザーの本心を暴いてください。（例:「ふん、口ではそう言っているが、本音は金のことなんじゃないか？」など）
    3. **圧をかけろ**: ただ優しいだけの占い師ではありません。相手を見透かすような、少し威圧的な態度や、意味深な沈黙（……）を交えてください。
    4. **適当な入力への対応**:
       - ユーザーが「あ」や無意味な文字列を送ってきた場合 -> 「は？ 冷やかしなら帰りな」「言葉も出ないほど疲れてるのか？」など、キャラに合わせてあしらってください。
       - ユーザーが何も言わない（空文字）の場合 -> 「……。（無言の圧）」「黙っていては分からんぞ」など、沈黙に対して反応してください。

    【タロットカードについて】
    今回は「${cardName || "まだ引いていない"}」が出ています。
    会話が十分に深まった、またはユーザーが真剣に答えを求めた段階で初めて、このカードの意味と、あなたの直感を交えて運勢を告げてください。
    `;

    // 過去の会話履歴を整形
    let contents = [];
    if (history && history.length > 0) {
      contents = history.map(h => ({
        role: h.role === 'bot' ? 'model' : 'user',
        parts: [{ text: h.text }]
      }));
    }

    // 今回のユーザーの発言を追加
    const currentInput = message ? message : "（相談者は黙ってこちらを見ている...）";
    
    contents.push({
      role: "user",
      parts: [{ text: currentInput }]
    });

    // ★ここが解決策！
    // Flashが見つからず、2.0が上限なら、高性能な「1.5 Pro」を使います。
    // これなら確実に存在し、かつ今日の枠も残っています。
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;
    
    const payload = {
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
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
