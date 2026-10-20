// Тест карты 3D: дома не пересекаются, стены держат, в дверь можно пройти, враги заходят за героем, ввод поворачивается.
import { CFG3 } from '../3d/src/config3d.js';
import { makeMap, insideOf, resolve, slide, rotateInput } from '../3d/src/map.js';
import { createWorld, step, spawnEnemy, mulberry32, useItem } from '../3d/src/sim.js';
import { CONTAINERS } from '../3d/src/data/loot.js';

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
  // контейнеры: касание отдаёт добычу в сумку; потом контейнер наполняется заново
  const ch = b.chests[0]; ok(ch.ready && ch.items.length > 0, 'контейнер не наполнен при создании'); const want = ch.items.map(i => ({ ...i }));
  W.player.x = ch.x; W.player.z = ch.z; W.ev.length = 0; step(W, 1 / 60, {});
  ok(W.ev.some(v => v.k === 'open') && !ch.ready, 'контейнер не открылся');
  ok(want.every(i => W.inv.bag.some(s => s.id === i.id)), 'добыча не попала в сумку');
  W.ev.length = 0; step(W, 1 / 60, {}); ok(!W.ev.some(v => v.k === 'open'), 'контейнер отдал добычу дважды');
  W.player.x = 0; W.player.z = 4; for (let i = 0; i < 60 * (c.map.containerRespawn + 1); i++) step(W, 1 / 60, {}); ok(ch.ready, 'контейнер не наполнился заново');
  // полная сумка: остаток остаётся в контейнере
  { const W2 = createWorld(c, mulberry32(12)), ch2 = W2.map.containers.find(k => !CONTAINERS[k.kind].locked); W2.player.inv = 1e9;
    for (let i = 0; i < c.bag.slots; i++) W2.inv.bag.push({ id: 'w_sword_rust', n: 1 });
    W2.player.x = ch2.x; W2.player.z = ch2.z; step(W2, 1 / 60, {}); ok(ch2.ready && ch2.items.length > 0 && W2.ev.some(v => v.k === 'full'), 'при полной сумке остаток должен остаться в контейнере'); }
  // запертый: без ключа не открывается, с ключом тратит ключ
  { const W3 = createWorld(c, mulberry32(13)), lk = W3.map.containers.find(k => CONTAINERS[k.kind].locked); W3.player.x = lk.x; W3.player.z = lk.z; W3.player.inv = 1e9;
    step(W3, 1 / 60, {}); ok(lk.ready && lk.locked && W3.ev.some(v => v.k === 'locked'), 'запертый открылся без ключа');
    W3.inv.bag.push({ id: 'key_rust', n: 1 }); lk.keyTier = 2; lk.cd = 0; step(W3, 1 / 60, {}); ok(lk.locked, 'ключ ниже уровнем открыл замок');
    W3.inv.bag.push({ id: 'key_black', n: 1 }); W3.inv.bag.push({ id: 'key_iron', n: 1 }); lk.cd = 0; step(W3, 1 / 60, {});
    ok(!lk.locked && !lk.ready && !W3.inv.bag.some(s => s.id === 'key_iron') && W3.inv.bag.some(s => s.id === 'key_black'), 'ключ не потрачен или потрачен не тот (должен уйти самый слабый подходящий)'); }
  // вещи с монстров, подбор, использование, экипировка меняет бой
  { const W4 = createWorld(c, mulberry32(14)); W4.player.x = 0; W4.player.z = 0; W4.player.inv = 1e9;
    W4.drops.push({ id: 'f_rye', n: 2, x: 1.2, z: 0, t: 0, cd: 0 }); for (let i = 0; i < 60; i++) step(W4, 1 / 60, {});
    ok(W4.drops.length === 0 && W4.inv.bag.some(s => s.id === 'f_rye' && s.n === 2), 'вещь с земли не подобрана');
    W4.player.hp = 50; const i = W4.inv.bag.findIndex(s => s.id === 'f_rye'); ok(useItem(W4, i) && W4.player.hp === 60 && W4.inv.bag[0].n === 1, 'еда не лечит');
    W4.inv.bag.push({ id: 'p_haste', n: 1 }); step(W4, 1 / 60, {}); const sp0 = W4.gear.spd; useItem(W4, W4.inv.bag.length - 1); step(W4, 1 / 60, {}); ok(W4.gear.spd === sp0 + 25, 'настой быстроты не работает'); for (let k = 0; k < 60 * 41; k++) step(W4, 1 / 60, {}); ok(W4.gear.spd === sp0, 'бафф не закончился');
    W4.inv.eq.body = 'a_body_plate_ash'; step(W4, 1 / 60, {}); ok(W4.player.maxhp > c.player.hp && W4.gear.armor > 15, 'броня не учтена: ' + JSON.stringify(W4.gear));
    // урон по герою падает от брони
    const dmgWith = armor => { const Wx = createWorld(c, mulberry32(1)); Wx.inv.eq.body = armor; step(Wx, 1 / 60, {}); Wx.player.hp = Wx.player.maxhp; const e = spawnEnemy(Wx, 'brute', Wx.player.x + 1, Wx.player.z); e.state = 'wind'; e.t = Wx.cfg.enemies.brute.wind - .001; e.alert = true; const h0 = Wx.player.hp; step(Wx, 1 / 60, {}); return h0 - Wx.player.hp; };
    ok(dmgWith('a_body_plate_ash') < dmgWith(null) * .65 && Math.abs(dmgWith(null) - c.enemies.brute.damage) <= 1, 'броня не снижает урон: ' + dmgWith(null) + ' → ' + dmgWith('a_body_plate_ash'));
    // оружие: больше урона
    const hit = wp => { const Wx = createWorld(c, mulberry32(2)); Wx.cfg.enemies.count = 0; Wx.inv.eq.weapon = wp; step(Wx, 1 / 60, {}); const e = spawnEnemy(Wx, 'brute', Wx.player.x + Math.sin(Wx.player.face) * 1.5, Wx.player.z + Math.cos(Wx.player.face) * 1.5); e.hp = e.maxhp = 9999; for (let k = 0; k < 60 && e.hp === 9999; k++) step(Wx, 1 / 60, { attack: true }); return 9999 - e.hp; };
    ok(hit('w_greatsword_blood') > hit(null) * 1.8, 'клеймёный двуручник не бьёт сильнее голых рук'); }
  // убитый монстр оставляет вещи (в среднем)
  { let drops = 0; for (let sd = 0; sd < 60; sd++) { const Wx = createWorld(c, mulberry32(100 + sd)); Wx.cfg.enemies.count = 0; const e = spawnEnemy(Wx, 'brute', Wx.player.x + 1, Wx.player.z); e.hp = 1; e.alert = true; Wx.player.face = Math.PI / 2; step(Wx, 1 / 60, { attack: true }); for (let k = 0; k < 40; k++) step(Wx, 1 / 60, { attack: true }); drops += Wx.drops.length + Wx.inv.bag.length; } ok(drops > 15, 'рогачи почти не роняют вещи: ' + drops); }
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
  const c = clone(); c.enemies.count = 30; c.enemies.ring = [3, 40]; c.enemies.roam.on = false; const W = createWorld(c, mulberry32(5)); W.player.inv = 1e9; W.player.x = 5; W.player.z = 0;
  const seen = new Set(); let spawned = 0;
  for (let i = 0; i < 60 * 40; i++) { step(W, 1 / 60, {}); for (const e of W.enemies) if (!seen.has(e.id)) { seen.add(e.id); spawned++; ok(insideOf(W.map, e.x, e.z) === -1, 'враг родился в доме'); } }
  ok(spawned > 10, 'враги почти не появлялись: ' + spawned);
}
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Карта 3D: OK');
