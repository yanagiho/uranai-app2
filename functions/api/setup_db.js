export async function onRequest(context) {
  const { env } = context;
  try {
    // スキーマ定義（schema.sql の内容をここに記述して実行します）
    const sql = `
      DROP TABLE IF EXISTS Users;
      CREATE TABLE Users (
        id TEXT PRIMARY KEY,
        last_name TEXT,
        first_name TEXT,
        dob TEXT,
        email TEXT,
        ticket_balance INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      DROP TABLE IF EXISTS Casts;
      CREATE TABLE Casts (
        id INTEGER PRIMARY KEY,
        name TEXT,
        role TEXT,
        systemPrompt TEXT
      );

      DROP TABLE IF EXISTS Reservations;
      CREATE TABLE Reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        cast_id INTEGER,
        scheduled_at DATETIME,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      DROP TABLE IF EXISTS ChatLogs;
      CREATE TABLE ChatLogs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        sender TEXT,
        content TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 複数のSQL文を分割して実行
    const statements = sql.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      await env.DB.prepare(stmt).run();
    }

    return new Response("データベースの初期化が完了しました（テーブル再作成）。");
  } catch (err) {
    return new Response("DB設定エラー: " + err.message, { status: 500 });
  }
}
