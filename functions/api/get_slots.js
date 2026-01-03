export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const castId = url.searchParams.get("castId");

  const baseTimes = ["11:00", "13:00", "15:00", "17:00", "19:00", "21:00"];

  // 日本時間(JST)を確実に取得 🕒
  const now = new Date();
  const jstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const todayStr = jstNow.toISOString().split('T')[0];
  const currentTime = jstNow.toISOString().split('T')[1].slice(0, 5);

  try {
    const { results } = await env.DB.prepare("SELECT scheduled_at FROM Reservations WHERE cast_id = ? AND scheduled_at LIKE ?")
      .bind(castId, `${date}%`).all();
    const actualBooked = results ? results.map(r => r.scheduled_at.split('T')[1]) : [];

    const slots = baseTimes.map(time => {
      // 1. 過去の時間チェック
      if (date === todayStr && time <= currentTime) return { time, status: "past" };
      // 2. 予約済みチェック
      if (actualBooked.includes(time)) return { time, status: "booked" };
      return { time, status: "available" };
    });

    return new Response(JSON.stringify({ slots }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ slots: [], error: err.message }));
  }
}
