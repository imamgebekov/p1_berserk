// Рыбалка (2026-11-13, как в WoW): у любой воды (озеро, ручей, река) с удочкой в сумке — «Рыбачить»: заброс, ожидание, «Клюёт!», подсечка в окно window секунд.
// Улов — по таблице fish.catch (рыба для еды, редкая золотая, мусор). Шаг — раз в кадр симуляции; случайность — W.rng. Чистая логика (проверяется в Node).
import { waterDist, streamDist } from './terrain3d.js';
import { BY_ID } from './data/items.js';
import { countOf, addItem } from './inv.js';

const DIRS = 16;
const C = W => W.cfg.fish;
export const fishState = W => W.fish || (W.fish = { s: 'idle', t: 0, bite: 0, spot: null, cd: 0 });
const wd = (W, x, z) => { const rv = W.map.river; if (!rv) return 1e3; return Math.min(waterDist(rv, x, z), rv.streams && rv.streams.length ? streamDist(rv, x, z) : 1e3); };
export const hasRod = W => countOf(W.inv, C(W).rod) > 0;
// куда забросить: в сторону взгляда ближайшая вода в пределах cast м; null — воды рядом нет (только на поверхности)
export function waterSpot(W) {
  const K = C(W), p = W.player; if (!K || !K.on || W.lvl !== 'surface' || !W.map.river) return null;
  let best = null, bs = 1e9;
  for (let i = 0; i < DIRS; i++) { const a = p.face + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (Math.PI * 2 / DIRS);
    for (const r of [K.cast * .5, K.cast * .75, K.cast]) { const x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r; if (wd(W, x, z) < -.3) { const sc = Math.abs(Math.atan2(Math.sin(a - p.face), Math.cos(a - p.face))) * 2 + r * .15; if (sc < bs) { bs = sc; best = { x, z }; } break; } } }
  return best;
}
export const fishNear = W => !!waterSpot(W);
function roll(W) {
  const K = C(W), T = K.catch; let tot = 0; for (const [, w] of T) tot += w; let r = W.rng() * tot;
  for (const [id, w] of T) { r -= w; if (r <= 0) return id; } return T[0][0];
}
// 'ok' | 'norod' | 'nowater' | 'busy'
export function startFish(W) {
  const K = C(W); if (!K || !K.on) return 'nowater'; const S = fishState(W); if (S.s !== 'idle' || S.cd > 0) return 'busy';
  if (!hasRod(W)) return 'norod'; const spot = waterSpot(W); if (!spot) return 'nowater';
  Object.assign(S, { s: 'wait', t: 0, bite: K.wait[0] + W.rng() * (K.wait[1] - K.wait[0]), spot, from: { x: W.player.x, z: W.player.z } });
  W.ev.push({ k: 'fishcast', x: spot.x, z: spot.z }); return 'ok';
}
// подсечь: в окне поклёвки — улов; раньше — «рано», поплавок остаётся; 'idle' — не удят
export function hook(W) {
  const K = C(W), S = fishState(W);
  if (S.s === 'bite') { const id = roll(W), it = BY_ID[id]; const left = addItem(W.inv, id, 1, W.cfg.bag.slots + ((W.gear && W.gear.bag) || 0) + (W.bagX || 0) * (W.cfg.bag.extra || 0) + 20);
    if (left > 0) W.drops.push({ id, n: 1, x: W.player.x + 1, z: W.player.z, t: 0, cd: 0 });
    if (it) W.known.items[id] = 1; W.ev.push({ k: 'fishcatch', id, x: S.spot.x, z: S.spot.z, rare: !!(it && it.rar >= 3), junk: !!(K.junk || []).includes(id) }); W.fishCaught = (W.fishCaught || 0) + ((K.junk || []).includes(id) ? 0 : 1);
    Object.assign(S, { s: 'idle', cd: K.cd }); return 'catch'; }
  if (S.s === 'wait') { W.ev.push({ k: 'fishlost', why: 'early', x: S.spot.x, z: S.spot.z }); Object.assign(S, { s: 'idle', cd: K.cd }); return 'early'; }
  return 'idle';
}
export function cancelFish(W) { const S = fishState(W); if (S.s !== 'idle') { Object.assign(S, { s: 'idle', cd: .3 }); W.ev.push({ k: 'fishlost', why: 'moved' }); } }
export function tickFish(W, dt) {
  const K = C(W), S = W.fish; if (!K || !K.on || !S) return; if (S.cd > 0) S.cd -= dt; if (S.s === 'idle') return;
  const p = W.player; if (p.dead || W.lvl !== 'surface' || Math.hypot(p.x - S.from.x, p.z - S.from.z) > K.leash || p.state === 'atk' || p.state === 'roll') { cancelFish(W); return; }
  S.t += dt;
  if (S.s === 'wait' && S.t >= S.bite) { S.s = 'bite'; S.t = 0; W.ev.push({ k: 'fishbite', x: S.spot.x, z: S.spot.z }); }
  else if (S.s === 'bite' && S.t >= K.window) { W.ev.push({ k: 'fishlost', why: 'late', x: S.spot.x, z: S.spot.z }); Object.assign(S, { s: 'idle', cd: K.cd }); }
}
