// Новые здания с входом (план «живой мир», этап 3, решение владельца 2026-10-28): руины домов в опасных местах, сторожевые башни
// у сёл, сараи у полей (открыты с одной стороны), склепы у кладбищ. Ставятся после генерации мира — на свободное место: не на дорогах,
// не у домов, препятствий, воды, обрывов, лагерей и входов вниз. Числа — config3d.js → map.extra. Чистая логика.
import { mulberry } from './dungeongen3d.js';
import { gridIndex } from './util3d.js';
import { distSeg } from './world3d.js';
import { riverOf, waterDist } from './terrain3d.js';
import { inCliff } from './cliffs3d.js';
import { wdist } from './geo3d.js';

const rr = (rnd, a) => a[0] + rnd() * (a[1] - a[0]);
const SIDES = ['n', 's', 'e', 'w'];
// сторона двери к точке (tx, tz)
const faceTo = (x, z, tx, tz) => (Math.abs(tx - x) > Math.abs(tz - z) ? (tx > x ? 'e' : 'w') : tz > z ? 's' : 'n');

export function placeExtras(cfg, buildings, gen) {
  const X = cfg.map.extra; if (!X || !X.on) return [];
  const M = cfg.map, rnd = mulberry((cfg.world.seed * 7351 + 91) | 0), out = [], R = cfg.world.radius, river = riverOf(cfg);
  const segs = [...(gen.roads || []).flatMap(p => p.slice(1).map((q, i) => [p[i], q])), ...(gen.paths || []).flatMap(P => P.pts.slice(1).map((q, i) => [P.pts[i], q]))];     // дороги и тропы
  const gQ = gridIndex(M.pois || [], q => [q.x, q.z, q.x, q.z]), gB = gridIndex(buildings, b => [b.x0, b.z0, b.x1, b.z1]), gN = gridIndex(out, b => [b.x - b.w / 2, b.z - b.d / 2, b.x + b.w / 2, b.z + b.d / 2]), gS = gridIndex(gen.solids, s => [s.x - s.r, s.z - s.r, s.x + s.r, s.z + s.r]), gP = gridIndex(segs, ([a, b]) => [Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z)], 32);
  const bigs = [...(M.castles || []).map(c => ({ x: c.x, z: c.z, h: 26 })), ...(M.forts || []).map(c => ({ x: c.x, z: c.z, h: (c.H || 12) + 6 })), ...(M.cities || []).map(c => ({ x: c.x, z: c.z, h: (c.H || 30) + 6 })), ...(M.citadel ? [{ x: M.citadel.x, z: M.citadel.z, h: M.citadel.H + 8 }] : []),
    ...[cfg.camp, ...(M.outposts || [])].filter(Boolean).map(c => ({ x: c.x, z: c.z, h: (c.r || 30) + 8 })), ...((cfg.dungeons && cfg.dungeons.list) || []).filter(d => d.at).map(d => ({ x: d.at.x, z: d.at.z, h: 10 }))];
  const fields = (M.zones || []).filter(z => z.type === 'farm' && z.w).map(z => ({ x0: z.x - z.w / 2, x1: z.x + z.w / 2, z0: z.z - z.d / 2, z1: z.z + z.d / 2 }));
  const free = (x, z, w, d) => { const m = X.gap, hw = w / 2 + m, hd = d / 2 + m;
    if (wdist(cfg, x, z) > R - 14) return false;
    if (gB.some(x - hw, z - hd, x + hw, z + hd, () => true) || gN.some(x - hw, z - hd, x + hw, z + hd, () => true)) return false;
    if (gS.some(x - hw, z - hd, x + hw, z + hd, s => Math.abs(s.x - x) < hw + s.r && Math.abs(s.z - z) < hd + s.r)) return false;
    if (gP.some(x - hw - X.road, z - hd - X.road, x + hw + X.road, z + hd + X.road, ([a, b]) => distSeg(x, z, a, b) < Math.max(hw, hd) + X.road)) return false;
    if (gQ.some(x - hw - 8, z - hd - 8, x + hw + 8, z + hd + 8, q => Math.abs(q.x - x) < hw + (q.r || 4) + 2 && Math.abs(q.z - z) < hd + (q.r || 4) + 2)) return false;     // не на месте интереса
    if (river && waterDist(river, x, z) < Math.max(w, d) + 3) return false;
    if (inCliff(M.plateaus, x, z, Math.max(w, d))) return false;
    if (bigs.some(q => Math.abs(q.x - x) < q.h + hw && Math.abs(q.z - z) < q.h + hd)) return false;
    if (fields.some(f => x + hw > f.x0 && x - hw < f.x1 && z + hd > f.z0 && z - hd < f.z1)) return false;
    return true; };
  // попытки у точки (cx, cz) на расстоянии r0–r1; door — к (tx, tz) или случайная
  const tryAt = (kind, S, cx, cz, r0, r1, chests, tx = cx, tz = cz, extra = {}) => {
    for (let k = 0; k < 14; k++) { const a = rnd() * Math.PI * 2, r = r0 + rnd() * (r1 - r0), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, w = Math.round(rr(rnd, S.w) * 2) / 2, d = Math.round(rr(rnd, S.d) * 2) / 2;
      if (!free(x, z, w, d)) continue;
      out.push({ x, z, w, d, door: tx === cx && tz === cz && rnd() < .5 ? SIDES[(rnd() * 4) | 0] : faceTo(x, z, tx, tz), kind, chests, ...extra }); return true; }
    return false; };
  for (const p of M.places || []) {
    if (p.type === 'danger' && rnd() < X.ruin.p) tryAt('ruin', X.ruin, p.x, p.z, p.r * .2, p.r * .8, rnd() < .5 ? ['coffer'] : ['grave']);
    else if (p.type === 'hamlet' && rnd() < X.watch.p) tryAt('watch', X.watch, p.x, p.z, p.r * 1.05, p.r * 1.5, ['rack', 'crate'], p.x, p.z);
  }
  for (const zn of M.zones || []) {
    const hw = zn.w ? zn.w / 2 : zn.r || 6, hd = zn.d ? zn.d / 2 : zn.r || 6, rad = Math.max(hw, hd);
    if (zn.type === 'farm' && rnd() < X.barn.p) tryAt('barn', X.barn, zn.x, zn.z, rad + 5, rad + 12, ['crate', 'barrel'], zn.x, zn.z, { open: true });
    else if (zn.type === 'graveyard' && rnd() < X.crypt.p) tryAt('crypt_s', X.crypt, zn.x, zn.z, rad * .3, rad + 6, ['grave'], zn.x, zn.z);
  }
  return out;
}
