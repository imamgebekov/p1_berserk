// Тест снаряжения бойцов (2026-10-20): найм дорогой, нанятый — без вещей и слабее; вещи из общей сумки надеваются по правилам
// героя-образца (ратник — Торн, стрелок — Сойка); сила растёт от вещей, броня режет урон; вещи павшего или уволенного — на землю;
// сохранение отряда с вещами; gear.on: false — прежние бойцы.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, mulberry32, step, hireAlly, refreshGear } from '../3d/src/sim.js';
import { allyInv, allyHeroOf, refreshAlly, allyDmgOf, allyHp, allyDmg, dismissAlly, hurtAlly } from '../3d/src/squad3d.js';
import { equipAt, unequip, entryOf } from '../3d/src/inv.js';
import { createSaver, loadSave } from '../3d/src/save3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const mk = (tweak) => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; if (tweak) tweak(c); const W = createWorld(c, mulberry32(4)); W.lv = 20; const cap = W.map.buildings.find(b => b.npc && b.npc.kind === 'captain'); W.player.x = cap.npc.x + 1; W.player.z = cap.npc.z; step(W, 1 / 60, {}); W.inv.ash = 1e5; return W; };
const T = CFG3.squad.types;
ok(T.guard.cost >= 500 && T.soldier.cost >= 1200 && T.c_thorn.cost >= 2000, 'найм не подорожал');
{
  const W = mk(); ok(hireAlly(W, 'soldier') === 'ok', 'наём ратника'); const a = W.allies.find(x => x.type === 'soldier');
  ok(a && Object.values(a.eq).every(v => !v), 'нанятый не голый');
  ok(a.maxhp === Math.round(allyHp(W, T.soldier) * CFG3.squad.gear.naked.hp) && Math.abs(allyDmgOf(W, a) - allyDmg(W, T.soldier) * CFG3.squad.gear.naked.dmg) < 1e-6, `голый не слабее: ${a.maxhp}`);
  ok(allyHeroOf(T.soldier) === 'thorn' && allyHeroOf(T.c_jay) === 'jay' && allyHeroOf(T.c_irga) === 'irga', 'правила вещей бойца');
  const hp0 = a.maxhp, d0 = allyDmgOf(W, a);
  W.inv.bag.push(entryOf('w_sword_steel', 0, null, 20, null), entryOf('a_body_plate_black', 0, null, 20, null), entryOf('w_bow_iron', 0, null, 5, null));
  const I = allyInv(W, a); ok(equipAt(I, W.inv.bag.findIndex(s => s.id === 'w_sword_steel'), 'thorn') && equipAt(I, W.inv.bag.findIndex(s => s.id === 'a_body_plate_black'), 'thorn'), 'не надел на бойца');
  refreshAlly(W, a); ok(a.eq.weapon === 'w_sword_steel' && a.eq.body === 'a_body_plate_black' && W.inv.bag.length === 1, 'вещи не перешли с сумки на бойца');
  ok(allyDmgOf(W, a) > d0 + 5 && a.garmor > 5, `оружие и броня не дали силы: ${d0} → ${allyDmgOf(W, a)}, броня ${a.garmor}`);
  ok(!equipAt(I, 0, 'thorn') && W.inv.bag[0].id === 'w_bow_iron', 'ратник взял лук');
  const e = { x: a.x + 1, z: a.z }; a.hp = a.maxhp; hurtAlly(W, a, 100, e); ok(a.maxhp - a.hp < 100, 'броня бойца не режет урон');
  // сохранение отряда с вещами
  const mem = () => { const o = {}; return { getItem: k => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); }, removeItem: k => { delete o[k]; }, o }; };
  const st = mem(); createSaver(W, st).write(true); const sv = loadSave(40, st), q = sv.squad.find(x => x.type === 'soldier');
  ok(q && q.kit && q.kit.eq.weapon === 'w_sword_steel' && q.kit.il.weapon === 20, 'снаряжение бойца не сохранилось: ' + JSON.stringify(q && q.kit));
  // снять — в сумку; уволить — вещи на землю
  ok(unequip(I, 'weapon', 40) && W.inv.bag.some(s => s.id === 'w_sword_steel'), 'снять с бойца в сумку');
  const n0 = W.drops.length; dismissAlly(W, a.id); ok(W.drops.length === n0 + 1 && W.drops.some(d => d.id === 'a_body_plate_black' && d.il === 20), 'вещи уволенного не упали');
}
{
  const W = mk(c => { c.squad.gear.on = false; }); hireAlly(W, 'soldier'); const a = W.allies.find(x => x.type === 'soldier');
  ok(a.maxhp === allyHp(W, T.soldier) && Math.abs(allyDmgOf(W, a) - allyDmg(W, T.soldier)) < 1e-6, 'gear.on: false — бойцы не прежние');
}
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Снаряжение бойцов 3D: OK');
