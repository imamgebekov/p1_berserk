// Лагеря Мира 5.0 (этап 2, просьба владельца 2026-10-23): ещё три лагеря с частоколом на уровнях ~25 / ~45 / ~65; в каждом костёр
// в середине (лечит и даёт ночлег), лавка, кузня, таверна, дорога; враги внутри не рождаются, за частоколом теряют героя;
// витрина лавки — уровня лагеря: вещи уровня лагеря, редкость выше, цены × price.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnEnemy } from '../3d/src/sim.js';
import { zoneLevel } from '../3d/src/zones3d.js';
import { wdist } from '../3d/src/geo3d.js';
import { insideCamp, campAt, resolve } from '../3d/src/map.js';
import { shopOf, stockPrice } from '../3d/src/economy3d.js';
import { sleepSpot } from '../3d/src/sleep3d.js';
import { BY_ID } from '../3d/src/data/items.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const O = CFG3.outposts, L = CFG3.map.outposts;
ok(L.length === O.list.length && O.list.length === 3, 'лагерей не 3: ' + L.length);
for (const D of O.list) { const o = L.find(q => q.id === D.id); if (!o) { fails.push(`нет лагеря ${D.id}`); continue; }
  ok(Math.abs(zoneLevel(CFG3, o.x, o.z) - D.lv) <= 2, `${o.name}: уровень места ${zoneLevel(CFG3, o.x, o.z).toFixed(1)} при ${D.lv}`);
  ok(wdist(CFG3, o.x, o.z) < CFG3.world.radius - o.r - 20, `${o.name}: у края мира`);
  const kinds = CFG3.map.buildings.filter(b => b.vil === o.id).map(b => b.kind + ':' + (b.npc || ''));
  ok(['shop:merchant', 'smithy:smith', 'tavern:'].every(k => kinds.includes(k)), `${o.name}: нет лавки, кузни или таверны (${kinds})`);
  ok(CFG3.map.links.some(([a, b]) => [a, b].some(q => Math.hypot(q.x - o.x, q.z - o.z) < o.r + 12)), `${o.name}: нет дороги`); }

const mk = () => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; const W = createWorld(c, mulberry32(4)); W.lv = 40; W.inv.ash = 1e6; step(W, 1 / 60, {}); return W; };     // шаг — запас здоровья пересчитан под 40-й уровень
const W = mk(), M = W.map;
// частокол: стена не пускает, ворота пускают героя; враги в воротах выталкиваются наружу
for (const o of M.outposts) {
  const wall = { x: o.x + Math.sin(.4) * o.r, z: o.z + Math.cos(.4) * o.r }; ok(resolve(M, { ...wall }, .5), `${o.name}: стена не держит`);
  ok(M.foeBlocks.some(b => o.x >= b.x0 - o.r - 3 && o.x <= b.x1 + o.r + 3 && o.z >= b.z0 - o.r - 3 && o.z <= b.z1 + o.r + 3), `${o.name}: ворота не закрыты для врагов`);
  ok(campAt(M, o.x, o.z) === o && !campAt(M, o.x + o.r + 5, o.z), `${o.name}: campAt не видит лагерь`);
}
// костёр: в середине, лечит героя, даёт ночлег; не прореживается
for (const o of M.outposts) {
  const f = M.fires.find(q => q.id === o.id); ok(f && f.camp && Math.hypot(f.x - o.x, f.z - o.z) < 1, `${o.name}: нет костра в середине`);
  if (!f) continue; const p = W.player; p.x = f.x + 1; p.z = f.z; p.hp = p.maxhp * .3; p.calm = 0; W.inside = -1; for (let i = 0; i < 120; i++) step(W, 1 / 60, {});
  ok(p.hp > p.maxhp * .3 + 1, `${o.name}: костёр не лечит`); ok(sleepSpot(W) === 'fire', `${o.name}: у костра не уснуть`);
}
// враги: внутри не рождаются, снаружи теряют героя за частоколом
{ const o = M.outposts[0], p = W.player; p.x = o.x; p.z = o.z + 2; const e = spawnEnemy(W, 'brute', o.x + o.r + 6, o.z); e.alert = true; for (let i = 0; i < 30; i++) step(W, 1 / 60, {}); ok(!e.alert, 'враг за частоколом не потерял героя');
  const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 40; const W2 = createWorld(c, mulberry32(9)); W2.player.x = o.x; W2.player.z = o.z; for (let i = 0; i < 600; i++) step(W2, 1 / 60, {});
  ok(!W2.enemies.some(q => !q.dead && !q.boss && insideCamp(o, q.x, q.z, -2)), 'враги рождаются в лагере'); }
// лавки: уровень вещей = уровень лагеря, редкость и цены растут с уровнем лагеря
{ const res = [];
  for (const o of M.outposts) { const b = M.buildings.find(q => q.vil === o.id && q.npc && q.npc.kind === 'merchant'); W.player.x = b.npc.x + 1; W.player.z = b.npc.z; step(W, 1 / 60, {});
    const sh = shopOf(W), gear = sh.stock.filter(s => BY_ID[s.id].slot); ok(sh !== W.shop && gear.length && gear.every(s => s.il === o.lv), `${o.name}: витрина не своя или вещи не уровня лагеря`);
    res.push({ o, rar: gear.reduce((a, s) => a + BY_ID[s.id].rar, 0) / gear.length, k: stockPrice(W, sh.stock[0]) / stockPrice(W, { id: sh.stock[0].id }) }); }
  ok(res.every(r => Math.abs(r.k - r.o.price) < .01), 'цены лавки лагеря не × price: ' + res.map(r => r.k.toFixed(2)).join(' / '));
  const h = M.buildings.find(q => q.npc && q.npc.kind === 'merchant' && !q.vil); W.player.x = h.npc.x + 1; W.player.z = h.npc.z; step(W, 1 / 60, {}); const g = W.shop.stock.filter(s => BY_ID[s.id].slot), base = g.reduce((a, s) => a + BY_ID[s.id].rar, 0) / g.length;
  ok(shopOf(W) === W.shop && res.every(r => r.rar > base), `витрины лагерей не лучше лагерной: ${base.toFixed(2)} / ${res.map(r => r.rar.toFixed(2)).join(' / ')}`); }

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Лагеря Мира 5.0: OK (' + L.map(o => `${o.name} ${o.lv}`).join(', ') + ')');
