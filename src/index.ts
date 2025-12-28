<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>占いの館 - 紫苑</title>
    <style>
        body { font-family: sans-serif; background: #000; color: #fff; margin: 0; height: 100vh; display: flex; flex-direction: column; }
        #log { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 15px; }
        .row { display: flex; gap: 10px; max-width: 80%; }
        .row.asst { align-self: flex-start; }
        .row.user { align-self: flex-end; flex-direction: row-reverse; }
        .bubble { padding: 12px 16px; border-radius: 15px; background: #222; border: 1px solid #7c4dff; }
        .user .bubble { background: #fff; color: #000; border: none; }
        .input-bar { padding: 20px; display: flex; gap: 10px; background: #111; }
        input { flex: 1; padding: 10px; border-radius: 20px; border: none; }
        button { background: #9c27b0; color: #fff; border: none; padding: 10px 20px; border-radius: 20px; cursor: pointer; }
    </script>
</head>
<body>
    <div id="log"></div>
    <div class="input-bar">
        <input type="text" id="msg" placeholder="紫苑先生に話しかける...">
        <button onclick="send()">送信</button>
    </div>
    <script>
        let history = [];
        async function send() {
            const inp = document.getElementById('msg');
            const txt = inp.value.trim();
            if (!txt) return;
            inp.value = "";
            addMsg(txt, 'user');

            const res = await fetch('/chat', { // /functions/chat.js を呼び出す
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ content: txt, history: history })
            });
            const data = await res.json();
            addMsg(data.content, 'asst');
            history.push({ role: 'user', content: txt });
            history.push({ role: 'model', content: data.content });
        }
        function addMsg(t, r) {
            const div = document.createElement('div');
            div.className = 'row ' + r;
            div.innerHTML = '<div class="bubble">' + t + '</div>';
            document.getElementById('log').appendChild(div);
            document.getElementById('log').scrollTop = document.getElementById('log').scrollHeight;
        }
        window.onload = () => addMsg("……いらっしゃい。そこに座んなさい。今日は何を迷っているんだい？", 'asst');
    </script>
</body>
</html>
