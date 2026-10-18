// Карта: дома, стены, двери. Чистая геометрия без графики (тестируется в Node).
// Стены — прямоугольники (AABB); герой и враги — круги, которые выталкиваются из стен и скользят вдоль них.

import { genWorld } from './world3d.js';
import { riverOf, pushWater, waterDist } from './terrain3d.js';
import { pushCliff, inCliff } from './cliffs3d.js';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const vertDoor = side => side === 'e' || side === 'w';

// локальные координаты внутри дома: u — вдоль дальней от двери стены (0 — середина), v — вглубь от этой стены к двери
export function interiorPos(b, u, v) {
  const s = b.door.side;
  if (s === 'e') return { x: b.ix0 + v, z: b.z + u };
  if (s === 'w') return { x: b.ix1 - v, z: b.z + u };
  if (s === 'n') return { x: b.x + u, z: b.iz1 - v };
  return { x: b.x + u, z: b.iz0 + v };
}
export function roomSize(b) { const vert = b.door.side === 'e' || b.door.side === 'w'; return { depth: vert ? b.ix1 - b.ix0 : b.iz1 - b.iz0, along: vert ? b.iz1 - b.iz0 : b.ix1 - b.ix0, vert }; }

export function makeMap(cfg) {
  const M = cfg.map, t = M.wall, hw = M.doorW / 2;
  const buildings = [], walls = [], containers = [];
  const addC = (kind, x, z, bid) => containers.push({ id: containers.length, kind, x, z, b: bid, ready: false, t: 0, items: [], locked: false, keyTier: 0 });
  M.buildings.forEach((b, id) => {
    const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, z0 = b.z - b.d / 2, z1 = b.z + b.d / 2;
    const off = b.off || 0;
    // дверь: центр проёма, точки «снаружи» и «внутри» для ходьбы врагов, ось стены
    const door = { open: 0, rect: null, side: b.door, x: 0, z: 0, out: { x: 0, z: 0 }, in: { x: 0, z: 0 } };
    const dx = b.door === 'e' ? 1 : b.door === 'w' ? -1 : 0, dz = b.door === 's' ? 1 : b.door === 'n' ? -1 : 0;
    door.x = b.x + dx * b.w / 2 + (dz ? off : 0); door.z = b.z + dz * b.d / 2 + (dx ? off : 0);
    door.out = { x: door.x + dx * 1.7, z: door.z + dz * 1.7 };
    door.in = { x: door.x - dx * 1.7, z: door.z - dz * 1.7 };
    door.rect = vertDoor(b.door) ? { x0: b.door === 'e' ? x1 - t : x0, x1: b.door === 'e' ? x1 : x0 + t, z0: door.z - hw, z1: door.z + hw }
      : { x0: door.x - hw, x1: door.x + hw, z0: b.door === 's' ? z1 - t : z0, z1: b.door === 's' ? z1 : z0 + t };
    const bw = [];
    // стены по x (север/юг) с вырезом под дверь
    const hSeg = (z, zz, side) => {
      if (b.door === side) { const c = b.x + off; bw.push({ x0, x1: c - hw, z0: z, z1: zz }, { x0: c + hw, x1, z0: z, z1: zz }); }
      else bw.push({ x0, x1, z0: z, z1: zz });
    };
    const vSeg = (x, xx, side) => {
      if (b.door === side) { const c = b.z + off; bw.push({ x0: x, x1: xx, z0: z0 + t, z1: c - hw }, { x0: x, x1: xx, z0: c + hw, z1: z1 - t }); }
      else bw.push({ x0: x, x1: xx, z0: z0 + t, z1: z1 - t });
    };
    hSeg(z0, z0 + t, 'n'); hSeg(z1 - t, z1, 's'); vSeg(x0, x0 + t, 'w'); vSeg(x1 - t, x1, 'e');
    const w2 = bw.filter(r => r.x1 - r.x0 > 1e-6 && r.z1 - r.z0 > 1e-6);
    walls.push(...w2);
    buildings.push({ id, x: b.x, z: b.z, w: b.w, d: b.d, x0, x1, z0, z1, ix0: x0 + t, ix1: x1 - t, iz0: z0 + t, iz1: z1 - t, door, walls: w2, kind: b.kind || 'house', chests: [], npc: null, vil: b.vil || null });
    // контейнеры в углах, дальние от двери — первыми
    const bb = buildings[buildings.length - 1], cs = [[bb.ix0 + .8, bb.iz0 + .8], [bb.ix1 - .8, bb.iz0 + .8], [bb.ix0 + .8, bb.iz1 - .8], [bb.ix1 - .8, bb.iz1 - .8]];
    if (b.npc) { const rs = roomSize(bb); const q = interiorPos(bb, 0, rs.depth * .55 - .9); bb.npc = { kind: b.npc, x: q.x, z: q.z }; }
    cs.sort((p, q) => Math.hypot(q[0] - door.x, q[1] - door.z) - Math.hypot(p[0] - door.x, p[1] - door.z));
    (b.chests || []).slice(0, 4).forEach((k, i) => { addC(k, cs[i][0], cs[i][1], id); bb.chests.push(containers[containers.length - 1]); });
  });
  const gen = genWorld(cfg, buildings);
  for (const sp of M.spots || []) addC(sp.kind, sp.x, sp.z, -1);
  // созданные генератором: не ближе 1.6 м к уже стоящим (могилы и алтарь не слипаются)
  for (const sp of gen.spots) if (!containers.some(c => Math.hypot(c.x - sp.x, c.z - sp.z) < 1.6)) addC(sp.kind, sp.x, sp.z, -1);
  { const coreR = cfg.worldgen && cfg.worldgen.on && cfg.world.radius > cfg.worldgen.coreR ? cfg.worldgen.coreR : Infinity; for (const c of containers) c.far = Math.hypot(c.x, c.z) > coreR; }     // сундуки пояса большого мира наполняются, когда герой рядом (C3b)
  const camp = campOf(cfg), { blocks, foeBlocks } = camp ? campWalls(camp) : { blocks: [], foeBlocks: [] };
  blocks.push(...gen.blocks);                                                          // стены замков (C4c)
  const portals = ((cfg.dungeons && cfg.dungeons.list) || []).filter(d => !d.hidden && !d.sub).map(d => ({ x: d.at.x, z: d.at.z, to: d.id, tx: d.entry.x, tz: d.entry.z, up: false }));
  return { level: 'surface', buildings, walls, containers, portals, cfg: M, solids: gen.solids, decor: gen.decor, roads: gen.roads, paths: gen.paths, camp, blocks, foeBlocks, river: riverOf(cfg), plateaus: M.plateaus || [] };
}
export function addFires(map, cfg, firesOf) { map.fires = firesOf(map, cfg); for (const f of map.fires) if (!f.home) map.decor.push({ t: 'campfire', x: f.x, z: f.z, fire: true }); return map;     // костры быстрого перемещения (C3d): вид, не препятствия
}

// какой дом содержит точку (внутри стен), иначе −1
export function insideOf(map, x, z, pad = 0) {
  for (const b of map.buildings) if (x > b.ix0 - pad && x < b.ix1 + pad && z > b.iz0 - pad && z < b.iz1 + pad) return b.id;
  return -1;
}
// точка у здания (с запасом снаружи): для расстановки деревьев и появления врагов
export function nearBuilding(map, x, z, pad) {
  for (const b of map.buildings) if (x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad) return true;
  return false;
}

// вытолкнуть круг (x, z, r) из стен; возвращает true, если сдвинули
// ---- сетка участков (C1): столкновения и проверка линии смотрят только соседние клетки ----
// строится лениво; пересобирается, если поменялось число домов, стен, дверей или препятствий. Кандидаты идут в исходном порядке,
// поэтому результат совпадает с полным перебором до бита
const GCS = 8, GK = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);
function gridOf(map) {
  const nb = map.buildings.length, nk = (map.blocks || []).length, nd = (map.doors || []).length, ns = (map.solids || []).length, nw = map.river ? map.river.pts.length - 1 + (map.river.lakes || []).length * 1000 : 0, G0 = map.grid;
  if (G0 && G0.nb === nb && G0.nk === nk && G0.nd === nd && G0.ns === ns && G0.nw === nw) return G0;
  const cells = new Map();
  const box = (kind, i, x0, z0, x1, z1) => {
    for (let cx = Math.floor(x0 / GCS), cx1 = Math.floor(x1 / GCS); cx <= cx1; cx++) for (let cz = Math.floor(z0 / GCS), cz1 = Math.floor(z1 / GCS); cz <= cz1; cz++) {
      const k = GK(cx, cz); let c = cells.get(k); if (!c) cells.set(k, c = { b: [], k: [], d: [], s: [], w: [] }); c[kind].push(i);
    }
  };
  map.buildings.forEach((b, i) => box('b', i, b.x0, b.z0, b.x1, b.z1));
  (map.blocks || []).forEach((w, i) => box('k', i, w.x0, w.z0, w.x1, w.z1));
  (map.doors || []).forEach((d, i) => box('d', i, d.rect.x0, d.rect.z0, d.rect.x1, d.rect.z1));
  (map.solids || []).forEach((q, i) => box('s', i, q.x - q.r, q.z - q.r, q.x + q.r, q.z + q.r));
  if (map.river) (map.river.lakes || []).forEach((L, k) => { const e = L.r * 1.3; box('w', -(k + 1), L.x - e, L.z - e, L.x + e, L.z + e); });     // озёра — индексы −(k+1)
  if (map.river) { const P = map.river.pts, h = map.river.w / 2; for (let i = 0; i < P.length - 1; i++) box('w', i, Math.min(P[i].x, P[i + 1].x) - h, Math.min(P[i].z, P[i + 1].z) - h, Math.max(P[i].x, P[i + 1].x) + h, Math.max(P[i].z, P[i + 1].z) + h); }     // участки русла
  const wOff = map.river ? map.river.pts.length - 1 : 0, nl = map.river ? (map.river.lakes || []).length : 0;     // отметки озёр — после участков реки
  const mark = { b: new Uint32Array(nb), k: new Uint32Array(nk), d: new Uint32Array(nd), s: new Uint32Array(ns), w: new Uint32Array(wOff + nl) };
  return (map.grid = { cells, nb, nk, nd, ns, nw, mark, stamp: 0, wOff });
}
const byNum = (a, b) => a - b, KINDS = ['b', 'k', 'd', 's', 'w'];
// индексы домов, стен, дверей и препятствий, чьи рамки задевают прямоугольник (в исходном порядке)
export function nearby(map, x0, z0, x1, z1) {
  const G = gridOf(map), out = { b: [], k: [], d: [], s: [], w: [] }, st = ++G.stamp;
  for (let cx = Math.floor(x0 / GCS), cx1 = Math.floor(x1 / GCS); cx <= cx1; cx++) for (let cz = Math.floor(z0 / GCS), cz1 = Math.floor(z1 / GCS); cz <= cz1; cz++) {
    const c = G.cells.get(GK(cx, cz)); if (!c) continue;
    for (const kind of KINDS) { const m = G.mark[kind], o = out[kind]; for (const i of c[kind]) { const j = i < 0 ? G.wOff - i - 1 : i; if (m[j] !== st) { m[j] = st; o.push(i); } } }
  }
  for (const kind of KINDS) if (out[kind].length > 1) out[kind].sort(byNum);
  return out;
}
const RESOLVE_PAD = 4;    // запас поиска: выталкивания за один вызов не уводят дальше

// вытолкнуть круг (x, z, r) из стен; возвращает true, если сдвинули
export function resolve(map, o, r) {
  let hit = false;
  const N = nearby(map, o.x - r - RESOLVE_PAD, o.z - r - RESOLVE_PAD, o.x + r + RESOLVE_PAD, o.z + r + RESOLVE_PAD);
  for (let it = 0; it < 2; it++) {
    for (const bi of N.b) {
      const b = map.buildings[bi];
      if (o.x < b.x0 - r || o.x > b.x1 + r || o.z < b.z0 - r || o.z > b.z1 + r) continue;
      const list = b.door.open < .6 ? b.walls.concat(b.door.rect) : b.walls;
      for (const w of list) {
        const cx = clamp(o.x, w.x0, w.x1), cz = clamp(o.z, w.z0, w.z1), dx = o.x - cx, dz = o.z - cz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        hit = true;
        if (d2 > 1e-12) { const d = Math.sqrt(d2), k = (r - d) / d; o.x += dx * k; o.z += dz * k; }
        else {   // центр внутри стены: выходим по наименьшему проникновению
          const l = o.x - w.x0, rr = w.x1 - o.x, tp = o.z - w.z0, bt = w.z1 - o.z, m = Math.min(l, rr, tp, bt);
          if (m === l) o.x = w.x0 - r; else if (m === rr) o.x = w.x1 + r; else if (m === tp) o.z = w.z0 - r; else o.z = w.z1 + r;
        }
      }
    }
  }
  for (const i of N.k) if (pushOut(o, r, map.blocks[i])) hit = true;                 // стены подземелий и частокол
  for (const i of N.d) { const d = map.doors[i]; if (d.open < .6 && pushOut(o, r, d.rect)) hit = true; }   // закрытые двери подземелий
  for (const i of N.s) {
    const q = map.solids[i], dx = o.x - q.x, dz = o.z - q.z, d = Math.hypot(dx, dz), m = q.r + r;
    if (d < m) { hit = true; if (d > 1e-9) { o.x = q.x + dx / d * m; o.z = q.z + dz / d * m; } else o.x += m; }
  }
  if (map.river && N.w.length && pushWater(map.river, o, r, N.w)) hit = true;     // река (мосты — проходимы)
  if (map.plateaus && map.plateaus.length && pushCliff(map.plateaus, o, r)) hit = true;     // обрывы (въезды — проходимы)
  return hit;
}

// удержать точку в пределах уровня: на поверхности — круг мира, в подземелье — его прямоугольник
export function keepIn(map, o, R) {
  const B = map.bounds;
  if (B) { o.x = clamp(o.x, B.x0, B.x1); o.z = clamp(o.z, B.z0, B.z1); return; }
  const l = Math.hypot(o.x, o.z); if (l > R) { o.x *= R / l; o.z *= R / l; }
}

// вытолкнуть круг из прямоугольника без дверей
function pushOut(o, r, w) {
  if (o.x < w.x0 - r || o.x > w.x1 + r || o.z < w.z0 - r || o.z > w.z1 + r) return false;
  const cx = clamp(o.x, w.x0, w.x1), cz = clamp(o.z, w.z0, w.z1), dx = o.x - cx, dz = o.z - cz, d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;
  if (d2 > 1e-12) { const d = Math.sqrt(d2), k = (r - d) / d; o.x += dx * k; o.z += dz * k; }
  else { const l = o.x - w.x0, rr = w.x1 - o.x, tp = o.z - w.z0, bt = w.z1 - o.z, m = Math.min(l, rr, tp, bt); if (m === l) o.x = w.x0 - r; else if (m === rr) o.x = w.x1 + r; else if (m === tp) o.z = w.z0 - r; else o.z = w.z1 + r; }
  return true;
}

const EPS = 1e-6;
// прямоугольник a без прямоугольника b: до четырёх кусков
function cut(a, b) {
  if (b.x0 >= a.x1 - EPS || b.x1 <= a.x0 + EPS || b.z0 >= a.z1 - EPS || b.z1 <= a.z0 + EPS) return [a];
  const out = [], z0 = Math.max(a.z0, b.z0), z1 = Math.min(a.z1, b.z1);
  if (b.z0 > a.z0) out.push({ x0: a.x0, x1: a.x1, z0: a.z0, z1: b.z0 });
  if (b.z1 < a.z1) out.push({ x0: a.x0, x1: a.x1, z0: b.z1, z1: a.z1 });
  if (b.x0 > a.x0) out.push({ x0: a.x0, x1: b.x0, z0, z1 });
  if (b.x1 < a.x1) out.push({ x0: b.x1, x1: a.x1, z0, z1 });
  return out.filter(q => q.x1 - q.x0 > EPS && q.z1 - q.z0 > EPS);
}
// общая граница двух комнат (проём): vert — граница идёт вдоль z (x = line), s0–s1 — отрезок проёма
export function sharedEdge(a, b) {
  const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), oz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
  if (ox > EPS && (Math.abs(a.z1 - b.z0) < EPS || Math.abs(b.z1 - a.z0) < EPS)) return { vert: false, line: Math.abs(a.z1 - b.z0) < EPS ? a.z1 : a.z0, s0: Math.max(a.x0, b.x0), s1: Math.min(a.x1, b.x1) };
  if (oz > EPS && (Math.abs(a.x1 - b.x0) < EPS || Math.abs(b.x1 - a.x0) < EPS)) return { vert: true, line: Math.abs(a.x1 - b.x0) < EPS ? a.x1 : a.x0, s0: Math.max(a.z0, b.z0), s1: Math.min(a.z1, b.z1) };
  return null;
}
// сколько проходов между комнатами точек (Infinity — вне комнат); на поверхности 0
export function roomHops(map, x0, z0, x1, z1) {
  if (!map.hops) return 0;
  const a = roomAt(map, x0, z0), b = roomAt(map, x1, z1);
  return a < 0 || b < 0 ? Infinity : map.hops[a][b];
}
// стена подземелья или закрытая дверь на отрезке (шаг 0.25 м); на поверхности — нет
export function lineBlocked(map, x0, z0, x1, z1) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / .25)), inR = (w, x, z) => x > w.x0 && x < w.x1 && z > w.z0 && z < w.z1;
  // дома на поверхности: только те, чью рамку задевает отрезок; стены и закрытая дверь
  const bx0 = Math.min(x0, x1), bx1 = Math.max(x0, x1), bz0 = Math.min(z0, z1), bz1 = Math.max(z0, z1);
  const N = nearby(map, bx0 - .1, bz0 - .1, bx1 + .1, bz1 + .1);     // только стены и дома рядом с отрезком (сетка участков)
  const houses = N.b.map(i => map.buildings[i]).filter(b => b.x1 > bx0 && b.x0 < bx1 && b.z1 > bz0 && b.z0 < bz1);
  const blocks = N.k.map(i => map.blocks[i]), doors = N.d.map(i => map.doors[i]);
  for (let i = 1; i < n; i++) {
    const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n;
    if (blocks.some(w => inR(w, x, z)) || doors.some(d => d.open < .6 && inR(d.rect, x, z))) return true;
    for (const b of houses) if (b.walls.some(w => inR(w, x, z)) || (b.door.open < .6 && inR(b.door.rect, x, z))) return true;
  }
  return false;
}
// комната (индекс), в которой стоит точка, иначе −1
export function roomAt(map, x, z) {
  const R = map.rooms || [];
  for (let i = 0; i < R.length; i++) { const r = R[i]; if (x >= r.x0 - EPS && x <= r.x1 + EPS && z >= r.z0 - EPS && z <= r.z1 + EPS) return i; }
  return -1;
}

// следующая точка пути из (x, z) к (tx, tz) по графу комнат (поиск в ширину по проходам); null — та же комната или вне комнат.
// Сначала подойти к проходу по нормали (точка «до»), выровнявшись — пройти его (точка «за»): так не цепляются за углы
// keys — связка ключей идущего (у героя): дверь, от которой есть ключ, проходима; враги и отряд идут без ключей
export function pathStep(map, x, z, tx, tz, keys = null) {
  const ra = roomAt(map, x, z), rb = roomAt(map, tx, tz);
  if (!map.adj || ra < 0 || rb < 0 || ra === rb) return null;
  const prev = new Array(map.rooms.length).fill(-2); prev[ra] = -1;
  const q = [ra];
  const shut = l => { const d = l.door >= 0 && map.doors[l.door]; return !!d && d.locked && !(keys && keys[d.lock]); };      // через запертую дверь пути нет
  while (q.length && prev[rb] === -2) { const r = q.shift(); for (const li of map.adj[r]) { const l = map.links[li], o = l.a === r ? l.b : l.a; if (prev[o] === -2 && !shut(l)) { prev[o] = li; q.push(o); } } }
  if (prev[rb] === -2) return null;
  let r = rb, li = prev[r];
  for (;;) { const l = map.links[li], o = l.a === r ? l.b : l.a; if (o === ra) break; r = o; li = prev[r]; }
  const L = map.links[li], to = map.rooms[L.a === ra ? L.b : L.a], P = map.path;
  const n = L.vert ? Math.sign((to.x0 + to.x1) / 2 - L.line) : Math.sign((to.z0 + to.z1) / 2 - L.line), nx = L.vert ? n : 0, nz = L.vert ? 0 : n;
  const off = L.vert ? Math.abs(z - L.z) : Math.abs(x - L.x), half = (L.s1 - L.s0) / 2;
  return off < half - P.slack ? { x: L.x + nx * P.past, z: L.z + nz * P.past } : { x: L.x - nx * P.before, z: L.z - nz * P.before };
}

// карта подземелья: комнаты и коридоры (прямоугольники пола), стены вокруг, проёмы там, где прямоугольники касаются,
// двери в проёмах, граф связей (links, adj — для путей врагов и отряда), контейнеры, лестница наверх
export function makeLevelMap(cfg, def) {
  const D = cfg.dungeons, t = D.wall;
  const rooms = def.rooms.map((r, i) => ({ i, id: r.id || 'r' + i, x0: r.x - r.w / 2, x1: r.x + r.w / 2, z0: r.z - r.d / 2, z1: r.z + r.d / 2, corridor: Math.min(r.w, r.d) <= D.corridorMax }));
  // стены: полосы снаружи каждой комнаты (с углами), из которых вырезан пол всех комнат
  let blocks = [];
  for (const r of rooms) blocks.push({ x0: r.x0 - t, x1: r.x1 + t, z0: r.z0 - t, z1: r.z0 }, { x0: r.x0 - t, x1: r.x1 + t, z0: r.z1, z1: r.z1 + t }, { x0: r.x0 - t, x1: r.x0, z0: r.z0, z1: r.z1 }, { x0: r.x1, x1: r.x1 + t, z0: r.z0, z1: r.z1 });
  for (const r of rooms) blocks = blocks.flatMap(w => cut(w, r));
  // проёмы и граф
  const links = [], adj = rooms.map(() => []);
  for (let a = 0; a < rooms.length; a++) for (let b = a + 1; b < rooms.length; b++) {
    const e = sharedEdge(rooms[a], rooms[b]); if (!e) continue;
    const m = (e.s0 + e.s1) / 2, L = { a, b, ...e, x: e.vert ? e.line : m, z: e.vert ? m : e.line, door: -1 };
    adj[a].push(links.length); adj[b].push(links.length); links.push(L);
  }
  // двери: { a: id комнаты, b: id комнаты } — встают на весь проём между ними
  const doors = [];
  for (const dd of def.doors || []) {
    const ia = rooms.findIndex(r => r.id === dd.a), ib = rooms.findIndex(r => r.id === dd.b);
    const L = links.find(l => (l.a === ia && l.b === ib) || (l.a === ib && l.b === ia));
    if (!L) throw new Error(`дверь ${dd.a}–${dd.b} в ${def.id}: комнаты не соприкасаются`);
    const rect = L.vert ? { x0: L.line - t / 2, x1: L.line + t / 2, z0: L.s0, z1: L.s1 } : { x0: L.s0, x1: L.s1, z0: L.line - t / 2, z1: L.line + t / 2 };
    L.door = doors.length;
    doors.push({ id: doors.length, x: L.x, z: L.z, vert: L.vert, s0: L.s0, s1: L.s1, line: L.line, w: L.s1 - L.s0, rect, open: 0, link: links.indexOf(L), lock: dd.lock || null, locked: !!dd.lock, cd: 0 });
  }
  // сколько проходов между комнатами (поиск в ширину из каждой): по этому числу враги слышат героя
  const hops = rooms.map((_, s) => { const h = rooms.map(() => Infinity); h[s] = 0; const q = [s]; while (q.length) { const r = q.shift(); for (const li of adj[r]) { const l = links[li], o = l.a === r ? l.b : l.a; if (h[o] === Infinity) { h[o] = h[r] + 1; q.push(o); } } } return h; });
  const bounds = { x0: Math.min(...rooms.map(r => r.x0)), x1: Math.max(...rooms.map(r => r.x1)), z0: Math.min(...rooms.map(r => r.z0)), z1: Math.max(...rooms.map(r => r.z1)) };
  const containers = [];
  for (const c of def.chests || []) containers.push({ id: containers.length, kind: c.kind, x: c.x, z: c.z, b: -1, ready: false, t: 0, items: [], locked: false, keyTier: 0, key: c.key || null });
  const cx = (bounds.x0 + bounds.x1) / 2, cz = (bounds.z0 + bounds.z1) / 2;
  const place = { id: def.id, name: def.name, type: 'dungeon', x: cx, z: cz, r: Math.hypot(bounds.x1 - bounds.x0, bounds.z1 - bounds.z0) + 4, danger: def.danger || 0 };
  const portals = [{ x: def.exit.x, z: def.exit.z, to: def.upTo || 'surface', tx: def.back.x, tz: def.back.z, up: true }];
  if (def.down) portals.push({ x: def.down.x, z: def.down.z, to: def.down.to, tx: def.down.tx, tz: def.down.tz, up: false });     // лестница на этаж ниже (C4)
  return { level: def.id, path: D.path, buildings: [], walls: blocks, blocks, rooms, links, adj, hops, doors, bounds, containers, portals, cfg: { places: [place], zones: [] }, solids: [], decor: [], roads: [] };
}

// сдвиг с шагами не длиннее 0.25: быстрый перекат не пролетает сквозь стену
export function slide(map, o, dx, dz, r) {
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .25));
  for (let i = 0; i < n; i++) { o.x += dx / n; o.z += dz / n; resolve(map, o, r); }
}

// поворот ввода джойстика под угол камеры (экран → мир)
export function rotateInput(mx, mz, yawDeg) {
  const a = yawDeg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return { mx: mx * c + mz * s, mz: -mx * s + mz * c };
}

// можно ли ставить деревья и камни: не в домах, не на дорогах, не в областях (кладбище, ферма…) и не у препятствий
export function propsBlocked(map, x, z) {
  if (nearBuilding(map, x, z, 3)) return true;
  for (const q of map.solids) if (Math.hypot(q.x - x, q.z - z) < q.r + 1.5) return true;
  for (const [a, b] of pathSegs(map)) if (distSegPt(x, z, a, b) < 2.4) return true;
  if (inCliff(map.plateaus, x, z, 1.8)) return true;                     // не у края обрыва
  for (const c of map.cfg.castles || []) if (Math.abs(x - c.x) < 19 && Math.abs(z - c.z) < 19) return true;     // не в замке и не у стен
  for (const c of [...(map.cfg.forts || []), ...(map.cfg.cities || [])]) if (Math.abs(x - c.x) < c.H + 3 && Math.abs(z - c.z) < c.H + 3) return true;     // не в лагере врагов и не в городе (2026-10-18)
  for (const P of map.plateaus || []) { const d = Math.hypot(x - P.x, z - P.z), a = Math.atan2(x - P.x, z - P.z); if (d > P.r - 3 && d < P.r + P.len + 2 && P.ramps.some(q => { let v = Math.abs(a - q) % 6.2832; if (v > 3.1416) v = 6.2832 - v; return v < P.rw + .15; })) return true; }     // и на въезде
  for (const zn of map.cfg.zones || []) { const hw = zn.w ? zn.w / 2 + 2 : zn.r + 3, hd = zn.d ? zn.d / 2 + 2 : zn.r + 3; if (Math.abs(x - zn.x) < hw && Math.abs(z - zn.z) < hd) return true; }
  for (const c of map.containers) if (Math.hypot(c.x - x, c.z - z) < 2) return true;
  if (map.river && waterDist(map.river, x, z) < 1.5) return true;          // не в воде и не у самой кромки
  return Math.hypot(x, z) < 6;
}
import { distSeg as distSegPt, pathSegs } from './world3d.js';

// область, в которой стоит точка (graveyard, farm, ruins, camp…), либо null
export function regionOf(map, x, z) {
  for (const zn of map.cfg.zones || []) {
    const hw = zn.w ? zn.w / 2 + 6 : zn.r + 8, hd = zn.d ? zn.d / 2 + 6 : zn.r + 8;
    if (Math.abs(x - zn.x) < hw && Math.abs(z - zn.z) < hd) return zn.type;
  }
  return null;
}

// место (город, посёлок, опасная зона), в котором стоит точка; при вложенных побеждает меньшее по радиусу
export function placeAt(map, x, z) {
  let best = null;
  for (const p of map.cfg.places || []) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.r && (!best || p.r < best.r)) best = p; }
  return best;
}

// «нет тупика»: открываем подземелье как игрок — ходим по незапертому, собираем ключи из сундуков, отпираем двери, пока можно.
// Возвращает { rooms — сколько комнат достижимо, all — все ли, order — порядок ключей, stuck — двери, которые так и не открылись }
export function solveLocks(map, startX, startZ, have = []) {     // have — ключи, найденные раньше (на других этажах)
  const R = map.rooms.length, seen = new Array(R).fill(false), keys = new Set(have), open = new Set(), order = [];
  const st = roomAt(map, startX, startZ); if (st < 0) return { rooms: 0, all: false, order, stuck: map.doors.filter(d => d.lock).map(d => d.id) };
  let grew = true; seen[st] = true;
  while (grew) {
    grew = false;
    for (let r = 0; r < R; r++) if (seen[r]) for (const li of map.adj[r]) {
      const l = map.links[li], o = l.a === r ? l.b : l.a, d = l.door >= 0 ? map.doors[l.door] : null;
      if (d && d.lock && !open.has(d.id)) { if (keys.has(d.lock)) { open.add(d.id); grew = true; } else continue; }
      if (!seen[o]) { seen[o] = true; grew = true; }
    }
    for (const c of map.containers) if (c.key && !keys.has(c.key)) { const cr = roomAt(map, c.x, c.z); if (cr >= 0 && seen[cr]) { keys.add(c.key); order.push(c.key); grew = true; } }
  }
  const rooms = seen.filter(Boolean).length;
  return { rooms, all: rooms === R, order, keys: [...keys], seen, stuck: map.doors.filter(d => d.lock && !open.has(d.id)).map(d => d.id) };
}

// ---- закрытый лагерь ----
// лагерь есть, если в конфиге есть его место (тесты чистого боя убирают места — и лагерь с ними)
export function campOf(cfg) { const C = cfg.camp; return C && (cfg.map.places || []).some(p => p.id === C.place) ? C : null; }
export const insideCamp = (C, x, z, pad = 0) => !!C && Math.hypot(x - C.x, z - C.z) < C.r - pad;
// ворота: точка на окружности; alongX — проём тянется вдоль x (ворота на юге и севере)
export function campGates(C) { return C.gates.map(a => { const r = a * Math.PI / 180; return { a, x: C.x + Math.sin(r) * C.r, z: C.z + Math.cos(r) * C.r, alongX: Math.abs(Math.cos(r)) > .7 }; }); }
// частокол: кольцо маленьких квадратов (столкновения — только прямоугольники), в воротах — проём; для врагов проём закрыт полосой
export function campWalls(C) {
  const blocks = [], foeBlocks = [], n = Math.ceil(2 * Math.PI * C.r / C.step), gapA = (C.gateW / 2) / C.r, s = Math.max(C.wall / 2, C.step * .6);
  for (let i = 0; i < n; i++) {
    const a = i / n * 2 * Math.PI;
    if (C.gates.some(g => { let d = Math.abs(a - g * Math.PI / 180) % (2 * Math.PI); if (d > Math.PI) d = 2 * Math.PI - d; return d < gapA; })) continue;
    const x = C.x + Math.sin(a) * C.r, z = C.z + Math.cos(a) * C.r;
    blocks.push({ x0: x - s, x1: x + s, z0: z - s, z1: z + s, camp: true });
  }
  for (const g of campGates(C)) { const w = C.gateW / 2 + .4, d = C.foeDepth / 2, nx = Math.sign(g.x - C.x), nz = Math.sign(g.z - C.z); foeBlocks.push(g.alongX ? { x0: g.x - w, x1: g.x + w, z0: g.z - d, z1: g.z + d, nx: 0, nz } : { x0: g.x - d, x1: g.x + d, z0: g.z - w, z1: g.z + w, nx, nz: 0 }); }     // n — наружу
  return { blocks, foeBlocks };
}
// враг не проходит ворота лагеря
// враг не проходит ворота лагеря: попал в полосу ворот — выталкивается всегда наружу (даже из внутренней половины проёма)
export function blockFoe(map, o, r) {
  let hit = false;
  for (const w of map.foeBlocks || []) {
    if (o.x < w.x0 - r || o.x > w.x1 + r || o.z < w.z0 - r || o.z > w.z1 + r) continue;
    if (w.nz) o.z = w.nz > 0 ? w.z1 + r : w.z0 - r; else o.x = w.nx > 0 ? w.x1 + r : w.x0 - r;
    hit = true;
  }
  return hit;
}

