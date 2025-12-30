export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const castId = url.searchParams.get("castId");

  // 基本の鑑定時間（10:00〜22:00まで30分刻み）
  const times = [
    "10:00", "10:30", "11:00", "11:30", "13:00", "13:30", 
    "14:00", "14:30", "15:00", "15:30", "18:00", "18:30", 
    "19:00", "19:30", "20:00", "20:30", "21:00", "21:30"
  ];

  try {
    // 実際にDBに入っている予約を取得
    const { results } = await env.DB.prepare(
      "SELECT scheduled_at FROM Reservations WHERE cast_id = ? AND scheduled_at LIKE ?"
    ).bind(castId, `${date}%`).all();

    const bookedTimes = results.map(r => r.scheduled_at.split('T')[1]);

    const slots = times.map(t => {
      // 1. 実際に予約が入っているかチェック
      if (bookedTimes.includes(t)) return { time: t, status: "booked" };
      
      // 2. 「人間らしさ」の演出として、30%の確率でランダムに埋める（他のお客さん役）
      const randomSeed = Math.sin(parseInt(date.replace(/-/g,'')) + parseInt(t.replace(':',''))) * 10000;
      const isRandomlyBooked = (Math.abs(randomSeed) % 100) < 30;
      
      return { time: t, status: isRandomlyBooked ? "booked" : "available" };
    });

    return new Response(JSON.stringify({ slots }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
