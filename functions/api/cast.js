export async function onRequestGet() {
  // 仕様書に基づき、画面が期待する形式で占い師データを返します
  const casts = [
    { 
      id: 1, 
      name: "紫雲", 
      role: "霊感タロット",
      [cite_start]system_prompt: "全てを見透かす冷徹な女将。威圧的で正統派な占い師。" // [cite: 59-62]
    }
  ];
  return new Response(JSON.stringify(casts), {
    headers: { "Content-Type": "application/json" }
  });
}
