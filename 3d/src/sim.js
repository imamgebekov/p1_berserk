// Логика 3D-прототипа без графики: игрок, враги, бой. Координаты (x, z) на плоскости, y — вверх (только в рендере).
// Угол «face»: вперёд = (sin θ, cos θ). Мир создаётся фабрикой, чтобы тестироваться в Node.

export const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

export function mulberry32(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

import { TAU, DEG, clamp, len, rr } from './util3d.js';
import { biomeAt } from './worldgen3d.js';
import { hurtAlly, updateAllies } from './squad3d.js';
import { threatPick, addThreat } from './threat3d.js';
import { zoneAt } from './zones3d.js';
import { lifeFresh, nodesOf, coachesOf, mountMul, mountInput, dismount, repEvents, discoverCoaches } from './life3d.js';
import { trackPlace, reveal } from './places3d.js';
import { addXp, gainXp, paceXp } from './progress3d.js';
import { restock } from './economy3d.js';
import { updateWanderer, nearWanderer, blockCart, updateEvents } from './events3d.js';
import { useSlot, dashStep, tickAbilities } from './abilities3d.js';
import { abilityPointsAt } from './data/abilities3d.js';
import { waterDist, inStream } from './terrain3d.js';
import { pathGoal } from './path3d.js';
import { inCliff } from './cliffs3d.js';
import { firesOf, discoverFires } from './fires3d.js';
import { addFires } from './map.js';
import { BY_ID, CATALOG } from './data/items.js';
import { CONTAINERS, SHOP, SHOP_STAPLES, BOSS_LOOT, BOSS_DROPS, rollLoot, rollDrop, pickItem, chestGold } from './data/loot.js';
import { TRAITS, PERKS } from './data/weapons3d.js';
import { SETS } from './data/sets3d.js';
import { initBoss, updateBoss, tickBossZones, bossRise } from './boss3d.js';
import { storyFresh, storyTick, storyKill, storyBoss, storyActors, duelGuard, brandTick } from './story3d.js';
import { newKnown } from './craft3d.js';
import { questEvent, questTick } from './quests3d.js';
import { achFresh, achEvents, achTick } from './achieve3d.js';
import { abyssTick } from './abyss3d.js';
import { ngMul } from './ng3d.js';
import { lightOf, isNight } from './daynight.js';
import { rollElite, makeChief, eliteOnHit, eliteOnDeath, eliteTick, hasAff, affOf, rangedMove, rangedFire, updateFoes, foeAI, guardMul, turnTo, hitsWall, smartFoes } from './foes3d.js';
import { applyStatus, tickEnemy, tickPlayer, applyPlayer, cleansePlayer, speedMul, isStunned, rainK } from './status3d.js';
import { tickZones, isWet } from './elements3d.js';
import { weaponMix, gemDropOf, weaponElement, magicDropOf, armorGems } from './stones3d.js';
import { useWeaponSkill, tickWeaponSkill } from './weaponskill3d.js';
import { makeWeather, weatherAt } from './weather3d.js';
import { skillStats, canRank, SKILLS, MAX_RANKS, talentMods } from './data/skills3d.js';
import { createInv, addItem, removeAt, gearStats, setBonus, equipAt, entryOf, isPlain, roomFor, ilMul, scoreUp, qOf, socketsOf } from './inv.js';
import { affixFor, gemsFor } from './affix3d.js';
import { partyTravel } from './party3d.js';
import { wearHit, wearHurt, wearDeath, repairKit } from './dur3d.js';
import { DEFAULT_HERO, HEROES, canOff, canWield } from './data/heroes3d.js';
import { makeMap, insideOf, nearBuilding, resolve, slide, regionOf, placeAt, keepIn, pathStep, roomHops, lineBlocked, insideCamp, blockFoe } from './map.js';
import { initLevels, withLevel, depthAt, levelOfDepth, levelAt, onSurface, portalNear, backToSurface, travel, SURFACE } from './levels3d.js';
import { resGain } from './resource3d.js';
const critBonus = W => (W.abuf && W.abuf.hawk > 0 ? W.abuf.hawkCrit : 0);     // «Ястребиный глаз» Сойки: шанс крита на время

export function createWorld(cfg, rng = Math.random) {
  const W = makeWorld(cfg, rng); attachFx(W); W.partyHook = partyTravel;     // сбор группы при входе в подземелье отряда (4.07)
  const cell = cfg.map.cell, n = Math.ceil(2 * cfg.world.radius / cell) + 2; W.seenN = n; W.seen = new Uint8Array(n * n);
  initLevels(W);
  for (const id of Object.keys(W.levels)) withLevel(W, id, () => { for (const c of W.map.containers) if (c.far) c.t = cfg.map.containerRespawn; else refill(W, c); });     // дальние — когда герой подойдёт
  restock(W);
  for (const def of cfg.bosses.list) if (!def.city && (!def.level || W.levels[def.level])) withLevel(W, def.level || SURFACE, () => spawnBoss(W, def));     // босс города — когда герой подойдёт (garrisons)     // босс замка — в своём тронном зале (C4); нет уровня — нет босса
  refreshGear(W); W.player.hp = W.player.maxhp;     // запас здоровья героя (Торн ×1,15) — сразу полный
  return W;
}
// контекст оружия: умение типа и объединённые параметры свойств
const SET_BY_ID = Object.fromEntries(SETS.map(x => [x.id, x]));
export function weaponCtx(item, gems) {
  const kind = item ? item.kind : 'fists', perks = item && item.perks ? item.perks : [], pm = {};
  for (const id of perks) { const P = PERKS[id]; if (P) for (const k of Object.keys(P)) if (k !== 'name' && k !== 'text') pm[k] = P[k]; }
  return { kind, trait: TRAITS[kind] || TRAITS.fists, perks, pm, mix: weaponMix(item, gems), el: weaponElement(item) };     // mix — сплав камней (или null), el — стихия вещи
}

// связки для модуля статусов: урон, реакции, смерть
function attachFx(W) {
  W.fx = {
    kill: e => killEnemy(W, e, 1),
    deal: (e, dmg, fx) => dealDamage(W, e, dmg, fx),
    hp: (e, frac, base) => Math.round(base + e.maxhp * frac),
    slide: (e, dx, dz, r) => slide(W.map, e, dx, dz, r),
    reveal: (x, z, r) => reveal(W, x, z, r),
    quest: (type, d) => questEvent(W, type, d),
    xp: (n, kind) => gainXp(W, kind ? paceXp(W, n, kind) : n),     // kind 'quest' — темп (этап 3 «круче»)
    hurtP: (dmg, x, z, on, e) => hurtPlayer(W, dmg, x, z, on, e),
    hurtA: (a, dmg, e) => hurtAlly(W, a, dmg, e),
    spawn: (type, x, z) => spawnEnemy(W, type, x, z),
    blocked: (x0, z0, x1, z1) => lineBlocked(W.map, x0, z0, x1, z1) || hitsWall(W.map, x1, z1),     // этап 7: подмога босса — не за стеной
    react: (e, name, dmg, area) => {
      W.ev.push({ k: 'react', name, x: e.x, z: e.z });
      if (area) { for (const o of W.enemies) if (!o.dead && len(o.x - e.x, o.z - e.z) < area.r) dealDamage(W, o, Math.round(area.d), 'venom'); }
      else dealDamage(W, e, dmg, 'frost');
    },
    dotPlayer: d => {
      const p = W.player; if (p.dead) return;
      p.hp -= d; p.dotAcc = (p.dotAcc || 0) + d;
      if (p.dotAcc >= 3) { W.ev.push({ k: 'pdot', x: p.x, z: p.z, dmg: Math.round(p.dotAcc) }); p.dotAcc = 0; }
      if (p.hp <= 0) killPlayer(W);
    }
  };
}

function makeWorld(cfg, rng) {
  const P = cfg.player;
  return {
    cfg, rng, map: withLife(addFires(makeMap(cfg), cfg, firesOf), cfg), life: lifeFresh(), ach: achFresh(), story: cfg.story && cfg.story.on ? storyFresh() : null, fires: {}, gfx: {}, hero: DEFAULT_HERO, heroes: {}, ap: 0, ab: {}, bar: [], acd: {}, abuf: {}, traps: [], zones: [], ezones: [], inside: -1, difficulty: cfg.difficulty.default, dif: cfg.difficulty.levels[cfg.difficulty.default], iron: false, tomb: null, known: newKnown(), quests: {}, proj: [], haz: [], light: 1, night: false, setFx: {}, allies: [], aid: 1, party: { cmd: 'follow', hx: 0, hz: 0, mark: 0, last: 0 }, wp: weaponCtx(null), combo: { n: 0, t: 0 }, reap: { n: 0, t: 0, amt: 0 }, bul: { n: 0, t: 0, amt: 0 }, pst: {}, echoQ: [], fx: null, bossDead: {}, hudBoss: null, place: null, seen: null, revealT: 0, lv: 1, xp: 0, sp: 0, skills: {}, shop: { stock: [], t: 0 }, nearMerchant: false, nearNpc: null, nearPortal: null, keys: {}, inv: createInv(), buffs: [], drops: [], gear: gearStats(createInv()), dropId: 1, t: 0, kills: 0, eid: 1, spawnT: 1, freeze: 0, shake: 0, ev: [],
    player: { x: 0, z: 4, vx: 0, vz: 0, face: Math.PI, hp: P.hp, maxhp: P.hp, state: 'idle', atkT: 0, atkHit: false, rollT: 0, rollDirX: 0, rollDirZ: 1, rollCd: 0, inv: 0, dead: false, deadT: 0, dodgeCd: 0, chain: 0, fin: false, rollAtk: false, lastAtkEnd: -9, lastRollEnd: -9, riposteT: 0, atkHeld: false, holdT: 0, atkBuf: 0, chargeT: 0, heavy: 0, swingMul: 1, rollPress: false },
    enemies: []
  };
}


// поддержка врагов (этап 7, Акт IV): тролль восстанавливается, если 3 с не били; кликуша лечит самого раненого своего (не босса) рядом
function foeSupport(W, dt) {
  for (const e of W.enemies) {
    if (e.dead) continue; const C = W.cfg.enemies[e.type];
    if (C.regen) { if (e.flash > 0) e.regT = 3; else if ((e.regT = (e.regT || 0) - dt) <= 0 && e.hp < e.maxhp) e.hp = Math.min(e.maxhp, e.hp + e.maxhp * C.regen * dt); }
    if (C.heal && (e.hcd = (e.hcd ?? C.heal.cd) - dt) <= 0) {
      e.hcd = C.heal.cd; let best = null, br = .8;
      for (const o of W.enemies) { if (o.dead || o === e || o.boss) continue; const r = o.hp / o.maxhp; if (r < br && len(o.x - e.x, o.z - e.z) < C.heal.r) { br = r; best = o; } }
      if (best) { best.hp = Math.min(best.maxhp, best.hp + best.maxhp * C.heal.amt); W.ev.push({ k: 'foeheal', x: best.x, z: best.z }); }
    }
  }
}
// знаменосец (этап 7): враги рядом с живым знаменосцем бьют сильнее (aura.dmg), сам знаменосец — нет
function auraMul(W, e) {
  let k = 1; for (const o of W.enemies) { const A = !o.dead && o !== e && W.cfg.enemies[o.type].aura; if (A && len(o.x - e.x, o.z - e.z) < A.r) k = Math.max(k, 1 + A.dmg); }
  return k;
}
// точки сбора и повозки (этап 6) — на карте поверхности
function withLife(map, cfg) { map.nodes = nodesOf(map, cfg); map.coaches = coachesOf(map, cfg); return map; }
export function spawnEnemy(W, type, x, z, mode = null) {
  const C = W.cfg.enemies[type], E = W.cfg.enemies, d0 = depthAt(W, x, z), depth = Math.min(1, d0), lvl = levelAt(W, x, z), grow = 1 + Math.max(0, lvl - W.cfg.level.core) * W.cfg.level.grow, pl = placeAt(W.map, x, z), danger = pl && pl.danger || 0, hp = Math.round(C.hp * (1 + E.depthHp * depth) * grow * (1 + E.dangerHp * danger) * W.dif.hp);     // за ядром — по уровню места (этап 0): ×grow на уровень сверх core
  const e = { id: W.eid++, type, x, z, vx: 0, vz: 0, hp, maxhp: hp, lvl: Math.round(lvl), dmgMul: (1 + E.depthDmg * depth + E.dangerDmg * danger) * grow * W.dif.dmg * (W.night ? W.cfg.daynight.night.dmg : 1), danger, face: 0, state: 'chase', t: 0, cd: rr(W, .2, .9), flash: 0, dead: false, deadT: 0, hitMe: false };
  if (W.ng) { const G = ngMul(W); e.hp = e.maxhp = Math.round(e.maxhp * G.hp); e.dmgMul *= G.dmg; }     // «Новый круг» (этап 6 «круче»)
  rollElite(W, e, depth, danger);
  if (mode === 'guard' || mode === 'patrol') postEnemy(W, e, mode);
  W.enemies.push(e);
  return e;
}
// сторож стоит у поста и смотрит по сторонам; патрульный ходит по маршруту из точек вокруг места появления
// сторож и патрульный замечают героя: глазами (конус, без стены на линии, тот же дом) или ушами — только шум боя
function spotted(W, e, d, dx, dz, H) {
  if (W.abuf && W.abuf.smoke > 0) return false;     // «Дымовая завеса» Вейла: враги не замечают героя
  if (e.lostT > 0) return false;                     // только что бросил погоню — идёт к посту
  const P = W.cfg.enemies.posts, p = W.player;
  const fight = p.state === 'atk' || p.state === 'roll' || p.state === 'charge';
  const hear = W.dif.hear * rainK(W, 'hear');                                  // в дождь хуже слышат и видят
  if (fight && d < H.fight * P.fightHear * hear) return true;
  if (e.pack && !p.dead && d < W.cfg.enemies.roam.hear * (p.state === 'run' ? 1 : .55) * hear * (1 - clamp(W.gear.stealth || 0, 0, 60) / 100)) return true;     // стайка слышит вблизи (G1)
  return d < (e.sight ? e.sight.r : P.range) * rainK(W, 'sight') && Math.abs(angDiff(Math.atan2(dx, dz), e.face)) < (e.sight ? e.sight.angle : P.angle) * DEG / 2 && insideOf(W.map, e.x, e.z) === W.inside && !lineBlocked(W.map, e.x, e.z, p.x, p.z);
}
// заметил — кричит: встают все рядом (и сторожа, и бродячие)
function raiseAlarm(W, e) {
  e.alert = true; W.ev.push({ k: 'spot', x: e.x, z: e.z, id: e.id });
  const R = W.cfg.enemies.posts.alarm;
  for (const o of W.enemies) if (o !== e && !o.dead && !o.alert && !o.boss && !(o.lostT > 0) && len(o.x - e.x, o.z - e.z) < R) o.alert = true;
}
// своими делами: сторож у поста озирается (вернётся, если ушёл), патрульный идёт к следующей точке маршрута
function keepPost(W, e, C, spd, dt) {
  const P = W.cfg.enemies.posts;
  const go = (tx, tz, k) => { const gx = tx - e.x, gz = tz - e.z, gd = len(gx, gz); if (gd < .6) return true; e.face = Math.atan2(gx, gz); slide(W.map, e, gx / gd * spd * k * dt, gz / gd * spd * k * dt, C.radius); return false; };
  if (e.mode === 'patrol') {
    const q = e.route[e.ri], x0 = e.x, z0 = e.z;
    if (go(q.x, q.z, P.patrolSpeed)) { e.ri = (e.ri + 1) % e.route.length; e.stuck = 0; return; }
    e.stuck = len(e.x - x0, e.z - z0) < spd * P.patrolSpeed * dt * .3 ? (e.stuck || 0) + dt : 0;      // упёрся — через 3 с к следующей точке
    if (e.stuck > 3) { e.ri = (e.ri + 1) % e.route.length; e.stuck = 0; }
    return;
  }
  if (go(e.home.x, e.home.z, P.home)) e.face = e.look + Math.sin(W.t * P.look + e.id) * .9;
}
function postEnemy(W, e, mode) {
  const P = W.cfg.enemies.posts;
  e.mode = mode; e.home = { x: e.x, z: e.z }; e.face = rr(W, 0, TAU); e.look = e.face; e.ri = 0;
  if (mode === 'patrol') {          // точки маршрута — свободные (не в доме и не в препятствии), иначе пропускаются
    e.route = [{ x: e.x, z: e.z }];
    for (let i = 1, tries = 0; i < P.patrolPts && tries < P.patrolPts * 6; tries++) {
      const a = rr(W, 0, TAU), d = rr(W, P.patrolR * .5, P.patrolR), q = { x: e.x + Math.sin(a) * d, z: e.z + Math.cos(a) * d }, o = { ...q };
      resolve(W.map, o, 1); if (len(o.x - q.x, o.z - q.z) < .01 && insideOf(W.map, q.x, q.z) < 0 && !lineBlocked(W.map, e.x, e.z, q.x, q.z)) { e.route.push(q); i++; }
    }
  }
}

const roamOn = W => { const R = W.cfg.enemies.roam; return !!(R && R.on && W.cfg.enemies.posts.modes && W.lvl === 'surface'); };     // стайкам нужны патрули
function spawnRing(W) {
  const RM = roamOn(W) ? W.cfg.enemies.roam : null, [lo, hi] = RM ? RM.ring : W.cfg.enemies.ring, p = W.player;
  const a = rr(W, 0, TAU), d = rr(W, lo, hi), R = W.cfg.world.radius - 2;
  let x = p.x + Math.sin(a) * d, z = p.z + Math.cos(a) * d;
  const l = len(x, z); if (l > R) { x *= R / l; z *= R / l; }
  if (nearBuilding(W.map, x, z, 1.5)) return false;                 // не рождаем врагов в стенах
  if (W.map.camp && insideCamp(W.map.camp, x, z, -W.map.camp.spawnPad)) return false;   // и в лагере, и у самого частокола
  { const pl = placeAt(W.map, x, z); if (pl && pl.safe) return false; }   // и в безопасных местах
  if (W.map.river && waterDist(W.map.river, x, z) < 1) return false;      // и в реке
  if (inCliff(W.map.plateaus, x, z, 1)) return false;                     // и в стене обрыва
  const reg = W.cfg.enemies.regions[regionOf(W.map, x, z)] || (W.cfg.enemies.zones || {})[(zoneAt(W.cfg, x, z) || {}).id] || (W.cfg.enemies.biomes || {})[biomeAt(W.cfg, x, z)], posts = W.cfg.enemies.posts.modes;     // вне областей — по биому большого мира
  const pick = reg ? pickEntry(reg.filter(a => (a[2] !== 'night' || W.night) && (!a[3] || posts)), W.rng) : null;      // 'night' — только ночью; сторожа и патрули — если включены
  const type = pick ? pick[0] : W.rng() < W.cfg.enemies.brutePart ? 'brute' : 'imp';
  if (!RM || (pick && pick[3])) { spawnEnemy(W, type, x, z, pick && pick[3] || null); return; }
  // стайка (G1): 2–4 врага вида места рядом друг с другом; бродят по маршруту около места появления
  const n = Math.round(rr(W, RM.pack[0], RM.pack[1] + .49));
  for (let i = 0; i < n; i++) {
    const t = i === 0 ? type : (reg ? pickEntry(reg.filter(a => (a[2] !== 'night' || W.night) && !a[3]), W.rng)[0] : W.rng() < W.cfg.enemies.brutePart ? 'brute' : 'imp');
    const o = { x: x + rr(W, -2.5, 2.5), z: z + rr(W, -2.5, 2.5) }; resolve(W.map, o, 1);
    const e = spawnEnemy(W, t, o.x, o.z, 'patrol'); e.pack = true;
    const Y = RM.firstPack; if (Y && W.lv < Y.lv && Math.hypot(o.x, o.z) < Y.r) { e.maxhp = e.hp = Math.max(1, Math.ceil(e.maxhp * Y.hp)); e.young = true; }     // «молодые» у лагеря в начале (шаг 12)
  }
}
// гарнизоны (G2): опасные места большого мира и стоянки заселяются, когда герой ближе near м, но дальше far (вне экрана);
// после зачистки — снова через respawn с; ушедший далеко гарнизон забывается, и место заселится при следующем подходе
function garrisons(W, dt) {
  const G = W.cfg.enemies.garrison; if (!G || (W.garrT = (W.garrT || 0) - dt) > 0) return; W.garrT = .5;
  const p = W.player, E = W.cfg.enemies; W.garr = W.garr || {};
  if (W.lvl === SURFACE) for (const def of W.cfg.bosses.list) if (def.city && W.bossDead[def.type] === undefined && len(def.x - p.x, def.z - p.z) < (G.bossNear || 90) && !W.enemies.some(e => e.boss && e.type === def.type)) spawnBoss(W, def);     // босс павшего города встаёт при подходе
  for (const pl of W.map.cfg.places || []) {
    if (!pl.gen || pl.type !== 'danger' || pl.castle) continue;
    const d = len(pl.x - p.x, pl.z - p.z); if (d > G.near || d < G.far || (W.garr[pl.id] || 0) > W.t || W.enemies.some(e => e.garr === pl.id && !e.dead)) continue;
    const type = regionOf(W.map, pl.x, pl.z), tbl = E.regions[type]; if (!tbl) continue;
    W.garr[pl.id] = W.t + G.respawn;
    const pool = tbl.filter(a => a[2] !== 'night' || W.night), n = G.n[type] || 3, CH = (G.chief || {})[type], sp = (G.spread || {})[type] || .45;
    for (let i = 0; i < n; i++) {
      const a = rr(W, 0, TAU), r0 = rr(W, 1.5, Math.max(2.5, pl.r * sp)), o = { x: pl.x + Math.sin(a) * r0, z: pl.z + Math.cos(a) * r0 }; resolve(W.map, o, 1);
      const e = spawnEnemy(W, pickEntry(pool, W.rng)[0], o.x, o.z, i % 2 ? 'patrol' : 'guard'); e.garr = pl.id;
      if (pl.city && G.cityHp) e.hp = e.maxhp = Math.round(e.maxhp * G.cityHp);     // в павших городах враги крепче
      if (CH && i < CH[0]) makeChief(W, e, CH[1], CH[2]);     // вожаки — мини-боссы места (2026-10-18)
    }
  }
}
// святилище (G2): касание даёт дар на время; то же святилище — снова через again с
function touchShrine(W) {
  const S = W.cfg.shrine, p = W.player; if (!S || !onSurface(W) || p.dead) return;
  W.shrines = W.shrines || {};
  for (const q of W.cfg.map.pois || []) {
    if (q.t !== 'shrine' || len(q.x - p.x, q.z - p.z) > S.reach || (W.shrines[q.id] || -1e9) > W.t) continue;
    const g = S.gifts[Math.abs(Math.round(q.x * 13 + q.z * 7)) % S.gifts.length];
    W.shrines[q.id] = W.t + S.again;
    const ex = W.buffs.find(b => b.src === 'shrine:' + g.stat); if (ex) ex.t = g.t; else W.buffs.push({ stat: g.stat, amt: g.amt, t: g.t, src: 'shrine:' + g.stat });
    W.ev.push({ k: 'shrine', x: q.x, z: q.z, name: g.name, stat: g.stat, amt: g.amt, t: g.t });
  }
}
function pickEntry(table, rng) { let t = 0; for (const a of table) t += a[1]; let r = rng() * t; for (const a of table) { r -= a[1]; if (r <= 0) return a; } return table[0]; }

export function setDifficulty(W, id) {
  const lv = W.cfg.difficulty.levels[id]; if (!lv) return false;
  W.difficulty = id; W.dif = lv;
  for (const e of W.enemies) if (e.boss && !e.dead) { const C = W.cfg.enemies[e.type], mx = Math.round(C.hp * lv.hp); e.hp = e.hp / e.maxhp * mx; e.maxhp = mx; e.dmgMul = lv.dmg; }     // живые боссы пересчитываются
  refreshGear(W); return true;
}

export const aliveEnemies = W => W.enemies.filter(e => !e.dead);

// босс: здоровье из конфига (без роста от глубины), логово — точка появления
export function spawnBoss(W, def) {
  const C = W.cfg.enemies[def.type], e = spawnEnemy(W, def.type, def.x, def.z);
  const L = W.cfg.level, bk = 1 + Math.max(0, (e.lvl || 1) - (def.base ?? L.bossBase)) * L.grow;     // боссы настроены под bossBase (подземелья — под свой base); глубже — крепче и злее (этап 0)
  const H = W.levels && W.levels[W.lvl] && W.levels[W.lvl].heroic ? W.cfg.instances.heroic : null;     // героическая (этап 5)
  const Mg = W.cfg.dungeons.might, mg = Mg && Mg.on && def.level ? (def.castle ? Mg.castle : def.final ? Mg.boss : Mg.mini) : null;     // боссы подземелий мощнее (2026-10-20): главный и промежуточные
  e.hp = e.maxhp = Math.round(C.hp * W.dif.hp * bk * (H ? H.hp : 1) * (mg ? mg.hp : 1)); e.dmgMul = W.dif.dmg * bk * (H ? H.dmg : 1) * (mg ? mg.dmg : 1); if (H) e.heroic = true; initBoss(W, e, def); resolve(W.map, e, C.radius); e.b.home = { x: e.x, z: e.z };
  delete W.bossDead[def.type]; return e;
}
function bossDefeated(W, e) {
  const C = W.cfg.enemies[e.type], p = W.player;
  const bd = BOSS_DROPS[e.type] || { trophy: null, n: [0, 0], tomes: [] }, items = [];
  if (bd.trophy) items.push({ id: bd.trophy, n: bd.n[0] + (W.rng() < bd.n[1] ? 1 : 0) });
  { const own = [...((e.b && e.b.def && e.b.def.loot) || [])], I = W.cfg.instances;     // своя добыча босса подземелья (этап 5): одна вещь наверняка, вторая — с шансом, на героической — ещё extra
    const raid = W.levels && W.levels[W.lvl] && W.levels[W.lvl].def && W.levels[W.lvl].def.raid, l2 = raid && W.cfg.lootIl && W.cfg.lootIl.on ? W.cfg.lootIl.raid2 : I.loot2;     // 4.20: рейд — вторая вещь 50/50
    for (let k = own.length ? 1 + (W.rng() < l2 ? 1 : 0) + (e.heroic ? I.heroic.extra : 0) : 0; k > 0 && own.length; k--) items.push({ id: own.splice((W.rng() * own.length) | 0, 1)[0], n: 1 }); }
  const tid = bd.tomes.find(t => !W.known.tomes[t] && !W.inv.bag.some(x => x.id === 'tome_' + t) && !W.drops.some(x => x.id === 'tome_' + t));
  if (tid) items.push({ id: 'tome_' + tid, n: 1 });                      // книга выпадает, пока не прочитана (первой по порядку)
  items.push({ id: 'key_black', n: 1 }, ...rollLoot(BOSS_LOOT, W.rng, 1, W.gear.luck));
  if (bd.gold && W.rng() < bd.gold) { const G = CATALOG.filter(i => i.pool === 'gold'); items.push({ id: G[(W.rng() * G.length) | 0].id, n: 1 }); }     // босс павшего города: шанс золотой вещи
  items.forEach((it, i) => { const a = i / items.length * TAU; W.drops.push({ id: it.id, n: it.n, x: e.x + Math.sin(a) * 1.6, z: e.z + Math.cos(a) * 1.6, t: 0, cd: 0, ...(BY_ID[it.id].slot ? { il: (lootIl(W, e, e.id + i) ?? ilRoll(W, Math.max(e.lvl || 1, W.lv), e.id + i) + W.cfg.level.il.drop) + (e.heroic ? W.cfg.instances.heroic.il : 0) } : {}) }); });     // с босса — не ниже уровня героя
  for (const m of e.b.minions) if (!m.dead) { m.dead = true; m.deadT = 0; }
  W.bossDead[e.type] = Math.round(W.cfg.bosses.respawn * W.dif.boss);
  W.ev.push({ k: 'bossdead', name: C.name, type: e.type, x: e.x, z: e.z });     // type — для «Пути пепла» (шаг 13)
}
export function restoreBosses(W, dead) {
  if (!dead || typeof dead !== 'object') return;
  for (const def of W.cfg.bosses.list) {
    const t = dead[def.type]; if (!(Number.isFinite(t) && t > 0) || (def.level && !W.levels[def.level])) continue;
    withLevel(W, def.level || SURFACE, () => { const e = W.enemies.find(x => x.boss && x.type === def.type); if (e) { e.dead = true; e.deadT = 9; } });
    W.bossDead[def.type] = Math.min(W.cfg.bosses.respawn, t);
  }
}

// смерть героя: потеря пепла (остаётся могила), уровни улучшения на высокой сложности, конец игры в железном режиме
function killPlayer(W) {
  const p = W.player, D = W.dif.death;
  p.hp = 0; p.dead = true; p.state = 'dead'; p.deadT = 0;
  const lost = Math.floor(W.inv.ash * D.ash); W.inv.ash -= lost;
  if (D.tomb && lost > 0) W.tomb = { x: p.x, z: p.z, ash: lost, lvl: W.lvl };
  let burned = 0; if (D.gear) for (const sl of Object.keys(W.inv.up)) if (W.inv.up[sl] > 0) { W.inv.up[sl]--; burned++; if (!W.inv.up[sl]) delete W.inv.up[sl]; }
  if (wearDeath(W)) refreshGear(W);     // смерть изнашивает всё надетое (4.03)
  W.ev.push({ k: 'playerDead', x: p.x, z: p.z, lost, burned, iron: W.iron });
}

export function hurtPlayer(W, dmg, fromX, fromZ, on, att) {
  const p = W.player;
  if (p.dead) return false;
  if (W.abuf.parry > 0 && !p.dead) {                             // парирование (Вейл): удар пойман, бьющий оглушён, ответ
    W.ev.push({ k: 'parry', x: p.x, z: p.z, face: p.face });
    if (att && !att.dead) { applyStatus(W, att, 'stun', 0, W.abuf.parryStun); abilityHit(W, att, W.abuf.parryMul, { knock: 1.2 }); }
    if (W.abuf.parryHeal) p.hp = Math.min(p.maxhp, p.hp + p.maxhp * W.abuf.parryHeal);     // мастерство «Парирования»
    return false;
  }
  if (p.state === 'roll' || p.inv > 0) {
    if (p.state === 'roll' && p.dodgeCd <= 0) { p.dodgeCd = .3; p.riposteT = .7; W.ev.push({ k: 'dodge', x: p.x, z: p.z }); }
    return false;
  }
  if (W.setFx.lastStand && p.hp < p.maxhp * .4) dmg *= 1 - W.setFx.lastStand;
  // щит: удар спереди ослаблен на блок %, отброс меньше; пока герой бьёт или заряжает — щит не закрывает
  let knock = 5;
  if (W.gear.block > 0 && fromX !== undefined && p.state !== 'atk' && p.state !== 'charge' && Math.abs(angDiff(Math.atan2(fromX - p.x, fromZ - p.z), p.face)) < W.cfg.block.arc * DEG / 2) {
    if (W.gfx.reflect && att && !att.dead) { dealDamage(W, att, Math.round(dmg * W.gfx.reflect), null); W.ev.push({ k: 'reflect', x: att.x, z: att.z }); }     // Щит Восхода
    dmg *= 1 - Math.min(80, W.gear.block) / 100; knock *= W.cfg.block.knock; W.ev.push({ k: 'block', x: p.x, z: p.z, face: p.face, hero: true });
  }
  if (W.abuf.iron > 0) { dmg *= W.abuf.ironTaken; knock = 0; }          // несокрушимость: меньше урона, не отбрасывает
  dmg = Math.max(1, Math.round(dmg / (1 + Math.max(0, W.gear.armor) * W.cfg.gear.armorK)));
  if (W.abuf.mshield > 0) { const a = Math.min(Math.floor(dmg * W.abuf.mshieldK), Math.floor(W.res || 0)); if (a > 0) { W.res -= a; dmg = Math.max(0, dmg - a); W.ev.push({ k: 'mshield', x: p.x, z: p.z, n: a }); } }     // щит маны Ирги
  if (p.ward > 0) { const a = Math.min(p.ward, dmg); p.ward -= a; dmg -= a; W.ev.push({ k: 'ward', x: p.x, z: p.z, n: a }); if (dmg <= 0) { p.inv = W.cfg.player.hurtInvuln; return false; } }     // 4.16: оберег Жреца
  p.lastHurt = W.t;
  if (W.gfx.aegis && W.aegis > 0) { const a = Math.min(W.aegis, dmg); W.aegis -= a; dmg -= a; W.ev.push({ k: 'aegis', x: p.x, z: p.z, left: W.aegis }); if (W.aegis <= 0) W.aegisT = W.gfx.aegis[0]; if (dmg <= 0) { p.inv = W.cfg.player.hurtInvuln; return true; } }     // Кираса Солнца: щит берёт удар первым
  p.calm = W.cfg.player.fire.calm;
  dmg = duelGuard(W, dmg); p.hp -= dmg; if (W.life && W.life.mount.on) dismount(W); p.inv = W.cfg.player.hurtInvuln;     // поединок Акта I: герой не гибнет     // ранен — спешился (этап 6)
  W.shake = Math.max(W.shake, W.cfg.fx.shake * 1.4);
  const d = len(p.x - fromX, p.z - fromZ) || 1;
  p.vx += (p.x - fromX) / d * knock; p.vz += (p.z - fromZ) / d * knock;
  W.ev.push({ k: 'hurt', x: p.x, z: p.z, dmg }); resGain(W, 'hurt', dmg); if (dmg > 0 && wearHurt(W)) refreshGear(W);     // износ брони (4.03)     // ярость копится от урона
  if (on && W.rng() < on[1]) applyPlayer(W, on[0], on[2], on[3]);
  const fx = W.setFx;
  if (att && !att.dead) {
    if (fx.thorns) dealDamage(W, att, Math.max(1, Math.round(dmg * fx.thorns)), null);
    if (fx.plague && !att.dead) applyStatus(W, att, 'poison', 3, fx.plague);
  }
  if (fx.ashCloak && W.rng() < fx.ashCloak) { W.ev.push({ k: 'boom', x: p.x, z: p.z, r: 4 }); for (const o of W.enemies) if (!o.dead && len(o.x - p.x, o.z - p.z) < 4) { dealDamage(W, o, 25, 'fire'); applyStatus(W, o, 'burn', 4, 4); } }
  if (p.hp <= 0) killPlayer(W);
  return true;
}

export function killEnemy(W, e, share) {
  if (e.dead) return;
  if (e.boss && e.b && e.b.def && e.b.def.stage2 && !e.b.st2) { bossRise(W, e); return; }     // вторая стадия (4.18б)
  e.dead = true; e.deadT = 0; W.kills++; if (!W.known.bestiary[e.type]) W.known.bestiary[e.type] = 1; questEvent(W, 'kill', { enemy: e.type, id: e.id }); storyKill(W, e); if (e.boss) { questEvent(W, 'boss', { boss: e.type }); bossDefeated(W, e); storyBoss(W, e.type); } W.ev.push({ k: 'die', x: e.x, z: e.z, type: e.type, id: e.id, elite: !!e.elite, boss: !!e.boss });
  dropLoot(W, e); addXp(W, e, share); eliteOnDeath(W, e);
  { const H = heroMul(W), kh = H.killHeal ? H.killHeal * clamp((H.healLv[1] - W.lv) / (H.healLv[1] - H.healLv[0]), 0, 1) : 0, p = W.player; if (kh && !p.dead && p.hp > 0 && len(p.x - e.x, p.z - e.z) < 6 && W.enemies.filter(o => !o.dead && len(o.x - p.x, o.z - p.z) < 6).length >= 2) p.hp = Math.min(p.maxhp, p.hp + p.maxhp * kh); }     // «второе дыхание» Торна: убил рядом — подлечился
  { const mid = magicDropOf(W, e, clamp(depthAt(W, e.x, e.z) + .1 * (e.danger || 0), 0, 1)); if (mid) { W.drops.push({ id: mid, n: 1, x: e.x - .5, z: e.z + .5, t: 0, cd: 0, il: lootIl(W, e, e.id) ?? ilRoll(W, e.lvl, e.id) }); W.ev.push({ k: 'drop', x: e.x, z: e.z, id: mid }); } }     // посох или жезл (Ирга)
  { const gid = gemDropOf(W, e); if (gid) { W.drops.push({ id: gid, n: 1, x: e.x + .5, z: e.z - .5, t: 0, cd: 0 }); W.ev.push({ k: 'drop', x: e.x, z: e.z, id: gid }); } }     // камень силы
  if (share >= 1) mixOnDeath(W, e);
  if (share >= 1 && W.gfx.midas && !e.boss && W.rng() < W.gfx.midas) dropLoot(W, e);                         // Перстень Мидаса: добыча дважды
  if (share >= 1 && W.gfx.gale) { const ex = W.buffs.find(b => b.src === 'gale'); if (ex) ex.t = W.gfx.gale[1]; else W.buffs.push({ stat: 'spd', amt: W.gfx.gale[0], t: W.gfx.gale[1], src: 'gale' }); }     // Сапоги Ветра
  if (e.guard && !W.keys[e.guard]) { W.keys[e.guard] = true; W.ev.push({ k: 'key', key: e.guard, x: e.x, z: e.z }); }     // страж замка отдаёт ключ трона (C4)
  if (share >= 1) {                                                   // свойства оружия за убийство
    const pm = W.wp.pm;
    const kh = (pm.killHeal || 0) + (W.setFx.killHeal || 0) + (W.wp.mix && W.wp.mix.a === 'blood' && W.wp.mix.b === 'blood' ? W.cfg.stones.thirst[1] : 0); if (kh) W.player.hp = Math.min(W.player.maxhp, W.player.hp + kh);
    if (pm.reaper) { W.reap.n = Math.min(pm.reaper[1], W.reap.n + 1); W.reap.t = pm.reaper[2]; W.reap.amt = pm.reaper[0]; }
  }
}

function dropLoot(W, e) {
  if (e.noLoot || e.duel) return;     // сюжетные: поединок без добычи
  const depth = clamp(depthAt(W, e.x, e.z) + .1 * (e.danger || 0), 0, 1);
  const rolls = e.elite ? W.cfg.elite.lootRolls : 1;
  for (let r = 0; r < rolls; r++) for (const it of rollDrop(e.type, W.rng, depth, W.gear.luck + (e.elite ? W.cfg.elite.luck : 0), W.cfg.drops.brandK, W.cfg.loot && W.cfg.loot.on ? { lvl: W.cfg.lootIl && W.cfg.lootIl.on ? Math.min(W.lv, e.lvl + W.cfg.lootIl.over) : e.lvl, L: W.cfg.loot } : null, W.cfg.drops)) {     // 4.20: редкость — по уровню добычи
    const a = W.rng() * TAU;
    W.drops.push({ id: it.id, n: it.n, x: e.x + Math.sin(a) * .7, z: e.z + Math.cos(a) * .7, t: 0, cd: 0, ...(BY_ID[it.id].slot ? { il: lootIl(W, e, e.id + r) ?? ilRoll(W, e.lvl, e.id + r) } : {}) });
    W.ev.push({ k: 'drop', x: e.x, z: e.z, id: it.id });
  }
}

function attackStart(W, heavy = 0) {
  const p = W.player, P = W.cfg.player, H = P.heavy;
  // автоприцел: ближайший враг в радиусе autoAim; у лука — ближайший видимый в пределах дальности (после переката не стрелять за спину)
  const tr = W.wp.trait, aim = W.aimPt && len(W.aimPt.x - p.x, W.aimPt.z - p.z) > .3 ? Math.atan2(W.aimPt.x - p.x, W.aimPt.z - p.z) : null; let best = null, bd = tr.ranged ? tr.range : P.autoAim;
  for (const e of W.enemies) { if (e.dead) continue; const d = len(e.x - p.x, e.z - p.z); if (aim !== null && Math.abs(angDiff(Math.atan2(e.x - p.x, e.z - p.z), aim)) > P.aimCone * DEG) continue; if (d < bd && (!tr.ranged || !lineBlocked(W.map, p.x, p.z, e.x, e.z))) { bd = d; best = e; } }     // курсор: только враги в конусе у курсора
  if (best) p.face = Math.atan2(best.x - p.x, best.z - p.z); else if (aim !== null) p.face = aim;
  // цепочка: удары в пределах 0,9 с друг от друга; каждый третий — завершающий. Удар сразу после переката — рывок-удар
  // тяжёлый удар (heavy — доля заряда 0–1) цепочку не продолжает и сбрасывает
  if (heavy) { p.chain = 0; p.fin = false; } else { p.chain = W.t - p.lastAtkEnd < .9 ? p.chain + 1 : 1; p.fin = p.chain % 3 === 0; }
  p.rollAtk = W.t - p.lastRollEnd < .5;
  const dual = offDmg(W) > 0;
  p.state = 'atk'; p.atkT = 0; p.atkHit = false; p.heavy = heavy; p.swingMul = W.gear.swing * (heavy ? H.swing : 1) * (dual ? W.cfg.dual.swing : 1) * (W.abuf.rage > 0 ? W.abuf.rageSwing : 1);
  p.hand = dual && !heavy && p.chain % 2 === 0 ? 1 : 0;     // два клинка: удары чередуют руки (1 — левая)
  const lunge = W.wp.trait.ranged ? 0 : P.attackLunge * (p.rollAtk ? 1.4 : 1) * (p.fin ? 1.2 : 1) * (heavy ? H.lunge : 1);     // стрелок не делает выпада
  if (heavy) W.ev.push({ k: 'heavy', x: p.x, z: p.z, face: p.face, power: heavy });
  p.vx += Math.sin(p.face) * lunge; p.vz += Math.cos(p.face) * lunge;
  W.ev.push({ k: 'swing', x: p.x, z: p.z, face: p.face, fin: p.fin });
}

// «Трещина» (земля): треснувший враг получает больше урона
const cracked = (W, e, dmg) => { if ((e.skinT > 0 || e.phaseT > 0) && e.skinMul) dmg = Math.max(1, Math.round(dmg * e.skinMul)); return e.st && e.st.crack ? Math.max(1, Math.round(dmg * (e.st.crack.k || W.cfg.elements.crack))) : dmg; };     // каменная кожа и «сквозь тьму» (этап 2 «круче») режут урон
// прямой урон без попадания оружием: реакции, молнии, раскаты, дальние эффекты
function dealDamage(W, e, dmg, fx) {
  if (e.dead) return;
  dmg = cracked(W, e, dmg);
  e.hp -= dmg; e.flash = .1; e.alert = true; addThreat(W, e, 0, dmg);
  W.ev.push({ k: 'hit', x: e.x, z: e.z, dmg, crit: false, id: e.id, fx });
  if (e.hp <= 0) killEnemy(W, e, 1);
}

// удар по врагу: урон, вампиризм, отбрасывание, прерывание замаха
function strike(W, e, dmg, o) {
  const p = W.player, P = W.cfg.player, C = W.cfg.enemies[e.type], gm = guardMul(W, e, C, o);
  if (gm < 1) { dmg = Math.max(1, Math.round(dmg * gm)); o = { ...o, knock: o.knock * .3 }; }      // щит: удар спереди почти не проходит
  if (C.guard && o.heavy) applyStatus(W, e, 'stun', 0, C.guard.breakStun);                          // тяжёлый удар ломает защиту
  dmg = cracked(W, e, dmg);
  e.hp -= dmg; e.flash = .12; p.calm = P.fire.calm; addThreat(W, e, 0, dmg); W.party.last = e.id;
  if (hasAff(e, 'mirror') && dmg > 0 && !p.dead) { const r = Math.max(1, Math.round(dmg * affOf(W, 'mirror').k)); p.hp -= r; W.ev.push({ k: 'mirror', x: p.x, z: p.z, dmg: r }); if (p.hp <= 0) { p.hp = 0; killPlayer(W); } }     // зеркальная элита возвращает часть удара (этап 2 «круче»)
  if (e.b && (o.heavy || o.ab)) e.b.kick = true;     // тяжёлый удар или умение сбивает чтение босса (этап 5)     // угроза героя (этап 4); последняя цель — для «моей цели»
  { const thirst = W.wp.mix && W.wp.mix.a === 'blood' && W.wp.mix.b === 'blood' ? W.cfg.stones.thirst[0] : 0, lch = (W.gear.leech + thirst + (W.abuf.blood > 0 ? W.abuf.bloodLeech : 0)) * (e.st && e.st.bleed && W.cfg.elements.react && isWet(W, e) ? W.cfg.elements.mix.tide : 1); if (lch > 0) p.hp = Math.min(p.maxhp, p.hp + dmg * lch / 100); }     // «Кровавый прилив»: мокрый и кровоточащий     // «Кровавый порыв» Торна добавляет вампиризм
  const heavy = C.heavy || hasAff(e, 'armored'), k = P.knockback * o.knock / (C.scale > 1.2 ? 2.2 : 1) * (heavy ? .5 : 1), n = o.d || 1;
  e.vx += o.dx / n * k; e.vz += o.dz / n * k;
  if (e.state === 'wind' && !heavy && gm >= 1) { e.state = 'chase'; e.t = 0; e.cd = .3; }       // удар прерывает замах (щит — нет)
  W.ev.push({ k: 'hit', x: e.x, z: e.z, dmg, crit: o.crit, fin: !!o.fin, id: e.id, fx: o.fx || null });
  if (!o.ab) { resGain(W, 'hit'); if (wearHit(W, p.hand === 1 ? 'offhand' : 'weapon')) refreshGear(W); }     // износ оружия (4.03)     // ресурс героя: удар оружием
  e.alert = true;
  if (e.hp <= 0) killEnemy(W, e, 1);
}

// шансы статусов от умения типа и свойств оружия
function weaponStatuses(W, e, dmg, crit, p) {
  const tr = W.wp.trait, pm = W.wp.pm, r = W.rng;
  if (e.dead) return;
  if (tr.stun && r() < tr.stun[0]) applyStatus(W, e, 'stun', 0, tr.stun[1]);
  if (tr.bleed && r() < tr.bleed[0]) applyStatus(W, e, 'bleed', tr.bleed[1], tr.bleed[2]);
  if (pm.bleed && r() < pm.bleed[0]) applyStatus(W, e, 'bleed', pm.bleed[1], pm.bleed[2]);
  if (pm.burn && r() < pm.burn[0] * rainK(W, 'fire')) applyStatus(W, e, 'burn', pm.burn[1], pm.burn[2]);
  if (pm.freeze && r() < pm.freeze[0]) applyStatus(W, e, 'freeze', 0, pm.freeze[1]);
  if (pm.poison && r() < pm.poison[0]) applyStatus(W, e, 'poison', pm.poison[1], pm.poison[2]);
  if (p.fin) applyStatus(W, e, 'stun', 0, .35);
  if (pm.shock && !e.dead && r() < pm.shock[0] * rainK(W, 'storm')) {
    const X = W.cfg.elements, sd = Math.round(dmg * pm.shock[1]);
    if (X.react) applyStatus(W, e, 'shock', sd, X.mark.shock);                 // разряд на цели: мокрый, отравленный, треснувший — реакция
    let best = null, bd = pm.shock[2];
    for (const o of W.enemies) { if (o.dead || o === e) continue; const d = len(o.x - e.x, o.z - e.z); if (d < bd) { bd = d; best = o; } }
    if (best) { W.ev.push({ k: 'chain', x: e.x, z: e.z, x2: best.x, z2: best.z }); dealDamage(W, best, sd, 'storm'); if (X.react && !best.dead) applyStatus(W, best, 'shock', sd, X.mark.shock); }
  }
  const G = W.gear, A = W.cfg.affix;
  if (A && !e.dead && (G.burnCh > 0 || G.poisonCh > 0 || G.bleedCh > 0 || G.shockCh > 0)) {     // случайные свойства вещи (3.99): шанс в %, урон — доля удара; генератор зовётся только при шансе
    const dps = Math.max(1, Math.round(dmg * A.dot));
    if (G.burnCh > 0 && r() < G.burnCh / 100 * rainK(W, 'fire')) applyStatus(W, e, 'burn', dps, A.dur);
    if (G.poisonCh > 0 && !e.dead && r() < G.poisonCh / 100) applyStatus(W, e, 'poison', dps, A.dur);
    if (G.bleedCh > 0 && !e.dead && r() < G.bleedCh / 100) applyStatus(W, e, 'bleed', dps, A.dur);
    if (G.shockCh > 0 && r() < G.shockCh / 100 * rainK(W, 'storm')) {     // молния: в ближнего соседа до 6 м, нет соседа — в саму цель
      const sd = Math.max(1, Math.round(dmg * A.shockK)); let best = null, bd = 6;
      for (const o of W.enemies) { if (o.dead || o === e) continue; const d = len(o.x - e.x, o.z - e.z); if (d < bd) { bd = d; best = o; } }
      if (best) W.ev.push({ k: 'chain', x: e.x, z: e.z, x2: best.x, z2: best.z }); const t = best || e; if (!t.dead) dealDamage(W, t, sd, 'storm');
    }
  }
  const mx = W.wp.mix;
  if (mx && !e.dead && (p.fin || p.heavy > 0 || r() < W.cfg.stones.chance[mx.rank - 1])) { mixHit(W, e, dmg, mx); if (W.wp.pm.sun) W.sunN = (W.sunN || 0) + 1; }     // сплав заряжает «Солнце»
}

// сплав камней в ударе (2026-10-18): стихия a, потом b — реакцию даёт таблица стихий; одинаковые — усиленная стихия
const near2 = (W, e, r) => W.enemies.filter(o => !o.dead && o !== e && len(o.x - e.x, o.z - e.z) < r + W.cfg.enemies[o.type].radius);
function putEl(W, e, el, dmg, k) {
  const S = W.cfg.stones, L = S.el[el], X = W.cfg.elements;
  if (el === 'fire') applyStatus(W, e, 'burn', L[0] * k, L[1]);
  else if (el === 'ice') applyStatus(W, e, 'freeze', 0, Math.min(3.5, L * k));
  else if (el === 'water') applyStatus(W, e, 'wet', 0, L);
  else if (el === 'venom') applyStatus(W, e, 'poison', L[0] * k, L[1]);
  else if (el === 'blood') applyStatus(W, e, 'bleed', L[0] * k, L[1]);
  else if (el === 'earth') applyStatus(W, e, 'crack', 0, L);
  else if (el === 'storm') {
    const sd = Math.max(1, Math.round(dmg * L[1] * k)); applyStatus(W, e, 'shock', sd, X.mark.shock);
    let best = null, bd = L[0]; for (const o of near2(W, e, L[0])) { const d = len(o.x - e.x, o.z - e.z); if (d < bd) { bd = d; best = o; } }
    if (best) { W.ev.push({ k: 'chain', x: e.x, z: e.z, x2: best.x, z2: best.z }); dealDamage(W, best, sd, 'storm'); if (!best.dead) applyStatus(W, best, 'shock', sd, X.mark.shock); }
  }
}
// умение оружия: сплав камней, а без камней — стихия вещи; без стихии — ничего
function skillStrike(W, e, dmg) { const mx = W.wp.mix || (W.wp.el ? { a: W.wp.el, b: null, rank: 1, amp: false } : null); if (mx) mixHit(W, e, dmg, mx); }
function mixHit(W, e, dmg, mx) {
  const S = W.cfg.stones, k = S.power[mx.rank - 1] * (mx.amp ? S.amp : 1), p = W.player;
  if (S.bonus && W.wp.mix === mx && !e.dead) dealDamage(W, e, Math.max(1, Math.round(dmg * S.bonus[mx.rank - 1] * (mx.amp ? S.amp : 1))), mx.a);     // камни в оружии: удар стихией — доля урона удара (только сплав из камней)
  if (mx.b === null) { putEl(W, e, mx.a, dmg, k); return; }
  if (mx.a !== mx.b) { putEl(W, e, mx.a, dmg, k); if (!e.dead) putEl(W, e, mx.b, dmg, k); return; }
  const el = mx.a; W.ev.push({ k: 'mix', el, x: e.x, z: e.z });
  if (el === 'fire') { putEl(W, e, 'fire', dmg, k); for (const o of near2(W, e, S.hellfire.r).slice(0, S.hellfire.n)) putEl(W, o, 'fire', dmg, k); }     // Пекло
  else if (el === 'ice') putEl(W, e, 'ice', dmg, k * S.permafrost.k);      // Вечная мерзлота: дольше; осколки — при смерти
  else if (el === 'water') { putEl(W, e, 'water', dmg, k); const d = len(e.x - p.x, e.z - p.z) || 1; e.vx += (e.x - p.x) / d * S.flow.knock; e.vz += (e.z - p.z) / d * S.flow.knock; cleansePlayer(W, ['burn', 'poison']); }     // Поток
  else if (el === 'storm') { let from = e; const done = new Set([e]); putEl(W, e, 'storm', dmg, k);     // Перегрузка: ещё прыжки
    for (let i = 0; i < S.overload; i++) { const o = near2(W, from, S.el.storm[0]).find(q => !done.has(q)); if (!o) break; done.add(o); W.ev.push({ k: 'chain', x: from.x, z: from.z, x2: o.x, z2: o.z }); dealDamage(W, o, Math.max(1, Math.round(dmg * S.el.storm[1] * k)), 'storm'); from = o; } }
  else if (el === 'earth') { applyStatus(W, e, 'crack', S.seismic.k, S.el.earth); if (!e.dead && p.heavy > 0) applyStatus(W, e, 'stun', 0, S.seismic.stun); }     // Сейсмика
  else putEl(W, e, el, dmg, k);                                             // Чума, Жажда — при смерти и в вампиризме
}
// сплав при смерти врага: Вечная мерзлота — осколки, Чума — яд перекидывается со всеми зарядами
function mixOnDeath(W, e) {
  const mx = W.wp.mix; if (!mx || mx.a !== mx.b || !e.st) return;
  const S = W.cfg.stones;
  if (mx.a === 'ice' && e.st.freeze) { const d = Math.round(S.permafrost.hp[1] + Math.min(e.maxhp * S.permafrost.hp[0], W.cfg.elements.hpCap)); W.ev.push({ k: 'react', name: 'Вечная мерзлота', key: 'ice+ice', x: e.x, z: e.z, r: S.permafrost.r }); for (const o of near2(W, e, S.permafrost.r)) dealDamage(W, o, d, 'frost'); }
  if (mx.a === 'venom' && e.st.poison) { const P = e.st.poison; W.ev.push({ k: 'react', name: 'Чума', key: 'venom+venom', x: e.x, z: e.z, r: S.plague.r }); for (const o of near2(W, e, S.plague.r)) for (let i = 0; i < P.n; i++) applyStatus(W, o, 'poison', P.dps, P.t + 1); }
}

// выстрел из лука или арбалета: своя стрела (friendly) с уроном, критом и свойствами оружия; заряд — дальше, быстрее, сильнее.
// Наводка: ближайший видимый враг в конусе перед героем
function shoot(W, mult = 1, echo = false) {
  const p = W.player, P = W.cfg.player, S = W.cfg.shoot, tr = W.wp.trait, pm = W.wp.pm, H = P.heavy, hk = echo ? 0 : p.heavy || 0;
  const range = tr.range * (1 + S.chargeRange * hk), speed = tr.speed * (1 + S.chargeSpeed * hk);
  let best = null, bd = range;
  for (const e of W.enemies) { if (e.dead) continue; const dx = e.x - p.x, dz = e.z - p.z, d = len(dx, dz); if (d < bd && Math.abs(angDiff(Math.atan2(dx, dz), p.face)) < S.assist * DEG && !lineBlocked(W.map, p.x, p.z, e.x, e.z)) { bd = d; best = e; } }
  if (best) p.face = Math.atan2(best.x - p.x, best.z - p.z);
  let m = mult * (1 + Math.min(.3, W.combo.n * .02)) * rageMul(W);
  if (p.fin && !echo) m *= tr.finisherMul || 1.5;
  if (hk) m *= 1 + (H.mul - 1) * hk;
  if (W.setFx.rage && p.hp < p.maxhp * .4) m *= 1 + W.setFx.rage;
  let dmg = Math.round((P.attackDamage + W.gear.dmg) * m * rr(W, .9, 1.15));
  const crit = W.rng() < .12 + W.gear.crit / 100 + critBonus(W);
  if (crit) dmg = Math.round(dmg * (tr.critMul || 1.7));
  const fx = pm.burn ? 'fire' : pm.freeze ? 'frost' : pm.poison ? 'venom' : pm.shock ? 'storm' : null, sx = Math.sin(p.face), sz = Math.cos(p.face);
  W.proj.push({ friendly: true, x: p.x + sx * S.spawn, z: p.z + sz * S.spawn, vx: sx * speed, vz: sz * speed, dmg, crit, fx, hk, fin: p.fin && !echo, knock: (tr.knock || 1) * (hk ? 1 + (H.knock - 1) * hk : 1), pierce: tr.pierce || 0, hit: [], life: range / speed, kind: tr.magic ? 'orb' : tr.bolt ? 'bolt' : 'arrow', splash: tr.splash ? [tr.splash[0] * (1 + .3 * hk), tr.splash[1]] : null });     // посох: вспышка у цели
  W.ev.push({ k: 'shoot', x: p.x, z: p.z, face: p.face, heavy: hk > 0, bolt: !!tr.bolt });
  if (!echo && pm.echo && W.rng() < pm.echo) W.echoQ.push({ t: .2, mult: .7 });
}
// стрела умения (Сойка): летит как из её лука (без лука — как из короткого), урон героя × mult; extra: pierce, poison [dps, t], kind
export function abilityArrow(W, ang, mult, extra = {}) {
  const p = W.player, S = W.cfg.shoot, tr = W.wp.trait.ranged ? W.wp.trait : TRAITS.bow, pm = W.wp.pm;
  let dmg = Math.round((W.cfg.player.attackDamage + W.gear.dmg) * mult * rageMul(W) * rr(W, .9, 1.15));
  const crit = W.rng() < .12 + W.gear.crit / 100 + critBonus(W); if (crit) dmg = Math.round(dmg * (tr.critMul || 1.7));
  const fx = pm.burn ? 'fire' : pm.freeze ? 'frost' : pm.poison ? 'venom' : pm.shock ? 'storm' : null, sx = Math.sin(ang), sz = Math.cos(ang);
  const sk = extra.speedK || 1, q = { friendly: true, x: p.x + sx * S.spawn, z: p.z + sz * S.spawn, vx: sx * tr.speed * sk, vz: sz * tr.speed * sk, dmg, crit, fx, hk: 0, fin: false, knock: tr.knock || 1, pierce: (tr.pierce || 0) + (extra.pierce || 0), hit: [], life: tr.range / (tr.speed * sk), kind: extra.kind || (tr.bolt ? 'bolt' : 'arrow'), poison: extra.poison, freeze: extra.freeze, burn: extra.burn, bleed: extra.bleed, blast: extra.blast, mixAll: !!extra.mixAll, eblast: extra.eblast, pulse: extra.pulse || null, detonate: extra.detonate || null, st: extra.st || null, el: extra.el || null };     // st — состояние снаряда нового умения древа, el — его стихия (цвет)
  W.proj.push(q); return q;
}
// стрелы героя: летят, бьют первых врагов на пути (арбалет — насквозь pierce врагов), гаснут о стену и по дальности
function updateArrows(W, dt) {
  const S = W.cfg.shoot;
  for (let i = W.proj.length - 1; i >= 0; i--) {
    const q = W.proj[i]; if (!q.friendly || q.ally) continue;     // стрелы спутников летят в squad3d.js
    q.life -= dt; q.x += q.vx * dt; q.z += q.vz * dt;
    if (q.pulse && (q.pulse.acc += dt) >= q.pulse.every) { const U = q.pulse; U.acc = 0; W.ev.push({ k: 'pulse', x: q.x, z: q.z, r: U.r });     // сфера стихии: пульс вокруг себя
      for (const o of W.enemies) if (!o.dead && len(o.x - q.x, o.z - q.z) < U.r + W.cfg.enemies[o.type].radius) { dealDamage(W, o, Math.max(1, Math.round(q.dmg * U.k)), q.fx); if (!o.dead) skillStrike(W, o, q.dmg * U.k); } }
    let end = q.life <= 0 || hitsWall(W.map, q.x, q.z) || lineBlocked(W.map, q.x - q.vx * dt, q.z - q.vz * dt, q.x, q.z);
    if (!end) for (const e of W.enemies) {
      if (e.dead || q.hit.includes(e.id) || len(e.x - q.x, e.z - q.z) > W.cfg.enemies[e.type].radius + S.hitR) continue;
      q.hit.push(e.id);
      strike(W, e, q.dmg, { crit: q.crit, dx: q.vx, dz: q.vz, d: len(q.vx, q.vz), knock: q.knock, fx: q.fx, fin: q.fin || q.hk > 0, heavy: q.hk > 0 });
      if (q.hk && !e.dead) applyStatus(W, e, 'stun', 0, W.cfg.player.heavy.stun * q.hk * S.stun);
      if (q.poison && !e.dead) applyStatus(W, e, 'poison', q.poison[0], q.poison[1]);          // ядовитая стрела умения
      if (q.freeze && !e.dead) applyStatus(W, e, 'freeze', 0, q.freeze);                           // ледяная стрела
      if (q.bleed && !e.dead) applyStatus(W, e, 'bleed', q.bleed[0], q.bleed[1]);                  // нож веера: кровотечение
      if (q.st && !e.dead) applyStatus(W, e, q.st[0], q.st[1], q.st[2]);     // снаряд нового умения древа
      if (q.detonate) { const D = q.detonate, z = (W.ezones || []).find(c => c.kind === 'cloud' && len(c.x - e.x, c.z - e.z) < c.r + 1); q.detonate = null;     // «Взрыв облака»: шар в облаке
        if (z) { W.ezones.splice(W.ezones.indexOf(z), 1); W.ev.push({ k: 'react', name: 'Взрыв облака', key: 'fire+venom', x: z.x, z: z.z, r: z.r });
          for (const o of W.enemies) if (!o.dead && len(o.x - z.x, o.z - z.z) < z.r + W.cfg.enemies[o.type].radius) { dealDamage(W, o, Math.max(1, Math.round(q.dmg * D.k)), 'fire'); if (!o.dead) applyStatus(W, o, 'burn', D.burn[0], D.burn[1]); } } }
      if (q.blast) { const B = q.blast; q.blast = null; W.ev.push({ k: 'firearrow', x: e.x, z: e.z, r: B.r });     // зажигательная: огонь вокруг цели
        for (const o of W.enemies) if (!o.dead && len(o.x - e.x, o.z - e.z) < B.r + W.cfg.enemies[o.type].radius) { if (o !== e) dealDamage(W, o, Math.max(1, Math.round(q.dmg * B.k)), 'fire'); if (!o.dead) applyStatus(W, o, 'burn', B.dps, B.t); } }
      if (q.splash) { const [r, k] = q.splash; q.splash = null; W.ev.push({ k: 'splash', x: e.x, z: e.z, r });     // вспышка сферы посоха задевает соседей
        for (const o of W.enemies) if (!o.dead && o !== e && len(o.x - e.x, o.z - e.z) < r + W.cfg.enemies[o.type].radius) dealDamage(W, o, Math.max(1, Math.round(q.dmg * k)), q.fx); }
      if (q.mixAll && !e.dead) skillStrike(W, e, q.dmg);                                         // стрела стихии: сплав наверняка
      if (q.eblast) { const B = q.eblast; q.eblast = null; W.ev.push({ k: 'eblast', x: e.x, z: e.z, r: B.r, el: W.wp.mix ? [W.wp.mix.a, W.wp.mix.b] : [W.wp.el] });
        for (const o of W.enemies) if (!o.dead && o !== e && len(o.x - e.x, o.z - e.z) < B.r + W.cfg.enemies[o.type].radius) { dealDamage(W, o, Math.max(1, Math.round(q.dmg * B.k)), q.fx); if (!o.dead) skillStrike(W, o, q.dmg * B.k); } }
      goldHit(W, e, q.crit); if (q.hit.length === 1) sunCount(W, e);
      weaponStatuses(W, e, q.dmg, q.crit, W.player);
      W.combo.n = Math.min(99, W.combo.n + 1); W.combo.t = 2.2;
      if (q.hit.length > q.pierce) { end = true; break; }
    }
    if (end) { W.ev.push({ k: 'projend', x: q.x, z: q.z, friendly: true }); W.proj.splice(i, 1); }
  }
}

// золото (G3b): крит лечит (Венец Полудня)
function goldHit(W, e, crit) { if (crit && W.gfx.critHeal && !W.player.dead) W.player.hp = Math.min(W.player.maxhp, W.player.hp + W.gfx.critHeal); }
// перк «Солнце»: каждый n-й удар (попавший замах или стрела) — вспышка вокруг цели: доля урона и оглушение; без рандома
function sunCount(W, at) {
  const S = W.wp.pm.sun; if (!S) return;
  if ((W.sunN = (W.sunN || 0) + 1) < S[0]) return; W.sunN = 0;
  sunFlash(W, at);
}
// солнечная вспышка (и по счёту ударов, и в конце умения золотого оружия)
export function sunFlash(W, at) {
  const S = W.wp.pm.sun; if (!S) return;
  const p = W.player, c = at || p, dmg = Math.round((W.cfg.player.attackDamage + W.gear.dmg) * S[2]);
  W.ev.push({ k: 'sun', x: c.x, z: c.z, r: S[1] });
  const mx = W.wp.mix, k = mx ? W.cfg.stones.power[mx.rank - 1] : 0;
  for (const o of W.enemies.slice()) if (!o.dead && len(o.x - c.x, o.z - c.z) < S[1] + W.cfg.enemies[o.type].radius) { dealDamage(W, o, dmg, 'fire'); if (!o.dead) applyStatus(W, o, 'stun', 0, S[3]); if (mx && !o.dead) { putEl(W, o, mx.a, dmg, k); if (mx.b && mx.b !== mx.a && !o.dead) putEl(W, o, mx.b, dmg, k); } }     // золото: вспышка несёт сплав
}
// второй клинок (Вейл): доля его урона (с заточкой) к каждому удару; щит и пустая рука — 0
function offDmg(W) {
  const id = W.inv.eq.offhand, it = id && BY_ID[id];
  if (!it || it.slot !== 'weapon' || !canOff(W.hero, it)) return 0;
  return it.stats.dmg * (1 + (W.inv.up.offhand || 0) * W.cfg.smith.bonus) * ilMul(it, W.inv.il && W.inv.il.offhand) * qOf(W.inv.af && W.inv.af.offhand) * W.cfg.dual.mul;
}
// ярость берсерка: множитель урона, пока действует (иначе ровно 1 — бой без умений не меняется)
const rageMul = W => (W.abuf.rage > 0 ? W.abuf.rageMul : 1);
// удар умением по врагу: урон героя (с оружием, вторым клинком, яростью и критом) × mult, отброс, оглушение
export function abilityHit(W, e, mult, o = {}) {
  const p = W.player, P = W.cfg.player, tr = W.wp.trait, dx = e.x - p.x, dz = e.z - p.z, d = len(dx, dz) || 1;
  let dmg = Math.round((P.attackDamage + W.gear.dmg + offDmg(W)) * mult * rageMul(W) * rr(W, .9, 1.15));
  const crit = (W.rng() < .12 + W.gear.crit / 100 + critBonus(W)) || !!o.forceCrit; if (crit) dmg = Math.round(dmg * (tr.critMul || 1.7));     // forceCrit — «Удар из тени»
  strike(W, e, dmg, { crit, dx, dz, d, knock: o.knock || 1, fx: o.fx || null, fin: true, heavy: !!o.heavy, ab: true });     // ab — удар умения: ресурса не даёт
  if (!e.dead && o.stun) applyStatus(W, e, 'stun', 0, o.stun);
  if (o.mix && !e.dead) skillStrike(W, e, dmg);                                // умение оружия: стихия наверняка
  W.combo.n = Math.min(99, W.combo.n + 1); W.combo.t = 2.2;
  return dmg;
}
function attackHit(W, mult = 1, echo = false) {
  const p = W.player, P = W.cfg.player, wp = W.wp, tr = wp.trait, pm = wp.pm, H = P.heavy, hk = echo ? 0 : p.heavy || 0;
  const half = ((tr.arc || P.attackArc) + W.gear.arc + H.arc * hk) * DEG / 2, reach = P.attackRange + W.gear.reach + H.reach * hk;
  const cb = 1 + Math.min(.3, W.combo.n * .02);                       // комбо: +2% урона за каждое попадание в серии, до +30%
  let hits = 0;
  for (const e of W.enemies.slice()) {
    if (e.dead) continue;
    const C = W.cfg.enemies[e.type], dx = e.x - p.x, dz = e.z - p.z, d = len(dx, dz);
    if (d > reach + C.radius) continue;
    if (Math.abs(angDiff(Math.atan2(dx, dz), p.face)) > half) continue;
    let m = mult * cb * rageMul(W);
    if (p.fin && !echo) m *= tr.finisherMul || 1.5;
    if (p.rollAtk && !echo) m *= 1.4;
    if (hk) m *= 1 + (H.mul - 1) * hk;
    if (p.riposteT > 0 && tr.riposte) m *= tr.riposte;
    if (W.setFx.rage && p.hp < p.maxhp * .4) m *= 1 + W.setFx.rage;
    if (tr.backstab && (!e.alert || Math.abs(angDiff(e.face, Math.atan2(-dx, -dz))) > 1.9)) m *= tr.backstab;
    if (pm.execute && e.hp < e.maxhp * pm.execute[0]) m *= pm.execute[1];
    if (pm.shatter && e.st && (e.st.freeze || e.st.stun)) m *= pm.shatter;
    if (W.gfx.dawn && W.t - p.lastRollEnd < W.gfx.dawn[0]) m *= 1 + W.gfx.dawn[1];          // Плащ Рассвета
    let dmg = Math.round((P.attackDamage + W.gear.dmg + offDmg(W)) * m * rr(W, .9, 1.15));
    const crit = W.rng() < .12 + W.gear.crit / 100 + critBonus(W);
    if (crit) dmg = Math.round(dmg * (tr.critMul || 1.7));
    const fx = pm.burn ? 'fire' : pm.freeze ? 'frost' : pm.poison ? 'venom' : pm.shock ? 'storm' : null;
    strike(W, e, dmg, { crit, dx, dz, d, knock: (tr.knock || 1) * (p.fin && !echo ? 1.6 : 1) * (hk ? 1 + (H.knock - 1) * hk : 1), fx, fin: (p.fin && !echo) || hk > 0, heavy: hk > 0, roll: p.rollAtk && !echo });
    if (hk && !e.dead) applyStatus(W, e, 'stun', 0, H.stun * hk);
    hits++;
    goldHit(W, e, crit);
    weaponStatuses(W, e, dmg, crit, p);
    if (crit && W.setFx.ignite && !e.dead && W.rng() < W.setFx.ignite) applyStatus(W, e, 'burn', 4, 4);
    if (tr.splash) for (const o of W.enemies) if (!o.dead && o !== e && len(o.x - e.x, o.z - e.z) < tr.splash[0]) dealDamage(W, o, Math.round(dmg * tr.splash[1]), null);
    if (crit && pm.thunder) { W.ev.push({ k: 'boom', x: e.x, z: e.z, r: pm.thunder[0] }); for (const o of W.enemies) if (!o.dead && o !== e && len(o.x - e.x, o.z - e.z) < pm.thunder[0]) dealDamage(W, o, Math.round(dmg * pm.thunder[1]), 'storm'); }
  }
  if (hits) {
    W.combo.n = Math.min(99, W.combo.n + hits); W.combo.t = 2.2;
    if (!echo) {
      W.freeze = W.cfg.fx.hitStop * (hk ? 1.6 : 1); W.shake = Math.max(W.shake, W.cfg.fx.shake * (p.fin ? 1.8 : 1) * (hk ? 1 + hk : 1));
      if (p.fin) W.ev.push({ k: 'finisher', x: p.x, z: p.z, face: p.face });
      if (tr.double) W.echoQ.push({ t: .22, mult: tr.double });
      if (pm.echo && W.rng() < pm.echo) W.echoQ.push({ t: .2, mult: .7 });
    }
    if (pm.bulwark) { W.bul.n = Math.min(pm.bulwark[1], W.bul.n + 1); W.bul.t = pm.bulwark[2]; W.bul.amt = pm.bulwark[0]; }
    if (!echo) sunCount(W);
  }
  return hits;
}

function updatePlayer(W, dt, input) {
  const p = W.player, P = W.cfg.player;
  if (p.dead) { p.deadT += dt; p.vx = p.vz = 0; return; }
  if (p.inv > 0) p.inv -= dt;
  if (p.rollCd > 0) p.rollCd -= dt;
  if (p.dodgeCd > 0) p.dodgeCd -= dt;
  if (p.riposteT > 0) p.riposteT -= dt;
  let mx = input.mx || 0, mz = input.mz || 0;
  const ml = len(mx, mz);
  if (ml > 1) { mx /= ml; mz /= ml; }
  const moving = ml > .08;

  // нажатие удара: attackPress — запомненное вводом (короткое касание между кадрами не теряется), attack — кнопка сейчас нажата.
  // Нажатие во время переката ждёт его конца: удар в рывке (rollAtk); нажатие до переката гаснет как обычно
  const H = P.heavy, held = !!input.attack, pressed = !!input.attackPress || (held && !p.atkHeld);
  p.atkHeld = held;
  if (pressed) { p.holdT = 0; p.atkBuf = H.buffer; } else if (held) p.holdT += dt;

  // перекат
  if (input.ability === 7) useWeaponSkill(W);                  // умение оружия: F
  else if (input.ability) useSlot(W, input.ability - 1);          // умения: ячейки панели 1–6 (древо, 2026-10-20)
  if (input.roll && p.state !== 'roll' && p.state !== 'dash' && p.rollCd <= 0) {
    const dl = moving ? ml : 0;
    p.rollDirX = moving ? mx / dl : Math.sin(p.face); p.rollDirZ = moving ? mz / dl : Math.cos(p.face);
    resGain(W, 'roll'); p.state = 'roll'; p.rollT = 0; p.rollCd = Math.max(.25, P.rollCooldown - W.gear.rollcd); p.inv = Math.max(p.inv, P.rollInvuln);
    p.face = Math.atan2(p.rollDirX, p.rollDirZ);
    W.ev.push({ k: 'roll', x: p.x, z: p.z });
    if (W.setFx.rollBlast) { W.ev.push({ k: 'boom', x: p.x, z: p.z, r: 3 }); for (const o of W.enemies) if (!o.dead && len(o.x - p.x, o.z - p.z) < 3) dealDamage(W, o, W.setFx.rollBlast, 'storm'); }
  }
  if (p.state === 'dash') {                                    // рывок умения: летит по прямой, бьёт всех на пути
    p.dashT += dt; p.vx = p.dashX * p.dashV; p.vz = p.dashZ * p.dashV; dashStep(W);
    if (p.dashT >= p.dashDur) { p.state = 'idle'; p.vx *= .2; p.vz *= .2; p.dashMix = false; p.dashThru = false; p.dashW = 0; p.dashSt = null; }
  } else if (p.state === 'roll') {
    if (pressed) p.rollPress = true;
    if (p.atkBuf > 0) p.atkBuf -= dt;
    p.rollT += dt;
    const k = 1.25 - .75 * (p.rollT / P.rollTime);
    p.vx = p.rollDirX * P.rollSpeed * k; p.vz = p.rollDirZ * P.rollSpeed * k;
    if (p.rollT >= P.rollTime) { p.state = 'idle'; p.lastRollEnd = W.t; if (p.rollPress) { p.rollPress = false; p.atkBuf = H.buffer; } }
  } else {
    // удар: нажатие — обычный (запоминается на buffer, если нажато во время удара: быстрые нажатия дают серию без пауз);
    // удержание дольше hold — после удара заряд; отпустил — тяжёлый удар (если зарядил хотя бы min)
    if (held && p.holdT >= H.hold && p.state !== 'atk' && p.state !== 'charge') { p.state = 'charge'; p.chargeT = 0; p.atkBuf = 0; W.ev.push({ k: 'charge', x: p.x, z: p.z }); }
    if (p.state === 'charge') {
      if (held) { const was = p.chargeT; p.chargeT += dt; if (was < H.full && p.chargeT >= H.full) W.ev.push({ k: 'chargeFull', x: p.x, z: p.z }); }
      else if (p.chargeT >= H.min) attackStart(W, Math.min(1, p.chargeT / H.full));
      else p.state = 'idle';
    }
    if (p.atkBuf > 0 && p.state !== 'atk' && p.state !== 'charge') {
      // запомненное нажатие бьёт, только если враг ещё рядом (иначе удар в пустоту после того, как враг отошёл); свежее — всегда
      p.atkBuf = 0;
      const reach = W.wp.trait.ranged ? W.wp.trait.range : P.attackRange + W.gear.reach + H.bufReach;     // лук: враг в пределах выстрела
      if (pressed || W.enemies.some(e => !e.dead && len(e.x - p.x, e.z - p.z) < reach)) attackStart(W);
    }
    if (p.atkBuf > 0) p.atkBuf -= dt;
    if (p.state === 'atk') {
      p.atkT += dt;
      if (!p.atkHit && p.atkT >= P.attackHitAt * p.swingMul) { p.atkHit = true; if (W.wp.trait.ranged) shoot(W); else attackHit(W); }
      if (p.atkT >= P.attackTime * p.swingMul) { p.state = 'idle'; p.lastAtkEnd = W.t; p.heavy = 0; }
    }
    // бег с разгоном; при ударе медленнее
    const wet = W.map.river && inStream(W.map.river, p.x, p.z);     // ручей (2026-10-18): медленнее, горение гаснет
    if (wet && W.pst.burn) { delete W.pst.burn; W.ev.push({ k: 'douse', x: p.x, z: p.z }); }
    const sp = P.speed * heroMul(W).speed * mountMul(W) * (1 + clamp(W.gear.spd, -30, W.cfg.gear.maxSpd) / 100) * (p.state === 'atk' ? P.attackSlow : p.state === 'charge' ? H.slow : 1) * (wet ? W.cfg.water.slow : 1) * (W.chillT > 0 ? W.cfg.elite.chill : 1);     // ледяная элита (этап 2 «круче»)
    const tx = moving ? mx * sp : 0, tz = moving ? mz * sp : 0;
    const a = P.accel * dt;
    const dvx = tx - p.vx, dvz = tz - p.vz, dl = len(dvx, dvz);
    if (dl <= a) { p.vx = tx; p.vz = tz; } else { p.vx += dvx / dl * a; p.vz += dvz / dl * a; }
    if (moving && p.state !== 'atk') p.face += clamp(angDiff(Math.atan2(mx, mz), p.face), -P.turnSpeed * dt, P.turnSpeed * dt);
    if (p.state === 'idle' && moving) p.state = 'run'; else if (p.state === 'run' && !moving) p.state = 'idle';
  }
  if (W.gear.regen > 0 && p.hp < p.maxhp) p.hp = Math.min(p.maxhp, p.hp + W.gear.regen * dt);
  if (p.calm > 0) p.calm -= dt;
  else if (onSurface(W) && len(p.x, p.z) < P.fire.radius && p.hp < p.maxhp) p.hp = Math.min(p.maxhp, p.hp + P.fire.perSec * dt);
  slide(W.map, p, p.vx * dt, p.vz * dt, P.radius);
  keepIn(W.map, p, W.cfg.world.radius);
  W.inside = insideOf(W.map, p.x, p.z);
}

// Г9: шаг к цели; рядом с целью другой враг впереди — обходит его сбоку (встают кольцом, а не в очередь), только при отряде
function approach(W, e, C, tx, tz, spd, dt) {
  const S = smartFoes(W), gx = tx - e.x, gz = tz - e.z, gd = len(gx, gz) || 1e-6; let ux = gx / gd, uz = gz / gd;
  if (S && S.ring && gd < 5 && W.allies.some(a => !a.dead && !a.guest)) for (const o of W.enemies) {     // только при отряде: в одиночку бой прежний
    if (o === e || o.dead || o.boss) continue; const ox = o.x - e.x, oz = o.z - e.z, od = len(ox, oz);
    if (od < S.ring + C.radius && ox * ux + oz * uz > .3 * od && len(o.x - tx, o.z - tz) < gd) { const sg = e.id & 1 ? 1 : -1, vx = ux * .45 + uz * sg, vz = uz * .45 - ux * sg, n = len(vx, vz); ux = vx / n; uz = vz / n; break; }
  }
  slide(W.map, e, ux * spd * dt, uz * spd * dt, C.radius);
}
// Г9: раненый стрелок или колдун один раз отходит от ближнего противника; true — кадр занят отходом
function retreat(W, e, C, spd, dt) {
  const S = smartFoes(W), R = S && S.retreat; if (!R || !C.ranged || e.boss) return false;
  if (!(e.retT > 0)) { if (e.retDone || e.hp > e.maxhp * R.below) return false; e.retDone = true; e.retT = R.t; }
  e.retT -= dt; const p = W.player; let n = p.dead ? null : p, nd = n ? len(p.x - e.x, p.z - e.z) : 1e9;
  for (const a of W.allies) { if (a.dead) continue; const d = len(a.x - e.x, a.z - e.z); if (d < nd) { nd = d; n = a; } }
  if (!n || nd > R.near * 2) { e.retT = 0; return false; }
  const ux = e.x - n.x, uz = e.z - n.z, u = len(ux, uz) || 1e-6; e.face = Math.atan2(-ux, -uz); slide(W.map, e, ux / u * spd * dt, uz / u * spd * dt, C.radius); return true;
}
function updateEnemies(W, dt) {
  const p = W.player, E = W.cfg.enemies;
  for (const e of W.enemies) {
    const C = E[e.type];
    if (e.flash > 0) e.flash -= dt;
    if (e.dead) { e.deadT += dt; continue; }
    if (!e.boss && W.lvl === SURFACE && len(p.x - e.x, p.z - e.z) > E.sleep.r) { e.sleep = true; continue; }     // далеко от героя — спит (C1)
    e.sleep = false;
    tickEnemy(W, e, dt); if (e.dead) continue;
    if (e.hasteT > 0) e.hasteT -= dt; if (e.skinT > 0) e.skinT -= dt; if (e.phaseT > 0) e.phaseT -= dt;     // приёмы врагов (этап 2 «круче»)
    if (e.elite && e.alert && (hasAff(e, 'blink') || hasAff(e, 'summoner'))) eliteTick(W, e, dt);
    const ws = W.map.river && W.map.river.streams && W.map.river.streams.length && inStream(W.map.river, e.x, e.z);     // враг в ручье: медленнее и мокрый
    if (ws && W.cfg.elements.react && !(e.st && e.st.wet && e.st.wet.t > 1)) applyStatus(W, e, 'wet', 0, W.cfg.elements.mark.wet);
    const dx = p.x - e.x, dz = p.z - e.z, d = len(dx, dz) || 1e-6, spd = C.speed * speedMul(e) * (e.spdMul || 1) * (e.hasteT > 0 ? e.haste || 1 : 1) * (ws ? W.cfg.water.slow : 1);
    slide(W.map, e, e.vx * dt, e.vz * dt, C.radius);
    const kd = Math.exp(-E.knockDecay * dt); e.vx *= kd; e.vz *= kd;
    if (e.boss) { updateBoss(W, e, dt, spd); continue; }
    if (isStunned(e)) { if (e.state !== 'chase') { e.state = 'chase'; e.t = 0; } e.cd = Math.max(e.cd, .3); continue; }        // оглушённый не двигается и не бьёт
    if (e.st && e.st.fear) { if (e.state !== 'chase') { e.state = 'chase'; e.t = 0; } e.cd = Math.max(e.cd, .3); e.face = Math.atan2(-dx, -dz); slide(W.map, e, -dx / d * spd * W.cfg.abilities.fearSpeed * dt, -dz / d * spd * W.cfg.abilities.fearSpeed * dt, C.radius); continue; }     // в страхе бежит от героя и не бьёт
    if (C.ai && (e.state === 'aim' || e.state === 'dash' || e.state === 'fuse' || e.state === 'mcast')) { foeAI(W, e, C, d, dx, dz, dt, true); continue; }    // прицел, рывок, фитиль
    if (e.state === 'chase') {
      const posted = e.mode === 'guard' || e.mode === 'patrol';      // сторож или патрульный: пока не заметил — своими делами
      if (!posted || e.alert) turnTo(e, C, Math.atan2(dx, dz), dt);
      const H = E.hear, noise = (p.state === 'atk' || p.state === 'roll' || p.state === 'charge' ? H.fight : p.state === 'run' ? H.run : H.idle) * (1 - clamp(W.gear.stealth, 0, 60) / 100) * (W.place && W.place.safe ? .5 : 1) * W.dif.hear * rainK(W, 'hear');
      const pe = placeAt(W.map, e.x, e.z), deep = pe && pe.safe && len(e.x - pe.x, e.z - pe.z) < pe.r - 4;    // в глубине безопасного места враги теряют след и не слышат
      if (deep) e.alert = false;
      const sheltered = !!W.map.camp && insideCamp(W.map.camp, p.x, p.z) && !insideCamp(W.map.camp, e.x, e.z);   // герой за частоколом: враг снаружи его теряет
      if (sheltered) e.alert = false;
      const hops = roomHops(W.map, e.x, e.z, p.x, p.z);           // в подземелье слышно только через немного комнат
      const shut = hops > 0 && !!W.map.adj && !pathStep(W.map, e.x, e.z, p.x, p.z);   // запертая дверь глушит: к герою не пройти — не тревожится и не толпится у двери
      if (shut) e.alert = false;
      if (e.duel) e.alert = true;     // противник поединка не теряет героя и в безопасном месте
      const wasAlert = e.alert, cool0 = e.lostT > 0; if (cool0) e.lostT -= dt;
      if (posted && !e.alert && !deep && !shut && !sheltered && !p.dead && spotted(W, e, d, dx, dz, H)) raiseAlarm(W, e);
      if (!e.alert && !posted && !deep && !shut && !sheltered && hops <= W.cfg.dungeons.hearRooms && d < noise * (W.inside >= 0 ? H.house : 1)) e.alert = true;
      else if (e.alert && d > H.lose) e.alert = false;
      if (posted && e.alert && len(e.x - e.home.x, e.z - e.home.z) > W.cfg.enemies.posts.leash) { e.alert = false; e.lostT = W.cfg.enemies.posts.cool; }       // далеко от поста — бросает погоню
      if (posted && wasAlert && !e.alert && !cool0) W.ev.push({ k: 'lost', x: e.x, z: e.z, id: e.id });
      if (posted && !e.alert) { keepPost(W, e, C, spd, dt); continue; }
      if (C.ai && foeAI(W, e, C, d, dx, dz, dt, hops === 0 && insideOf(W.map, e.x, e.z) === W.inside)) continue;   // особое поведение: щит, фитиль, рывок, тень
      if (e.alert && retreat(W, e, C, spd, dt)) continue;     // Г9: раненый стрелок отходит
      const al = threatPick(W, e, d, dt);                               // угроза (этап 4): бьёт опасного союзника; без угрозы — близкого
      if (al) {
        e.alert = true; e.tgt = al.id;
        const ax = al.x - e.x, az = al.z - e.z, ad = len(ax, az) || 1e-6; e.face = Math.atan2(ax, az);
        if (ad > C.range * .85) approach(W, e, C, al.x, al.z, spd, dt);     // Г9: встают вокруг, а не в кучу
        else { e.cd -= dt; if (e.cd <= 0) { e.state = 'wind'; e.t = 0; } }
        continue;
      }
      e.tgt = 0;
      if (!p.dead && !e.alert && d < H.lose && hops === 0 && !sheltered && !posted) {          // не услышал: бредёт к герою вполсилы (в подземелье — только в той же комнате)
        const gx = dx / d * spd * H.drift * dt, gz = dz / d * spd * H.drift * dt; slide(W.map, e, gx, gz, C.radius);
      }
      if (!p.dead && e.alert) {
        const g = goalOf(W, e, dt);                                   // к герою напрямик или к двери дома
        if (g !== p) { const gx = g.x - e.x, gz = g.z - e.z, gd = len(gx, gz) || 1e-6; e.face = Math.atan2(gx, gz); slide(W.map, e, gx / gd * spd * dt, gz / gd * spd * dt, C.radius); }
        else if (C.ranged) rangedMove(W, e, C, d, dx, dz, spd, dt);
        else if (d > C.range * .85) approach(W, e, C, p.x, p.z, spd, dt);
        else { e.cd -= dt; if (e.cd <= 0) { e.state = 'wind'; e.t = 0; } }
      }
    } else if (e.state === 'wind') {
      e.t += dt; turnTo(e, C, Math.atan2(dx, dz), dt);
      if (e.t >= C.wind) {
        e.state = 'rec'; e.t = 0;
        const ta = e.tgt && W.allies.find(a => a.id === e.tgt && !a.dead);
        if (ta && C.ranged && smartFoes(W)) rangedFire(W, e, C);     // Г9: стрелок бьёт спутника стрелой или порчей, а не «в упор»
        else if (ta) { if (len(ta.x - e.x, ta.z - e.z) <= C.range + .9) hurtAlly(W, ta, Math.round(C.damage * (e.dmgMul || 1) * auraMul(W, e)), e); }
        else if (C.ranged) { if (!p.dead) rangedFire(W, e, C); }
        else if (!p.dead && d <= C.range + P_RADIUS(W) + .35 && insideOf(W.map, e.x, e.z) === W.inside && !lineBlocked(W.map, e.x, e.z, p.x, p.z)) { const dm = Math.round(C.damage * (e.dmgMul || 1) * auraMul(W, e)); if (hurtPlayer(W, dm, e.x, e.z, e.onx || C.on, e)) eliteOnHit(W, e, dm); }
        W.ev.push({ k: 'strike', x: e.x, z: e.z, id: e.id });
      }
    } else if (e.state === 'rec') {
      e.t += dt;
      if (e.t >= C.recover) { e.state = 'chase'; e.t = 0; e.cd = rr(W, .15, .6); }
    }
  }
  // расталкивание: враги друг с другом и с героем
  const live = W.enemies.filter(e => !e.dead);
  for (let i = 0; i < live.length; i++) {
    const a = live[i], ra = E[a.type].radius;
    for (let j = i + 1; j < live.length; j++) {
      const b = live[j], rb = E[b.type].radius, m = ra + rb;
      let dx = b.x - a.x, dz = b.z - a.z, d = len(dx, dz);
      if (d < 1e-6) { const ang = (i * 7 + j) * 2.399; dx = Math.cos(ang) * 1e-6; dz = Math.sin(ang) * 1e-6; d = 1e-6; }   // стояли в одной точке
      if (d < m) { const k = (m - d) / 2 / d; a.x -= dx * k; a.z -= dz * k; b.x += dx * k; b.z += dz * k; }
    }
    if (!p.dead && !p.dashMix && !p.dashThru) {     // выпад умения оружия и рывок Бесогона (Г8) проходят сквозь врагов
      const dx = a.x - p.x, dz = a.z - p.z, d = len(dx, dz), m = ra + P_RADIUS(W);
      if (d < m && d > 1e-6) { const k = (m - d) / d; a.x += dx * k * .8; a.z += dz * k * .8; p.x -= dx * k * .2; p.z -= dz * k * .2; }
    }
  }
  for (const e of live) { resolve(W.map, e, E[e.type].radius); blockFoe(W.map, e, E[e.type].radius); }     // ворота лагеря для врагов закрыты
  resolve(W.map, p, W.cfg.player.radius);
  blockCart(W, p, W.cfg.player.radius);
  keepIn(W.map, p, W.cfg.world.radius);                         // расталкивание не выносит героя за границу
  W.enemies = W.enemies.filter(e => !(e.dead && e.deadT > .6));
  // держим нужное число врагов (кольцом вокруг героя — только на поверхности; в подземельях свои правила)
  if (!onSurface(W)) return;
  // бродячие, ушедшие дальше drop, забываются (место освобождается); живыми вокруг считаются только не спящие
  const keepFar = e => e.boss || e.evId || (e.mode && !e.pack && !e.garr);              // стайки и гарнизоны забываются, как бродячие
  if (W.enemies.some(e => !keepFar(e) && len(e.x - p.x, e.z - p.z) > E.sleep.drop)) {
    for (const e of W.enemies) if (e.garr && !e.dead && len(e.x - p.x, e.z - p.z) > E.sleep.drop) W.garr[e.garr] = 0;     // гарнизон не зачищен — заселится снова
    W.enemies = W.enemies.filter(e => keepFar(e) || len(e.x - p.x, e.z - p.z) <= E.sleep.drop);
  }
  if (roamOn(W)) garrisons(W, dt);
  const alive = W.enemies.filter(e => !e.dead && !e.boss && len(e.x - p.x, e.z - p.z) <= E.sleep.r).length;
  const bonus = W.place && W.place.danger ? Math.round(W.place.danger * E.dangerCount) : 0;
  const RM = roamOn(W) ? E.roam : null, want = E.count === 0 ? 0 : RM ? Math.max(1, (W.night ? RM.night : RM.day) + bonus + W.dif.count) : Math.max(1, E.count + bonus + W.dif.count + (W.night ? W.cfg.daynight.night.count : 0));     // спокойный мир: днём меньше, ночью больше
  if (alive < want && !p.dead) { W.spawnT -= dt; if (W.spawnT <= 0) { W.spawnT = spawnRing(W) === false ? .1 : RM ? RM.respawn : E.respawn; } }
  else W.spawnT = Math.max(W.spawnT, .6);
}
const P_RADIUS = W => W.cfg.player.radius;

// наполнить контейнер заново: глубина (расстояние от костра или глубина подземелья) и удача героя улучшают добычу
export function refillLevel(W, id) { withLevel(W, id, () => { for (const c of W.map.containers) refill(W, c); }); }     // 4.15: сундуки новой раскладки
function refill(W, c) {
  const def = CONTAINERS[c.kind], depth = Math.min(1, depthAt(W, c.x, c.z));     // добыча — не выше глубины 1 и в большом мире
  const pl = placeAt(W.map, c.x, c.z);
  const lvl0 = levelAt(W, c.x, c.z), G = W.cfg.loot;
  c.items = rollLoot(def, W.rng, depth, W.gear.luck, pl && pl.danger ? pl.danger * W.cfg.enemies.dangerLoot : 0, 1, G && G.on ? { lvl: lvl0, L: G } : null);
  { const g = chestGold(G, c.kind, lvl0, Math.round(c.x * 31 + c.z * 17), W.t | 0); if (g) c.items.push({ id: g, n: 1 }); }     // золото: 2–3% с сундука в сложных краях (свой хеш — бой не сдвигается)
  { const lv = Math.round(lvl0); for (const it of c.items) if (BY_ID[it.id].slot) it.il = ilRoll(W, lv, c.x * 7 + c.z); }     // уровень вещи — по месту (этап 0)
  c.ready = c.items.length > 0; c.t = 0;
  c.locked = !!def.locked; c.keyTier = def.locked ? (depth < .3 ? 1 : depth < .6 ? 2 : 3) : 0;
}

// положить в сумку; возвращает остаток
// сумка: базовые места + навык «Глубокие карманы»; bagCap — наибольшая возможная (для загрузки сохранения)
export const bagSlots = W => W.cfg.bag.slots + ((W.gear && W.gear.bag) || 0);
export const bagCap = cfg => cfg.bag.slots + SKILLS.pockets.max * SKILLS.pockets.stats.bag;
// уровень вещи: уровень места + 0…drop (без W.rng — бой не сдвигается)
// уровень добычи (4.20): от героя по месту и роду врага (cfg.lootIl); выключено — null (как раньше: от уровня места)
export function lootIl(W, e, salt) {
  const G = W.cfg.lootIl; if (!G || !G.on) return null;
  const L = W.levels && W.levels[W.lvl], d = L && L.def, src = d && d.raid ? 'raid' : d ? 'dungeon' : 'world', bd = e.boss && e.b && e.b.def;
  const tier = e.boss ? (src === 'raid' || !bd || bd.final || bd.castle || !bd.level ? 'boss' : 'mini') : e.elite || e.guard ? 'mini' : 'mob';
  let [a, b] = G[src][tier]; if (src === 'world' && W.lv <= G.low) { a = Math.max(0, a); b = Math.max(0, b); }
  const base = Math.min(W.lv, (e.lvl || W.lv) + G.over), k = a + Math.abs(Math.round(salt * 7919 + W.t * 13)) % (b - a + 1);
  return clamp(base + k, 1, G.cap);
}
const ilRoll = (W, lv, salt) => Math.max(1, Math.round(lv || 1) + Math.abs(Math.round(salt)) % (W.cfg.level.il.drop + 1));
function give(W, id, n) { const left = addItem(W.inv, id, n, bagSlots(W)); if (n - left > 0) { W.ev.push({ k: 'pickup', id, n: n - left }); W.known.items[id] = 1; } return left; }

// двери открываются сами, когда рядом кто-то есть; контейнеры отдают добычу при касании и позже наполняются снова
function updateHouses(W, dt) {
  const M = W.cfg.map, p = W.player, live = W.enemies.filter(e => !e.dead);
  for (const b of W.map.buildings) {
    const d = b.door, r = M.doorReach;
    // боец открывает дверь, только если ему нужно в этот дом или из него (там он сам или герой) — иначе обходит дом снаружи, а не забредает внутрь
    const inB = o => insideOf(W.map, o.x, o.z) === b.id, mine = inB(p);
    const near = (!p.dead && len(p.x - d.x, p.z - d.z) < r) || live.some(e => len(e.x - d.x, e.z - d.z) < r) || W.allies.some(a => !a.dead && len(a.x - d.x, a.z - d.z) < r && (mine || inB(a)));
    d.open = clamp(d.open + (near ? 1 : -1) * dt * 4, 0, 1);
  }
  for (const d of W.map.doors || []) {      // двери подземелий: так же открываются, когда рядом кто-то есть
    if (d.locked) {                            // заперта: отпирает герой с ключом на связке; без ключа — напоминание, какой нужен
      if (d.cd > 0) d.cd -= dt;
      d.open = Math.max(0, d.open - dt * 4);
      if (!p.dead && len(p.x - d.x, p.z - d.z) < M.doorReach) {
        if (W.keys[d.lock]) { d.locked = false; W.ev.push({ k: 'unlock', x: d.x, z: d.z, key: d.lock }); }
        else if (!(d.cd > 0)) { d.cd = 2.5; W.ev.push({ k: 'doorLocked', x: d.x, z: d.z, key: d.lock }); }
      }
      if (d.locked) continue;
    }
    const r = M.doorReach, near = (!p.dead && len(p.x - d.x, p.z - d.z) < r) || live.some(e => len(e.x - d.x, e.z - d.z) < r) || W.allies.some(a => !a.dead && len(a.x - d.x, a.z - d.z) < r);
    d.open = clamp(d.open + (near ? 1 : -1) * dt * 4, 0, 1);
  }
  { const nb = p.dead ? null : W.map.buildings.find(b => b.npc && len(p.x - b.npc.x, p.z - b.npc.z) < W.cfg.shop.reach), na = p.dead || nb ? null : storyActors(W).find(a => len(p.x - a.x, p.z - a.z) < W.cfg.shop.reach); W.nearActor = na || null;     // герои сюжета — как жители (этап 3)
    W.nearNpc = nb ? nb.npc.kind : na ? na.kind : nearWanderer(W) ? 'wanderer' : null; W.nearMerchant = W.nearNpc === 'merchant' || W.nearNpc === 'wanderer'; }
  if ((W.shop.t += dt) > W.cfg.shop.restock) restock(W);
  updateWanderer(W, dt);
  updateEvents(W, dt);
  questTick(W, dt);     // охота, следы, оборона, срок заданий (этап 5 «круче»)
  abyssTick(W, dt, () => travel(W, SURFACE, W.cfg.abyss.at.x + 2, W.cfg.abyss.at.z));     // «Бездна» (этап 6 «круче»)
  if (W.story) { storyTick(W, dt); const pl = placeAt(W.map, W.player.x, W.player.z); brandTick(W, dt, !!(pl && pl.safe) || (!!W.map.camp && insideCamp(W.map.camp, W.player.x, W.player.z))); }     // сюжет (этап 3); клеймо ночью (этап 7)
  if (W.tomb && (W.tomb.lvl || SURFACE) === W.lvl && !p.dead && len(p.x - W.tomb.x, p.z - W.tomb.z) < 1.6) { W.inv.ash += W.tomb.ash; W.ev.push({ k: 'tomb', ash: W.tomb.ash, x: W.tomb.x, z: W.tomb.z }); W.tomb = null; }
  W.nearPortal = portalNear(W);
  // контейнеры других уровней тоже наполняются со временем
  for (const L of Object.values(W.levels)) if (L.id !== W.lvl) for (const c of L.map.containers) if (!c.ready && !c.far && (c.t += dt) >= M.containerRespawn) withLevel(W, L.id, () => refill(W, c));
  for (const c of W.map.containers) {
    const def = CONTAINERS[c.kind];
    if (c.cd > 0) c.cd -= dt;
    if (!c.ready) { if (c.far && len(p.x - c.x, p.z - c.z) > 70) continue; c.t += dt; if (c.t >= M.containerRespawn) refill(W, c); continue; }     // дальний сундук ждёт героя
    if (p.dead || len(p.x - c.x, p.z - c.z) >= (def.reach || 1.3)) continue;
    if (c.locked) {
      // ключ подходит, если уровень не ниже замка; тратим самый слабый из подходящих
      let best = -1; W.inv.bag.forEach((s, i) => { const k = BY_ID[s.id].keyTier; if (k >= c.keyTier && (best < 0 || k < BY_ID[W.inv.bag[best].id].keyTier)) best = i; });
      if (best < 0) { if (!(c.cd > 0)) { c.cd = 2.5; W.ev.push({ k: 'locked', x: c.x, z: c.z, tier: c.keyTier }); } continue; }
      removeAt(W.inv, best, 1); c.locked = false; W.ev.push({ k: 'unlock', x: c.x, z: c.z });
    }
    if (c.key && !W.keys[c.key]) { W.keys[c.key] = true; W.ev.push({ k: 'key', key: c.key, x: c.x, z: c.z }); }    // ключ подземелья — на связку
    const rest = [];
    for (const it of c.items) { const left = it.il ? (roomFor(W.inv, it.id, bagSlots(W)) ? (W.inv.bag.push(entryOf(it.id, 0, it.g || gemsFor(W, it.id, socketsOf(BY_ID[it.id], W.cfg)), it.il, it.af || affixFor(W, it.id, it.il))), W.ev.push({ k: 'pickup', id: it.id, n: 1, af: true }), W.known.items[it.id] = 1, 0) : 1) : give(W, it.id, it.n); if (left > 0) rest.push({ id: it.id, n: left, ...(it.il ? { il: it.il } : {}) }); }     // вещь с уровнем — отдельной записью
    c.items = rest; W.known.kinds[c.kind] = 1; questEvent(W, 'open', { kind: c.kind }); W.ev.push({ k: 'open', kind: c.kind, x: c.x, z: c.z });
    if (rest.length) { if (!(c.cd > 0)) { c.cd = 2.5; W.ev.push({ k: 'full', x: c.x, z: c.z }); } }
    else { c.ready = false; c.t = 0; }
  }
  // вещи на земле: подбираем вблизи (с «притягиванием»), по таймеру исчезают
  for (let i = W.drops.length - 1; i >= 0; i--) {
    const q = W.drops[i]; q.t += dt;
    const d = len(p.x - q.x, p.z - q.z);
    if (!p.dead && d < W.cfg.gear.pickup * 2.2) { const k = Math.min(1, dt * 8); q.x += (p.x - q.x) * k * .5; q.z += (p.z - q.z) * k * .5; }
    if (!p.dead && d < W.cfg.gear.pickup * .8 && (q.up || q.g || q.il)) { if (roomFor(W.inv, q.id, bagSlots(W))) { W.inv.bag.push(entryOf(q.id, q.up, q.g || (q.up || q.af || q.mine ? null : gemsFor(W, q.id, socketsOf(BY_ID[q.id], W.cfg))), q.il, q.af || (q.up || q.g || q.mine ? null : affixFor(W, q.id, q.il)))); W.known.items[q.id] = 1; W.ev.push({ k: 'pickup', id: q.id, n: 1 }); W.drops.splice(i, 1); continue; } if (!(q.cd > 0)) { q.cd = 2; W.ev.push({ k: 'full', x: q.x, z: q.z }); } }     // вещь с заточкой или камнями — целиком     // свойства — у новой вещи с земли (этап 4 «круче»)
    else if (!p.dead && d < W.cfg.gear.pickup * .8) { const left = give(W, q.id, q.n); if (left < q.n) { q.n = left; if (!left) { W.drops.splice(i, 1); continue; } } else if (!(q.cd > 0)) { q.cd = 2; W.ev.push({ k: 'full', x: q.x, z: q.z }); } }
    if (q.cd > 0) q.cd -= dt;
    if (q.t > W.cfg.gear.dropLife) W.drops.splice(i, 1);
  }
}

// использовать вещь из сумки (еда, зелья, мешочки пепла); возвращает true, если вещь потрачена
export function useItem(W, idx) {
  const s = W.inv.bag[idx], it = s && BY_ID[s.id]; if (!it || !it.use || W.player.dead) return false;
  const p = W.player, u = it.use;
  if (u.recall) {          // свиток возврата: в лагерь, откуда угодно
    travel(W, SURFACE, 0, 4);
    W.ev.push({ k: 'recall', x: p.x, z: p.z }); removeAt(W.inv, idx, 1); return true;
  }
  if (u.repair) { if (!repairKit(W, W.cfg.dur.kit)) return false; refreshGear(W); removeAt(W.inv, idx, 1); return true; }     // ремкомплект (4.03)
  if (u.cleanse) { if (!cleansePlayer(W, u.cleanse) && !u.heal && !u.buff) return false; W.ev.push({ k: 'cleanse', x: p.x, z: p.z }); }
  if (u.heal) { const h = Math.min(u.heal, p.maxhp - p.hp); if (h <= 0 && !u.buff && !u.ash) return false; p.hp += Math.max(0, h); if (h > 0) W.ev.push({ k: 'heal', x: p.x, z: p.z, n: Math.round(h) }); }
  if (u.ash) { const n = Math.round(u.ash[0] + W.rng() * (u.ash[1] - u.ash[0])); W.inv.ash += n; W.ev.push({ k: 'ash', x: p.x, z: p.z, n }); }
  if (u.buff) { const ex = W.buffs.find(b => b.stat === u.buff.stat && b.src === it.id); if (ex) ex.t = u.buff.t; else W.buffs.push({ stat: u.buff.stat, amt: u.buff.amt, t: u.buff.t, src: it.id }); W.ev.push({ k: 'buff', x: p.x, z: p.z, stat: u.buff.stat }); }
  removeAt(W.inv, idx, 1); return true;
}
// надеть лучшее (этап 4 «круче»): в каждый слот (кроме второй руки) — вещь из сумки с лучшей оценкой, если она лучше надетой
export function equipBest(W) {
  const B = W.cfg.smith.bonus, inv = W.inv; let n = 0;
  for (const slot of ['weapon', 'head', 'body', 'cloak', 'boots', 'ring', 'amulet']) {
    let bi = -1, bs = inv.eq[slot] ? scoreUp(BY_ID[inv.eq[slot]], inv.up[slot] || 0, B, inv.il && inv.il[slot], inv.af && inv.af[slot]) + .5 : -1e9;
    inv.bag.forEach((s, i) => { const it = BY_ID[s.id]; if (!it || it.slot !== slot || !canWield(W.hero, it)) return; const sc = scoreUp(it, s.up || 0, B, s.il, s.af); if (sc > bs) { bs = sc; bi = i; } });
    if (bi >= 0 && equipAt(inv, bi, W.hero)) n++;
  }
  if (n) refreshGear(W); return n;
}
export function dropItem(W, idx, n = 1) {
  const s = W.inv.bag[idx]; if (!s) return false;
  const q = Math.min(n, s.n), p = W.player;
  const dq = { id: s.id, n: q, x: p.x + Math.sin(p.face) * 1.6, z: p.z + Math.cos(p.face) * 1.6, t: W.cfg.gear.dropLife - 12, cd: 0 };   // брошенное лежит недолго
  if (!isPlain(s) || s.il) { dq.n = 1; if (s.up) dq.up = s.up; if (s.g) dq.g = s.g.slice(); if (s.il) dq.il = s.il; if (s.af) dq.af = { ...s.af }; }     // заточка, камни, уровень и свойства остаются при вещи
  dq.mine = true;     // брошенное героем: при подборе новых свойств не получает (иначе перебор)
  W.drops.push(dq);
  removeAt(W.inv, idx, q); return true;
}

// Куда идти врагу: если герой в доме, а враг снаружи (или наоборот) — через дверь; иначе прямо к герою
function goalOf(W, e, dt = 1 / 60) {
  const p = W.player;
  if (W.map.adj) return pathStep(W.map, e.x, e.z, p.x, p.z) || p;     // подземелье: через проходы по графу комнат
  const be = insideOf(W.map, e.x, e.z);
  if (be === W.inside) return pathGoal(W.map, e, p.x, p.z, dt) || p;     // за рекой или обрывом — по пути (A*)
  const near = (a, b) => len(a.x - b.x, a.z - b.z) < 2.4;
  if (be >= 0) { const dr = W.map.buildings[be].door; return near(e, dr.in) ? dr.out : dr.in; }      // враг в доме: выйти
  const dr = W.map.buildings[W.inside].door; return near(e, dr.out) ? dr.in : dr.out;               // герой в доме: войти
}

// input: { mx, mz (−1..1), attack (держится), roll (нажатие) }
// пересчёт характеристик от надетого и баффов (вызывается каждый шаг и при смене экипировки в сумке)
// смена героя (2026-10-18): у каждого героя свой уровень, опыт, очки, навыки и панель умений (W.heroes — отложенные);
// новый герой — с 1-го уровня; общее — сумка, пепел, камни, костры, отряд;
// чужое оружие и вторая рука уходят в сумку (даже сверх размера), в руку — лучшее своё из сумки или стартовое оружие героя
export function switchHero(W, id) {
  const H = HEROES[id]; if (!H || !H.open || id === W.hero) return false;
  W.heroes = W.heroes || {}; W.heroes[W.hero] = { lv: W.lv, xp: W.xp, sp: W.sp, skills: W.skills, ap: W.ap, ab: W.ab, bar: W.bar };
  const nx = W.heroes[id] || { lv: 1, xp: 0, sp: 0, skills: {}, ap: abilityPointsAt(1, W.cfg), ab: {}, bar: [] }; delete W.heroes[id];
  W.hero = id; Object.assign(W, { lv: nx.lv, xp: nx.xp, sp: nx.sp, skills: nx.skills, ap: nx.ap, ab: nx.ab, bar: nx.bar }); W.acd = {}; W.abuf = {}; W.traps = []; W.zones = []; W.ezones = []; W.wsk = null; W.meteors = [];
  W.allies = W.allies.filter(a => !a.decoy);
  for (const a of W.allies.filter(a => (W.cfg.squad.types[a.type] || {}).hero === id)) { const T = W.cfg.squad.types[a.type]; W.inv.ash += T.cost; W.allies.splice(W.allies.indexOf(a), 1); W.ev.push({ k: 'allyleft', name: T.name, ash: T.cost }); }     // спутник-герой стал героем: уходит из отряда, найм возвращается
  const inv = W.inv, back = slot => { inv.bag.unshift(entryOf(inv.eq[slot], inv.up[slot], inv.gem[slot], inv.il && inv.il[slot], inv.af && inv.af[slot])); inv.eq[slot] = null; delete inv.up[slot]; delete inv.gem[slot]; if (inv.af) delete inv.af[slot]; if (inv.il) delete inv.il[slot]; };
  if (inv.eq.weapon && !canWield(id, BY_ID[inv.eq.weapon])) back('weapon');
  if (inv.eq.offhand && !canOff(id, BY_ID[inv.eq.offhand])) back('offhand');
  for (const sl of ['head', 'body', 'cloak', 'boots']) if (inv.eq[sl] && !canWield(id, BY_ID[inv.eq[sl]])) back(sl);     // тяжёлая броня — в сумку (Ирге только лёгкая)
  if (!inv.eq.weapon) {
    let bi = -1, bd = -1; inv.bag.forEach((s, i) => { const it = BY_ID[s.id]; if (it.slot !== 'weapon' || !canWield(id, it)) return; const v = it.stats.dmg * (1 + (s.up || 0) * W.cfg.smith.bonus) * ilMul(it, s.il) * qOf(s.af); if (v > bd) { bd = v; bi = i; } });
    if (bi >= 0) equipAt(inv, bi, id); else if (H.start) inv.eq.weapon = H.start;
  }
  refreshGear(W); W.player.hp = Math.min(W.player.hp, W.player.maxhp);
  W.ev.push({ k: 'heroSwitch', id });
  return true;
}
// множители героя (config3d.js → heroes); неизвестный герой — Торн
export const heroMul = W => W.cfg.heroes[W.hero] || W.cfg.heroes[DEFAULT_HERO];
export function refreshGear(W) {
  const L = W.cfg.level, base = skillStats(W.skills), wid = W.inv.eq.weapon;
  W.wp = weaponCtx(wid ? BY_ID[wid] : null, W.inv.gem && W.inv.gem.weapon);
  base.hp = (base.hp || 0) + (W.lv - 1) * L.hpPer; base.dmg = (base.dmg || 0) + (W.lv - 1) * L.dmgPer + W.reap.n * W.reap.amt; base.armor = (base.armor || 0) + W.bul.n * W.bul.amt;
  base.luck = (base.luck || 0) + W.dif.luck + (W.night ? W.cfg.daynight.night.luck : 0);
  const HM = heroMul(W); if (HM.crit) base.crit = (base.crit || 0) + HM.crit;
  const AG = armorGems(W.inv, W.cfg); for (const k of Object.keys(AG.stats)) base[k] = (base[k] || 0) + AG.stats[k];     // камни в броне (2026-10-18)
  W.gear = gearStats(W.inv, W.buffs, W.cfg.smith.bonus, base); W.gear.res = AG.res; W.setFx = setBonus(W.inv).fx;
  { const TM = talentMods(W.skills || {}); for (const [k, v] of Object.entries(TM.fx)) W.setFx[k] = (W.setFx[k] || 0) + v; W.talAb = TM.ab; W.talRes = TM.res; }     // таланты (этап 2): особые эффекты, усиления умений, ресурс
  W.gfx = {}; for (const id of Object.values(W.inv.eq)) { const g = id && BY_ID[id] && BY_ID[id].gold; if (g) Object.assign(W.gfx, g); }     // механики золотых вещей (G3b)
  const PR = W.cfg.level.ranks && W.cfg.level.ranks.on ? (W.prank || 0) * W.cfg.level.ranks.per : 0; if (PR) W.gear.dmg *= 1 + PR;     // пепельные ранги (этап 3 «круче»)
  const p = W.player; p.maxhp = Math.max(10, (W.cfg.player.hp * HM.hp + W.gear.hp) * (1 + PR)); if (p.hp > p.maxhp) p.hp = p.maxhp;
}

export function step(W, dt, input = {}) {
  if (!(dt > 0)) return;                                          // нулевой или отрицательный шаг (первый кадр rAF) ничего не двигает
  W.t += dt; const ev0 = W.ev.length;
  { const D = W.cfg.daynight, n = isNight(W.t, D); W.light = lightOf(W.t, D); if (n !== W.night) { W.night = n; W.ev.push({ k: n ? 'dusk' : 'dawn' }); } }
  if (W.storyDark) W.light = Math.min(W.light, .06);     // Затмение (этап 7): солнце чернеет
  for (let i = W.buffs.length - 1; i >= 0; i--) { W.buffs[i].t -= dt; if (W.buffs[i].t <= 0) W.buffs.splice(i, 1); }
  for (const k of ['reap', 'bul']) { const o = W[k]; if (o.n && (o.t -= dt) <= 0) { o.n = 0; o.t = 0; } }
  if (W.combo.n && (W.combo.t -= dt) <= 0) W.combo.n = 0;
  { const C = W.cfg.weather; if (C && C.on && C.combat) {                       // дождь (шаг R): сила по расписанию погоды, начало и конец — событием
    W.wsched = W.wsched || makeWeather(W.cfg.world.seed, C); W.rain = C.force ? (C.force === 'rain' ? 1 : 0) : weatherAt(W.wsched, W.t, C).rain;
    if (!W.rainOn && W.rain > .5) { W.rainOn = true; W.ev.push({ k: 'rainStart' }); } else if (W.rainOn && W.rain < .3) { W.rainOn = false; W.ev.push({ k: 'rainStop' }); }
  } else W.rain = 0; }
  refreshGear(W);
  { const g = W.gfx, p = W.player;                                             // золото: щит кирасы заряжается, знак лечит вне боя
    if (g.aegis) { if (!(W.aegis > 0) && (W.aegisT = (W.aegisT ?? 0) - dt) <= 0) { W.aegis = g.aegis[1]; W.ev.push({ k: 'aegisUp', x: p.x, z: p.z }); } } else W.aegis = 0;
    if (g.sunheal && !p.dead && p.hp < p.maxhp && W.t - (p.lastHurt ?? -1e9) > g.sunheal[0]) p.hp = Math.min(p.maxhp, p.hp + p.maxhp * g.sunheal[1] * dt); }
  if (W.chillT > 0) W.chillT -= dt;
  if (W.freeze > 0) { W.freeze -= dt; if (W.ev.length > 200) W.ev.splice(0, W.ev.length - 200); return; }
  W.aimPt = input.aimPt && Number.isFinite(input.aimPt.x) ? input.aimPt : null;     // прицел курсором (компьютер); без него — как раньше
  mountInput(W, input);     // удар, перекат, умение верхом — спешиться (этап 6)
  updatePlayer(W, dt, input);
  tickPlayer(W, dt);
  tickAbilities(W, dt);
  tickWeaponSkill(W, dt);
  tickZones(W, dt, (o, k, d, t) => applyStatus(W, o, k, d, t));     // области реакций стихий
  for (let i = W.echoQ.length - 1; i >= 0; i--) { const q = W.echoQ[i]; if ((q.t -= dt) <= 0) { W.echoQ.splice(i, 1); if (!W.player.dead) { if (W.wp.trait.ranged) shoot(W, q.mult, true); else attackHit(W, q.mult, true); } } }
  trackPlace(W, dt);
  touchShrine(W);
  discoverFires(W);
  updateEnemies(W, dt);
  foeSupport(W, dt);
  updateAllies(W, dt);
  updateArrows(W, dt);
  updateFoes(W, dt);
  tickBossZones(W, dt);
  updateHouses(W, dt);
  for (const def of W.cfg.bosses.list) { if (def.level && !W.levels[def.level]) continue; const t = W.bossDead[def.type]; if (t !== undefined && (W.bossDead[def.type] = t - dt) <= 0) withLevel(W, def.level || SURFACE, () => spawnBoss(W, def)); }     // боссы живут на своём уровне, даже если герой на другом
  { let hb = null; for (const e of W.enemies) if ((e.boss || e.duel) && !e.dead && (e.alert || e.duel) && len(e.x - W.player.x, e.z - W.player.z) < 55) { hb = { name: W.cfg.enemies[e.type].name, frac: e.hp / e.maxhp, enraged: !!(e.b && e.b.enraged), id: e.id, shield: !!(e.b && e.b.shield), cast: e.b && e.b.state === 'wind' && e.b.atk && e.b.atk.kind === 'cast' ? { name: e.b.atk.name, k: e.b.atk.t / e.b.atk.wind } : null }; if (e.duel) break; } W.hudBoss = hb; }     // противник поединка — тоже с полосой     // этап 5: щит и чтение на полосе босса
  if (W.shake > 0) W.shake = Math.max(0, W.shake - dt * 1.4);
  if (W.life) { repEvents(W, ev0); discoverCoaches(W); }
  achEvents(W); achTick(W, dt);     // достижения (этап 6 «круче»)     // репутация по событиям шага, повозки рядом (этап 6)
  if (W.ev.length > 200) W.ev.splice(0, W.ev.length - 200);     // события забирает рендер; потолок защищает, если никто не забирает
}

export function respawnPlayer(W) {
  const P = W.cfg.player, p = W.player;
  backToSurface(W);
  Object.assign(p, { x: 0, z: 4, vx: 0, vz: 0, face: Math.PI, hp: p.maxhp || P.hp, state: 'idle', atkT: 0, rollT: 0, rollCd: 0, inv: 1.2, dead: false, deadT: 0, atkBuf: 0, chargeT: 0, heavy: 0 });
  W.enemies = W.enemies.filter(e => e.boss && !e.dead); W.proj.length = 0; W.haz.length = 0; W.spawnT = 1.2; W.pst = {}; W.echoQ.length = 0; W.combo.n = 0;
}

// публичный API прежний: модули вынесены, но всё доступно из sim.js
export * from './squad3d.js';
export * from './places3d.js';
export * from './progress3d.js';
export * from './economy3d.js';
export * from './levels3d.js';
