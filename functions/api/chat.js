import { GoogleGenerativeAI } from "@google/generative-ai";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { content, history = [] } = await request.json();

    // 1. APIキーが正しく読み込めているかチェック
    if (!env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ content: "【エラー】GEMINI_API_KEYがCloudflareの設定に登録されていません。" }), { status: 200 });
    }

    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    
    // 2. 最新の 1.5-Flash モデルを使用
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash"
    });

    // 3. プロンプトと履歴を渡して対話開始
    const chat = model.startChat({
      systemInstruction: "あなたは占い師の紫苑です。京都風の丁寧語で話し、鑑定前には必ず名前と生年月日を聞き出してください。",
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
    // エラーの具体的な内容を画面に表示させます
    let errorMsg = error.message;
    if (errorMsg.includes("User location is not supported")) {
      errorMsg = "お使いの地域（サーバーの場所）ではGemini APIが制限されています。";
    }
    return new Response(JSON.stringify({ content: "APIエラー詳細: " + errorMsg }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
