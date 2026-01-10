export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const castId = url.searchParams.get("castId");

  // ★設定：営業開始時間と終了時間
  const startHour = 11; // 11時から
  const endHour = 24;   // 24時（0時）前まで

  // 15分刻みの枠を自動生成する
  const baseTimes = [];
  for (let h = startHour; h < endHour; h++) {
    for (let m of ["00", "15", "30", "45"]) {
      baseTimes.push(`${h}:${m}`);
    }
  }

  // 日本時間(JST)を取得
  const jstNow = new Date(new Date().getTime() + (9 * 60 * 60 * 1000));
  const todayStr = jstNow.toISOString().split('T')[0];
  // 現在時刻（HH:MM）
  const currentTime = jstNow.toISOString().split('T')[1].slice(0, 5);

  try {
    // 実際の予約状況を取得
    const { results } = await env.DB.prepare("SELECT scheduled_at FROM Reservations WHERE cast_id = ? AND scheduled_at LIKE ?")
      .bind(castId, `${date}%`).all();
    const actualBooked = results ? results.map(r => r.scheduled_at.split('T')[1]) : [];

    // 擬似的に予約を埋める関数（変更なし）
    const isFakeBooked = (d, t, c) => {
       const str = d + t + c + "magic_salt"; 
       let hash = 0;
       for (let i = 0; i < str.length; i++) {
         hash = (hash << 5) - hash + str.charCodeAt(i);
         hash |= 0; 
       }
       // 20%くらいの確率で埋まっている演出にする（枠が増えたので確率は少し下げておく）
       return (Math.abs(hash) % 10) < 2; 
    };

    const slots = baseTimes.map(time => {
      // 今日かつ、現在時刻より前の枠は「past」
      if (date === todayStr && time <= currentTime) return { time, status: "past" };
      
      // 本当にDBに予約がある場合は「booked」
      if (actualBooked.includes(time)) return { time, status: "booked" };
      
      // 演出で埋まっていることにする
      if (isFakeBooked(date, time, castId)) return { time, status: "booked" };

      return { time, status: "available" };
    });

    return new Response(JSON.stringify({ slots }), { headers: { "Content-Type": "application/json" } });
  } catch (err) { return new Response(JSON.stringify({ slots: [], error: err.message })); }
}
