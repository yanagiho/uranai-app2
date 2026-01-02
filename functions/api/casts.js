import { casts } from "../../src/casts.js";

export async function onRequestGet() {
  // 画面表示用に、占い師のデータを整理して送ります
  const list = Object.keys(casts).map(id => ({
    id: parseInt(id),
    name: casts[id].name,
    role: casts[id].role,
    intro: casts[id].intro,
    img: casts[id].img
  }));

  return new Response(JSON.stringify(list), {
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
