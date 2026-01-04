import { casts } from "./lib/casts.js";
import { tarotDataShion } from "./lib/tarot_data_shion.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, castId, text } = await request.json();
    
    // 1. ユーザー情報と予約の確認
    const user = await env.DB.prepare("SELECT * FROM Users WHERE id = ?").bind(userId).first();
    const reservation = await env.DB.prepare("SELECT id FROM Reservations WHERE user_id = ? AND status = 'pending'").bind(userId).first();

    if (!user) return new Response(JSON.stringify({ error: "ログインが必要です" }), { status: 401 });

    // チケット・予約チェック 🎟️
    if (user.ticket_balance < 1 && !reservation) {
      return new Response(JSON.stringify({ reply: "鑑定を受けるにはチケットが必要です。右上の「＋」からお求めください。" }));
    }

    // 2. 過去の会話履歴を5件取得（文脈の維持）🧠
    const history = await env.DB.prepare("SELECT sender, content FROM ChatLogs WHERE user_id = ? ORDER BY created_at DESC LIMIT 5").bind(userId).all();
    const chatHistory = (history.results || []).reverse().map(h => ({
      role: h.sender === "ai" ? "model" : "user",
      parts: [{ text: h.content }]
    }));

    const cast = casts[castId];
    let expertKnowledge = castId === 1 ? `【タロット知識】\n${JSON.stringify(tarotDataShion)}` : "";

    const systemPrompt = `${cast.systemPrompt}
【相談者】氏名：${user.last_name}${user.first_name} / 生年月日：${user.dob}
${expertKnowledge}
【掟】1.深く共感する 2.占断し最後に必ず [CARD: 画像名.png] と書く 3.具体的な助言。`;

    // 3. Gemini 1.5 Pro へのリクエスト（モデル名を修正 🚀）
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [...chatHistory, { role: "user", parts: [{ text: text || "鑑定をお願いします。" }] }],
        system_instruction: { parts: [{ text: systemPrompt }] }
      })
    });
    
    const data = await response.json();
    if (!data.candidates) throw new Error(data.error?.message || "AI応答エラー");
    const reply = data.candidates[0].content.parts[0].text;

    // 4. チケット消費と履歴保存
    if (reservation) {
      await env.DB.prepare("UPDATE Reservations SET status = 'completed' WHERE id = ?").bind(reservation.id).run();
    } else {
      await env.DB.prepare("UPDATE Users SET ticket_balance = ticket_balance - 1 WHERE id = ?").bind(userId).run();
    }
    if (text) await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content) VALUES (?, 'user', ?)").bind(userId, text).run();
    await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content) VALUES (?, 'ai', ?)").bind(userId, reply).run();

    return new Response(JSON.stringify({ reply }));
  } catch (err) {
    return new Response(JSON.stringify({ error: "導きが途絶えました。リロードしてお試しください。" }), { status: 500 });
  }
}
