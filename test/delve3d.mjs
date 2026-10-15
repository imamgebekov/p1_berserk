// Тест врагов в подземельях 3D (шаг H3): появление по комнатам и повторное наполнение, слух по числу проходов,
// путь врага через проходы, удар не проходит сквозь стену, отряд дерётся внизу, босс наверху лечится, пока героя нет.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, travel, spawnAlly, spawnEnemy, spawnBoss } from '../3d/src/sim.js';
import { roomAt, lineBlocked, roomHops, resolve } from '../3d/src/map.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const clone = () => JSON.parse(JSON.stringify(CFG3));
const D = CFG3.dungeons, CEL = D.list.find(d => d.id === 'cellar_cooper'), CRY = D.list.find(d => d.id === 'crypt_pogost');
const mk = (seed = 1, tweak) => { const c = clone(); c.enemies.count = 0; if (tweak) tweak(c); return createWorld(c, mulberry32(seed)); };
const run = (W, sec, input = {}) => { for (let i = 0; i < Math.round(sec * 60); i++) step(W, 1 / 60, typeof input === 'function' ? input(i) : input); };
const alive = W => W.enemies.filter(e => !e.dead);
const total = def => def.spawns.reduce((a, s) => a + s.n, 0);

// ---------- 1. появление по комнатам ----------
for (const def of [CEL, CRY]) {
  const W = mk(2); W.player.inv = 99;
  ok(W.levels[def.id].enemies.length === 0, `${def.id}: до первого входа врагов нет`);
  travel(W, def.id, def.entry.x, def.entry.z);
  const M = W.map, en = alive(W);
  ok(en.length === total(def), `${def.id}: врагов ${en.length}, ждали ${total(def)}`);
  const types = new Set([...def.foes.map(f => f[0]), ...def.spawns.filter(s => s.type).map(s => s.type)]);
  ok(en.every(e => types.has(e.type)), `${def.id}: чужой тип врага`);
  for (const s of def.spawns) { const ri = M.rooms.findIndex(r => r.id === s.room); ok(en.filter(e => roomAt(M, e.x, e.z) === ri).length >= s.n, `${def.id}: в ${s.room} меньше ${s.n} врагов`); }
  ok(en.every(e => { const o = { x: e.x, z: e.z }; resolve(M, o, .3); return Math.hypot(o.x - e.x, o.z - e.z) < 1e-6; }), `${def.id}: враг в стене`);
  ok(en.every(e => Math.hypot(e.x - def.entry.x, e.z - def.entry.z) > 3), `${def.id}: враг вплотную ко входу`);
  ok(en.every(e => !e.alert), `${def.id}: враги не бросаются сразу`);
  ok(en.every(e => e.danger === def.danger), `${def.id}: опасность врагов из конфига подземелья`);
}

// ---------- 2. уход и возвращение ----------
{
  const W = mk(3); W.player.inv = 99;
  travel(W, CEL.id, CEL.entry.x, CEL.entry.z);
  const ids = alive(W).map(e => e.id).join();
  alive(W)[0].alert = true;
  travel(W, 'surface', CEL.back.x, CEL.back.z); run(W, 5);
  travel(W, CEL.id, CEL.entry.x, CEL.entry.z);
  ok(alive(W).map(e => e.id).join() === ids, 'вернулся быстро — те же враги');
  ok(alive(W).every(e => !e.alert), 'ушедший герой потерян: враги спокойны');
  alive(W)[0].hp = 0; alive(W)[0].dead = true;
  travel(W, 'surface', CEL.back.x, CEL.back.z);
  W.t += D.respawnAway;
  travel(W, CEL.id, CEL.entry.x, CEL.entry.z);
  ok(alive(W).length === total(CEL) && !alive(W).some(e => ids.split(',').includes(String(e.id))), `через ${D.respawnAway} с погреб наполнился заново`);
}

// ---------- 3. слух: дальние комнаты не сбегаются ----------
{
  const W = mk(4); W.player.inv = 99; W.player.hp = 1e6; W.player.maxhp = 1e6;
  travel(W, CRY.id, CRY.entry.x, CRY.entry.z);
  for (const e of alive(W)) e.dead = true;
  const M = W.map, at = id => { const r = M.rooms.find(q => q.id === id); return { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 }; };
  const nave = at('nave'), vault = at('vault');
  W.player.x = nave.x; W.player.z = nave.z;
  const near = spawnEnemy(W, 'ghoul', nave.x + 3, nave.z + 2), far = spawnEnemy(W, 'ghoul', vault.x, vault.z);
  ok(roomHops(M, far.x, far.z, nave.x, nave.z) > D.hearRooms, 'склеп: сокровищница дальше слуха от зала');
  run(W, 2, i => ({ attack: i % 20 < 4 }));
  ok(near.alert, 'враг в той же комнате слышит бой');
  ok(!far.alert && Math.hypot(far.x - vault.x, far.z - vault.z) < .5, 'враг за три прохода не слышит и стоит на месте');
}

// ---------- 4. путь: враг доходит до героя через проходы и двери ----------
{
  const W = mk(5); W.player.inv = 99; W.player.hp = 1e6; W.player.maxhp = 1e6;
  travel(W, CRY.id, CRY.entry.x, CRY.entry.z);
  for (const e of alive(W)) e.dead = true;
  const M = W.map, r = M.rooms.find(q => q.id === 'tombs');      // за дверью и четырьмя проходами, в пределах «потери следа»
  for (const d of M.doors) d.locked = false;                     // герой уже отпер двери (замки — в locks3d.mjs)
  const e = spawnEnemy(W, 'ghoul', (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2); e.alert = true;
  W.player.x = CRY.entry.x; W.player.z = CRY.entry.z;
  let t = 0; for (; t < 40 * 60; t++) { step(W, 1 / 60, {}); if (Math.hypot(e.x - W.player.x, e.z - W.player.z) < 3) break; e.alert = true; }
  ok(t < 40 * 60, `упырь из усыпальницы не дошёл до входа (стоит у ${e.x.toFixed(1)}, ${e.z.toFixed(1)})`);
}

// ---------- 5. удар не проходит сквозь стену ----------
{
  const test = { id: 'twin', name: 'Проверка', hidden: true, at: { x: 0, z: 0 }, back: { x: 0, z: 4 }, depth: .3, danger: 0, foes: [['ghoul', 1]], spawns: [],
    rooms: [{ id: 'a', x: 0, z: 0, w: 6, d: 6 }, { id: 'b', x: 7, z: 0, w: 6, d: 6 }, { id: 'c', x: 3.5, z: -4, w: 9, d: 2 }], entry: { x: -1.5, z: 0 }, exit: { x: -2.4, z: 2 } };
  const W = mk(6, c => { c.dungeons.list.push(test); }); W.player.inv = 0;
  travel(W, 'twin', 2.4, 2); W.player.inv = 0;
  ok(lineBlocked(W.map, 2.4, 2, 4.6, 2) && !lineBlocked(W.map, -2, 2, 2.4, 2), 'стена между комнатами закрывает линию, внутри комнаты — нет');
  const e = spawnEnemy(W, 'ghoul', 4.6, 2), C = CFG3.enemies.ghoul, hp = W.player.hp;
  ok(Math.hypot(e.x - W.player.x, e.z - W.player.z) <= C.range + CFG3.player.radius + .35, 'упырь на дистанции удара (сквозь стену)');
  e.alert = true; e.state = 'wind'; e.t = C.wind - .001; step(W, 1 / 60, {});
  ok(W.player.hp === hp, 'удар сквозь стену не прошёл: ' + hp + ' → ' + W.player.hp);
  const W2 = mk(6, c => { c.dungeons.list.push(test); }); W2.player.inv = 0;
  travel(W2, 'twin', 2.4, 2); W2.player.inv = 0;
  const e2 = spawnEnemy(W2, 'ghoul', .4, 2), hp2 = W2.player.hp;
  e2.alert = true; e2.state = 'wind'; e2.t = C.wind - .001; step(W2, 1 / 60, {});
  ok(W2.player.hp < hp2, 'в той же комнате удар проходит');
  const d = CEL && W.levels[CEL.id].map.doors[0];
  if (d) { d.open = 0; ok(lineBlocked(W.levels[CEL.id].map, d.x - 1, d.z, d.x + 1, d.z), 'закрытая дверь закрывает линию'); d.open = 1; ok(!lineBlocked(W.levels[CEL.id].map, d.x - 1, d.z, d.x + 1, d.z), 'открытая — нет'); d.open = 0; }
}

// ---------- 6. отряд дерётся внизу ----------
{
  const W = mk(7); W.lv = 20; W.player.inv = 99; W.player.hp = 1e6; W.player.maxhp = 1e6; for (const k of Object.keys(CFG3.dungeons.keys)) W.keys[k] = true;
  W.player.x = CEL.at.x + .5; W.player.z = CEL.at.z;
  spawnAlly(W, 'guard'); spawnAlly(W, 'guard'); spawnAlly(W, 'guard');
  travel(W, CEL.id, CEL.entry.x, CEL.entry.z);
  const store = W.map.rooms.find(r => r.id === 'store');
  const n0 = alive(W).length;
  // герой идёт в кладовую и стоит; бьёт отряд
  run(W, 25, () => { const p = W.player, tx = (store.x0 + store.x1) / 2 - 1, dx = tx - p.x, dz = 0 - p.z, d = Math.hypot(dx, dz); return d > .6 ? { mx: dx / d, mz: dz / d } : {}; });
  ok(alive(W).length < n0, `отряд и герой никого не убили в погребе (${alive(W).length} из ${n0})`);
  ok(W.allies.every(a => roomAt(W.map, a.x, a.z) >= 0), 'бойцы не вылезли за стены');
}

// ---------- 7. босс наверху: пока герой внизу, уходит в логово и лечится ----------
{
  const W = mk(8, c => { c.bosses.list = c.bosses.list.slice(0, 1); });
  const boss = W.enemies.find(e => e.boss) || (spawnBoss(W, W.cfg.bosses.list[0]), W.enemies.find(e => e.boss));
  const home = { ...boss.b.home };
  boss.x = home.x + 20; boss.z = home.z; boss.alert = true; boss.hp = Math.round(boss.maxhp * .3);
  travel(W, CEL.id, CEL.entry.x, CEL.entry.z); W.player.inv = 99;
  ok(!W.enemies.includes(boss), 'босса нет в погребе');
  const hp0 = boss.hp; run(W, 3);
  ok(boss.hp === hp0, 'пока герой внизу, босс не обновляется');
  travel(W, 'surface', CEL.back.x, CEL.back.z);
  const want = Math.min(boss.maxhp, hp0 + boss.maxhp * W.cfg.bosses.homeHeal * 3);
  ok(Math.abs(boss.hp - want) < boss.maxhp * .01, `босс подлечился за время отсутствия: ${hp0} → ${boss.hp}, ждали ~${Math.round(want)}`);
  ok(!boss.alert && Math.hypot(boss.x - home.x, boss.z - home.z) < .01, 'босс в логове и спокоен');
}

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Враги в подземельях 3D: OK');
