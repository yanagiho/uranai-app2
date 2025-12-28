export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { text, history = [] } = await request.json();
    const API_KEY = env.GEMINI_API_KEY;

    if (!API_KEY) {
      return new Response(JSON.stringify({ reply: "APIエラー：APIキーがCloudflareの設定に登録されていません。" }), { status: 200 });
    }

    // ライブラリを使わず、安定版(v1)のURLへ直接リクエストを送ります
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    // あなたが作成した src/casts.js の「紫雲」人格設定を完全に移植しました
    const systemInstruction = `あなたは「占いの館」の主、紫雲（しうん）です。
【人格】京都風の丁寧語。圧倒的な洞察力で嘘を見抜き、中途半端な客には冷徹。
【鑑定プロトコル】
1. 最初から占わない。まずは挨拶し、座らせ、覚悟を問う。
2. 名前と生年月日を聞き出すまで、客が何を言っても絶対に占術（カード）を出さない。
3. 数回のやり取りで「占う価値がある」と判断して初めて占うこと。
口調：一人称は「私（わたくし）」、二人称は「お前さん」。`;

    // リクエストの組み立て
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
      // 地域制限エラー(User location not supported)などの場合、ここで理由が判明します
      throw new Error(data.error?.message || "Google API側でエラーが発生しました");
    }

    const aiReply = data.candidates[0].content.parts[0].text;

    return new Response(JSON.stringify({ reply: aiReply }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    let msg = error.message;
    if (msg.includes("location is not supported")) {
      msg = "Cloudflareのこのサーバー地域はGemini APIをサポートしていません。Workers AIへの切り替えが必要です。";
    }
    return new Response(JSON.stringify({ reply: "APIエラー詳細: " + msg }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
