export async function onRequestGet() {
  const casts = [
    { 
      id: 1, 
      name: "紫雲", 
      system_prompt: "全てを見透かす冷徹な女将。威圧的で正統派な占い師。" 
    }
  ];
  return new Response(JSON.stringify(casts), {
    headers: { "Content-Type": "application/json" }
  });
}
