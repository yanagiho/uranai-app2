export async function onRequest(context) {
  try {
    // Usersテーブルに gender カラムを追加
    await context.env.DB.prepare("ALTER TABLE Users ADD COLUMN gender TEXT").run();
    return new Response("✅ データベース更新成功：genderカラムを追加しました。");
  } catch (e) {
    if (e.message.includes("duplicate column name")) {
      return new Response("ℹ️ すでに更新済みです（genderカラムは存在します）。");
    }
    return new Response("❌ エラー: " + e.message, { status: 500 });
  }
}
