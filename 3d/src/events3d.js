// Живой мир: сказочный торговец (A4) и случайные события (A5) — помощь в беде, засада, обоз.
// Случайные числа — свои (W.erng): появление торговца и событий не сдвигает поток боя и добычи.
import { CATALOG, BY_POOL } from './data/items.js';
import { TAU, len } from './util3d.js';
import { mulberry32, spawnEnemy, killEnemy } from './sim.js';
import { onSurface, depthAt } from './levels3d.js';
import { CONTAINERS, rollLoot } from './data/loot.js';
import { insideCamp, insideOf, placeAt, resolve, slide } from './map.js';
import { distSeg, pathSegs } from './world3d.js';

import { wdist, worldSpot } from './geo3d.js';     // Мир 5.0: круг мира — от его центра
const between = (rng, [a, b]) => a + rng() * (b - a);
const pickN = (rng, list, n) => { const a = list.slice(), out = []; while (out.length < n && a.length) out.push(a.splice(rng() * a.length | 0, 1)[0]); return out; };
const GEAR = CATALOG.filter(i => i.slot && i.rar === 3 && i.pool !== 'unique' && i.pool !== 'setunique');
const UNIQUE = CATALOG.filter(i => i.pool === 'unique' || i.pool === 'setunique'), GOLDS = CATALOG.filter(i => i.pool === 'gold');

export const erng = W => W.erng || (W.erng = W.rng === Math.random ? Math.random : mulberry32((W.cfg.world.seed || 1) * 7919 + 17));

// товар: несколько сказочных зелий и свитков, 2–3 великие вещи, иногда именная, одна-две золотые
export function wandererStock(W) {
  const C = W.cfg.wanderer, rng = erng(W), out = [];
  for (const it of pickN(rng, BY_POOL.fairy.flat(), C.fairy)) out.push({ id: it.id, n: 1 + (rng() < .5 ? 1 : 0) });
  for (const it of pickN(rng, GEAR, Math.round(between(rng, C.gear)))) out.push({ id: it.id, n: 1 });
  if (rng() < C.uniqueChance) out.push({ id: pickN(rng, UNIQUE, 1)[0].id, n: 1 });
  for (const it of pickN(rng, GOLDS, (C.gold || 0) + (rng() < (C.gold2 || 0) ? 1 : 0))) out.push({ id: it.id, n: 1 });     // золотое — всегда одно, второе с шансом
  return out;
}

// место у дороги: вне лагеря и опасных мест (strict — вне любых мест), в границах мира, не в доме и не в дереве, на нужном расстоянии от героя
export const wandererSpot = W => spotNear(W, W.cfg.wanderer, false);
function spotNear(W, C, strict) {
  const rng = erng(W), M = W.map, p = W.player, roads = pathSegs(M), R = W.cfg.world.radius;     // места у видимых троп
  for (let k = 0; k < 60; k++) {
    let x, z;
    if (roads.length && k < 40) {
      const [a, b] = roads[rng() * roads.length | 0], t = rng(), L = len(b.x - a.x, b.z - a.z) || 1, s = (rng() < .5 ? -1 : 1) * C.side;
      x = a.x + (b.x - a.x) * t - (b.z - a.z) / L * s; z = a.z + (b.z - a.z) * t + (b.x - a.x) / L * s;
    } else { const ang = rng() * TAU, d = between(rng, C.dist); x = p.x + Math.sin(ang) * d; z = p.z + Math.cos(ang) * d; }
    const d = len(x - p.x, z - p.z);
    if (d < C.dist[0] || d > C.dist[1] || wdist(W.cfg, x, z) > R - 4) continue;
    if (M.camp && insideCamp(M.camp, x, z, -C.campPad)) continue;
    const pl = placeAt(M, x, z); if (pl && (pl.danger || strict)) continue;
    if (insideOf(M, x, z) >= 0 || resolve(M, { x, z }, C.r)) continue;
    return { x, z, face: rng() * TAU };
  }
  return null;
}

// таймер появления и отъезда; стоит только наверху, но время идёт и в подземелье
export function updateWanderer(W, dt) {
  const C = W.cfg.wanderer; if (!C || !C.on) return;
  const rng = erng(W);
  if (W.wandT === undefined) W.wandT = between(rng, C.first);
  const w = W.wanderer, p = W.player;
  if (w) {
    const near = onSurface(W) && !p.dead && len(p.x - w.x, p.z - w.z) < C.linger;
    if ((w.t -= dt) <= 0 && !near) { W.ev.push({ k: 'wanderLeave', x: w.x, z: w.z }); W.wanderer = null; W.wandT = between(rng, C.every); }
    return;
  }
  if ((W.wandT -= dt) > 0) return;
  const spot = onSurface(W) && !p.dead ? wandererSpot(W) : null;
  if (!spot) { W.wandT = C.retry; return; }
  W.wanderer = { ...spot, t: C.stay, stock: wandererStock(W) };
  W.ev.push({ k: 'wanderer', x: spot.x, z: spot.z });
}
// повозка твёрдая только для героя: враги и бой её не замечают
export function blockCart(W, o, r) {
  const w = W.wanderer; if (!w || !onSurface(W)) return;
  const dx = o.x - w.x, dz = o.z - w.z, d = Math.hypot(dx, dz), m = W.cfg.wanderer.r + r;
  if (d < m && d > 1e-9) { o.x = w.x + dx / d * m; o.z = w.z + dz / d * m; }
}
// герой у повозки
export const nearWanderer = W => { const w = W.wanderer, p = W.player; return !!w && onSurface(W) && !p.dead && len(p.x - w.x, p.z - w.z) < W.cfg.wanderer.reach; };

// ---------- случайные события ----------
// W.event — одно событие за раз: { id, kind, x, z, stage, t, foes: [id], guest, ... }; W.evT — таймер до следующего
const pickW = (rng, t) => { let s = 0; for (const a of t) s += a[1]; let r = rng() * s; for (const a of t) if ((r -= a[1]) <= 0) return a[0]; return t[0][0]; };
const free = (W, x, z, r) => insideOf(W.map, x, z) < 0 && !resolve(W.map, { x, z }, r) && wdist(W.cfg, x, z) < W.cfg.world.radius - 3 && !(W.map.camp && insideCamp(W.map.camp, x, z, -2));

// враги события: свои случайные числа на рождение (элита, разброс), сразу встревожены
function spawnFoes(W, ev, kind, cx, cz, r0, r1, ang0 = 0, spread = TAU) {
  const F = W.cfg.events.foes[kind], rng = erng(W), n = F.n[0] + Math.round(depthAt(W, cx, cz) * F.n[1]), keep = W.rng;
  W.rng = rng;
  try {
    for (let i = 0; i < n; i++) {
      let x = cx, z = cz;
      for (let k = 0; k < 16; k++) { const a = ang0 + (rng() - .5) * spread, d = r0 + rng() * (r1 - r0); x = cx + Math.sin(a) * d; z = cz + Math.cos(a) * d; if (free(W, x, z, .8)) break; }
      const e = spawnEnemy(W, pickW(rng, F.types), x, z); e.alert = true; e.evId = ev.id; ev.foes.push(e.id);
    }
  } finally { W.rng = keep; }
}
const foesLeft = (W, ev) => ev.foes.filter(id => W.enemies.some(e => e.id === id && !e.dead)).length;
function addGuest(W, o) {
  const a = { id: W.aid++, guest: true, type: 'guest', vx: 0, vz: 0, face: 0, state: 'idle', t: 0, cd: 0, dead: false, deadT: 0, flash: 0, calm: 0, tgt: 0, moving: false, ...o, maxhp: o.hp };
  W.allies.push(a); return a;
}
const guestOf = (W, ev) => W.allies.find(a => a.id === ev.guest);
const dropGuest = (W, ev) => { const i = W.allies.findIndex(a => a.id === ev.guest); if (i >= 0) W.allies.splice(i, 1); };

// награда — один раз: пепел, вещи на землю, у спасённого путника — «благодарность» (удача)
function reward(W, ev, x, z) {
  const E = W.cfg.events, R = E.reward[ev.kind], rng = erng(W), depth = Math.min(1, depthAt(W, x, z));
  const ash = Math.round(between(rng, R.ash) * (1 + depth)); W.inv.ash += ash;
  for (const it of rollLoot(CONTAINERS[R.box], rng, depth, W.gear.luck)) { const a = rng() * TAU; W.drops.push({ id: it.id, n: it.n, x: x + Math.sin(a) * 1.4, z: z + Math.cos(a) * 1.4, t: 0, cd: 0 }); W.ev.push({ k: 'drop', x, z, id: it.id }); }
  if (R.buff) W.buffs.push({ ...R.buff, src: 'event' });
  if (R.epic) { const it = GEAR[rng() * GEAR.length | 0]; W.drops.push({ id: it.id, n: 1, x, z, t: 0, cd: 0, il: Math.max(1, W.lv) }); W.ev.push({ k: 'drop', x, z, id: it.id }); }     // великая вещь из мешка вора
  return ash;
}
function endEvent(W, ev, ok, why) {
  const E = W.cfg.events, g = guestOf(W, ev), x = g ? g.x : ev.x, z = g ? g.z : ev.z;
  const ash = ok ? reward(W, ev, x, z) : 0;
  for (const e of W.enemies) if (e.evId === ev.id) e.evId = 0;
  if (g && !g.dead) { if (ok && ev.kind === 'rescue') { g.leaveT = E.rescue.thanks; g.done = true; } else dropGuest(W, ev); }
  W.ev.push({ k: ok ? 'evDone' : 'evFail', kind: ev.kind, why, ash, x, z, place: ev.place });
  W.event = null; W.evT = between(erng(W), E.every);
}

// начала событий: возвращают событие или null, если сейчас не к месту
const START = {
  rescue(W, id) {
    const E = W.cfg.events, s = spotNear(W, E.rescue, true); if (!s) return null;
    const ev = { id, kind: 'rescue', x: s.x, z: s.z, stage: 'wait', t: E.rescue.wait, foes: [] };
    ev.guest = addGuest(W, { x: s.x, z: s.z, hp: E.rescue.hp, taken: E.rescue.taken, name: E.rescue.name, face: s.face }).id;
    return ev;
  },
  ambush(W, id) {
    const E = W.cfg.events, A = E.ambush, p = W.player, M = W.map;
    if (M.camp && insideCamp(M.camp, p.x, p.z, -A.campPad)) return null;
    const pl = placeAt(M, p.x, p.z); if (pl && pl.safe) return null;
    if (!pathSegs(M).some(([a, b]) => distSeg(p.x, p.z, a, b) < A.road)) return null;
    const ev = { id, kind: 'ambush', x: p.x, z: p.z, stage: 'fight', t: A.time, foes: [] };
    const ang = Math.atan2(Math.sin(p.face), Math.cos(p.face));
    spawnFoes(W, ev, 'ambush', p.x, p.z, A.r[0], A.r[1], ang, Math.PI * 1.4);    // впереди и с боков
    return ev.foes.length ? ev : null;
  },
  thief(W, id) {     // «Пепельный вор» (этап 4 «круче»): появляется неподалёку и убегает; догнать и убить — награда
    const E = W.cfg.events, T = E.thief, s = spotNear(W, T, false); if (!s) return null;
    const keep = W.rng; W.rng = erng(W); let e; try { e = spawnEnemy(W, 'ash_thief', s.x, s.z); } finally { W.rng = keep; }     // свой генератор: бой не сдвигается
    e.evId = id; e.alert = true;
    return { id, kind: 'thief', x: s.x, z: s.z, stage: 'fight', t: T.time, foes: [e.id] };
  },
  caravan(W, id) {
    const E = W.cfg.events, K = E.caravan, M = W.map, camp = M.camp, rng = erng(W); if (!camp) return null;
    // дорога из ворот к двери дома в посёлке: [точка за воротами, дверь]
    const outs = M.buildings.map(b => b.door.out).filter(o => { const pl = placeAt(M, o.x, o.z); return pl && pl.safe && !insideCamp(camp, o.x, o.z); });
    const pathOf = (a, b) => { const P = (M.paths || []).find(q => q.leg[0] === a && q.leg[1] === b); return P ? P.pts : [a, b]; };
    // тропа свободна для обоза: идём по ней с шагом 1 м до последних K.arrive м
    const clear = pts => { let total = 0; for (let i = 1; i < pts.length; i++) total += len(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); let s0 = 0;
      for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], L = len(b.x - a.x, b.z - a.z) || 1e-9;
        for (let s = 0; s < L; s += 1) { if (s0 + s > total - K.arrive) return true; const x = a.x + (b.x - a.x) * s / L, z = a.z + (b.z - a.z) * s / L; if (insideOf(M, x, z, K.r) >= 0 || resolve(M, { x, z }, K.r)) return false; }
        s0 += L; } return true; };
    const legs = (M.roads || []).filter(([a, b]) => outs.some(o => o.x === b.x && o.z === b.z) && !(a.x === 0 && a.z === 0) && len(b.x - a.x, b.z - a.z) > K.minLen && clear(pathOf(a, b)));
    if (!legs.length) return null;
    const [a, b] = legs[rng() * legs.length | 0], pl = placeAt(M, b.x, b.z);
    const pts = pathOf(a, b).map(q => ({ x: q.x, z: q.z }));     // обоз едет по извилистой тропе
    let total = 0; for (let i = 1; i < pts.length; i++) total += len(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    const ev = { id, kind: 'caravan', x: a.x, z: a.z, stage: 'wait', t: K.wait, foes: [], path: pts, pi: 1, total, went: 0, wave: 0, place: pl.name };
    ev.guest = addGuest(W, { x: a.x, z: a.z, hp: K.hp, taken: K.taken, name: K.name, cart: true, face: Math.atan2(b.x - a.x, b.z - a.z) }).id;
    return ev;
  }
};

// путник отбивается сам: слабый удар по ближнему врагу
function guestFight(W, g, dt) {
  const R = W.cfg.events.rescue; if ((g.cd -= dt) > 0) return;
  let tg = null, bd = R.range; for (const e of W.enemies) { if (e.dead) continue; const d = len(e.x - g.x, e.z - g.z); if (d < bd) { bd = d; tg = e; } }
  if (!tg) return;
  g.face = Math.atan2(tg.x - g.x, tg.z - g.z); g.cd = R.cd; tg.hp -= R.dmg; tg.flash = .12;
  W.ev.push({ k: 'hit', x: tg.x, z: tg.z, dmg: R.dmg, crit: false, id: tg.id, ally: true });
  if (tg.hp <= 0) killEnemy(W, tg, W.cfg.squad.xpShare);
}
// обоз едет по дороге, только пока герой рядом; на отметках пути — налёты
function moveCart(W, ev, g, dt) {
  const K = W.cfg.events.caravan, p = W.player;
  if (len(p.x - g.x, p.z - g.z) > K.follow) { g.moving = false; return; }
  let pi = Math.min(ev.pi || ev.path.length - 1, ev.path.length - 1);
  while (pi < ev.path.length - 1 && len(ev.path[pi].x - g.x, ev.path[pi].z - g.z) < .8) pi++;      // точка тропы пройдена — к следующей
  ev.pi = pi; const q = ev.path[pi];
  const dx = q.x - g.x, dz = q.z - g.z, d = len(dx, dz) || 1e-6, st = Math.min(d, K.speed * dt), px = g.x, pz = g.z;
  g.face = Math.atan2(dx, dz); slide(W.map, g, dx / d * st, dz / d * st, K.r);
  ev.went += len(g.x - px, g.z - pz); g.moving = true;
  if (ev.wave < K.waves.length && ev.went >= K.waves[ev.wave] * ev.total) { ev.wave++; spawnFoes(W, ev, 'caravan', g.x + dx / d * K.ahead, g.z + dz / d * K.ahead, 3, 7); W.ev.push({ k: 'evRaid', x: g.x, z: g.z }); }
}

export function updateEvents(W, dt) {
  const E = W.cfg.events; if (!E || !E.on) return;
  const rng = erng(W), p = W.player;
  if (W.evT === undefined) W.evT = between(rng, E.first);
  // поблагодаривший путник уходит
  for (let i = W.allies.length - 1; i >= 0; i--) { const a = W.allies[i]; if (a.guest && a.done && (a.leaveT -= dt) <= 0) W.allies.splice(i, 1); }
  const ev = W.event;
  if (ev) {
    const g = ev.guest && guestOf(W, ev);
    if (!onSurface(W) || p.dead) { endEvent(W, ev, false, 'gone'); return; }          // ушёл вниз или пал — событие пропало
    ev.t -= dt;
    if (ev.guest && (!g || g.dead)) { endEvent(W, ev, false, 'dead'); return; }
    if (g) { const kd = Math.exp(-8 * dt); slide(W.map, g, g.vx * dt, g.vz * dt, .45); g.vx *= kd; g.vz *= kd; if (g.flash > 0) g.flash -= dt; }
    if (ev.kind === 'rescue') {
      if (ev.stage === 'wait') {
        if (len(p.x - g.x, p.z - g.z) < E.rescue.wake) { ev.stage = 'fight'; ev.t = E.rescue.time; spawnFoes(W, ev, 'rescue', g.x, g.z, 5, 8); W.ev.push({ k: 'evFight', x: g.x, z: g.z }); }
        else if (ev.t <= 0) endEvent(W, ev, false, 'late');
      } else { guestFight(W, g, dt); if (!foesLeft(W, ev)) endEvent(W, ev, true); else if (ev.t <= 0) endEvent(W, ev, false, 'late'); }
    } else if (ev.kind === 'ambush') {
      if (!foesLeft(W, ev)) endEvent(W, ev, true);
      else if (len(p.x - ev.x, p.z - ev.z) > E.ambush.flee || (W.map.camp && insideCamp(W.map.camp, p.x, p.z)) || ev.t <= 0) endEvent(W, ev, false, 'fled');     // убежал или укрылся в лагере
    } else if (ev.kind === 'thief') {
      const th = W.enemies.find(e => e.id === ev.foes[0]);
      if (!th || th.dead) endEvent(W, ev, true);
      else if (ev.t <= 0 || len(p.x - th.x, p.z - th.z) > E.thief.lose) { W.enemies.splice(W.enemies.indexOf(th), 1); W.ev.push({ k: 'blink', x: th.x, z: th.z, x2: th.x, z2: th.z }); endEvent(W, ev, false, 'escaped'); }     // ушёл — растаял в пепле
    } else if (ev.kind === 'caravan') {
      if (ev.stage === 'wait') { if (len(p.x - g.x, p.z - g.z) < E.caravan.start) { ev.stage = 'move'; ev.t = E.caravan.time; W.ev.push({ k: 'evMove', x: g.x, z: g.z, place: ev.place }); } else if (ev.t <= 0) endEvent(W, ev, false, 'late'); }
      else {
        moveCart(W, ev, g, dt);
        const q = ev.path[ev.path.length - 1];
        if (len(q.x - g.x, q.z - g.z) < E.caravan.arrive) endEvent(W, ev, true); else if (ev.t <= 0) endEvent(W, ev, false, 'late');
      }
    }
    return;
  }
  if ((W.evT -= dt) > 0) return;
  if (!onSurface(W) || p.dead) { W.evT = E.retry; return; }
  // вид — по весам; не к месту (засада не на дороге, обозу некуда ехать) — пробуем остальные
  const kinds = Object.keys(E.kinds).filter(k => E.kinds[k] > 0), order = [];
  while (kinds.length) { const k = pickW(rng, kinds.map(k => [k, E.kinds[k]])); order.push(k); kinds.splice(kinds.indexOf(k), 1); }
  for (const k of order) {
    const ev = START[k](W, (W.evId || 0) + 1); if (!ev) continue;
    W.evId = ev.id; W.event = ev;
    W.ev.push({ k: 'evStart', kind: k, x: ev.x, z: ev.z, place: ev.place });
    return;
  }
  W.evT = E.retry;
}
// где событие: подопечный, вор или место (для цели на карте)
export function eventAt(W) {
  const ev = W.event; if (!ev) return null; const g = ev.guest && guestOf(W, ev), th = ev.kind === 'thief' && W.enemies.find(e => e.id === ev.foes[0]);
  return g ? { x: g.x, z: g.z } : th ? { x: th.x, z: th.z } : { x: ev.x, z: ev.z };
}
// строка для трекера заданий
export function eventLine(W) {
  const ev = W.event; if (!ev) return '';
  const p = W.player, g = ev.guest && guestOf(W, ev), d = g ? Math.round(len(g.x - p.x, g.z - p.z)) : 0;
  if (ev.kind === 'rescue') return ev.stage === 'wait' ? `Крик о помощи: путник в беде · ${d} м` : `Спасите путника · врагов: ${foesLeft(W, ev)}`;
  if (ev.kind === 'ambush') return `Засада! Врагов: ${foesLeft(W, ev)}`;
  if (ev.kind === 'thief') { const th = W.enemies.find(e => e.id === ev.foes[0]); return `Пепельный вор! Догоните за ${Math.max(0, Math.ceil(ev.t))} с` + (th ? ` · ${Math.round(len(th.x - p.x, th.z - p.z))} м` : ''); }
  return ev.stage === 'wait' ? `Обоз ждёт охраны у ворот · ${d} м` : `Проводите обоз: ${ev.place} · ${Math.min(99, Math.round(ev.went / ev.total * 100))}%${d > W.cfg.events.caravan.follow ? ' · обоз ждёт вас' : ''}`;
}
