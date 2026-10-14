// Баланс 3D: простой бот сражается 90 секунд в разных местах мира с разной экипировкой.
// Печатает таблицу (убито, урон за убийство, доля смертей) и проверяет «лестницу силы»:
// голые руки далеко от костра умирают, экипировка по месту выживает, перебор экипировки у костра скучен, но безопасен.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, aliveEnemies } from '../3d/src/sim.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const TIERS = {
  'без вещей': {},
  'железо': { weapon: 'w_sword_iron', body: 'a_body_jerkin_leather', head: 'a_head_cap_leather', boots: 'a_boots_boots_leather' },
  'сталь': { weapon: 'w_sword_steel', body: 'a_body_mail_mail', head: 'a_head_helm_mail', boots: 'a_boots_greaves_mail', ring: 'r_ring_might', amulet: 'm_amulet_ward' },
  'чёрное': { weapon: 'w_greatsword_black', body: 'a_body_plate_black', head: 'a_head_helm_black', boots: 'a_boots_greaves_black', cloak: 'a_cloak_pelt_black', ring: 'r_ring_blood', amulet: 'm_talisman_blood' }
};
const PLACES = { 'у костра': [6, 6], 'середина': [-20, -40], 'у границы': [-62, -5] };
const SEEDS = Number(process.env.BAL_SEEDS || 10), SECONDS = 90;
const HPM = Number(process.env.BAL_HP || 1), DMM = Number(process.env.BAL_DMG || 1);       // ручки для подбора чисел

function run(tier, place, seed) {
  const cfg = JSON.parse(JSON.stringify(CFG3)); cfg.enemies.count = 5; cfg.map.places = [];   // меряем чистую глубину, без зон
  for (const t of ['imp', 'brute', 'hound', 'ghoul']) { cfg.enemies[t].hp = Math.round(cfg.enemies[t].hp * HPM); cfg.enemies[t].damage = Math.round(cfg.enemies[t].damage * DMM); }
  const W = createWorld(cfg, mulberry32(seed * 7919 + 3));
  Object.assign(W.inv.eq, TIERS[tier]); W.player.x = PLACES[place][0]; W.player.z = PLACES[place][1];
  let taken = 0; const dodge = mulberry32(seed + 99);
  for (let i = 0; i < 60 * SECONDS; i += 1) {
    const p = W.player, en = aliveEnemies(W); let tgt = null, bd = 1e9;
    for (const e of en) { const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < bd) { bd = d; tgt = e; } }
    const inp = { mx: 0, mz: 0, attack: false, roll: false };
    if (tgt && bd < 30) {
      const C = cfg.enemies[tgt.type], reach = cfg.player.attackRange + W.gear.reach + C.radius * .5;
      if (bd > reach * .8) { inp.mx = (tgt.x - p.x) / bd; inp.mz = (tgt.z - p.z) / bd; }
      inp.attack = bd < reach + .4;
      if (tgt.state === 'wind' && bd < C.range + 1.2 && tgt.t > C.wind * .6 && p.rollCd <= 0 && dodge() < .5) inp.roll = true;       // бот умеет кататься от замаха
    }
    const h = p.hp; step(W, 1 / 60, inp); if (p.hp < h) taken += h - p.hp;
    if (p.dead) return { dead: true, t: i / 60, kills: W.kills, taken };
  }
  return { dead: false, t: SECONDS, kills: W.kills, taken };
}
const table = {};
for (const tier of Object.keys(TIERS)) for (const place of Object.keys(PLACES)) {
  let dead = 0, kills = 0, taken = 0;
  for (let s = 0; s < SEEDS; s++) { const r = run(tier, place, s); dead += r.dead ? 1 : 0; kills += r.kills; taken += r.taken; }
  table[`${tier} / ${place}`] = { smert: dead / SEEDS, kills: kills / SEEDS, tpk: kills ? taken / kills : taken };
}
for (const [k, v] of Object.entries(table)) console.log(k.padEnd(26), `смертей ${(v.smert * 100).toFixed(0).padStart(3)}%  убито ${v.kills.toFixed(1).padStart(5)}  урона на убийство ${v.tpk.toFixed(1)}`);
const g = (t, p) => table[`${t} / ${p}`];
// лестница: чем лучше экипировка, тем меньше урона на убийство (в каждом месте)
for (const p of Object.keys(PLACES)) { const order = Object.keys(TIERS); for (let i = 1; i < order.length; i++) ok(g(order[i], p).tpk <= g(order[i - 1], p).tpk * 1.05 + .5, `${p}: «${order[i]}» не безопаснее «${order[i - 1]}»`); }
// чем дальше от костра, тем опаснее для любой экипировки
for (const t of Object.keys(TIERS)) ok(g(t, 'у границы').tpk > g(t, 'у костра').tpk * 1.3 + .3, `${t}: вдали от костра не опаснее`);
ok(g('без вещей', 'у границы').smert >= .9, 'голый герой у границы должен погибать: ' + g('без вещей', 'у границы').smert);
ok(g('чёрное', 'у границы').smert <= .6, 'в лучшей экипировке у границы слишком смертельно: ' + g('чёрное', 'у границы').smert);
ok(g('сталь', 'у костра').smert <= .1 && g('чёрное', 'у костра').smert <= .05, 'у костра в хорошей экипировке должно быть безопасно');
ok(g('железо', 'у костра').smert <= .5, 'у костра в железе слишком опасно: ' + g('железо', 'у костра').smert);
ok(g('железо', 'у костра').kills >= 15, 'у костра в железе мало убийств: ' + g('железо', 'у костра').kills);
// костёр лечит, когда спокойно, и не лечит в бою
{ const cfg = JSON.parse(JSON.stringify(CFG3)); cfg.enemies.count = 0; const W = createWorld(cfg, mulberry32(1)); W.player.x = 1; W.player.z = 1; W.player.hp = 30;
  for (let i = 0; i < 60; i++) step(W, 1 / 60, {}); ok(W.player.hp > 36, 'костёр не лечит'); W.player.hp = 30; W.player.calm = 3; for (let i = 0; i < 120; i++) step(W, 1 / 60, {}); ok(W.player.hp < 31, 'костёр лечит в бою (calm)'); W.player.x = 30; W.player.hp = 30; for (let i = 0; i < 300; i++) step(W, 1 / 60, {}); ok(W.player.hp === 30, 'лечит вдали от костра'); }
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Баланс 3D: OK');
