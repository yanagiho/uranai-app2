export async function onRequestPost(context) {
  try {
    const { message, castId } = await context.request.json();
    const db = context.env.DB;
    const apiKey = context.env.GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ reply: "【エラー】APIキーが設定されていません。" }), { headers: { "Content-Type": "application/json" } });
    }

    // 1. 占い師のデータを取得
    const cast = await db.prepare("SELECT * FROM Casts WHERE id = ?").bind(castId).first();
    if (!cast) {
      return new Response(JSON.stringify({ reply: "【エラー】占い師が見つかりません。" }), { headers: { "Content-Type": "application/json" } });
    }

    // 2. 最新モデル「Gemini 2.0 Flash」に送信
    const systemPrompt = cast.system_prompt;
    // リストにあった gemini-2.0-flash を使用
// リストにあった「Lite（軽量版）」のプレビューモデルを使います
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite-preview-02-05:generateContent?key=${apiKey}`;      contents: [
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

    // エラーがあれば表示（デバッグ用）
    if (data.error) {
      return new Response(JSON.stringify({ reply: `【AIエラー】Code: ${data.error.code}\nMessage: ${data.error.message}` }), { headers: { "Content-Type": "application/json" } });
    }

    // 正常な返信を取得
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "（星の言葉が届きませんでした...）";

    return new Response(JSON.stringify({ reply }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (e) {
    return new Response(JSON.stringify({ reply: `【システムエラー】${e.message}` }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
