export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const castId = url.searchParams.get("castId");
  const baseTimes = ["11:00", "13:00", "15:00", "17:00", "19:00", "21:00"];

  // 日本時間(JST)を取得 🕒
  const jstNow = new Date(new Date().getTime() + (9 * 60 * 60 * 1000));
  const todayStr = jstNow.toISOString().split('T')[0];
  const currentTime = jstNow.toISOString().split('T')[1].slice(0, 5);

  try {
    const { results } = await env.DB.prepare("SELECT scheduled_at FROM Reservations WHERE cast_id = ? AND scheduled_at LIKE ?")
      .bind(castId, `${date}%`).all();
    const actualBooked = results ? results.map(r => r.scheduled_at.split('T')[1]) : [];

    // ★追加: 擬似的に予約を埋めるための関数（リロードしても結果が変わらないように計算で出す）
    const isFakeBooked = (d, t, c) => {
       // 日付+時間+キャストIDの文字列からハッシュ値を生成
       const str = d + t + c + "magic_salt"; 
       let hash = 0;
       for (let i = 0; i < str.length; i++) {
         hash = (hash << 5) - hash + str.charCodeAt(i);
         hash |= 0; 
       }
       // 30%の確率で「予約済み(booked)」とみなす (数字を変えれば埋まり率を調整可能)
       return (Math.abs(hash) % 10) < 3; 
    };

    const slots = baseTimes.map(time => {
      // 過去の時間は「past」
      if (date === todayStr && time <= currentTime) return { time, status: "past" };
      
      // 本当にDBに予約がある場合は「booked」
      if (actualBooked.includes(time)) return { time, status: "booked" };
      
      // ★追加: 擬似的な予約判定に引っかかったら「booked」にする
      if (isFakeBooked(date, time, castId)) return { time, status: "booked" };

      return { time, status: "available" };
    });

    return new Response(JSON.stringify({ slots }), { headers: { "Content-Type": "application/json" } });
  } catch (err) { return new Response(JSON.stringify({ slots: [], error: err.message })); }
}
