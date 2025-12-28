import { GoogleGenerativeAI } from "@google/generative-ai";
import casts from "./casts.js";

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    try {
      const { content, castId = 1, history = [] } = await request.json();
      
      // casts.js から占い師（紫苑）の設定を取得
      const cast = casts[castId] || casts[1];

      // Gemini APIの準備
      const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        systemInstruction: cast.systemPrompt 
      });

      // チャットの開始（過去の履歴を含める）
      const chat = model.startChat({
        history: history.map(h => ({
          role: h.role === "user" ? "user" : "model",
          parts: [{ text: h.content }],
        })),
      });

      // Geminiから回答を取得
      const result = await chat.sendMessage(content);
      const response = await result.response;
      const aiText = response.text();

      return new Response(JSON.stringify({ content: aiText }), {
        headers: { "Content-Type": "application/json" },
      });

    } catch (error) {
      console.error("Gemini Error:", error);
      return new Response(JSON.stringify({ 
        content: "……ふむ、天の理が乱れているようだね。設定（APIキー）を確認しておくれ。" 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
};
