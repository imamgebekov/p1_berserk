// Обрывы (C3c): плато в горах — круг радиуса r, поднятый на h м, с отвесным краем и пологими въездами (ramps — углы, рад,
// ширина въезда ±rw рад, длина спуска len м наружу). Край — стена толщиной WALL м: герой, враги и бойцы не проходят, кроме въездов.
// Чистая логика без графики (проверяется в Node). Вид (высота) — plateauH, столкновения — pushCliff, проверка линии — crossesCliff.
export const WALL = .7, EDGE = 1.2;
const angIn = (P, x, z) => { const a = Math.atan2(x - P.x, z - P.z); return P.ramps.some(q => { let d = Math.abs(a - q) % (Math.PI * 2); if (d > Math.PI) d = Math.PI * 2 - d; return d < P.rw; }); };
const smooth = t => t * t * (3 - 2 * t);
// добавка высоты от плато (0 — вне плато)
export function plateauH(plates, x, z) {
  let h = 0;
  for (const P of plates || []) {
    const d = Math.hypot(x - P.x, z - P.z); if (d > P.r + P.len) continue;
    let k;
    if (d <= P.r - EDGE) k = 1;
    else if (angIn(P, x, z)) k = d <= P.r ? 1 : 1 - smooth(Math.min(1, (d - P.r) / P.len));      // въезд: пологий спуск наружу
    else k = d >= P.r ? 0 : smooth((P.r - d) / EDGE);                                           // отвесный край
    h = Math.max(h, k * P.h);
  }
  return h;
}
// точка в стене обрыва (с запасом pad)
export function inCliff(plates, x, z, pad = 0) {
  for (const P of plates || []) { const d = Math.hypot(x - P.x, z - P.z); if (Math.abs(d - P.r) < WALL / 2 + pad && !angIn(P, x, z)) return P; }
  return null;
}
// вытолкнуть круг из стены обрыва на ту сторону, где его центр
export function pushCliff(plates, o, r) {
  let hit = false;
  for (const P of plates || []) {
    const dx = o.x - P.x, dz = o.z - P.z, d = Math.hypot(dx, dz), m = WALL / 2 + r;
    if (Math.abs(d - P.r) >= m || d < 1e-9 || angIn(P, o.x, o.z)) continue;
    const to = d >= P.r ? P.r + m : P.r - m; o.x = P.x + dx / d * to; o.z = P.z + dz / d * to; hit = true;
  }
  return hit;
}
// пересекает ли отрезок стену обрыва (вне въездов)
export function crossesCliff(plates, x0, z0, x1, z1) {
  for (const P of plates || []) {
    const a = Math.hypot(x0 - P.x, z0 - P.z), b = Math.hypot(x1 - P.x, z1 - P.z);
    if (Math.min(a, b) > P.r + 4 + Math.hypot(x1 - x0, z1 - z0)) continue;
    const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / .4));
    let prev = a - P.r;
    for (let i = 1; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n, s = Math.hypot(x - P.x, z - P.z) - P.r; if (Math.sign(s) !== Math.sign(prev) && !angIn(P, x, z)) return true; prev = s; }
  }
  return false;
}
