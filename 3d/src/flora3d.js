// Зелень (пожелание владельца 2026-10-17): пятна травы и земли, цветочные поляны, кусты. Только вид — свои генераторы и шум
// по мировым координатам, бой и столкновения не меняются. Чистые функции (проверяются в Node).
import { mulberry32 } from './sim.js';
import { biomeAt } from './worldgen3d.js';
import { smoothstep } from './ground3d.js';

// плавный шум 0..1 по миру: решётка шага 1, сглаженная; o — сдвиг, чтобы разные слои не совпадали
const hash = (i, j, o) => { let h = Math.imul(i * 374761393 + j * 668265263 + o * 2147483647, 1274126177); h ^= h >>> 13; h = Math.imul(h, 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export function noise(x, z, o = 0) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(i, j, o), b = hash(i + 1, j, o), c = hash(i, j + 1, o), d = hash(i + 1, j + 1, o);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, z, s, o) => .65 * noise(x / s, z / s, o) + .35 * noise(x / s * 2.3, z / s * 2.3, o + 7);

// доли пятен в точке: lush — сочная зелень, dry — сухая трава, dirt — проплешина земли, bloom — цветочная поляна (0..1)
export function patchAt(x, z, F) {
  const P = F.patch, w = fbm(x, z, P.scale[0], 1), d = fbm(x, z, P.scale[1], 2), f = fbm(x, z, P.scale[2], 3);
  return { lush: smoothstep(.55, .75, w), dry: smoothstep(.45, .25, w), dirt: smoothstep(P.dirtT[0], P.dirtT[1], d), bloom: smoothstep(F.flowers.thr, F.flowers.thr + .1, f) };
}
// множитель цвета земли [r, g, b] (линейный) по пятнам — мягко, поверх оттенка биома
export function groundMix(x, z, F) {
  const p = patchAt(x, z, F), P = F.patch, out = [1, 1, 1];
  for (let i = 0; i < 3; i++) out[i] = (1 + (P.lush[i] - 1) * p.lush * P.k[0]) * (1 + (P.dry[i] - 1) * p.dry * P.k[1]) * (1 + (P.dirt[i] - 1) * p.dirt * P.k[2]);
  return out;
}
// цвет пучка травы (HSL) по пятну: в сухом месте желтее и светлее, в сочном — темнее и зеленее; i — разброс пучков
export function grassHSL(x, z, F, i) {
  const p = patchAt(x, z, F);
  return [.27 + (i % 7) * .012 - .07 * p.dry + .02 * p.lush, .45 + .05 * p.lush - .08 * p.dry, .38 + (i % 5) * .04 + .06 * p.dry - .05 * p.lush];
}
const grassK = (cfg, x, z) => { const b = biomeAt(cfg, x, z); return b && cfg.worldgen.grass ? cfg.worldgen.grass[b] : 1; };     // в пустоши и на берегу зелени меньше

// цветы участка: из мест травы (они уже не на тропе, не в воде и не у домов) — на полянах, группами одного-двух цветов
export function flowersIn(cfg, spots, seed) {
  const F = cfg.flora, C = F.flowers, r = mulberry32(seed), out = [];
  for (const s of spots) {
    const p = patchAt(s.x, s.z, F); if (p.bloom <= 0 || p.dirt > .6 || r() > C.per * p.bloom * grassK(cfg, s.x, s.z)) continue;
    const pal = Math.floor(noise(s.x / 40, s.z / 40, 5) * C.colors.length) % C.colors.length, alt = (pal + 1 + Math.floor(noise(s.x / 23, s.z / 23, 6) * 2)) % C.colors.length;
    const n = C.n[0] + Math.floor(r() * (C.n[1] - C.n[0] + 1));
    for (let k = 0; k < n; k++) out.push({ x: s.x + (r() - .5) * .9, z: s.z + (r() - .5) * .9, h: C.h[0] + r() * (C.h[1] - C.h[0]), c: C.colors[r() < .75 ? pal : alt] });
  }
  return out;
}
// кусты участка: из мест травы, где сочно и далеко от троп и домов (clear м); редко
export function bushesIn(cfg, spots, seed, farFromPath) {
  const F = cfg.flora, B = F.bushes, r = mulberry32(seed), out = [];
  for (const s of spots) {
    const p = patchAt(s.x, s.z, F), n = noise(s.x / B.scale, s.z / B.scale, 9);
    if (n < B.thr || p.dirt > .5 || r() > B.p * (.5 + p.lush) * grassK(cfg, s.x, s.z) || !farFromPath(s.x, s.z, B.clear)) continue;
    out.push({ x: s.x, z: s.z, s: B.size[0] + r() * (B.size[1] - B.size[0]), seed: (r() * 4294967296) >>> 0 });
  }
  return out;
}
