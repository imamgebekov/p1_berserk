// Сказочный торговец: изредка ставит повозку у дороги вне лагеря, торгует сказочными зельями и сильными вещами, потом уезжает.
// Случайные числа — свои (W.erng): появление торговца не сдвигает поток боя и добычи.
import { CATALOG, BY_POOL } from './data/items.js';
import { TAU, len } from './util3d.js';
import { mulberry32 } from './sim.js';
import { onSurface } from './levels3d.js';
import { insideCamp, insideOf, placeAt, resolve } from './map.js';

const between = (rng, [a, b]) => a + rng() * (b - a);
const pickN = (rng, list, n) => { const a = list.slice(), out = []; while (out.length < n && a.length) out.push(a.splice(rng() * a.length | 0, 1)[0]); return out; };
const GEAR = CATALOG.filter(i => i.slot && i.rar === 3 && i.pool !== 'unique' && i.pool !== 'setunique');
const UNIQUE = CATALOG.filter(i => i.pool === 'unique' || i.pool === 'setunique');

export const erng = W => W.erng || (W.erng = W.rng === Math.random ? Math.random : mulberry32((W.cfg.world.seed || 1) * 7919 + 17));

// товар: несколько сказочных зелий и свитков, 2–3 великие вещи, иногда именная
export function wandererStock(W) {
  const C = W.cfg.wanderer, rng = erng(W), out = [];
  for (const it of pickN(rng, BY_POOL.fairy.flat(), C.fairy)) out.push({ id: it.id, n: 1 + (rng() < .5 ? 1 : 0) });
  for (const it of pickN(rng, GEAR, Math.round(between(rng, C.gear)))) out.push({ id: it.id, n: 1 });
  if (rng() < C.uniqueChance) out.push({ id: pickN(rng, UNIQUE, 1)[0].id, n: 1 });
  return out;
}

// место у дороги: вне лагеря и опасных мест, в границах мира, не в доме и не в дереве, на нужном расстоянии от героя
export function wandererSpot(W) {
  const C = W.cfg.wanderer, rng = erng(W), M = W.map, p = W.player, roads = M.roads || [], R = W.cfg.world.radius;
  for (let k = 0; k < 60; k++) {
    let x, z;
    if (roads.length && k < 40) {
      const [a, b] = roads[rng() * roads.length | 0], t = rng(), L = len(b.x - a.x, b.z - a.z) || 1, s = (rng() < .5 ? -1 : 1) * C.side;
      x = a.x + (b.x - a.x) * t - (b.z - a.z) / L * s; z = a.z + (b.z - a.z) * t + (b.x - a.x) / L * s;
    } else { const ang = rng() * TAU, d = between(rng, C.dist); x = p.x + Math.sin(ang) * d; z = p.z + Math.cos(ang) * d; }
    const d = len(x - p.x, z - p.z);
    if (d < C.dist[0] || d > C.dist[1] || len(x, z) > R - 4) continue;
    if (M.camp && insideCamp(M.camp, x, z, -C.campPad)) continue;
    const pl = placeAt(M, x, z); if (pl && pl.danger) continue;
    if (insideOf(M, x, z) >= 0 || resolve(M, { x, z }, C.r)) continue;
    return { x, z, face: rng() * TAU };
  }
  return null;
}

// таймер появления и отъезда; стоит только наверху, но время идёт и в подземелье
export function updateWanderer(W, dt) {
  const C = W.cfg.wanderer; if (!C || !C.on) return;
  const rng = erng(W);
  if (W.wandT === undefined) W.wandT = between(rng, C.first);
  const w = W.wanderer, p = W.player;
  if (w) {
    const near = onSurface(W) && !p.dead && len(p.x - w.x, p.z - w.z) < C.linger;
    if ((w.t -= dt) <= 0 && !near) { W.ev.push({ k: 'wanderLeave', x: w.x, z: w.z }); W.wanderer = null; W.wandT = between(rng, C.every); }
    return;
  }
  if ((W.wandT -= dt) > 0) return;
  const spot = onSurface(W) && !p.dead ? wandererSpot(W) : null;
  if (!spot) { W.wandT = C.retry; return; }
  W.wanderer = { ...spot, t: C.stay, stock: wandererStock(W) };
  W.ev.push({ k: 'wanderer', x: spot.x, z: spot.z });
}
// повозка твёрдая только для героя: враги и бой её не замечают
export function blockCart(W, o, r) {
  const w = W.wanderer; if (!w || !onSurface(W)) return;
  const dx = o.x - w.x, dz = o.z - w.z, d = Math.hypot(dx, dz), m = W.cfg.wanderer.r + r;
  if (d < m && d > 1e-9) { o.x = w.x + dx / d * m; o.z = w.z + dz / d * m; }
}
// герой у повозки
export const nearWanderer = W => { const w = W.wanderer, p = W.player; return !!w && onSurface(W) && !p.dead && len(p.x - w.x, p.z - w.z) < W.cfg.wanderer.reach; };
