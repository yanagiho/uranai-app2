import { casts } from "./lib/casts.js"; // パスを修正 🚀
import { tarotDataShion } from "./lib/tarot_data_shion.js"; // パスを修正 🚀

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, castId, text } = await request.json();
    const user = await env.DB.prepare("SELECT last_name, first_name, dob FROM Users WHERE id = ?").bind(userId).first();
    const cast = casts[castId];

    if (!user || !cast) return new Response(JSON.stringify({ error: "情報の不足" }));

    // 1. 過去の履歴をD1から取得して文脈を作る
    let chatHistory = [];
    try {
        const history = await env.DB.prepare(
          "SELECT sender, content FROM ChatLogs WHERE user_id = ? ORDER BY created_at DESC LIMIT 5"
        ).bind(userId).all();
        chatHistory = (history.results || []).reverse().map(h => ({
          role: h.sender === "ai" ? "model" : "user",
          parts: [{ text: h.content }]
        }));
    } catch (e) { console.error("履歴取得エラー", e); }

    // 2. 鑑定師ごとのナレッジを構築
    let expertKnowledge = "";
    if (castId === 1) {
      expertKnowledge = `【あなたのタロットデータ】必ずここから1枚選び、メッセージを引用してください。
      ${JSON.stringify(tarotDataShion)}`;
    }

    const systemPrompt = `${cast.systemPrompt}
【相談者】氏名：${user.last_name} ${user.first_name} / 生年月日：${user.dob}
【ナレッジ】${expertKnowledge}

【鑑定の掟】
1. 導入：まずは悩みに寄り添い、共感を示してください。
2. 占断：「カードを引きます」と宣言し、ナレッジから1枚選び、結果を伝えてください。
   最後に必ず [CARD: 画像ファイル名] と記述してください。
3. 結び：具体的な助言を行い、背中を押して鑑定を終えてください。`;

    // 3. Gemini 2.5 Pro にリクエスト
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${env.GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [...chatHistory, { role: "user", parts: [{ text: text || "（目の前に座り、お告げを待っている）" }] }],
        system_instruction: { parts: [{ text: systemPrompt }] }
      })
    });
    
    const data = await response.json();
    if (!data.candidates || data.candidates.length === 0) {
        throw new Error(data.error?.message || "Geminiからの応答がありません。APIキーや設定を確認してください。");
    }
    const reply = data.candidates[0].content.parts[0].text;

    // 4. 履歴を保存
    if (text) await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content) VALUES (?, 'user', ?)").bind(userId, text).run();
    await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content) VALUES (?, 'ai', ?)").bind(userId, reply).run();

    return new Response(JSON.stringify({ reply }));
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
