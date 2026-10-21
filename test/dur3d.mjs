// Тест прочности (4.03): износ от ударов оружием, ран и смерти; до порога сила полная, к 100% — вдвое; украшения не изнашиваются;
// кузнец чинит всё за пепел, ремкомплект — в поле; износ переживает сохранение; качество для библиотеки — без износа.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnEnemy, refreshGear, hurtPlayer, useItem } from '../3d/src/sim.js';
import { wearMul, wearHit, wearHurt, wearOf, repairAll, repairList } from '../3d/src/dur3d.js';
import { gearStats, serialize, deserialize, rawQ, qOf } from '../3d/src/inv.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const D = CFG3.dur;
const mk = (seed = 1) => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.events.on = false; c.wanderer.on = false; c.bosses.list = []; const W = createWorld(c, mulberry32(seed));
  Object.assign(W.inv.eq, { weapon: 'w_sword_steel', offhand: 's_buckler_steel', body: 'a_body_mail_mail', head: 'a_head_helm_mail', ring: 'r_ring_might' }); W.inv.af = {}; W.inv.bag.length = 0; refreshGear(W); return W; };

// множитель
ok(wearMul(D, { wr: 0 }) === 1 && wearMul(D, { wr: D.soft }) === 1 && Math.abs(wearMul(D, { wr: 100 }) - (1 - D.drop)) < 1e-9 && wearMul(D, { wr: 85 }) < 1 && wearMul(D, { wr: 85 }) > 1 - D.drop, 'множитель износа');
// удары: только оружие; сила падает после порога; урон снижается
{
  const W = mk(); W.inv.eq.ring = null; const g0 = gearStats(W.inv).dmg; let ch = 0;     // кольцо тоже даёт урон — без него
  for (let i = 0; i < Math.ceil(100 / D.hit) + 5; i++) if (wearHit(W)) ch++;
  ok(wearOf(W.inv.af.weapon) === 100 && !wearOf(W.inv.af.body), 'удар изнашивает не то: ' + JSON.stringify(W.inv.af));
  ok(ch >= 5 && ch <= 8, 'сила пересчитывается не каждые 5%: ' + ch);
  const g1 = gearStats(W.inv).dmg; ok(Math.abs(g1 / g0 - (1 - D.drop)) < .06, `сломанный клинок бьёт не вдвое слабее: ${g0} → ${g1}`);
  ok(W.ev.some(v => v.k === 'wear' && v.at === 'soft') && W.ev.some(v => v.k === 'wear' && v.at === 'broken'), 'нет предупреждений об износе');
  ok(rawQ(W.inv.af.weapon) === 1 && qOf(W.inv.af.weapon) < 1, 'качество без износа для библиотеки');
}
// раны: броня и щит, не оружие и не кольцо
{
  const W = mk(); for (let i = 0; i < 20; i++) wearHurt(W);
  ok(wearOf(W.inv.af.body) > 0 && wearOf(W.inv.af.head) > 0 && wearOf(W.inv.af.offhand) > 0 && !wearOf(W.inv.af.weapon) && !wearOf(W.inv.af.ring), 'раны изнашивают не то: ' + JSON.stringify(W.inv.af));
  const W2 = mk(); W2.inv.eq.offhand = 'w_rapier_steel'; for (let i = 0; i < 20; i++) wearHurt(W2); ok(!wearOf(W2.inv.af.offhand), 'клинок во второй руке износился от ран');
}
// смерть
{ const W = mk(); W.player.inv = 0; hurtPlayer(W, 1e7, W.player.x + 1, W.player.z); ok(W.player.dead && wearOf(W.inv.af.weapon) === D.death && wearOf(W.inv.af.body) >= D.death && !wearOf(W.inv.af.ring), 'смерть не изнашивает надетое: ' + JSON.stringify(W.inv.af)); }     // броне — ещё и рана
// бой: удары по манекену изнашивают клинок
{
  const W = mk(3); W.player.inv = 1e9; const e = spawnEnemy(W, 'brute', W.player.x, W.player.z - 2.2); e.hp = e.maxhp = 1e6; W.player.face = Math.PI;
  for (let i = 0; i < 1200; i++) { e.x = W.player.x; e.z = W.player.z - 2.2; e.cd = 1e9; step(W, 1 / 60, { attackPress: i % 6 === 0, aimPt: { x: e.x, z: e.z } }); W.ev.length = 0; }
  const hits = Math.round(wearOf(W.inv.af.weapon) / D.hit); ok(hits >= 10 && e.hp < e.maxhp, `в бою клинок не изнашивается (ударов по износу ${hits})`);
}
// починка у кузнеца
{
  const W = mk(); for (let i = 0; i < 300; i++) wearHit(W); for (let i = 0; i < 300; i++) wearHurt(W); W.inv.bag.push({ id: 'w_axe_steel', n: 1, af: { wr: 50 } });
  const L = repairList(W), cost = L.reduce((a, x) => a + x.cost, 0); ok(L.length === 5 && cost > 0, 'список починки: ' + L.length);
  W.nearNpc = null; ok(repairAll(W) === 'far', 'починка без кузнеца'); W.nearNpc = 'smith'; W.inv.ash = cost - 1; ok(repairAll(W) === 'ash', 'починка без пепла');
  W.inv.ash = cost + 10; const r = repairAll(W); ok(r && r.n === 5 && W.inv.ash === 10 && !repairList(W).length && !wearOf(W.inv.bag[0].af), 'починка не прошла: ' + JSON.stringify(r));
  ok(repairAll(W) === 'none', 'чинить нечего');
}
// ремкомплект
{
  const W = mk(); W.inv.bag.push({ id: 'u_repair_kit', n: 2 }); ok(!useItem(W, 0) && W.inv.bag[0].n === 2, 'ремкомплект на целом снаряжении потрачен');
  for (let i = 0; i < 2000; i++) wearHit(W); ok(useItem(W, 0) && wearOf(W.inv.af.weapon) === 100 - D.kit, 'ремкомплект не снял износ: ' + wearOf(W.inv.af.weapon));
  ok(W.inv.bag[0].n === 1, 'ремкомплект не потрачен');
}
// сохранение
{ const W = mk(); for (let i = 0; i < 200; i++) wearHit(W); const d = deserialize(JSON.parse(JSON.stringify(serialize(W.inv))), 30); ok(Math.abs(wearOf(d.af.weapon) - wearOf(W.inv.af.weapon)) < .01 && wearOf(d.af.weapon) > 0, 'износ не пережил сохранение'); }
// выключено — износа нет
{ const W = mk(); W.cfg.dur.on = false; wearHit(W); wearHurt(W); ok(!wearOf(W.inv.af.weapon) && !wearOf(W.inv.af.body), 'dur.on=false — износ есть'); }
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Прочность 3D: OK');
