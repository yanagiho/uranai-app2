import { Hono } from 'hono';
import { serveStatic } from 'hono/serve-static';
import chatHandler from './chat.js';

const app = new Hono<{ Bindings: { GEMINI_API_KEY: string } }>();

// 静的ファイルの配信
app.use('/img/*', serveStatic({ root: './public' }));

app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>鑑定ルーム - 紫苑</title>
      <style>
        body { font-family: sans-serif; background: #000; color: #fff; margin: 0; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
        #chat-log { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 15px; }
        .row { display: flex; gap: 10px; max-width: 85%; }
        .row.asst { align-self: flex-start; }
        .row.user { align-self: flex-end; flex-direction: row-reverse; }
        .bubble { padding: 12px 18px; border-radius: 20px; background: rgba(50, 30, 80, 0.8); border: 1px solid #7c4dff; line-height: 1.6; }
        .user .bubble { background: #fff; color: #000; border: none; }
        .input-bar { padding: 20px; background: #111; display: flex; gap: 10px; border-top: 1px solid #333; }
        input { flex: 1; padding: 12px 20px; border-radius: 30px; border: none; outline: none; background: #222; color: #fff; }
        button { background: #9c27b0; color: #fff; border: none; padding: 0 30px; border-radius: 30px; font-weight: bold; cursor: pointer; }
        button:disabled { background: #444; cursor: not-allowed; }
      </style>
    </head>
    <body>
      <div id="chat-log"></div>
      <div class="input-bar">
        <input type="text" id="user-input" placeholder="紫苑先生に話しかける...">
        <button id="send-btn" onclick="send()">送信</button>
      </div>
      <script>
        let history = [];
        async function send() {
          const inp = document.getElementById('user-input');
          const btn = document.getElementById('send-btn');
          const txt = inp.value.trim();
          if (!txt || btn.disabled) return;
          inp.value = ""; btn.disabled = true;
          addMsg(txt, 'user');
          try {
            const res = await fetch('/chat', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ content: txt, history: history })
            });
            const data = await res.json();
            addMsg(data.content, 'asst');
            history.push({ role: 'user', content: txt });
            history.push({ role: 'model', content: data.content });
          } catch (e) {
            addMsg("……通信が途切れたようだね。設定を見直しておくれ。", 'asst');
          } finally { btn.disabled = false; }
        }
        function addMsg(t, role) {
          const log = document.getElementById('chat-log');
          const div = document.createElement('div');
          div.className = 'row ' + role;
          div.innerHTML = '<div class="bubble">' + t.replace(/\\n/g, '<br>') + '</div>';
          log.appendChild(div);
          log.scrollTop = log.scrollHeight;
        }
        window.onload = () => addMsg("……いらっしゃい。重い顔をして、どうしたんだい？ まぁ、そこに座んなさい。", 'asst');
      </script>
    </body>
    </html>
  `);
});

// `/chat` リクエストを処理
app.post('/chat', async (c) => chatHandler.fetch(c.req.raw, c.env));

export default app;
