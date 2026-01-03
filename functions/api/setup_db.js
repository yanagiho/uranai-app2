export async function onRequestGet(context) {
  const { env } = context;
  try {
    // 1. 古いテーブルを削除
    await env.DB.prepare("DROP TABLE IF EXISTS Users").run();
    await env.DB.prepare("DROP TABLE IF EXISTS Reservations").run();
    await env.DB.prepare("DROP TABLE IF EXISTS ChatLogs").run();

    // 2. 最新の構造（姓名分割・チケット・認証対応）で作成 👤
    await env.DB.prepare(`
      CREATE TABLE Users (
        id TEXT PRIMARY KEY, 
        last_name TEXT, 
        first_name TEXT, 
        dob TEXT, 
        email TEXT, 
        auth_type TEXT, 
        ticket_balance INTEGER DEFAULT 10,
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

    return new Response("✨ データベースの自動修復が完了しました！サイトに戻ってリロードしてください。");
  } catch (e) {
    return new Response("❌ 修復失敗: " + e.message, { status: 500 });
  }
}
