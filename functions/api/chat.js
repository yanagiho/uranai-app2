import { GoogleGenerativeAI } from "@google/generative-ai";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { text, history = [] } = await request.json();

    if (!env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ reply: "APIエラー：APIキーが設定されていません。" }), { status: 200 });
    }

    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    
    // 修正ポイント：モデル名を「gemini-1.5-flash-latest」に変更して安定性を高めます
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash-latest",
      systemInstruction: "あなたは占い師の紫雲（シウン）です。京都風の冷徹な女将として、威圧的に接してください。生年月日と名前を聞き出すまで絶対に占わないでください。"
    });

    const chat = model.startChat({
      history: history.map(h => ({
        role: h.role === "user" ? "user" : "model",
        parts: [{ text: h.text }],
      })),
    });

    // メッセージが空の場合の予備テキストを設定
    const result = await chat.sendMessage(text || "（沈黙）");
    const response = await result.response;

    return new Response(JSON.stringify({ reply: response.text() }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    // もしFlashモデルがダメな場合はProモデルを試すようエラーメッセージを調整
    let errorMsg = error.message;
    if (errorMsg.includes("404")) {
      errorMsg = "モデル名が認識されませんでした。'gemini-1.5-pro' への変更が必要かもしれません。";
    }
    
    return new Response(JSON.stringify({ reply: "APIエラー詳細: " + errorMsg }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
