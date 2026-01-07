import { casts } from "./lib/casts.js";
import { tarotDataShion } from "./lib/tarot_data_shion.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY が設定されていません。");

    const { userId, castId, text } = await request.json();
    
    // --- ユーザー認証と予約確認 ---
    const user = await env.DB.prepare("SELECT * FROM Users WHERE id = ?").bind(userId).first();
    const reservation = await env.DB.prepare("SELECT id, cast_id FROM Reservations WHERE user_id = ? AND status = 'pending'").bind(userId).first();

    if (!user) return new Response(JSON.stringify({ error: "ログインが必要です。" }), { status: 401 });

    // 今回話す相手を特定
    const activeCastId = reservation ? reservation.cast_id : castId;
    const cast = casts[activeCastId];
    if (!cast) throw new Error("鑑定師データが見つかりません。");

    // --- セッション履歴の取得と分析 ---
    // 過去のログを多めに取得して、現在の会話セッションがいつ始まったかを分析します
    const logs = await env.DB.prepare(`
        SELECT * FROM ChatLogs 
        WHERE user_id = ? AND cast_id = ? 
        ORDER BY id DESC LIMIT 50
    `).bind(userId, activeCastId).all();

    // ログを古い順（時系列）に並べ替え
    const historyLogs = logs.results.reverse();

    let currentSessionLogs = [];
    let lastTime = 0;

    // 「10分以上間隔が空いたら新しいセッション」とみなして、今のセッションのログだけ抽出
    for (const log of historyLogs) {
        const logTime = new Date(log.timestamp.endsWith('Z') ? log.timestamp : log.timestamp + 'Z').getTime();
        if (lastTime > 0 && (logTime - lastTime) > 10 * 60 * 1000) {
            currentSessionLogs = []; // 間隔が空いたのでリセット
        }
        currentSessionLogs.push(log);
        lastTime = logTime;
    }

    // --- 現在の状況計算 ---
    const now = Date.now();
    let sessionStartTime = now;
    let turnCount = 0; // ユーザーの発言回数

    if (currentSessionLogs.length > 0) {
        // セッション開始時刻
        const firstLog = currentSessionLogs[0];
        sessionStartTime = new Date(firstLog.timestamp.endsWith('Z') ? firstLog.timestamp : firstLog.timestamp + 'Z').getTime();
        
        // ラリー数のカウント
        turnCount = currentSessionLogs.filter(l => l.sender === 'user').length;
    }

    const elapsedMinutes = (now - sessionStartTime) / (1000 * 60); // 経過分数
    
    // --- チケット消費判定 ---
    // 新規セッション開始時のみチケット消費
    const ticketBalance = user.ticket_balance || 0;
    if (!reservation && currentSessionLogs.length === 0 && ticketBalance < 1) {
      return new Response(JSON.stringify({ reply: "鑑定を受けるにはチケットが必要です。右上の「＋」からお求めください。" }));
    }

    // --- AIへの状況指示（ディレクション）作成 ---
    let systemDirection = "";
    let safetyInstruction = "";

    // 1. 導入パート（初回）
    if (turnCount === 0) {
        systemDirection = `
        【重要指示：導入と流れの説明】
        **まだ占いを始めないでください。**
        現在は会話の冒頭です。まずは相談者との信頼関係を築き、今後の流れを説明してください：
        1. 相談者の名前と生年月日を確認し、親しみを込めて挨拶する。
        2. 「占いの精度を高めるために、性別も教えていただけますか？」と自然に尋ねる。
        3. **「お悩みをお聞かせください。お話がまとまったら、タロットで占わせていただきますね。」と、占いの流れを明確に伝える。**
        4. いきなり長文で語らず、相手の返事を待つような短い問いかけで終えること。
        `;
        safetyInstruction = ""; 
    } 
    // 2. 時間・回数による終了制御
    else if (elapsedMinutes >= 25 || turnCount >= 10) {
        systemDirection = `
        【重要指示：鑑定終了】
        これまでの会話で、鑑定時間は終了しました。
        これ以上、新しい占いや質問への回答はしないでください。
        **「${cast.name}」らしい口調で、相談者に別れの挨拶をし、会話を締めくくってください。**
        そして、出力の最後に必ず [END] をつけてください。
        `;
    } else if (elapsedMinutes >= 20 || turnCount >= 8) {
        systemDirection = `
        【重要指示：そろそろ終了】
        鑑定時間が残りわずかです（または質問回数が上限に近づいています）。
        回答の最後に、**「${cast.name}」らしい口調で**、「そろそろお時間ですが、最後に一つだけ聞きたいことはありますか？」といった内容を付け加えて、次で終わるように誘導してください。
        まだ [END] はつけないでください。
        `;
        safetyInstruction = ""; 
    }
