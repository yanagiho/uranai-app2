import { GoogleGenerativeAI } from "@google/generative-ai";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { content, history = [] } = await request.json();

    // 1. APIキーの存在チェック
    if (!env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ content: "エラー：GEMINI_API_KEY が Cloudflare の管理画面で設定されていません。" }), { status: 200 });
    }

    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    
    // 2. モデルの準備（systemInstruction の書き方をより確実な形式に変更）
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction: {
        parts: [{ text: `あなたは「占いの館」の主、紫苑（しうん）です。
【重要ルール：鑑定開始までの3つの関所】
1. 導入：まずは挨拶し、着席を促しなさい。
2. ヒアリング：会話の中で自然に「生年月日」と「名前」を聞き出しなさい。
3. 鑑定：情報が揃うまで占ってはいけません。
京都風の丁寧語で、洞察力が鋭く、中途半端な客には冷徹に接してください。` }]
      }
    });

    const chat = model.startChat({
      history: history.map(h => ({
        role: h.role === "user" ? "user" : "model",
        parts: [{ text: h.content }],
      })),
    });

    // 3. 送信
    const result = await chat.sendMessage(content);
    const response = await result.response;
    const aiText = response.text();

    return new Response(JSON.stringify({ content: aiText }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    // 【ここが重要】エラーの正体を画面に返します
    console.error("Gemini Error:", error);
    return new Response(JSON.stringify({ content: "APIエラー詳細: " + error.message }), {
      status: 200, // エラーでも文字として表示させるために 200 にします
      headers: { "Content-Type": "application/json" },
    });
  }
}
