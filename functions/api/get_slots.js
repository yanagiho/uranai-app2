export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const castId = url.searchParams.get("castId");

  const baseTimes = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "18:00", "19:00", "20:00", "21:00", "22:00"];

  try {
    // 実際の予約を取得
    const { results } = await env.DB.prepare("SELECT scheduled_at FROM Reservations WHERE cast_id = ? AND scheduled_at LIKE ?")
      .bind(castId, `${date}%`).all();
    const actualBooked = results ? results.map(r => r.scheduled_at.split('T')[1]) : [];

    const slots = baseTimes.map(time => {
      if (actualBooked.includes(time)) return { time, status: "booked" };
      
      // 演出：日付と時間で固定のランダムな「満席」を作る
      const seed = date.replace(/-/g,'') + time.replace(':','');
      const isRandomlyBooked = (Math.abs(Math.sin(parseInt(seed)) * 10000) % 100) > 65; // 35%の確率で満席
      
      return { time, status: isRandomlyBooked ? "booked" : "available" };
    });

    return new Response(JSON.stringify({ slots }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message, slots: [] }), { status: 200 }); // エラー時も空の配列を返して画面停止を防ぐ
  }
}
