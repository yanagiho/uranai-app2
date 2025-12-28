import { GoogleGenerativeAI } from "@google/generative-ai";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { text, history = [] } = await request.json();

    if (!env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ reply: "APIエラー詳細: APIキーが設定されていません。" }), { status: 200 });
    }

    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction: `あなたは占い師の紫雲（シウン）です。
      【行動指針】
      ・京都風の冷徹な女将として、威圧的に接してください。
      ・「3つの関所」：挨拶し、生年月日と名前を聞き出すまで絶対に占ってはいけません。
      ・ユーザーの本音を深掘りし、覚悟が足りなければ突き放してください。
      ・一人称は「私（わたくし）」、二人称は「お前さん」「あんた」です。`
    });

    const chat = model.startChat({
      history: history.map(h => ({
        role: h.role === "user" ? "user" : "model",
        parts: [{ text: h.text }],
      })),
    });

    const result = await chat.sendMessage(text || "（沈黙）");
    const response = await result.response;

    return new Response(JSON.stringify({ reply: response.text() }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ reply: "APIエラー詳細: " + error.message }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
