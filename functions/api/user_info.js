import { casts } from "./lib/casts.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");

  try {
    // ユーザー情報の取得
    const user = await env.DB.prepare("SELECT * FROM Users WHERE id = ?").bind(userId).first();
    
    // 予約情報の取得（キャスト名も特定する）
    const reservation = await env.DB.prepare("SELECT cast_id, scheduled_at FROM Reservations WHERE user_id = ? AND status = 'pending'").bind(userId).first();

    let reservationInfo = null;
    if (reservation) {
        const cast = casts[reservation.cast_id];
        // 日時のフォーマット整形 (例: 2026-01-15T14:00 -> 1/15 14:00)
        const dateObj = new Date(reservation.scheduled_at);
        const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
        
        reservationInfo = {
            castName: cast ? cast.name : "不明な鑑定師",
            castImg: cast ? cast.img : "",
            timeStr: dateStr,
            scheduledAt: reservation.scheduled_at
        };
    }

    return new Response(JSON.stringify({
      lastName: user?.last_name || "",
      firstName: user?.first_name || "",
      dob: user?.dob || "",
      gender: user?.gender || "", // 性別を追加
      email: user?.email || "",
      ticket_balance: user?.ticket_balance || 0,
      reservation: reservationInfo // 予約詳細オブジェクトを追加
    }), { headers: { "Content-Type": "application/json" } });
  } catch (e) { 
    return new Response(JSON.stringify({ error: e.message }), { status: 500 }); 
  }
}
