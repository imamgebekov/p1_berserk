// Тест сна 3D (шаг G4): уснуть можно только ночью, на поверхности, в таверне или у костра безопасного места и без встревоженных
// врагов рядом; сон длится до утра (7:00) и лечит полностью, снимает отравление, лечит отряд; время идёт честно — баффы
// кончаются, витрина обновляется, босс возрождается; враг, заметивший спящего, будит его — без лечения.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnEnemy, killEnemy } from '../3d/src/sim.js';
import { sleep, sleepBlock, sleepSpot, wakeTime } from '../3d/src/sleep3d.js';
import { isNight, clockText, phaseOf } from '../3d/src/daynight.js';
import { travel } from '../3d/src/levels3d.js';
import { restoreAllies } from '../3d/src/squad3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const mk = (tweak, seed = 3) => { const c = JSON.parse(JSON.stringify(CFG3)); c.events.on = false; c.wanderer.on = false; c.enemies.count = 0; if (tweak) tweak(c); const W = createWorld(c, mulberry32(seed)); W.enemies = W.enemies.filter(e => e.boss); return W; };
const toNight = W => { const D = W.cfg.daynight; while (!isNight(W.t, D)) W.t += 5; step(W, 1 / 60, {}); };
const inTavern = W => { const t = W.map.buildings.find(b => b.kind === 'tavern'); W.player.x = (t.ix0 + t.ix1) / 2; W.player.z = (t.iz0 + t.iz1) / 2; step(W, 1 / 60, {}); };

// ---------- 1. когда нельзя ----------
{ const W = mk(); inTavern(W);
  ok(sleepSpot(W) === 'tavern', 'таверна не место для сна');
  W.t = 0; step(W, 1 / 60, {}); ok(/ночью/.test(sleepBlock(W) || '') && sleep(W) !== 'ok', 'днём можно уснуть');
  toNight(W); ok(sleepBlock(W) === null, 'ночью в таверне нельзя уснуть: ' + sleepBlock(W));
  const e = spawnEnemy(W, 'brute', W.player.x + 6, W.player.z); e.alert = true; ok(/враги/i.test(sleepBlock(W) || ''), 'уснуть рядом со встревоженным врагом');
  W.player.x = 150; W.player.z = 150; step(W, 1 / 60, {}); ok(!sleepSpot(W) && sleepBlock(W), 'уснуть в поле');
  const D = W.cfg.dungeons.list[0]; travel(W, D.id, D.entry.x, D.entry.z); ok(/[Пп]од землёй/.test(sleepBlock(W) || ''), 'уснуть в подземелье'); }
// костры: лагеря и посёлка — можно, у входа в опасное место — нельзя
{ const W = mk(); toNight(W); const F = W.map.fires;
  for (const f of [F.find(q => q.home), F.find(q => !q.home && !q.danger), F.find(q => q.danger)]) {
    W.player.x = f.x + 1; W.player.z = f.z; W.enemies = W.enemies.filter(e => e.boss); step(W, 1 / 60, {});
    ok(!f.danger === (sleepBlock(W) === null), `костёр ${f.name}: ${sleepBlock(W)}`);
  } }

// ---------- 2. сон до утра, лечение, честные таймеры ----------
{ const W = mk(), p = W.player; inTavern(W); toNight(W);
  p.hp = 5; W.pst = { poison: { t: 30, n: 3 } }; W.buffs.push({ stat: 'dmg', amt: 5, t: 30, src: 'test' }, { stat: 'luck', amt: 5, t: 1e4, src: 'long' });
  restoreAllies(W, [{ type: 'guard', hp: 3 }]); const ally = W.allies[0];
  const boss = W.cfg.bosses.list.find(b => !b.level), bo = W.enemies.find(e => e.boss && e.type === boss.type); killEnemy(W, bo, 0); W.bossDead[boss.type] = 60;
  W.shop.t = W.cfg.shop.restock - 30; const t0 = W.t, end = wakeTime(W), ms = performance.now();
  const r = sleep(W); const took = performance.now() - ms;
  ok(r === 'ok', 'сон не удался: ' + r);
  ok(Math.abs(W.t - end) < .5 && clockText(W.t, W.cfg.daynight).startsWith('07:0'), 'проснулся не в 7 утра: ' + clockText(W.t, W.cfg.daynight));
  ok(W.t - t0 > W.cfg.daynight.len * .25 && !isNight(W.t, W.cfg.daynight), 'ночь не прошла');
  ok(p.hp === p.maxhp && !Object.keys(W.pst).length && ally.hp === ally.maxhp, 'не вылечился полностью, яд остался или отряд не вылечен');
  ok(!W.buffs.some(b => b.src === 'test') && W.buffs.some(b => b.src === 'long'), 'баффы не идут во сне');
  ok(W.shop.t < W.cfg.shop.restock - 30, 'витрина не обновилась за ночь');
  ok(W.enemies.some(e => e.boss && e.type === boss.type && !e.dead) || !W.bossDead[boss.type], 'босс не возродился за ночь');
  ok(W.ev.some(v => v.k === 'wake' && !v.woken && v.hours >= 6), 'нет события пробуждения');
  ok(took < 1500, `сон считался ${took.toFixed(0)} мс`);
  console.log(`ночь: ${clockText(t0, W.cfg.daynight)} → ${clockText(W.t, W.cfg.daynight)}, ${((W.t - t0)).toFixed(0)} с игры, счёт ${took.toFixed(0)} мс`); }
// ---------- 3. разбудили ----------
{ const W = mk(c => { c.map.places.find(q => q.id === 'taverna').r = 4; }), p = W.player; inTavern(W); toNight(W); p.hp = 30; W.dif.hear = 30;     // маленькое место: враг не теряет след
  const e = spawnEnemy(W, 'imp', p.x + 22, p.z); e.alert = false; e.mode = null;
  const r = sleep(W); ok(r === 'woken' && p.hp < p.maxhp && isNight(W.t, W.cfg.daynight), `враг не разбудил: ${r}, ${clockText(W.t, W.cfg.daynight)}`);
  ok(W.ev.some(v => v.k === 'wake' && v.woken), 'нет события «разбудили»'); }

if (fails.length) { console.log('ПРОВАЛ:\n' + [...new Set(fails)].join('\n')); process.exit(1); }
console.log('Сон 3D: OK');
