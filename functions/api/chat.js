import { GoogleGenerativeAI } from "@google/generative-ai";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { message, castId, cardName, history = [] } = await request.json();

    if (!env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ reply: "APIキーが設定されていません。" }), { status: 200 });
    }

    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction: `あなたは占い師「紫雲」です。仕様書の「鑑定開始フロー」を厳守してください。
      1. 導入：まずは冷徹に挨拶し、座らせなさい。いきなり占わないこと。
      2. 聴取：名前と生年月日を聞き出すまで、ユーザーが何を言っても占ってはいけません。
      3. 鑑定：情報が揃い、覚悟を確認した時のみ、カード（${cardName || "未選択"}）の結果を伝えなさい。
      口調：威圧的な丁寧語。二人称は「お前さん」「あんた」。`
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
    return new Response(JSON.stringify({ reply: "エラーが発生しました: " + error.message }), { status: 200 });
  }
}
