// Физика боя (план физики, 2026-10-25): движение героя — разгон и торможение раздельно, разворот, кривая переката.
// Чистая логика без графики (проверяется в Node). Числа — cfg.phys; выключено (on: false) — как раньше.
const len = (x, z) => Math.hypot(x, z);

export const physMove = cfg => (cfg.phys && cfg.phys.move && cfg.phys.move.on ? cfg.phys.move : null);

// скорость переката в доле u (0..1) от rollSpeed: быстрый старт, мягкий конец; средняя — avg, путь как раньше
export function rollK(R, u) { const hi = (R.avg - R.lo) * (R.p + 1); return R.lo + hi * Math.pow(Math.max(0, 1 - u), R.p); }

// шаг скорости героя к цели (tx, tz): разгон accel, торможение brake (ввода нет); резкий разворот больше turn.deg после бега
// в одну сторону не короче turn.run с — упор: скорость сразу не выше turn.k от полной (sp), и turn.t с цель не быстрее её —
// герой разворачивается, а не скользит; частое дёрганье туда-сюда упора не даёт (бот у прохода не топчется на месте)
export function moveStep(p, tx, tz, dt, accel, M, moving, sp) {
  const v = len(p.vx, p.vz), tl = len(tx, tz), dot = v > 1e-6 && tl > 1e-6 ? (p.vx * tx + p.vz * tz) / (v * tl) : 1;
  if (p.knockT > 0) p.knockT -= dt;     // этап 2: отброшенный герой не «упирается» — отлёт не гаснет
  if (moving && v > sp * .5 && dot < Math.cos(M.turn.deg * Math.PI / 180) && (p.runT || 0) >= M.turn.run && !(p.knockT > 0)) { p.turnT = M.turn.t; const c = M.turn.k * sp / v; if (c < 1) { p.vx *= c; p.vz *= c; } }
  p.runT = moving && dot > 0 ? (p.runT || 0) + dt : 0;
  if (p.turnT > 0) { p.turnT -= dt; tx *= M.turn.k; tz *= M.turn.k; }
  const a = (moving ? accel : M.brake) * dt, dvx = tx - p.vx, dvz = tz - p.vz, dl = len(dvx, dvz);
  if (dl <= a) { p.vx = tx; p.vz = tz; } else { p.vx += dvx / dl * a; p.vz += dvz / dl * a; }
}

// этап 2 — отбрасывание с весом: J — импульс удара, вес врага — свой mass или scale² (тяжёлый ×heavy), скорость J/вес, не больше max
export const physKnock = cfg => (cfg.phys && cfg.phys.knock && cfg.phys.knock.on ? cfg.phys.knock : null);
export const foeMass = (K, C, heavy) => (C.mass ?? Math.max(K.minMass, (C.scale || 1) ** 2)) * (heavy ? K.heavy : 1);
export const knockV = (K, J, m) => Math.min(K.max, J / m);
// стойкость босса: урон за poise.t с копится; сверх доли frac от здоровья — пробита (сильный отлёт, сбитый приём), иначе отлёт ×k
export function poiseHit(P, e, dmg, t) {
  if (!(t - (e.pzT ?? -1e9) < P.t)) { e.pz = 0; e.pzT = t; }
  e.pz += dmg; if (e.pz < P.frac * e.maxhp) return P.k;
  e.pz = 0; e.pzT = t; return P.brk;
}
// удар о стену: летел быстрее v, а сдвинулся меньше половины пути — упёрся
export const slammed = (S, spd, want, moved) => spd > S.v && moved < want * .5;
// толчок соседа: летящий быстрее C.v в сторону другого отдаёт ему долю k скорости; оба t с не передают дальше (одно звено)
export function chainBump(C, a, b, dx, dz) {
  for (const [f, o, sg] of [[a, b, 1], [b, a, -1]]) {
    if (f.chainT > 0 || len(f.vx, f.vz) <= C.v || (f.vx * dx + f.vz * dz) * sg <= 0) continue;
    o.vx += f.vx * C.k; o.vz += f.vz * C.k; f.vx *= 1 - C.k; f.vz *= 1 - C.k; f.chainT = o.chainT = C.t; return o;
  }
  return null;
}
// скорость отлёта героя или спутника: base × √(вес бьющего в пределах 0,7..attMax) / свой вес
export const hurtKnock = (base, attMass, attMax, mass) => base * Math.sqrt(Math.min(attMax, Math.max(.7, attMass))) / mass;
