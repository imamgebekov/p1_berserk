// Тест замков подземелий 3D (шаг H4): у каждой запертой двери есть ключ в сундуке того же подземелья, тупиков нет (ключ достижим без своей двери),
// запертая дверь держит героя и врагов, без ключа напоминает, ключ из сундука — на связку, с ключом дверь отпирается, связка и отпертые двери сохраняются,
// старое сохранение (версия 1) загружается, враги не ищут путь сквозь замок.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, travel, spawnEnemy } from '../3d/src/sim.js';
import { makeLevelMap, solveLocks, pathStep, roomAt } from '../3d/src/map.js';
import { createSaver, loadSave, applyDungeonState } from '../3d/src/save3d.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const clone = () => JSON.parse(JSON.stringify(CFG3));
const D = CFG3.dungeons, CEL = D.list.find(d => d.id === 'cellar_cooper');
const mk = (seed = 1, tweak) => { const c = clone(); c.enemies.count = 0; for (const d of c.dungeons.list) d.spawns = []; if (tweak) tweak(c); return createWorld(c, mulberry32(seed)); };
const run = (W, sec, input = {}) => { for (let i = 0; i < Math.round(sec * 60); i++) step(W, 1 / 60, typeof input === 'function' ? input(i) : input); };
const mem = () => { const o = {}; return { getItem: k => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); }, removeItem: k => { delete o[k]; }, o }; };

// ---------- 1. данные и «нет тупика» ----------
for (const def of D.list) {
  const M = makeLevelMap(CFG3, def);
  for (const d of M.doors.filter(x => x.lock)) {
    ok(D.keys[d.lock], `${def.id}: у ключа ${d.lock} нет названия`);
    ok(M.containers.some(c => c.key === d.lock), `${def.id}: ключа ${d.lock} нет ни в одном сундуке`);
  }
  const s = solveLocks(M, def.entry.x, def.entry.z);
  ok(s.all && !s.stuck.length, `${def.id}: тупик — достижимо ${s.rooms} из ${M.rooms.length}, не открылись двери ${s.stuck}`);
}
// проверка ловит тупик: ключ за своей же дверью
{ const c = clone(), def = c.dungeons.list.find(d => d.id === 'cellar_cooper'); def.chests.find(x => x.key).x = 10.2; def.chests.find(x => x.key).z = 0;
  const s = solveLocks(makeLevelMap(c, def), def.entry.x, def.entry.z); ok(!s.all && s.stuck.length === 1, 'проверка не заметила ключ за своей дверью'); }

// ---------- 2. запертая дверь: держит, напоминает, ключ из сундука, отпирается ----------
{
  const W = mk(2); travel(W, CEL.id, CEL.entry.x, CEL.entry.z);
  const M = W.map, door = M.doors.find(d => d.lock), store = M.rooms.findIndex(r => r.id === 'store');
  ok(door && door.locked, 'дверь кладовой заперта');
  // бежим в кладовую без ключа: дверь не пускает и напоминает
  W.player.x = door.x - 1.5; W.player.z = door.z; W.ev.length = 0;
  let saw = 0; for (let i = 0; i < 120; i++) { step(W, 1 / 60, { mx: 1 }); saw += W.ev.filter(v => v.k === 'doorLocked').length; W.ev.length = 0; }
  ok(roomAt(M, W.player.x, W.player.z) !== store, 'без ключа герой прошёл сквозь запертую дверь');
  ok(saw >= 1 && saw <= 2, 'напоминание «Заперто» не появилось или сыплется каждый кадр: ' + saw);
  ok(door.open < .05, 'запертая дверь приоткрылась');
  // ключ — в бочке: открыли, ключ на связке, в сумку не попал
  const barrel = M.containers.find(c => c.key === 'cellar_cooper'), bag0 = W.inv.bag.length;
  W.player.x = barrel.x - .6; W.player.z = barrel.z; W.ev.length = 0; run(W, .2);
  ok(W.keys.cellar_cooper && W.ev.some(v => v.k === 'key'), 'ключ из бочки не попал на связку');
  ok(!W.inv.bag.some(s => s.id === 'cellar_cooper'), 'ключ подземелья попал в сумку');
  // с ключом: подошёл — отперто, проходим
  W.player.x = door.x - 1.5; W.player.z = door.z; W.ev.length = 0;
  let unlocked = false; for (let i = 0; i < 150; i++) { step(W, 1 / 60, { mx: 1 }); if (W.ev.some(v => v.k === 'unlock')) unlocked = true; W.ev.length = 0; }
  ok(unlocked && !door.locked, 'с ключом дверь не отперлась');
  ok(roomAt(M, W.player.x, W.player.z) === store, 'после отпирания герой не прошёл в кладовую');
  // второй раз ключ не выдаётся (сундук наполнился снова)
  barrel.ready = true; barrel.items = []; W.ev.length = 0; W.player.x = barrel.x - .6; W.player.z = barrel.z; run(W, .2);
  ok(!W.ev.some(v => v.k === 'key'), 'ключ выдан повторно');
}

// ---------- 3. враги: не ищут путь сквозь замок, дверь их держит ----------
{
  const W = mk(3); travel(W, CEL.id, CEL.entry.x, CEL.entry.z); W.player.hp = W.player.maxhp = 1e6;
  const M = W.map, store = M.rooms.find(r => r.id === 'store');
  const e = spawnEnemy(W, 'ghoul', (store.x0 + store.x1) / 2 + 1, 0); e.alert = true; e.cd = 99;
  ok(pathStep(M, e.x, e.z, W.player.x, W.player.z) === null, 'враг нашёл путь сквозь запертую дверь');
  ok(pathStep(M, e.x, e.z, W.player.x, W.player.z, { cellar_cooper: true }) !== null, 'с ключом путь есть');
  run(W, 4, () => { e.alert = true; return {}; });
  ok(roomAt(M, e.x, e.z) === M.rooms.indexOf(store), 'враг вышел из запертой кладовой');
  // без принуждения: шум боя у двери не тревожит врага за замком, он не прилипает к двери
  const W2 = mk(5); travel(W2, CEL.id, CEL.entry.x, CEL.entry.z); W2.player.hp = W2.player.maxhp = 1e6;
  const M2 = W2.map, door = M2.doors.find(d => d.lock), st2 = M2.rooms.find(r => r.id === 'store');
  const g = spawnEnemy(W2, 'ghoul', st2.x1 - 1.3, 0); g.cd = 99; W2.player.x = door.x - 1.4; W2.player.z = door.z;
  run(W2, 3, i => ({ attackPress: i % 20 === 0 }));
  ok(!g.alert && Math.hypot(g.x - door.x, g.z - door.z) > 2, `враг за замком встревожился или прилип к двери (${Math.hypot(g.x - door.x, g.z - door.z).toFixed(1)} м)`);
}

// ---------- 4. сохранение: связка и отпертые двери; старое сохранение ----------
{
  const W = mk(4), st = mem(), sv = createSaver(W, st);
  W.keys.cellar_cooper = true; W.keys.crypt_iron = true; W.levels.cellar_cooper.map.doors.find(d => d.lock).locked = false;
  sv.write(true);
  const d = JSON.parse(st.o['berserk3d.save']);
  ok(d.v === 2 && d.keys.includes('crypt_iron') && d.unlocked.cellar_cooper.length === 1, 'в сохранении нет ключей или отпертой двери: ' + JSON.stringify({ v: d.v, keys: d.keys, u: d.unlocked }));
  const s = loadSave(CFG3.bag.slots, st), W2 = mk(4); applyDungeonState(W2, s);
  ok(W2.keys.cellar_cooper && W2.keys.crypt_iron && !W2.levels.cellar_cooper.map.doors.find(x => x.lock).locked, 'после загрузки нет ключей или дверь снова заперта');
  ok(W2.levels.crypt_pogost.map.doors.every(x => x.locked), 'загрузка отперла чужие двери');
  // мусор отбрасывается
  st.setItem('berserk3d.save', JSON.stringify({ ...d, keys: ['нет_такого', 5, 'crypt_bone'], unlocked: { cellar_cooper: [0, -1, 'x', 99], nope: [0] } }));
  const g = loadSave(CFG3.bag.slots, st);
  ok(g.keys.join() === 'crypt_bone' && g.unlocked.cellar_cooper.join() === '0' && !g.unlocked.nope, 'мусор в ключах не отброшен: ' + JSON.stringify(g.keys) + JSON.stringify(g.unlocked));
  // старое сохранение версии 1 загружается: ключей нет, двери заперты
  const old = { ...d, v: 1 }; delete old.keys; delete old.unlocked;
  st.setItem('berserk3d.save', JSON.stringify(old));
  const o = loadSave(CFG3.bag.slots, st);
  ok(o && o.keys.length === 0 && Object.keys(o.unlocked).length === 0 && o.inv, 'сохранение версии 1 не загрузилось: ' + JSON.stringify(o && { k: o.keys, u: o.unlocked }));
}

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Замки подземелий 3D: OK');
