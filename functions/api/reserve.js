export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, castId, scheduledAt } = await request.json();

    // 1. 予約の保存
    await env.DB.prepare("INSERT INTO Reservations (user_id, cast_id, scheduled_at, status) VALUES (?, ?, ?, 'pending')")
      .bind(userId, castId, scheduledAt).run();
    await env.DB.prepare("UPDATE Users SET ticket_balance = ticket_balance - 1 WHERE id = ?").bind(userId).run();

    // 2. ユーザー情報の取得
    const user = await env.DB.prepare("SELECT name, email FROM Users WHERE id = ?").bind(userId).first();
    const castName = { 1: "紫雲", 2: "星川レオナ", 3: "琥珀", 4: "マリア", 5: "サナ", 6: "イツキ", 7: "コウヤ", 8: "雪音" }[castId];
    const siteUrl = env.BASE_URL || "https://uranai-app2.pages.dev";

    // 3. Resend APIでメール送信
    const resendKey = env.RESEND_API_KEY;
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "AI占いの館 <onboarding@resend.dev>", // 本番ドメイン設定後は info@yourdomain.com 等に変更
        to: [user.email],
        subject: "【予約完了】鑑定の準備が整いました",
        text: `${user.name} 様\n\n鑑定の予約を承りました。\n\n鑑定師：${castName}\n予約日時：${scheduledAt.replace('T', ' ')}\n\nお時間になりましたら、以下のURLより鑑定室へお入りください。\n${siteUrl}\n\n心よりお待ちしております。`
      })
    });

    return new Response(JSON.stringify({ success: true }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
