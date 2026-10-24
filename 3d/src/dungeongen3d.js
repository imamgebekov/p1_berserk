// Подземелья 2.0 (просьба владельца 2026-10-22): раскладка залов генератором — на сетке клеток, главный путь с поворотами,
// боковые ветви и тупики с сундуками; каждый заход — своя раскладка (зерно захода). Залы разного размера, между соседями —
// коридор по оси клеток (стены и проёмы строит map.makeLevelMap: соседние прямоугольники с общим краем). Чистая логика.
// Числа — config3d.js → dungeons.gen; облик (стиль) — dungeons.themes.

import { applyKeyRooms } from './keyrooms3d.js';     // план подземелий, 2а
import { placeTraps } from './traps3d.js';     // план подземелий, 2в

const DIRS = [[1, 0], [0, 1], [0, -1], [-1, 0]];
const key = (i, j) => i + ',' + j;

// раскладка: { cells: [{ i, j, id, w, d, main, depth, dead }], links: [[a, b]], path: [номера клеток главного пути] }
export function genLayout(G, rnd, size) {
  const want = size[0] + Math.floor(rnd() * (size[1] - size[0] + 1)), mainN = Math.max(3, Math.round(want * G.mainShare));
  const cells = [], at = new Map(), links = [];
  const add = (i, j, from) => { const c = { i, j, n: cells.length }; cells.push(c); at.set(key(i, j), c); if (from) links.push([from.n, c.n]); return c; };
  // главный путь: вперёд (+i) с поворотами вверх и вниз, без самопересечений
  let cur = add(0, 0, null); const path = [0];
  for (let k = 1; k < mainN; k++) {
    const opts = DIRS.slice(0, 3).filter(([di, dj]) => !at.has(key(cur.i + di, cur.j + dj)));
    if (!opts.length) break;
    const pick = rnd() < G.turn && opts.length > 1 ? opts[1 + Math.floor(rnd() * (opts.length - 1))] : opts[0];
    cur = add(cur.i + pick[0], cur.j + pick[1], cur); path.push(cur.n);
  }
  // ветви: от случайных клеток главного пути (кроме входа и конца) — в свободные клетки, длиной 1–3
  for (let guard = 0; cells.length < want && guard < want * 20; guard++) {
    const base = cells[path[1 + Math.floor(rnd() * Math.max(1, path.length - 2))]];
    let c = base, len = 1 + Math.floor(rnd() * G.branch);
    for (let s = 0; s < len && cells.length < want; s++) {
      const opts = DIRS.filter(([di, dj]) => !at.has(key(c.i + di, c.j + dj))); if (!opts.length) break;
      const [di, dj] = opts[Math.floor(rnd() * opts.length)]; c = add(c.i + di, c.j + dj, c);
    }
  }
  // петли: изредка соединить соседние клетки ветвей — меньше беготни назад
  for (const c of cells) for (const [di, dj] of DIRS.slice(0, 2)) { const o = at.get(key(c.i + di, c.j + dj)); if (o && rnd() < G.loop && !links.some(([a, b]) => (a === c.n && b === o.n) || (a === o.n && b === c.n)) && !(path.includes(c.n) && path.includes(o.n))) links.push([c.n, o.n]); }
  const deg = cells.map(() => 0); for (const [a, b] of links) { deg[a]++; deg[b]++; }
  for (const c of cells) { c.main = path.includes(c.n); c.dead = !c.main && deg[c.n] === 1; }
  return { cells, links, path };
}

// описание подземелья из раскладки: залы и коридоры (прямоугольники), вход, выход, враги, сундуки, залы боссов.
// def0 — исходное описание (имя, враги, боссы и добыча); боссы встают на главный путь по долям G.bossAt, последний — в конце.
export function genDef(cfg, def0, seed) {
  const G = cfg.dungeons.gen, rnd = mulberry(seed), raid = !!def0.raid, size = raid ? G.raid : G.dungeon, C = G.cell;
  const L = genLayout(G, rnd, size), bossN = (def0.bosses || []).length;
  const rooms = [], spawns = [], chests = [], idOf = c => 'g' + c.n;
  const bossCells = new Set(), at = [];
  for (let k = 0; k < bossN; k++) { const f = k === bossN - 1 ? 1 : (G.bossAt[k] ?? (k + 1) / bossN); const n = L.path[Math.min(L.path.length - 1, Math.max(1, Math.round(f * (L.path.length - 1))))]; if (!bossCells.has(n)) { bossCells.add(n); at.push(n); } else at.push(null); }
  for (const c of L.cells) {
    const boss = bossCells.has(c.n), first = c.n === 0, R = boss ? G.bossRoom : G.room;
    const w = first ? G.first[0] : R[0] + Math.round(rnd() * (R[1] - R[0])), d = first ? G.first[1] : R[0] + Math.round(rnd() * (R[1] - R[0]));
    c.w = Math.min(w, C - G.gapMin); c.d = Math.min(d, C - G.gapMin); c.x = c.i * C; c.z = c.j * C;
    rooms.push({ id: idOf(c), x: c.x, z: c.z, w: c.w, d: c.d });
    if (!first && !boss) spawns.push({ room: idOf(c), n: Math.max(1, Math.round((G.foes[0] + rnd() * (G.foes[1] - G.foes[0])) * c.w * c.d / 150 * (raid ? G.raidMul : 1))) });
    if (c.dead && rnd() < G.chest) chests.push({ kind: rnd() < .5 ? 'coffer' : 'grave', x: c.x + (rnd() - .5) * (c.w - 3), z: c.z + (rnd() - .5) * (c.d - 3) });
  }
  let fireN = -1; if (bossN && cfg.dungeons.fire && cfg.dungeons.fire.on) for (let i = L.path.length - 2; i > 0 && fireN < 0; i--) if (!bossCells.has(L.path[i])) fireN = L.path[i];     // костёр перед финальным боссом (план подземелий, 1е)
  const props = applyKeyRooms(cfg, def0, rooms, L.cells, at, 0, fireN, rnd);     // ключевые залы (план подземелий, 2а) — до коридоров: размеры залов меняются
  // коридоры: между соседними клетками, по общей оси; длина — промежуток между краями залов
  let k = 0;
  for (const [a, b] of L.links) {
    const A = L.cells[a], B = L.cells[b], horiz = A.j === B.j, [P, Q] = horiz ? (A.i < B.i ? [A, B] : [B, A]) : (A.j < B.j ? [A, B] : [B, A]);
    if (horiz) { const x0 = P.x + P.w / 2, x1 = Q.x - Q.w / 2; rooms.push({ id: 'k' + k++, x: (x0 + x1) / 2, z: P.z, w: x1 - x0, d: G.corr, corr: true }); }
    else { const z0 = P.z + P.d / 2, z1 = Q.z - Q.d / 2; rooms.push({ id: 'k' + k++, x: P.x, z: (z0 + z1) / 2, w: G.corr, d: z1 - z0, corr: true }); }
  }
  const first = L.cells[0], bosses = (def0.bosses || []).map((b, i) => ({ ...b, room: at[i] != null ? idOf(L.cells[at[i]]) : b.room }));
  const entry = { x: first.x - first.w / 2 + 2.5, z: first.z }, exit = { x: first.x - first.w / 2 + 1, z: first.z + 1.6 };
  const fire = fireN >= 0 ? { x: L.cells[fireN].x, z: L.cells[fireN].z } : null;
  const doors = locks(cfg, def0, L, rooms, chests, bossCells, fireN, rnd);     // двери и ключи (план подземелий, 2б)
  const traps = placeTraps(cfg, def0, L, rooms, rnd);     // ловушки в коридорах пути (план подземелий, 2в)
  secrets(cfg, def0, L, rooms, chests, doors, bossCells, rnd);     // тайники за трещиной (план подземелий, 2г)
  return { ...def0, rooms, doors, spawns, chests: (def0.chests || []).length ? chests.concat(bosses.length ? [{ kind: 'altar', x: L.cells[L.path[L.path.length - 1]].x, z: L.cells[L.path[L.path.length - 1]].z + 3 }] : []) : chests,
    entry, exit, bosses, fire, props, traps, gen: { seed, rooms: L.cells.length, main: L.path.length }, guard: null };
}

// запертые тупики (план подземелий, 2б): дверь между коридором и залом тупика, ключ — в сундуке другого доступного зала,
// за дверью — железный сундук. Ключи у подземелья свои: id_k1…; при новом заходе связка подземелья сбрасывается (levels3d)
function locks(cfg, def0, L, rooms, chests, bossCells, fireN, rnd) {
  const K = cfg.dungeons.locks; if (!K || !K.on || !bossCells.size) return [];
  const lim = def0.raid ? K.raid : K.dungeon, want = lim[0] + Math.floor(rnd() * (lim[1] - lim[0] + 1)), doors = [];
  const cand = L.cells.filter(c => c.dead && c.n !== 0 && c.n !== fireN && !bossCells.has(c.n) && !rooms[c.n].kind), pick = [];
  while (pick.length < want && cand.length) pick.push(cand.splice(Math.floor(rnd() * cand.length), 1)[0]);
  const shut = new Set(pick.map(c => c.n)), pool0 = L.cells.filter(o => !shut.has(o.n) && o.n !== 0 && !bossCells.has(o.n)), side = pool0.filter(o => !o.main), pool = side.length ? side : pool0;     // ключ — в открытом зале, лучше в стороне от пути
  pick.forEach((c, i) => {
    const li = L.links.findIndex(([a, b]) => a === c.n || b === c.n); if (li < 0) return;
    const kid = `${def0.id}_k${i + 1}`, kc = pool.length ? pool[Math.floor(rnd() * pool.length)] : L.cells[L.path[1]];
    doors.push({ a: 'k' + li, b: rooms[c.n].id, lock: kid }); chests.push({ kind: 'ironchest', x: c.x, z: c.z - c.d * .2 });
    chests.push({ kind: 'coffer', x: kc.x + (rnd() - .5) * (kc.w - 4), z: kc.z + (rnd() - .5) * (kc.d - 4), key: kid });
  });
  return doors;
}

// тайники (план подземелий, 2г): маленький скрытый зал в свободной соседней клетке сетки; проход к нему из зала-родителя закрыт
// трещиной в стене — дверь crack без ключа, открывается ударом героя рядом. Внутри — «Тайник»
function secrets(cfg, def0, L, rooms, chests, doors, bossCells, rnd) {
  const S = cfg.dungeons.secrets; if (!S || !S.on) return;
  const C = cfg.dungeons.gen.cell, used = new Set(L.cells.map(c => c.i + ',' + c.j)), want = def0.raid ? S.raid : S.dungeon, opts = [];
  for (const c of L.cells) if (c.n !== 0 && !bossCells.has(c.n) && !rooms[c.n].kind) for (const [di, dj] of DIRS) if (!used.has((c.i + di) + ',' + (c.j + dj))) opts.push([c, di, dj]);
  for (let n = 0; n < want && opts.length; n++) {
    const [P, di, dj] = opts.splice(Math.floor(rnd() * opts.length), 1)[0], i = P.i + di, j = P.j + dj; if (used.has(i + ',' + j)) { n--; continue; } used.add(i + ',' + j);
    const s = S.size, X = i * C, Z = j * C, id = 'sec' + n, cid = 'sk' + n;
    rooms.push({ id, x: X, z: Z, w: s, d: s, secret: true });
    if (di) { const x0 = Math.min(P.x, X) + (di > 0 ? P.w : s) / 2, x1 = Math.max(P.x, X) - (di > 0 ? s : P.w) / 2; rooms.push({ id: cid, x: (x0 + x1) / 2, z: Z, w: x1 - x0, d: cfg.dungeons.gen.corr, corr: true, secret: true }); }
    else { const z0 = Math.min(P.z, Z) + (dj > 0 ? P.d : s) / 2, z1 = Math.max(P.z, Z) - (dj > 0 ? s : P.d) / 2; rooms.push({ id: cid, x: X, z: (z0 + z1) / 2, w: cfg.dungeons.gen.corr, d: z1 - z0, corr: true, secret: true }); }
    doors.push({ a: rooms[P.n].id, b: cid, lock: 'crack', crack: true, hide: [cid, id] }); chests.push({ kind: 'cache', x: X, z: Z });
  }
}

export function mulberry(a) { return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
