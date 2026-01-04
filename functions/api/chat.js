import { casts } from "./lib/casts.js";
import { tarotDataShion } from "./lib/tarot_data_shion.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, castId, text } = await request.json();
    
    // 1. ユーザー情報と直近の予約/チャット状態を取得
    const user = await env.DB.prepare("SELECT * FROM Users WHERE id = ?").bind(userId).first();
    const pendingRes = await env.DB.prepare("SELECT id FROM Reservations WHERE user_id = ? AND status = 'pending'").bind(userId).first();
    const recentChat = await env.DB.prepare("SELECT created_at FROM ChatLogs WHERE user_id = ? AND sender = 'ai' ORDER BY created_at DESC LIMIT 1").bind(userId).first();

    if (!user) return new Response(JSON.stringify({ error: "ログインが必要です" }), { status: 401 });

    // 2. 厳格なチケット/予約チェック 🎟️
    const now = Math.floor(Date.now() / 1000);
    const isWithinSession = recentChat && (now - recentChat.created_at < 3600); // 1時間は同セッションとみなす

    if (!isWithinSession) {
      if (pendingRes) {
        // 予約（支払い済み）がある場合はそれを使用し、完了にする
        await env.DB.prepare("UPDATE Reservations SET status = 'completed' WHERE id = ?").bind(pendingRes.id).run();
      } else if (user.ticket_balance >= 1) {
        // 予約がない場合はチケットを1枚消費
        await env.DB.prepare("UPDATE Users SET ticket_balance = ticket_balance - 1 WHERE id = ?").bind(userId).run();
      } else {
        // どちらも無い場合は拒否
        return new Response(JSON.stringify({ reply: "鑑定を受けるにはチケットが必要です。右上の「＋」からお求めください。" }));
      }
    }

    // 3. AI人格とナレッジの統合
    const cast = casts[castId] || casts[1];
    let expertKnowledge = castId === 1 ? `【タロット知識】\n${JSON.stringify(tarotDataShion)}` : "";

    const systemPrompt = `${cast.systemPrompt}
【相談者】氏名：${user.last_name}${user.first_name} / 生年月日：${user.dob}
${expertKnowledge}
【鑑定の掟】
1. 共感：まずは悩みを深く聞き、寄り添ってください。
2. 占断：対話の中で「カードを引きます」と告げ、結果を伝えてください。
   最後に必ず [CARD: 画像名.png] と記述して画像を表示させること。
3. 助言：具体的で温かいアドバイスをして結んでください。`;

    // 4. Gemini 1.5 Flash へのリクエスト 🚀
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: text || "鑑定をお願いします。" }] }],
        system_instruction: { parts: [{ text: systemPrompt }] }
      })
    });
    
    const data = await response.json();
    if (!data.candidates) throw new Error(data.error?.message || "AI応答エラー");
    const reply = data.candidates[0].content.parts[0].text;

    // 5. 履歴保存
    await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content) VALUES (?, 'ai', ?)").bind(userId, reply).run();

    return new Response(JSON.stringify({ reply }));
  } catch (err) {
    return new Response(JSON.stringify({ error: "星の導きが途絶えました。もう一度送信してください。" }), { status: 500 });
  }
}
