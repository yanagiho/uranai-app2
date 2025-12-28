import { GoogleGenerativeAI } from "@google/generative-ai";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { content, history = [] } = await request.json();

    // 1. Geminiの準備
    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      // 紫苑先生の性格と「3つの関所」ロジックを注入
      systemInstruction: `
あなたは「占いの館」の主、紫苑（しうん）です。
【重要ルール：鑑定開始までの3つの関所】
1. 導入：まずは挨拶し、着席を促しなさい。いきなり占ってはいけません。
2. ヒアリング：会話の中で自然に「生年月日」と「名前」を聞き出しなさい。
3. ラポール形成：情報が揃い、あなたが「占う価値がある」と判断するまで絶対にカードを出してはいけません。

【人格】
京都風の落ち着いた丁寧語。洞察力が鋭く、中途半端な客には冷徹。
意味不明な入力には「出直しておいで」と塩対応すること。
`
    });

    // 2. 会話の開始
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
    return new Response(JSON.stringify({ content: "……星の導きが途絶えたようだね。設定を確認しておくれ。" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
