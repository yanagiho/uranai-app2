// ...castsの設定はそのまま...

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const { text, history, cast_id, userProfile } = data;
    const API_KEY = env.GEMINI_API_KEY;
    const cast = casts[cast_id] || casts[1];

    // プロフィール情報。フルネームであることをAIに明示
    const userContext = `\n\n【相談者情報】氏名（フルネーム）：${userProfile.name}、生年月日：${userProfile.dob}、血液型：${userProfile.blood}。
あなたは相手のフルネームを知っています。親愛を込めて名前を呼んでください。`;

    let diviResult = "";
    if (history.length <= 1 || text.includes("占") || text.includes("見")) {
      if (cast.method === "tarot") {
        const card = tarotData[Math.floor(Math.random() * tarotData.length)];
        diviResult = `\n\n【占断】「${card.name}」を引きました。意味：${card.msg}。最後に必ず「画像：${card.img}」と書きなさい。`;
      } else {
        diviResult = `\n\n【占断】お前さんの運命、輝きを放っておりますよ。`;
      }
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
    const body = {
      contents: [
        { role: "user", parts: [{ text: cast.prompt + userContext + diviResult + "\n\n対話を開始します。" }] },
        { role: "model", parts: [{ text: "承知いたしました。フルネームから魂の響きを読み取り、鑑定を開始します。" }] },
        ...history.map(h => ({ role: h.role === "user" ? "user" : "model", parts: [{ text: h.text }] })),
        { role: "user", parts: [{ text: text }] }
      ]
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const resJson = await res.json();
    const reply = resJson.candidates[0].content.parts[0].text;

    return new Response(JSON.stringify({ reply: reply }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ reply: "(使い魔):星の導きが乱れました。" }), { status: 200 });
  }
}
