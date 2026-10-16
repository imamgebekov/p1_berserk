// Тест замков 3D (шаг C4a): генератор этажей на сотнях зёрен — залы не налезают друг на друга, этажи проходимы целиком
// с ключами (ключ трона — этажом выше), лестницы вниз стоят в зале, у входа — выход наверх; замки в игре: вход на поверхности,
// этажи связаны лестницами, переход по лестнице и обратно, туман и двери этажей сохраняются; ядро без замков.
import { CFG3, CORE3 } from '../3d/src/config3d.js';
import { castleFloors } from '../3d/src/castle3d.js';
import { makeLevelMap, solveLocks, roomAt } from '../3d/src/map.js';
import { createWorld, step, mulberry32 } from '../3d/src/sim.js';
import { usePortal, portalNear } from '../3d/src/levels3d.js';
import { createSaver, loadSave } from '../3d/src/save3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const T0 = CFG3.worldgen.castles[0];

// ---------- 1. генератор ----------
for (let seed = 1; seed <= 300; seed++) {
  const T = { ...T0, at: { x: 0, z: 0 }, back: { x: 0, z: 3 } }, C = castleFloors(T, seed); let have = [];
  ok(C.floors.length === T.floors && C.floors[T.floors - 1].throne, `зерно ${seed}: нет этажей или трона`);
  for (const d of C.floors) {
    const R = d.rooms.map(r => ({ id: r.id, x0: r.x - r.w / 2, x1: r.x + r.w / 2, z0: r.z - r.d / 2, z1: r.z + r.d / 2 }));
    const over = R.some((a, i) => R.some((b, j) => j > i && a.x0 < b.x1 - .01 && b.x0 < a.x1 - .01 && a.z0 < b.z1 - .01 && b.z0 < a.z1 - .01));
    ok(!over, `зерно ${seed}, ${d.id}: залы налезают`);
    let map; try { map = makeLevelMap(CFG3, d); } catch (e) { ok(false, `зерно ${seed}, ${d.id}: ${e.message}`); continue; }
    const s = solveLocks(map, d.entry.x, d.entry.z, have); have = s.keys;
    if (d.guard) { const gi = map.rooms.findIndex(r => r.id === d.guard.room); ok(gi >= 0 && s.seen[gi], `зерно ${seed}, ${d.id}: до стража не дойти`); have.push(d.guard.key); }     // ключ трона — у стража
    ok(s.all && !s.stuck.length, `зерно ${seed}, ${d.id}: не пройти (залов ${s.rooms}/${map.rooms.length}, заперто ${s.stuck.length})`);
    ok(roomAt(map, d.exit.x, d.exit.z) >= 0 && roomAt(map, d.entry.x, d.entry.z) >= 0, `зерно ${seed}, ${d.id}: вход или выход вне зала`);
    if (d.down) ok(roomAt(map, d.down.x, d.down.z) >= 0, `зерно ${seed}, ${d.id}: лестница вниз вне зала`);
    ok(d.chests.every(c => roomAt(map, c.x, c.z) >= 0), `зерно ${seed}, ${d.id}: сундук вне зала`);
  }
}
// ---------- 2. в мире ----------
const castles = CFG3.dungeons.list.filter(d => d.castle);
ok(CFG3.map.castles.length === 2 && castles.length === 6, 'замков или этажей не столько: ' + castles.length);
ok(!CORE3.dungeons.list.some(d => d.castle), 'в ядре есть замки');
ok(castles.every(d => d.depth > 1 && d.danger >= 2), 'этажи замка не глубже ядра');
for (const C of CFG3.map.castles) ok(Math.hypot(C.x, C.z) > CFG3.worldgen.coreR + 100 && CFG3.map.places.some(p => p.id === C.id && p.danger), 'вход замка у ядра или без места');
{ const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.bosses.list = []; c.events.on = false; c.wanderer.on = false;
  const W = createWorld(c, mulberry32(3)), p = W.player, d1 = castles[0], d2 = castles[1];
  ok(W.map.portals.some(q => q.to === d1.id) && !W.map.portals.some(q => q.to === d2.id), 'вход на поверхности ведёт не на первый этаж');
  p.x = d1.at.x; p.z = d1.at.z; ok(usePortal(W) && W.lvl === d1.id, 'не спустились в замок');
  step(W, 1 / 60, {});
  p.x = d1.down.x; p.z = d1.down.z; ok(portalNear(W) && portalNear(W).to === d2.id, 'нет лестницы вниз');
  for (const dr of W.map.doors) if (dr.lock) { dr.locked = false; dr.open = 1; }
  ok(usePortal(W) && W.lvl === d2.id && Math.hypot(p.x - d2.entry.x, p.z - d2.entry.z) < 1.5, 'лестница не ведёт ко входу этажа 2');
  W.levels[d2.id].seen[5] = 1; W.keys[d2.id + '_k0'] = true; W.levels[d1.id].map.doors.find(x => x.lock).locked = false;
  p.x = d2.exit.x; p.z = d2.exit.z; ok(usePortal(W) && W.lvl === d1.id && Math.hypot(p.x - d1.down.x, p.z - d1.down.z) < 2.5, 'лестница наверх не ведёт к лестнице этажа 1');
  const mem = (() => { const o = {}; return { getItem: k => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); }, removeItem: k => { delete o[k]; } }; })();
  createSaver(W, mem).write(true); const s = loadSave(30, mem);
  ok(s && s.dseen[d2.id] && s.keys.includes(d2.id + '_k0') && (s.unlocked[d1.id] || []).length, 'туман, ключи или двери этажей замка не сохранились'); }

if (fails.length) { console.log('ПРОВАЛ:\n' + [...new Set(fails)].slice(0, 20).join('\n')); process.exit(1); }
console.log('Замки 3D: OK');
