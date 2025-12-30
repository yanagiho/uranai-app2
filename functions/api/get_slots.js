export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const castId = url.searchParams.get("castId");

  // 標準的な鑑定時間（11時〜22時）
  const baseTimes = ["11:00", "13:00", "15:00", "17:00", "19:00", "21:00"];

  try {
    // データベースから実際の予約を取得（エラーが起きても止まらないようにする）
    let actualBooked = [];
    try {
      const { results } = await env.DB.prepare("SELECT scheduled_at FROM Reservations WHERE cast_id = ? AND scheduled_at LIKE ?")
        .bind(castId, `${date}%`).all();
      actualBooked = results ? results.map(r => r.scheduled_at.split('T')[1]) : [];
    } catch (e) {
      console.log("DB Table not found yet, skipping actual check");
    }

    const slots = baseTimes.map(time => {
      if (actualBooked.includes(time)) return { time, status: "booked" };
      
      // 人間が占ってる体裁：日付と時間で計算して、40%の確率で「満席」にする演出
      const seed = date.replace(/-/g,'') + time.replace(':','');
      const isRandomlyBooked = (Math.abs(Math.sin(parseInt(seed)) * 10000) % 100) > 60;
      
      return { time, status: isRandomlyBooked ? "booked" : "available" };
    });

    return new Response(JSON.stringify({ slots }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    // 最悪の場合でも、最低限の枠を表示させる（画面を止めない）
    return new Response(JSON.stringify({ slots: baseTimes.map(t => ({time: t, status: "available"})) }), { headers: { "Content-Type": "application/json" } });
  }
}
