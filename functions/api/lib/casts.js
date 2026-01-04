import { casts } from "./lib/casts.js"; // 修正：内部ライブラリを参照 🚀

export async function onRequestGet() {
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
