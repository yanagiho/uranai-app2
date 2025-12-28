export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { text, history = [] } = await request.json();
    const API_KEY = env.GEMINI_API_KEY;

    if (!API_KEY) {
      return new Response(JSON.stringify({ reply: "APIエラー：APIキーが設定されていません。" }), { status: 200 });
    }

    // 【最重要修正】診断結果に基づき、確実に存在するモデル名「gemini-flash-latest」を指定しました
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

    // 紫苑先生の人格設定
    const systemInstruction = `あなたは占い師の紫雲（シウン）です。
【人格】京都風の冷徹な女将。威圧的だが、真剣な悩みには慈愛を見せる。
【ルール】
1. 最初は挨拶と着席のみ。いきなり占わない。
2. 名前と生年月日を聞き出すまで、絶対にカード（占断）を出してはいけない。
口調：一人称は「私（わたくし）」、二人称は「お前さん」。`;

    const body = {
      contents: [
        { role: "user", parts: [{ text: systemInstruction + "\n\n対話を開始します。" }] },
        ...history.map(h => ({
          role: h.role === "user" ? "user" : "model",
          parts: [{ text: h.text }]
        })),
        { role: "user", parts: [{ text: text || "（沈黙）" }] }
      ]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "通信エラー");
    }

    const aiReply = data.candidates[0].content.parts[0].text;

    return new Response(JSON.stringify({ reply: aiReply }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ reply: "APIエラー詳細: " + error.message }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
