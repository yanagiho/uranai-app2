export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const castId = url.searchParams.get("castId");

  // 基本の鑑定スケジュール（10時〜22時）
  const baseTimes = [
    "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", 
    "18:00", "19:00", "20:00", "21:00", "22:00"
  ];

  try {
    // 1. 実際にデータベースにある予約を検索
    const { results } = await env.DB.prepare(
      "SELECT scheduled_at FROM Reservations WHERE cast_id = ? AND scheduled_at LIKE ?"
    ).bind(castId, `${date}%`).all();

    const actualBookedTimes = results.map(r => r.scheduled_at.split('T')[1]);

    // 2. スロットを生成
    const slots = baseTimes.map(time => {
      // 実際に予約が入っている場合
      if (actualBookedTimes.includes(time)) return { time, status: "booked" };
      
      // 3. 人間が占ってる体裁（演出）：ランダムに40%の確率で満席にする
      // 日付と時間を混ぜて計算することで、その日その時間は常に同じ結果（満席か空きか）になるようにします
      const seed = date.replace(/-/g,'') + time.replace(':','');
      const randomValue = (Math.sin(parseInt(seed)) * 10000) % 100;
      const isRandomlyBooked = Math.abs(randomValue) > 60; 
      
      return { time, status: isRandomlyBooked ? "booked" : "available" };
    });

    return new Response(JSON.stringify({ slots }), {
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
