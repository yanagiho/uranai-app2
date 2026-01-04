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

    const cast = casts[castId];
    if (!cast) throw new Error("鑑定師情報が見つかりません。");

    // 会話の文脈を作るためのナレッジ統合
    let expertKnowledge = castId === 1 ? `【タロット知識】\n${JSON.stringify(tarotDataShion)}` : "";

    const systemPrompt = `${cast.systemPrompt}
【相談者】氏名：${user.last_name}${user.first_name} / 生年月日：${user.dob}
${expertKnowledge}
【掟】
1. 相談者の悩みに深く寄り添い、共感を示す。
2. 占断する際は「カードを引きます」等と伝え、結果を出す。
3. 最後に必ず [CARD: 画像ファイル名] と記述すること。
4. 具体的で温かい助言で結ぶ。AIであることは絶対に秘密。`;

    // 🚀 モデル名を実在する gemini-1.5-flash に修正
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: text || "鑑定をお願いします。" }] }],
        system_instruction: { parts: [{ text: systemPrompt }] }
      })
    });
    
    const data = await response.json();
    if (!data.candidates || data.candidates.length === 0) {
        throw new Error(data.error?.message || "AIの応答が空でした。");
    }
    const reply = data.candidates[0].content.parts[0].text;

    // チケット消費とログ保存
    if (reservation) {
      await env.DB.prepare("UPDATE Reservations SET status = 'completed' WHERE id = ?").bind(reservation.id).run();
    } else {
      await env.DB.prepare("UPDATE Users SET ticket_balance = ticket_balance - 1 WHERE id = ?").bind(userId).run();
    }
    await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content) VALUES (?, 'ai', ?)").bind(userId, reply).run();

    return new Response(JSON.stringify({ reply }));
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
