// Логика 3D-прототипа без графики: игрок, враги, бой. Координаты (x, z) на плоскости, y — вверх (только в рендере).
// Угол «face»: вперёд = (sin θ, cos θ). Мир создаётся фабрикой, чтобы тестироваться в Node.

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
export const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const len = (x, z) => Math.hypot(x, z);

export function mulberry32(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

import { BY_ID } from './data/items.js';
import { CONTAINERS, SHOP, SHOP_STAPLES, rollLoot, rollDrop } from './data/loot.js';
import { skillStats, canRank, SKILLS, MAX_RANKS } from './data/skills3d.js';
import { createInv, addItem, removeAt, gearStats } from './inv.js';
import { makeMap, insideOf, nearBuilding, resolve, slide, regionOf, placeAt } from './map.js';

export function createWorld(cfg, rng = Math.random) {
  const W = makeWorld(cfg, rng);
  const cell = cfg.map.cell, n = Math.ceil(2 * cfg.world.radius / cell) + 2; W.seenN = n; W.seen = new Uint8Array(n * n);
  for (const c of W.map.containers) refill(W, c);
  restock(W);
  return W;
}
function makeWorld(cfg, rng) {
  const P = cfg.player;
  return {
    cfg, rng, map: makeMap(cfg), inside: -1, place: null, seen: null, revealT: 0, lv: 1, xp: 0, sp: 0, skills: {}, shop: { stock: [], t: 0 }, nearMerchant: false, nearNpc: null, inv: createInv(), buffs: [], drops: [], gear: gearStats(createInv()), dropId: 1, t: 0, kills: 0, eid: 1, spawnT: 1, freeze: 0, shake: 0, ev: [],
    player: { x: 0, z: 4, vx: 0, vz: 0, face: Math.PI, hp: P.hp, maxhp: P.hp, state: 'idle', atkT: 0, atkHit: false, rollT: 0, rollDirX: 0, rollDirZ: 1, rollCd: 0, inv: 0, dead: false, deadT: 0, dodgeCd: 0 },
    enemies: []
  };
}

const rr = (W, a, b) => a + W.rng() * (b - a);

export function spawnEnemy(W, type, x, z) {
  const C = W.cfg.enemies[type], E = W.cfg.enemies, depth = clamp(len(x, z) / W.cfg.world.radius, 0, 1), pl = placeAt(W.map, x, z), danger = pl && pl.danger || 0, hp = Math.round(C.hp * (1 + E.depthHp * depth) * (1 + E.dangerHp * danger));
  const e = { id: W.eid++, type, x, z, vx: 0, vz: 0, hp, maxhp: hp, dmgMul: 1 + E.depthDmg * depth + E.dangerDmg * danger, danger, face: 0, state: 'chase', t: 0, cd: rr(W, .2, .9), flash: 0, dead: false, deadT: 0, hitMe: false };
  W.enemies.push(e);
  return e;
}

function spawnRing(W) {
  const [lo, hi] = W.cfg.enemies.ring, p = W.player;
  const a = rr(W, 0, TAU), d = rr(W, lo, hi), R = W.cfg.world.radius - 2;
  let x = p.x + Math.sin(a) * d, z = p.z + Math.cos(a) * d;
  const l = len(x, z); if (l > R) { x *= R / l; z *= R / l; }
  if (nearBuilding(W.map, x, z, 1.5)) return false;                 // не рождаем врагов в стенах
  { const pl = placeAt(W.map, x, z); if (pl && pl.safe) return false; }   // и в безопасных местах
  const reg = W.cfg.enemies.regions[regionOf(W.map, x, z)];
  const type = reg ? pickW2(reg, W.rng) : W.rng() < W.cfg.enemies.brutePart ? 'brute' : 'imp';
  spawnEnemy(W, type, x, z);
}
function pickW2(table, rng) { let t = 0; for (const a of table) t += a[1]; let r = rng() * t; for (const a of table) { r -= a[1]; if (r <= 0) return a[0]; } return table[0][0]; }

export const aliveEnemies = W => W.enemies.filter(e => !e.dead);

function hurtPlayer(W, dmg, fromX, fromZ) {
  const p = W.player;
  if (p.dead) return false;
  if (p.state === 'roll' || p.inv > 0) {
    if (p.state === 'roll' && p.dodgeCd <= 0) { p.dodgeCd = .3; W.ev.push({ k: 'dodge', x: p.x, z: p.z }); }
    return false;
  }
  dmg = Math.max(1, Math.round(dmg / (1 + Math.max(0, W.gear.armor) * W.cfg.gear.armorK)));
  p.calm = W.cfg.player.fire.calm;
  p.hp -= dmg; p.inv = W.cfg.player.hurtInvuln; W.shake = Math.max(W.shake, W.cfg.fx.shake * 1.4);
  const d = len(p.x - fromX, p.z - fromZ) || 1;
  p.vx += (p.x - fromX) / d * 5; p.vz += (p.z - fromZ) / d * 5;
  W.ev.push({ k: 'hurt', x: p.x, z: p.z, dmg });
  if (p.hp <= 0) { p.hp = 0; p.dead = true; p.state = 'dead'; p.deadT = 0; W.ev.push({ k: 'playerDead', x: p.x, z: p.z }); }
  return true;
}

function dropLoot(W, e) {
  const depth = clamp(len(e.x, e.z) / W.cfg.world.radius + .1 * (e.danger || 0), 0, 1);
  for (const it of rollDrop(e.type, W.rng, depth, W.gear.luck)) {
    const a = W.rng() * TAU;
    W.drops.push({ id: it.id, n: it.n, x: e.x + Math.sin(a) * .7, z: e.z + Math.cos(a) * .7, t: 0, cd: 0 });
    W.ev.push({ k: 'drop', x: e.x, z: e.z, id: it.id });
  }
}

function attackStart(W) {
  const p = W.player, P = W.cfg.player;
  // автоприцел: ближайший враг в радиусе autoAim
  let best = null, bd = P.autoAim;
  for (const e of W.enemies) { if (e.dead) continue; const d = len(e.x - p.x, e.z - p.z); if (d < bd) { bd = d; best = e; } }
  if (best) p.face = Math.atan2(best.x - p.x, best.z - p.z);
  p.state = 'atk'; p.atkT = 0; p.atkHit = false;
  p.vx += Math.sin(p.face) * P.attackLunge; p.vz += Math.cos(p.face) * P.attackLunge;
  W.ev.push({ k: 'swing', x: p.x, z: p.z, face: p.face });
}

function attackHit(W) {
  const p = W.player, P = W.cfg.player;
  const half = (P.attackArc + W.gear.arc) * DEG / 2;
  let hits = 0;
  for (const e of W.enemies) {
    if (e.dead) continue;
    const C = W.cfg.enemies[e.type], dx = e.x - p.x, dz = e.z - p.z, d = len(dx, dz);
    if (d > P.attackRange + W.gear.reach + C.radius) continue;
    if (Math.abs(angDiff(Math.atan2(dx, dz), p.face)) > half) continue;
    const dmg = Math.round((P.attackDamage + W.gear.dmg) * rr(W, .9, 1.15)), crit = W.rng() < .12 + W.gear.crit / 100;
    const dealt = crit ? Math.round(dmg * 1.7) : dmg;
    e.hp -= dealt; e.flash = .12; p.calm = P.fire.calm;
    if (W.gear.leech > 0) p.hp = Math.min(p.maxhp, p.hp + dealt * W.gear.leech / 100);
    const k = P.knockback / (C.scale > 1.2 ? 2.2 : 1), n = d || 1;
    e.vx += dx / n * k; e.vz += dz / n * k;
    if (e.state === 'wind') { e.state = 'chase'; e.t = 0; e.cd = .3; }       // удар прерывает замах
    W.ev.push({ k: 'hit', x: e.x, z: e.z, dmg: dealt, crit, id: e.id });
    hits++;
    e.alert = true;
    if (e.hp <= 0) { e.dead = true; e.deadT = 0; W.kills++; W.ev.push({ k: 'die', x: e.x, z: e.z, type: e.type, id: e.id }); dropLoot(W, e); addXp(W, e); }
  }
  if (hits) { W.freeze = W.cfg.fx.hitStop; W.shake = Math.max(W.shake, W.cfg.fx.shake); }
  return hits;
}

function updatePlayer(W, dt, input) {
  const p = W.player, P = W.cfg.player, R = W.cfg.world.radius;
  if (p.dead) { p.deadT += dt; p.vx = p.vz = 0; return; }
  if (p.inv > 0) p.inv -= dt;
  if (p.rollCd > 0) p.rollCd -= dt;
  if (p.dodgeCd > 0) p.dodgeCd -= dt;
  let mx = input.mx || 0, mz = input.mz || 0;
  const ml = len(mx, mz);
  if (ml > 1) { mx /= ml; mz /= ml; }
  const moving = ml > .08;

  // перекат
  if (input.roll && p.state !== 'roll' && p.rollCd <= 0) {
    const dl = moving ? ml : 0;
    p.rollDirX = moving ? mx / dl : Math.sin(p.face); p.rollDirZ = moving ? mz / dl : Math.cos(p.face);
    p.state = 'roll'; p.rollT = 0; p.rollCd = Math.max(.25, P.rollCooldown - W.gear.rollcd); p.inv = Math.max(p.inv, P.rollInvuln);
    p.face = Math.atan2(p.rollDirX, p.rollDirZ);
    W.ev.push({ k: 'roll', x: p.x, z: p.z });
  }
  if (p.state === 'roll') {
    p.rollT += dt;
    const k = 1.25 - .75 * (p.rollT / P.rollTime);
    p.vx = p.rollDirX * P.rollSpeed * k; p.vz = p.rollDirZ * P.rollSpeed * k;
    if (p.rollT >= P.rollTime) p.state = 'idle';
  } else {
    if (input.attack && p.state !== 'atk') attackStart(W);
    if (p.state === 'atk') {
      p.atkT += dt;
      if (!p.atkHit && p.atkT >= P.attackHitAt * W.gear.swing) { p.atkHit = true; attackHit(W); }
      if (p.atkT >= P.attackTime * W.gear.swing) p.state = 'idle';
    }
    // бег с разгоном; при ударе медленнее
    const sp = P.speed * (1 + clamp(W.gear.spd, -30, W.cfg.gear.maxSpd) / 100) * (p.state === 'atk' ? P.attackSlow : 1);
    const tx = moving ? mx * sp : 0, tz = moving ? mz * sp : 0;
    const a = P.accel * dt;
    const dvx = tx - p.vx, dvz = tz - p.vz, dl = len(dvx, dvz);
    if (dl <= a) { p.vx = tx; p.vz = tz; } else { p.vx += dvx / dl * a; p.vz += dvz / dl * a; }
    if (moving && p.state !== 'atk') p.face += clamp(angDiff(Math.atan2(mx, mz), p.face), -P.turnSpeed * dt, P.turnSpeed * dt);
    if (p.state === 'idle' && moving) p.state = 'run'; else if (p.state === 'run' && !moving) p.state = 'idle';
  }
  if (W.gear.regen > 0 && p.hp < p.maxhp) p.hp = Math.min(p.maxhp, p.hp + W.gear.regen * dt);
  if (p.calm > 0) p.calm -= dt;
  else if (len(p.x, p.z) < P.fire.radius && p.hp < p.maxhp) p.hp = Math.min(p.maxhp, p.hp + P.fire.perSec * dt);
  slide(W.map, p, p.vx * dt, p.vz * dt, P.radius);
  const l = len(p.x, p.z); if (l > R) { p.x *= R / l; p.z *= R / l; }
  W.inside = insideOf(W.map, p.x, p.z);
}

function updateEnemies(W, dt) {
  const p = W.player, E = W.cfg.enemies;
  for (const e of W.enemies) {
    const C = E[e.type];
    if (e.flash > 0) e.flash -= dt;
    if (e.dead) { e.deadT += dt; continue; }
    const dx = p.x - e.x, dz = p.z - e.z, d = len(dx, dz) || 1e-6;
    slide(W.map, e, e.vx * dt, e.vz * dt, C.radius);
    const kd = Math.exp(-E.knockDecay * dt); e.vx *= kd; e.vz *= kd;
    if (e.state === 'chase') {
      e.face = Math.atan2(dx, dz);
      const H = E.hear, noise = (p.state === 'atk' || p.state === 'roll' ? H.fight : p.state === 'run' ? H.run : H.idle) * (1 - clamp(W.gear.stealth, 0, 60) / 100) * (W.place && W.place.safe ? .5 : 1);
      const pe = placeAt(W.map, e.x, e.z), deep = pe && pe.safe && len(e.x - pe.x, e.z - pe.z) < pe.r - 4;    // в глубине безопасного места враги теряют след и не слышат
      if (deep) e.alert = false;
      if (!e.alert && !deep && d < noise * (W.inside >= 0 ? H.house : 1)) e.alert = true;
      else if (e.alert && d > H.lose) e.alert = false;
      if (!p.dead && !e.alert && d < H.lose) {                       // не услышал: бредёт к герою вполсилы
        const gx = dx / d * C.speed * H.drift * dt, gz = dz / d * C.speed * H.drift * dt; slide(W.map, e, gx, gz, C.radius);
      }
      if (!p.dead && e.alert) {
        const g = goalOf(W, e);                                   // к герою напрямик или к двери дома
        if (g !== p) { const gx = g.x - e.x, gz = g.z - e.z, gd = len(gx, gz) || 1e-6; e.face = Math.atan2(gx, gz); slide(W.map, e, gx / gd * C.speed * dt, gz / gd * C.speed * dt, C.radius); }
        else if (d > C.range * .85) { slide(W.map, e, dx / d * C.speed * dt, dz / d * C.speed * dt, C.radius); }
        else { e.cd -= dt; if (e.cd <= 0) { e.state = 'wind'; e.t = 0; } }
      }
    } else if (e.state === 'wind') {
      e.t += dt; e.face = Math.atan2(dx, dz);
      if (e.t >= C.wind) {
        e.state = 'rec'; e.t = 0;
        if (!p.dead && d <= C.range + P_RADIUS(W) + .35 && insideOf(W.map, e.x, e.z) === W.inside) hurtPlayer(W, Math.round(C.damage * (e.dmgMul || 1)), e.x, e.z);
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
    if (!p.dead) {
      const dx = a.x - p.x, dz = a.z - p.z, d = len(dx, dz), m = ra + P_RADIUS(W);
      if (d < m && d > 1e-6) { const k = (m - d) / d; a.x += dx * k * .8; a.z += dz * k * .8; p.x -= dx * k * .2; p.z -= dz * k * .2; }
    }
  }
  for (const e of live) resolve(W.map, e, E[e.type].radius);
  resolve(W.map, p, W.cfg.player.radius);
  { const R = W.cfg.world.radius, l = len(p.x, p.z); if (l > R) { p.x *= R / l; p.z *= R / l; } }    // расталкивание не выносит героя за границу
  W.enemies = W.enemies.filter(e => !(e.dead && e.deadT > .6));
  // держим нужное число врагов
  const alive = W.enemies.filter(e => !e.dead).length;
  const bonus = W.place && W.place.danger ? Math.round(W.place.danger * E.dangerCount) : 0;
  if (alive < E.count + bonus && !p.dead) { W.spawnT -= dt; if (W.spawnT <= 0) { W.spawnT = spawnRing(W) === false ? .1 : E.respawn; } }
  else W.spawnT = Math.max(W.spawnT, .6);
}
const P_RADIUS = W => W.cfg.player.radius;

// наполнить контейнер заново: глубина (расстояние от костра) и удача героя улучшают добычу
function refill(W, c) {
  const def = CONTAINERS[c.kind], depth = clamp(len(c.x, c.z) / W.cfg.world.radius, 0, 1);
  const pl = placeAt(W.map, c.x, c.z);
  c.items = rollLoot(def, W.rng, depth, W.gear.luck, pl && pl.danger ? pl.danger * W.cfg.enemies.dangerLoot : 0);
  c.ready = c.items.length > 0; c.t = 0;
  c.locked = !!def.locked; c.keyTier = def.locked ? (depth < .3 ? 1 : depth < .6 ? 2 : 3) : 0;
}

// ---- места и карта ----
export function trackPlace(W, dt) {
  const p = W.player, pl = placeAt(W.map, p.x, p.z);
  if ((pl && pl.id) !== (W.place && W.place.id)) { W.place = pl; W.ev.push({ k: 'place', place: pl }); }
  if ((W.revealT -= dt) <= 0) { W.revealT = .3; reveal(W, p.x, p.z, W.cfg.map.reveal); }
}
export function reveal(W, x, z, r) {
  const c = W.cfg.map.cell, R = W.cfg.world.radius, n = W.seenN, i0 = Math.floor((x - r + R) / c), i1 = Math.floor((x + r + R) / c), j0 = Math.floor((z - r + R) / c), j1 = Math.floor((z + r + R) / c);
  for (let j = Math.max(0, j0); j <= Math.min(n - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(n - 1, i1); i++) {
    const cx = (i + .5) * c - R, cz = (j + .5) * c - R; if (Math.hypot(cx - x, cz - z) <= r + c * .5) W.seen[j * n + i] = 1;
  }
}
export const isSeen = (W, x, z) => { const c = W.cfg.map.cell, R = W.cfg.world.radius, i = Math.floor((x + R) / c), j = Math.floor((z + R) / c); return i >= 0 && j >= 0 && i < W.seenN && j < W.seenN && W.seen[j * W.seenN + i] === 1; };

// ---- опыт, уровни, навыки ----
export const xpNeed = (lv, cfg) => Math.round(cfg.level.base * Math.pow(lv, cfg.level.pow));
export function addXp(W, e) {
  const L = W.cfg.level, depth = clamp(len(e.x, e.z) / W.cfg.world.radius, 0, 1), C = W.cfg.enemies[e.type];
  gainXp(W, Math.round((C.xp || 5) * (1 + depth * .8) * (1 + W.cfg.enemies.dangerXp * (e.danger || 0))));
}
export function gainXp(W, n) {
  const L = W.cfg.level; if (W.lv >= L.max) return;
  W.xp += n; W.ev.push({ k: 'xp', n, x: W.player.x, z: W.player.z });
  while (W.lv < L.max && W.xp >= xpNeed(W.lv, W.cfg)) {
    W.xp -= xpNeed(W.lv, W.cfg); W.lv++; W.sp++;
    refreshGear(W); const p = W.player; p.hp = Math.min(p.maxhp, p.hp + p.maxhp * L.healOnUp);
    W.ev.push({ k: 'level', lv: W.lv, x: p.x, z: p.z });
  }
  if (W.lv >= L.max) W.xp = 0;
}
export function spendSkill(W, id) {
  const r = canRank(W.skills, id, W.sp); if (r !== 'ok') return r;
  W.skills[id] = (W.skills[id] || 0) + 1; W.sp--; refreshGear(W); return 'ok';
}
export const respecCost = W => W.cfg.respecBase * W.lv;
export function respec(W) {
  const spent = Object.values(W.skills).reduce((a, b) => a + b, 0); if (!spent) return 'none';
  const cost = respecCost(W); if (W.inv.ash < cost) return 'ash';
  W.inv.ash -= cost; W.sp += spent; W.skills = {}; refreshGear(W); return 'ok';
}

// ---- кузнец: улучшение вещей за пепел ----
export const upgradeCost = (it, lvl, cfg) => Math.round(cfg.smith.base + it.value * cfg.smith.costK * Math.pow(lvl + 1, cfg.smith.pow));
// where: { slot } для надетой или { idx } для вещи в сумке
export function upgradeItem(W, where) {
  if (W.nearNpc !== 'smith') return 'far';
  const inv = W.inv, e = where.slot ? null : inv.bag[where.idx];
  const id = where.slot ? inv.eq[where.slot] : e && e.id, it = id && BY_ID[id];
  if (!it || !it.slot) return 'none';
  const lvl = where.slot ? inv.up[where.slot] || 0 : e.up || 0;
  if (lvl >= W.cfg.smith.max) return 'max';
  const cost = upgradeCost(it, lvl, W.cfg);
  if (inv.ash < cost) return 'ash';
  inv.ash -= cost; if (where.slot) inv.up[where.slot] = lvl + 1; else e.up = lvl + 1;
  W.ev.push({ k: 'upgrade', x: W.player.x, z: W.player.z, lvl: lvl + 1 }); return 'ok';
}

// ---- торговля ----
export const sellPrice = (it, cfg, up = 0, trade = 0) => Math.max(1, Math.round(it.value * cfg.shop.sellMul * (1 + up * .25) * (1 + trade / 100)));
export const buyPrice = (it, cfg) => Math.max(2, Math.round(it.value * cfg.shop.buyMul));
export function restock(W) {
  const out = SHOP_STAPLES.map(([id, n]) => ({ id, n }));
  for (const it of rollLoot(SHOP, W.rng, .12, W.gear.luck)) { const ex = out.find(o => o.id === it.id); if (ex) ex.n += it.n; else out.push({ ...it }); }
  W.shop.stock = out; W.shop.t = 0;
}
export function buyItem(W, i) {
  const s = W.shop.stock[i]; if (!s || !W.nearMerchant) return 'far';
  const it = BY_ID[s.id], price = buyPrice(it, W.cfg);
  if (W.inv.ash < price) return 'ash';
  if (addItem(W.inv, s.id, 1, W.cfg.bag.slots) > 0) return 'full';
  W.inv.ash -= price; s.n -= 1; if (s.n <= 0) W.shop.stock.splice(i, 1);
  W.ev.push({ k: 'pickup', id: s.id, n: 1 }); return 'ok';
}
export function sellItem(W, idx, n = 1) {
  const s = W.inv.bag[idx]; if (!s) return 'none'; if (!W.nearMerchant) return 'far';
  const q = Math.min(n, s.n), it = BY_ID[s.id];
  W.inv.ash += sellPrice(it, W.cfg, s.up || 0, W.gear.trade) * q; removeAt(W.inv, idx, q); return 'ok';
}
// продать весь хлам разом: безделушки, деньги, записки и материалы (оружие, броня, ключи и расходники остаются)
export function sellJunk(W) {
  if (!W.nearMerchant) return -1;
  let sum = 0;
  for (let i = W.inv.bag.length - 1; i >= 0; i--) { const s = W.inv.bag[i], it = BY_ID[s.id]; if (it.cat === 'curio' || it.cat === 'material') { sum += sellPrice(it, W.cfg, 0, W.gear.trade) * s.n; W.inv.bag.splice(i, 1); } }
  W.inv.ash += sum; return sum;
}

// положить в сумку; возвращает остаток
function give(W, id, n) { const left = addItem(W.inv, id, n, W.cfg.bag.slots); if (n - left > 0) W.ev.push({ k: 'pickup', id, n: n - left }); return left; }

// двери открываются сами, когда рядом кто-то есть; контейнеры отдают добычу при касании и позже наполняются снова
function updateHouses(W, dt) {
  const M = W.cfg.map, p = W.player, live = W.enemies.filter(e => !e.dead);
  for (const b of W.map.buildings) {
    const d = b.door, r = M.doorReach;
    const near = (!p.dead && len(p.x - d.x, p.z - d.z) < r) || live.some(e => len(e.x - d.x, e.z - d.z) < r);
    d.open = clamp(d.open + (near ? 1 : -1) * dt * 4, 0, 1);
  }
  { const nb = p.dead ? null : W.map.buildings.find(b => b.npc && len(p.x - b.npc.x, p.z - b.npc.z) < W.cfg.shop.reach); W.nearNpc = nb ? nb.npc.kind : null; W.nearMerchant = W.nearNpc === 'merchant'; }
  if ((W.shop.t += dt) > W.cfg.shop.restock) restock(W);
  for (const c of W.map.containers) {
    const def = CONTAINERS[c.kind];
    if (c.cd > 0) c.cd -= dt;
    if (!c.ready) { c.t += dt; if (c.t >= M.containerRespawn) refill(W, c); continue; }
    if (p.dead || len(p.x - c.x, p.z - c.z) >= (def.reach || 1.3)) continue;
    if (c.locked) {
      // ключ подходит, если уровень не ниже замка; тратим самый слабый из подходящих
      let best = -1; W.inv.bag.forEach((s, i) => { const k = BY_ID[s.id].keyTier; if (k >= c.keyTier && (best < 0 || k < BY_ID[W.inv.bag[best].id].keyTier)) best = i; });
      if (best < 0) { if (!(c.cd > 0)) { c.cd = 2.5; W.ev.push({ k: 'locked', x: c.x, z: c.z, tier: c.keyTier }); } continue; }
      removeAt(W.inv, best, 1); c.locked = false; W.ev.push({ k: 'unlock', x: c.x, z: c.z });
    }
    const rest = [];
    for (const it of c.items) { const left = give(W, it.id, it.n); if (left > 0) rest.push({ id: it.id, n: left }); }
    c.items = rest; W.ev.push({ k: 'open', kind: c.kind, x: c.x, z: c.z });
    if (rest.length) { if (!(c.cd > 0)) { c.cd = 2.5; W.ev.push({ k: 'full', x: c.x, z: c.z }); } }
    else { c.ready = false; c.t = 0; }
  }
  // вещи на земле: подбираем вблизи (с «притягиванием»), по таймеру исчезают
  for (let i = W.drops.length - 1; i >= 0; i--) {
    const q = W.drops[i]; q.t += dt;
    const d = len(p.x - q.x, p.z - q.z);
    if (!p.dead && d < W.cfg.gear.pickup * 2.2) { const k = Math.min(1, dt * 8); q.x += (p.x - q.x) * k * .5; q.z += (p.z - q.z) * k * .5; }
    if (!p.dead && d < W.cfg.gear.pickup * .8) { const left = give(W, q.id, q.n); if (left < q.n) { q.n = left; if (!left) { W.drops.splice(i, 1); continue; } } else if (!(q.cd > 0)) { q.cd = 2; W.ev.push({ k: 'full', x: q.x, z: q.z }); } }
    if (q.cd > 0) q.cd -= dt;
    if (q.t > W.cfg.gear.dropLife) W.drops.splice(i, 1);
  }
}

// использовать вещь из сумки (еда, зелья, мешочки пепла); возвращает true, если вещь потрачена
export function useItem(W, idx) {
  const s = W.inv.bag[idx], it = s && BY_ID[s.id]; if (!it || !it.use || W.player.dead) return false;
  const p = W.player, u = it.use;
  if (u.heal) { const h = Math.min(u.heal, p.maxhp - p.hp); if (h <= 0 && !u.buff && !u.ash) return false; p.hp += Math.max(0, h); if (h > 0) W.ev.push({ k: 'heal', x: p.x, z: p.z, n: Math.round(h) }); }
  if (u.ash) { const n = Math.round(u.ash[0] + W.rng() * (u.ash[1] - u.ash[0])); W.inv.ash += n; W.ev.push({ k: 'ash', x: p.x, z: p.z, n }); }
  if (u.buff) { const ex = W.buffs.find(b => b.stat === u.buff.stat && b.src === it.id); if (ex) ex.t = u.buff.t; else W.buffs.push({ stat: u.buff.stat, amt: u.buff.amt, t: u.buff.t, src: it.id }); W.ev.push({ k: 'buff', x: p.x, z: p.z, stat: u.buff.stat }); }
  removeAt(W.inv, idx, 1); return true;
}
export function dropItem(W, idx, n = 1) {
  const s = W.inv.bag[idx]; if (!s) return false;
  const q = Math.min(n, s.n), p = W.player;
  W.drops.push({ id: s.id, n: q, x: p.x + Math.sin(p.face) * 1.6, z: p.z + Math.cos(p.face) * 1.6, t: W.cfg.gear.dropLife - 12, cd: 0 });   // брошенное лежит недолго
  removeAt(W.inv, idx, q); return true;
}

// Куда идти врагу: если герой в доме, а враг снаружи (или наоборот) — через дверь; иначе прямо к герою
function goalOf(W, e) {
  const p = W.player, be = insideOf(W.map, e.x, e.z);
  if (be === W.inside) return p;
  const near = (a, b) => len(a.x - b.x, a.z - b.z) < 2.4;
  if (be >= 0) { const dr = W.map.buildings[be].door; return near(e, dr.in) ? dr.out : dr.in; }      // враг в доме: выйти
  const dr = W.map.buildings[W.inside].door; return near(e, dr.out) ? dr.in : dr.out;               // герой в доме: войти
}

// input: { mx, mz (−1..1), attack (держится), roll (нажатие) }
// пересчёт характеристик от надетого и баффов (вызывается каждый шаг и при смене экипировки в сумке)
export function refreshGear(W) {
  const L = W.cfg.level, base = skillStats(W.skills);
  base.hp = (base.hp || 0) + (W.lv - 1) * L.hpPer; base.dmg = (base.dmg || 0) + (W.lv - 1) * L.dmgPer;
  W.gear = gearStats(W.inv, W.buffs, W.cfg.smith.bonus, base);
  const p = W.player; p.maxhp = Math.max(10, W.cfg.player.hp + W.gear.hp); if (p.hp > p.maxhp) p.hp = p.maxhp;
}

export function step(W, dt, input = {}) {
  if (!(dt > 0)) return;                                          // нулевой или отрицательный шаг (первый кадр rAF) ничего не двигает
  W.t += dt;
  for (let i = W.buffs.length - 1; i >= 0; i--) { W.buffs[i].t -= dt; if (W.buffs[i].t <= 0) W.buffs.splice(i, 1); }
  refreshGear(W);
  if (W.freeze > 0) { W.freeze -= dt; return; }
  updatePlayer(W, dt, input);
  trackPlace(W, dt);
  updateEnemies(W, dt);
  updateHouses(W, dt);
  if (W.shake > 0) W.shake = Math.max(0, W.shake - dt * 1.4);
  if (W.ev.length > 200) W.ev.splice(0, W.ev.length - 200);     // события забирает рендер; потолок защищает, если никто не забирает
}

export function respawnPlayer(W) {
  const P = W.cfg.player, p = W.player;
  Object.assign(p, { x: 0, z: 4, vx: 0, vz: 0, face: Math.PI, hp: P.hp, maxhp: P.hp, state: 'idle', atkT: 0, rollT: 0, rollCd: 0, inv: 1.2, dead: false, deadT: 0 });
  W.enemies.length = 0; W.spawnT = 1.2;
}
