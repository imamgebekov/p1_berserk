// Баланс веток древа (2026-10-21): у каждого героя три ветки по 10 активных умений. Бот бьёт неподвижные манекены 30 с
// только умениями одной ветки (все на 3-м ранге, уровень 45, стальное снаряжение) и обычным ударом; урон в секунду —
// по одной цели и по группе из четырёх. Сравнение: «только удар», «прежние 8» (как раньше) и три ветки.
// Пределы: у веток разные роли, поэтому каждая ветка в своей лучшей сцене сильнее простого удара (×1,15) и даёт не меньше BR_MIN
// (по умолчанию 0,6) от лучшей ветки героя в этой сцене.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnEnemy, refreshGear } from '../3d/src/sim.js';
import { heroAbilities, useAbility } from '../3d/src/abilities3d.js';
import { treeOf } from '../3d/src/tree3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const MIN = Number(process.env.BR_MIN || .6), SEC = Number(process.env.BR_SEC || 30), HEROES = (process.env.BR_HEROES || 'thorn,vale,jay,irga,warlock').split(',');     // ветки помощи (Выживание Сойки) упираются в запас ресурса — 0,6
const ARMS = { thorn: { weapon: 'w_sword_steel', offhand: 's_buckler_steel' }, jay: { weapon: 'w_longbow_steel' }, irga: { weapon: 'w_staff_steel' }, warlock: { weapon: 'w_scythe_steel' }, vale: { weapon: 'w_sword_steel', offhand: 'w_rapier_steel' } };
const ARMOR = { body: 'a_body_mail_mail', head: 'a_head_helm_mail', boots: 'a_boots_greaves_mail', ring: 'r_ring_might', amulet: 'm_amulet_ward' };
const X0 = 0, Z0 = 200;     // открытое поле за ядром
const RANGED = h => h === 'jay' || h === 'irga';
function world(hero, ids) {
  const c = JSON.parse(JSON.stringify(CFG3)); Object.assign(c, {}); c.enemies.count = 0; c.bosses.list = []; c.map.places = []; c.events.on = false; c.wanderer.on = false; c.ambient.on = false; c.terrain.on = false;
  c.map.buildings = c.map.buildings.filter(b => Math.hypot(b.x - X0, b.z - Z0) > 40); if (c.elite) c.elite.chance = 0;
  const W = createWorld(c, mulberry32(11)); W.hero = hero; W.lv = 45; W.ap = 0; Object.assign(W.inv.eq, ARMOR, ARMS[hero]);
  W.ab = {}; for (const id of ids) W.ab[id] = 3; refreshGear(W); Object.assign(W.player, { x: X0, z: Z0, face: Math.PI, inv: 1e9 }); W.player.hp = W.player.maxhp; return W;
}
function fight(hero, ids, n) {
  const W = world(hero, ids), A = heroAbilities(W), order = A.map((a, i) => ({ a, i })).filter(x => ids.includes(x.a.id)).sort((u, v) => ((W.cfg.abilities[hero][v.a.id] || W.cfg.abilities.gen[v.a.kind] || {}).cost || 0) - ((W.cfg.abilities[hero][u.a.id] || W.cfg.abilities.gen[u.a.kind] || {}).cost || 0));
  const spots = n === 1 ? [[0, 2.4]] : [[0, 2.4], [1.6, 3.2], [-1.6, 3.2], [0, 4.2]], dummies = spots.map(([dx, dz]) => { const e = spawnEnemy(W, 'brute', X0 + dx, Z0 - dz); e.hp = e.maxhp = 2e5; e.cd = 1e9; e.alert = true; e.x0 = e.x; e.z0 = e.z; return e; });
  let t = 0;
  for (let i = 0; i < SEC * 60; i++) {
    for (const e of dummies) { e.x = e.x0; e.z = e.z0; e.vx = e.vz = 0; e.state = 'rec'; e.t = -1e9; e.cd = 1e9; if (e.hp < 1e3) e.hp = e.maxhp; }
    const p = W.player; p.hp = p.maxhp; let tg = dummies[0], bd = 1e9; for (const e of dummies) { const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < bd) { bd = d; tg = e; } }
    const far = bd > (RANGED(hero) ? 9 : 2.2), aim = { x: tg.x, z: tg.z }; W.aimPt = aim;
    if ((t -= 1 / 60) <= 0) { t = .1; for (const { i: k } of order) if (useAbility(W, k) === 'ok') break; }
    step(W, 1 / 60, { mx: far ? (tg.x - p.x) / bd : 0, mz: far ? (tg.z - p.z) / bd : 0, attackPress: !far && i % 6 === 0, aimPt: aim });     // короткие удары, к цели — шагом
  }
  return dummies.reduce((s, e) => s + (e.maxhp - e.hp), 0) / SEC;
}
const out = {};
for (const hero of HEROES) {
  const T = treeOf(hero, CFG3), br = T.map(b => ({ name: b.name, ids: b.nodes.filter(n => n.kind === 'active').map(n => n.id) })), old8 = heroAbilities({ hero }).slice(0, 8).map(a => a.id);
  const sets = [['только удар', []], ['прежние 8', old8], ...br.map(b => [b.name, b.ids])], row = {};
  for (const [name, ids] of sets) row[name] = { one: fight(hero, ids, 1), four: fight(hero, ids, 4) };
  out[hero] = row;
  console.log(hero.padEnd(8), Object.entries(row).map(([k, v]) => `${k}: ${Math.round(v.one)}/${Math.round(v.four)}`).join(' | '));
  const b = br.map(x => row[x.name]), base = row['только удар'];
  const best = { one: Math.max(...b.map(x => x.one)), four: Math.max(...b.map(x => x.four)) };     // у веток разные роли: одна цель, толпа, защита
  for (const [i, x] of b.entries()) {
    ok(Math.max(x.one / base.one, x.four / base.four) >= 1.15, `${hero}/${br[i].name}: ветка не сильнее простого удара ни в одной сцене`);
    const sc = Math.max(x.one / best.one, x.four / best.four); ok(sc >= MIN, `${hero}/${br[i].name}: слабее лучшей ветки героя в обеих сценах (${Math.round(sc * 100)}%)`);
  }
}
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log(`Баланс веток древа 3D: OK (каждая ветка — не меньше ${MIN} лучшей в своей сцене)`);
