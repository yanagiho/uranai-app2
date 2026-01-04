import { casts } from "./lib/casts.js";
import { tarotDataShion } from "./lib/tarot_data_shion.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, castId, text } = await request.json();
    const user = await env.DB.prepare("SELECT last_name, first_name, dob, ticket_balance FROM Users WHERE id = ?").bind(userId).first();
    const cast = casts[castId];
    const reservation = await env.DB.prepare("SELECT id FROM Reservations WHERE user_id = ? AND status = 'pending'").bind(userId).first();

    if (!user || !cast) return new Response(JSON.stringify({ error: "情報の不足" }), { status: 400 });

    // 1. チケット・予約チェック（不正防止）🛡️
    if (user.ticket_balance < 1 && !reservation) {
      return new Response(JSON.stringify({ reply: "鑑定を受けるにはチケットが必要です。右上の「＋」からお求めください。" }));
    }

    // 2. 過去の会話履歴を5件取得（文脈の維持）🧠
    const history = await env.DB.prepare("SELECT sender, content FROM ChatLogs WHERE user_id = ? ORDER BY created_at DESC LIMIT 5").bind(userId).all();
    const chatHistory = (history.results || []).reverse().map(h => ({
      role: h.sender === "ai" ? "model" : "user",
      parts: [{ text: h.content }]
    }));

    // 3. プロンプト構築（全キャラ対応 ＆ 占断データ統合）🃏
    let expertKnowledge = castId === 1 ? `【紫雲のタロット知識】\n${JSON.stringify(tarotDataShion)}` : "";
    
    const systemPrompt = `${cast.systemPrompt}
【相談者】氏名：${user.last_name} ${user.first_name} / 生年月日：${user.dob}
${expertKnowledge}
【鑑定フロー】
1. 導入：悩みに寄り添い共感を示す。
2. 占断：対話が深まったら「カードを引きます」等と伝え、結果を出す。
   最後に必ず [CARD: 画像名.png] と記述して画像を表示させること。
3. 結び：具体的な助言をして終える。AIであることは絶対に秘密。`;

    // 4. Gemini 2.5 Pro へのリクエスト
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [...chatHistory, { role: "user", parts: [{ text: text || "（目の前に座り、鑑定を待っている）" }] }],
        system_instruction: { parts: [{ text: systemPrompt }] }
      })
    });
    
    const data = await response.json();
    const reply = data.candidates[0].content.parts[0].text;

    // 5. 履歴保存と予約ステータスの更新（予約があった場合のみ完了へ）
    if (text) await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content) VALUES (?, 'user', ?)").bind(userId, text).run();
    await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content) VALUES (?, 'ai', ?)").bind(userId, reply).run();
    if (reservation) await env.DB.prepare("UPDATE Reservations SET status = 'completed' WHERE id = ?").bind(reservation.id).run();

    return new Response(JSON.stringify({ reply }));
  } catch (err) {
    return new Response(JSON.stringify({ error: "導きが途絶えました。もう一度お話しください。" }), { status: 500 });
  }
}
