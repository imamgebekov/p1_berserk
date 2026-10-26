// Физика боя (план физики, 2026-10-25): движение героя — разгон и торможение раздельно, разворот, кривая переката.
// Чистая логика без графики (проверяется в Node). Числа — cfg.phys; выключено (on: false) — как раньше.
const len = (x, z) => Math.hypot(x, z);

export const physMove = cfg => (cfg.phys && cfg.phys.move && cfg.phys.move.on ? cfg.phys.move : null);

// скорость переката в доле u (0..1) от rollSpeed: быстрый старт, мягкий конец; средняя — avg, путь как раньше
export function rollK(R, u) { const hi = (R.avg - R.lo) * (R.p + 1); return R.lo + hi * Math.pow(Math.max(0, 1 - u), R.p); }

// шаг скорости героя к цели (tx, tz): разгон accel, торможение brake (ввода нет); резкий разворот больше turn.deg —
// упор: скорость сразу не выше turn.k от полной (sp), и turn.t с цель не быстрее её — герой разворачивается, а не скользит
export function moveStep(p, tx, tz, dt, accel, M, moving, sp) {
  const v = len(p.vx, p.vz), tl = len(tx, tz);
  if (moving && v > sp * .5 && tl > 1e-6 && (p.vx * tx + p.vz * tz) / (v * tl) < Math.cos(M.turn.deg * Math.PI / 180)) { p.turnT = M.turn.t; const c = M.turn.k * sp / v; if (c < 1) { p.vx *= c; p.vz *= c; } }
  if (p.turnT > 0) { p.turnT -= dt; tx *= M.turn.k; tz *= M.turn.k; }
  const a = (moving ? accel : M.brake) * dt, dvx = tx - p.vx, dvz = tz - p.vz, dl = len(dvx, dvz);
  if (dl <= a) { p.vx = tx; p.vz = tz; } else { p.vx += dvx / dl * a; p.vz += dvz / dl * a; }
}
