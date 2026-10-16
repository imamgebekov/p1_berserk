// Поиск пути по поверхности (C3c): грубый A* по сетке CELL м в рамке вокруг начала и цели. Проходимо всё, кроме воды (мосты —
// можно) и стен обрывов; ход между соседними клетками проверяется отрезком. Путь спрямляется («натягивается»). Используется,
// только когда прямую к цели перекрывает обрыв; через реку — к мосту (bridgeGoal: сетка 4 м плохо ловит узкий мост).
// Чистая логика (проверяется в Node).
import { crossesWater, waterDist, onBridge, bridgeGoal } from './terrain3d.js';
import { crossesCliff, inCliff } from './cliffs3d.js';

export const CELL = 4;
export const terrainBlocked = (map, x0, z0, x1, z1) => (!!map.river && crossesWater(map.river, x0, z0, x1, z1)) || (!!map.plateaus && map.plateaus.length > 0 && crossesCliff(map.plateaus, x0, z0, x1, z1));
const free = (map, x, z) => (!map.river || waterDist(map.river, x, z) > .6 || !!onBridge(map.river, x, z)) && !inCliff(map.plateaus, x, z, .6);
// путь от (sx, sz) к (tx, tz): массив точек (без начала) или null; pad — запас рамки, maxN — предел раскрытых клеток
export function findPath(map, sx, sz, tx, tz, pad = 40, maxN = 4000) {
  const x0 = Math.min(sx, tx) - pad, z0 = Math.min(sz, tz) - pad, W = Math.ceil((Math.max(sx, tx) + pad - x0) / CELL) + 1, H = Math.ceil((Math.max(sz, tz) + pad - z0) / CELL) + 1;
  const cx = i => x0 + i * CELL, cz = j => z0 + j * CELL, id = (i, j) => j * W + i;
  const si = Math.round((sx - x0) / CELL), sj = Math.round((sz - z0) / CELL), ti = Math.round((tx - x0) / CELL), tj = Math.round((tz - z0) / CELL);
  const g = new Float32Array(W * H).fill(Infinity), from = new Int32Array(W * H).fill(-1), shut = new Uint8Array(W * H), ok = new Int8Array(W * H);
  const pass = k => { if (!ok[k]) ok[k] = free(map, cx(k % W), cz((k / W) | 0)) ? 1 : -1; return ok[k] > 0; };
  const hq = []; const push = (k, f) => { hq.push([f, k]); let i = hq.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (hq[p][0] <= hq[i][0]) break; [hq[p], hq[i]] = [hq[i], hq[p]]; i = p; } };
  const pop = () => { const top = hq[0], last = hq.pop(); if (hq.length) { hq[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < hq.length && hq[l][0] < hq[m][0]) m = l; if (r < hq.length && hq[r][0] < hq[m][0]) m = r; if (m === i) break; [hq[m], hq[i]] = [hq[i], hq[m]]; i = m; } } return top; };
  const hEst = (i, j) => Math.hypot(i - ti, j - tj) * CELL, s0 = id(si, sj), goal = id(ti, tj);
  g[s0] = 0; push(s0, hEst(si, sj)); let n = 0, best = s0, bestH = hEst(si, sj);
  while (hq.length && n < maxN) {
    const [, k] = pop(); if (shut[k]) continue; shut[k] = 1; n++;
    if (k === goal) { best = k; bestH = 0; break; }
    const i = k % W, j = (k / W) | 0, h0 = hEst(i, j); if (h0 < bestH) { bestH = h0; best = k; }
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      if (!di && !dj) continue; const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= W || b >= H) continue;
      const q = id(a, b); if (shut[q] || !pass(q)) continue;
      const x = k === s0 ? sx : cx(i), z = k === s0 ? sz : cz(j);
      if (terrainBlocked(map, x, z, cx(a), cz(b))) continue;
      const c = g[k] + Math.hypot(di, dj) * CELL; if (c < g[q]) { g[q] = c; from[q] = k; push(q, c + hEst(a, b)); }
    }
  }
  if (bestH > CELL * 1.5) return null;                                          // цель недостижима в рамке
  const cells = []; for (let k = best; k !== s0 && k >= 0; k = from[k]) cells.push({ x: cx(k % W), z: cz((k / W) | 0) });
  cells.reverse(); if (!terrainBlocked(map, cells.length ? cells[cells.length - 1].x : sx, cells.length ? cells[cells.length - 1].z : sz, tx, tz)) cells.push({ x: tx, z: tz });
  // натянуть: из каждой точки — к самой дальней видимой
  const out = []; let cur = { x: sx, z: sz }, i = 0;
  while (i < cells.length) { let far = i; for (let k = cells.length - 1; k > i; k--) if (!terrainBlocked(map, cur.x, cur.z, cells[k].x, cells[k].z)) { far = k; break; } out.push(cells[far]); cur = cells[far]; i = far + 1; }
  return out;
}
// куда идти к цели: прямо (null), если путь свободен; иначе — следующая точка пути. Путь кэшируется в объекте o на replan с
export function pathGoal(map, o, tx, tz, dt, replan = .8) {
  if (!map.plateaus || !map.plateaus.length || !crossesCliff(map.plateaus, o.x, o.z, tx, tz)) { o.path = null; return map.river ? bridgeGoal(map.river, o.x, o.z, tx, tz) : null; }
  const P = o.path;
  if (!P || (P.t -= dt) <= 0 || Math.hypot(P.tx - tx, P.tz - tz) > 4 || !P.pts.length) o.path = { t: replan, tx, tz, pts: findPath(map, o.x, o.z, tx, tz) || [] };
  const pts = o.path.pts;
  while (pts.length && (Math.hypot(pts[0].x - o.x, pts[0].z - o.z) < 1.2 || (pts.length > 1 && !terrainBlocked(map, o.x, o.z, pts[1].x, pts[1].z)))) pts.shift();
  return pts[0] || null;
}
