import { casts } from "./lib/casts.js";

export async function onRequestGet() {
  const list = Object.keys(casts).map(id => ({
    id: parseInt(id),
    name: casts[id].name,
    role: casts[id].role,
    intro: casts[id].intro,
    img: casts[id].img,
    waitingMsg: casts[id].waitingMsg // ★これを追加！
  }));

  return new Response(JSON.stringify(list), {
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
