// Мелкие общие функции симуляции.
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const len = (x, z) => Math.hypot(x, z);
export const rr = (W, a, b) => a + W.rng() * (b - a);
// Поиск по сетке (2026-10-28): вместо перебора всего списка — только соседи в клетках. Список только растёт (push) — новое
// добавляется в сетку при следующем запросе. box(o) → [x0, z0, x1, z1]; some(x0, z0, x1, z1, f) — есть ли o в рамке с f(o)
export function gridIndex(arr, box, cell = 16) {
  const cells = new Map(), mark = []; let n = 0, stamp = 0;
  const add = i => { const [x0, z0, x1, z1] = box(arr[i]); for (let a = Math.floor(x0 / cell); a <= Math.floor(x1 / cell); a++) for (let b = Math.floor(z0 / cell); b <= Math.floor(z1 / cell); b++) { const k = a * 73856093 ^ b * 19349663; let c = cells.get(k); if (!c) cells.set(k, c = []); c.push(i); } };
  return { some(x0, z0, x1, z1, f) {
    while (n < arr.length) add(n++);
    stamp++;
    for (let a = Math.floor(x0 / cell); a <= Math.floor(x1 / cell); a++) for (let b = Math.floor(z0 / cell); b <= Math.floor(z1 / cell); b++) { const c = cells.get(a * 73856093 ^ b * 19349663); if (c) for (const i of c) { if (mark[i] === stamp) continue; mark[i] = stamp; if (f(arr[i])) return true; } }
    return false;
  } };
}
