// Тест эффектов стихий 3D (шаг V1): молния — ломаная от точки до точки с ветками, без вылета за отклонение; частицы статусов —
// огонь поднимается и светится, дым и яд всплывают, кровь падает, иней светится; темп выпуска точный; звёзды оглушения — на круге.
import { RATE, statusPart, emitCount, lightning, stunStar } from '../3d/src/vfx3d.js';
import { mulberry32 } from '../3d/src/sim.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const hex = c => /^#[0-9a-f]{6}$/i.test(c);

// ---------- молния ----------
for (let s = 1; s <= 50; s++) {
  const r = mulberry32(s), a = { x: 0, y: 1.2, z: 0 }, b = { x: 6, y: 1.4, z: 2 }, L = lightning(a, b, r, 8, .55, 2);
  ok(L.main.length === 9 && L.branches.length === 2 && L.branches.every(q => q.length === 4), 'молния: не 8 отрезков и 2 ветки по 3');
  const f = L.main[0], l = L.main[8]; ok(f.x === a.x && f.z === a.z && l.x === b.x && l.z === b.z, 'молния не от точки до точки');
  const len = Math.hypot(b.x - a.x, b.z - a.z), nx = -(b.z - a.z) / len, nz = (b.x - a.x) / len;
  ok(L.main.every(p => Math.abs((p.x - a.x) * nx + (p.z - a.z) * nz) <= .55 + 1e-9), 'молния ушла вбок дальше отклонения');
  ok(L.main.slice(1, -1).some(p => Math.abs((p.x - a.x) * nx + (p.z - a.z) * nz) > .05), 'молния прямая, без изломов');
}
{ const A = lightning({ x: 0, y: 1, z: 0 }, { x: 4, y: 1, z: 0 }, mulberry32(7)), B = lightning({ x: 0, y: 1, z: 0 }, { x: 4, y: 1, z: 0 }, mulberry32(7)); ok(JSON.stringify(A) === JSON.stringify(B), 'молния не повторяется при том же зерне'); }

// ---------- частицы статусов ----------
const r = mulberry32(3), sample = (k, n = 400) => Array.from({ length: n }, () => statusPart(k, r, 1.6));
for (const k of ['burn', 'freeze', 'poison', 'bleed', 'shock']) ok(sample(k).every(q => hex(q.color) && q.life > 0 && q.s > 0 && Number.isFinite(q.vx + q.vy + q.vz + q.dx + q.dy + q.dz)), `частицы «${k}» неверные`);
{ const B = sample('burn'), flame = B.filter(q => q.add), smoke = B.filter(q => !q.add);
  ok(flame.length > B.length * .6 && smoke.length > B.length * .1, 'у огня нет языков пламени или дыма');
  ok(B.every(q => q.vy > 0 && q.g < 0), 'огонь и дым не поднимаются'); }
ok(sample('bleed').every(q => q.g > 0 && !q.add), 'кровь не падает или светится');
ok(sample('freeze').every(q => q.add) && sample('poison').every(q => !q.add && q.g < 0), 'иней не светится или яд не всплывает');
ok(sample('freeze').every(q => q.dy >= 1.6 * .2 && q.dy <= 1.6) && sample('burn').every(q => q.dy <= 1.6), 'частицы выше цели');

// ---------- темп выпуска ----------
for (const k of Object.keys(RATE)) { let acc = 0, n = 0; for (let i = 0; i < 60; i++) { const e = emitCount(acc, RATE[k], 1 / 60); acc = e.acc; n += e.n; } ok(Math.abs(n - RATE[k]) <= 1, `«${k}»: за секунду ${n} частиц вместо ${RATE[k]}`); }
{ const e = emitCount(.5, 30, 0); ok(e.n === 0 && e.acc === .5, 'выпуск без времени'); }

// ---------- звёзды оглушения ----------
{ const S = [0, 1, 2].map(i => stunStar(i, 3, 1.3, .45)); ok(S.every(q => Math.abs(Math.hypot(q.x, q.z) - .45) < 1e-9 && Math.abs(q.y) <= .06), 'звёзды не на круге над головой');
  ok(new Set(S.map(q => q.x.toFixed(3))).size === 3, 'звёзды слиплись'); }

if (fails.length) { console.log('ПРОВАЛ:\n' + [...new Set(fails)].join('\n')); process.exit(1); }
console.log('Эффекты стихий 3D: OK');
