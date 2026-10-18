// Уровни: поверхность и подземелья. У каждого уровня свои карта, враги, вещи на земле и туман войны;
// W.map, W.enemies, W.drops, W.seen всегда указывают на текущий уровень, поэтому стены, удары и снаряды работают без правок.
import { clamp, len } from './util3d.js';
import { makeLevelMap, resolve } from './map.js';
import { reveal } from './places3d.js';
import { mulberry32, spawnEnemy } from './sim.js';
import { bossAway } from './boss3d.js';

export const SURFACE = 'surface';
export const onSurface = W => W.lvl === SURFACE;

// сетка тумана войны для прямоугольника (или круга радиуса R вокруг нуля)
function fogFor(R, c, rev) { const n = Math.ceil(2 * R / c) + 2; return { seenN: n, seenR: R, seenC: c, revR: rev, seen: new Uint8Array(n * n) }; }

export function initLevels(W) {
  const cfg = W.cfg;
  W.lvl = SURFACE;
  W.levels = { [SURFACE]: { id: SURFACE, def: null, map: W.map, enemies: W.enemies, drops: W.drops, spawnT: W.spawnT, seen: W.seen, seenN: W.seenN, seenR: cfg.world.radius, seenC: cfg.map.cell, revR: cfg.map.reveal, rng: W.rng } };
  // у подземелья свой поток случайных чисел: новые подземелья не сдвигают добычу и бои наверху (в тестах с зерном — воспроизводимо, в игре — Math.random)
  ((cfg.dungeons && cfg.dungeons.list) || []).forEach((def, i) => {
    const map = makeLevelMap(cfg, def), B = map.bounds, R = Math.max(-B.x0, B.x1, -B.z0, B.z1) + 2;
    const rng = W.rng === Math.random ? Math.random : mulberry32(cfg.dungeons.seed + i);
    W.levels[def.id] = { id: def.id, def, map, enemies: [], drops: [], spawnT: 1, rng, ...fogFor(R, cfg.dungeons.cell, cfg.dungeons.reveal) };
  });
  W.seenR = cfg.world.radius; W.seenC = cfg.map.cell; W.revR = cfg.map.reveal;
}

function stash(W) { const L = W.levels[W.lvl]; L.enemies = W.enemies; L.drops = W.drops; L.spawnT = W.spawnT; }
function load(W, id) { const L = W.levels[id]; W.lvl = id; W.map = L.map; W.enemies = L.enemies; W.drops = L.drops; W.spawnT = L.spawnT; W.seen = L.seen; W.seenN = L.seenN; W.seenR = L.seenR; W.seenC = L.seenC; W.revR = L.revR; W.rng = L.rng; }

// выполнить fn так, будто текущий уровень — id (возрождение боссов, наполнение контейнеров на других уровнях)
export function withLevel(W, id, fn) {
  if (W.lvl === id) return fn();
  const cur = W.lvl, inside = W.inside; stash(W); load(W, id);
  try { return fn(); } finally { stash(W); load(W, cur); W.inside = inside; }
}

// «глубина» точки 0–1: на поверхности — кривая по расстоянию от костра (world.depth), в подземелье — число из конфига
export function depthAt(W, x, z) {
  const L = W.levels && W.levels[W.lvl];
  return L && L.def ? L.def.depth : depthCurve(W.cfg, len(x, z));
}
// уровень места (этап 0): глубина 0–1 (ядро) → 1…core, 1–depthMax → core…edge; дробный, для показа — округлить
export function levelOfDepth(cfg, d) { const L = cfg.level, M = cfg.world.depthMax || 1; return d <= 1 || M <= 1 ? 1 + (L.core - 1) * Math.min(1, d) : L.core + (L.edge - L.core) * Math.min(1, (d - 1) / (M - 1)); }
export const levelAt = (W, x, z) => levelOfDepth(W.cfg, depthAt(W, x, z));
export function depthCurve(cfg, d) {
  const P = cfg.world.depth || [[0, 0], [cfg.world.radius, 1]], M = cfg.world.depthMax || 1;     // за ядром большого мира глубина растёт до depthMax (C3b)
  if (d <= P[0][0]) return clamp(P[0][1], 0, M);
  for (let i = 1; i < P.length; i++) if (d <= P[i][0]) { const [a, da] = P[i - 1], [b, db] = P[i]; return clamp((d - a) / (b - a) * (db - da) + da, 0, M); }
  return clamp(P[P.length - 1][1], 0, M);
}
// обратная кривая: точка на поверхности с заданной глубиной (для тестов баланса), под углом ang от костра
export function pointAtDepth(cfg, depth, ang = 0) {
  const P = cfg.world.depth || [[0, 0], [cfg.world.radius, 1]]; let d = P[P.length - 1][0];
  for (let i = 1; i < P.length; i++) if (depth <= P[i][1]) { const [a, da] = P[i - 1], [b, db] = P[i]; d = db === da ? a : a + (depth - da) / (db - da) * (b - a); break; }
  return { x: Math.sin(ang) * d, z: Math.cos(ang) * d };
}

// люк или лестница рядом с героем (для кнопки «Спуститься» / «Подняться»)
export function portalNear(W) {
  const p = W.player; if (p.dead) return null;
  const r = W.cfg.dungeons.reach;
  return W.map.portals.find(q => len(q.x - p.x, q.z - p.z) < r) || null;
}
export function portalName(W, q) { return q.up ? (q.to === SURFACE ? 'Подняться' : 'Подняться: ' + W.levels[q.to].def.name) : 'Спуститься: ' + W.levels[q.to].def.name; }

// уход с уровня: запомнить время; враги подземелья теряют героя
function leave(W) { const L = W.levels[W.lvl]; L.leftT = W.t; if (L.def) for (const e of W.enemies) e.alert = false; }
// приход на уровень: подземелье наполняется врагами при первом входе и если героя не было dungeons.respawnAway секунд;
// наверху боссы за это время вернулись в логово и подлечились
function arrive(W) {
  const L = W.levels[W.lvl], away = L.leftT === undefined ? Infinity : W.t - L.leftT;
  for (const e of W.enemies) if (e.boss) bossAway(W, e, away);
  if (!L.def) return;
  if (away >= W.cfg.dungeons.respawnAway) { const keep = W.enemies.filter(e => e.boss); W.enemies = L.enemies = keep; spawnFoes(W, L); }     // босс замка не пропадает при наполнении этажа
}
// враги по комнатам: spawns [{ room, n, type? }], тип без указания — по весам foes; не у входа и не у стен
export function spawnFoes(W, L) {
  const D = W.cfg.dungeons, def = L.def, M = L.map, rng = W.rng;
  const pick = () => { const t = def.foes.reduce((a, f) => a + f[1], 0); let r = rng() * t; for (const f of def.foes) if ((r -= f[1]) <= 0) return f[0]; return def.foes[0][0]; };
  if (def.guard) {                                                                // страж замка: крепкий, элитный, с ключом трона
    const G = def.guard, C = W.cfg.enemies[G.type], e = spawnEnemy(W, G.type, G.x, G.z);
    e.hp = e.maxhp = Math.round(e.maxhp * G.hp); e.dmgMul *= G.dmg; e.scaleMul = 1.35; e.elite = true; e.affName = 'Страж'; e.affColor = '#ffd27a'; e.guard = G.key;
  }
  for (const s of def.spawns || []) {
    const room = M.rooms.find(r => r.id === s.room); if (!room) continue;
    for (let k = 0; k < s.n; k++) {
      let x = 0, z = 0;
      for (let a = 0; a < 12; a++) {
        x = room.x0 + D.spawnPad + rng() * Math.max(0, room.x1 - room.x0 - 2 * D.spawnPad); z = room.z0 + D.spawnPad + rng() * Math.max(0, room.z1 - room.z0 - 2 * D.spawnPad);
        if (len(x - def.entry.x, z - def.entry.z) >= D.spawnSafe) break;
      }
      spawnEnemy(W, s.type || pick(), x, z);
    }
  }
}

// перейти на уровень id в точку (x, z): отряд идёт следом, снаряды и отложенные удары пропадают
export function travel(W, id, x, z) {
  if (!W.levels[id]) return false;
  const p = W.player;
  leave(W); stash(W); load(W, id); arrive(W);
  Object.assign(p, { x, z, vx: 0, vz: 0, state: 'idle', atkT: 0, rollT: 0 });
  p.inv = Math.max(p.inv, .8);
  resolve(W.map, p, W.cfg.player.radius);
  W.proj.length = 0; W.haz.length = 0; W.echoQ.length = 0; W.inside = -1; W.hudBoss = null;
  W.allies.forEach((a, i) => { if (a.dead || a.guest) return; const ang = p.face + Math.PI + (i - 1) * .9; a.x = p.x + Math.sin(ang) * 1.4; a.z = p.z + Math.cos(ang) * 1.4; a.vx = a.vz = 0; a.state = 'idle'; a.tg = null; resolve(W.map, a, .45); });
  reveal(W, p.x, p.z, W.revR); W.revealT = .3;
  W.ev.push({ k: 'travel', to: id, up: id === SURFACE });
  return true;
}
export function usePortal(W) { const q = portalNear(W); return q ? travel(W, q.to, q.tx, q.tz) : false; }

// после смерти герой встаёт у костра: возвращаем его на поверхность
export function backToSurface(W) { if (W.lvl === SURFACE) return; leave(W); stash(W); load(W, SURFACE); arrive(W); W.inside = -1; }
