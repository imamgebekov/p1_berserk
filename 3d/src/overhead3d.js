// Объём слоями (F4): что выше героя — арки над тропами и кроны над тропой (над воротами лагеря — своя балка частокола). Чистая логика
// размещения (проверяется в Node). Всё это только вид: не препятствия, бой и движение не меняются. Над героем такие вещи
// рисуются поверх него, а «сквозное окно» в рендере делает их полупрозрачными у героя.
import { mulberry32 } from './sim.js';
import { insideCamp } from './map.js';
import { pathSegs, distSeg } from './world3d.js';
import { waterDist } from './terrain3d.js';

import { wdist, worldSpot } from './geo3d.js';     // Мир 5.0: круг мира — от его центра
// точка и направление тропы на доле пути f (0..1)
function along(pts, f) {
  let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  let s = f * L;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], l = Math.hypot(b.x - a.x, b.z - a.z);
    if (s <= l || i === pts.length - 1) { const k = Math.min(1, s / (l || 1)); return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, ang: Math.atan2(b.x - a.x, b.z - a.z), len: L }; }
    s -= l;
  }
  return null;
}
export function overheadOf(map, cfg) {
  const O = cfg.overhead, out = { arches: [], canopy: [] };
  if (!O || !O.on) return out;
  const r = mulberry32(cfg.world.seed * 389 + 7), segs = pathSegs(map), R = cfg.world.radius;
  const inB = (x, z, pad) => map.buildings.some(b => x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad);
  const wet = (x, z, pad) => !!map.river && waterDist(map.river, x, z) < pad;
  const nearPath = (x, z, d) => segs.some(([a, b]) => distSeg(x, z, a, b) < d);
  const ok = (x, z) => wdist(cfg, x, z) < R - 3 && !inB(x, z, 1) && !wet(x, z, 1.5) && !map.solids.some(q => Math.hypot(q.x - x, q.z - z) < q.r + .6);
  // арки: на изогнутых тропах, в середине; опоры по бокам тропы — обе должны стоять свободно
  for (const P of map.paths || []) {
    if (P.pts.length < 3) continue;
    const c = along(P.pts, .5), ux = Math.cos(c.ang), uz = -Math.sin(c.ang), h = O.arch.span / 2;
    const l = { x: c.x - ux * h, z: c.z - uz * h }, rr = { x: c.x + ux * h, z: c.z + uz * h };
    if (ok(l.x, l.z) && ok(rr.x, rr.z) && !nearPath(l.x, l.z, 1.25) && !nearPath(rr.x, rr.z, 1.25)) out.arches.push({ x: c.x, z: c.z, ang: c.ang, span: O.arch.span, h: O.arch.h, kind: out.arches.length % 2 ? 'pergola' : 'stone' });
  }
  // кроны над тропой: деревья у края изогнутых троп, ствол в стороне, крона — над дорогой
  for (const P of map.paths || []) {
    if (P.pts.length < 3) continue;
    for (let f = .15; f < .9; f += O.canopy.every / Math.max(1, along(P.pts, 1).len)) {
      const c = along(P.pts, f + (r() - .5) * .04), side = r() < .5 ? -1 : 1, ux = Math.cos(c.ang) * side, uz = -Math.sin(c.ang) * side;
      const tx = c.x + ux * O.canopy.off, tz = c.z + uz * O.canopy.off;
      if (!ok(tx, tz) || nearPath(tx, tz, O.canopy.off - .2) || (map.camp && insideCamp(map.camp, tx, tz, -3))) continue;
      if (out.arches.some(a => Math.hypot(a.x - c.x, a.z - c.z) < 4)) continue;
      out.canopy.push({ x: tx, z: tz, toX: -ux, toZ: -uz, reach: O.canopy.reach, h: O.canopy.h + r() * .8 });
    }
  }
  return out;
}
