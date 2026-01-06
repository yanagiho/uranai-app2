export async function callGemini(apiKey, promptText) {
    // 🚀 本番用モデル: Gemini 2.5 Flash
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
    });

    if (!response.ok) {
        const errText = await response.text();
        console.error("Gemini API Error:", errText);
        throw new Error(`AI通信エラー (${response.status}): ${errText}`);
    }

    const data = await response.json();
    let reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) throw new Error("AIからの応答が空でした。");

    return reply;
}
