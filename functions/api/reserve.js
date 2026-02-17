export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, castId } = await request.json();

    if (!userId || !castId) {
      return new Response(JSON.stringify({ error: "パラメータ不足" }), { status: 400 });
    }

    const db = env.DB;

    // 1. チケット残高確認
    const user = await db.prepare("SELECT ticket_balance FROM Users WHERE id = ?").bind(userId).first();
    
    if (!user || user.ticket_balance <= 0) {
      return new Response(JSON.stringify({ error: "チケットが足りません" }), { status: 400 });
    }

    // 2. チケット消費 & 予約（セッション）作成
    // AIなので日時は「現在時刻(now)」で登録します
    await db.batch([
      db.prepare("UPDATE Users SET ticket_balance = ticket_balance - 1 WHERE id = ?").bind(userId),
      db.prepare(`
        INSERT INTO Reservations (user_id, cast_id, scheduled_at, status) 
        VALUES (?, ?, datetime('now'), 'active')
      `).bind(userId, castId)
    ]);

    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
