import { GoogleGenerativeAI } from "@google/generative-ai";
import casts from "./casts.js";

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    try {
      const { content, castId = 1, history = [] } = await request.json();
      const cast = casts[castId];

      const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
      // 最新の 1.5-flash モデルを使用（高速で無料枠も広いです）
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        systemInstruction: cast.systemPrompt 
      });

      const chat = model.startChat({
        history: history.map(h => ({
          role: h.role === "user" ? "user" : "model",
          parts: [{ text: h.content }],
        })),
      });

      const result = await chat.sendMessage(content);
      const response = await result.response;
      const aiText = response.text();

      return new Response(JSON.stringify({ content: aiText }), {
        headers: { "Content-Type": "application/json" },
      });

    } catch (error) {
      console.error("Gemini Error:", error);
      return new Response(JSON.stringify({ content: "星の声が届かないようです。APIキーを確認しておくれ。" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
};
