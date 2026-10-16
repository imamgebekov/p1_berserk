// Тест троп и округлых форм 3D (шаг F1): каждая дорога — тропа с теми же концами; за лагерем длинные тропы изгибаются,
// плавно, не заходят в дома, воду и лагерь; повторяемость по зерну; выключено — все прямые; деревья не растут на тропе;
// кроны и камни — округлые многогранники, сливаются с кубиками в один меш.
import { CFG3 } from '../3d/src/config3d.js';
import { makeMap, insideCamp, propsBlocked } from '../3d/src/map.js';
import { pathSegs } from '../3d/src/world3d.js';
import { waterDist } from '../3d/src/terrain3d.js';
import { addTree, addRock } from '../3d/src/models.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const clone = () => JSON.parse(JSON.stringify(CFG3));
const map = makeMap(CFG3), P = CFG3.paths;

// ---------- 1. тропы ----------
ok(map.paths.length === map.roads.length, 'троп не столько, сколько дорог');
ok(map.paths.every((p, i) => p.leg === map.roads[i] && p.pts[0] === p.leg[0] && p.pts[p.pts.length - 1] === p.leg[1]), 'концы тропы не совпадают с дорогой');
const curved = map.paths.filter(p => p.pts.length > 2);
ok(curved.length >= 4, 'изогнутых троп мало: ' + curved.length);
for (const p of curved) {
  const [a, b] = p.leg, L = Math.hypot(b.x - a.x, b.z - a.z), nx = -(b.z - a.z) / L, nz = (b.x - a.x) / L;
  let dev = 0, turn = 0, len = 0;
  p.pts.forEach((q, i) => {
    dev = Math.max(dev, Math.abs((q.x - a.x) * nx + (q.z - a.z) * nz));
    if (i) len += Math.hypot(q.x - p.pts[i - 1].x, q.z - p.pts[i - 1].z);
    if (i > 1) { const u = Math.atan2(q.x - p.pts[i - 1].x, q.z - p.pts[i - 1].z), v = Math.atan2(p.pts[i - 1].x - p.pts[i - 2].x, p.pts[i - 1].z - p.pts[i - 2].z); let d = Math.abs(u - v); if (d > Math.PI) d = 2 * Math.PI - d; turn = Math.max(turn, d); }
    const end = Math.min(i, p.pts.length - 1 - i) * (L / (p.pts.length - 1)) < 3;     // у двери и ворот не проверяем
    if (!end) {
      ok(!map.buildings.some(B => q.x > B.x0 - 1.2 && q.x < B.x1 + 1.2 && q.z > B.z0 - 1.2 && q.z < B.z1 + 1.2), 'тропа через дом');
      ok(waterDist(map.river, q.x, q.z) > 2.5, 'тропа в воде');
      ok(!insideCamp(map.camp, q.x, q.z, -2), 'тропа через лагерь');
    }
  });
  ok(dev >= .9, `тропа почти прямая: отклонение ${dev.toFixed(2)} м`);
  ok(dev <= P.bend[1] + P.wave + .01, `тропа изогнута сильнее нормы: ${dev.toFixed(2)} м`);
  ok(turn < .6, `тропа ломается под углом ${(turn * 180 / Math.PI).toFixed(0)}°`);
}
ok(JSON.stringify(makeMap(CFG3).paths.map(p => p.pts)) === JSON.stringify(map.paths.map(p => p.pts)), 'тропы не повторяются по зерну');
{ const c = clone(); c.paths.on = false; ok(makeMap(c).paths.every(p => p.pts.length === 2), 'выключенные тропы не прямые'); }
ok(pathSegs(map).length === map.paths.reduce((s, p) => s + p.pts.length - 1, 0), 'отрезки троп посчитаны неверно');
for (const p of curved) { const q = p.pts[p.pts.length >> 1]; ok(propsBlocked(map, q.x, q.z), 'на изогнутой тропе можно растить деревья'); }
// мир вокруг не сдвинулся: декор, сундуки и препятствия те же, что при прямых дорогах (свой генератор у троп)
{ const c = clone(); c.paths.on = false; const m2 = makeMap(c);
  ok(JSON.stringify(m2.containers.map(q => [q.x, q.z])) === JSON.stringify(map.containers.map(q => [q.x, q.z])) && JSON.stringify(m2.solids) === JSON.stringify(map.solids), 'тропы сдвинули сундуки или препятствия'); }

// ---------- 2. округлые формы ----------
{ let s = 1; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const parts = []; for (let i = 0; i < 12; i++) { addTree(parts, rnd, i * 3, 0, CFG3.look); addRock(parts, rnd, i * 3, 5, CFG3.look); }
  const blobs = parts.filter(g => g.type !== 'BoxGeometry');
  ok(blobs.length > 20, 'кроны и камни всё ещё кубы: ' + blobs.length);
  let merged = null; try { merged = mergeGeometries(parts, false); } catch (e) { merged = null; }
  ok(merged && merged.attributes.position.count > 0, 'округлые формы не сливаются с кубиками в один меш');
  const old = []; addRock(old, rnd, 0, 0); ok(old.every(g => g.type === 'BoxGeometry'), 'без палитры камни перестали быть кубами (подземелья)'); }

if (fails.length) { console.log('ПРОВАЛ:\n' + [...new Set(fails)].join('\n')); process.exit(1); }
console.log('Тропы и округлые формы 3D: OK');
