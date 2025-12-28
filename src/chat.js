import { GoogleGenerativeAI } from "@google/generative-ai";
// casts.js を読み込みます。パスが正しいか確認してください
import casts from "./casts.js";

export default {
  async fetch(request, env) {
    // API以外のリクエスト（HTMLなど）は無視する設定
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    try {
      const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
      // Gemini 1.5 Proを使用
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

      const { content, castId = 1, history = [] } = await request.json();
      const cast = casts[castId];

      const chat = model.startChat({
        history: history.map(h => ({
          role: h.role === "user" ? "user" : "model",
          parts: [{ text: h.content }],
        })),
        systemInstruction: {
          parts: [{ text: cast.systemPrompt }]
        }
      });

      const result = await chat.sendMessage(content);
      const response = await result.response;
      const aiText = response.text();

      return new Response(JSON.stringify({ content: aiText }), {
        headers: { "Content-Type": "application/json" },
      });

    } catch (error) {
      console.error("Gemini Error:", error);
      return new Response(JSON.stringify({ content: "星の声が届かないようです。時間を置いておくれ。" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
};
