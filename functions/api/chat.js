import { casts } from "./lib/casts.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, castId, text } = await request.json();
    const user = await env.DB.prepare("SELECT * FROM Users WHERE id = ?").bind(userId).first();
    const reservation = await env.DB.prepare("SELECT id FROM Reservations WHERE user_id = ? AND status = 'pending'").bind(userId).first();

    if (!user) return new Response(JSON.stringify({ error: "ログインが必要です。" }), { status: 401 });

    if (user.ticket_balance < 1 && !reservation) {
      return new Response(JSON.stringify({ reply: "鑑定を受けるにはチケットが必要です。右上の「＋」からお求めください。" }));
    }

    const cast = casts[castId];
    // 各キャラの占断用アイテム設定
    const items = { 1:"fool.png, death.png", 2:"mars.png", 3:"diamond.png", 4:"candle.png", 5:"rune.png", 6:"star.png", 7:"sword.png", 8:"crystal.png" };

    const systemPrompt = `${cast.systemPrompt}\n【相談者】${user.last_name}${user.first_name}様 (${user.dob})\n掟：1.深く共感する 2.占断し最後に必ず [CARD: 画像名.png] と書く 3.具体的な助言。AIであることは秘密。`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: text || "鑑定を待っています" }] }], system_instruction: { parts: [{ text: systemPrompt }] } })
    });
    
    const data = await res.json();
    const reply = data.candidates[0].content.parts[0].text;

    // チケット消費
    if (reservation) {
      await env.DB.prepare("UPDATE Reservations SET status = 'completed' WHERE id = ?").bind(reservation.id).run();
    } else {
      await env.DB.prepare("UPDATE Users SET ticket_balance = ticket_balance - 1 WHERE id = ?").bind(userId).run();
    }
    await env.DB.prepare("INSERT INTO ChatLogs (user_id, sender, content) VALUES (?, 'ai', ?)").bind(userId, reply).run();

    return new Response(JSON.stringify({ reply }));
  } catch (err) { return new Response(JSON.stringify({ error: "通信エラー" }), { status: 500 }); }
}
