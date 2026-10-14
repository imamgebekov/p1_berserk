// Слоистый герой: плащ → ноги → тело/броня → амулет → голова/шлем → оружие → рука с кольцом.
// Каждый слой берёт палитру предмета (data/items.js → pal) и форму из data/looks.js. Одна функция рисует
// и героя в мире, и крупный предпросмотр на экране персонажа (поза передаётся параметром).
import { ITEMS_BY_ID } from '../data/items.js';
import { LOOKS, DEFAULT_WEAPON, DEFAULT_STEEL } from '../data/looks.js';
import { env } from '../env.js';
import { lerp, clamp, vrnd } from '../util.js';
import { R, g } from './gfx.js';

const palOf = it => ITEMS_BY_ID[it.id].pal;
const lookOf = it => LOOKS[it.id];

// ---- цвета ----
const memo = new Map();
function shade(hex, t) {               // t > 0 светлее, t < 0 темнее
  const key = hex + t, hit = memo.get(key);
  if (hit) return hit;
  const n = parseInt(hex.slice(1), 16);
  const f = x => Math.round(t >= 0 ? x + (255 - x) * t : x * (1 + t));
  const v = `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  memo.set(key, v); return v;
}
function mix(a, b, t) {
  const key = a + b + t, hit = memo.get(key);
  if (hit) return hit;
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const f = (s, d) => Math.round(s + (d - s) * t);
  const v = `rgb(${f(x >> 16, y >> 16)},${f((x >> 8) & 255, (y >> 8) & 255)},${f(x & 255, y & 255)})`;
  memo.set(key, v); return v;
}

const GRIP = '#2a1a12', GUARD = '#8a7a62', WOOD = '#4a3220';
const BLOCKS = w => w <= 2 ? [0] : w === 3 ? [-1, 1] : w === 4 ? [-2, 0] : [-2, 0, 2];

// ---- плащ ----
function drawCape(X, pose, it, pool) {
  const { fy, T } = pose;
  const sway = env.reduce ? 0 : Math.round(Math.sin(T * 4));
  if (!it) { R(X(-7 - sway, 3), fy - 13, 3, 9, '#080606'); return; }
  const L = lookOf(it), pal = palOf(it), w = L.w, len = L.len;
  const trail = pose.moving && !env.reduce ? (L.kind === 'flow' ? 2 : 1) : 0;
  const x0 = -4 - w - sway - trail, top = fy - 14;
  R(X(x0, w), top, w, len, pal[0]);
  R(X(x0, 1), top, 1, len, pal[1]);
  switch (L.kind) {
    case 'rag': R(X(x0 + 1, 1), top + len, 1, 1, pal[0]); break;
    case 'trav': R(X(-5, 2), fy - 15, 2, 1, pal[0]); break;
    case 'tatter': for (let j = 0; j < w; j += 2) R(X(x0 + j, 1), top + len, 1, 2, pal[0]); break;
    case 'raven': for (let j = 0; j < w; j++) R(X(x0 + j, 1), top + len, 1, (j % 2) + 1, pal[1]); break;
    case 'flow': R(X(x0 + 2, 1), top + 1, 1, len - 2, pal[1]); R(X(x0 + w - 1, 1), top + len - 3, 1, 3, shade(pal[0], .3)); break;
    case 'ash':
      if (pool && !env.reduce && Math.random() < pose.dt * 3) pool.emit(X(x0 + (w >> 1), 1), top + len, '#9a948a', vrnd(-4, 4), 10, .8);
      break;
  }
}

// ---- тело: возвращает цвет рукава ----
function drawBody(X, pose, it) {
  const { fy, T } = pose;
  const base = pose.white ? '#e8e0cc' : (pose.rage ? '#2a0a0c' : '#100c0b');
  if (!it) {
    R(X(-4, 8), fy - 13, 8, 8, base);
    R(X(-5, 3), fy - 14, 3, 3, '#4a463f');
    R(X(-4, 8), fy - 6, 8, 1, '#2a2422');
    return base;
  }
  const L = lookOf(it), pal = palOf(it);
  const c0 = pose.white ? '#e8e0cc' : pal[0], c1 = pose.white ? '#cfc6b0' : pal[1];
  const pulse = env.reduce ? .8 : .55 + .35 * Math.sin(T * 5);
  switch (L.kind) {
    case 'rags':
      R(X(-4, 8), fy - 13, 8, 8, base);
      R(X(-4, 8), fy - 13, 8, 6, c0); R(X(-4, 2), fy - 7, 2, 2, c0); R(X(-1, 2), fy - 7, 2, 1, c0); R(X(2, 2), fy - 7, 2, 2, c0);
      R(X(0, 2), fy - 11, 2, 2, c1); R(X(-5, 3), fy - 14, 3, 3, c1);
      break;
    case 'leather':
      R(X(-4, 8), fy - 13, 8, 8, base);
      R(X(-4, 8), fy - 13, 8, 7, c0); R(X(0, 1), fy - 12, 1, 6, c1); R(X(-3, 6), fy - 13, 6, 1, c1);
      R(X(-4, 8), fy - 6, 8, 1, c1); R(X(-5, 3), fy - 14, 3, 3, c1);
      break;
    case 'mail':
      for (let y = 0; y < 8; y++) R(X(-4, 8), fy - 13 + y, 8, 1, y % 2 ? c1 : c0);
      R(X(-5, 3), fy - 14, 3, 3, c0); R(X(2, 3), fy - 14, 3, 2, c0); R(X(-4, 8), fy - 6, 8, 1, '#2a2422');
      break;
    case 'plate': case 'hide':
      R(X(-4, 8), fy - 13, 8, 8, c0);
      if (L.kind === 'plate') {
        R(X(-2, 4), fy - 12, 4, 2, shade(c0, .35)); R(X(0, 1), fy - 12, 1, 5, c1);
        R(X(-6, 4), fy - 15, 4, 3, c0); R(X(2, 4), fy - 15, 4, 3, c0);
        R(X(-6, 4), fy - 15, 4, 1, shade(c0, .4)); R(X(2, 4), fy - 15, 4, 1, shade(c0, .4));
        R(X(-4, 8), fy - 6, 8, 1, c1);
        if (L.glow) { g.globalAlpha = pulse; R(X(-1, 3), fy - 10, 3, 1, '#ff6a3a'); R(X(0, 1), fy - 11, 1, 3, '#ff6a3a'); g.globalAlpha = 1; }
      } else {
        R(X(-3, 6), fy - 12, 6, 2, c1); R(X(-3, 6), fy - 9, 6, 2, c1);
        R(X(-5, 3), fy - 14, 3, 3, c0); R(X(-5, 1), fy - 17, 1, 3, c1); R(X(3, 1), fy - 17, 1, 3, c1);
        R(X(-4, 8), fy - 6, 8, 1, '#2a2422');
      }
      break;
    case 'shroud':
      R(X(-4, 8), fy - 13, 8, 11, c0);
      for (let j = 0; j < 8; j += 2) R(X(-4 + j, 1), fy - 2, 1, 1, c0);
      R(X(-1, 1), fy - 8, 1, 5, c1); R(X(2, 1), fy - 9, 1, 6, c1); R(X(-3, 6), fy - 14, 6, 2, c1);
      break;
    default:
      R(X(-4, 8), fy - 13, 8, 8, c0);
  }
  return c0;
}

// ---- голова ----
function drawHead(X, pose, it) {
  const { fy, T } = pose;
  const eye = pose.rage ? '#ff3030' : '#1a1210';
  const L = it && lookOf(it), pal = it && palOf(it);
  if (L && L.kind === 'hood') {
    const c0 = pal[0], c1 = pal[1];
    R(X(-3, 7), fy - 21, 7, 8, c0); R(X(-2, 2), fy - 22, 2, 1, c0); R(X(-3, 7), fy - 21, 7, 1, c1);
    R(X(0, 3), fy - 18, 3, 3, '#0a0808'); R(X(1, 1), fy - 17, 1, 1, pose.rage ? '#ff3030' : '#c9b8a0');
    return;
  }
  R(X(-2, 5), fy - 18, 5, 5, '#cdb89a');
  R(X(-3, 7), fy - 20, 7, 3, '#0a0808'); R(X(-3, 2), fy - 21, 2, 1, '#0a0808'); R(X(0, 2), fy - 21, 2, 1, '#0a0808');
  R(X(1, 1), fy - 16, 1, 1, eye);
  if (!L) return;
  const c0 = pal[0], c1 = pal[1];
  switch (L.kind) {
    case 'helm':
      R(X(-3, 7), fy - 21, 7, 4, c0); R(X(-3, 7), fy - 18, 7, 1, c1);
      R(X(-3, 1), fy - 17, 1, 3, c0); R(X(3, 1), fy - 17, 1, 3, c0);
      if (L.skull) {
        R(X(-1, 1), fy - 17, 1, 2, '#050303'); R(X(1, 1), fy - 17, 1, 2, pose.rage ? '#ff3030' : '#050303'); R(X(-1, 3), fy - 14, 3, 1, c1);
      } else { R(X(0, 3), fy - 17, 3, 1, '#050303'); R(X(1, 1), fy - 16, 1, 1, eye); R(X(0, 1), fy - 17, 1, 3, c1); }
      if (L.horns) {
        R(X(-4, 1), fy - 20, 1, 2, '#d8cfb8'); R(X(-5, 1), fy - 22, 1, 2, '#d8cfb8');
        R(X(4, 1), fy - 20, 1, 2, '#d8cfb8'); R(X(5, 1), fy - 22, 1, 2, '#d8cfb8');
      }
      break;
    case 'mask':
      R(X(-2, 5), fy - 17, 5, 4, c0); R(X(-1, 1), fy - 16, 1, 1, '#050303'); R(X(1, 1), fy - 16, 1, 1, eye); R(X(-1, 3), fy - 14, 3, 1, c1);
      break;
    case 'crown': {
      R(X(-3, 7), fy - 21, 7, 1, c0);
      R(X(-3, 1), fy - 23, 1, 2, c0); R(X(0, 1), fy - 24, 1, 3, c0); R(X(3, 1), fy - 23, 1, 2, c0);
      g.globalAlpha = env.reduce ? .8 : .5 + .4 * Math.sin(T * 6);
      R(X(0, 1), fy - 21, 1, 1, '#ff3a2a'); g.globalAlpha = 1;
      break;
    }
  }
}

// ---- оружие ----
function drawWeapon(pose, eq, hx, hy, ang, pool) {
  const { f, T } = pose;
  const it = eq.weapon, L = it ? lookOf(it) : DEFAULT_WEAPON, pal = it ? palOf(it) : DEFAULT_STEEL;
  let main = pal[0];
  const acc = pal[1];
  if (pose.rage) main = mix(main, '#ff8a6a', .4);
  const dark = shade(main, -.25), hi = shade(main, .5);
  const c = Math.cos(ang) * f, s = Math.sin(ang), px = -s, py = c;
  const len = L.len + (pose.heavy && pose.swing >= 0 ? 5 : 0), grip = 5, kind = L.kind, fx = L.fx, still = env.reduce;
  const flick = still ? 0 : (T * 12) | 0;
  const pulse = still || ((T * 6) | 0) % 2 === 0;
  const glint = grip + 2 + (still ? 3 : ((T * 14) | 0) % Math.max(1, len - grip - 2));
  const bladeLen = Math.max(1, len - grip - 2);
  for (let i = 0; i <= len; i++) {
    const x = hx + c * i, y = hy + s * i;
    if (i < grip) { R(x, y, 2, 2, GRIP); continue; }
    if (i < grip + 2) {
      if (L.guard === 'none') R(x, y, 2, 2, acc);
      else {
        const e = L.guard === 'wide' ? 4 : 2;
        R(x - px * e, y - py * e, 2, 2, GUARD); R(x, y, 2, 2, GUARD); R(x + px * e, y + py * e, 2, 2, GUARD);
        if (e > 2) { R(x - px * 2, y - py * 2, 2, 2, GUARD); R(x + px * 2, y + py * 2, 2, 2, GUARD); }
      }
      continue;
    }
    const t = (i - grip - 2) / bladeLen;
    if (kind === 'axe') {
      R(x, y, 2, 2, WOOD);
      const j = (i - (len - 12)) / 10;
      if (j >= 0 && j <= 1) {
        const hw = Math.round(5 * Math.sin(Math.PI * j));
        for (let k = -hw; k <= hw; k += 2) R(x + px * k, y + py * k, 2, 2, Math.abs(k) >= hw - 1 ? hi : main);
      }
    } else {
      let ks = BLOCKS(L.w), sz = 2, ox = 0, oy = 0;
      if (kind === 'curved') { const o = Math.round(3 * Math.sin(Math.PI * t)); ox = px * o; oy = py * o; }
      if (kind === 'cleaver') ks = BLOCKS(2 + Math.min(L.w - 2, (t * 4) | 0));
      const taper = kind === 'great' ? 4 : kind === 'slab' || kind === 'cleaver' ? 0 : 3;
      if (taper && i > len - taper) { ks = [0]; sz = 1; }
      for (let b = 0; b < ks.length; b++) R(x + ox + px * ks[b], y + oy + py * ks[b], sz, sz, b === 0 ? main : dark);
      if (i % 3 === 0 && sz === 2) R(x + ox + 1, y + oy + 1, 1, 1, kind === 'slab' || kind === 'great' ? hi : acc);
      if (kind === 'serrated' && i % 3 === 0) R(x + px * 2, y + py * 2, 2, 1, acc);
    }
    // эффекты редких
    if (fx === 'ember') { if (((i + flick) % 5) < 2) R(x + px, y + py, 1, 1, '#ff8a3a'); }
    else if (fx === 'curse') { if (i % 2 === 0) R(x + px * 2, y + py * 2, 1, 1, '#b070e8'); }
    else if (fx === 'brand') { if (i % 2 === 0) R(x + 1, y + 1, 1, 1, pulse ? '#ff6a3a' : '#ffb070'); }
    else if (fx === 'sparks' && i === glint) R(x + 1, y, 1, 1, '#fff6d8');
  }
  // искры/угольки/дымка у конца и вдоль клинка
  if (fx && pool && !still) {
    const dt = pose.dt, at = vrnd(grip + 3, len), ex = hx + c * at, ey = hy + s * at;
    if (fx === 'sparks' && Math.random() < dt * 5) pool.emit(hx + c * len, hy + s * len, '#fff6d8', vrnd(-14, 14), vrnd(-24, -6), .35);
    else if (fx === 'ember' && Math.random() < dt * 9) pool.emit(ex, ey, Math.random() < .5 ? '#ff8a3a' : '#e0602a', vrnd(-5, 5), vrnd(-22, -10), .7);
    else if (fx === 'curse' && Math.random() < dt * 6) pool.emit(ex, ey, '#8a5ac0', vrnd(-4, 4), vrnd(6, 16), .6);
    else if (fx === 'brand' && Math.random() < dt * 11) pool.emit(ex, ey, Math.random() < .5 ? '#ff6a3a' : '#c0222c', vrnd(-6, 6), vrnd(-26, -8), .8);
  }
  return len;
}

const TRAIL = { ember: '#ff8a3a', curse: '#b070e8', brand: '#e0402a', sparks: '#f6eed9' };

// ---- сборка героя ----
// pose: { sx, fy, f, T, dt, rage, moving, walk, white, swing (-1 | 0..1), heavy, ang? (угол клинка в покое) }
export function drawHero(pose, eq, pool) {
  const { sx, fy, f, T } = pose;
  const X = (dx, w) => f > 0 ? sx + dx : sx - dx - w + 1;
  if (pose.rage) R(sx - 8, fy - 24, 16, 24, `rgba(190,20,30,${env.reduce ? .15 : .12 + .06 * Math.sin(T * 14)})`);
  drawCape(X, pose, eq.cloak, pool);
  const st = pose.moving ? (Math.sin(pose.walk) > 0 ? 1 : 0) : 0;
  R(X(-3, 2), fy - 5, 2, 5 - st, '#191413'); R(X(1, 2), fy - 5, 2, 5 - (1 - st), '#191413');
  const sleeve = drawBody(X, pose, eq.body);
  if (eq.amulet) {
    const pal = palOf(eq.amulet), L = lookOf(eq.amulet);
    R(X(1, 1), fy - 12, 1, 1, pal[1]); R(X(1, 2), fy - 11, 2, 2, pal[0]);
    if (L.glow && (env.reduce || ((T * 3) | 0) % 2 === 0)) R(X(1, 1), fy - 11, 1, 1, shade(pal[0], .6));
  }
  drawHead(X, pose, eq.head);
  // меч
  const hx = sx + f * 3, hy = fy - 10;
  let ang;
  const wfx = eq.weapon ? lookOf(eq.weapon).fx : null;
  if (pose.swing >= 0) {
    const p = clamp(pose.swing, 0, 1), e = 1 - Math.pow(1 - p, 3), a0 = -2.0, a1 = 1.0;
    ang = lerp(a0, a1, e);
    if (p > .15) {
      const tl = (eq.weapon ? lookOf(eq.weapon).len : DEFAULT_WEAPON.len) + (pose.heavy ? 5 : 1);
      const n = wfx === 'brand' ? 13 : 8, col = pose.rage ? '#ff6a4a' : (TRAIL[wfx] || '#e8e0cc');
      g.globalAlpha = .45;
      for (let k = 1; k < n; k++) {
        const ak = ang - k * .13;
        if (ak < a0) break;
        R(hx + Math.cos(ak) * f * tl, hy + Math.sin(ak) * tl, 2, 2, col);
        if (wfx === 'brand' || tl > 36) R(hx + Math.cos(ak) * f * (tl - 5), hy + Math.sin(ak) * (tl - 5), 2, 2, col);
      }
      g.globalAlpha = 1;
    }
  } else ang = pose.ang !== undefined ? pose.ang : -1.85 + (pose.moving ? Math.sin(pose.walk) * .06 : 0);
  drawWeapon(pose, eq, hx, hy, ang, pool);
  R(X(2, 3), fy - 11, 3, 2, sleeve);
  if (eq.ring) {
    const pal = palOf(eq.ring), L = lookOf(eq.ring);
    R(X(4, 1), fy - 11, 1, 1, L.glow && !env.reduce && ((T * 4) | 0) % 2 ? shade(pal[0], .6) : pal[0]);
  }
}
