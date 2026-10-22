// Тест дальних врагов и элиты 3D: лучник, колдун, снаряды и пятна, свойства элиты, данные и журнал.
import { CFG3 } from '../3d/src/config3d.js';
import { DROPS } from '../3d/src/data/loot.js';
import { createWorld, step, mulberry32, spawnEnemy, respawnPlayer, hireAlly, killEnemy } from '../3d/src/sim.js';
import { applyStatus } from '../3d/src/status3d.js';
import { bestiaryEntry } from '../3d/src/craft3d.js';
import { eliteName } from '../3d/src/foes3d.js';
import { readFileSync } from 'node:fs';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };

// ---- данные ----
const E = CFG3.enemies, K = CFG3.elite;
for (const t of ['archer', 'witch']) { const C = E[t]; ok(C.name && C.hp > 0 && C.range > 6 && C.ranged && C.ranged.keep[0] < C.ranged.keep[1] && C.ranged.keep[1] < C.range, 'данные ' + t); ok(DROPS[t], 'добыча ' + t); }
ok(E.archer.ranged.kind === 'arrow' && E.archer.ranged.speed > 5 && E.witch.ranged.kind === 'hex' && E.witch.ranged.delay >= .8, 'виды дальнего боя');
for (const [z, t] of Object.entries(E.regions)) for (const [n, w] of t) ok(E[n] && w > 0, `регион ${z}: ${n}`);
ok(Object.values(E.regions).some(t => t.some(x => x[0] === 'archer')) && Object.values(E.regions).some(t => t.some(x => x[0] === 'witch')), 'дальники водятся в зонах');
for (const [id, A] of Object.entries(K.affixes)) ok(A.name && /^#[0-9a-f]{6}$/.test(A.color), 'свойство элиты ' + id);
ok(K.chance > 0 && K.chance < .15 && K.hp > 1 && K.dmg > 1 && K.xp > 1 && K.lootRolls >= 2, 'числа элиты');
ok(readFileSync(new URL('../3d/src/journal.js', import.meta.url), 'utf8').includes("'archer', 'witch'"), 'бестиарий показывает новых врагов');
for (const t of ['archer', 'witch']) { const b = bestiaryEntry(t, CFG3); ok(b && b.name === E[t].name && b.where.length && !b.where.includes('везде'), 'запись бестиария ' + t + ': ' + JSON.stringify(b && b.where)); }

// ---- мир ----
const mk = (seed = 1, tweak) => { const cfg = JSON.parse(JSON.stringify(CFG3)); cfg.enemies.count = 0; cfg.bosses.list = []; cfg.map.places = []; cfg.elite.chance = 0; cfg.elite.depthK = cfg.elite.dangerK = cfg.elite.nightK = 0; cfg.elite.extra = false;     /* прежние 5 свойств; новые проверяет moves3d.mjs (этап 2 «круче») */ if (tweak) tweak(cfg); const W = createWorld(cfg, mulberry32(seed)); W.player.x = 30; W.player.z = -38; return W; };     // у таверны (дома крупнее с 3.90)
const run = (W, sec, inp = {}) => { for (let i = 0; i < sec * 60; i++) step(W, 1 / 60, inp); };
const foe = (W, type, dx, dz = 0) => { const e = spawnEnemy(W, type, W.player.x + dx, W.player.z + dz); e.alert = true; e.cd = .01; return e; };

{ // лучник: держит дистанцию, стреляет, стрела ранит; перекат даёт неуязвимость
  const W = mk(1); W.inv.eq.weapon = null; const e = foe(W, 'archer', 9); const hp0 = W.player.hp; let shot = false, hitAt = -1;
  for (let i = 0; i < 60 * 6; i++) { step(W, 1 / 60, {}); if (W.proj.length) shot = true; if (W.player.hp < hp0 && hitAt < 0) hitAt = i / 60; }
  ok(shot, 'лучник выстрелил'); ok(W.player.hp < hp0 && hitAt > E.archer.wind, 'стрела ранила не раньше окончания замаха: ' + hitAt);
  const d = Math.hypot(e.x - W.player.x, e.z - W.player.z); ok(d > 5.5 && d < 11, 'дистанция лучника ' + d.toFixed(1));
  ok(W.ev.some(v => v.k === 'shot') && W.ev.concat().length >= 0, 'событие выстрела'); }
{ // подошли вплотную: отступает
  const W = mk(2); const e = foe(W, 'archer', 2); e.cd = 99; const d0 = Math.hypot(e.x - W.player.x, e.z - W.player.z); run(W, 1.2); const d1 = Math.hypot(e.x - W.player.x, e.z - W.player.z); ok(d1 > d0 + 1.5, `лучник отступает: ${d0.toFixed(1)}→${d1.toFixed(1)}`); }
{ // перекат в момент попадания: стрела расходуется, урона нет
  const W = mk(3); const hp0 = W.player.hp; W.proj.push({ x: W.player.x + .3, z: W.player.z, vx: -10, vz: 0, dmg: 20, on: null, life: 2, from: 0, kind: 'arrow' }); W.player.state = 'roll'; W.player.rollT = 0; step(W, 1 / 60, {}); ok(W.player.hp === hp0 && W.proj.length === 0, 'перекат уворачивается от стрелы'); }
{ // стрела не проходит сквозь стену дома
  const W = mk(4); const b = W.map.buildings[0]; W.player.x = b.x0 - 6; W.player.z = b.z; W.proj.push({ x: b.x0 - 3, z: b.z + 1.5, vx: 10, vz: 0, dmg: 20, on: null, life: 3, from: 0, kind: 'arrow' }); const hp0 = W.player.hp;
  run(W, .8); ok(W.proj.length === 0 && W.ev.some(v => v.k === 'projend') && W.player.hp === hp0, 'стрела должна упасть у стены'); }
{ // стрела ранит союзника на пути
  const W = mk(5); const bar = W.map.buildings.find(b => b.npc && b.npc.kind === 'captain'); W.player.x = bar.npc.x + 1; W.player.z = bar.npc.z; step(W, 1 / 60, {}); W.inv.ash = 1e6; W.lv = Math.max(W.lv, 20); ok(hireAlly(W, Object.keys(CFG3.squad.types)[0]) === 'ok', 'наём'); W.player.x = 36; W.player.z = 40; const a = W.allies[0]; a.x = 40; a.z = 40; const hp0 = a.hp;     // 4.18д: наёмник — с 20-го, цены ×10
  W.proj.push({ x: 39.4, z: 40, vx: 12, vz: 0, dmg: 15, on: null, life: 2, from: 0, kind: 'arrow' }); step(W, 1 / 60, {}); ok(a.hp < hp0, 'союзник ранен стрелой'); }
{ // колдун: пятно с задержкой; кто ушёл, тот цел; кто остался, горит
  const W = mk(6); W.inv.eq.weapon = null; foe(W, 'witch', 9); let haz = null; const hp0 = W.player.hp;
  for (let i = 0; i < 60 * 4 && !haz; i++) { step(W, 1 / 60, {}); if (W.haz.length) haz = { ...W.haz[0] }; }
  ok(haz && haz.r === E.witch.ranged.r && haz.delay === E.witch.ranged.delay, 'пятно появилось'); ok(W.player.hp === hp0, 'пятно не бьёт сразу');
  W.player.x += 8; W.player.z += 8; W.enemies.length = 0; run(W, 1.3); ok(W.player.hp === hp0 && !W.haz.length, 'ушёл из пятна: урона нет'); }
{ const W = mk(7); W.haz.push({ x: W.player.x, z: W.player.z, r: 2.4, t: 0, delay: .5, dmg: 30, on: ['burn', 1, 3, 4], by: 1 }); const hp0 = W.player.hp; run(W, .4); ok(W.player.hp === hp0, 'до срока нет урона'); run(W, .3); ok(W.player.hp < hp0 && !W.haz.length && W.pst.burn, 'остался в пятне: урон и горение'); }
{ const W = mk(8); W.proj.push({ x: 0, z: 0, vx: 1, vz: 0, dmg: 1, life: 5, from: 0 }); W.haz.push({ x: 0, z: 0, r: 1, t: 0, delay: 5, dmg: 1, by: 1 }); W.player.hp = 0; step(W, 1 / 60, {}); respawnPlayer(W); ok(!W.proj.length && !W.haz.length, 'снаряды и пятна сброшены после смерти'); }

// ---- элита ----
{ const W = mk(9, c => { c.elite.chance = 1; }); const imp = spawnEnemy(W, 'imp', 40, -30); ok(imp.elite && imp.aff && imp.affName && imp.scaleMul === K.scale && imp.hp > E.imp.hp * K.hp * .9, 'элитный бес'); ok(eliteName(W, imp).includes(E.imp.name), 'имя элиты: ' + eliteName(W, imp)); }
{ const W = mk(10, c => { c.elite.chance = 0; }); ok(!spawnEnemy(W, 'imp', 40, -30).elite, 'без шанса нет элиты'); }
{ const W = mk(11, c => { c.elite.chance = 1; c.bosses.list = []; }); const b = spawnEnemy(W, 'devourer', 40, -30); ok(!b.elite, 'боссы не бывают элитой'); }
{ // доля элиты при обычных числах
  const cfg = JSON.parse(JSON.stringify(CFG3)); cfg.enemies.count = 0; cfg.bosses.list = []; const W = createWorld(cfg, mulberry32(12)); let n = 0, el = 0; const kinds = {};
  for (let i = 0; i < 600; i++) { const e = spawnEnemy(W, 'imp', 30, -30); n++; if (e.elite) { el++; kinds[e.aff] = (kinds[e.aff] || 0) + 1; } } W.enemies.length = 0;
  const f = el / n; ok(f > .015 && f < .09, 'доля элиты ' + f.toFixed(3)); ok(Object.keys(kinds).length === Object.keys(K.affixes).length + (K.extra ? Object.keys(K.affixes2).length : 0), 'встречаются все свойства: ' + JSON.stringify(kinds)); }
{ // свойства
  const mkAff = aff => { const W = mk(13, c => { c.elite.chance = 1; c.elite.affixes = { [aff]: c.elite.affixes[aff] }; }); const e = spawnEnemy(W, 'imp', W.player.x + 1.2, W.player.z); e.alert = true; return { W, e }; };
  { const { e } = mkAff('swift'); ok(e.spdMul > 1.3, 'быстрый'); }
  { const { W, e } = mkAff('burning'); ok(applyStatus(W, e, 'burn', 3, 3) === false && e.onx && e.onx[0] === 'burn', 'пылающий не горит и поджигает'); }
  { const { W, e } = mkAff('armored'); ok(e.maxhp > E.imp.hp * K.hp * 1.4, 'бронированный здоровее'); }
  { const { W, e } = mkAff('vampiric'); e.hp = 10; const hp0 = W.player.hp; e.state = 'wind'; e.t = E.imp.wind; step(W, 1 / 60, {}); ok(W.player.hp < hp0 && e.hp > 10, 'кровопийца лечится от удара: ' + e.hp); }
  { const { W, e } = mkAff('explosive'); const hp0 = W.player.hp; W.player.x = e.x - 1; W.player.z = e.z; killEnemy(W, e, 1); const hpK = W.player.hp;
    ok(W.haz.length === 1 && W.haz[0].by === 'elite' && W.haz[0].r === K.affixes.explosive.r, 'взрывной оставляет пятно'); run(W, .5); ok(W.player.hp === hpK, 'взрыв с задержкой'); run(W, .6); ok(W.player.hp < hpK && !W.haz.length, 'взрыв ранит стоящего рядом'); }
}
{ // опыт и добыча элиты больше
  const xpOf = el => { const W = mk(14, c => { c.elite.chance = el ? 1 : 0; c.elite.affixes = { swift: c.elite.affixes.swift }; }); const e = spawnEnemy(W, 'imp', 40, -30); W.xp = 0; W.lv = 1; killEnemy(W, e, 1); return W.ev.filter(v => v.k === 'xp').pop().n; };
  ok(xpOf(true) >= xpOf(false) * K.xp * .8, `опыт элиты ×${K.xp}: ${xpOf(false)} → ${xpOf(true)}`);
  const drops = el => { let n = 0; for (let sd = 0; sd < 60; sd++) { const W = mk(100 + sd, c => { c.elite.chance = el ? 1 : 0; }); const e = spawnEnemy(W, 'brute', 40, -30); killEnemy(W, e, 1); n += W.drops.reduce((a, d) => a + d.n, 0); } return n; };
  ok(drops(true) > drops(false) * 1.4, 'добычи с элиты больше: ' + drops(false) + ' → ' + drops(true)); }
{ // «элита рядом» сообщается один раз
  const W = mk(15, c => { c.elite.chance = 1; }); spawnEnemy(W, 'imp', W.player.x + 10, W.player.z); run(W, .3); const n = W.ev.filter(v => v.k === 'elite').length; ok(n === 1, 'сообщение об элите: ' + n); }
if (fails.length) { console.error('foes3d FAIL\n' + fails.join('\n')); process.exit(1); }
console.log('Дальние враги и элита 3D: OK');
