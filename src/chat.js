import { GoogleGenerativeAI } from "@google/generative-ai";
import { casts } from "./casts";

export async function handleChat(request, env) {
  const genAI = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY);
  // Gemini 1.5 Proを指定（より人間らしい推論が可能です）
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-pro",
  });

  try {
    const { message, castId, history } = await request.json();
    const cast = casts[castId] || casts[1];

    // Geminiの「システムインストラクション」機能を使用して、
    // 会話の途中で性格がブレないように固定します。
    const chat = model.startChat({
      history: history.map(h => ({
        role: h.role === "user" ? "user" : "model",
        parts: [{ text: h.content }],
      })),
      // ここで最強のプロンプトを注入します
      systemInstruction: {
        parts: [{ text: cast.systemPrompt }]
      }
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text();

    return new Response(JSON.stringify({ response: text }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Gemini Error:", error);
    return new Response(JSON.stringify({ error: "通信に失敗しました。少し時間を置いておくれ。" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
