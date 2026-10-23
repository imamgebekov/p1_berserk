// Ветер (F2): чистая логика без графики (проверяется в Node). Сила ветра медленно меняется (тишь ↔ ветерок) и иногда
// даёт порывы; направление чуть гуляет. Ветер качает кроны и траву (шейдер), шелестит листвой (звук) и сносит дым.
// Трава — пучки по всему миру, но не на тропах, в воде, домах и у препятствий.
import { pathSegs } from './world3d.js';
import { grassIn, CHUNK } from './chunks3d.js';

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
// пучки травы на весь мир — сборка из участков (рендер строит их по участкам вокруг героя, см. chunks3d.js)
export function grassSpots(map, cfg) {
  const segs = pathSegs(map), R = cfg.world.radius, n = Math.ceil(R / CHUNK), C = cfg.world.center || { x: 0, z: 0 }, i0 = Math.round(C.x / CHUNK), j0 = Math.round(C.z / CHUNK), out = [];     // вокруг центра мира (Мир 5.0)
  for (let ci = i0 - n; ci < i0 + n; ci++) for (let cj = j0 - n; cj < j0 + n; cj++) out.push(...grassIn(map, cfg, ci, cj, segs));
  return out;
}
