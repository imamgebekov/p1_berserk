// Свет сквозь облака (E2): мягкие пятна света плывут по земле, над самыми яркими рядом с героем — наклонные столбы света.
// Чистая логика без графики (проверяется в Node): поле яркости — бесшовный шум значений n×n, по нему же строится текстура.
import { mulberry32 } from './sim.js';

const smooth = t => t * t * (3 - 2 * t);
// поле n×n в 0..1: сумма двух октав бесшовного шума, затем «пятна» — всё ниже порога темнеет, выше — плавно к 1
export function makeField(seed, n = 128, cells = 6, cover = .32, soft = .18) {
  const r = mulberry32(seed * 977 + 3), grid = (g) => Array.from({ length: g * g }, () => r());
  const oct = [[cells, grid(cells), 1], [cells * 2, grid(cells * 2), .5]];
  const raw = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let v = 0, w = 0;
    for (const [g, G, a] of oct) {
      const x = i / n * g, y = j / n * g, xi = Math.floor(x), yi = Math.floor(y), fx = smooth(x - xi), fy = smooth(y - yi);
      const at = (a2, b2) => G[((b2 % g) + g) % g * g + ((a2 % g) + g) % g];
      const top = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * fx, bot = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * fx;
      v += (top + (bot - top) * fy) * a; w += a;
    }
    raw[j * n + i] = v / w;
  }
  // порог по доле площади: светлая часть ≈ cover
  const sorted = Float32Array.from(raw).sort(), th = sorted[Math.floor(sorted.length * (1 - cover))];
  const data = raw.map(v => smooth(Math.max(0, Math.min(1, (v - th) / soft + .5))));
  return { n, data };
}
// яркость в точке мира: поле растянуто на size м и плывёт по ветру (wind м/с), t — время
export function lightAt(F, x, z, t, L) {
  const u = (x + L.wind[0] * t) / L.size, v = (z + L.wind[1] * t) / L.size, n = F.n;
  const fx = (u - Math.floor(u)) * n, fy = (v - Math.floor(v)) * n, i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j;
  const at = (a, b) => F.data[(b % n) * n + (a % n)];
  const top = at(i, j) + (at(i + 1, j) - at(i, j)) * tx, bot = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * tx;
  return top + (bot - top) * ty;
}
// места столбов света: узлы сетки step м вокруг героя в радиусе r, яркость выше min; самые яркие, не ближе gap м друг к другу
export function pickShafts(F, px, pz, t, L) {
  const S = L.shafts, out = [], x0 = Math.floor((px - S.r) / S.step) * S.step, z0 = Math.floor((pz - S.r) / S.step) * S.step;
  for (let x = x0; x <= px + S.r; x += S.step) for (let z = z0; z <= pz + S.r; z += S.step) {
    if (Math.hypot(x - px, z - pz) > S.r) continue;
    const k = lightAt(F, x, z, t, L); if (k >= S.min) out.push({ x, z, k });
  }
  out.sort((a, b) => b.k - a.k || a.x - b.x || a.z - b.z);
  const res = [];
  for (const s of out) { if (res.length >= S.n) break; if (res.every(q => Math.hypot(q.x - s.x, q.z - s.z) >= S.gap)) res.push(s); }
  return res;
}
