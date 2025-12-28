import { Hono } from 'hono';
import { serveStatic } from 'hono/serve-static';
import chatHandler from './chat.js';

const app = new Hono<{ Bindings: { GEMINI_API_KEY: string } }>();

// 静的ファイルの配信設定
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
        body { font-family: sans-serif; background: #000; color: #fff; margin: 0; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
        #chat-log { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 20px; }
        .row { display: flex; gap: 10px; max-width: 90%; }
        .row.asst { align-self: flex-start; }
        .row.user { align-self: flex-end; flex-direction: row-reverse; }
        .bubble { padding: 12px 16px; border-radius: 18px; line-height: 1.5; font-size: 0.95rem; background: rgba(50, 30, 80, 0.9); border: 1px solid #7c4dff; }
        .user .bubble { background: #fff; color: #000; border: none; }
        .input-bar { padding: 15px; background: #000; display: flex; gap: 10px; border-top: 1px solid #333; }
        input { flex: 1; padding: 12px 20px; border-radius: 25px; border: none; background: #fff; color: #000; outline: none; }
        button { background: #9c27b0; color: #fff; border: none; padding: 0 25px; border-radius: 25px; cursor: pointer; font-weight: bold; }
        button:disabled { background: #444; }
      </style>
    </head>
    <body>
      <div id="chat-log"></div>
      <div class="input-bar">
        <input type="text" id="user-input" placeholder="先生に相談する..." onkeydown="if(event.key==='Enter')send()">
        <button id="send-btn" onclick="send()">送信</button>
      </div>
      <script>
        let history = [];
        async function send() {
          const inp = document.getElementById('user-input');
          const btn = document.getElementById('send-btn');
          const txt = inp.value.trim();
          if (!txt || btn.disabled) return;

          inp.value = "";
          btn.disabled = true;
          addMsg(txt, 'user');

          try {
            const res = await fetch('/chat', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ content: txt, castId: 1, history: history })
            });
            const data = await res.json();
            addMsg(data.content, 'asst');
            history.push({ role: 'user', content: txt });
            history.push({ role: 'model', content: data.content });
          } catch (e) {
            addMsg("紫苑：……おや、星の導きが途絶えたようだね。設定（APIキー）を見直しておくれ。", 'asst');
          } finally {
            btn.disabled = false;
          }
        }
        function addMsg(t, role) {
          const log = document.getElementById('chat-log');
          const div = document.createElement('div');
          div.className = 'row ' + role;
          div.innerHTML = '<div class="bubble">' + t.replace(/\\n/g, '<br>') + '</div>';
          log.appendChild(div);
          log.scrollTop = log.scrollHeight;
        }
        window.onload = () => addMsg("紫苑：よく来たね。覚悟のない者は、今のうちに立ち去るがいい。……お前さん、今日は何を迷っているんだい？", 'asst');
      </script>
    </body>
    </html>
  `);
});

// `/chat` へのリクエストを Gemini 処理（chat.js）へ飛ばす
app.post('/chat', async (c) => {
  return await chatHandler.fetch(c.req.raw, c.env);
});

export default app;
