// Зоны по уровням (этап 1, 2026-10-19): ядро «Пепельный Брод» 1–20 (уровень по глубине, как прежде); за ядром два кольца по 5 зон
// (зона = биом), уровень растёт от внутренней границы кольца к внешней, пояса идут спиралью без дыр; у каждой зоны за ядром — город-узел
// с торговцем, кузнецом и костром; враги и этажи замков — уровня своей зоны.
import { CFG3 } from '../3d/src/config3d.js';
import { zoneAt, zoneLevel, allZones } from '../3d/src/zones3d.js';
import { levelOfDepth, depthAt, dungeonLevel, levelAt } from '../3d/src/levels3d.js';
import { createWorld, mulberry32, spawnEnemy } from '../3d/src/sim.js';
import { makeMap, addFires } from '../3d/src/map.js';
import { firesOf } from '../3d/src/fires3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const Z = allZones(CFG3), out = Z.filter(z => z.ring >= 0);
const NZ = 1 + 5 * CFG3.zones.rings.length;     // мир ×2 (4.04): четыре кольца — 21 зона
ok(Z.length === NZ && new Set(Z.map(z => z.id)).size === NZ, `зон не ${NZ} или имена повторяются`);
// пояса: спираль без дыр — каждый следующий начинается там, где кончился прошлый; кольцо 2 выше кольца 1
const bands = out.map(z => z.lv).sort((a, b) => a[0] - b[0]);
ok(bands[0][0] === CFG3.zones.core.lv[1] && bands[bands.length - 1][1] === 80 && bands.every((b, i) => !i || b[0] === bands[i - 1][1]), 'пояса уровней с дырами: ' + JSON.stringify(bands));     // враги — до 80
for (let k = 1; k < CFG3.zones.rings.length; k++) ok(Math.max(...out.filter(z => z.ring === k - 1).map(z => z.lv[1])) <= Math.min(...out.filter(z => z.ring === k).map(z => z.lv[0])), `кольцо ${k + 1} не выше кольца ${k}`);
// уровень места: внутри зоны — в её поясе и растёт наружу; в ядре — как по глубине
const W = (() => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; return createWorld(c, mulberry32(3)); })();
let mono = true, inBand = true;
for (let a = 0; a < 6.28; a += .2) { let prev = null, pz = null; for (let r = 110; r < CFG3.world.radius - 10; r += 8) { const x = Math.sin(a) * r, z = Math.cos(a) * r, q = zoneAt(CFG3, x, z), l = zoneLevel(CFG3, x, z);
  if (l < q.lv[0] - 1e-6 || l > q.lv[1] + 1e-6) inBand = false; if (pz === q.id && l < prev - 1e-6) mono = false; prev = l; pz = q.id; } }
ok(inBand && mono, 'уровень места вне пояса зоны или падает наружу');
for (const [x, z] of [[0, 30], [40, -50], [-60, 10]]) ok(Math.abs(levelAt(W, x, z) - levelOfDepth(CFG3, depthAt(W, x, z))) < 1e-9, 'в ядре уровень изменился');
// узлы зон
const map = addFires(makeMap(JSON.parse(JSON.stringify(CFG3))), CFG3, firesOf);
for (const z of out) { const h = CFG3.map.places.find(p => p.hub === z.id); ok(h && zoneAt(CFG3, h.x, h.z).id === z.id, `${z.name}: нет города-узла или он не в зоне`);
  if (!h) continue; const npcs = map.buildings.filter(b => b.vil === h.id && b.npc).map(b => b.npc.kind);
  ok(['merchant', 'smith'].every(k => npcs.includes(k)), `${z.name}: в узле нет торговца или кузнеца (${npcs})`);
  ok(map.fires.some(f => f.id === h.id), `${z.name}: в узле нет костра`); }
// враги и замки — уровня зоны
for (const z of out) { let pt = null; for (let a = 0; a < 6.28 && !pt; a += .05) for (let r = 120; r < CFG3.world.radius - 10 && !pt; r += 10) { const x = Math.sin(a) * r, zz = Math.cos(a) * r; if (zoneAt(CFG3, x, zz).id === z.id) pt = { x, z: zz }; }
  const e = spawnEnemy(W, 'brute', pt.x, pt.z); ok(e.lvl >= z.lv[0] && e.lvl <= z.lv[1], `${z.name}: враг ${e.lvl} уровня`); }
for (const d of CFG3.dungeons.list.filter(d => d.castle)) { const c = CFG3.map.castles.find(q => q.id === d.castle), z = zoneAt(CFG3, c.x, c.z), l = dungeonLevel(CFG3, d);
  ok(l > z.lv[0] && l <= Math.min(CFG3.level.max, z.lv[1] + 3 * CFG3.zones.floorStep), `${d.id}: этаж ${l.toFixed(0)} уровня вне зоны ${z.name}`); }

if (fails.length) { console.error('Зоны 3D: ПРОВАЛ\n- ' + fails.join('\n- ')); process.exit(1); }
console.log('Зоны 3D: OK (' + Z.map(z => `${z.name} ${z.lv[0]}–${z.lv[1]}`).join(', ') + ')');
