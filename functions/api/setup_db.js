export async function onRequestGet(context) {
  const { env } = context;
  try {
    await env.DB.prepare("DROP TABLE IF EXISTS Users").run();
    await env.DB.prepare("DROP TABLE IF EXISTS Reservations").run();
    await env.DB.prepare("DROP TABLE IF EXISTS ChatLogs").run();

    await env.DB.prepare(`
      CREATE TABLE Users (
        id TEXT PRIMARY KEY, 
        last_name TEXT, first_name TEXT, dob TEXT, email TEXT, auth_type TEXT, 
        ticket_balance INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (unixepoch())
      )
    `).run();

    await env.DB.prepare(`
      CREATE TABLE Reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        user_id TEXT UNIQUE, cast_id INTEGER, scheduled_at TEXT, status TEXT DEFAULT 'pending',
        created_at INTEGER DEFAULT (unixepoch())
      )
    `).run();

    await env.DB.prepare(`
      CREATE TABLE ChatLogs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT, reservation_id INTEGER, sender TEXT, content TEXT,
        created_at INTEGER DEFAULT (unixepoch())
      )
    `).run();

    return new Response(`
      <html><body style="font-family:sans-serif; text-align:center; padding-top:50px; background:#0a0510; color:#fff;">
        <h2>✨ データベース修復完了！</h2>
        <p>チケット0枚スタートの設定が完了しました。</p>
        <a href="/" style="color:#d4af37; font-weight:bold;">[ アプリに戻る ]</a>
      </body></html>
    `, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (e) { return new Response("❌ 失敗: " + e.message, { status: 500 }); }
}
