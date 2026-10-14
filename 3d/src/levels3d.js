// Уровни: поверхность и подземелья. У каждого уровня свои карта, враги, вещи на земле и туман войны;
// W.map, W.enemies, W.drops, W.seen всегда указывают на текущий уровень, поэтому стены, удары и снаряды работают без правок.
import { clamp, len } from './util3d.js';
import { makeLevelMap, resolve } from './map.js';
import { reveal } from './places3d.js';

export const SURFACE = 'surface';
export const onSurface = W => W.lvl === SURFACE;

// сетка тумана войны для прямоугольника (или круга радиуса R вокруг нуля)
function fogFor(cfg, R) { const n = Math.ceil(2 * R / cfg.map.cell) + 2; return { seenN: n, seenR: R, seen: new Uint8Array(n * n) }; }

export function initLevels(W) {
  const cfg = W.cfg;
  W.lvl = SURFACE;
  W.levels = { [SURFACE]: { id: SURFACE, def: null, map: W.map, enemies: W.enemies, drops: W.drops, spawnT: W.spawnT, seen: W.seen, seenN: W.seenN, seenR: cfg.world.radius } };
  for (const def of (cfg.dungeons && cfg.dungeons.list) || []) {
    const map = makeLevelMap(cfg, def), B = map.bounds, R = Math.max(-B.x0, B.x1, -B.z0, B.z1) + 2;
    W.levels[def.id] = { id: def.id, def, map, enemies: [], drops: [], spawnT: 1, ...fogFor(cfg, R) };
  }
  W.seenR = cfg.world.radius;
}

function stash(W) { const L = W.levels[W.lvl]; L.enemies = W.enemies; L.drops = W.drops; L.spawnT = W.spawnT; }
function load(W, id) { const L = W.levels[id]; W.lvl = id; W.map = L.map; W.enemies = L.enemies; W.drops = L.drops; W.spawnT = L.spawnT; W.seen = L.seen; W.seenN = L.seenN; W.seenR = L.seenR; }

// выполнить fn так, будто текущий уровень — id (возрождение боссов, наполнение контейнеров на других уровнях)
export function withLevel(W, id, fn) {
  if (W.lvl === id) return fn();
  const cur = W.lvl, inside = W.inside; stash(W); load(W, id);
  try { return fn(); } finally { stash(W); load(W, cur); W.inside = inside; }
}

// «глубина» точки 0–1: на поверхности — расстояние от костра, в подземелье — число из конфига
export function depthAt(W, x, z) {
  const L = W.levels && W.levels[W.lvl];
  return L && L.def ? L.def.depth : clamp(len(x, z) / W.cfg.world.radius, 0, 1);
}

// люк или лестница рядом с героем (для кнопки «Спуститься» / «Подняться»)
export function portalNear(W) {
  const p = W.player; if (p.dead) return null;
  const r = W.cfg.dungeons.reach;
  return W.map.portals.find(q => len(q.x - p.x, q.z - p.z) < r) || null;
}
export function portalName(W, q) { return q.up ? 'Подняться' : 'Спуститься: ' + W.levels[q.to].def.name; }

// перейти на уровень id в точку (x, z): отряд идёт следом, снаряды и отложенные удары пропадают
export function travel(W, id, x, z) {
  if (!W.levels[id]) return false;
  const p = W.player;
  stash(W); load(W, id);
  Object.assign(p, { x, z, vx: 0, vz: 0, state: 'idle', atkT: 0, rollT: 0 });
  p.inv = Math.max(p.inv, .8);
  resolve(W.map, p, W.cfg.player.radius);
  W.proj.length = 0; W.haz.length = 0; W.echoQ.length = 0; W.inside = -1; W.hudBoss = null;
  W.allies.forEach((a, i) => { if (a.dead) return; const ang = p.face + Math.PI + (i - 1) * .9; a.x = p.x + Math.sin(ang) * 1.4; a.z = p.z + Math.cos(ang) * 1.4; a.vx = a.vz = 0; a.state = 'idle'; a.tg = null; resolve(W.map, a, .45); });
  reveal(W, p.x, p.z, W.cfg.map.reveal); W.revealT = .3;
  W.ev.push({ k: 'travel', to: id, up: id === SURFACE });
  return true;
}
export function usePortal(W) { const q = portalNear(W); return q ? travel(W, q.to, q.tx, q.tz) : false; }

// после смерти герой встаёт у костра: возвращаем его на поверхность
export function backToSurface(W) { if (W.lvl === SURFACE) return; stash(W); load(W, SURFACE); W.inside = -1; }
