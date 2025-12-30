export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, castId, scheduledAt } = await request.json();

    // 1. 重複予約チェックとチケット消費
    await env.DB.prepare("INSERT INTO Reservations (user_id, cast_id, scheduled_at, status) VALUES (?, ?, ?, 'pending')")
      .bind(userId, castId, scheduledAt).run();
    await env.DB.prepare("UPDATE Users SET ticket_balance = ticket_balance - 1 WHERE id = ?").bind(userId).run();

    // 2. ユーザーのメールアドレスと名前を取得
    const user = await env.DB.prepare("SELECT name, email FROM Users WHERE id = ?").bind(userId).first();
    const cast = { 1: "紫雲", 2: "星川レオナ", 3: "琥珀", 4: "マリア", 5: "サナ", 6: "イツキ", 7: "コウヤ", 8: "雪音" }[castId];

    // 3. SendGridで即座に予約確認メールを送信
    const siteUrl = env.BASE_URL || "https://uranai-app2.pages.dev";
    
    await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.SENDGRID_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: user.email }] }],
        from: { email: "info@uranai-app.dev", name: "AI占いの館" },
        subject: "【予約完了】鑑定の準備が整いました",
        content: [{
          type: "text/plain",
          value: `${user.name} 様\n\n鑑定の予約を承りました。\n\n鑑定師：${cast}\n予約日時：${scheduledAt.replace('T', ' ')}\n\nお時間になりましたら、以下のURLより鑑定室へお入りください。\n${siteUrl}\n\n心よりお待ちしております。`
        }]
      })
    });

    return new Response(JSON.stringify({ success: true }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
