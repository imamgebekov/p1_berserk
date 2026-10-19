// Метрика интереса (этап 0 плана «круче и веселее»): бот играет FUN_MIN минут игрового времени за каждого героя на большом мире.
// Он бродит по дорогам ядра от ворот лагеря (чаще — туда, где ещё не был), бьётся с врагами по пути, обходит боссов,
// подбирает добычу и надевает вещи лучше надетых.
// Печатает: время до первого боя, бои в минуту, долю времени без боя, длинные паузы без боя, улучшения вещей в час,
// уровень по времени, убийства и смерти. Без проверок «годно/негодно»: это замер для сравнения этапов (база — scratchpad).
// Ограничение: бот не берёт задания и сюжет — опыт только за убийства.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, aliveEnemies, respawnPlayer, refreshGear } from '../3d/src/sim.js';
import { equipAt, betterThanWorn } from '../3d/src/inv.js';
import { BY_ID } from '../3d/src/data/items.js';
import { HEROES } from '../3d/src/data/heroes3d.js';
import { insideCamp, campGates } from '../3d/src/map.js';

const MIN = Number(process.env.FUN_MIN || 20), LIST = (process.env.FUN_HEROES || 'thorn,jay,vale,irga').split(','), SEED = Number(process.env.FUN_SEED || 1);
const DT = 1 / 60, CALM = 3, PAUSE = 60, RCORE = 170;     // RCORE — ядро (уровни 1–20)     // новая стычка — после CALM с покоя; «длинная пауза» — без боя дольше PAUSE с

function play(hero, seed) {
  const cfg = JSON.parse(JSON.stringify(CFG3)), W = createWorld(cfg, mulberry32(seed * 7919 + 11));
  W.hero = hero; const H = HEROES[hero]; if (H.start && !W.inv.eq.weapon) W.inv.eq.weapon = H.start; refreshGear(W); W.player.hp = W.player.maxhp;     // как выбор героя в новой игре (main.js pickHero)
  const C = W.map.camp, p = W.player; p.x = C.x; p.z = C.z + C.r + 3;     // у южных ворот: бот не ищет выход из лагеря
  const nodes = new Map(), key = q => Math.round(q.x) + ',' + Math.round(q.z), node = q => { const k = key(q); if (!nodes.has(k)) nodes.set(k, { x: q.x, z: q.z, nb: new Set(), seen: 0 }); return nodes.get(k); };     // дороги ядра — граф
  for (const leg of W.map.paths || []) for (let k = 1; k < leg.pts.length; k++) { const a = leg.pts[k - 1], b = leg.pts[k]; if (Math.hypot(a.x, a.z) > RCORE || Math.hypot(b.x, b.z) > RCORE) continue; const A = node(a), B = node(b); A.nb.add(B); B.nb.add(A); }
  const all = [...nodes.values()].filter(n => n.nb.size && !(C && insideCamp(C, n.x, n.z))), nearest = () => all.reduce((a, b) => (Math.hypot(a.x - p.x, a.z - p.z) < Math.hypot(b.x - p.x, b.z - p.z) ? a : b));
  const rnd = mulberry32(seed + 5);
  let cur = null, side = 0, sideX = 0, sideZ = 0, stuck = 0, lastX = p.x, lastZ = p.z, calm = 99, fights = 0, firstFight = -1, inFight = 0, pause = 0, pauses = 0, ups = 0, deaths = 0, bagN = 0;
  const lvAt = {}, marks = [5, 10, 20, MIN].filter((m, i, a) => m <= MIN && a.indexOf(m) === i);
  const steps = Math.round(MIN * 60 / DT);
  for (let i = 0; i < steps; i++) {
    const t = i * DT, en = aliveEnemies(W); let tgt = null, bd = 1e9;
    const inC = !!C && insideCamp(C, p.x, p.z);
    let boss = null; for (const e of en) if (e.boss && Math.hypot(e.x - p.x, e.z - p.z) < 26) boss = e;     // босс рядом — уходим, как живой игрок низкого уровня
    for (const e of en) { if (e.boss || (C && insideCamp(C, e.x, e.z) !== inC)) continue; const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < bd) { bd = d; tgt = e; } }     // через частокол не бьёмся
    const fight = !!tgt && bd < 22 && (tgt.alert || bd < 14);
    if (fight) { if (calm > CALM) { fights++; if (firstFight < 0) firstFight = t; } calm = 0; inFight += DT; if (pause > PAUSE) pauses++; pause = 0; }
    else { calm += DT; pause += DT; }
    const inp = { mx: 0, mz: 0, attackPress: false, roll: false };
    if (side > 0 && !fight) { side -= DT; inp.mx = sideX; inp.mz = sideZ; }     // обход дома: шаг вбок
    else if (boss && !inC) { const d = Math.hypot(p.x - boss.x, p.z - boss.z) || 1; inp.mx = (p.x - boss.x) / d; inp.mz = (p.z - boss.z) / d; cur = null; }
    else if (fight) {
      const Ce = cfg.enemies[tgt.type] || { radius: .5, range: 1.5, wind: .5 }, reach = cfg.player.attackRange + W.gear.reach + Ce.radius * .5, ranged = W.gear.ranged;
      const want = ranged ? 7 : reach * .8;
      if (bd > want) { inp.mx = (tgt.x - p.x) / bd; inp.mz = (tgt.z - p.z) / bd; }
      inp.attackPress = ranged ? bd < 14 : bd < reach + .4; inp.aimPt = { x: tgt.x, z: tgt.z };
      if (tgt.state === 'wind' && bd < Ce.range + 1.2 && tgt.t > Ce.wind * .6 && p.rollCd <= 0 && rnd() < .5) inp.roll = true;
      if (i % 40 === 0) inp.ability = 1 + ((i / 40) % 5 | 0);     // умения по кругу: панель сама проверит ресурс и перезарядку
    } else if (inC) {                                                         // в лагере — к ближайшим воротам и наружу
      const g = campGates(C).reduce((a, b) => (Math.hypot(a.x - p.x, a.z - p.z) < Math.hypot(b.x - p.x, b.z - p.z) ? a : b)), ox = g.x + (g.x - C.x) * .2, oz = g.z + (g.z - C.z) * .2, d = Math.hypot(ox - p.x, oz - p.z) || 1;
      inp.mx = (ox - p.x) / d; inp.mz = (oz - p.z) / d; cur = null;
    } else if (all.length) {
      if (!cur) cur = nearest();
      const d = Math.hypot(cur.x - p.x, cur.z - p.z);
      if (d < 1.5) { cur.seen++; const nb = [...cur.nb].filter(n => !(C && insideCamp(C, n.x, n.z))); const least = Math.min(...nb.map(n => n.seen)); const pick = nb.filter(n => n.seen === least); cur = pick.length ? pick[(rnd() * pick.length) | 0] : nearest(); }     // чаще — туда, где не был
      else { inp.mx = (cur.x - p.x) / d; inp.mz = (cur.z - p.z) / d; }
    }
    step(W, DT, inp);
    if (process.env.FUN_DEBUG && i % 600 === 0) console.log(hero, (t | 0) + 'с', 'xz', p.x | 0, p.z | 0, 'hp', p.hp | 0, fight ? `бой ${tgt.type} d${bd.toFixed(1)} ehp${tgt.hp | 0} alert${!!tgt.alert}` : 'дорога', 'убито', W.kills);
    if (i % 180 === 0) { if (!fight && Math.hypot(p.x - lastX, p.z - lastZ) < .5) { stuck++; const a = rnd() * Math.PI * 2; side = 1.2; sideX = Math.cos(a); sideZ = Math.sin(a); if (process.env.FUN_DEBUG) console.log('застрял', t | 0, p.x | 0, p.z | 0, boss ? 'бежит от босса ' + boss.type : 'дорога', inC ? 'в лагере' : ''); if (stuck % 3 === 0) cur = null; } lastX = p.x; lastZ = p.z; }
    if (W.inv.bag.length !== bagN) {                                           // новая вещь: надеть, если лучше
      for (let k = W.inv.bag.length - 1; k >= 0; k--) { const it = BY_ID[W.inv.bag[k].id]; if (it && it.slot && betterThanWorn(W.inv, it) && equipAt(W.inv, k, W.hero)) { ups++; refreshGear(W); } }
      bagN = W.inv.bag.length;
    }
    if (p.dead) { deaths++; respawnPlayer(W); cur = null; }
    for (const m of marks) if (lvAt[m] === undefined && (i + 1) * DT >= m * 60 - DT / 2) lvAt[m] = W.lv;
  }
  return { hero, firstFight, fpm: fights / MIN, calmShare: 1 - inFight / (MIN * 60), pauses, upsH: ups * 60 / MIN, lvAt, kills: W.kills, deaths, stuck };
}

const rows = LIST.map(h => play(h, SEED));
const f = (v, n = 1) => (v < 0 ? '—' : v.toFixed(n));
console.log(`Метрика интереса: ${MIN} мин игры, зерно ${SEED} (опыт только за убийства)`);
console.log('герой   первый бой, с  бои/мин  без боя  паузы>60с  улучш/час  уровень ' + Object.keys(rows[0].lvAt).map(m => m + 'м').join('/') + '  убито  смертей  застрял');
for (const r of rows) console.log(`${r.hero.padEnd(7)} ${f(r.firstFight, 0).padStart(12)} ${f(r.fpm, 2).padStart(8)} ${(r.calmShare * 100).toFixed(0).padStart(7)}% ${String(r.pauses).padStart(10)} ${f(r.upsH).padStart(10)}  ${Object.values(r.lvAt).join('/').padStart(14)} ${String(r.kills).padStart(6)} ${String(r.deaths).padStart(8)} ${String(r.stuck).padStart(8)}`);
const broken = rows.filter(r => r.kills < 3 || r.stuck > MIN * 2);     // бот сломан (не бьётся или застревает) — замер не годится
if (broken.length) { console.log('Метрика интереса: ПРОВАЛ — бот не играет: ' + broken.map(r => `${r.hero} убито ${r.kills}, застрял ${r.stuck}`).join('; ')); process.exit(1); }
console.log('Метрика интереса 3D: OK');
