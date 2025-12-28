import { Hono } from 'hono';
import { serveStatic } from 'hono/serve-static';

const app = new Hono<{ Bindings: { GEMINI_API_KEY: string } }>();

// 画像などを表示するための設定
app.use('/img/*', serveStatic({ root: './' }));

// 占い師の基本データ（画面表示用）
const CAST_DATA: any = {
  "1": { name: "紫苑", img: "/img/shiun.png" },
  "2": { name: "レオナ", img: "/img/leona.png" },
  "3": { name: "煌夜", img: "/img/koya.png" },
  "4": { name: "琥珀", img: "/img/kohaku.png" },
  "5": { name: "サナ", img: "/img/sana.png" },
  "6": { name: "マリア", img: "/img/maria.png" },
  "7": { name: "雪音", img: "/img/yukine.png" },
  "8": { name: "イツキ", img: "/img/itsuki.png" }
};

// メイン画面（HTML）
app.get('/', (c) => {
  const char = CAST_DATA["1"]; // 最初は紫苑を表示

  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>鑑定ルーム - \${char.name}</title>
      <style>
        body { font-family: sans-serif; background: #000; color: #fff; margin: 0; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
        #chat-log { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 20px; }
        .row { display: flex; gap: 10px; max-width: 90%; }
        .row.asst { align-self: flex-start; }
        .row.user { align-self: flex-end; flex-direction: row-reverse; }
        .bubble { padding: 12px 16px; border-radius: 18px; line-height: 1.5; font-size: 0.95rem; background: rgba(50, 30, 80, 0.9); border: 1px solid #7c4dff; }
        .user .bubble { background: #fff; color: #000; border: none; }
        .input-bar { padding: 15px; background: #000; display: flex; gap: 10px; border-top: 1px solid #333; }
        input { flex: 1; padding: 12px 20px; border-radius: 25px; border: none; background: #fff; }
        button { background: #9c27b0; color: #fff; border: none; padding: 0 25px; border-radius: 25px; cursor: pointer; font-weight: bold; }
      </style>
    </head>
    <body>
      <div id="chat-log"></div>
      <div class="input-bar">
        <input type="text" id="user-input" placeholder="先生に相談する...">
        <button onclick="send()">送信</button>
      </div>
      <script>
        let history = [];
        async function send() {
          const inp = document.getElementById('user-input');
          const txt = inp.value.trim();
          if (!txt) return;
          inp.value = "";
          addMsg(txt, 'user');

          const res = await fetch('/chat', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ content: txt, castId: "1", history: history })
          });
          const data = await res.json();
          addMsg(data.content, 'asst');
          history.push({ role: 'user', content: txt });
          history.push({ role: 'model', content: data.content });
        }
        function addMsg(t, role) {
          const log = document.getElementById('chat-log');
          const div = document.createElement('div');
          div.className = 'row ' + role;
          div.innerHTML = '<div class="bubble">' + t + '</div>';
          log.appendChild(div);
          log.scrollTop = log.scrollHeight;
        }
        window.onload = () => addMsg("紫苑です。覚悟のない方はお引き取りください。", 'asst');
      </script>
    </body>
    </html>
  `);
});

// Geminiを呼び出すルート
import chatHandler from './chat.js';
app.post('/chat', (c) => chatHandler.fetch(c.req.raw, c.env));

export default app;
