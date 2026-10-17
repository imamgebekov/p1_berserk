// Замер на устройстве (?bench, шаг 2 аудита): бот проходит маршрут прогулки walk3d — лагерь, мост, лес, ворота замка, берег —
// по 6 с на отрезок. Меряется настоящее время между кадрами (rAF): p50, p95, самый долгий. В конце — таблица на экране.
// Герой неуязвим, враги не появляются. Только замер: игру не сохраняет.
import { biomeAt } from './worldgen3d.js';

const q = (a, k) => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(b.length * k))] || 0; };
export async function runBench(W, cfg, input, renderer, doc = document) {
  const at = (bio, r) => { for (let a = 0; a < 6.28; a += .03) { const x = Math.sin(a) * r, z = Math.cos(a) * r; if (biomeAt(cfg, x, z) === bio) return { x, z }; } return { x: r, z: 0 }; };
  const br = W.map.river && W.map.river.bridges[0], Cs = (cfg.map.castles || [])[0], forest = at('forest', 260), coast = at('coast', 520);
  const route = [['лагерь', { x: 0, z: 8 }, { x: 0, z: -25 }]];
  if (br) route.push(['мост', { x: br.x - 12, z: br.z - 6 }, { x: br.x + 12, z: br.z + 6 }]);
  route.push(['лес', forest, { x: forest.x * 1.12, z: forest.z * 1.12 }]);
  if (Cs) route.push(['замок', { x: Cs.x, z: Cs.z + 40 }, { x: Cs.x, z: Cs.z + 2 }]);
  route.push(['берег', { x: coast.x * .92, z: coast.z * .92 }, { x: coast.x, z: coast.z }]);
  cfg.enemies.count = 0; if (cfg.enemies.roam) cfg.enemies.roam.on = false; cfg.enemies.garrison = null; if (cfg.events) cfg.events.on = false;
  const wait = ms => new Promise(r => setTimeout(r, ms)), frames = () => new Promise(r => requestAnimationFrame(r)), keep = input.read, p = W.player, rows = [];
  for (const [name, from, to] of route) {
    W.enemies = W.enemies.filter(e => e.boss); p.x = from.x; p.z = from.z; p.inv = 1e9; await wait(1200);
    const dts = []; let last = performance.now(); const t0 = last;
    input.read = () => { const d = Math.hypot(to.x - p.x, to.z - p.z), a = -cfg.view.camYaw * Math.PI / 180, wx = d > 1 ? (to.x - p.x) / d : 0, wz = d > 1 ? (to.z - p.z) / d : 0; return { mx: wx * Math.cos(a) + wz * Math.sin(a), mz: -wx * Math.sin(a) + wz * Math.cos(a), attack: false, roll: false }; };
    while (performance.now() - t0 < 6000) { await frames(); const now = performance.now(); dts.push(now - last); last = now; p.inv = 1e9; p.hp = p.maxhp; }
    input.read = keep;
    rows.push({ name, n: dts.length, fps: Math.round(dts.length / 6), p50: q(dts, .5), p95: q(dts, .95), max: Math.max(...dts) });
  }
  const look = renderer.look ? renderer.look() : {}, all = rows.map(r => r.p95), worst = Math.max(...all);
  const box = doc.createElement('div'); box.id = 'benchOut';
  box.style.cssText = 'position:fixed;inset:auto 12px 12px 12px;max-width:560px;margin:0 auto;background:#120c0bee;color:#f0e6d6;border:2px solid #3a2a26;border-radius:12px;padding:14px;font:13px/1.45 ui-monospace,Menlo,monospace;z-index:50;white-space:pre-wrap;user-select:text;-webkit-user-select:text';
  box.textContent = `Замер ?bench — ${look.retro ? 'Ретро' : 'гладкий вид'}, холст ${look.w}×${look.h}, dpr экрана ${devicePixelRatio}\n` +
    rows.map(r => `${r.name.padEnd(8)} кадр/с ${String(r.fps).padStart(3)}  p50 ${r.p50.toFixed(1)}  p95 ${r.p95.toFixed(1)}  макс ${r.max.toFixed(0)} мс`).join('\n') +
    `\nХудший p95: ${worst.toFixed(1)} мс (60 кадр/с = 16,7 мс). Скопируйте этот текст и пришлите.`;
  doc.body.appendChild(box);
  return { rows, look };
}
