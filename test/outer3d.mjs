// Тест большого мира 3D (шаг C3b): бот баланса (как в balance3d) на глубинах пояса за ядром — под разными углами, то есть
// в разных биомах. Глубже — опаснее; в лучшем снаряжении у ядра почти не гибнут; у края мира риск есть, но пройти можно;
// голый герой за ядром гибнет. Генератор: места и дома не в воде и не друг в друге, у каждого посёлка путь к лагерю. Напор — прежний (кольцо и погоня, без стаек G1): меряем силу врагов по глубине.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, aliveEnemies, refreshGear } from '../3d/src/sim.js';
import { pointAtDepth, depthCurve } from '../3d/src/levels3d.js';
import { makeMap } from '../3d/src/map.js';
import { waterDist } from '../3d/src/terrain3d.js';
import { biomeAt, BIOMES } from '../3d/src/worldgen3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const TIERS = {
  'без вещей': {},
  'чёрное': { weapon: 'w_greatsword_black', body: 'a_body_plate_black', head: 'a_head_helm_black', boots: 'a_boots_greaves_black', cloak: 'a_cloak_pelt_black', ring: 'r_ring_blood', amulet: 'm_talisman_blood' }
};
const SEEDS = Number(process.env.OUT_SEEDS || 8), SECONDS = 75;
function run(tier, depth, seed, lv) {
  const cfg = JSON.parse(JSON.stringify(CFG3)); cfg.enemies.count = 5; cfg.enemies.roam.on = false; cfg.map.places = []; cfg.bosses.list = []; cfg.terrain.on = false;
  const W = createWorld(cfg, mulberry32(seed * 7919 + 3)), pt = pointAtDepth(cfg, depth, seed * 1.37 + .4);
  Object.assign(W.inv.eq, TIERS[tier]); W.lv = lv; refreshGear(W); W.player.hp = W.player.maxhp; W.player.x = pt.x; W.player.z = pt.z;     // уровень, с которым сюда приходят
  let taken = 0; const dodge = mulberry32(seed + 99);
  for (let i = 0; i < 60 * SECONDS; i += 1) {
    const p = W.player, en = aliveEnemies(W); let tgt = null, bd = 1e9;
    for (const e of en) { const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < bd) { bd = d; tgt = e; } }
    const inp = { mx: 0, mz: 0, attack: false, roll: false };
    if (tgt && bd < 30) {
      const C = cfg.enemies[tgt.type], reach = cfg.player.attackRange + W.gear.reach + C.radius * .5;
      if (bd > reach * .8) { inp.mx = (tgt.x - p.x) / bd; inp.mz = (tgt.z - p.z) / bd; }
      inp.attackPress = bd < reach + .4;
      if (tgt.state === 'wind' && bd < C.range + 1.2 && tgt.t > C.wind * .6 && p.rollCd <= 0 && dodge() < .5) inp.roll = true;
    }
    const h = p.hp; step(W, 1 / 60, inp); if (p.hp < h) taken += h - p.hp;
    if (p.dead) return { dead: true, kills: W.kills, taken };
  }
  return { dead: false, kills: W.kills, taken };
}
const T = {}, LV = { 1.25: 15, 1.5: 22, 2: 30 };
const cell = (tier, depth, lv, key) => {
  let dead = 0, kills = 0, taken = 0; for (let s = 0; s < SEEDS; s++) { const r = run(tier, depth, s, lv); dead += r.dead ? 1 : 0; kills += r.kills; taken += r.taken; }
  T[key] = { dead: dead / SEEDS, kills: kills / SEEDS, tpk: taken / Math.max(1, kills) };
  console.log(`${tier} / глубина ${depth} / ур. ${lv}`.padEnd(32), `смертей ${(dead / SEEDS * 100).toFixed(0).padStart(3)}%  убито ${(kills / SEEDS).toFixed(1).padStart(5)}  урона на убийство ${(taken / Math.max(1, kills)).toFixed(1)}`);
};
for (const tier of Object.keys(TIERS)) for (const depth of [1.25, 1.5, 2]) cell(tier, depth, LV[depth], tier + depth);
cell('чёрное', 2, 15, 'чёрное2@15');                              // тот же уровень, что у ядра: глубже — опаснее
ok(T['чёрное2@15'].tpk > T['чёрное1.25'].tpk * 1.2, 'у края мира не опаснее, чем у ядра (на одном уровне)');
ok(T['чёрное1.25'].dead <= .3, 'в лучшем снаряжении у ядра гибнут слишком часто: ' + T['чёрное1.25'].dead);
ok(T['чёрное2'].dead <= .9, 'у края мира не пройти и в лучшем снаряжении: ' + T['чёрное2'].dead);
ok(T['без вещей1.5'].dead >= .75, 'голый герой за ядром выживает: ' + T['без вещей1.5'].dead);     // 8 прогонов: шаг 12,5 %

// ---------- генератор ----------
{ const map = makeMap(CFG3), G = CFG3.worldgen, R = CFG3.world.radius;
  const gen = CFG3.map.places.filter(p => p.gen); ok(gen.filter(p => p.safe).length >= 8 && gen.filter(p => p.danger).length >= 12, 'мало посёлков или опасных мест');
  ok(gen.every(p => Math.hypot(p.x, p.z) > G.coreR + 20 && Math.hypot(p.x, p.z) < R - 20 && waterDist(map.river, p.x, p.z) > 12), 'место в ядре, за краем или в реке');
  ok(gen.every((p, i) => gen.every((q, j) => i === j || Math.hypot(p.x - q.x, p.z - q.z) > (p.r + q.r) * .8)), 'места наложились');
  ok(map.buildings.every((b, i) => map.buildings.every((c, j) => i === j || b.x1 < c.x0 || c.x1 < b.x0 || b.z1 < c.z0 || c.z1 < b.z0)), 'дома наложились');
  ok(map.buildings.filter(b => b.vil).every(b => [[b.x0, b.z0], [b.x1, b.z1]].every(([x, z]) => waterDist(map.river, x, z) > 3)), 'дом посёлка в воде');
  ok(new Set(gen.map(p => biomeAt(CFG3, p.x, p.z))).size >= 4, 'места не во всех биомах');
  ok(BIOMES.every(b => { for (let a = 0; a < 6.28; a += .05) if (biomeAt(CFG3, Math.sin(a) * 300, Math.cos(a) * 300) === b) return true; return false; }), 'какого-то биома нет на круге 300 м');
  ok(biomeAt(CFG3, 10, 20) === null && Math.abs(depthCurve(CFG3, R) - G.depthMax) < 1e-9, 'в ядре есть биом или край мира не на depthMax');
  ok(CFG3.map.links.length === gen.filter(p => p.safe).length, 'не у каждого посёлка связь к лагерю'); }

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Большой мир 3D: OK');
