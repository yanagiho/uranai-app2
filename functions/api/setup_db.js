export async function onRequest(context) {
  // ★重要：メンテナンス用に一時的に制限を解除します。
  // 本番運用時はここを return new Response(..., {status: 403}) に戻してください。
  
  const { env } = context;
  try {
    // 実行したいSQLを定義
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
        cast_id INTEGER,
        sender TEXT,
        content TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // SQLをステートメントの配列に変換
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0) // 空行を除去
      .map(s => env.DB.prepare(s)); // D1用の命令に変換

    // ★修正点：batch() を使って一括実行（これでタイムアウトを防ぎます）
    await env.DB.batch(statements);

    return new Response("✅ データベースの構造を更新しました（batch実行成功）。", {
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  } catch (err) {
    return new Response("❌ DB設定エラー: " + err.message, { status: 500 });
  }
}
