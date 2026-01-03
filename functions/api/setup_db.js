export async function onRequestGet(context) {
  const { env } = context;
  try {
    await env.DB.prepare("DROP TABLE IF EXISTS Users").run();
    await env.DB.prepare("DROP TABLE IF EXISTS Reservations").run();
    await env.DB.prepare("DROP TABLE IF EXISTS ChatLogs").run();

    // 初期チケットを 0 に変更 🎟
    await env.DB.prepare(`
      CREATE TABLE Users (
        id TEXT PRIMARY KEY, 
        last_name TEXT, 
        first_name TEXT, 
        dob TEXT, 
        email TEXT, 
        auth_type TEXT, 
        ticket_balance INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (unixepoch())
      )
    `).run();

    await env.DB.prepare(`
      CREATE TABLE Reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        user_id TEXT UNIQUE, 
        cast_id INTEGER, 
        scheduled_at TEXT, 
        status TEXT DEFAULT 'pending',
        created_at INTEGER DEFAULT (unixepoch())
      )
    `).run();

    await env.DB.prepare(`
      CREATE TABLE ChatLogs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        reservation_id INTEGER,
        sender TEXT,
        content TEXT,
        created_at INTEGER DEFAULT (unixepoch())
      )
    `).run();

    return new Response("✨ データベースの初期化（チケット0枚版）が完了しました。URLをサイトに戻してリロードしてください。");
  } catch (e) {
    return new Response("❌ 修復失敗: " + e.message, { status: 500 });
  }
}
