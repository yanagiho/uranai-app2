import { GoogleGenerativeAI } from "@google/generative-ai";

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    try {
      const { content, history = [] } = await request.json();

      // Gemini APIの準備
      const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-pro",
        systemInstruction: "あなたは占い師の紫苑です。京都風の丁寧語で話し、まずは名前と生年月日を聞き出すまで絶対に占わないでください。"
      });

      // チャットの開始
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
      return new Response(JSON.stringify({ content: "APIエラー詳細: " + error.message }), { status: 200 });
    }
  }
};
