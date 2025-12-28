import { GoogleGenerativeAI } from "@google/generative-ai";
import casts from "./casts.js";

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    try {
      const { content, history = [] } = await request.json();
      
      // 紫苑（ID: 1）の設定を使用
      const cast = casts[1];

      // Gemini APIの準備
      const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        systemInstruction: cast.systemPrompt 
      });

      // 過去の会話履歴をGeminiが理解できる形式に変換
      const chat = model.startChat({
        history: history.map(h => ({
          role: h.role === "user" ? "user" : "model",
          parts: [{ text: h.content }],
        })),
      });

      // AIからの返答を取得
      const result = await chat.sendMessage(content);
      const response = await result.response;
      const aiText = response.text();

      return new Response(JSON.stringify({ content: aiText }), {
        headers: { "Content-Type": "application/json" },
      });

    } catch (error) {
      console.error("Gemini Error:", error);
      return new Response(JSON.stringify({ content: "……星の導きが途絶えたようだね。APIキーの設定を確認しておくれ。" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
};
