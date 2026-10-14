// Мелкие общие функции симуляции.
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const len = (x, z) => Math.hypot(x, z);
export const rr = (W, a, b) => a + W.rng() * (b - a);
