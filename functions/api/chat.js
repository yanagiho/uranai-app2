export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, castId, text } = await request.json();
    
    // 1. ユーザーと予約状況の確認 🛡️
    const user = await env.DB.prepare("SELECT last_name, first_name, dob, ticket_balance FROM Users WHERE id = ?").bind(userId).first();
    const reservation = await env.DB.prepare("SELECT id FROM Reservations WHERE user_id = ? AND status = 'pending'").bind(userId).first();

    if (!user) return new Response(JSON.stringify({ error: "ユーザーが見つかりません" }));
    
    // チケットも予約もない場合は拒否 🎟️
    if (user.ticket_balance < 1 && !reservation) {
      return new Response(JSON.stringify({ reply: "鑑定を受けるにはチケットが必要です。右上の「＋」からお求めください。" }));
    }

    // 2. 占い師設定（外部ファイル読み込みエラー回避のため内部に保持）
    const casts = {
      1: { name: "紫雲", systemPrompt: "あなたは紫雲。京都弁で話し、慈愛を持って接する霊感タロット師。一人称：私、二人称：お前さん。🌸✨" },
      2: { name: "星川レオナ", systemPrompt: "あなたは理系占星術師。ノリが軽く宇宙の絵文字（🚀⭐）を多用。一人称：私、二人称：あなた。" },
      3: { name: "琥珀", systemPrompt: "あなたは姉御肌の占い師。ズバッと言い切る。一人称：アタシ、二人称：あんた。💎" },
      4: { name: "マリア", systemPrompt: "あなたは神秘的なマリア。静謐で囁くような話し方。🕯️✨" },
      5: { name: "サナ", systemPrompt: "あなたは海辺の賢者。穏やかな口調。🌿🌊" },
      6: { name: "イツキ", systemPrompt: "あなたは知的な紳士。誠実な言葉遣い。📖🖋️" },
      7: { name: "コウヤ", systemPrompt: "あなたは硬派な神職。〜である調。⛩️⚔️" },
      8: { name: "雪音", systemPrompt: "あなたは癒やしの母。水晶占い。🔮❄️" }
    };
    const cast = casts[castId];

    // 3. プロンプト構築（Issue #26 高度化）
    const systemPrompt = `${cast.systemPrompt}
【相談者】氏名：${user.last_name} ${user.first_name} / 生年月日：${user.dob}
【鑑定の掟】
1. 導入：まずは悩みに寄り添い共感する。
2. 占断：会話が進んだら「カードを引きます」と言い、結果を伝える。
   最後に必ず [CARD: ファイル名.png] と書く（例: [CARD: major_13_death.png]）。
3. 助言：具体的なアドバイスをして結ぶ。AIであることは秘密。`;

    // 4. Gemini 2.5 Pro にリクエスト 🚀
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${env.GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: text || "（あなたの前に座りました）" }] }],
        system_instruction: { parts: [{ text: systemPrompt }] }
      })
    });
    
    const data = await response.json();
    if (!data.candidates) throw new Error(data.error?.message || "AI応答エラー");
    const reply = data.candidates[0].content.parts[0].text;

    // 鑑定が始まれば予約を完了とする
    if (reservation) {
      await env.DB.prepare("UPDATE Reservations SET status = 'completed' WHERE id = ?").bind(reservation.id).run();
    }

    return new Response(JSON.stringify({ reply }));
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
