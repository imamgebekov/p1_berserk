// Мелкие частицы эффектов оружия и плаща (только картинка, на симуляцию не влияют).
import { clamp } from '../util.js';
import { env } from '../env.js';
import { R, g } from './gfx.js';

export function createFxPool(max = 48) {
  const ps = [];
  return {
    emit(x, y, c, vx, vy, life = .6) {
      if (env.reduce || ps.length >= max) return;
      ps.push({ x, y, vx, vy, life, c });
    },
    step(dt) {
      let k = 0;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.life > 0) ps[k++] = p;
      }
      ps.length = k;
    },
    draw() {
      for (const p of ps) { g.globalAlpha = clamp(p.life * 2, 0, 1); R(p.x, p.y, 1, 1, p.c); }
      g.globalAlpha = 1;
    },
    get size() { return ps.length; }
  };
}
