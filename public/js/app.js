let userId = localStorage.getItem('fortune_user_id');
let castsData = [], currentCastId = null, selectedDate = null, selectedTime = null;

window.onload = async () => {
    try {
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
            if (data.isComplete || urlParams.get('payment') === 'success') {
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

window.buyTickets = async function (amount) {
    const res = await fetch('/api/stripe_checkout', { method: 'POST', body: JSON.stringify({ userId, amount }) });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
};
