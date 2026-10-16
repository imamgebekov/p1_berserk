// Ветер (F2): чистая логика без графики (проверяется в Node). Сила ветра медленно меняется (тишь ↔ ветерок) и иногда
// даёт порывы; направление чуть гуляет. Ветер качает кроны и траву (шейдер), шелестит листвой (звук) и сносит дым.
// Трава — пучки по всему миру, но не на тропах, в воде, домах и у препятствий.
import { mulberry32 } from './sim.js';
import { waterDist } from './terrain3d.js';
import { pathSegs, distSeg } from './world3d.js';

const smooth = t => t * t * (3 - 2 * t);
// гладкий шум по времени: значения в узлах через period с, между ними — сглаженно
function noise1(seed, t, period) {
  const x = t / period, i = Math.floor(x), f = smooth(x - i), h = k => { let a = (k * 374761393 + seed * 668265263) | 0; a = Math.imul(a ^ (a >>> 13), 1274126177); return ((a ^ (a >>> 16)) >>> 0) / 4294967296; };
  return h(i) + (h(i + 1) - h(i)) * f;
}
// ветер в момент t: s — сила 0..1, gust — доля порыва, dir — направление (единичный вектор по земле), ang — угол
export function windAt(t, C, seed = 1) {
  const base = smooth(Math.max(0, Math.min(1, (noise1(seed, t, C.period) - .3) / .45)));            // ниже порога — тишь
  const g = noise1(seed + 7, t, C.gustPeriod), gust = Math.max(0, (g - (1 - C.gustShare)) / C.gustShare) * base;
  const s = Math.min(1, C.calm + (C.breeze - C.calm) * base + C.gust * gust);
  const ang = (C.dirDeg + (noise1(seed + 13, t, C.period * 2) - .5) * C.dirWander) * Math.PI / 180;
  return { s, gust, ang, dir: [Math.sin(ang), Math.cos(ang)] };
}
// пучки травы: сетка с шагом step м со сдвигом, только где можно (не тропа, не вода, не дом, не препятствие, в мире)
export function grassSpots(map, cfg, seed = 1) {
  const G = cfg.wind.grass, R = cfg.world.radius - 2, r = mulberry32(seed * 811 + 5), segs = pathSegs(map), out = [];
  for (let x = -R; x <= R; x += G.step) for (let z = -R; z <= R; z += G.step) {
    const px = x + (r() - .5) * G.step, pz = z + (r() - .5) * G.step, s = .7 + r() * .6, rot = r() * Math.PI;
    if (Math.hypot(px, pz) > R || r() > G.fill) continue;
    if (map.river && waterDist(map.river, px, pz) < 1.2) continue;
    if (map.buildings.some(b => px > b.x0 - .5 && px < b.x1 + .5 && pz > b.z0 - .5 && pz < b.z1 + .5)) continue;
    if (map.solids.some(q => Math.hypot(q.x - px, q.z - pz) < q.r + .3)) continue;
    if (segs.some(([a, b]) => distSeg(px, pz, a, b) < 1.4)) continue;
    if (Math.hypot(px, pz) < 3) continue;                                 // у костра
    out.push({ x: px, z: pz, s, rot });
  }
  return out;
}
