// ★★★ 重要：ここにPAY.JPの「公開鍵 (pk_live_...)」を貼り付けてください ★★★
const PAYJP_PUBLIC_KEY = 'pk_live_ここにあなたの公開鍵を入力';

let userId = localStorage.getItem('fortune_user_id');
let castsData = [], currentCastId = null, selectedDate = null, selectedTime = null;
let payjp = null, elements = null, cardElement = null;
let currentPaymentItem = 1; // 1 or 10 (枚数)

window.onload = async () => {
    try {
        // PAY.JP初期化
        if (typeof Payjp !== 'undefined') {
            payjp = Payjp(PAYJP_PUBLIC_KEY);
            elements = payjp.elements();
        }

        const urlParams = new URLSearchParams(window.location.search);
        if (userId) {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });

            if (!res.ok) {
                console.error("Session check failed");
                localStorage.removeItem('fortune_user_id');
                showScreen('gateway-screen');
                return;
            }

            const data = await res.json();
            if (data.isComplete) {
                initApp();
            } else {
                showScreen('setup-screen');
            }
        } else {
            showScreen('gateway-screen');
        }
    } catch (e) {
        console.error("Init Error:", e);
        showScreen('gateway-screen');
    }
};

window.showScreen = function (id) {
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    const target = document.getElementById(id);
    if (target) target.style.display = 'flex';
    const nav = document.getElementById('main-nav');
    if (nav) nav.style.display = (['gateway-screen', 'title-screen', 'setup-screen'].includes(id)) ? 'none' : 'flex';
};

window.initApp = async function () {
    showScreen('selection-screen');
    await syncTickets();
    try {
        const cres = await fetch('/api/casts');
        castsData = await cres.json();
        document.getElementById('cast-list').innerHTML = castsData.map(c => `
            <div class="cast-card" onclick="openIntro(${c.id})"><img src="/img/${c.img}"><strong>${c.name}</strong><br><small>${c.role}</small></div>
        `).join('');
    } catch (e) { console.error(e); }
};

async function syncTickets() {
    if (!userId) return;
    try {
        const res = await fetch(`/api/user_info?userId=${userId}`);
        if (!res.ok) return;
        const data = await res.json();
        document.getElementById('nav-ticket').innerText = data.ticket_balance || 0;
        if (data.hasPendingReservation) {
            currentCastId = data.pendingCastId;
            document.getElementById('reservation-status').style.display = 'block';
        } else {
            document.getElementById('reservation-status').style.display = 'none';
        }
    } catch (e) { console.error(e); }
}

window.openIntro = function (id) {
    const cast = castsData.find(c => c.id === id);
    currentCastId = id;
    document.getElementById('modal-img').src = `/img/${cast.img}`;
    document.getElementById('modal-name').innerText = cast.name;
    document.getElementById('modal-intro').innerText = cast.intro;
    document.getElementById('cast-modal').style.display = 'flex';
    setTimeout(() => document.getElementById('cast-modal').classList.add('active'), 10);
};

window.closeModal = function () { 
    document.getElementById('cast-modal').classList.remove('active'); 
    setTimeout(() => document.getElementById('cast-modal').style.display = 'none', 300); 
};

window.goToBooking = function () {
    closeModal();
    const cast = castsData.find(c => c.id === currentCastId);
    document.getElementById('book-cast-name').innerText = cast.name + " 予約";
    const list = document.getElementById('day-list'); list.innerHTML = "";
    for (let i = 0; i < 7; i++) {
        const d = new Date(); d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        list.innerHTML += `<div class="day-tab" onclick="selectDay('${dateStr}', this)">${i === 0 ? '今日' : (d.getMonth() + 1) + '/' + d.getDate()}</div>`;
    }
    showScreen('booking-screen');
    selectDay(new Date().toISOString().split('T')[0], null);
};

window.selectDay = async function (date, el) {
    selectedDate = date;
    document.querySelectorAll('.day-tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    const res = await fetch(`/api/get_slots?castId=${currentCastId}&date=${date}`);
    const data = await res.json();
    document.getElementById('time-slots').innerHTML = data.slots.map(s => `<button class="slot-btn" ${s.status !== 'available' ? 'disabled' : ''} onclick="selectTime('${s.time}', this)">${s.time}</button>`).join('');
};

window.selectTime = function (time, el) {
    selectedTime = time;
    document.querySelectorAll('.slot-btn').forEach(b => b.style.borderColor = 'var(--gold)');
    el.style.borderColor = '#fff';
    document.getElementById('confirm-btn').style.display = 'block';
};

window.submitBooking = async function () {
    const res = await fetch('/api/reserve', { method: 'POST', body: JSON.stringify({ userId, castId: currentCastId, scheduledAt: `${selectedDate}T${selectedTime}` }) });
    const data = await res.json();
    if (data.error) return alert(data.error);
    initApp();
};

window.startChat = function () {
    closeModal();
    const currentCast = castsData.find(c => c.id === currentCastId);
    document.getElementById('chat-cast-name').innerText = currentCast?.name || "鑑定室";
    const chatBox = document.getElementById('chat-box');
    chatBox.querySelectorAll('.msg').forEach(el => el.remove());
    document.getElementById('input-area').style.display = 'flex';
    document.getElementById('end-session-area').style.display = 'none';
    document.getElementById('chat-input').value = "";
    showScreen('chat-screen');
    sendMessage("");
};

window.sendMessage = async function (manualText = null) {
    const input = document.getElementById('chat-input'), box = document.getElementById('chat-box');
    const loading = document.getElementById('loading-indicator');
    const inputArea = document.getElementById('input-area');
    const text = manualText !== null ? manualText : input.value;

    const currentCast = castsData.find(c => c.id === currentCastId);
    const loadingText = currentCast && currentCast.waitingMsg ? currentCast.waitingMsg : "星々が囁き、水晶が未来を映し出しています...";
    document.getElementById('loading-text').innerText = loadingText;

    if (text && manualText === null) {
        if (loading && loading.parentNode === box) box.insertBefore(createMsgElement(text, 'user'), loading);
        else box.appendChild(createMsgElement(text, 'user'));
        input.value = "";
    }

    box.scrollTop = box.scrollHeight;

    try {
        if (loading) loading.style.display = 'block';
        if (inputArea) inputArea.style.display = 'none';

        box.scrollTop = box.scrollHeight;

        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, castId: currentCastId, text })
        });

        if (res.status === 401) {
            alert("データが更新されました。再度ご入館ください。");
            window.logout();
            return;
        }

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: `サーバーエラー: ${res.status}` }));
            throw new Error(errorData.error || `サーバーエラー: ${res.status}`);
        }

        const data = await res.json();

        if (loading) loading.style.display = 'none';
        if (!data.isEnded && inputArea) {
            inputArea.style.display = 'flex';
        }

        if (data.error) {
            alert("エラー: " + data.error);
            if (inputArea) inputArea.style.display = 'flex';
            return;
        }

        let reply = data.reply;
        const cardMatch = reply.match(/\[CARD:\s*(.+?)\]/);
        let messageElement;
        if (cardMatch) {
            const imgHtml = `<div style="text-align:center; margin:15px 0;"><img src="/img/tarot/${cardMatch[1]}" style="width:160px; border-radius:10px; border:2px solid var(--gold); box-shadow:0 0 20px var(--gold);"></div>`;
            reply = reply.replace(cardMatch[0], "");
            messageElement = createMsgElement(reply + imgHtml, 'ai');
        } else {
            messageElement = createMsgElement(reply, 'ai');
        }

        if (loading && loading.parentNode === box) box.insertBefore(messageElement, loading);
        else box.appendChild(messageElement);

        if (data.isEnded) {
            if (inputArea) inputArea.style.display = 'none';
            document.getElementById('end-session-area').style.display = 'block';
        }

        box.scrollTop = box.scrollHeight;
        syncTickets();
    } catch (e) {
        if (loading) loading.style.display = 'none';
        if (inputArea) inputArea.style.display = 'flex';
        console.error(e);
        alert("通信エラーが発生しました: " + e.message);
    }
};

window.finishSession = function () { showScreen('selection-screen'); };

function createMsgElement(html, type) {
    const div = document.createElement('div');
    div.className = `msg ${type}`;
    div.innerHTML = html;
    return div;
}

window.validateAndRegister = async function () {
    const ln = document.getElementById('user-last-name').value, fn = document.getElementById('user-first-name').value;
    const y = document.getElementById('dob-year').value, m = document.getElementById('dob-month').value, d = document.getElementById('dob-day').value;
    if (!ln || !fn || !y || !m || !d) return alert("全て入力してください");
    const authType = localStorage.getItem('fortune_auth_type') || 'Google';
    await fetch('/api/save_user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, lastName: ln, firstName: fn, dob: `${y}-${m}-${d}`, auth_type: authType })
    });
    initApp();
};

window.openTicketModal = function () { 
    document.getElementById('ticket-modal').style.display = 'flex'; 
    setTimeout(() => document.getElementById('ticket-modal').classList.add('active'), 10); 
};

window.closeTicketModal = function () { 
    document.getElementById('ticket-modal').classList.remove('active'); 
    setTimeout(() => document.getElementById('ticket-modal').style.display = 'none', 300); 
};

// --- PAY.JP 決済処理 ---

window.openPaymentModal = function(itemType) {
    closeTicketModal();
    currentPaymentItem = itemType;
    const amount = itemType === 10 ? 27000 : 3000;
    document.getElementById('payment-amount-display').innerText = `お支払い金額: ¥${amount.toLocaleString()}`;
    document.getElementById('payment-modal').style.display = 'flex';
    
    // カード要素の作成とマウント（初回のみ）
    if (elements && !cardElement) {
        // ダークテーマ風のスタイル
        const style = {
            base: {
                color: '#32325d',
                lineHeight: '24px',
                fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
                fontSmoothing: 'antialiased',
                fontSize: '16px',
                '::placeholder': {
                    color: '#aab7c4'
                }
            },
            invalid: {
                color: '#fa755a',
                iconColor: '#fa755a'
            }
        };
        cardElement = elements.create('card', { style: style });
        cardElement.mount('#payjp-card-element');
    }
};

window.closePaymentModal = function() {
    document.getElementById('payment-modal').style.display = 'none';
    document.getElementById('payment-error').style.display = 'none';
    document.getElementById('payment-error').innerText = '';
};

window.submitPayment = function() {
    const errorDiv = document.getElementById('payment-error');
    errorDiv.style.display = 'none';
    errorDiv.innerText = '';
    
    const btn = document.getElementById('submit-payment-btn');
    btn.disabled = true;
    btn.innerText = "処理中...";

    payjp.createToken(cardElement).then(async function(r) {
        if (r.error) {
            errorDiv.innerText = r.error.message;
            errorDiv.style.display = 'block';
            btn.disabled = false;
            btn.innerText = "支払う";
            return;
        }

        // トークン取得成功 -> サーバーへ送信
        try {
            const res = await fetch('/api/purchase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: userId,
                    token: r.id,
                    item_type: currentPaymentItem
                })
            });
            const data = await res.json();
            
            if (data.success) {
                alert("決済が完了しました！チケットが付与されました。");
                closePaymentModal();
                syncTickets();
            } else {
                throw new Error(data.error || "決済に失敗しました");
            }
        } catch (e) {
            errorDiv.innerText = e.message;
            errorDiv.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.innerText = "支払う";
        }
    });
};

// --- マイページ関連 ---

window.openMyPage = async function() {
    showScreen('mypage-screen');
    if (!userId) return;

    try {
        const res = await fetch(`/api/user_info?userId=${userId}`);
        const data = await res.json();

        document.getElementById('my-last-name').value = data.lastName;
        document.getElementById('my-first-name').value = data.firstName;
        document.getElementById('my-gender').value = data.gender || "";
        
        if (data.dob) {
            const [y, m, d] = data.dob.split('-');
            document.getElementById('my-dob-year').value = y;
            document.getElementById('my-dob-month').value = m;
            document.getElementById('my-dob-day').value = d;
        }

        const resDiv = document.getElementById('mypage-reservation');
        if (data.reservation) {
            currentCastId = null; 
            resDiv.innerHTML = `
                <div style="display:flex; align-items:center; gap:15px;">
                    <img src="/img/${data.reservation.castImg}" style="width:60px; height:60px; border-radius:50%; border:2px solid var(--gold); object-fit:cover;">
                    <div>
                        <div style="font-weight:bold; color:var(--gold); font-size:1.1rem;">${data.reservation.castName}</div>
                        <div style="font-size:0.9rem;">予約日時: ${data.reservation.timeStr}</div>
                    </div>
                </div>
                <button class="main-btn" style="margin-top:15px; background:var(--accent);" onclick="startChatFromMyPage(${data.pendingCastId})">鑑定室へ入る</button>
                <p style="text-align:right; margin-top:5px; font-size:0.8rem; color:#888; cursor:pointer;" onclick="cancelReservation()">予約をキャンセル</p>
            `;
        } else {
            resDiv.innerHTML = `<p style="color:#999; text-align:center; padding:10px;">現在、予約はありません。</p>
            <button class="main-btn" style="background:#333; margin-top:10px;" onclick="showScreen('selection-screen')">鑑定師を探す</button>`;
        }

    } catch(e) {
        console.error(e);
        alert("データ取得に失敗しました");
    }
};

window.saveProfile = async function() {
    const ln = document.getElementById('my-last-name').value;
    const fn = document.getElementById('my-first-name').value;
    const y = document.getElementById('my-dob-year').value;
    const m = document.getElementById('my-dob-month').value;
    const d = document.getElementById('my-dob-day').value;
    const gender = document.getElementById('my-gender').value;

    if (!ln || !fn || !y || !m || !d) return alert("氏名と生年月日は必須です");

    try {
        const res = await fetch('/api/save_user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                userId, 
                lastName: ln, 
                firstName: fn, 
                dob: `${y}-${m}-${d}`,
                gender: gender 
            })
        });
        const data = await res.json();
        if (data.success) {
            alert("プロフィールを更新しました");
        } else {
            alert("更新エラー: " + data.error);
        }
    } catch(e) {
        alert("通信エラーが発生しました");
    }
};

window.startChatFromMyPage = function(castId) {
    if(castId) currentCastId = castId; 
    startChat(); 
};

window.cancelReservation = async function() {
    if(!confirm("予約をキャンセルしますか？（チケットは返却されます）")) return;
    try {
        const res = await fetch('/api/cancel_reservation', { 
            method: 'POST', 
            body: JSON.stringify({ userId }) 
        });
        const data = await res.json();
        if(data.success) {
            alert("予約をキャンセルしました。");
            openMyPage(); 
            syncTickets(); 
        } else {
            alert("キャンセル失敗: " + data.error);
        }
    } catch(e) {
        alert("通信エラー");
    }
};
