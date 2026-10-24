// Зоны по уровням (этап 1, 2026-10-19; Мир 5.0 — 2026-10-23): ядро «Пепельный Брод» 1–20 (уровень по глубине, как прежде); старт у
// юго-западного края мира; за ядром 20 земель-луж, уровень — плавное поле от старта до 80 у дальнего края, без скачков на стыках
// (решение владельца); у каждой земли — город-узел с торговцем, кузнецом и костром у её прежнего уровня; враги и этажи замков — уровня места.
import { CFG3 } from '../3d/src/config3d.js';
import { zoneAt, zoneLevel, allZones } from '../3d/src/zones3d.js';
import { levelOfDepth, depthAt, dungeonLevel, levelAt } from '../3d/src/levels3d.js';
import { createWorld, mulberry32, spawnEnemy } from '../3d/src/sim.js';
import { makeMap, addFires } from '../3d/src/map.js';
import { firesOf } from '../3d/src/fires3d.js';
import { wdist, wcOf } from '../3d/src/geo3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const Z = allZones(CFG3), out = Z.filter(z => z.ring >= 0), C = wcOf(CFG3), R = CFG3.world.radius;
const NZ = 1 + 5 * CFG3.zones.rings.length;
ok(Z.length === NZ && new Set(Z.map(z => z.id)).size === NZ, `зон не ${NZ} или имена повторяются`);
// старт у края: от лагеря до края мира — 200–350 м; до дальнего края — больше 2 км
const edge = R - wdist(CFG3, 0, 0); ok(edge > 200 && edge < 350, 'лагерь не у края мира: до края ' + edge.toFixed(0));
ok(Math.hypot(C.x, C.z) + R > 2000, 'до дальнего края меньше 2 км');
// поле уровня: по сетке 10 м соседние точки отличаются не больше чем на 0,6 уровня (нет разрывов между землями); у ядра ~20, у дальнего края — 80
const pts = []; let jump = 0, maxL = 0, minL = 99;
for (let x = C.x - R; x <= C.x + R; x += 10) for (let z = C.z - R; z <= C.z + R; z += 10) {
  if (wdist(CFG3, x, z) > R - 5 || Math.hypot(x, z) < CFG3.worldgen.coreR + CFG3.worldgen.belt) continue;     // ядро — без поля уровня
  const l = zoneLevel(CFG3, x, z), l2 = zoneLevel(CFG3, x + 10, z), l3 = zoneLevel(CFG3, x, z + 10); maxL = Math.max(maxL, l); minL = Math.min(minL, l);
  if (l2 != null && wdist(CFG3, x + 10, z) < R - 5) jump = Math.max(jump, Math.abs(l2 - l)); if (l3 != null && wdist(CFG3, x, z + 10) < R - 5) jump = Math.max(jump, Math.abs(l3 - l));
  if (Math.random() < .02) pts.push([x, z]);
}
ok(jump <= .6, 'скачок уровня между соседними точками: ' + jump.toFixed(2));
ok(minL < 21.5 && maxL >= 79.9, `уровни мира не 20–80: ${minL.toFixed(1)}–${maxL.toFixed(1)}`);
// уровень места — в поясе своей земли; ядро — как по глубине
const W = (() => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; return createWorld(c, mulberry32(3)); })();
ok(pts.every(([x, z]) => { const q = zoneAt(CFG3, x, z), l = zoneLevel(CFG3, x, z); return l >= q.lv[0] - 1e-6 && l <= q.lv[1] + 1e-6; }), 'уровень места вне пояса земли');
for (const [x, z] of [[0, 30], [40, -50], [-60, 10]]) ok(Math.abs(levelAt(W, x, z) - levelOfDepth(CFG3, depthAt(W, x, z))) < 1e-9, 'в ядре уровень изменился');
// земли: прежний пояс земли попадает в её лужу; берег — у края мира
for (const z of out) { const nom = CFG3.zones.rings[z.ring][z.bio].lv, mid = (nom[0] + nom[1]) / 2; ok(z.lv[0] <= mid + 1 && z.lv[1] >= mid - 1, `${z.name}: лужа ${z.lv} без прежнего уровня ${nom}`); }
// узлы зон: в своей земле, у прежнего уровня (±3), торговец, кузнец, костёр
const map = addFires(makeMap(JSON.parse(JSON.stringify(CFG3))), CFG3, firesOf);
for (const z of out) { const h = CFG3.map.places.find(p => p.hub === z.id); ok(h && zoneAt(CFG3, h.x, h.z).id === z.id, `${z.name}: нет города-узла или он не в зоне`);
  if (!h) continue; const nom = CFG3.zones.rings[z.ring][z.bio].lv, L = zoneLevel(CFG3, h.x, h.z); ok(Math.abs(L - (nom[0] + nom[1]) / 2) <= 3, `${z.name}: узел на ${L.toFixed(0)} ур. при ${nom}`);
  const npcs = map.buildings.filter(b => b.vil === h.id && b.npc).map(b => b.npc.kind);
  ok(['merchant', 'smith'].every(k => npcs.includes(k)), `${z.name}: в узле нет торговца или кузнеца (${npcs})`);
  ok(map.fires.some(f => f.id === h.id), `${z.name}: в узле нет костра`); }
// враги — уровня места (±1), этажи замков — от уровня земли у входа
for (const z of out) { const h = CFG3.map.places.find(p => p.hub === z.id); if (!h) continue; const pt = { x: h.x + 25, z: h.z };
  const e = spawnEnemy(W, 'brute', pt.x, pt.z), L = zoneLevel(CFG3, pt.x, pt.z); ok(Math.abs(e.lvl - L) <= 1, `${z.name}: враг ${e.lvl} уровня при ${L.toFixed(0)}`); }
for (const d of CFG3.dungeons.list.filter(d => d.castle)) { const c = CFG3.map.castles.find(q => q.id === d.castle), z = zoneAt(CFG3, c.x, c.z), l = dungeonLevel(CFG3, d);
  ok(l > z.lv[0] && l <= Math.min(CFG3.level.max, z.lv[1] + 3 * CFG3.zones.floorStep), `${d.id}: этаж ${l.toFixed(0)} уровня вне зоны ${z.name}`); }

if (fails.length) { console.error('Зоны 3D: ПРОВАЛ\n- ' + fails.join('\n- ')); process.exit(1); }
console.log('Зоны 3D: OK (' + Z.map(z => `${z.name} ${z.lv[0]}–${z.lv[1]}`).join(', ') + `; скачок ≤ ${jump.toFixed(2)})`);
