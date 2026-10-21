// Зоны по уровням (этап 1, 2026-10-19): ядро — «Пепельный Брод» 1–20; за ядром два кольца (граница split м с волной wobble),
// в кольце зона — это биом. Уровень места внутри зоны растёт от внутренней границы кольца к внешней. Чистые функции (Node-тесты).
// Числа и имена — config3d.js → zones.
import { biomeAt } from './worldgen3d.js';

const clamp01 = v => Math.max(0, Math.min(1, v));
// границы колец: первая — с волной по углу (не ровный круг), дальше (мир ×2, 4.04) — по splits ровными кругами
const splitAt = (Z, x, z) => Z.split + Z.wobble * Math.sin(Math.atan2(x, z) * 5 + 1.7);
const bounds = (Z, x, z) => [splitAt(Z, x, z), ...(Z.splits || [])];
// зона в точке: { id, name, lv: [от, до], ring: -1 (ядро) | 0 | 1, t: доля пути через кольцо }
export function zoneAt(cfg, x, z) {
  const Z = cfg.zones; if (!Z) return null;
  const d = Math.hypot(x, z), bio = biomeAt(cfg, x, z);
  if (!bio) return { ...Z.core, ring: -1, t: clamp01(d / ((cfg.worldgen && cfg.worldgen.coreR) || cfg.world.radius)) };
  const B = bounds(Z, x, z).filter((v, i) => i === 0 || v < cfg.world.radius); let ring = 0; while (ring < B.length && d >= B[ring] && ring + 1 < Z.rings.length) ring++;
  const a = ring === 0 ? cfg.worldgen.coreR + cfg.worldgen.belt / 2 : B[ring - 1], b = ring < B.length ? B[ring] : cfg.world.radius;
  return { ...Z.rings[ring][bio], ring, t: clamp01((d - a) / (b - a)) };
}
// уровень места на поверхности; null — зон нет (тогда — по глубине)
export function zoneLevel(cfg, x, z) { const q = zoneAt(cfg, x, z); return q && q.ring >= 0 ? q.lv[0] + (q.lv[1] - q.lv[0]) * q.t : null; }
// все зоны списком: ядро, потом кольца
export const allZones = cfg => (cfg.zones ? [{ ...cfg.zones.core, ring: -1 }, ...cfg.zones.rings.flatMap((r, i) => Object.entries(r).map(([bio, z]) => ({ ...z, bio, ring: i })))] : []);
