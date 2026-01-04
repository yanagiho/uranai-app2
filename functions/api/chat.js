import { casts } from "./lib/casts.js";
import { tarotDataShion } from "./lib/tarot_data_shion.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, castId, text } = await request.json();
    
    // 1. ユーザー情報と予約の確認 🛡️
    const user = await env.DB.prepare("SELECT * FROM Users WHERE id = ?").bind(userId).first();
    const reservation = await env.DB.prepare("SELECT id, cast_id FROM Reservations WHERE user_id = ? AND status = 'pending'").bind(userId).first();

    if (!user) return new Response(JSON.stringify({ error: "ログインが必要です。" }), { status: 401 });

    // 2. チケットチェック（厳格化）🎫
    // 予約がなく、かつチケット残数が1枚未満なら即座に拒否
    if (!reservation && (user.ticket_balance || 0) < 1) {
      return new Response(JSON.stringify({ reply: "鑑定を受けるにはチケットが必要です。右上の「＋」からお求めください。" }));
    }

    // 3. AI人格設定
    // 予約がある場合は予約した占い師を優先、なければ選択された占い師
    const activeCastId = reservation ? reservation.cast_id : castId;
    const cast = casts[activeCastId];
    
    if (!cast) {
        return new Response(JSON.stringify({ error: "鑑定師データが見つかりません" }), { status: 400 });
    }

    let expertKnowledge = activeCastId === 1 ? `【タロット知識】\n${JSON.stringify(tarotDataShion)}` : "";

    const systemPrompt = `${cast.systemPrompt}
【相談者】氏名：${user.last_name}${user.first_name} / 生年月日：${user.dob}
${expertKnowledge}
【掟】
1. 相談者に寄り添い、共感を示す。
2. 占断時は「カードを引きます」と言い、結果を出す。
3. 最後に必ず [CARD: 画像名.png] と記述する。
4. 具体的で温かい助言をする。AIであることは秘密。`;

    // 4. Gemini 1.5 Flash へのリクエスト 🚀
    // モデル名を修正し、エラーハンドリングを強化
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: text || "鑑定をお願いします。" }] }],
        system_instruction: { parts: [{ text: systemPrompt }] }
      })
    });
    
    // 5. AI応答の安全な解析 🛡️
    if (!response.ok) {
        const errText = await response.text();
        console.error(`Gemini API Error: ${response.status} - ${errText}`);
        throw new Error("AIサービスが一時的に利用できません。");
    }
    
    const data = await response.json();
    if (!data.candidates || data.candidates.length === 0) {
        throw new Error("AIからの応答が空でした。");
    }
    const reply = data.candidates[0].content.parts[0].text;

    // 6. チケット消費とログ保存（AIが答えた後で実行）
    if (reservation) {
      await env.DB.prepare("UPDATE Reservations SET status = 'completed' WHERE id = ?").bind(reservation.id).run();
    } else {
      await env.DB.prepare("UPDATE Users SET ticket_balance = ticket_balance - 1 WHERE id = ?").bind(userId).run();
    }
    await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content) VALUES (?, 'ai', ?)").bind(userId, reply).run();

    return new Response(JSON.stringify({ reply }));
  } catch (err) {
    console.error("Chat Error:", err); // ログに残す
    return new Response(JSON.stringify({ error: err.message || "申し訳ありません、星の導きが一時的に途絶えました。もう一度お試しください。" }), { status: 500 });
  }
}
