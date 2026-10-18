// Зоны по уровням (этап 1, 2026-10-19): ядро — «Пепельный Брод» 1–20; за ядром два кольца (граница split м с волной wobble),
// в кольце зона — это биом. Уровень места внутри зоны растёт от внутренней границы кольца к внешней. Чистые функции (Node-тесты).
// Числа и имена — config3d.js → zones.
import { biomeAt } from './worldgen3d.js';

const clamp01 = v => Math.max(0, Math.min(1, v));
// граница колец с волной по углу — не ровный круг
const splitAt = (Z, x, z) => Z.split + Z.wobble * Math.sin(Math.atan2(x, z) * 5 + 1.7);
// зона в точке: { id, name, lv: [от, до], ring: -1 (ядро) | 0 | 1, t: доля пути через кольцо }
export function zoneAt(cfg, x, z) {
  const Z = cfg.zones; if (!Z) return null;
  const d = Math.hypot(x, z), bio = biomeAt(cfg, x, z);
  if (!bio) return { ...Z.core, ring: -1, t: clamp01(d / ((cfg.worldgen && cfg.worldgen.coreR) || cfg.world.radius)) };
  const s = splitAt(Z, x, z), inner = d < s, ring = inner ? 0 : 1, a = inner ? (cfg.worldgen.coreR + cfg.worldgen.belt / 2) : s, b = inner ? s : cfg.world.radius;
  return { ...Z.rings[ring][bio], ring, t: clamp01((d - a) / (b - a)) };
}
// уровень места на поверхности; null — зон нет (тогда — по глубине)
export function zoneLevel(cfg, x, z) { const q = zoneAt(cfg, x, z); return q && q.ring >= 0 ? q.lv[0] + (q.lv[1] - q.lv[0]) * q.t : null; }
// все зоны списком: ядро, потом кольца
export const allZones = cfg => (cfg.zones ? [{ ...cfg.zones.core, ring: -1 }, ...cfg.zones.rings.flatMap((r, i) => Object.entries(r).map(([bio, z]) => ({ ...z, bio, ring: i })))] : []);
