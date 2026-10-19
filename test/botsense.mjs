// Чутьё бота (этап 2 «круче»): живой игрок видит подсветку на земле (W.haz с задержкой: удар по земле, плевок, проклятие)
// и полосу прицельного рывка (враг в состоянии 'aim'). Бот замечает подсказку в половине случаев (как замах: от него он
// катится через раз): заметил — отходит и ещё через раз перекатывается: из круга — наружу, с полосы рывка — вбок. Только подсветка новых приёмов (метка mv): старые бой тестов
// мерит как раньше, база не сдвигается. Меняет inp; true — бот занят уклонением.
export function telegraphDodge(W, inp, rnd) {
  const p = W.player; if (p.dead) return false;
  let h = null, hd = 1e9;
  for (const z of W.haz || []) if (z.mv && z.t < z.delay && (z.seen ??= rnd() < .5)) { const d = Math.hypot(p.x - z.x, p.z - z.z); if (d < z.r + .9 && d - z.r < hd) { hd = d - z.r; h = z; } }
  if (!h) for (const z of W.bzones || []) if (z.mv && z.t > 0) { const d = Math.hypot(p.x - z.x, p.z - z.z); if (d < z.r + .3) { z.inT = (z.inT || 0) + 1 / 60; if ((z.seen ??= rnd() < .5) || z.inT > 1) { h = { x: z.x, z: z.z, r: z.r, t: 0, delay: 1, rolled: true }; break; } } }     // лужа нового приёма босса: заметил сразу или обжёгся за секунду — выйти
  if (h) {
    const d = Math.hypot(p.x - h.x, p.z - h.z) || 1e-3, ux = (p.x - h.x) / d || 1, uz = (p.z - h.z) / d;
    inp.mx = ux; inp.mz = uz; inp.attackPress = false;
    if (h.delay - h.t < .35 && p.rollCd <= 0 && !h.rolled) { h.rolled = true; if (rnd() < .5) inp.roll = true; }
    return true;
  }
  for (const e of W.enemies) {
    if (e.dead || e.state !== 'aim' || !e.tele || !e.tele.mv || !(e.tele.seen ??= rnd() < .5)) continue;
    const fx = Math.sin(e.face), fz = Math.cos(e.face), rx = p.x - e.x, rz = p.z - e.z, along = rx * fx + rz * fz, side = rx * fz - rz * fx;
    if (along < -1 || along > e.tele.len + 1 || Math.abs(side) > e.tele.w + .8) continue;
    const sgn = side >= 0 ? 1 : -1; inp.mx = fz * sgn; inp.mz = -fx * sgn; inp.attackPress = false;
    if (e.t > e.tele.aim * .5 && p.rollCd <= 0 && !e.rolledAt) { e.rolledAt = true; if (rnd() < .5) inp.roll = true; }
    return true;
  }
  return false;
}
