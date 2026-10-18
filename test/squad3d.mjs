// Тест отряда 3D: найм, места, следование, бой, гибель, лечение, двери, сохранение, опыт и добыча от бойцов.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnEnemy, hireAlly, dismissAlly, squadMax, restoreAllies, respawnPlayer } from '../3d/src/sim.js';
import { allyHp } from '../3d/src/squad3d.js';
import { insideOf } from '../3d/src/map.js';
import { loadSave, createSaver } from '../3d/src/save3d.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const mk = (seed = 1, f) => { const cfg = JSON.parse(JSON.stringify(CFG3)); cfg.enemies.count = 0; cfg.map.places = []; if (f) f(cfg); return createWorld(cfg, mulberry32(seed)); };
// собрать отряд у героя: капитан теперь в лагере, ближе поводка, и бойцы сами за перенесённым героем не телепортируются
const gather = W => { W.allies.forEach((a, i) => { a.x = W.player.x + 1.2 + i * .8; a.z = W.player.z + 1; }); };
const atCaptain = W => { const b = W.map.buildings.find(b => b.npc && b.npc.kind === 'captain'); W.player.x = b.npc.x + 1; W.player.z = b.npc.z; W.player.inv = 1e9; step(W, 1 / 60, {}); return b; };
const run = (W, sec, inp = {}) => { for (let i = 0; i < Math.round(sec * 60); i++) step(W, 1 / 60, inp); };

// данные
{ const T = Object.fromEntries(Object.entries(CFG3.squad.types).filter(([, t]) => !t.story && !t.hero)); ok(Object.keys(T).length === 3, 'три вида бойцов (наём; герои сюжета и спутники-герои — отдельно)'); const ks = Object.values(T); for (let i = 1; i < ks.length; i++) ok(ks[i].cost > ks[i - 1].cost && ks[i].hp > ks[i - 1].hp && ks[i].dmg > ks[i - 1].dmg, 'лестница бойцов'); }
// места в отряде растут с уровнем
{ const W = mk(); const m = lv => { W.lv = lv; return squadMax(W); }; ok(m(1) === 1 && m(8) === 2 && m(16) === 3 && m(24) === 4 && m(30) === 4, 'места в отряде по уровню'); }
// найм
{ const W = mk(2); W.inv.ash = 10000; W.lv = 16; ok(hireAlly(W, 'guard') === 'far', 'найм издалека'); atCaptain(W); ok(W.nearNpc === 'captain', 'капитан не определился');
  W.inv.ash = 100; ok(hireAlly(W, 'guard') === 'ash' && !W.allies.length, 'найм без денег'); W.inv.ash = 10000;
  ok(hireAlly(W, 'нет') === 'none', 'неизвестный вид'); ok(hireAlly(W, 'guard') === 'ok' && W.inv.ash === 10000 - CFG3.squad.types.guard.cost && W.allies.length === 1, 'найм');
  ok(hireAlly(W, 'soldier') === 'ok' && hireAlly(W, 'veteran') === 'ok', 'второй и третий'); ok(hireAlly(W, 'guard') === 'full', 'отряд переполнен');
  const id = W.allies[0].id; ok(dismissAlly(W, id) && W.allies.length === 2 && !dismissAlly(W, id), 'увольнение'); ok(hireAlly(W, 'guard') === 'ok', 'место освободилось'); }
// следование: идут за героем, догоняют, телепорт при отрыве
{ const W = mk(3); W.lv = 16; atCaptain(W); W.inv.ash = 1e5; hireAlly(W, 'guard'); hireAlly(W, 'soldier'); W.player.x = 0; W.player.z = 10; gather(W);
  run(W, 3, { mz: -1 }); const d = a => Math.hypot(a.x - W.player.x, a.z - W.player.z); ok(W.allies.every(a => d(a) < 7), 'бойцы отстали: ' + W.allies.map(d).map(x => x.toFixed(1)));
  run(W, 3); ok(W.allies.every(a => d(a) < 5), 'бойцы не подошли к стоящему герою');
  W.player.x = -60; W.player.z = 0; run(W, .5); ok(W.allies.every(a => d(a) < 8), 'бойцы не телепортировались при отрыве');
  ok(W.allies.every(a => !(W.map.walls.some(w => Math.hypot(Math.max(w.x0, Math.min(w.x1, a.x)) - a.x, Math.max(w.z0, Math.min(w.z1, a.z)) - a.z) < .3))), 'боец застрял в стене'); }
// бой: бойцы убивают врагов, опыт и добыча идут герою
{ const W = mk(4); W.lv = 8; atCaptain(W); W.inv.ash = 1e5; hireAlly(W, 'veteran'); W.player.x = 0; W.player.z = 10; gather(W); run(W, 1);
  const e = spawnEnemy(W, 'imp', 6, 10); e.alert = false; e.cd = 99; const xp0 = W.xp + W.lv * 1e4; run(W, 5);
  ok(e.dead && W.kills === 1, 'боец не убил беса'); ok(W.xp + W.lv * 1e4 > xp0, 'опыт за убийство бойца не получен'); }
{ let drops = 0; for (let sd = 0; sd < 40; sd++) { const W = mk(200 + sd); W.lv = 8; atCaptain(W); W.inv.ash = 1e5; hireAlly(W, 'veteran'); W.player.x = 0; W.player.z = 10; gather(W); run(W, 1); const e = spawnEnemy(W, 'brute', 5, 10); e.alert = false; e.cd = 99; e.hp = 5; run(W, 3); drops += W.drops.length + W.inv.bag.length; } ok(drops > 15, 'добыча с убитых бойцами не выпадает: ' + drops); }
// враги бьют бойцов, боец может погибнуть
{ const W = mk(5); W.lv = 8; atCaptain(W); W.inv.ash = 1e5; hireAlly(W, 'guard'); W.player.x = 0; W.player.z = 10; gather(W); W.player.inv = 1e9; run(W, 1);
  for (let i = 0; i < 4; i++) { const e = spawnEnemy(W, 'brute', 3 + i, 12); e.alert = true; e.hp = e.maxhp = 9999; }
  let hurt = false, dead = false; for (let i = 0; i < 60 * 25 && !dead; i++) { step(W, 1 / 60, {}); if (W.ev.some(v => v.k === 'allyhurt')) hurt = true; if (W.ev.some(v => v.k === 'allydead')) dead = true; W.ev.length = 0; }
  ok(hurt, 'враги не бьют бойца'); ok(dead, 'боец должен был погибнуть под четырьмя рогачами'); run(W, 2); ok(!W.allies.length, 'мёртвый боец не убран'); }
// лечение: вне боя понемногу, у костра быстро
{ const W = mk(6); W.lv = 8; atCaptain(W); W.inv.ash = 1e5; hireAlly(W, 'soldier'); const a = W.allies[0]; W.player.x = 40; W.player.z = 40; run(W, 1); a.hp = 50; run(W, 5); ok(a.hp > 50 + 4 * CFG3.squad.regen * .8 && a.hp < 80, 'медленное лечение: ' + a.hp);
  W.player.x = 1; W.player.z = 1; run(W, 1); a.hp = 50; run(W, 3); ok(a.hp > 50 + 2 * CFG3.squad.fireRegen, 'у костра лечение быстрее: ' + a.hp); }
// двери открываются перед бойцом; боец ходит по домам
{ const W = mk(7); W.lv = 8; atCaptain(W); W.inv.ash = 1e5; hireAlly(W, 'guard'); const b = W.map.buildings[0]; W.player.x = b.x; W.player.z = b.z; W.player.inv = 1e9;
  run(W, 8); const a = W.allies[0]; ok(insideOf(W.map, a.x, a.z) === b.id || Math.hypot(a.x - W.player.x, a.z - W.player.z) < 6, 'боец не зашёл за героем в дом: ' + JSON.stringify([a.x, a.z])); }
// сохранение
{ const mem = {}, st = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; }, removeItem: k => { delete mem[k]; } };
  const W = mk(8); W.lv = 16; atCaptain(W); W.inv.ash = 1e5; hireAlly(W, 'guard'); hireAlly(W, 'veteran'); W.allies[1].hp = 77; createSaver(W, st).write(true);
  const l = loadSave(30, st); const W2 = mk(9); W2.lv = 16; restoreAllies(W2, l.squad); ok(W2.allies.length === 2 && W2.allies[1].type === 'veteran' && W2.allies[1].hp === 77, 'отряд не восстановился: ' + JSON.stringify(W2.allies.map(a => [a.type, a.hp])));
  const W3 = mk(10); W3.lv = 1; restoreAllies(W3, [{ type: 'guard', hp: 5 }, { type: 'guard', hp: 5 }, { type: 'нет', hp: 5 }]); ok(W3.allies.length === 1, 'лишние бойцы сверх мест: ' + W3.allies.length);
  const W4 = mk(11); W4.lv = 30; restoreAllies(W4, [{ type: 'veteran', hp: 1e9 }, { type: 'guard', hp: -4 }, { type: 'guard', hp: NaN }, null, 'x']); ok(W4.allies.length === 3 && W4.allies[0].hp === allyHp(W4, CFG3.squad.types.veteran) && W4.allies[1].hp === 1 && W4.allies[2].hp === allyHp(W4, CFG3.squad.types.guard), 'мусор в сохранении отряда: ' + JSON.stringify(W4.allies.map(a => a.hp))); }
// возрождение героя: бойцы остаются и догоняют
{ const W = mk(12); W.lv = 8; atCaptain(W); W.inv.ash = 1e5; hireAlly(W, 'guard'); W.player.x = 60; W.player.z = 0; run(W, 1); W.player.hp = 0; W.player.dead = true; respawnPlayer(W); run(W, 1); ok(Math.hypot(W.allies[0].x - W.player.x, W.allies[0].z - W.player.z) < 8 && W.allies.length === 1, 'боец потерялся после возрождения героя'); }
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Отряд 3D: OK');
