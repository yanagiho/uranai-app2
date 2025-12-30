export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, cast_id, text } = await request.json();

    // 🌟 時間チェックロジック 🌟
    const reservation = await env.DB.prepare(
      "SELECT scheduled_at FROM Reservations WHERE user_id = ? AND cast_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1"
    ).bind(userId, cast_id).first();

    if (!reservation) {
      return new Response(JSON.stringify({ error: "予約が見つかりません。" }));
    }

    const now = new Date();
    const reservedTime = new Date(reservation.scheduled_at);
    const diffMin = (now - reservedTime) / (1000 * 60);

    // 予約時間の前後10分以内のみ許可
    if (Math.abs(diffMin) > 10) {
      return new Response(JSON.stringify({ error: `現在は鑑定時間外です。予約時刻：${reservation.scheduled_at}` }));
    }

    // --- AI通信処理（以前の安定版モデルを使用） ---
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${env.GEMINI_API_KEY}`;
    // ...以降、AIへの送信・返信処理...
    
    return new Response(JSON.stringify({ reply: "（AIからの鑑定結果...）" }));

  } catch (err) {
    return new Response(JSON.stringify({ error: "システムエラー" }));
  }
}
