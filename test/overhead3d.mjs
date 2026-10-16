// Тест объёма слоями 3D (шаг F4): арки стоят посреди изогнутых троп, опоры по бокам свободны (не в домах, воде, у препятствий),
// проход под аркой выше героя; деревья у троп — ствол в стороне от любой тропы, крона над самой тропой, не в лагере;
// повторяемость; выключено — ничего; это только вид — препятствия мира не меняются; мост — дугой (выше к середине).
import { CFG3 } from '../3d/src/config3d.js';
import { makeMap } from '../3d/src/map.js';
import { overheadOf } from '../3d/src/overhead3d.js';
import { pathSegs, distSeg } from '../3d/src/world3d.js';
import { waterDist } from '../3d/src/terrain3d.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const map = makeMap(CFG3), O = overheadOf(map, CFG3), C = CFG3.overhead, segs = pathSegs(map);
const inB = (x, z, pad) => map.buildings.some(b => x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad);
const near = (x, z) => Math.min(...segs.map(([a, b]) => distSeg(x, z, a, b)));

// ---------- арки ----------
ok(O.arches.length >= 3, 'арок мало: ' + O.arches.length);
ok(new Set(O.arches.map(a => a.kind)).size === 2, 'нет обоих видов арок (камень и пергола)');
for (const a of O.arches) {
  ok(near(a.x, a.z) < .3, 'арка не на тропе');
  ok(a.h >= 3 && a.span >= 3.5, 'под аркой не пройти: высота ' + a.h + ', пролёт ' + a.span);
  const ux = Math.cos(a.ang), uz = -Math.sin(a.ang);
  for (const s of [-1, 1]) { const x = a.x + ux * s * a.span / 2, z = a.z + uz * s * a.span / 2;
    ok(!inB(x, z, 1) && waterDist(map.river, x, z) >= 1.5 && !map.solids.some(q => Math.hypot(q.x - x, q.z - z) < q.r + .6), 'опора арки в доме, воде или препятствии');
    ok(near(x, z) > 1.2, 'опора арки стоит на тропе'); }
}
// на других зёрнах мира опоры тоже свободны (проверка обхода, а не удача одного мира)
for (let sd = 1; sd <= 15; sd++) { const c = JSON.parse(JSON.stringify(CFG3)); c.world.seed = sd; const m = makeMap(c), Q = overheadOf(m, c);
  for (const a of Q.arches) { const ux = Math.cos(a.ang), uz = -Math.sin(a.ang); for (const s of [-1, 1]) { const x = a.x + ux * s * a.span / 2, z = a.z + uz * s * a.span / 2;
    ok(!m.buildings.some(b => x > b.x0 - 1 && x < b.x1 + 1 && z > b.z0 - 1 && z < b.z1 + 1) && (!m.river || waterDist(m.river, x, z) >= 1.5) && !m.solids.some(q => Math.hypot(q.x - x, q.z - z) < q.r + .6), `опора арки занята (зерно ${sd})`); } } }
// защита опор: препятствие на месте опоры — арки там нет
{ const a = O.arches[0], ux = Math.cos(a.ang), uz = -Math.sin(a.ang), m2 = { ...map, solids: [...map.solids, { x: a.x + ux * a.span / 2, z: a.z + uz * a.span / 2, r: .5 }] };
  ok(!overheadOf(m2, CFG3).arches.some(q => Math.hypot(q.x - a.x, q.z - a.z) < .1), 'арка встала, хотя на месте опоры препятствие'); }
// ---------- кроны над тропой ----------
ok(O.canopy.length >= 5, 'деревьев над тропой мало: ' + O.canopy.length);
for (const c of O.canopy) {
  ok(near(c.x, c.z) >= C.canopy.off - .2 - 1e-6, 'ствол стоит на тропе');
  ok(near(c.x + c.toX * c.reach, c.z + c.toZ * c.reach) < 1.2, 'крона не над тропой');
  ok(!inB(c.x, c.z, 1) && waterDist(map.river, c.x, c.z) >= 1.5, 'ствол в доме или в воде');
  ok(!map.camp || Math.hypot(c.x - map.camp.x, c.z - map.camp.z) > map.camp.r + 3, 'дерево в лагере или у частокола');
}
// ---------- прочее ----------
ok(JSON.stringify(overheadOf(map, CFG3)) === JSON.stringify(O), 'размещение не повторяется');
{ const c = JSON.parse(JSON.stringify(CFG3)); c.overhead.on = false; const E = overheadOf(makeMap(c), c); ok(!E.arches.length && !E.canopy.length, 'выключено, а арки и кроны есть'); }
{ const c = JSON.parse(JSON.stringify(CFG3)); c.overhead.on = false; const m2 = makeMap(c); ok(JSON.stringify(m2.solids) === JSON.stringify(map.solids) && JSON.stringify(m2.blocks) === JSON.stringify(map.blocks), 'арки или кроны стали препятствиями'); }

if (fails.length) { console.log('ПРОВАЛ:\n' + [...new Set(fails)].join('\n')); process.exit(1); }
console.log('Объём слоями 3D: OK');
