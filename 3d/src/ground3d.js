// Земля (шаг 6 аудита): тихий плавный шум для текстуры травы и тропы, нарисованные цветом земли вместо плит.
// Чистые функции без графики (проверяются в Node).
import { mulberry32 } from './sim.js';
import { distSeg } from './world3d.js';

const smooth = t => t * t * (3 - 2 * t);
export const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// бесшовный value-noise n×n с периодом P клеток: значения 0..1, края сходятся (текстура повторяется без шва)
export function valueNoise(n, P, rnd) {
  const L = Float32Array.from({ length: P * P }, () => rnd()), out = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = x / n * P, v = y / n * P, i = Math.floor(u), j = Math.floor(v), fu = smooth(u - i), fv = smooth(v - j);
    const g = (a, b) => L[(b % P) * P + (a % P)];
    const top = g(i, j) + (g(i + 1, j) - g(i, j)) * fu, bot = g(i, j + 1) + (g(i + 1, j + 1) - g(i, j + 1)) * fu;
    out[y * n + x] = top + (bot - top) * fv;
  }
  return out;
}

// шум земли: hue — доля второго цвета травы (крупные пятна), lum — множитель яркости 1 ± amp (две октавы)
export function groundNoise(n, seed, G) {
  const r = mulberry32(seed), a = valueNoise(n, G.cells[0], r), b = valueNoise(n, G.cells[1], r), hue = new Float32Array(n * n), lum = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) { hue[i] = G.hue[0] + (G.hue[1] - G.hue[0]) * a[i]; lum[i] = 1 + G.amp * (2 * (.4 * a[i] + .6 * b[i]) - 1); }
  return { hue, lum };
}

// тропы рядом с прямоугольником [x0, x1]×[z0, z1] с запасом m м
export const segsNear = (segs, x0, x1, z0, z1, m) => segs.filter(([a, b]) => Math.max(a.x, b.x) > x0 - m && Math.min(a.x, b.x) < x1 + m && Math.max(a.z, b.z) > z0 - m && Math.min(a.z, b.z) < z1 + m);

// сколько тропы в точке: 1 — середина, 0 — трава; край мягкий (smoothstep от w[0] до w[1] м) и чуть неровный (edge м)
export function pathMix(segs, x, z, P) {
  let d = Infinity; for (const [a, b] of segs) { const q = distSeg(x, z, a, b); if (q < d) d = q; }
  if (d > P.w[1] + P.edge) return 0;
  d += P.edge * Math.sin(x * 1.7 + z * .9) * Math.sin(z * 1.3 - x * .6);
  return (1 - smoothstep(P.w[0], P.w[1], d)) * P.k;
}

// тень у земли (шаг 7): расстояние до ближайшей стены или ствола в узлах сетки участка (N×N клеток по 1 м от x0, z0);
// каждый дом и ствол отмечает только узлы рядом с собой — быстро и в роще. blds — {x0, x1, z0, z1}, trunks — [x, z, x, z, …]
export function contactGrid(N, x0, z0, blds, trunks, r) {
  const W = N + 1, d = new Float32Array(W * W).fill(Infinity);
  const mark = (ax, bx, az, bz, f) => { for (let j = Math.max(0, Math.floor(az - z0)); j <= Math.min(N, Math.ceil(bz - z0)); j++) for (let i = Math.max(0, Math.floor(ax - x0)); i <= Math.min(N, Math.ceil(bx - x0)); i++) { const v = f(x0 + i, z0 + j); if (v < d[j * W + i]) d[j * W + i] = v; } };
  for (const b of blds) mark(b.x0 - r, b.x1 + r, b.z0 - r, b.z1 + r, (x, z) => Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1)));
  for (let k = 0; k < trunks.length; k += 2) { const tx = trunks[k], tz = trunks[k + 1]; mark(tx - r - .2, tx + r + .2, tz - r - .2, tz + r + .2, (x, z) => Math.max(0, Math.hypot(x - tx, z - tz) - .2)); }     // ствол толщиной около 0,2 м
  return d;
}
// множитель цвета земли: 1 − k у самой стены или ствола, к r м — 1
export const contactShade = (d, C) => (d >= C.r ? 1 : 1 - C.k * (1 - smoothstep(0, C.r, d)));
