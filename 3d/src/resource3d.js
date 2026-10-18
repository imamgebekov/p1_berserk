// Ресурс героя для умений (пожелание владельца 2026-10-18): у Торна — Ярость (копится от ударов и полученного урона,
// гаснет вне боя), у Сойки — Концентрация (восстанавливается сама, быстрее от попаданий), у Вейла — тоже Концентрация (с 2026-10-18;
// было «Ритм» от ударов). Умение стоит ресурса; короткая перезарядка остаётся, чтобы сильное не жали подряд.
// Чистые функции без случайных чисел: бой врагов и боссов не меняется. Числа — в config3d.js → abilities.res.

export const resOf = W => (W.cfg.abilities.res || {})[W.hero] || null;
// запас ресурса: растёт с уровнем героя (perLv за уровень)
export const resMax = (W, R = resOf(W)) => (R ? R.max + Math.max(0, (W.lv || 1) - 1) * (R.perLv || 0) : 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// при смене героя — свой запас с начала
function ensure(W) { const R = resOf(W); if (W.resHero !== W.hero) { W.resHero = W.hero; W.res = R ? R.start : 0; W.resIdle = 0; } return R; }
// kind: 'hit' (удар оружием по врагу), 'hurt' (amt — полученный урон), 'roll' (перекат)
export function resGain(W, kind, amt = 1) {
  const R = ensure(W); if (!R) return;
  const g = (R[kind] || 0) * amt; if (g > 0) { W.res = clamp(W.res + g, 0, resMax(W, R)); W.resIdle = 0; }
}
// раз в шаг: восстановление и угасание вне боя (после idle с без ударов и урона)
export function resTick(W, dt) {
  const R = ensure(W); if (!R) return;
  W.resIdle += dt;
  const M = resMax(W, R);
  if (R.regen) W.res = clamp(W.res + R.regen * dt, 0, M);
  if (R.decay && W.resIdle > R.idle) W.res = clamp(W.res - R.decay * dt, 0, M);
}
export const resNow = W => { ensure(W); return W.res || 0; };
export function resSpend(W, cost) { ensure(W); if ((W.res || 0) < cost) return false; W.res -= cost; return true; }
