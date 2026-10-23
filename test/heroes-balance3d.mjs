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

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const SEEDS = Number(process.env.HB_SEEDS || 12), SECONDS = 90, TOL = Number(process.env.HB_TOL || .15), CELL = Number(process.env.HB_CELL || .3), QUIET = !!process.env.HB_QUIET;
const HEROES = ['thorn', 'jay', 'vale', 'irga', 'warlock', 'priest', 'brand', 'hunter'], NAME = { thorn: 'Торн', jay: 'Сойка', vale: 'Вейл', irga: 'Ирга', warlock: 'Морок', priest: 'Жрец', brand: 'Клеймёный', hunter: 'Бесогон' };     // 2026-10-23: + Жрец, Клеймёный, Бесогон
const RANGED = h => h === 'jay' || h === 'irga';     // стрелки: держат дистанцию
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
// школа бота (школы героев, 2026-10-22): боты написаны под все 8 базовых умений, поэтому по умолчанию школа не ограничивает; HB_SCHOOL=main — основная школа героя (больше базовых умений), HB_SCHOOL=n — школа n
const mainSchool = (hero, cfg) => { const n = [0, 0, 0]; for (const a of ABILITIES[hero].slice(0, 8)) n[schoolOfAbility(hero, a.id, cfg) || 0]++; return process.env.HB_SCHOOL === 'main' ? n.indexOf(Math.max(...n)) : Number(process.env.HB_SCHOOL); };
function spend(W) { const L = heroAbilities(W).slice(0, 8).filter(a => !process.env.HB_SCHOOL || (schoolOfAbility(W.hero, a.id, W.cfg) || 0) === (W.school || 0)); for (let pass = 0; pass < 6; pass++) for (const a of L) upgradeAbility(W, a.id); }     // бот — на прежних 8 умениях (новые умения древа — test/actives3d.mjs)
function setup(cfg, hero, tier, seed) {
  const W = createWorld(cfg, mulberry32(seed * 7919 + 3)); W.hero = hero; if (process.env.HB_SCHOOL) W.school = mainSchool(hero, cfg); W.lv = LV[tier]; W.ap = abilityPoints(W.lv, cfg);
  Object.assign(W.inv.eq, (hero === 'irga' || hero === 'warlock' || hero === 'priest' ? LIGHT : ARMOR)[tier], ARMS[hero][tier]); spend(W); refreshGear(W); W.player.hp = W.player.maxhp; return W;
}
const baseCfg = () => { const c = JSON.parse(JSON.stringify(CFG3)); c.events.on = false; c.wanderer.on = false; c.ambient.on = false; return c; };

// ---- боты: один уровень ума, разный стиль ----
const SKIP = (process.env.HB_SKIP || '').split(',').filter(Boolean).map(Number);     // умения, которые бот не жмёт (поиск сильного)
const near = (W, r) => aliveEnemies(W).filter(e => Math.hypot(e.x - W.player.x, e.z - W.player.z) < r).length;
const ready = (W, i) => { const a = heroAbilities(W)[i]; return a && (W.ab[a.id] || 0) > 0 && !(W.acd[a.id] > 0) && resNow(W) >= (W.cfg.abilities[W.hero][a.id].cost || 0); };     // и ресурса хватает
function abilities(W, hero, tgt, bd) {
  if (process.env.HB_NOAB) return;
  const p = W.player, low = p.hp < p.maxhp * .5, use = i => !SKIP.includes(i) && ready(W, i) && useAbility(W, i) === 'ok';
  if (hero === 'thorn') {
    if (low && use(3)) return; if ((low || near(W, 6) >= 3) && use(1)) return; if (near(W, 3.4) >= 2 && use(2)) return;
    if (bd < 2.5 && p.hp > p.maxhp * .6 && use(4)) return;
    if (bd > 3 && bd < 6 && aliveEnemies(W).filter(o => Math.hypot(o.x - tgt.x, o.z - tgt.z) < 4).length <= 2 && use(0)) return;     // рывок — к одиночке, не в гущу
  } else if (hero === 'jay') {
    if (bd < 3 && use(0)) return; if (near(W, 14) >= 2 && use(4)) return; if (bd < 7 && tgt.alert && use(2)) return;
    if (near(W, 12) >= 2 && use(1)) return; if (bd < 14 && use(3)) return;
  } else if (hero === 'irga') {                                // Ирга: щит при беде, кольцо вплотную, по толпе — метеор, вьюга, облако; копьё — по сильным
    if ((low || near(W, 6) >= 2) && use(5)) return; if (near(W, 3.2) >= 1 && use(1)) return;     // кольцо льда — оторваться
    if (near(W, 14) >= 3 && (use(4) || use(6))) return; if (near(W, 14) >= 2 && use(3)) return;
    if ((tgt.boss || tgt.elite || tgt.maxhp > 150) && bd < 16 && use(7)) return;
    if (bd < 14 && use(2)) return; if (bd < 14 && use(0)) return;
  } else if (hero === 'warlock') {                             // Морок: бес у ног, ужас при беде, порча и рок по сильным, похищение — когда ранен
    if (!W.allies.some(a => a.imp && !a.dead) && near(W, 10) >= 1 && use(2)) return; if ((low || near(W, 4) >= 3) && use(3)) return;
    if (p.hp < p.maxhp * .75 && bd < 9 && use(1)) return; if (near(W, 12) >= 2 && use(4)) return;
    if (bd < 11 && !(tgt.st && tgt.st.crack) && use(0)) return; if ((tgt.elite || tgt.boss || tgt.maxhp > 150) && bd < 13 && use(7)) return;
    if (bd < 12 && use(6)) return; if (resNow(W) < 30 && p.hp > p.maxhp * .7 && use(5)) return;
  } else if (hero === 'priest' || hero === 'brand' || hero === 'hunter') {     // новые герои: общий бот по виду умения (лечение, оберег, по площади, выстрел, рывок)
    const L = heroAbilities(W), kind = i => (L[i] && ((W.cfg.abilities[hero][L[i].id] || {}).kind || L[i].kind)) || '';
    for (let i = 0; i < Math.min(8, L.length); i++) { const k = kind(i);
      if ((k === 'heal' || k === 'gheal') && p.hp < p.maxhp * .6 && use(i)) return;
      if ((k === 'ward' || k === 'buff') && (low || near(W, 8) >= 2) && use(i)) return;
      if (['nova', 'cone', 'field', 'cloud', 'zone', 'pull'].includes(k) && near(W, 6) >= 2 && use(i)) return;
      if (['bolt', 'mark'].includes(k) && bd < 12 && use(i)) return;
      if (k === 'strike' && bd < 3 && use(i)) return;
      if (k === 'dash' && bd > 4 && bd < 8 && use(i)) return; }
  } else {
    if (tgt.hp < tgt.maxhp * .35 && bd < 2.6 && use(4)) return; if ((low || near(W, 6) >= 3) && use(3)) return;
    if (near(W, 3) >= 2 && use(2)) return; if (bd > 4 && bd < 8 && use(0)) return;
  }
}
// отход стрелка: из 8 направлений — свободное (без стен, домов и деревьев на 2 м) и самое далёкое от врагов
function escape(W, en) {
  const p = W.player; let best = null, bs = -1e9;
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, x = p.x + Math.sin(a) * 2, z = p.z + Math.cos(a) * 2;
    if (lineBlocked(W.map, p.x, p.z, x, z) || insideOf(W.map, x, z) >= 0 || resolve(W.map, { x, z }, .6) || Math.hypot(x, z) > W.cfg.world.radius - 3) continue;
    if (W._anchor && Math.hypot(x - W._anchor.x, z - W._anchor.z) > W._anchor.r && Math.hypot(x - W._anchor.x, z - W._anchor.z) > Math.hypot(p.x - W._anchor.x, p.z - W._anchor.z)) continue;     // у логова босса: не уводить его за поводок
    const s = Math.min(...en.map(e => Math.hypot(e.x - x, e.z - z))); if (s > bs) { bs = s; best = a; } }
  return best === null ? null : { mx: Math.sin(best), mz: Math.cos(best) };
}
function bot(W, cfg, hero, en, dodge) {
  const p = W.player, inp = { mx: 0, mz: 0, attack: false, roll: false };
  let tgt = null, bd = 1e9; for (const e of en) { const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < bd) { bd = d; tgt = e; } }
  if (!tgt || bd > 30) return inp;
  const C = cfg.enemies[tgt.type], ux = (tgt.x - p.x) / bd, uz = (tgt.z - p.z) / bd, winding = tgt.state === 'wind' && bd < C.range + 1.2 && tgt.t > C.wind * .6;
  abilities(W, hero, tgt, bd);
  if (RANGED(hero)) {                                         // держит дистанцию 5–(дальность) и стреляет; вплотную — отходит
    const range = W.wp.trait.range * .85;
    const clear = !lineBlocked(W.map, p.x, p.z, tgt.x, tgt.z);
    if (bd < 4.5) { const es = escape(W, en); if (es) { inp.mx = es.mx; inp.mz = es.mz; } else { inp.mx = ux * .09; inp.mz = uz * .09; } if (bd < 2.2 && p.rollCd <= 0 && dodge() < .6) inp.roll = true; }     // отходит (в углу — стоит)
    else if (bd > range) { inp.mx = ux; inp.mz = uz; }
    else { inp.mx = ux * .09; inp.mz = uz * .09; }               // лёгкий шаг к цели — повернуться
    inp.attackPress = clear && bd < W.wp.trait.range;            // стреляет и на отходе: лук сам доворачивает на ближайшего видимого
    if (winding && p.rollCd <= 0 && dodge() < .5) { const es = escape(W, en); inp.roll = true; inp.mx = es ? es.mx : -ux; inp.mz = es ? es.mz : -uz; }
    return inp;
  }
  const reach = cfg.player.attackRange + W.gear.reach + C.radius * .5;
  if (bd > reach * .8) { inp.mx = ux; inp.mz = uz; }
  inp.attackPress = bd < reach + .4;
  if (winding && dodge() < .5) {
    if (hero === 'vale' && ready(W, 1)) useAbility(W, 1);       // Вейл парирует вместо переката, если может
    else if (p.rollCd <= 0) inp.roll = true;
  }
  return inp;
}

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
