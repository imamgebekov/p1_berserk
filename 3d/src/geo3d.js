// Геометрия мира (Мир 5.0, 2026-10-23): круг мира радиуса world.radius с центром world.center. Лагерь и ядро остаются в (0,0),
// а сам круг сдвинут, чтобы старт был у края (решение владельца). Без world.center — прежний мир с центром в лагере.
const ZERO = { x: 0, z: 0 };
export const wcOf = cfg => (cfg.world && cfg.world.center) || ZERO;
// расстояние от центра мира
export const wdist = (cfg, x, z) => { const c = wcOf(cfg); return Math.hypot(x - c.x, z - c.z); };
// точка в круге мира с запасом pad от края
export const inWorld = (cfg, x, z, pad = 0) => wdist(cfg, x, z) < cfg.world.radius - pad;
// дальше всего от старта (0,0) до края мира — для поля уровня и глубины
export const farOf = cfg => { const c = wcOf(cfg); return Math.hypot(c.x, c.z) + cfg.world.radius; };
// вернуть точку внутрь круга мира радиуса R (по умолчанию — world.radius)
export function clampWorld(cfg, o, R = cfg.world.radius) {
  const c = wcOf(cfg), dx = o.x - c.x, dz = o.z - c.z, l = Math.hypot(dx, dz);
  if (l > R) { o.x = c.x + dx * R / l; o.z = c.z + dz * R / l; }
  return o;
}
// случайная точка в круге мира: не ближе dMin к старту (0,0), не дальше dMax от старта, не ближе pad к краю; rnd — 0..1
export function worldSpot(cfg, rnd, dMin = 0, pad = 0, dMax = Infinity) {
  const c = wcOf(cfg), R = cfg.world.radius - pad;
  for (let k = 0; k < 60; k++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * R, x = c.x + Math.sin(a) * d, z = c.z + Math.cos(a) * d, s = Math.hypot(x, z);
    if (s >= dMin && s <= dMax) return { x, z };
  }
  return null;
}
