// Замки (C4): генератор многоэтажного подземелья по зерну. Чистая логика без графики (проверяется в Node).
// Этаж — залы на сетке (шаг PITCH м), соединённые коридорами: остов — случайное дерево, плюс 1–2 петли. На остове — 1–2 двери
// с замками; ключ от каждой лежит в сундуке там, куда можно дойти, не проходя эту и следующие запертые двери. Лестница вниз —
// в самом дальнем зале; лестница вверх на следующем этаже — у входа. Последний этаж — тронный зал за дверью с ключом трона.
// Выход: обычные описания подземелий (rooms, doors, chests, spawns, entry, exit, back) + лестницы (down) и связи этажей (upTo).
const PITCH = 15, COR = 2.4;
const mul = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const pick = (r, a) => a[(r() * a.length) | 0];

// один этаж: gw×gh клеток; start — клетка входа; throne — пристроить тронный зал к самому дальнему залу
function floorPlan(r, gw, gh, start, throne) {
  const cell = (i, j) => j * gw + i, rooms = [], size = [];
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const w = 8 + Math.round(r() * 3), d = 8 + Math.round(r() * 3); size.push([w, d]); rooms.push({ id: `r${i}_${j}`, x: i * PITCH, z: j * PITCH, w, d }); }
  // остов: случайный обход в глубину; петли — случайные соседи
  const seen = new Set([cell(...start)]), edges = [], stack = [start];
  while (stack.length) {
    const [i, j] = stack[stack.length - 1], nb = [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < gw && b < gh && !seen.has(cell(a, b)));
    if (!nb.length) { stack.pop(); continue; }
    const n = pick(r, nb); seen.add(cell(...n)); edges.push({ a: [i, j], b: n, tree: true }); stack.push(n);
  }
  for (let k = 0, extra = 1 + (r() < .5 ? 1 : 0); k < 40 && extra > 0; k++) {
    const i = (r() * gw) | 0, j = (r() * gh) | 0, [a, b] = pick(r, [[i + 1, j], [i, j + 1]]);
    if (a >= gw || b >= gh || edges.some(e => (e.a[0] === i && e.a[1] === j && e.b[0] === a && e.b[1] === b) || (e.b[0] === i && e.b[1] === j && e.a[0] === a && e.a[1] === b))) continue;
    edges.push({ a: [i, j], b: [a, b], tree: false }); extra--;
  }
  // коридоры — комнаты-полосы ровно между краями залов
  const cors = edges.map((e, k) => {
    const [A, B] = [rooms[cell(...e.a)], rooms[cell(...e.b)]], h = e.a[1] === e.b[1], [L, R] = h ? (A.x < B.x ? [A, B] : [B, A]) : (A.z < B.z ? [A, B] : [B, A]);
    const c = h ? { x0: L.x + L.w / 2, x1: R.x - R.w / 2, z: (A.z + B.z) / 2 } : { z0: L.z + L.d / 2, z1: R.z - R.d / 2, x: (A.x + B.x) / 2 };
    return h ? { id: 'c' + k, x: (c.x0 + c.x1) / 2, z: c.z, w: c.x1 - c.x0, d: COR, from: L.id, to: R.id, e } : { id: 'c' + k, x: c.x, z: (c.z0 + c.z1) / 2, w: COR, d: c.z1 - c.z0, from: L.id, to: R.id, e };
  });
  // глубина залов от входа по остову (через коридоры)
  const dist = new Map([[cell(...start), 0]]), q = [start];
  while (q.length) { const [i, j] = q.shift(); for (const e of edges) { const o = e.a[0] === i && e.a[1] === j ? e.b : e.b[0] === i && e.b[1] === j ? e.a : null; if (o && !dist.has(cell(...o))) { dist.set(cell(...o), dist.get(cell(i, j)) + 1); q.push(o); } } }
  const far = [...dist.entries()].sort((a, b) => b[1] - a[1])[0][0], farRoom = rooms[far];
  let throneRoom = null, throneCor = null;
  if (throne) {
    // трон — справа или снизу от дальнего зала, за пределами сетки (там свободно)
    const fi = far % gw, fj = (far / gw) | 0, right = fi === gw - 1, w = 20, d = 20, gap = 8;
    if (right || fj !== gh - 1) { const x0 = farRoom.x + farRoom.w / 2 + gap; throneRoom = { id: 'throne', x: x0 + w / 2, z: farRoom.z, w, d }; throneCor = { id: 'ct', x: farRoom.x + farRoom.w / 2 + gap / 2, z: farRoom.z, w: gap, d: COR, from: farRoom.id, to: 'throne' }; }
    else { const z0 = farRoom.z + farRoom.d / 2 + gap; throneRoom = { id: 'throne', x: farRoom.x, z: z0 + d / 2, w, d }; throneCor = { id: 'ct', x: farRoom.x, z: farRoom.z + farRoom.d / 2 + gap / 2, w: COR, d: gap, from: farRoom.id, to: 'throne' }; }
    // справа от последнего столбца могут стоять другие залы этого ряда? — нет: дальний зал в крайнем столбце или ряду, иначе трон пересечёт сетку
    if (!right && fj !== gh - 1) throneRoom = throneCor = null;
  }
  return { rooms, cors, edges, dist, far, farRoom, throneRoom, throneCor, cell, gw, gh };
}

// все этажи одного замка. T — описание замка (id, name, floors, foes, tier, at, back, depth[], danger[]), seed — зерно
export function castleFloors(T, seed) {
  const r = mul(seed), out = [], keys = {}, n = T.floors;
  for (let f = 1; f <= n; f++) {
    const last = f === n, gw = 3 + (f > 1 ? 1 : 0), gh = 3, start = [0, (r() * gh) | 0];
    let P = floorPlan(r, gw, gh, start, last);
    for (let tries = 0; last && !P.throneRoom && tries < 30; tries++) P = floorPlan(r, gw, gh, start, last);
    const id = `${T.id}_${f}`, rooms = [...P.rooms, ...P.cors.map(({ e, from, to, ...c }) => c)], doors = [], chests = [], spawns = [];
    if (P.throneRoom) rooms.push(P.throneRoom, P.throneCor);
    // запертые двери на остове: от самого глубокого ребра; ключ — в зале, куда можно дойти без этой и следующих дверей
    const treeCors = P.cors.filter(c => c.e.tree).sort((a, b) => Math.max(P.dist.get(P.cell(...b.e.a)), P.dist.get(P.cell(...b.e.b))) - Math.max(P.dist.get(P.cell(...a.e.a)), P.dist.get(P.cell(...a.e.b))));
    const nLocks = f === 1 ? 1 : 2, locked = [];
    for (const c of treeCors) { if (locked.length >= nLocks) break; if (locked.some(l => l.from === c.from || l.to === c.to || l.from === c.to || l.to === c.from)) continue; locked.push(c); }
    // зал за дверью — тот, что дальше от входа
    const reach = closed => { const ok = new Set([P.cell(...start)]), q = [start]; while (q.length) { const [i, j] = q.shift(); for (const e of P.edges) { const c = P.cors.find(x => x.e === e); if (closed.includes(c)) continue; const o = e.a[0] === i && e.a[1] === j ? e.b : e.b[0] === i && e.b[1] === j ? e.a : null; if (o && !ok.has(P.cell(...o))) { ok.add(P.cell(...o)); q.push(o); } } } return ok; };
    locked.sort((a, b) => reach([a]).size - reach([b]).size).reverse();          // сначала та, что отрезает меньше
    locked.forEach((c, k) => {
      const kid = `${id}_k${k}`, far = P.dist.get(P.cell(...c.e.a)) > P.dist.get(P.cell(...c.e.b)) ? c.e.a : c.e.b, room = P.rooms[P.cell(...far)];
      doors.push({ a: c.id, b: room.id, lock: kid }); keys[kid] = `${T.keyName} ${['железный', 'медный', 'костяной'][k % 3]} · этаж ${f}`;
      const ok = [...reach(locked.slice(k))].filter(x => x !== P.cell(...start)), kr = P.rooms[ok.length ? pick(r, ok) : P.cell(...start)];
      chests.push({ kind: pick(r, ['coffer', 'chest', 'ironchest']), x: kr.x + (r() - .5) * (kr.w - 3), z: kr.z + (r() - .5) * (kr.d - 3), key: kid });
    });
    if (P.throneRoom) { const kid = `${T.id}_throne`; keys[kid] = `${T.keyName} тронный`; doors.push({ a: 'ct', b: 'throne', lock: kid }); }
    // сундуки и враги по залам (не у входа)
    for (const room of P.rooms) {
      const d = P.dist.get(P.cell(...[room.x / PITCH, room.z / PITCH]));
      if (d === 0) continue;
      spawns.push({ room: room.id, n: 1 + (r() < .5 ? 1 : 0) + (d > 2 ? 1 : 0) });
      if (r() < .45) chests.push({ kind: pick(r, T.chests), x: room.x + (r() - .5) * (room.w - 3), z: room.z + (r() - .5) * (room.d - 3) });
    }
    if (f === n - 1) { const F = P.farRoom; chests.push({ kind: 'ironchest', x: F.x - F.w / 2 + 1.5, z: F.z + F.d / 2 - 1.5, key: `${T.id}_throne` }); }     // ключ трона — на предпоследнем этаже (C4b: у стража)
    const S = P.rooms[P.cell(...start)], entry = { x: S.x - S.w / 2 + 1.6, z: S.z }, exit = { x: S.x - S.w / 2 + .9, z: S.z + 2.2 };
    const def = { id, name: f === 1 ? T.name : `${T.name} · этаж ${f}`, castle: T.id, floor: f, depth: T.depth[f - 1], danger: T.danger[f - 1], rooms, doors, foes: T.foes, spawns, entry, exit, chests,
      at: f === 1 ? T.at : null, back: f === 1 ? T.back : null, sub: f > 1, upTo: f === 1 ? 'surface' : `${T.id}_${f - 1}` };
    if (!last) { const F = P.farRoom; def.down = { x: F.x + F.w / 2 - 1.2, z: F.z, to: `${T.id}_${f + 1}` }; }
    if (P.throneRoom) def.throne = { x: P.throneRoom.x, z: P.throneRoom.z, w: P.throneRoom.w, d: P.throneRoom.d };
    out.push(def);
  }
  // лестницы: выход этажа f ведёт к лестнице вниз этажа f−1; лестница вниз — ко входу следующего
  for (let f = 1; f < n; f++) { const a = out[f - 1], b = out[f]; a.down.tx = b.entry.x; a.down.tz = b.entry.z; b.back = { x: a.down.x - 1.4, z: a.down.z }; }
  return { floors: out, keys };
}
