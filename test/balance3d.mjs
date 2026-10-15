// Баланс 3D: простой бот сражается 90 секунд в разных местах мира с разной экипировкой.
// Печатает таблицу (убито, урон за убийство, доля смертей) и проверяет «лестницу силы»:
// голые руки далеко от костра умирают, экипировка по месту выживает, перебор экипировки у костра скучен, но безопасен.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, aliveEnemies, setDifficulty, travel } from '../3d/src/sim.js';
import { pathStep } from '../3d/src/map.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const TIERS = {
  'без вещей': {},
  'железо': { weapon: 'w_sword_iron', body: 'a_body_jerkin_leather', head: 'a_head_cap_leather', boots: 'a_boots_boots_leather' },
  'сталь': { weapon: 'w_sword_steel', body: 'a_body_mail_mail', head: 'a_head_helm_mail', boots: 'a_boots_greaves_mail', ring: 'r_ring_might', amulet: 'm_amulet_ward' },
  'чёрное': { weapon: 'w_greatsword_black', body: 'a_body_plate_black', head: 'a_head_helm_black', boots: 'a_boots_greaves_black', cloak: 'a_cloak_pelt_black', ring: 'r_ring_blood', amulet: 'm_talisman_blood' }
};
const PLACES = { 'у костра': [6, 6], 'середина': [-20, -40], 'у границы': [-62, -5] };
const SEEDS = Number(process.env.BAL_SEEDS || 10), SECONDS = 90;
const HPM = Number(process.env.BAL_HP || 1), DMM = Number(process.env.BAL_DMG || 1), BUF = process.env.BAL_BUF;   // BAL_BUF — память нажатия, с (1e-6 — без неё, как до тяжёлого удара)       // ручки для подбора чисел

function run(tier, place, seed) {
  const cfg = JSON.parse(JSON.stringify(CFG3)); if (BUF) cfg.player.heavy.buffer = Number(BUF); cfg.enemies.count = 5; cfg.map.places = []; cfg.bosses.list = [];   // меряем чистую глубину, без зон и боссов
  for (const t of ['imp', 'brute', 'hound', 'ghoul']) { cfg.enemies[t].hp = Math.round(cfg.enemies[t].hp * HPM); cfg.enemies[t].damage = Math.round(cfg.enemies[t].damage * DMM); }
  const W = createWorld(cfg, mulberry32(seed * 7919 + 3));
  if (process.env.BAL_DIF) setDifficulty(W, process.env.BAL_DIF); if (process.env.BAL_NIGHT) W.t = 195;
  Object.assign(W.inv.eq, TIERS[tier]); W.player.x = PLACES[place][0]; W.player.z = PLACES[place][1];
  let taken = 0; const dodge = mulberry32(seed + 99);
  for (let i = 0; i < 60 * SECONDS; i += 1) {
    const p = W.player, en = aliveEnemies(W); let tgt = null, bd = 1e9;
    for (const e of en) { const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < bd) { bd = d; tgt = e; } }
    const inp = { mx: 0, mz: 0, attack: false, roll: false };
    if (tgt && bd < 30) {
      const C = cfg.enemies[tgt.type], reach = cfg.player.attackRange + W.gear.reach + C.radius * .5;
      if (bd > reach * .8) { inp.mx = (tgt.x - p.x) / bd; inp.mz = (tgt.z - p.z) / bd; }
      inp.attackPress = bd < reach + .4;                    // бот жмёт, а не держит: удержание — это заряд тяжёлого удара
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
{ const cfg = JSON.parse(JSON.stringify(CFG3)); if (BUF) cfg.player.heavy.buffer = Number(BUF); cfg.enemies.count = 0; const W = createWorld(cfg, mulberry32(1)); W.player.x = 1; W.player.z = 1; W.player.hp = 30;
  for (let i = 0; i < 60; i++) step(W, 1 / 60, {}); ok(W.player.hp > 36, 'костёр не лечит'); W.player.hp = 30; W.player.calm = 3; for (let i = 0; i < 120; i++) step(W, 1 / 60, {}); ok(W.player.hp < 31, 'костёр лечит в бою (calm)'); W.player.x = 30; W.player.hp = 30; for (let i = 0; i < 300; i++) step(W, 1 / 60, {}); ok(W.player.hp === 30, 'лечит вдали от костра'); }
// бой с боссом: бот в экипировке «сталь» и «чёрное» против Пожирателя Погоста один на один, 150 секунд
function bossFight(tier, seed) {
  const cfg = JSON.parse(JSON.stringify(CFG3)); if (BUF) cfg.player.heavy.buffer = Number(BUF); cfg.enemies.count = 0; cfg.map.places = []; cfg.bosses.list = cfg.bosses.list.filter(b => b.type === 'devourer');
  const W = createWorld(cfg, mulberry32(seed * 131 + 7)); Object.assign(W.inv.eq, TIERS[tier]); W.lv = BOSS_LV[tier]; W.player.x = -44 + 9; W.player.z = -36; const dodge = mulberry32(seed + 5);
  for (let i = 0; i < 60 * 150; i++) {
    const p = W.player, e = W.enemies.find(x => x.boss && !x.dead); if (!e) return { win: true, t: i / 60 }; const d = Math.hypot(e.x - p.x, e.z - p.z), C = cfg.enemies[e.type];
    const inp = { mx: 0, mz: 0, attack: false, roll: false };
    if (d > 3.2) { inp.mx = (e.x - p.x) / d; inp.mz = (e.z - p.z) / d; } inp.attackPress = d < cfg.player.attackRange + W.gear.reach + C.radius * .5 + .3;
    if (e.b.state === 'wind' && e.b.atk.t > e.b.atk.wind - .22 && p.rollCd <= 0 && dodge() < .5) { inp.roll = true; inp.mx = -(e.x - p.x) / d; inp.mz = -(e.z - p.z) / d; inp.attackPress = false; }
    for (const m of W.enemies) if (!m.boss && !m.dead && Math.hypot(m.x - p.x, m.z - p.z) < 4 && d > 6) { inp.mx = (m.x - p.x); inp.mz = (m.z - p.z); inp.attackPress = true; }
    step(W, 1 / 60, inp); if (p.dead) return { win: false, t: i / 60 };
  }
  return { win: false, t: 150 };
}
const BOSS_LV = { 'сталь': 12, 'чёрное': 22 };
const bossRes = {}; for (const tier of ['сталь', 'чёрное']) { let w = 0, t = 0; const N = 6; for (let sd = 0; sd < N; sd++) { const r = bossFight(tier, sd); w += r.win ? 1 : 0; t += r.t; } bossRes[tier] = { win: w / N, t: t / N }; console.log(`босс / ${tier}`.padEnd(26), `побед ${(w / N * 100).toFixed(0)}%  среднее время ${(t / N).toFixed(0)} с`); }
ok(bossRes['чёрное'].win >= bossRes['сталь'].win, 'в лучшей экипировке босса бить не проще'); ok(bossRes['сталь'].win <= .7, 'босс слишком лёгок для «стали»: ' + bossRes['сталь'].win); ok(bossRes['чёрное'].win >= .3, 'босс непроходим даже в лучшей экипировке: ' + bossRes['чёрное'].win);
// подземелья: бот зачищает уровень (к ближайшему врагу через проходы), 240 с; печатает смерти, долю убитых и время
function delve(tier, id, seed) {
  const cfg = JSON.parse(JSON.stringify(CFG3)); if (BUF) cfg.player.heavy.buffer = Number(BUF); cfg.enemies.count = 0; cfg.bosses.list = [];
  const W = createWorld(cfg, mulberry32(seed * 7919 + 3)), def = cfg.dungeons.list.find(d => d.id === id);
  if (process.env.BAL_DIF) setDifficulty(W, process.env.BAL_DIF);
  Object.assign(W.inv.eq, TIERS[tier]); travel(W, id, def.entry.x, def.entry.z);
  const total = aliveEnemies(W).length, dodge = mulberry32(seed + 99);
  for (let i = 0; i < 60 * 240; i++) {
    const p = W.player, en = aliveEnemies(W); if (!en.length) return { dead: false, t: i / 60, frac: 1 };
    let tgt = null, bd = 1e9; for (const e of en) { const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < bd) { bd = d; tgt = e; } }
    const inp = { mx: 0, mz: 0, attack: false, roll: false }, wp = pathStep(W.map, p.x, p.z, tgt.x, tgt.z);
    if (wp) { const dx = wp.x - p.x, dz = wp.z - p.z, d = Math.hypot(dx, dz) || 1; inp.mx = dx / d; inp.mz = dz / d; inp.attackPress = bd < 2; }
    else {
      const C = cfg.enemies[tgt.type], reach = cfg.player.attackRange + W.gear.reach + C.radius * .5;
      if (bd > reach * .8) { inp.mx = (tgt.x - p.x) / bd; inp.mz = (tgt.z - p.z) / bd; }
      inp.attackPress = bd < reach + .4;                    // бот жмёт, а не держит: удержание — это заряд тяжёлого удара
      if (tgt.state === 'wind' && bd < C.range + 1.2 && tgt.t > C.wind * .6 && p.rollCd <= 0 && dodge() < .5) inp.roll = true;
    }
    step(W, 1 / 60, inp);
    if (p.dead) return { dead: true, t: i / 60, frac: 1 - aliveEnemies(W).length / total };
  }
  return { dead: false, t: 240, frac: 1 - aliveEnemies(W).length / total };
}
const dg = {}, DN = 6;
for (const def of CFG3.dungeons.list) for (const tier of Object.keys(TIERS)) {
  let dead = 0, frac = 0, t = 0; for (let s = 0; s < DN; s++) { const r = delve(tier, def.id, s); dead += r.dead ? 1 : 0; frac += r.frac; t += r.t; }
  dg[`${def.id} / ${tier}`] = { smert: dead / DN, frac: frac / DN };
  console.log(`${def.name} / ${tier}`.padEnd(26), `смертей ${(dead / DN * 100).toFixed(0).padStart(3)}%  зачищено ${(frac / DN * 100).toFixed(0).padStart(3)}%  время ${(t / DN).toFixed(0)} с`);
}
ok(dg['cellar_cooper / железо'].smert <= .2 && dg['cellar_cooper / железо'].frac >= .9, 'погреб у деревни в железе слишком опасен');
ok(dg['crypt_pogost / без вещей'].smert >= .8, 'склеп без вещей не должен проходиться');
ok(dg['crypt_pogost / сталь'].smert <= .4 && dg['crypt_pogost / сталь'].frac >= .8, 'склеп в стали слишком опасен');
ok(dg['crypt_pogost / чёрное'].smert <= .15 && dg['crypt_pogost / чёрное'].frac >= .95, 'склеп в чёрном слишком опасен');

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Баланс 3D: OK');
