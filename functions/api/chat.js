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

    // 3. チケット・予約チェック 🛠️
    // チケット枚数が undefined なら 0 とみなす安全策
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
    // gemini-pro はシンプルな指示を好むため、構造を少し簡略化しています
    const promptText = `
あなたは占い師「${cast.name}」として振る舞ってください。
【設定】${cast.systemPrompt}
【相談者】${user.last_name} ${user.first_name} 様 (${user.dob}生まれ)
${expertKnowledge}

【鑑定のルール】
1. 相談者に深く共感し、寄り添う言葉をかけてください。
2. 占断を行う際は「カードを引きます」等と宣言し、結果を伝えてください。
3. 鑑定結果に対応するタロットカード画像を、必ず [CARD: 画像ファイル名] という形式で出力してください。
   例: [CARD: fool.png]
4. 最後に具体的で温かいアドバイスをして締めくくってください。
5. あなたがAIであることは絶対に秘密です。

【相談内容】
${text || "鑑定をお願いします。"}`;

    // 5. Gemini Pro (安定版) へのリクエスト 🚀
    // ※モデル名を 'gemini-pro' に変更しました。これが最も確実です。
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }]
      })
    });
    
    if (!response.ok) {
        // エラー詳細をログに残す
        const errorText = await response.text();
        console.error(`Gemini API Error (${response.status}):`, errorText);
        
        if (response.status === 404) {
             throw new Error("AIモデルへの接続に失敗しました(404)。");
        }
        throw new Error(`AI通信エラー: ${response.status}`);
    }
    
    const data = await response.json();
    // 応答データがあるか安全にチェック
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
    console.error("Chat Logic Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
