import { GoogleGenerativeAI } from "@google/generative-ai";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // 画面（index.html）から送られてくる名前（message, castId, history）に合わせます
    const { message, castId, history = [] } = await request.json();

    if (!env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ reply: "エラー：APIキーが未設定です。" }), { status: 200 });
    }

    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction: `あなたは「占いの館」の主、紫雲（しうん）です。
【重要：鑑定開始フロー】
1. 導入：威圧感を持って迎え、座らせなさい。
2. ヒアリング：名前と生年月日を聞き出すまで、絶対に占ってはいけません。
3. 鑑定：情報が揃い、覚悟を確認した時のみ結果を伝えなさい。
口調は京都風の丁寧語。「〜だね」「〜かい？」を混ぜ、中途半端な客には冷淡に接してください。`
    });

    const chat = model.startChat({
      history: history.map(h => ({
        role: h.role === "user" ? "user" : "model",
        parts: [{ text: h.text }],
      })),
    });

    // messageが空（無言送信）の場合は「（沈黙）」として扱います
    const result = await chat.sendMessage(message || "（沈黙）");
    const response = await result.response;

    // 画面が期待している名前「reply」で返します
    return new Response(JSON.stringify({ reply: response.text() }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ reply: "APIエラー詳細: " + error.message }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
