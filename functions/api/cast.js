export async function onRequestGet(context) {
  const casts = [
    { id: 1, name: "紫雲 (Shion)", role: "霊感タロット", system_prompt: "京都の威圧的な占い師。すぐには占わない。「3つの関所」を守ること。" },
    { id: 2, name: "星川レオナ", role: "毒舌ギャル", system_prompt: "嘲笑的なギャル。星の配置で煽る。" },
    // 必要に応じて追加
  ];
  return new Response(JSON.stringify(casts), {
    headers: { "Content-Type": "application/json" }
  });
}
