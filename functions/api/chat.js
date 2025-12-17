export async function onRequestPost(context) {
  try {
    const { message, castId } = await context.request.json();
    const db = context.env.DB;
    const apiKey = context.env.GEMINI_API_KEY;

    // 1. APIキーがあるか確認
    if (!apiKey) {
      return new Response(JSON.stringify({ reply: "【エラー】設定画面で GEMINI_API_KEY が設定されていません。" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. 占い師データの取得
    const cast = await db.prepare("SELECT * FROM Casts WHERE id = ?").bind(castId).first();
    if (!cast) {
      return new Response(JSON.stringify({ reply: "【エラー】データベースに占い師が見つかりません。" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // 3. AIに送信
    const systemPrompt = cast.system_prompt;
// 最も安定している「gemini-pro」を使います
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: `あなたは「${cast.name}」として振る舞ってください。\n設定:\n${systemPrompt}\n\n相談者: ${message}` }]
        }
      ]
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    // ★重要：AIからのエラーがあれば、隠さずにそのまま表示する
    if (data.error) {
      return new Response(JSON.stringify({ reply: `【AIからのエラー報告】\nCode: ${data.error.code}\nMessage: ${data.error.message}` }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // 正常な場合
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "（AIからの応答が空でした）";

    return new Response(JSON.stringify({ reply }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (e) {
    // システムエラーも隠さず表示
    return new Response(JSON.stringify({ reply: `【システムエラー】\n${e.message}` }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}
