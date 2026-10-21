// Конец игры (4.06, предел героя 70, враги до 80): бот как в outer3d — герой в чёрном снаряжении своего уровня бьётся с пятёркой врагов
// в кольцах мира ×2 под разными углами; и один на один с боссами колец. Пояс 60–70 герою 70-го — по силам; 70–80 — опаснее;
// герою 60-го (конец сюжета) кольцо 70–80 заметно опаснее. Боссы колец — мировые, на рейд из 10 (решение владельца): в одиночку не взять.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, aliveEnemies, refreshGear } from '../3d/src/sim.js';
import { zoneLevel } from '../3d/src/zones3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const GEAR = { weapon: 'w_greatsword_black', body: 'a_body_plate_black', head: 'a_head_helm_black', boots: 'a_boots_greaves_black', cloak: 'a_cloak_pelt_black', ring: 'r_ring_blood', amulet: 'm_talisman_blood' };
const SEEDS = Number(process.env.END_SEEDS || 8), STRICT = !process.env.END_MEASURE;
function fightLoop(W, cfg, sec, seed) {
  let taken = 0; const dodge = mulberry32(seed + 99);
  for (let i = 0; i < 60 * sec; i++) {
    const p = W.player, en = aliveEnemies(W); let tgt = null, bd = 1e9;
    for (const e of en) { const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < bd) { bd = d; tgt = e; } }
    const inp = { mx: 0, mz: 0 };
    if (tgt && bd < 40) { const C = cfg.enemies[tgt.type], reach = cfg.player.attackRange + W.gear.reach + C.radius * .5;
      if (bd > reach * .8) { inp.mx = (tgt.x - p.x) / bd; inp.mz = (tgt.z - p.z) / bd; }
      inp.attackPress = bd < reach + .4;
      if (tgt.state === 'wind' && bd < C.range + 1.5 && tgt.t > C.wind * .6 && p.rollCd <= 0 && dodge() < .5) inp.roll = true; }
    const h = p.hp; step(W, 1 / 60, inp); if (p.hp < h) taken += h - p.hp;
    if (p.dead) return { dead: true, kills: W.kills, taken };
  }
  return { dead: false, kills: W.kills, taken };
}
const hero = (cfg, seed, lv, x, z, up) => { const W = createWorld(cfg, mulberry32(seed * 7919 + 3)); Object.assign(W.inv.eq, GEAR); W.lv = lv; W.inv.il = Object.fromEntries(Object.keys(GEAR).map(k => [k, lv])); if (up) for (const k of Object.keys(GEAR)) W.inv.up[k] = up; refreshGear(W); W.player.hp = W.player.maxhp; W.player.x = x; W.player.z = z; return W; };
// кольцо: точка на радиусе r под углом по зерну, пятёрка врагов уровня места
function ring(r, lv, seed) {
  const cfg = JSON.parse(JSON.stringify(CFG3)); cfg.enemies.count = 5; cfg.enemies.roam.on = false; cfg.map.places = []; cfg.bosses.list = []; cfg.terrain.on = false;
  const a = seed * 2.399 + .3, x = Math.sin(a) * r, z = Math.cos(a) * r; return { ...fightLoop(hero(cfg, seed, lv, x, z, 0), cfg, 75, seed), at: zoneLevel(cfg, x, z) };
}
const T = {};
const cell = (key, r, lv) => { let dead = 0, kills = 0, taken = 0, at = 0; for (let s = 0; s < SEEDS; s++) { const q = ring(r, lv, s); dead += q.dead; kills += q.kills; taken += q.taken; at += q.at; }
  T[key] = { dead: dead / SEEDS, tpk: taken / Math.max(1, kills) }; console.log(key.padEnd(30), `места ур. ${(at / SEEDS).toFixed(0)}  смертей ${(dead / SEEDS * 100).toFixed(0).padStart(3)}%  убито ${(kills / SEEDS).toFixed(1).padStart(5)}  урона на убийство ${(taken / Math.max(1, kills)).toFixed(0)}`); };
cell('ур.70 / кольцо 60–70', 750, 70);
cell('ур.70 / кольцо 70–80', 1050, 70);
cell('ур.70 / край (≈80)', 1180, 70);
cell('ур.60 / кольцо 70–80', 1050, 60);
// боссы колец: один на один, герой 70-го в чёрном +3
const boss = (type, seed) => {
  const cfg = JSON.parse(JSON.stringify(CFG3)), B = CFG3.bosses.list.find(b => b.type === type); cfg.enemies.count = 0; cfg.enemies.roam.on = false; cfg.events.on = false; cfg.wanderer.on = false; cfg.terrain.on = false; cfg.bosses.list = [B];
  const W = hero(cfg, seed, 70, B.x, B.z + 9, 3), r = fightLoop(W, cfg, 150, seed), e = W.enemies.find(q => q.type === type);
  return { win: !r.dead && (!e || e.dead), hp: e ? e.hp / e.maxhp : 0, lvl: e && e.lvl };
};
for (const type of ['brandlord', 'abyssking']) { let win = 0, hp = 0, lvl = 0; const n = Math.max(4, SEEDS / 2); for (let s = 0; s < n; s++) { const q = boss(type, s); win += q.win; hp += q.hp; lvl = q.lvl; }
  T[type] = { win: win / n, hp: hp / n }; console.log(`босс ${type} (ур. ${lvl})`.padEnd(30), `побед ${(win / n * 100).toFixed(0)}%  у босса в среднем осталось ${(hp / n * 100).toFixed(0)}%`); }
if (STRICT) {
  ok(T['ур.70 / кольцо 60–70'].dead <= .5, 'герою 70-го кольцо 60–70 не по силам: ' + T['ур.70 / кольцо 60–70'].dead);
  ok(T['ур.70 / кольцо 70–80'].dead >= T['ур.70 / кольцо 60–70'].dead || T['ур.70 / кольцо 70–80'].tpk > T['ур.70 / кольцо 60–70'].tpk * 1.2, 'кольцо 70–80 не опаснее 60–70');
  ok(T['ур.60 / кольцо 70–80'].dead >= T['ур.70 / кольцо 70–80'].dead, 'герою 60-го кольцо 70–80 не опаснее, чем герою 70-го');
  ok(T.brandlord.win === 0 && T.abyssking.win === 0, 'мирового босса герой 70-го взял в одиночку');     // мировые боссы — на 10 (подгонка — с рейдом спутников)
  ok(T.abyssking.hp >= T.brandlord.hp, 'Король Бездны не крепче Клеймёного Владыки');
}
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Конец игры 3D: OK');
