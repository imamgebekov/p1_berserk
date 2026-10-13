// Мелкие утилиты. Игровой ГСЧ подменяемый — тест подставляет seed и получает повторяемый прогон.

let rand = Math.random;
export const setRng = f => { rand = f; };

export function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export const random = () => rand();
export const rnd = (a, b) => a + rand() * (b - a);
export const ri = (a, b) => Math.floor(rnd(a, b + 1));
export const pick = a => a[Math.floor(rand() * a.length)];
export const rndIn = r => rnd(r[0], r[1]);
export const riIn = r => ri(r[0], r[1]);

// Только для картинки (тряска, пепел): не трогает игровой ГСЧ
export const vrnd = (a, b) => a + Math.random() * (b - a);

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const sgn = v => v < 0 ? -1 : 1;
export const lerp = (a, b, t) => a + (b - a) * t;
export const mixA = (A, B, t) => A.map((v, i) => v + (B[i] - v) * t);
export const rgb = a => `rgb(${a[0] | 0},${a[1] | 0},${a[2] | 0})`;
export const hash = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
