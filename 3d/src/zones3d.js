// Зоны по уровням (этап 1, 2026-10-19): ядро — «Пепельный Брод» 1–20; за ядром два кольца (граница split м с волной wobble),
// в кольце зона — это биом. Уровень места внутри зоны растёт от внутренней границы кольца к внешней. Чистые функции (Node-тесты).
// Мир 5.0 (2026-10-23, zones.puddle): старт у края мира; уровень — плавное поле по расстоянию от старта с волной (без скачков между
// землями), земли — «лужи»: ячейки вокруг семян с искажённой границей; семя земли — на расстоянии её среднего уровня.
// Числа и имена — config3d.js → zones.
import { biomeAt } from './worldgen3d.js';
import { wcOf, farOf } from './geo3d.js';

const clamp01 = v => Math.max(0, Math.min(1, v));
// границы колец: первая — с волной по углу (не ровный круг), дальше (мир ×2, 4.04) — по splits ровными кругами
const splitAt = (Z, x, z) => Z.split + Z.wobble * Math.sin(Math.atan2(x, z) * 5 + 1.7);
const bounds = (Z, x, z) => [splitAt(Z, x, z), ...(Z.splits || [])];

// ---------- Мир 5.0: лужи ----------
export const puddleOn = cfg => !!(cfg.zones && cfg.zones.puddle && cfg.world.center);
const coreEdge = cfg => cfg.worldgen.coreR + cfg.worldgen.belt / 2;     // за этим расстоянием от старта — земли
const wave = (P, x, z) => P.warp * (Math.sin(x * .0061 + 1.3) * Math.cos(z * .0047 - .4) + .6 * Math.sin((x + z) * .0093 + .7) + .4 * Math.cos((x - z) * .0131 + 2.1)) / 2;
// дальность для поля уровня: d от старта с волной; уровень 20 у ядра → 80 к P.far (доля от самой дальней точки мира)
export function fieldLevel(cfg, x, z) {
  const P = cfg.zones.puddle, c0 = coreEdge(cfg), far = farOf(cfg) * P.far, d = Math.hypot(x, z) + wave(P, x, z) * clamp01((Math.hypot(x, z) - c0) / 120);
  return 20 + 60 * clamp01((d - cfg.worldgen.coreR) / (far - cfg.worldgen.coreR));
}
const CACHE = new WeakMap();
// семена земель: земля с уровнями [a, b] — на расстоянии, где поле даёт (a+b)/2; земли одного кольца — вдоль дуги мира на этом расстоянии,
// берег — у концов дуги (там край мира, за ним — море)
function seedsOf(cfg) {
  let S = CACHE.get(cfg.zones); if (S) return S;
  const Z = cfg.zones, P = Z.puddle, C = wcOf(cfg), R = cfg.world.radius, far = farOf(cfg) * P.far, c0 = cfg.worldgen.coreR, base = Math.atan2(C.x, C.z);
  const inW = (a, d) => Math.hypot(Math.sin(a) * d - C.x, Math.cos(a) * d - C.z) < R - P.edge;
  const arc = d => { let lo = 0, hi = 0; for (let a = 0; a < Math.PI; a += .01) { if (inW(base + a, d)) hi = a; else break; } for (let a = 0; a < Math.PI; a += .01) { if (inW(base - a, d)) lo = a; else break; } return [base - lo, base + hi]; };
  const out = [];
  Z.rings.forEach((ring, ri) => {
    const zs = Object.entries(ring).map(([bio, z]) => ({ ...z, bio, ring: ri })).sort((a, b) => a.lv[0] - b.lv[0]), coast = zs.find(q => q.bio === 'coast'), rest = zs.filter(q => q !== coast);
    const order = ri % 2 ? [...rest, coast].filter(Boolean) : [coast, ...rest].filter(Boolean), n = order.length;
    order.forEach((q, k) => {
      const L = (q.lv[0] + q.lv[1]) / 2, d = c0 + (L - 20) / 60 * (far - c0), [a0, a1] = arc(Math.min(d, Math.hypot(C.x, C.z) + R - P.edge - 5));
      const a = a0 + (a1 - a0) * (k + .5) / n;
      out.push({ ...q, x: Math.sin(a) * d, z: Math.cos(a) * d });
    });
  });
  S = { seeds: out, lv: null }; CACHE.set(cfg.zones, S);
  return S;
}
// искажённое расстояние до семени: граница лужи волнистая
const jit = (P, x, z, k) => P.jitter * (Math.sin(x * .011 + k * 1.7) + Math.cos(z * .013 - k * 2.3) + .5 * Math.sin((x - z) * .021 + k));
function nearest2(cfg, x, z) {
  const P = cfg.zones.puddle, S = seedsOf(cfg).seeds; let a = null, da = 1e18, b = null, db = 1e18;
  S.forEach((s, k) => { const d = Math.hypot(s.x - x, s.z - z) + jit(P, x, z, k); if (d < da) { b = a; db = da; a = s; da = d; } else if (d < db) { b = s; db = d; } });
  return { a, da, b, db };
}
// земля-лужа в точке (без ядра)
export function puddleAt(cfg, x, z) { return nearest2(cfg, x, z).a; }
// мягкость стыка двух луж: [земля, соседняя, доля соседней 0..0.5]
export function puddleBlend(cfg, x, z) { const P = cfg.zones.puddle, { a, da, b, db } = nearest2(cfg, x, z), g = db - da; return [a, b, g < P.blend ? .5 * (1 - g / P.blend) : 0]; }
// уровни земли по её луже (пробы по сетке): для подписей и проверок
export function puddleRange(cfg, id) {
  const S = seedsOf(cfg); if (!S.lv) {
    const C = wcOf(cfg), R = cfg.world.radius, st = 25, acc = {};
    for (let x = C.x - R; x <= C.x + R; x += st) for (let z = C.z - R; z <= C.z + R; z += st) {
      if (Math.hypot(x - C.x, z - C.z) > R || Math.hypot(x, z) < coreEdge(cfg)) continue;
      const q = puddleAt(cfg, x, z), L = fieldLevel(cfg, x, z), A = acc[q.id] ||= [99, 0, 0, 0, 0]; A[0] = Math.min(A[0], L); A[1] = Math.max(A[1], L); A[2] += x; A[3] += z; A[4]++;
    }
    S.lv = Object.fromEntries(Object.entries(acc).map(([k, A]) => [k, { lv: [Math.max(20, Math.floor(A[0] - .5)), Math.min(80, Math.ceil(A[1] + .5))], x: A[2] / A[4], z: A[3] / A[4] }]));     // запас полуровня: пробы — через st м
  }
  return S.lv[id] || null;
}

// зона в точке: { id, name, lv: [от, до], ring: -1 (ядро) | 0 | 1, t: доля пути через кольцо }
export function zoneAt(cfg, x, z) {
  const Z = cfg.zones; if (!Z) return null;
  if (puddleOn(cfg)) {
    const d = Math.hypot(x, z); if (d < coreEdge(cfg)) return { ...Z.core, ring: -1, t: clamp01(d / cfg.worldgen.coreR) };
    const q = puddleAt(cfg, x, z), L = fieldLevel(cfg, x, z), r = puddleRange(cfg, q.id), lv = r ? r.lv : q.lv;
    return { ...q, lv, t: clamp01((L - lv[0]) / Math.max(1, lv[1] - lv[0])) };
  }
  const d = Math.hypot(x, z), bio = biomeAt(cfg, x, z);
  if (!bio) return { ...Z.core, ring: -1, t: clamp01(d / ((cfg.worldgen && cfg.worldgen.coreR) || cfg.world.radius)) };
  const B = bounds(Z, x, z).filter((v, i) => i === 0 || v < cfg.world.radius); let ring = 0; while (ring < B.length && d >= B[ring] && ring + 1 < Z.rings.length) ring++;
  const a = ring === 0 ? cfg.worldgen.coreR + cfg.worldgen.belt / 2 : B[ring - 1], b = ring < B.length ? B[ring] : cfg.world.radius;
  return { ...Z.rings[ring][bio], ring, t: clamp01((d - a) / (b - a)) };
}
// уровень места на поверхности; null — зон нет (тогда — по глубине)
export function zoneLevel(cfg, x, z) {
  if (puddleOn(cfg)) return Math.hypot(x, z) < coreEdge(cfg) ? null : fieldLevel(cfg, x, z);
  const q = zoneAt(cfg, x, z); return q && q.ring >= 0 ? q.lv[0] + (q.lv[1] - q.lv[0]) * q.t : null;
}
// все зоны списком: ядро, потом кольца (в Мире 5.0 — уровни по лужам)
export const allZones = cfg => (cfg.zones ? [{ ...cfg.zones.core, ring: -1 }, ...cfg.zones.rings.flatMap((r, i) => Object.entries(r).map(([bio, z]) => { const P = puddleOn(cfg) && puddleRange(cfg, z.id); return { ...z, bio, ring: i, ...(P ? { lv: P.lv } : {}) }; }))] : []);
