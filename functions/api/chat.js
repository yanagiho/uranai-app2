import { GoogleGenerativeAI } from "@google/generative-ai";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { content, history = [] } = await request.json();

    if (!env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ content: "APIキーが設定されていません。" }), { status: 200 });
    }

    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction: "あなたは占い師の紫苑（しうん）です。京都風の落ち着いた丁寧語で話し、まずは名前と生年月日を聞き出すまで絶対に占わないでください。"
    });

    const chat = model.startChat({
      history: history.map(h => ({
        role: h.role === "user" ? "user" : "model",
        parts: [{ text: h.content }],
      })),
    });

    const result = await chat.sendMessage(content);
    const response = await result.response;
    return new Response(JSON.stringify({ content: response.text() }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ content: "APIエラー: " + error.message }), { status: 200 });
  }
}
