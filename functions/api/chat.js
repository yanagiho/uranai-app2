export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { text, history = [] } = await request.json();
    const API_KEY = env.GEMINI_API_KEY;

    if (!API_KEY) {
      return new Response(JSON.stringify({ reply: "APIエラー：APIキーが設定されていません。" }), { status: 200 });
    }

    // モデル名を最も正確な「gemini-1.5-flash-latest」に変更します
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;

    const systemInstruction = `あなたは占い師の紫雲（シウン）です。
【人格】京都風の冷徹な女将。威圧的。
【鑑定フロー】名前と生年月日を聞き出すまで絶対に占わない。
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
      // ここで出るメッセージが「User location is not supported」なら、地域制限が確定します
      throw new Error(data.error?.message || "Google API側でエラーが発生しました");
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
