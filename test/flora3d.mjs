// Тест зелени 3D (2026-10-17): шум плавный и в 0..1; пятна сочной и сухой травы, проплешины и поляны занимают разумную долю;
// множитель цвета земли мягкий; цветы — только у мест травы, цветами из палитры, одинаково при одном зерне; кусты — только там,
// где разрешено (не у троп), их немного на участок.
import { CFG3 } from '../3d/src/config3d.js';
import { noise, patchAt, groundMix, flowersIn, bushesIn } from '../3d/src/flora3d.js';
import { makeMap } from '../3d/src/map.js';
import { grassIn } from '../3d/src/chunks3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const F = CFG3.flora;
// шум
{ let mn = 1, mx = 0, jump = 0; for (let i = 0; i < 4000; i++) { const x = i * .37 - 700, z = i * .21 - 300, v = noise(x, z, 3); mn = Math.min(mn, v); mx = Math.max(mx, v); jump = Math.max(jump, Math.abs(noise(x + .01, z, 3) - v)); }
  ok(mn >= 0 && mx <= 1 && mx - mn > .6, `шум вне 0..1 или плоский: ${mn.toFixed(2)}..${mx.toFixed(2)}`); ok(jump < .05, 'шум не плавный: ' + jump.toFixed(3)); }
// доли пятен
{ const S = { lush: 0, dry: 0, dirt: 0, bloom: 0 }; let n = 0, gmn = 9, gmx = 0;
  for (let x = -500; x < 500; x += 6) for (let z = -500; z < 500; z += 6) { const p = patchAt(x, z, F); for (const k in S) S[k] += p[k] > .5; n++; for (const v of groundMix(x, z, F)) { gmn = Math.min(gmn, v); gmx = Math.max(gmx, v); } }
  for (const [k, [a, b]] of Object.entries({ lush: [.05, .35], dry: [.05, .35], dirt: [.02, .2], bloom: [.05, .35] })) ok(S[k] / n >= a && S[k] / n <= b, `доля «${k}» ${(S[k] / n).toFixed(2)} вне ${a}–${b}`);
  ok(gmn > .45 && gmx < 2.2, `цвет земли меняется слишком резко: ${gmn.toFixed(2)}..${gmx.toFixed(2)}`); }
// цветы и кусты
{ const map = makeMap(CFG3); let fl = 0, bu = 0, n = 0;
  for (let ci = -6; ci < 6; ci += 3) for (let cj = -6; cj < 6; cj += 3) {
    const spots = grassIn(map, CFG3, ci, cj), f1 = flowersIn(CFG3, spots, 7 + ci * 13 + cj), f2 = flowersIn(CFG3, spots, 7 + ci * 13 + cj);
    ok(JSON.stringify(f1) === JSON.stringify(f2), 'цветы разные при одном зерне');
    ok(f1.every(f => F.flowers.colors.includes(f.c) && spots.some(s => Math.hypot(s.x - f.x, s.z - f.z) < .7)), 'цветок не у травы или чужого цвета');
    ok(bushesIn(CFG3, spots, 9, () => false).length === 0, 'куст поставлен там, где нельзя');
    fl += f1.length; bu += bushesIn(CFG3, spots, 9 + ci + cj, () => true).length; n++;
  }
  ok(fl / n > 20 && fl / n < 400, 'цветов на участок: ' + (fl / n).toFixed(0)); ok(bu / n > 1 && bu / n < 30, 'кустов на участок: ' + (bu / n).toFixed(1)); }

if (fails.length) { console.log('flora3d FAIL\n' + [...new Set(fails)].join('\n')); process.exit(1); }
console.log('Зелень 3D: OK');
