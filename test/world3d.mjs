// Тест мира 3D: ничего не наложено, всё достижимо пешком (BFS по сетке, радиус героя 0.5), вещей достаточно.
import { CFG3 } from '../3d/src/config3d.js';
import { makeMap, insideOf } from '../3d/src/map.js';
import { CONTAINERS } from '../3d/src/data/loot.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const cfg = JSON.parse(JSON.stringify(CFG3)), map = makeMap(cfg), R = cfg.world.radius;
const rectHit = (x, z, r, w) => { const cx = Math.max(w.x0, Math.min(w.x1, x)), cz = Math.max(w.z0, Math.min(w.z1, z)); return Math.hypot(x - cx, z - cz) < r; };
const blocked = (x, z, r = .5) => map.walls.some(w => rectHit(x, z, r, w)) || map.solids.some(s => Math.hypot(s.x - x, s.z - z) < s.r + r);

// планировка
for (const a of map.buildings) for (const b of map.buildings) if (a.id < b.id) ok(a.x1 + 2 < b.x0 || b.x1 + 2 < a.x0 || a.z1 + 2 < b.z0 || b.z1 + 2 < a.z0, `дома ${a.id} и ${b.id} слишком близко`);
for (const b of map.buildings) { ok(Math.hypot(b.x, b.z) + Math.hypot(b.w, b.d) / 2 < R - 3, `дом ${b.id} у границы`); ok(Math.hypot(b.x, b.z) - Math.hypot(b.w, b.d) / 2 > 5, `дом ${b.id} у костра`); }
// препятствия
for (const q of map.solids) { ok(Math.hypot(q.x, q.z) < R - 2, 'препятствие у границы'); ok(!map.buildings.some(b => q.x > b.x0 - q.r && q.x < b.x1 + q.r && q.z > b.z0 - q.r && q.z < b.z1 + q.r), `препятствие в доме (${q.x.toFixed(1)}, ${q.z.toFixed(1)})`); ok(Math.hypot(q.x, q.z - 4) > q.r + 1.2, 'препятствие на старте героя'); }
for (const b of map.buildings) for (const q of map.solids) ok(Math.hypot(q.x - b.door.out.x, q.z - b.door.out.z) > q.r + .9, `дверь дома ${b.id} загорожена`);
// контейнеры
const cs = map.containers;
ok(cs.length >= 55, 'контейнеров мало: ' + cs.length);
for (const c of cs) {
  ok(CONTAINERS[c.kind], 'неизвестный вид ' + c.kind);
  ok(Math.hypot(c.x, c.z) < R - 2, `контейнер ${c.kind} у границы`);
  ok(!blocked(c.x, c.z, .3), `контейнер ${c.kind} (${c.x.toFixed(1)}, ${c.z.toFixed(1)}) в стене или препятствии`);
  if (c.b < 0) ok(insideOf(map, c.x, c.z, -2) === -1 && !map.buildings.some(b => c.x > b.x0 - .8 && c.x < b.x1 + .8 && c.z > b.z0 - .8 && c.z < b.z1 + .8), `наружный контейнер ${c.kind} в доме`);
  for (const d of cs) if (c.id < d.id) ok(Math.hypot(c.x - d.x, c.z - d.z) > 1.3, `контейнеры ${c.id} и ${d.id} слишком близко`);
}
const kinds = new Set(cs.map(c => c.kind)); ok(kinds.size >= 16, 'видов контейнеров в мире мало: ' + kinds.size);

// достижимость: открытые двери, шаг сетки 0.5
const G = .5, N = Math.ceil(R / G) + 2, key = (i, j) => (i + N) * (2 * N + 1) + (j + N);
for (const b of map.buildings) b.door.open = 1;
const seen = new Set(), q = [[0, 8]]; seen.add(key(0, 8));
// старт: (0, 4) → ячейка (0, 8)
while (q.length) { const [i, j] = q.pop(); for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b2 = j + dj, x = a * G, z = b2 * G; if (Math.hypot(x, z) > R - 1 || seen.has(key(a, b2)) || blocked(x, z)) continue; seen.add(key(a, b2)); q.push([a, b2]); } }
const reach = (x, z) => { const r = 1.0; for (let dx = -r; dx <= r; dx += G) for (let dz = -r; dz <= r; dz += G) { const i = Math.round((x + dx) / G), j = Math.round((z + dz) / G); if (seen.has(key(i, j)) && Math.hypot(dx, dz) <= r) return true; } return false; };
for (const c of cs) ok(reach(c.x, c.z), `контейнер ${c.kind} (${c.x.toFixed(1)}, ${c.z.toFixed(1)}) недостижим`);
for (const b of map.buildings) ok(reach(b.door.in.x, b.door.in.z), `дом ${b.id} (${b.kind}) недостижим`);
const total = cs.length; console.log(`контейнеров: ${total}, видов: ${kinds.size}, зданий: ${map.buildings.length}, препятствий: ${map.solids.length}, предметов декора: ${map.decor.length}`);
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.slice(0, 25).join('\n')); process.exit(1); }
console.log('Мир 3D: OK');
