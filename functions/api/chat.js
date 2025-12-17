export async function onRequestPost(context) {
  try {
    const { message } = await context.request.json();
    const apiKey = context.env.GEMINI_API_KEY;

    // 1. APIキーの確認
    if (!apiKey) {
      return new Response(JSON.stringify({ reply: "【エラー】APIキーが設定されていません。" }), { headers: { "Content-Type": "application/json" } });
    }

    // 2. 「使えるモデル一覧」をGoogleに問い合わせる (ListModels)
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    
    const response = await fetch(apiUrl, {
      method: "GET", // ここはGETで問い合わせます
      headers: { "Content-Type": "application/json" }
    });

    const data = await response.json();

    // 3. エラーチェック
    if (data.error) {
      return new Response(JSON.stringify({ reply: `【診断エラー】\nCode: ${data.error.code}\nMessage: ${data.error.message}` }), { headers: { "Content-Type": "application/json" } });
    }

    // 4. モデル一覧を見やすく整形して返す
    let replyText = "【診断成功】あなたのキーで使えるモデル一覧:\n\n";
    if (data.models) {
      // "generateContent" という機能に対応しているモデルだけを抜き出す
      const validModels = data.models
        .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"))
        .map(m => m.name.replace("models/", "")); // "models/" を消して名前だけにする
      
      replyText += validModels.join("\n");
    } else {
      replyText += "（モデルが見つかりませんでした）";
    }

    replyText += "\n\n↑この中にある名前を使えば必ず動きます！";

    return new Response(JSON.stringify({ reply: replyText }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (e) {
    return new Response(JSON.stringify({ reply: `【システムエラー】\n${e.message}` }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
