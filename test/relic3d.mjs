// Дары Затмения (2026-10-23): печати с боссов (подземелье 1, рейд 3, Бездна и мир — нет), покупка у хранительницы с 40-го уровня за 100,
// один дар на героя, замена вытесняет прежний без возврата, у каждого героя свой дар и свои печати, сохранение; действие всех 8 даров.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnEnemy, spawnBoss, killEnemy, hurtPlayer, switchHero, refreshGear } from '../3d/src/sim.js';
import { travel, SURFACE } from '../3d/src/levels3d.js';
import { serialize, deserialize } from '../3d/src/inv.js';
import { buyPerk, perkOf, relicMul } from '../3d/src/relic3d.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const C = CFG3.relic;
const mk = () => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.map.places = []; c.events.on = false; c.wanderer.on = false; c.corpse.on = false; const W = createWorld(c, mulberry32(7)); W.lv = 45; refreshGear(W); W.player.hp = W.player.maxhp; return W; };
const run = (W, sec, inp = {}) => { for (let i = 0; i < Math.round(sec * 60); i++) step(W, 1 / 60, inp); };
const at = (W, id) => { const L = W.levels[id], r = L.map.rooms.find(q => q.x1 - q.x0 > 6) || L.map.rooms[0]; travel(W, id, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2); return W.player; };
const killBoss = (W, lvl, mini = false) => { const p = W.player, def = W.cfg.bosses.list.find(b => b.level === lvl && !!b.final !== mini) || W.cfg.bosses.list.find(b => !b.level && !b.city && !b.ring); const e = spawnBoss(W, { ...def, x: p.x + 2, z: p.z }); killEnemy(W, e, 1); if (!e.dead) killEnemy(W, e, 1); return e; };     // план подземелий, 1б: печать — с главного босса подземелья и с боссов рейда
const keeper = W => { const b = W.map.buildings.find(q => q.npc && q.npc.kind === C.npc); W.player.x = b.npc.x + .5; W.player.z = b.npc.z; run(W, .05); return W.nearNpc; };

// 1. печати: главный босс подземелья +1, рейд +3; мир, промежуточный босс и замок — 0 (план подземелий, 1б)
{ const W = mk(); killBoss(W, null); ok(!(W.inv.seals > 0), 'печать с босса в мире');
  const dun = W.cfg.dungeons.list.find(d => d.inst && !d.raid && W.cfg.bosses.list.some(b => b.level === d.id)), raid = W.cfg.dungeons.list.find(d => d.raid), cas = W.cfg.dungeons.list.find(d => d.castle && W.cfg.bosses.list.some(b => b.level === d.id));
  at(W, dun.id); killBoss(W, dun.id, true); ok(!(W.inv.seals > 0), 'печать с промежуточного босса подземелья');
  if (cas) { at(W, cas.id); killBoss(W, cas.id); ok(!(W.inv.seals > 0), 'печать с босса замка'); }
  at(W, dun.id); killBoss(W, dun.id); ok(W.inv.seals === C.drop.dungeon, `печатей с босса подземелья ${W.inv.seals}, ждём ${C.drop.dungeon}`);
  at(W, raid.id); killBoss(W, raid.id); ok(W.inv.seals === C.drop.dungeon + C.drop.raid, `печатей после рейда ${W.inv.seals}`);
  ok(W.ev.some(v => v.k === 'seal'), 'нет события печати'); }
// 2. покупка: далеко, уровень, печати, замена, свой дар у героя, сохранение
{ const W = mk(); W.inv.seals = 250;
  ok(buyPerk(W, 'reap') === 'far', 'купил не у хранительницы');
  ok(keeper(W) === C.npc, 'у часовни нет хранительницы: ' + W.nearNpc);
  W.lv = C.minLv - 1; ok(buyPerk(W, 'reap') === 'lv', 'купил до 40-го'); W.lv = C.minLv;
  ok(buyPerk(W, 'reap') === 'ok' && W.inv.perk === 'reap' && W.inv.seals === 150, 'не купил «Жатву» за 100');
  ok(buyPerk(W, 'reap') === 'have', 'купил тот же дар дважды');
  ok(buyPerk(W, 'chain') === 'ok' && W.inv.perk === 'chain' && W.inv.seals === 50, 'замена не вытеснила прежний дар');
  ok(buyPerk(W, 'storm') === 'seals', 'купил без печатей');
  const d = deserialize(JSON.parse(JSON.stringify(serialize(W.inv))), 99, W.hero, CFG3); ok(d.perk === 'chain' && d.seals === 50, 'дар и печати не сохранились');
  ok(deserialize({ ...serialize(W.inv), perk: 'nope' }, 99, W.hero, CFG3).perk === undefined, 'чужой дар принят из сохранения');
  const h0 = W.hero, other = ['jay', 'vale', 'thorn'].find(h => h !== h0); W.player.x = 0; W.player.z = 4; switchHero(W, other); W.lv = 45;
  ok(!W.inv.perk && !(W.inv.seals > 0), 'у другого героя тот же дар или печати'); switchHero(W, h0); ok(W.inv.perk === 'chain' && W.inv.seals === 50, 'дар героя пропал после смены'); }
// 3. действие даров
const withPerk = id => { const W = mk(); W.inv.perk = id; return W; };
const foe = (W, dx = 1.2, type = 'brute') => { const p = W.player, e = spawnEnemy(W, type, p.x + dx, p.z); e.hp = e.maxhp = 1e6; return e; };
{ const W = withPerk('undying'), p = W.player; hurtPlayer(W, p.maxhp * 5, p.x + 1, p.z); ok(!p.dead && p.hp >= p.maxhp * .3, 'второе дыхание не спасло');
  run(W, 3); hurtPlayer(W, p.maxhp * 5, p.x + 1, p.z); ok(p.dead, 'второе дыхание сработало дважды подряд'); }
{ const W = withPerk('mirror'), p = W.player, e = foe(W), h = p.hp; hurtPlayer(W, 50, e.x, e.z, null, e); ok(p.hp === h && e.hp < e.maxhp, 'зеркальный щит не поймал и не вернул удар');
  p.inv = 0; hurtPlayer(W, 50, e.x, e.z, null, e); ok(p.hp < h, 'зеркальный щит ловит всё подряд'); }
{ const W = withPerk('reap'), p = W.player; p.hp = p.maxhp * .5; const m0 = relicMul(W, null); for (let k = 0; k < 7; k++) { const e = spawnEnemy(W, 'imp', p.x + 1, p.z); killEnemy(W, e, 1); }
  ok(p.hp > p.maxhp * .7, 'жатва не лечит'); ok(Math.abs(relicMul(W, null) - (1 + C.perks.reap.dmg * C.perks.reap.max)) < 1e-9 && m0 === 1, 'заряды жатвы: ' + relicMul(W, null)); run(W, C.perks.reap.t + .5); ok(relicMul(W, null) === 1, 'заряды жатвы не гаснут'); }
{ const W = withPerk('frenzy'), p = W.player; ok(relicMul(W, null) === 1, 'ярость при полном здоровье'); p.hp = p.maxhp * .3; ok(relicMul(W, null) > 1.3, 'нет ярости ниже 40%'); }
{ const W = withPerk('chain'), p = W.player, e = foe(W, 1.2), o1 = foe(W, -2.5), o2 = foe(W, -3.6); p.face = Math.PI / 2; let zaps = 0;     // соседи за спиной: размах их не достаёт
  for (let k = 0; k < 600 && !zaps; k++) { const n = W.ev.length; e.x = p.x + 1.2; e.z = p.z; o1.x = p.x - 2.5; o2.x = p.x - 3.6; o1.z = o2.z = p.z; step(W, 1 / 60, { attackPress: k % 20 === 0 }); zaps += W.ev.slice(n).filter(v => v.k === 'chain').length; }
  ok(zaps >= 2 && o1.hp < o1.maxhp && o2.hp < o2.maxhp, `цепная молния не ударила соседей: разрядов ${zaps}`); }
{ const W = withPerk('ashstep'), p = W.player, e = foe(W, 1.5); step(W, 1 / 60, { roll: true, mx: 0, mz: 1 }); ok(e.hp < e.maxhp, 'пепельный шаг не взорвался'); ok(p.rollCd <= CFG3.player.rollCooldown - C.perks.ashstep.rollcd + 1e-9, 'перекат не быстрее: ' + p.rollCd); }
{ const W = withPerk('storm'), e = foe(W, 2); e.alert = true; run(W, .1); ok(e.hp < e.maxhp, 'пепельная буря не вспыхнула'); ok(W.rs.storm > C.perks.storm.cd - 1, 'у пепельной бури нет перезарядки'); }
{ const W = withPerk('bounty'), e = foe(W); ok(relicMul(W, e) === 1, 'охотник бьёт обычного сильнее'); e.elite = 'swift'; ok(relicMul(W, e) > 1.2, 'охотник не бьёт элиту сильнее');
  const a0 = W.inv.ash; e.hp = 1; killEnemy(W, e, 1); ok(W.inv.ash > a0, 'охотник не дал пепла за элиту'); }
{ const W = withPerk('frenzy'); W.lv = C.minLv - 1; W.player.hp = W.player.maxhp * .3; ok(perkOf(W) === null && relicMul(W, null) === 1, 'дар работает ниже 40-го'); }

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Дары Затмения 3D: OK');
