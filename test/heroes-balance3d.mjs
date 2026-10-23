// Баланс героев 3D (шаг B4, Ирга — 2026-10-18): бот за Торна, Сойку, Вейла и Иргу — каждый со своим оружием, второй рукой и умениями —
// сражается 90 секунд у костра, в середине и у границы на трёх ступенях снаряжения, бьёт Пожирателя и чистит Склеп Погоста.
// Проверки: у каждого героя своя лестница силы; средняя смертность героя по всем клеткам поля отличается от средней по трём героям
// не больше чем на HB_TOL (15 п. п.) — на одной клетке при 12 прогонах ошибка доли около 14 п. п., поэтому по клеткам — грубая
// страховка HB_CELL (30 п. п.); среднее число убийств — в пределах ±25% от среднего; победы над боссом и смерти в склепе —
// в пределах HB_TOL плюс один прогон. Торн — якорь: его база = прежний герой.
// Полный прогон: npm run balance:heroes (HB_SEEDS=30); в npm test — 12 сидов. HB_NOAB=1 — боты без умений (для сравнения).
import { CORE3 as CFG3 } from '../3d/src/config3d.js';     // ручное ядро: баланс меряется на нём (большой мир — отдельно)
CFG3.terrain.on = false;      // эталон боя — плоское поле без реки (C2): цифры сравнимы с прошлыми версиями
import { createWorld, step, mulberry32, aliveEnemies, travel, refreshGear, spawnFoes } from '../3d/src/sim.js';
import { abyssGo } from '../3d/src/abyss3d.js';
import { pathStep, lineBlocked, resolve, insideOf } from '../3d/src/map.js';
import { abilityPoints, upgradeAbility, useAbility, heroAbilities } from '../3d/src/abilities3d.js';
import { resNow } from '../3d/src/resource3d.js';
import { schoolOfAbility } from '../3d/src/school3d.js';
import { ABILITIES } from '../3d/src/data/abilities3d.js';
import { telegraphDodge } from './botsense.mjs';
import { RANGED, mainSchool, spend, near, ready, abilities, escape, bot } from './herobot.mjs';     // общий бот героя (им же играет outer3d)

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const SEEDS = Number(process.env.HB_SEEDS || 12), SECONDS = 90, TOL = Number(process.env.HB_TOL || .15), CELL = Number(process.env.HB_CELL || .3), QUIET = !!process.env.HB_QUIET;
const HEROES = ['thorn', 'jay', 'vale', 'irga', 'warlock', 'priest', 'brand', 'hunter'], NAME = { thorn: 'Торн', jay: 'Сойка', vale: 'Вейл', irga: 'Ирга', warlock: 'Морок', priest: 'Жрец', brand: 'Клеймёный', hunter: 'Бесогон' };     // 2026-10-23: + Жрец, Клеймёный, Бесогон
const ARMOR = {
  'железо': { body: 'a_body_jerkin_leather', head: 'a_head_cap_leather', boots: 'a_boots_boots_leather' },
  'сталь': { body: 'a_body_mail_mail', head: 'a_head_helm_mail', boots: 'a_boots_greaves_mail', ring: 'r_ring_might', amulet: 'm_amulet_ward' },
  'чёрное': { body: 'a_body_plate_black', head: 'a_head_helm_black', boots: 'a_boots_greaves_black', cloak: 'a_cloak_pelt_black', ring: 'r_ring_blood', amulet: 'm_talisman_blood' }
};
// Ирге — только лёгкая броня (стёганка, капюшон, сапоги): брони меньше, чем у остальных
const LIGHT = {
  'железо': ARMOR['железо'],
  'сталь': { body: 'a_body_gambeson_mail', head: 'a_head_hood_mail', boots: 'a_boots_boots_mail', ring: 'r_ring_might', amulet: 'm_amulet_ward' },
  'чёрное': { body: 'a_body_gambeson_black', head: 'a_head_crown_black', boots: 'a_boots_boots_black', cloak: 'a_cloak_pelt_black', ring: 'r_ring_blood', amulet: 'm_talisman_blood' }
};
const ARMS = {
  thorn: { 'железо': { weapon: 'w_sword_iron', offhand: 's_buckler_iron' }, 'сталь': { weapon: 'w_sword_steel', offhand: 's_buckler_steel' }, 'чёрное': { weapon: 'w_greatsword_black', offhand: 's_tower_black' } },
  jay:   { 'железо': { weapon: 'w_bow_iron' }, 'сталь': { weapon: 'w_longbow_steel' }, 'чёрное': { weapon: 'w_longbow_black' } },
  irga:  { 'железо': { weapon: 'w_staff_iron' }, 'сталь': { weapon: 'w_staff_steel' }, 'чёрное': { weapon: 'w_staff_black' } },
  warlock: { 'железо': { weapon: 'w_scythe_iron' }, 'сталь': { weapon: 'w_scythe_steel' }, 'чёрное': { weapon: 'w_scythe_black' } },
  vale:  { 'железо': { weapon: 'w_rapier_iron', offhand: 'w_dagger_iron' }, 'сталь': { weapon: 'w_sword_steel', offhand: 'w_rapier_steel' }, 'чёрное': { weapon: 'w_rapier_black', offhand: 'w_dagger_black' } },
  priest: { 'железо': { weapon: 'w_mace_iron', offhand: 's_buckler_iron' }, 'сталь': { weapon: 'w_mace_steel', offhand: 's_buckler_steel' }, 'чёрное': { weapon: 'w_mace_black', offhand: 's_tower_black' } },
  brand: { 'железо': { weapon: 'w_greatsword_iron' }, 'сталь': { weapon: 'w_greatsword_steel' }, 'чёрное': { weapon: 'w_greatsword_black' } },
  hunter: { 'железо': { weapon: 'w_sword_iron', offhand: 'w_dagger_iron' }, 'сталь': { weapon: 'w_sword_steel', offhand: 'w_dagger_steel' }, 'чёрное': { weapon: 'w_sword_black', offhand: 'w_dagger_black' } }
};
const LV = { 'железо': 6, 'сталь': 12, 'чёрное': 22 }, TIERS = Object.keys(LV);
const PLACES = { 'у костра': [6, 6], 'середина': [-20, -40], 'у границы': [-62, -5] };

// очки умений: по одному в каждое открытое умение по порядку, остальное — до упора по порядку
function setup(cfg, hero, tier, seed) {
  const W = createWorld(cfg, mulberry32(seed * 7919 + 3)); W.hero = hero; if (process.env.HB_SCHOOL) W.school = mainSchool(hero, cfg); W.lv = LV[tier]; W.ap = abilityPoints(W.lv, cfg);
  Object.assign(W.inv.eq, (hero === 'irga' || hero === 'warlock' || hero === 'priest' ? LIGHT : ARMOR)[tier], ARMS[hero][tier]); spend(W); refreshGear(W); W.player.hp = W.player.maxhp; return W;
}
const baseCfg = () => { const c = JSON.parse(JSON.stringify(CFG3)); c.events.on = false; c.wanderer.on = false; c.ambient.on = false; return c; };

// ---- поле: 90 с в месте с 5 врагами ----
function field(hero, tier, place, seed) {
  const cfg = baseCfg(); cfg.enemies.count = 5; cfg.map.places = []; cfg.bosses.list = [];
  // смешанный состав, как в областях игры (быстрые гончие и лучники не дают стрелку кайтить без риска); без сторожей — все в погоне
  cfg.enemies.regions.mix = [['imp', 4], ['brute', 3], ['hound', 1], ['archer', 1], ['ghoul', 1]]; cfg.map.zones = [{ type: 'mix', x: 0, z: 0, w: 400, d: 400 }]; cfg.enemies.posts.modes = false;
  const W = setup(cfg, hero, tier, seed); W.player.x = PLACES[place][0]; W.player.z = PLACES[place][1];
  let taken = 0; const dodge = mulberry32(seed + 99);
  for (let i = 0; i < 60 * SECONDS; i++) {
    const h = W.player.hp, inp = bot(W, cfg, hero, aliveEnemies(W), dodge); telegraphDodge(W, inp, dodge); step(W, 1 / 60, inp); if (W.player.hp < h) taken += h - W.player.hp;     // подсветка и полоса рывка (этап 2 «круче»)
    if (W.player.dead) return { dead: true, kills: W.kills, taken };
  }
  return { dead: false, kills: W.kills, taken };
}
// ---- босс: Пожиратель Погоста один на один, 150 с ----
function boss(hero, tier, seed) {
  const cfg = baseCfg(); cfg.enemies.count = 0; cfg.map.places = []; cfg.bosses.list = cfg.bosses.list.filter(b => b.type === 'devourer');
  const W = setup(cfg, hero, tier, seed * 131 + 7); W.player.x = -44 + 9; W.player.z = -36; const dodge = mulberry32(seed + 5);
  W._anchor = { x: -44, z: -36, r: 20 };        // стрелок кружит у логова, а не уводит босса (тот вернётся домой и вылечится)
  for (let i = 0; i < 60 * 150; i++) {
    const p = W.player, e = W.enemies.find(x => x.boss && !x.dead); if (!e) return { win: true, t: i / 60 };
    let inp; const d = Math.hypot(e.x - p.x, e.z - p.z) || 1, C = cfg.enemies[e.type];
    if (RANGED(hero)) {                                         // стрелок: кружит у логова, сначала снимает прислужников (они ловят стрелы)
      const adds = W.enemies.filter(m => !m.boss && !m.dead && Math.hypot(m.x - p.x, m.z - p.z) < 12);
      inp = bot(W, cfg, hero, adds.length ? adds : [e], dodge);
      if (!adds.length && e.b.state === 'wind' && e.b.atk.t > e.b.atk.wind - .22 && p.rollCd <= 0 && dodge() < .5) { inp.roll = true; inp.mx = -(e.x - p.x) / d; inp.mz = -(e.z - p.z) / d; inp.attackPress = false; }
    } else {                                                    // ближний бой — как бот balance3d (якорь), плюс умения
      inp = { mx: 0, mz: 0, attack: false, roll: false };
      abilities(W, hero, e, d);
      if (d > 3.2) { inp.mx = (e.x - p.x) / d; inp.mz = (e.z - p.z) / d; } inp.attackPress = d < cfg.player.attackRange + W.gear.reach + C.radius * .5 + .3;
      if (e.b.state === 'wind' && e.b.atk.t > e.b.atk.wind - .22 && dodge() < .5) {
        if (hero === 'vale' && ready(W, 1)) useAbility(W, 1);
        else if (p.rollCd <= 0) { inp.roll = true; inp.mx = -(e.x - p.x) / d; inp.mz = -(e.z - p.z) / d; inp.attackPress = false; }
      }
      for (const m of W.enemies) if (!m.boss && !m.dead && Math.hypot(m.x - p.x, m.z - p.z) < 4 && d > 6) { inp.mx = (m.x - p.x); inp.mz = (m.z - p.z); inp.attackPress = true; }
    }
    step(W, 1 / 60, inp);
    if (p.dead) return { win: false, t: i / 60 };
  }
  return { win: false, t: 150 };
}
// ---- склеп: зачистка за 240 с ----
function crypt(hero, tier, seed) {
  const cfg = baseCfg(); cfg.enemies.count = 0; cfg.bosses.list = [];
  const W = setup(cfg, hero, tier, seed), def = cfg.dungeons.list.find(d => d.id === 'crypt_pogost');
  for (const k of Object.keys(cfg.dungeons.keys)) W.keys[k] = true; travel(W, def.id, def.entry.x, def.entry.z);
  const total = aliveEnemies(W).length, dodge = mulberry32(seed + 99);
  for (let i = 0; i < 60 * 240; i++) {
    const p = W.player, en = aliveEnemies(W); if (!en.length) return { dead: false, frac: 1 };
    let tgt = null, bd = 1e9; for (const e of en) { const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < bd) { bd = d; tgt = e; } }
    const wp = pathStep(W.map, p.x, p.z, tgt.x, tgt.z, W.keys); let inp;
    if (wp) { const dx = wp.x - p.x, dz = wp.z - p.z, d = Math.hypot(dx, dz) || 1; inp = { mx: dx / d, mz: dz / d, attackPress: bd < 2 || (RANGED(hero) && bd < W.wp.trait.range && !lineBlocked(W.map, p.x, p.z, tgt.x, tgt.z)) }; }     // стрелок бьёт и на ходу, если цель видна
    else inp = bot(W, cfg, hero, en, dodge);
    telegraphDodge(W, inp, dodge);
    step(W, 1 / 60, inp); if (p.dead) return { dead: true, frac: 1 - aliveEnemies(W).length / total };
  }
  return { dead: false, frac: 1 - aliveEnemies(W).length / total };
}

// ---- Бездна (этап 6 «круче»): ярус t, герой уровня яруса (до 60) в чёрном; зачистка с путём по комнатам, как в склепе ----
function abyssRun(hero, t, seed) {
  const cfg = baseCfg(); cfg.enemies.count = 0; cfg.bosses.list = [];
  const W = setup(cfg, hero, 'чёрное', seed); W.lv = Math.min(60, cfg.abyss.level[0] + t * cfg.abyss.level[1]); W.ap = abilityPoints(W.lv, cfg); spend(W); for (const k of Object.keys(W.inv.eq)) if (W.inv.eq[k]) W.inv.il[k] = W.lv; refreshGear(W); W.player.hp = W.player.maxhp;     // вещи — уровня героя
  abyssGo(W, { abyssEnter: true }, travel, spawnFoes, null, t); const total = aliveEnemies(W).length, lim = W.abyss.t, dodge = mulberry32(seed + 77);
  for (let i = 0; i < 60 * (lim + 2); i++) {
    const p = W.player, en = aliveEnemies(W); if (!en.length) return { dead: false, frac: 1, t: i / 60, lim };
    if (!W.abyss) return { dead: false, frac: 1 - en.length / total, t: lim, lim, out: true };
    let tgt = null, bd = 1e9; for (const e of en) { const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < bd) { bd = d; tgt = e; } }
    const wp = bd > 6 && pathStep(W.map, p.x, p.z, tgt.x, tgt.z, W.keys); let inp;
    if (wp) { const dx = wp.x - p.x, dz = wp.z - p.z, d = Math.hypot(dx, dz) || 1; inp = { mx: dx / d, mz: dz / d, attackPress: RANGED(hero) && bd < W.wp.trait.range && !lineBlocked(W.map, p.x, p.z, tgt.x, tgt.z) }; }
    else inp = bot(W, cfg, hero, en, dodge);
    telegraphDodge(W, inp, dodge);
    step(W, 1 / 60, inp); if (p.dead) return { dead: true, frac: 1 - aliveEnemies(W).length / total, t: i / 60, lim };
  }
  return { dead: false, frac: 1 - aliveEnemies(W).length / total, t: lim, lim, out: true };
}
if (process.env.HB_ABYSS) {
  const TT = process.env.HB_ABYSS.split(',').map(Number);
  for (const t of TT) console.log(`Бездна, ярус ${String(t).padStart(2)}  ` + HEROES.map(h => { let d = 0, f = 0, tm = 0, out = 0; for (let s = 0; s < SEEDS; s++) { const r = abyssRun(h, t, s); d += r.dead; f += r.frac; tm += r.t / r.lim; out += !!r.out; } return `${NAME[h]}: ${(d / SEEDS * 100).toFixed(0).padStart(3)}% † зачищено ${(f / SEEDS * 100).toFixed(0).padStart(3)}% время ${(tm / SEEDS * 100).toFixed(0).padStart(3)}% вышло ${out}`; }).join(' | '));
  process.exit(0);
}
// ---- прогоны ----
const T = {}, out = s => { if (!QUIET) console.log(s); };
const ONLY = process.env.HB_TIER || '';     // замер одной ступени (поле), без босса, склепа и проверок
for (const tier of TIERS.filter(t => !ONLY || t === ONLY)) for (const place of Object.keys(PLACES)) {
  const row = {};
  for (const h of HEROES) { let dead = 0, kills = 0, taken = 0; for (let s = 0; s < SEEDS; s++) { const r = field(h, tier, place, s); dead += r.dead; kills += r.kills; taken += r.taken; } row[h] = { smert: dead / SEEDS, kills: kills / SEEDS, tpk: kills ? taken / kills : taken }; }
  T[`${tier} / ${place}`] = row;
  out(`${(tier + ' / ' + place).padEnd(22)} ` + HEROES.map(h => `${NAME[h]}: ${(row[h].smert * 100).toFixed(0).padStart(3)}% † ${row[h].kills.toFixed(1).padStart(4)} уб. ${row[h].tpk.toFixed(1).padStart(5)} ур/уб`).join(' | '));
}
if (ONLY) process.exit(0);
const B = {}, BN = SEEDS;
for (const tier of ['сталь', 'чёрное']) { B[tier] = {}; for (const h of HEROES) { let w = 0, t = 0; for (let s = 0; s < BN; s++) { const r = boss(h, tier, s); w += r.win; t += r.t; } B[tier][h] = { win: w / BN, t: t / BN }; }
  out(`босс / ${tier}`.padEnd(22) + ' ' + HEROES.map(h => `${NAME[h]}: побед ${(B[tier][h].win * 100).toFixed(0).padStart(3)}%, ${B[tier][h].t.toFixed(0)} с`).join(' | ')); }
const D = {};
for (const tier of ['сталь', 'чёрное']) { D[tier] = {}; for (const h of HEROES) { let dead = 0, f = 0; for (let s = 0; s < BN; s++) { const r = crypt(h, tier, s); dead += r.dead; f += r.frac; } D[tier][h] = { smert: dead / BN, frac: f / BN }; }
  out(`склеп / ${tier}`.padEnd(22) + ' ' + HEROES.map(h => `${NAME[h]}: ${(D[tier][h].smert * 100).toFixed(0).padStart(3)}% †, зачищено ${(D[tier][h].frac * 100).toFixed(0)}%`).join(' | ')); }

// ---- проверки ----
const mean = (o, k) => HEROES.reduce((a, h) => a + o[h][k], 0) / HEROES.length;
const all = Object.fromEntries(HEROES.map(h => [h, { smert: Object.values(T).reduce((a, r) => a + r[h].smert, 0) / Object.keys(T).length }])), am = mean(all, 'smert');
out('смертность в поле, средняя по клеткам: ' + HEROES.map(h => `${NAME[h]} ${(all[h].smert * 100).toFixed(0)}%`).join(', ') + ` (среднее ${(am * 100).toFixed(0)}%)`);
for (const h of HEROES) ok(Math.abs(all[h].smert - am) <= TOL + 1e-9, `поле: ${NAME[h]} умирает в среднем ${(all[h].smert * 100).toFixed(0)}% при средней по героям ${(am * 100).toFixed(0)}%`);
// сила: среднее число убийств героя в пределах ±KILLS от среднего по героям (смертность слабо чувствует запас здоровья — нужна вторая мера)
const KILLS = Number(process.env.HB_KILLS || .25), kl = Object.fromEntries(HEROES.map(h => [h, { k: Object.values(T).reduce((a, r) => a + r[h].kills, 0) / Object.keys(T).length }])), km = mean(kl, 'k');
out('убийств в поле, среднее по клеткам: ' + HEROES.map(h => `${NAME[h]} ${kl[h].k.toFixed(1)}`).join(', ') + ` (среднее ${km.toFixed(1)})`);
for (const h of HEROES) ok(Math.abs(kl[h].k / km - 1) <= KILLS, `поле: ${NAME[h]} убивает в среднем ${kl[h].k.toFixed(1)} при средней по героям ${km.toFixed(1)}`);
for (const [cell, row] of Object.entries(T)) { const m = mean(row, 'smert'); for (const h of HEROES) ok(Math.abs(row[h].smert - m) <= CELL + 1e-9, `${cell}: ${NAME[h]} умирает ${(row[h].smert * 100).toFixed(0)}% при средней ${(m * 100).toFixed(0)}%`); }
for (const tier of Object.keys(B)) { const m = mean(B[tier], 'win'); for (const h of HEROES) ok(Math.abs(B[tier][h].win - m) <= TOL + 1e-9 + 1 / BN, `босс / ${tier}: ${NAME[h]} побеждает ${(B[tier][h].win * 100).toFixed(0)}% при средней ${(m * 100).toFixed(0)}%`); }
for (const tier of Object.keys(D)) { const m = mean(D[tier], 'smert'); for (const h of HEROES) ok(Math.abs(D[tier][h].smert - m) <= TOL + 1e-9 + 1 / BN, `склеп / ${tier}: ${NAME[h]} умирает ${(D[tier][h].smert * 100).toFixed(0)}% при средней ${(m * 100).toFixed(0)}%`); }
for (const h of HEROES) {
  for (const p of Object.keys(PLACES)) for (let i = 1; i < TIERS.length; i++) { const a = T[`${TIERS[i - 1]} / ${p}`][h], b = T[`${TIERS[i]} / ${p}`][h]; ok(b.tpk <= a.tpk * 1.1 + .5, `${NAME[h]}, ${p}: «${TIERS[i]}» не безопаснее «${TIERS[i - 1]}» (${a.tpk.toFixed(1)} → ${b.tpk.toFixed(1)})`); }
  for (const t of TIERS) ok(T[`${t} / у границы`][h].tpk > T[`${t} / у костра`][h].tpk, `${NAME[h]}, ${t}: у границы не опаснее, чем у костра`);
  ok(B['чёрное'][h].win >= B['сталь'][h].win, `${NAME[h]}: на чёрном босс не проще, чем на стали`);
}

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Баланс героев 3D: OK');
