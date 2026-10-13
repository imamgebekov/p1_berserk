// Спрайты героя, врагов и «игроков». Всё — прямоугольники, ни одной картинки.
// (Шаг 2 превратит героя в слоистый спрайт.)
import { W, P, V, keys } from '../state.js';
import { lerp, clamp } from '../util.js';
import { env } from '../env.js';
import { R, line, g } from './gfx.js';

function drawSword(hx, hy, ang, f, len, rage) {
  const c = Math.cos(ang) * f, s = Math.sin(ang);
  const steel = rage ? '#e8c8c0' : '#cfc9bb', edge = '#7d776b';
  for (let i = 0; i <= len; i++) {
    const x = hx + c * i, y = hy + s * i;
    if (i < 5) R(x, y, 2, 2, '#2a1a12');
    else if (i === 5 || i === 6) { R(x - s * 2, y + c * 2, 2, 2, '#8a7a62'); R(x, y, 2, 2, '#8a7a62'); R(x + s * 2, y - c * 2, 2, 2, '#8a7a62'); }
    else { R(x, y, 2, 2, steel); if (i % 3 === 0) R(x + 1, y + 1, 1, 1, edge); }
  }
}

export function drawPlayer() {
  const T = W.T, camX = W.camX, G = V.G;
  const sx = Math.round(P.x - camX), fy = Math.round(G - P.z), f = P.face, rage = P.rageOn > 0;
  const moving = (keys.l || keys.r) && P.swingT < 0;
  const st = moving ? (Math.sin(P.walk) > 0 ? 1 : 0) : 0;
  const white = P.inv > 0 && Math.floor(T * 22) % 2 === 0;
  const cloak = white ? '#e8e0cc' : (rage ? '#2a0a0c' : '#100c0b');
  const X = (dx, w) => f > 0 ? sx + dx : sx - dx - w + 1;
  if (rage) R(sx - 8, fy - 24, 16, 24, `rgba(190,20,30,${.12 + .06 * Math.sin(T * 14)})`);
  // плащ
  const sway = env.reduce ? 0 : Math.round(Math.sin(T * 4) * 1);
  R(X(-7 - sway, 3), fy - 13, 3, 9, '#080606');
  // ноги
  R(X(-3, 2), fy - 5, 2, 5 - st, '#191413'); R(X(1, 2), fy - 5, 2, 5 - (1 - st), '#191413');
  // тело
  R(X(-4, 8), fy - 13, 8, 8, cloak);
  R(X(-5, 3), fy - 14, 3, 3, '#4a463f');
  R(X(-4, 8), fy - 6, 8, 1, '#2a2422');
  // голова
  R(X(-2, 5), fy - 18, 5, 5, '#cdb89a');
  R(X(-3, 7), fy - 20, 7, 3, '#0a0808'); R(X(-3, 2), fy - 21, 2, 1, '#0a0808'); R(X(0, 2), fy - 21, 2, 1, '#0a0808');
  R(X(1, 1), fy - 16, 1, 1, rage ? '#ff3030' : '#1a1210');
  // меч
  const hx = sx + f * 3, hy = fy - 10;
  let ang;
  if (P.swingT >= 0) {
    const p = clamp(P.swingT / P.swingDur, 0, 1), e = 1 - Math.pow(1 - p, 3);
    const a0 = -2.0, a1 = 1.0;
    ang = lerp(a0, a1, e);
    if (p > .15) {
      g.globalAlpha = .45;
      for (let k = 1; k < 9; k++) {
        const ak = ang - k * .13;
        if (ak < a0) break;
        const L = P.heavy ? 36 : 30;
        R(hx + Math.cos(ak) * f * L, hy + Math.sin(ak) * L, 2, 2, rage ? '#ff6a4a' : '#e8e0cc');
      }
      g.globalAlpha = 1;
    }
  } else ang = -1.85 + (moving ? Math.sin(P.walk) * .06 : 0);
  drawSword(hx, hy, ang, f, P.heavy && P.swingT >= 0 ? 34 : 29, rage);
  // рука
  R(X(2, 3), fy - 11, 3, 2, cloak);
}

export function drawEnemy(e) {
  const T = W.T, G = V.G;
  const sx = Math.round(e.x - W.camX), fy = G, f = e.face;
  const X = (dx, w) => f > 0 ? sx + dx : sx - dx - w + 1;
  const white = e.flash > 0;
  const winding = e.st === 'wind' && Math.floor(T * 16) % 2 === 0;
  if (e.type === 'imp') {
    const b = white ? '#fff' : winding ? '#6a2a2a' : '#3b3345';
    R(X(-3, 6), fy - 6, 6, 5, b); R(X(-3, 6), fy - 10, 6, 4, b);
    R(X(-5, 2), fy - 11, 2, 2, b); R(X(3, 2), fy - 11, 2, 2, b);
    R(X(0, 1), fy - 8, 1, 1, '#ff3030'); R(X(2, 1), fy - 8, 1, 1, '#ff3030');
    R(X(-2, 1), fy - 1, 1, 1, b); R(X(1, 1), fy - 1, 1, 1, b);
    R(X(3, 3), fy - 5, e.st === 'wind' ? 4 : 3, 1, '#d8cfbd');
  } else if (e.type === 'brute') {
    const b = white ? '#fff' : winding ? '#7a3030' : '#4a3430';
    R(X(-6, 12), fy - 12, 12, 9, b); R(X(-3, 7), fy - 16, 7, 5, b);
    R(X(-4, 2), fy - 19, 2, 3, '#d8cfbd'); R(X(3, 2), fy - 19, 2, 3, '#d8cfbd');
    R(X(2, 1), fy - 14, 1, 1, '#ff3030'); R(X(-1, 1), fy - 14, 1, 1, '#ff3030');
    R(X(5, 5), fy - 10, e.st === 'wind' ? 7 : 5, 3, b);
    R(X(-5, 4), fy - 4, 4, 4, '#2a1c1a'); R(X(1, 4), fy - 4, 4, 4, '#2a1c1a');
  } else if (e.type === 'lord') {
    const b = white ? '#fff' : winding ? '#5a2030' : '#2a1f2b';
    R(X(-9, 18), fy - 20, 18, 14, b); R(X(-7, 5), fy - 6, 5, 6, '#1a121a'); R(X(2, 5), fy - 6, 5, 6, '#1a121a');
    R(X(-5, 10), fy - 28, 10, 8, white ? '#fff' : '#cfc6b0');
    R(X(-3, 2), fy - 25, 2, 2, '#000'); R(X(1, 2), fy - 25, 2, 2, '#000');
    R(X(-2, 1), fy - 24, 1, 1, '#ff3030'); R(X(2, 1), fy - 24, 1, 1, '#ff3030');
    R(X(-8, 3), fy - 33, 3, 5, '#d8cfbd'); R(X(5, 3), fy - 33, 3, 5, '#d8cfbd');
    R(X(-5, 1), fy - 16, 1, 1, '#ff3030'); R(X(1, 1), fy - 14, 1, 1, '#ff3030'); R(X(4, 1), fy - 17, 1, 1, '#ff3030');
    R(X(8, 8), fy - 17, e.st === 'wind' ? 11 : 8, 4, b);
  } else { // boss
    const b = white ? '#fff' : '#0c0a0c';
    const wingC = white ? '#fff' : '#17101a';
    line(sx - 8, fy - 34, sx - 32, fy - 58, wingC, 2); line(sx - 32, fy - 58, sx - 24, fy - 30, wingC, 2); line(sx - 24, fy - 30, sx - 8, fy - 24, wingC, 2);
    line(sx + 8, fy - 34, sx + 32, fy - 58, wingC, 2); line(sx + 32, fy - 58, sx + 24, fy - 30, wingC, 2); line(sx + 24, fy - 30, sx + 8, fy - 24, wingC, 2);
    R(sx - 10, fy - 34, 20, 26, b); R(sx - 7, fy - 8, 6, 8, b); R(sx + 1, fy - 8, 6, 8, b);
    R(sx - 6, fy - 44, 12, 10, b);
    line(sx - 5, fy - 44, sx - 11, fy - 55, '#d8cfbd', 2); line(sx + 5, fy - 44, sx + 11, fy - 55, '#d8cfbd', 2);
    R(sx - 4, fy - 40, 2, 2, '#ff2020'); R(sx + 2, fy - 40, 2, 2, '#ff2020');
    R(sx - 3, fy - 30, 1, 1, '#ff2020'); R(sx + 2, fy - 28, 1, 1, '#ff2020'); R(sx, fy - 33, 1, 1, '#ff2020');
    const up = e.st === 'wind';
    R(X(10, 8), up ? fy - 50 : fy - 28, 8, up ? 20 : 5, b);
    if (up) {
      const cx = sx + f * 22; g.globalAlpha = .45 + .3 * Math.sin(T * 25);
      R(cx - 26, G - 1, 52, 2, '#c4161c'); g.globalAlpha = 1;
    }
  }
  if (e.st === 'wind' && e.type !== 'boss') { R(sx - 1, fy - e.h - 8, 2, 4, '#e0602a'); R(sx - 1, fy - e.h - 3, 2, 1, '#e0602a'); }
  if (e.type !== 'boss' && e.hp < e.maxhp) {
    R(sx - 6, fy - e.h - 12, 12, 2, '#120d0c'); R(sx - 6, fy - e.h - 12, Math.max(1, Math.round(12 * e.hp / e.maxhp)), 2, '#a1121f');
  }
}

export function drawNpc(n) {
  const G = V.G, sx = Math.round(n.x - W.camX), fy = G, f = n.face;
  if (sx < -20 || sx > V.LW + 20) return;
  const X = (dx, w) => f > 0 ? sx + dx : sx - dx - w + 1;
  const st = Math.sin(n.walk) > 0 ? 1 : 0;
  g.globalAlpha = .62;
  R(X(-3, 2), fy - 5, 2, 5 - st, '#1a222a'); R(X(1, 2), fy - 5, 2, 5 - (1 - st), '#1a222a');
  R(X(-3, 6), fy - 12, 6, 7, '#2a3844'); R(X(-2, 4), fy - 16, 4, 4, '#9aa5ad');
  const sw = n.sw >= 0 ? n.sw / .25 : -1;
  const ang = sw >= 0 ? lerp(-1.8, .9, sw) : -1.7;
  const hx = sx + f * 3, hy = fy - 9;
  for (let i = 0; i < 15; i++) R(hx + Math.cos(ang) * f * i, hy + Math.sin(ang) * i, 1, 1, i < 3 ? '#6a5a4a' : '#aeb6bb');
  g.globalAlpha = 1;
}
