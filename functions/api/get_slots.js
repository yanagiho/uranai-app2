export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const castId = url.searchParams.get("castId");

  const baseTimes = ["11:00", "13:00", "15:00", "17:00", "19:00", "21:00"];

  // 日本時間(JST)の現在時刻を取得
  const jstNow = new Date(new Date().getTime() + (9 * 60 * 60 * 1000));
  const todayStr = jstNow.toISOString().split('T')[0];
  const currentTime = jstNow.toISOString().split('T')[1].slice(0, 5); // "HH:MM"

  try {
    let actualBooked = [];
    try {
      const { results } = await env.DB.prepare("SELECT scheduled_at FROM Reservations WHERE cast_id = ? AND scheduled_at LIKE ?")
        .bind(castId, `${date}%`).all();
      actualBooked = results ? results.map(r => r.scheduled_at.split('T')[1]) : [];
    } catch (e) {}

    const slots = baseTimes.map(time => {
      // 1. 過去の時間チェック (当日の場合のみ)
      if (date === todayStr && time < currentTime) {
        return { time, status: "past" };
      }

      // 2. 予約済みチェック (実際の予約 + 演出用のランダム予約)
      const seed = date.replace(/-/g,'') + time.replace(':','');
      const isRandomlyBooked = (Math.abs(Math.sin(parseInt(seed)) * 10000) % 100) > 60;
      
      if (actualBooked.includes(time) || isRandomlyBooked) {
        return { time, status: "booked" };
      }

      return { time, status: "available" };
    });

    const allFull = slots.every(s => s.status !== "available");
    const message = allFull ? "あいにく、この日の運命の糸は全て先客に結ばれております。" : "";

    return new Response(JSON.stringify({ slots, message }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ slots: [], message: "星々の巡りが乱れ、予定が読み取れません。" }));
  }
}
