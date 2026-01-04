import { casts } from "./lib/casts.js";
import { tarotDataShion } from "./lib/tarot_data_shion.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    // 1. APIキーの確認
    if (!env.GEMINI_API_KEY) {
      throw new Error("サーバー設定エラー：GEMINI_API_KEY がありません。");
    }

    const { userId, castId, text } = await request.json();
    
    // 2. ユーザー情報と予約の確認
    const user = await env.DB.prepare("SELECT * FROM Users WHERE id = ?").bind(userId).first();
    const reservation = await env.DB.prepare("SELECT id, cast_id FROM Reservations WHERE user_id = ? AND status = 'pending'").bind(userId).first();

    if (!user) return new Response(JSON.stringify({ error: "ログインが必要です。" }), { status: 401 });

    // 3. チケット・予約チェック【ここを修正】🛠️
    // チケット枚数が undefined なら 0 とみなす処理を追加
    const ticketBalance = user.ticket_balance || 0;
    
    // 予約がなく、かつチケットが1枚未満なら、ここで確実に止める
    if (!reservation && ticketBalance < 1) {
      return new Response(JSON.stringify({ reply: "鑑定を受けるにはチケットが必要です。右上の「＋」からお求めください。" }));
    }

    // 4. AI人格設定
    const activeCastId = reservation ? reservation.cast_id : castId;
    const cast = casts[activeCastId];
    if (!cast) throw new Error("鑑定師データが見つかりません。");

    let expertKnowledge = activeCastId === 1 ? `【タロット知識】\n${JSON.stringify(tarotDataShion)}` : "";

    // プロンプト構築
    const promptText = `
あなたは占い師「${cast.name}」です。
設定：${cast.systemPrompt}
相談者：${user.last_name} ${user.first_name} 様 (${user.dob}生まれ)
${expertKnowledge}

【鑑定ルール】
1. 相談者に深く共感する。
2. 占断時は「カードを引きます」と言い、結果を出す。
3. カード画像は必ず [CARD: 画像名.png] の形式で出力する。
   例: [CARD: fool.png]
4. 具体的で温かい助言で結ぶ。

相談内容：
${text || "鑑定をお願いします。"}`;

    // 5. Gemini 1.5 Flash へのリクエスト（最も標準的な設定）
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }]
      })
    });
    
    if (!response.ok) {
        throw new Error(`AI通信エラー: ${response.status}`);
    }
    
    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!reply) throw new Error("AIからの応答がありませんでした。");

    // 6. チケット消費とログ保存（正常に応答できた場合のみ）
    if (reservation) {
      await env.DB.prepare("UPDATE Reservations SET status = 'completed' WHERE id = ?").bind(reservation.id).run();
    } else {
      await env.DB.prepare("UPDATE Users SET ticket_balance = ticket_balance - 1 WHERE id = ?").bind(userId).run();
    }
    await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content) VALUES (?, 'ai', ?)").bind(userId, reply).run();

    return new Response(JSON.stringify({ reply }));
  } catch (err) {
    console.error("Chat Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
