// Тест земли 3D (шаг 6 аудита): шум травы бесшовный, плавный и тихий (яркость ±amp); тропа — полная в середине, нет вдали,
// край плавный; плиты дорог из декора убраны; в конфиге днём солнце сильнее неба.
import { valueNoise, groundNoise, pathMix, segsNear } from '../3d/src/ground3d.js';
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

if (fails.length) { console.log('ground3d FAIL\n' + fails.join('\n')); process.exit(1); }
console.log('Земля 3D: OK');
