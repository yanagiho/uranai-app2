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

    // --- 🆕 チケット消費判定ロジック ---
    // 直近のAIの発言時刻を取得し、セッション継続中か判定する
    const lastChat = await env.DB.prepare("SELECT timestamp FROM ChatLogs WHERE user_id = ? AND sender = 'ai' ORDER BY id DESC LIMIT 1").bind(userId).first();
    
    let isSessionActive = false;
    if (lastChat && lastChat.timestamp) {
        const lastTime = new Date(lastChat.timestamp).getTime();
        const now = Date.now();
        // 最後の会話から「10分以内」なら同じセッションとみなす（チケット消費なし）
        if ((now - lastTime) < 10 * 60 * 1000) {
            isSessionActive = true;
        }
    }

    // 予約がなく、セッション継続中でもなく、チケットも足りない場合はエラー
    const ticketBalance = user.ticket_balance || 0;
    if (!reservation && !isSessionActive && ticketBalance < 1) {
      return new Response(JSON.stringify({ reply: "鑑定を受けるにはチケットが必要です。右上の「＋」からお求めください。" }));
    }
    // ------------------------------------

    // 4. AI人格設定
    // 継続セッションの場合は、前回のキャスト情報を維持したいが、簡易的にリクエストのcastIdを優先
    const activeCastId = reservation ? reservation.cast_id : castId;
    const cast = casts[activeCastId];
    if (!cast) throw new Error("鑑定師データが見つかりません。");

    let expertKnowledge = activeCastId === 1 ? `【タロット知識】\n${JSON.stringify(tarotDataShion)}` : "";

    // --- 🆕 過去の記憶（コンテキスト）の取得 ---
    // 直近10件の会話を取得して、AIに読ませる
    const historyData = await env.DB.prepare("SELECT sender, content FROM ChatLogs WHERE user_id = ? ORDER BY id DESC LIMIT 10").bind(userId).all();
    // 古い順に並べ替え
    const historyText = historyData.results.reverse().map(log => {
        const role = log.sender === 'user' ? '相談者' : 'あなた';
        return `${role}: ${log.content}`;
    }).join("\n");
    // ------------------------------------

    // プロンプト構築（人間らしさを強化）
    const promptText = `
あなたは占い師「${cast.name}」として振る舞ってください。
以下の設定と過去の会話の流れを完全に踏まえて応答してください。

【キャラクター設定】
${cast.systemPrompt}

【相談者情報】
名前：${user.last_name} ${user.first_name} 様 (${user.dob}生まれ)

【専門知識】
${expertKnowledge}

【過去の会話（直近）】
${historyText}

【現在の相談者からの言葉】
${text}

【鑑定・対話の重要ルール】
1. **すぐに結論を出さないでください。** - 相談内容が曖昧な場合は、「それはいつ頃からですか？」「具体的にどういう状況でそう感じましたか？」など、**質問を投げかけて情報を深く引き出してください。** これにより信憑性を高めます。
2. **人間らしく振る舞ってください。**
   - AIであることを隠し、感情豊かに、時には悩み、時には一緒に笑ってください。
   - 過去の会話の内容を覚えていることを示唆する発言（「先ほど仰っていた〜」など）を盛り込んでください。
3. **占いの締めくくり**
   - 相談者が満足した様子や、話が一区切りついたと感じたら、ダラダラと続けずに「応援していますよ」「またいつでも来てください」といった言葉で**綺麗に会話を締めくくってください。**
4. **タロットカードについて**
   - 画像（[CARD: ...]）は、**ここぞという重要な局面でのみ** 出力してください。むやみに出す必要はありません。
   - その代わり、カードが示す情景や意味を、あなたの言葉で情緒的に描写してください。

以上のルールを守り、${cast.name}として返答してください。`;

    // 5. Gemini 2.5 Flash へのリクエスト
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }]
      })
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Gemini API Error (${response.status}):`, errorText);
        if (response.status === 404) throw new Error("AIモデルへの接続に失敗しました。");
        throw new Error(`AI通信エラー: ${response.status}`);
    }
    
    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!reply) throw new Error("AIからの応答がありませんでした。");

    // 6. チケット消費とログ保存
    // 予約消化時、または「セッション継続中ではない（新規鑑定）」場合のみチケット消費
    if (reservation) {
      await env.DB.prepare("UPDATE Reservations SET status = 'completed' WHERE id = ?").bind(reservation.id).run();
    } else if (!isSessionActive) {
      await env.DB.prepare("UPDATE Users SET ticket_balance = ticket_balance - 1 WHERE id = ?").bind(userId).run();
    }

    // ログ保存（timestampは自動で入る想定だが、念のため現在時刻を入れる実装も可）
    await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content, timestamp) VALUES (?, 'ai', ?, datetime('now'))").bind(userId, reply).run();
    
    // ユーザー発言もログに残す必要があるため、別途保存（本来はリクエスト受信時に保存すべきだが、簡易的にここで保存していない場合は追加が必要。
    // ※既存の実装ではユーザー発言がログに残っていない可能性があるため、ここでユーザー発言も保存する処理を追加します。
    await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content, timestamp) VALUES (?, 'user', ?, datetime('now'))").bind(userId, text).run();

    return new Response(JSON.stringify({ reply }));
  } catch (err) {
    console.error("Chat Logic Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
