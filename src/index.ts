import { Hono } from 'hono';
import { Ai } from '@cloudflare/ai';

const app = new Hono<{ Bindings: { AI: any, ASSETS: any } }>();

// ★ Geminiが作成したキャスト（占い師）データをここに完全に復元・統合しました
const CAST_DATA: any = {
  "shiun":  { name: "紫雲", img: "/img/shiun.png", prompt: "古都京都の雅な占い師。はんなりとした京都弁で。100文字以内。" },
  "leona":  { name: "レオナ", img: "/img/leona.png", prompt: "ギャル占い師。タメ口で明るく。100文字以内。" },
  "koya":   { name: "煌夜", img: "/img/koya.png", prompt: "ミステリアスなホスト占い師。セクシーな口調。100文字以内。" },
  "kohaku": { name: "琥珀", img: "/img/kohaku.png", prompt: "無邪気な少年占い師。可愛らしい口調。100文字以内。" },
  "sana":   { name: "サナ", img: "/img/sana.png", prompt: "依存的で少し不安げな占い師。寄り添う口調。100文字以内。" },
  "maria":  { name: "マリア", img: "/img/maria.png", prompt: "古の魔女。神秘的で不気味な口調。100文字以内。" },
  "yukine": { name: "雪音", img: "/img/yukine.png", prompt: "穏やかな夢診断師。丁寧な言葉遣い。100文字以内。" },
  "itsuki": { name: "イツキ", img: "/img/itsuki.png", prompt: "完璧な執事占い師。品のある口調。100文字以内。" }
};

app.get('/', (c) => {
  const currentKey = "shiun"; // 予約した紫雲先生に直行する設定
  const char = CAST_DATA[currentKey];

  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>鑑定ルーム - ${char.name}</title>
      <style>
        body { font-family: sans-serif; background: #000; color: #fff; margin: 0; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
        #room-bg { position: absolute; width: 100%; height: 100%; background: url('${char.img}') center/cover; filter: brightness(0.2) blur(10px); z-index: -1; }
        .header { display: flex; align-items: center; padding: 15px; background: rgba(0,0,0,0.8); border-bottom: 1px solid #444; }
        .h-icon { width: 45px; height: 45px; border-radius: 50%; background: url('${char.img}') center/cover; border: 2px solid #9c27b0; margin-right: 12px; }
        #chat-log { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 20px; }
        .row { display: flex; gap: 10px; max-width: 90%; }
        .row.asst { align-self: flex-start; }
        .row.user { align-self: flex-end; flex-direction: row-reverse; }
        .icon-circle { width: 44px; height: 44px; border-radius: 50%; background-size: cover; background-position: center; border: 2px solid #9c27b0; flex-shrink: 0; }
        .name-label { font-size: 0.75rem; color: #aaa; margin-bottom: 4px; display: block; }
        .user .name-label { text-align: right; }
        .bubble { padding: 12px 16px; border-radius: 18px; line-height: 1.5; font-size: 0.95rem; }
        .asst .bubble { background: rgba(50, 30, 80, 0.9); border: 1px solid #7c4dff; }
        .user .bubble { background: #fff; color: #000; }
        .input-bar { padding: 15px; background: #000; display: flex; gap: 10px; border-top: 1px solid #333; }
        input { flex: 1; padding: 12px 20px; border-radius: 25px; border: none; outline: none; background: #fff; color: #000; }
        button { background: #9c27b0; color: #fff; border: none; padding: 0 25px; border-radius: 25px; font-weight: bold; cursor: pointer; }
      </style>
    </head>
    <body>
      <div id="room-bg"></div>
      <div class="header">
        <div class="h-icon"></div>
        <div style="font-weight:bold;">${char.name} の鑑定室</div>
      </div>
      <div id="chat-log"></div>
      <div class="input-bar">
        <input type="text" id="user-input" placeholder="先生に相談する..." onkeydown="if(event.key==='Enter'&&!busy)send()">
        <button id="send-btn" onclick="send()">送信</button>
      </div>
      <script>
        const CHAR = ${JSON.stringify(char)};
        let busy = false;
        const log = document.getElementById('chat-log');

        function addMsg(t, role) {
          const div = document.createElement('div');
          div.className = 'row ' + role;
          if (role === 'asst') {
            div.innerHTML = '<div class="icon-circle" style="background-image:url('+CHAR.img+')"></div>' +
                            '<div><span class="name-label">'+CHAR.name+'</span><div class="bubble">' + t + '</div></div>';
          } else {
            div.innerHTML = '<div><span class="name-label">You</span><div class="bubble">' + t + '</div></div>';
          }
          log.appendChild(div);
          log.scrollTop = log.scrollHeight;
        }

        async function send() {
          const inp = document.getElementById('user-input');
          const txt = inp.value.trim();
          if (!txt || busy) return;
          busy = true; inp.value = "";
          addMsg(txt, 'user');
          try {
            const res = await fetch('/chat', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ content: txt, charId: 'shiun' })
            });
            const data = await res.json();
            addMsg(data.content, 'asst');
          } finally { busy = false; }
        }

        window.onload = () => addMsg(CHAR.name + "です。お待ちしておりました。何でもお話しくださいね。", 'asst');
      </script>
    </body>
    </html>
  `);
});

app.post('/chat', async (c) => {
  const { content, charId } = await c.req.json();
  const char = CAST_DATA[charId];
  const ai = new Ai(c.env.AI);
  const res = await ai.run('@cf/meta/llama-3-8b-instruct', {
    messages: [
      { role: 'system', content: "あなたは占い師「" + char.name + "」です。" + char.prompt + " 必ず日本語で回答してください。" },
      { role: 'user', content: content }
    ]
  });
  return c.json({ content: res.response });
});

export default app;