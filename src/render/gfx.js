// Пиксельные примитивы поверх низкоразрядного холста.
import { lerp } from '../util.js';

export let g = null;                 // 2D-контекст низкого разрешения
export const setCtx = c => { g = c; };

export const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };

export function disc(cx, cy, r, c) {
  g.fillStyle = c;
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.floor(Math.sqrt(r * r - dy * dy + .5));
    g.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1);
  }
}

export function line(x0, y0, x1, y1, c, t = 1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  g.fillStyle = c;
  for (let i = 0; i <= n; i++) g.fillRect(Math.round(lerp(x0, x1, i / n)), Math.round(lerp(y0, y1, i / n)), t, t);
}

const DIG = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
  5: '111100111001111', 6: '111100111101111', 7: '111001001001001', 8: '111101111101111', 9: '111101111001111'
};

// пиксельные цифры 3×5 с тенью
export function num(n, x, y, c) {
  const s = String(n);
  for (const pass of [1, 0]) {
    for (let k = 0; k < s.length; k++) {
      const d = DIG[s[k]];
      if (!d) continue;
      for (let i = 0; i < 15; i++) if (d[i] === '1')
        R(x + k * 4 + (i % 3) + pass, y + ((i / 3) | 0) + pass, 1, 1, pass ? '#000' : c);
    }
  }
}
