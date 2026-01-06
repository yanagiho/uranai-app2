import { casts } from "./lib/casts.js";
import { tarotDataShion } from "./lib/tarot_data_shion.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY が設定されていません。");

    const { userId, castId, text } = await request.json();
    
    // ユーザー・予約確認
    const user = await env.DB.prepare("SELECT * FROM Users WHERE id = ?").bind(userId).first();
    const reservation = await env.DB.prepare("SELECT id, cast_id FROM Reservations WHERE user_id = ? AND status = 'pending'").bind(userId).first();

    if (!user) return new Response(JSON.stringify({ error: "ログインが必要です。" }), { status: 401 });

    // 今回話す相手（予約があれば予約の相手、なければ選択した相手）
    const activeCastId = reservation ? reservation.cast_id : castId;
    
    // --- チケット・セッション管理 ---
    let lastChat = null;
    let isSessionActive = false;
    
    try {
        // ★修正：チケット消費判定も「この占い師との最後の会話」で判定する
        lastChat = await env.DB.prepare("SELECT timestamp FROM ChatLogs WHERE user_id = ? AND cast_id = ? AND sender = 'ai' ORDER BY id DESC LIMIT 1").bind(userId, activeCastId).first();
    } catch (e) {
        console.error("DB Error (timestamp check):", e.message);
    }

    if (lastChat && lastChat.timestamp) {
        const lastTimeStr = lastChat.timestamp.endsWith('Z') ? lastChat.timestamp : lastChat.timestamp + 'Z';
        const lastTime = new Date(lastTimeStr).getTime();
        const now = Date.now();
        // 10分以内ならセッション継続
        if (!isNaN(lastTime) && (now - lastTime) < 10 * 60 * 1000) {
            isSessionActive = true;
        }
    }

    const ticketBalance = user.ticket_balance || 0;
    if (!reservation && !isSessionActive && ticketBalance < 1) {
      return new Response(JSON.stringify({ reply: "鑑定を受けるにはチケットが必要です。右上の「＋」からお求めください。" }));
    }

    // --- AI処理 ---
    const cast = casts[activeCastId];
    if (!cast) throw new Error("鑑定師データが見つかりません。");

    let expertKnowledge = activeCastId === 1 ? `【タロット知識】\n${JSON.stringify(tarotDataShion)}` : "";

    // 過去ログ取得
    let historyText = "";
    try {
        // ★修正：過去ログ取得時に「この占い師(cast_id)」の発言だけに絞る
        const historyData = await env.DB.prepare("SELECT sender, content FROM ChatLogs WHERE user_id = ? AND cast_id = ? ORDER BY id DESC LIMIT 10").bind(userId, activeCastId).all();
        historyText = historyData.results.reverse().map(log => {
            return `${log.sender === 'user' ? '相談者' : 'あなた'}: ${log.content}`;
        }).join("\n");
    } catch (e) {
        console.error("DB Error (history):", e.message);
    }

    // ★現在日時（2026年対応）
    const now = new Date();
    const currentDate = now.toLocaleString('ja-JP', { 
        year: 'numeric', month: 'long', day: 'numeric', 
        weekday: 'long', hour: 'numeric', minute: 'numeric',
        timeZone: 'Asia/Tokyo' 
    });

    let lastName = user.last_name;
    let firstName = user.first_name;
    if (lastName === "null" || !lastName) lastName = "";
    if (firstName === "null" || !firstName) firstName = "";
    const userName = (lastName && firstName) ? `${lastName} ${firstName} 様` : "お客様";
    const userDobInfo = user.dob ? `${user.dob}生まれ` : "生年月日不明";

    const promptText = `
あなたはチャット占い師「${cast.name}」です。AIではなく、感情を持った人間として振る舞ってください。
設定：${cast.systemPrompt}

【相談者データ】
名前：${userName}
生年月日：${userDobInfo}
※重要：相談者の生年月日は把握済みです。聞き直さないでください。

${expertKnowledge}

【現在日時】
${currentDate}
※現在は2026年です。

【あなたとの過去の会話履歴】
${historyText}
※ここには他の占い師との会話は含まれていません。

【相談者の最新の言葉】
${text}

【対話・鑑定の絶対ルール】
1. **人間味の追求**:
   - 即答で解決策を出さず、まずは「うーん…」「なるほど…」といったフィラーや共感から始めてください。
2. **文脈の維持**:
   - 過去の履歴にある内容を「さっき仰っていた〜」と引用し、記憶していることをアピールしてください。
3. **終了の判断**:
   - 相談者が満足したり話題が尽きたら、ダラダラ続けずに綺麗に締めくくってください。
   - **会話を終了すべき時は、発言の最後に必ず「[END]」という文字列を付けてください。**
4. **演出**:
   - タロット画像の出力 [CARD: ...] は、ここぞという場面でのみ行ってください。
5. **名前の呼び方**:
   - 会話の中では「${userName.replace(" 様", "")}さん」と呼んでください。もし「お客様」の場合は「お客様」と呼んでください。

以上のルールを守り、${cast.name}になりきって返答してください。`;

    // Gemini 2.5 Flash
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
    });
    
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`AI通信エラー (${response.status}): ${errText}`);
    }
    
    const data = await response.json();
    let reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) throw new Error("AIからの応答が空でした。");

    let isEnded = false;
    if (reply.includes("[END]")) {
        isEnded = true;
        reply = reply.replace("[END]", "").trim();
    }

    if (reservation) {
      await env.DB.prepare("UPDATE Reservations SET status = 'completed' WHERE id = ?").bind(reservation.id).run();
    } else if (!isSessionActive) {
      await env.DB.prepare("UPDATE Users SET ticket_balance = ticket_balance - 1 WHERE id = ?").bind(userId).run();
    }

    try {
        const nowISO = new Date().toISOString();
        // ★修正：ログ保存時に cast_id も保存する
        await env.DB.prepare("INSERT INTO ChatLogs (user_id, cast_id, sender, content, timestamp) VALUES (?, ?, 'ai', ?, ?)").bind(userId, activeCastId, reply, nowISO).run();
        await env.DB.prepare("INSERT INTO ChatLogs (user_id, cast_id, sender, content, timestamp) VALUES (?, ?, 'user', ?, ?)").bind(userId, activeCastId, text || "(...)", nowISO).run();
    } catch (e) {
        console.error("DB Log Error:", e.message);
        // DB更新前などでカラムがない場合のフォールバック（旧仕様）
        if (e.message.includes("has no column named cast_id") || e.message.includes("no such column: cast_id")) {
             await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content) VALUES (?, 'ai', ?)").bind(userId, reply).run();
             await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content) VALUES (?, 'user', ?)").bind(userId, text || "(...)").run();
        }
    }

    return new Response(JSON.stringify({ reply, isEnded }));
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
