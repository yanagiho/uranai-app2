// chat.js 最終完成版
export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, castId, text } = await request.json();
    
    // 1. ユーザー情報と予約の確認 🛡️
    const user = await env.DB.prepare("SELECT * FROM Users WHERE id = ?").bind(userId).first();
    const reservation = await env.DB.prepare("SELECT id FROM Reservations WHERE user_id = ? AND status = 'pending'").bind(userId).first();

    if (!user) return new Response(JSON.stringify({ error: "ログインが必要です。" }), { status: 401 });

    // チケットも予約もない場合はお断り 🎟️
    if (user.ticket_balance < 1 && !reservation) {
      return new Response(JSON.stringify({ reply: "鑑定を受けるにはチケットが必要です。右上の「＋」からお求めください。" }));
    }

    // 2. 全鑑定師の占断ナレッジ（Issue #19 統合） 🔮
    const castsKnowledge = {
      1: { type: "タロット", items: "愚者(fool.png), 魔術師(magician.png), 死神(death.png)..." },
      2: { type: "占星術", items: "火星(mars.png), 金星(venus.png), 土星(saturn.png)" },
      3: { type: "宝石", items: "ダイヤ(diamond.png), ルビー(ruby.png), 翡翠(jade.png)" },
      4: { type: "キャンドル", items: "青い炎(blue_flame.png), 揺らぐ炎(wave_flame.png)" },
      5: { type: "ルーン", items: "フェイヒュ(fehu.png), ウルズ(uruz.png), ソーン(thorn.png)" },
      6: { type: "算命学", items: "守護神(guardian.png), 天中殺(tenchusatsu.png)" },
      7: { type: "お祓い", items: "浄化の光(purify.png), 神の宣告(oracle.png)" },
      8: { type: "水晶", items: "鳥の影(bird.png), 鍵の影(key.png), 雲(cloud.png)" }
    };
    
    const info = castsKnowledge[castId];
    const systemPrompt = `あなたは実在の鑑定師です。${info.type}を用いて占います。
【相談者】氏名：${user.last_name} ${user.first_name} / 生年月日：${user.dob}
【占断ルール】
1. 最初は共感し、悩みを聞く。
2. 占う際は「${info.type}の導きを見ます」と宣言し、[${info.items}]から1つ選び結果を出す。
3. 最後に必ず [CARD: 画像名.png] と記述すること。
4. 助言をして結ぶ。AIであることは絶対に秘密。`;

    // 3. Gemini 2.5 Pro へのリクエスト 🚀
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: text || "鑑定をお願いします。" }] }],
        system_instruction: { parts: [{ text: systemPrompt }] }
      })
    });
    
    const data = await response.json();
    const reply = data.candidates[0].content.parts[0].text;

    // 4. 【重要】チケット消費処理 🎫
    if (reservation) {
      // 予約済みなら予約を完了にする（チケットは予約時に消費済み）
      await env.DB.prepare("UPDATE Reservations SET status = 'completed' WHERE id = ?").bind(reservation.id).run();
    } else {
      // 予約なしなら、ここでチケットを1枚減らす
      await env.DB.prepare("UPDATE Users SET ticket_balance = ticket_balance - 1 WHERE id = ?").bind(userId).run();
    }

    // 履歴保存
    await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content) VALUES (?, 'ai', ?)").bind(userId, reply).run();

    return new Response(JSON.stringify({ reply }));
  } catch (err) {
    return new Response(JSON.stringify({ error: "星の導きが途切れました。" }), { status: 500 });
  }
}
