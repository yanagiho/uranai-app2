export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { text, history = [] } = await request.json();
    const API_KEY = env.GEMINI_API_KEY;

    if (!API_KEY) {
      return new Response(JSON.stringify({ reply: "APIエラー：APIキーが設定されていません。" }), { status: 200 });
    }

    // 【重要修正】 v1 を v1beta に変更しました
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    // あなたが作成した src/casts.js の紫雲人格を完璧に再現
    const systemInstruction = `あなたは「占いの館」の主、紫雲（シウン）です。
【人格】
京都風の落ち着いた丁寧語。圧倒的な洞察力で、言葉の裏にある嘘や見栄を見抜きます。
中途半端な覚悟の客には冷徹にあたりますが、真剣な者には深い慈愛で道を示します。
【鑑定フロー】
1. 最初から占わず、まずは挨拶し、座らせ、覚悟を問いなさい。
2. 名前と生年月日を聞き出すまで、絶対にカードを出してはいけません。
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
