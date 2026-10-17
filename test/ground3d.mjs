// Тест земли 3D (шаг 6 аудита): шум травы бесшовный, плавный и тихий (яркость ±amp); тропа — полная в середине, нет вдали,
// край плавный; плиты дорог из декора убраны; в конфиге днём солнце сильнее неба. Шаг 7: тень у стен и стволов,
// градиент снизу вверх (светящееся — ровное), крона без лишних треугольников, крыши не ярче 35%.
import { valueNoise, groundNoise, pathMix, segsNear, contactGrid, contactShade } from '../3d/src/ground3d.js';
import { pushBox, pushBlob } from '../3d/src/models.js';
import { mulberry32 } from '../3d/src/sim.js';
import { CFG3 } from '../3d/src/config3d.js';
import { readFileSync } from 'node:fs';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const G = CFG3.look.groundNoise, P = CFG3.look.path;

// ---------- шум ----------
{ const n = 64, v = valueNoise(n, 8, mulberry32(3));
  ok(v.every(x => x >= 0 && x <= 1), 'шум вне 0..1');
  let seam = 0, inner = 0; for (let y = 0; y < n; y++) { seam = Math.max(seam, Math.abs(v[y * n + n - 1] - v[y * n])); inner = Math.max(inner, Math.abs(v[y * n + 1] - v[y * n])); }
  for (let x = 0; x < n; x++) seam = Math.max(seam, Math.abs(v[(n - 1) * n + x] - v[x]));
  ok(seam < .2, 'шов на краю плитки: ' + seam.toFixed(3));
  ok(inner < .2, 'шум не плавный: соседи различаются на ' + inner.toFixed(3)); }
{ const { hue, lum } = groundNoise(G.n, 5, G), mn = Math.min(...lum), mx = Math.max(...lum);
  ok(mn >= 1 - G.amp - 1e-6 && mx <= 1 + G.amp + 1e-6, `яркость травы вне ±${G.amp}: ${mn.toFixed(3)}..${mx.toFixed(3)}`);
  ok(mx - mn > G.amp * .8, 'шума почти нет: ' + (mx - mn).toFixed(3));
  ok(hue.every(h => h >= G.hue[0] - 1e-6 && h <= G.hue[1] + 1e-6), 'доля второго цвета травы вне диапазона');
  ok(G.amp <= .08, 'земля шумная: amp ' + G.amp); }

// ---------- тропа ----------
{ const segs = [[{ x: 0, z: 0 }, { x: 10, z: 0 }]];
  ok(Math.abs(pathMix(segs, 5, 0, P) - P.k) < .05, 'в середине тропы не полная сила: ' + pathMix(segs, 5, 0, P).toFixed(3));
  ok(pathMix(segs, 5, P.w[1] + P.edge + .1, P) === 0, 'тропа видна вдали');
  let prev = 1, mono = true, steps = 0; for (let d = 0; d <= 3; d += .05) { const k = pathMix(segs, 5, d, P); if (k > prev + .2) mono = false; if (prev - k > .5) steps++; prev = k; }
  ok(mono && steps === 0, 'край тропы рваный или ступенькой');
  ok(segsNear(segs, 20, 30, 0, 10, 2).length === 0 && segsNear(segs, 8, 20, -5, 5, 2).length === 1, 'отбор троп рядом с участком'); }

// ---------- декор и свет ----------
ok(!/плоские плиты вдоль троп/.test(readFileSync(new URL('../3d/src/decor.js', import.meta.url), 'utf8')), 'плиты дорог снова в декоре');
{ const D = CFG3.daynight.sky.day; ok(D.sunI > D.hemiI, 'днём небо сильнее солнца: свет плоский'); }

// ---------- шаг 7: тень у земли, градиент, мягкие кроны ----------
{ const C = CFG3.shapes.contact, N = 16, blds = [{ x0: 2, x1: 6, z0: 2, z1: 6 }];
  const at = (g, x, z) => contactShade(g[z * (N + 1) + x], C);
  const g = contactGrid(N, 0, 0, blds, [], C.r);
  ok(Math.abs(at(g, 6, 4) - (1 - C.k)) < 1e-6, 'у стены земля не темнее на k');
  ok(at(g, 8, 4) === 1 && at(g, 14, 14) === 1, 'тень у стены дальше r');
  let prev = 0, mono = true; for (let x = 6; x <= 9; x++) { const v = at(g, x, 4); if (v < prev - 1e-9) mono = false; prev = v; }
  ok(mono, 'тень у стены не светлеет плавно');
  const t = contactGrid(N, 0, 0, [], [10, 10], C.r);
  ok(at(t, 10, 10) < 1 - C.k * .9 && at(t, 10, 12) === 1 && at(t, 11, 10) < 1, 'тень у ствола неверная');
  const e = contactGrid(N, 0, 0, [], [-.5, 8], C.r); ok(at(e, 0, 8) < 1, 'ствол соседнего участка не даёт тени на краю'); }
{ const L = []; pushBox(L, 1, 2, 1, 0, 1, 0, 0, 0, 0, '#808080'); const p = L[0].attributes.position, c = L[0].attributes.color;
  let lo = Infinity, hi = -Infinity; for (let i = 0; i < p.count; i++) { if (p.getY(i) < .01) lo = Math.min(lo, c.getX(i)); if (p.getY(i) > 1.99) hi = Math.max(hi, c.getX(i)); }
  const G = CFG3.shapes.grad; ok(Math.abs(hi / lo - G[1] / G[0]) < .01, `градиент снизу вверх не ${G[0]}→${G[1]}: ${(hi / lo).toFixed(3)}`);
  const F = Object.assign([], { glow: true }); pushBox(F, 1, 2, 1, 0, 1, 0, 0, 0, 0, '#808080'); const fc = F[0].attributes.color;
  ok(fc.getX(0) === fc.getX(fc.count - 1) && new Set(Array.from(fc.array)).size === 1, 'светящаяся деталь с градиентом'); }
{ const A = []; pushBlob(A, 'ico', 1, 1, 1, 0, 0, 0, 0, 0, 0, '#3a6a2e'); ok(A[0].attributes.position.count === 60, 'у кроны прибавились треугольники: ' + A[0].attributes.position.count); }
{ const R = CFG3.shapes.roof; ok(R.colors.every(h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), mx = Math.max(...c), mn = Math.min(...c); return (mx - mn) / mx <= .35; }), 'крыша слишком насыщенная (>35%)'); }

if (fails.length) { console.log('ground3d FAIL\n' + fails.join('\n')); process.exit(1); }
console.log('Земля 3D: OK');
