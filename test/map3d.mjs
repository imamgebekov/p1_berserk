// Тест карты 3D: дома не пересекаются, стены держат, в дверь можно пройти, враги заходят за героем, ввод поворачивается.
import { CFG3 } from '../3d/src/config3d.js';
import { makeMap, insideOf, resolve, slide, rotateInput } from '../3d/src/map.js';
import { createWorld, step, spawnEnemy, mulberry32 } from '../3d/src/sim.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const clone = () => JSON.parse(JSON.stringify(CFG3));
const cfg = clone(), map = makeMap(cfg);

// планировка
for (const a of map.buildings) {
  ok(Math.hypot(a.x, a.z) - Math.hypot(a.w, a.d) / 2 > 6, `дом ${a.id} слишком близко к костру`);
  ok(Math.hypot(a.x, a.z) < cfg.world.radius - 6, `дом ${a.id} у границы мира`);
  for (const b of map.buildings) if (a.id < b.id) ok(a.x1 + 2 < b.x0 || b.x1 + 2 < a.x0 || a.z1 + 2 < b.z0 || b.z1 + 2 < a.z0, `дома ${a.id} и ${b.id} пересекаются`);
  // дверь: снаружи и внутри точки свободны
  ok(insideOf(map, a.door.in.x, a.door.in.z) === a.id, `дом ${a.id}: точка «внутри» двери не внутри`);
  ok(insideOf(map, a.door.out.x, a.door.out.z) === -1, `дом ${a.id}: точка «снаружи» двери внутри`);
}
ok(Math.hypot(0, 4) > 0 && !map.buildings.some(b => 0 > b.x0 - 2 && 0 < b.x1 + 2 && 4 > b.z0 - 2 && 4 < b.z1 + 2), 'дом на старте героя');

// каждый дом проходим через дверь кругами обоих размеров, а стена непроходима
for (const b of map.buildings) for (const r of [.5, .8]) {
  const d = b.door, dx = d.in.x - d.out.x, dz = d.in.z - d.out.z, L = Math.hypot(dx, dz);
  const o = { x: d.out.x, z: d.out.z };
  d.open = 0; slide(map, o, dx, dz, r); ok(insideOf(map, o.x, o.z) === -1, `дом ${b.id}: закрытая дверь пропустила`);
  o.x = d.out.x; o.z = d.out.z; d.open = 1; slide(map, o, dx, dz, r);
  ok(Math.hypot(o.x - d.in.x, o.z - d.in.z) < .05, `дом ${b.id}: круг r=${r} не прошёл в дверь (${o.x.toFixed(2)},${o.z.toFixed(2)})`);
  // сквозь противоположную стену: идём от центра наружу напрямик (не через дверь)
  const wx = b.door.side === 'n' || b.door.side === 's' ? 1 : 0, wz = 1 - wx;
  const p = { x: b.x, z: b.z }; slide(map, p, wx * (b.w + 6), wz * (b.d + 6), r);
  ok(insideOf(map, p.x, p.z) === b.id, `дом ${b.id}: прошёл сквозь стену`);
}
// дверь открывается сама, когда герой подходит, и закрывается, когда он ушёл; сундук отдаёт добычу и наполняется заново
{
  const c = clone(); c.enemies.count = 0; const W = createWorld(c, mulberry32(8)), b = W.map.buildings[0], d = b.door;
  W.player.x = d.out.x + 6; W.player.z = d.out.z; W.player.inv = 1e9;
  for (let i = 0; i < 30; i++) step(W, 1 / 60, {}); ok(d.open === 0, 'дверь открылась без героя');
  W.player.x = d.out.x; W.player.z = d.out.z; for (let i = 0; i < 30; i++) step(W, 1 / 60, {}); ok(d.open === 1, 'дверь не открылась перед героем: ' + d.open);
  W.player.x = d.out.x + 8; for (let i = 0; i < 60; i++) step(W, 1 / 60, {}); ok(d.open === 0, 'дверь не закрылась');
  // сундук
  const ch = b.chest; W.player.hp = 50; W.player.x = ch.x; W.player.z = ch.z; W.ev.length = 0;
  step(W, 1 / 60, {}); const lootEv = W.ev.find(v => v.k === 'loot');
  ok(lootEv && !ch.ready, 'сундук не отдал добычу'); ok(W.player.hp > 50 || W.ash > 0, 'добыча не засчитана');
  W.ev.length = 0; step(W, 1 / 60, {}); ok(!W.ev.some(v => v.k === 'loot'), 'сундук отдал добычу дважды');
  W.player.x = 0; W.player.z = 4; for (let i = 0; i < 60 * (c.map.chestRespawn + 1); i++) step(W, 1 / 60, {}); ok(ch.ready, 'сундук не наполнился заново');
}
// слух: враг не слышит стоящего героя далеко, слышит бегущего и бьющего; ударенный всегда слышит
{
  const c = clone(); c.enemies.count = 0; const H = c.enemies.hear;
  const at = (dist, inp) => { const W = createWorld(c, mulberry32(9)); W.player.x = 60; W.player.z = 0; W.player.inv = 1e9; const e = spawnEnemy(W, 'imp', 60, dist); e.cd = 99; for (let i = 0; i < 5; i++) step(W, 1 / 60, inp); return e.alert; };
  ok(!at(H.idle + 3, {}), 'стоящего героя услышали слишком далеко'); ok(at(H.idle - 2, {}), 'стоящего вплотную не услышали');
  ok(!at(H.run - 3 + 6, { mz: 0, mx: 0 }), 'шум без движения');
  ok(at(H.run - 2, { mx: 1 }), 'бегущего не услышали'); ok(at(H.fight - 2, { attack: true }), 'бьющего не услышали');
}
// быстрый перекат сквозь тонкую стену
{ const b = map.buildings[0], p = { x: b.x, z: b.z }; slide(map, p, 0, 40, .5); ok(insideOf(map, p.x, p.z) === b.id, 'быстрый рывок пробил стену'); }
// центр внутри стены выталкивается
{ const w = map.walls[0], o = { x: (w.x0 + w.x1) / 2, z: (w.z0 + w.z1) / 2 }; resolve(map, o, .5); ok(!map.walls.some(r => o.x > r.x0 && o.x < r.x1 && o.z > r.z0 && o.z < r.z1), 'центр остался внутри стены'); }

// поворот ввода: «вверх» на экране при любой камере идёт от камеры
for (const yaw of [0, 38, 90]) {
  const r = rotateInput(0, -1, yaw), a = yaw * Math.PI / 180;
  ok(Math.abs(r.mx + Math.sin(a)) < 1e-9 && Math.abs(r.mz + Math.cos(a)) < 1e-9, `ввод вверх при yaw ${yaw}: ${JSON.stringify(r)}`);
  const q = rotateInput(.6, -.8, yaw); ok(Math.abs(Math.hypot(q.mx, q.mz) - 1) < 1e-9, 'поворот меняет длину ввода');
}

// игровой цикл: герой в доме, враги снаружи заходят через дверь и бьют внутри; сквозь стену не бьют
{
  const c = clone(); c.enemies.count = 0; const W = createWorld(c, mulberry32(3)), b = W.map.buildings[0];
  W.player.x = b.x; W.player.z = b.z; W.player.inv = 1e9;
  const e = spawnEnemy(W, 'imp', b.door.out.x + 7, b.door.out.z + 1);
  let entered = false, hurtThrough = false;
  for (let i = 0; i < 60 * 25; i++) { step(W, 1 / 60, {}); if (insideOf(W.map, e.x, e.z) === b.id) entered = true; if (W.ev.some(v => v.k === 'hurt')) hurtThrough = true; W.ev.length = 0; }
  ok(W.inside === b.id, 'герой не определён как «внутри»');
  ok(entered, 'враг не зашёл в дом через дверь за героем');
}
{
  const c = clone(); c.enemies.count = 0; const W = createWorld(c, mulberry32(4)), b = W.map.buildings[0];
  // герой в доме у стены, враг вплотную снаружи за стеной: удара сквозь стену нет
  W.player.x = b.ix0 + .6; W.player.z = b.z + 1.2;
  const e = spawnEnemy(W, 'imp', b.x0 - .5, W.player.z); let hp0 = W.player.hp, firstEnter = null;
  for (let i = 0; i < 60 * 1.5; i++) { step(W, 1 / 60, {}); if (insideOf(W.map, e.x, e.z) === b.id && firstEnter === null) firstEnter = i; if (firstEnter === null) ok(W.player.hp === hp0, 'удар сквозь стену'); }
}
// враги не рождаются в домах
{
  const c = clone(); c.enemies.count = 30; c.enemies.ring = [3, 40]; const W = createWorld(c, mulberry32(5)); W.player.inv = 1e9; W.player.x = 5; W.player.z = 0;
  const seen = new Set(); let spawned = 0;
  for (let i = 0; i < 60 * 40; i++) { step(W, 1 / 60, {}); for (const e of W.enemies) if (!seen.has(e.id)) { seen.add(e.id); spawned++; ok(insideOf(W.map, e.x, e.z) === -1, 'враг родился в доме'); } }
  ok(spawned > 10, 'враги почти не появлялись: ' + spawned);
}
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Карта 3D: OK');
