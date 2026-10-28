// Новые здания с входом (план «живой мир», этап 3, 2026-10-28): руины, сторожевые башни, сараи, склепы стоят на карте; не на дорогах
// и не внахлёст с домами; перед дверью свободно, с порога видно внутрь (стены не мешают); у сарая нет стены со стороны входа; сундук внутри.
import { CFG3 } from '../3d/src/config3d.js';
import { makeMap, resolve, lineBlocked, insideOf } from '../3d/src/map.js';
import { pathSegs, distSeg } from '../3d/src/world3d.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const M = makeMap(CFG3), KINDS = ['ruin', 'watch', 'barn', 'crypt_s'], NB = M.buildings.filter(b => KINDS.includes(b.kind)), segs = pathSegs(M), count = {};
for (const k of KINDS) { count[k] = NB.filter(b => b.kind === k).length; ok(count[k] >= 8, `${k}: мало (${count[k]})`); }
for (const b of NB) {
  const tag = `${b.kind}#${b.id}`;
  if (M.buildings.some(o => o !== b && o.x1 > b.x0 && o.x0 < b.x1 && o.z1 > b.z0 && o.z0 < b.z1)) fails.push(tag + ': внахлёст с домом');
  if (segs.some(([a, c]) => distSeg(b.x, b.z, a, c) < Math.min(b.w, b.d) / 2)) fails.push(tag + ': на дороге');
  const o = { x: b.door.out.x, z: b.door.out.z }; resolve(M, o, CFG3.player.radius); if (Math.hypot(o.x - b.door.out.x, o.z - b.door.out.z) > .3) fails.push(tag + ': перед дверью препятствие');
  if (b.open) { ok(b.door.open === 1 && !b.walls.some(w => Math.abs((b.door.side === 'n' || b.door.side === 's' ? (w.z0 + w.z1) / 2 : (w.x0 + w.x1) / 2) - (b.door.side === 'n' || b.door.side === 's' ? b.door.z : b.door.x)) < .5), tag + ': у сарая стена со стороны входа'); }
  else { b.door.open = 1; ok(!lineBlocked(M, b.door.out.x, b.door.out.z, (b.ix0 + b.ix1) / 2, (b.iz0 + b.iz1) / 2), tag + ': с порога не пройти внутрь'); b.door.open = 0; }
  ok(insideOf(M, (b.ix0 + b.ix1) / 2, (b.iz0 + b.iz1) / 2) === b.id, tag + ': середина не внутри');
  ok(b.chests.length >= 1, tag + ': нет сундука');
}
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.slice(0, 15).join('\n') + (fails.length > 15 ? `\n… ещё ${fails.length - 15}` : '')); process.exit(1); }
console.log('Новые здания 3D: OK (' + Object.entries(count).map(([k, v]) => `${k} ${v}`).join(', ') + ')');
