// Частицы и всплывающие числа. Список ограничен, чтобы кадр на телефоне не разрастался.
import { CFG } from './config.js';
import { W } from './state.js';
import { rnd, pick, random } from './util.js';

export const BLOOD = ['#a1121f', '#6d0c14', '#c0222c'];

export function burst(x, z, n, cols, sp = 60, up = 40) {
  const room = CFG.fx.maxParticles - W.parts.length;
  if (room <= 0) return;
  if (n > room) n = room;
  for (let i = 0; i < n; i++)
    W.parts.push({ x, z, vx: rnd(-sp, sp), vz: rnd(10, up + 30), life: rnd(.4, 1), c: pick(cols), s: random() < .3 ? 2 : 1 });
}

export function dmgNum(x, z, n, c) { W.nums.push({ x, z, n, t: 0, c }); }

export function stepParticles(dt, floorClamp) {
  const ps = W.parts;
  let k = 0;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    p.life -= dt; p.vz -= 260 * dt; p.x += p.vx * dt; p.z += p.vz * dt;
    if (p.z < 0) { p.z = 0; if (!floorClamp) { p.vz *= -.25; p.vx *= .5; } }
    if (p.life > 0) ps[k++] = p;
  }
  ps.length = k;
}

export function stepNums(dt) {
  const ns = W.nums;
  let k = 0;
  for (let i = 0; i < ns.length; i++) { ns[i].t += dt; if (ns[i].t < .8) ns[k++] = ns[i]; }
  ns.length = k;
}
