export async function onRequestGet(context) {
  const { env } = context;
  try {
    // 1. 古い構造を一度すべて削除して更地にする
    await env.DB.prepare("DROP TABLE IF EXISTS Users").run();
    await env.DB.prepare("DROP TABLE IF EXISTS Reservations").run();
    await env.DB.prepare("DROP TABLE IF EXISTS ChatLogs").run();

    // 2. 最新の設計図（姓名・誕生日・認証・チケット0枚）で作り直す 👤
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

    // 3. 予約テーブルの作成
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

    // 4. チャット履歴テーブルの作成
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

    // 完了画面（リンク付き）
    return new Response(`
      <html><body style="font-family:sans-serif; text-align:center; padding-top:50px; background:#0a0510; color:#fff;">
        <h2 style="color:#d4af37;">✨ データベースの初期化に成功しました！</h2>
        <p>チケット0枚スタート、姓名分割、5種の認証に対応しました。</p>
        <p><a href="/" style="color:#9c27b0; font-weight:bold; font-size:1.2rem; text-decoration:none; border:2px solid #9c27b0; padding:10px 20px; border-radius:30px;">[ 占いの館に戻る ]</a></p>
      </body></html>
    `, { headers: { "Content-Type": "text/html; charset=utf-8" } });

  } catch (e) {
    return new Response("❌ 失敗: " + e.message, { status: 500 });
  }
}
