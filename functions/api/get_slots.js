export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const castId = url.searchParams.get("castId");

  const baseTimes = ["11:00", "13:00", "15:00", "17:00", "19:00", "21:00"];

  try {
    let actualBooked = [];
    try {
      const { results } = await env.DB.prepare("SELECT scheduled_at FROM Reservations WHERE cast_id = ? AND scheduled_at LIKE ?")
        .bind(castId, `${date}%`).all();
      actualBooked = results ? results.map(r => r.scheduled_at.split('T')[1]) : [];
    } catch (e) {}

    const slots = baseTimes.map(time => {
      if (actualBooked.includes(time)) return { time, status: "booked" };
      const seed = date.replace(/-/g,'') + time.replace(':','');
      const isRandomlyBooked = (Math.abs(Math.sin(parseInt(seed)) * 10000) % 100) > 60;
      return { time, status: isRandomlyBooked ? "booked" : "available" };
    });

    // 🌟 全て満席だった場合、より雰囲気のある「お告げ」を添える
    const allFull = slots.every(s => s.status === "booked");
    const message = allFull ? "あいにく、この日の運命の糸は全て先客に結ばれております。別の日にお導きを探しましょう。" : "";

    return new Response(JSON.stringify({ slots, message }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ slots: [], message: "星々の巡りが乱れ、この日の予定が読み取れません。" }));
  }
}
