// Тест участков земли 3D (шаг C3a): высоты участками не зависят от порядка расчёта, на общих краях участков совпадают,
// непрерывны; участок считается быстро; деревья, камни и трава участка повторяемы, не в домах, на тропах и в воде, в мире;
// вокруг точки нужны участки по расстоянию, ближние — первыми.
import { CFG3 } from '../3d/src/config3d.js';
import { makeMap, propsBlocked } from '../3d/src/map.js';
import { buildHeights, heightAt, CHUNK, nodeHeightRef } from '../3d/src/terrain3d.js';
import { propsIn, grassIn, chunksAround } from '../3d/src/chunks3d.js';
import { waterDist } from '../3d/src/terrain3d.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const map = makeMap(CFG3), R = CFG3.world.radius;

// ---------- 1. высоты ----------
{ const A = buildHeights(CFG3, map), B = buildHeights(CFG3, map), pts = [];
  let r = 3; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 3000; i++) pts.push([(rnd() * 2 - 1) * (R + 20), (rnd() * 2 - 1) * (R + 20)]);
  const va = pts.map(([x, z]) => heightAt(A, x, z, false)), vb = [...pts].reverse().map(([x, z]) => heightAt(B, x, z, false)).reverse();
  ok(va.every((v, i) => v === vb[i]), 'высота зависит от порядка расчёта участков');
  let worst = 0; for (let i = 0; i < 4000; i++) { const x = Math.round((rnd() * 2 - 1) * (R + 20)), z = Math.round((rnd() * 2 - 1) * (R + 20)); worst = Math.max(worst, Math.abs(heightAt(A, x, z, false) - nodeHeightRef(A, x, z))); }
  ok(worst < 1e-6, 'участки считают высоту не как сплошное поле: ' + worst);     // участок хранит float32
  let jump = 0; for (let x = -R; x < R; x += .25) for (const z of [-CHUNK, 0, CHUNK - .001, CHUNK]) jump = Math.max(jump, Math.abs(heightAt(A, x + .25, z, false) - heightAt(A, x, z, false)));
  ok(jump < .2, 'скачок высоты: ' + jump.toFixed(3));
  for (const k of [-CHUNK, 0, CHUNK]) for (let z = -R; z < R; z += 3.3) ok(Math.abs(heightAt(A, k - 1e-9, z, false) - heightAt(A, k, z, false)) < 1e-6, 'шов на границе участков');
  const C = buildHeights(CFG3, map), t = performance.now(); for (let ci = -1; ci <= 1; ci++) for (let cj = -1; cj <= 1; cj++) heightAt(C, ci * CHUNK + 1, cj * CHUNK + 1); const per = (performance.now() - t) / C.built;
  ok(C.built === 9 && per < 25, `участок считается долго: ${per.toFixed(1)} мс`); }

// ---------- 2. что растёт ----------
{ const a = propsIn(map, CFG3, 0, -1), b = propsIn(map, CFG3, 0, -1);
  ok(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) !== JSON.stringify(propsIn(map, CFG3, 1, -1)), 'деревья участка не повторяются или одинаковы везде');
  let total = 0, trees = 0;
  for (let ci = -2; ci < 2; ci++) for (let cj = -2; cj < 2; cj++) for (const q of propsIn(map, CFG3, ci, cj)) {
    total++; if (q.tree) trees++;
    ok(q.x >= ci * CHUNK && q.x < (ci + 1) * CHUNK && q.z >= cj * CHUNK && q.z < (cj + 1) * CHUNK, 'дерево вне своего участка');
    ok(!propsBlocked(map, q.x, q.z) && Math.hypot(q.x, q.z) <= R - 1 && Math.hypot(q.x, q.z) >= 7, 'дерево на тропе, в доме или за краем');
  }
  const want = CFG3.world.props * (16 * CHUNK * CHUNK) / (Math.PI * ((R - 1) ** 2 - 49));     // плотность мира на 16 участков
  ok(total > want * .4 && total < want * 1.3 && trees / total > .4, `деревьев и камней ${total} при ожидаемых ~${want.toFixed(0)}`);
  const g = grassIn(map, CFG3, 0, 0); ok(g.length > 200 && g.every(q => q.x >= 0 && q.x < CHUNK + CFG3.wind.grass.step && waterDist(map.river, q.x, q.z) >= 1.2), 'трава участка не там'); }

// ---------- 3. какие участки нужны ----------
{ const N = chunksAround(10, 10, 96, R);
  ok(N.length >= 9 && N.length <= 30, 'участков вокруг: ' + N.length);
  ok(N.every((q, i) => !i || q.d >= N[i - 1].d) && N[0].ci === 0 && N[0].cj === 0, 'ближний участок не первый');
  ok(chunksAround(5000, 5000, 96, R).length === 0, 'участки за краем мира'); }

if (fails.length) { console.log('ПРОВАЛ:\n' + [...new Set(fails)].join('\n')); process.exit(1); }
console.log('Участки земли 3D: OK');
