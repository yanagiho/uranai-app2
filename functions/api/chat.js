import { GoogleGenerativeAI } from "@google/generative-ai";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { message, castId, history = [] } = await request.json();

    if (!env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ reply: "APIキーが設定されていません。" }), { status: 200 });
    }

    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction: "あなたは占い師の紫苑です。仕様書にある『3つの関所（挨拶・ヒアリング・鑑定）』を遵守し、すぐには占わずに対話を深めてください。"
    });

    const chat = model.startChat({
      history: history.map(h => ({
        role: h.role === "user" ? "user" : "model",
        parts: [{ text: h.text }],
      })),
    });

    const result = await chat.sendMessage(message || "（沈黙）");
    const response = await result.response;

    return new Response(JSON.stringify({ reply: response.text() }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ reply: "エラーが発生しました: " + error.message }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
