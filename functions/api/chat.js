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
      [cite_start]systemInstruction: "あなたは占い師の紫雲（しうん）です。仕様書に基づき、挨拶し、名前と生年月日を聞き出すまで絶対に占わないでください。" // [cite: 234-247]
    });

    const chat = model.startChat({
      history: history.map(h => ({
        role: h.role === "user" ? "user" : "model",
        parts: [{ text: h.text }],
      })),
    });

    const result = await chat.sendMessage(message || "（無言）");
    const response = await result.response;

    [cite_start]// 画面(index.html)が「reply」という項目名で待っているので、合わせます [cite: 718-720]
    return new Response(JSON.stringify({ reply: response.text() }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ reply: "APIエラー詳細: " + error.message }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
