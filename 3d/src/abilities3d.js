// Активные умения (B3): очки умений, ранги, перезарядки и действия. Действия собраны из того, что уже есть в бою:
// удар по врагу (abilityHit), статусы (страх, оглушение), баффы (броня), рывок (состояние героя 'dash').
import { ABILITIES, rankLvs, abilityPointsAt, rankIdx } from './data/abilities3d.js';
import { abilityHit, abilityArrow } from './sim.js';
import { lineBlocked, insideOf, resolve } from './map.js';
import { applyStatus } from './status3d.js';
import { len } from './util3d.js';

export const heroAbilities = W => ABILITIES[W.hero] || [];
const cfgOf = (W, id) => (W.cfg.abilities[W.hero] || {})[id];
export const unlockLv = (W, i) => rankLvs(W.cfg, i)[0];
// очков умений к уровню lv: по одному за каждый наступивший уровень ранга (abilities.ranks)
export const abilityPoints = (lv, cfg) => abilityPointsAt(lv, cfg);
export const spentAbility = ab => Object.values(ab || {}).reduce((a, b) => a + b, 0);

// можно ли улучшить: 'ok' | 'lvl' (следующий ранг — на более высоком уровне) | 'max' | 'points'
export function canUpgrade(W, id) {
  const i = heroAbilities(W).findIndex(a => a.id === id); if (i < 0) return 'none';
  const L = rankLvs(W.cfg, i), rank = W.ab[id] || 0;
  if (rank >= L.length) return 'max';
  if (W.lv < L[rank]) return 'lvl';
  return W.ap > 0 ? 'ok' : 'points';
}
export function upgradeAbility(W, id) { const r = canUpgrade(W, id); if (r !== 'ok') return r; W.ab[id] = (W.ab[id] || 0) + 1; W.ap--; return 'ok'; }
export const respecAbilityCost = W => W.cfg.abilities.respec * W.lv;
export function respecAbilities(W) {
  const spent = spentAbility(W.ab); if (!spent) return 'none';
  const cost = respecAbilityCost(W); if (W.inv.ash < cost) return 'ash';
  W.inv.ash -= cost; W.ap += spent; W.ab = {}; W.acd = {}; return 'ok';
}

// применить умение слота i (0–4): 'ok' | 'none' | 'rank' (не вкачано) | 'cd' | 'busy' | 'target' (некого бить — перезарядка не тратится)
export function useAbility(W, i) {
  const def = heroAbilities(W)[i], p = W.player; if (!def) return 'none';
  const rank = W.ab[def.id] || 0; if (!rank) return 'rank';
  if ((W.acd[def.id] || 0) > 0) return 'cd';
  if (p.dead || p.state === 'roll' || p.state === 'dash') return 'busy';
  const A = cfgOf(W, def.id), r = rankIdx(W.cfg, i, rank);
  if (ACT[def.id](W, A, r) === false) return 'target';
  W.acd[def.id] = A.cd[r];
  W.ev.push({ k: 'ability', id: def.id, x: p.x, z: p.z, face: p.face });
  return 'ok';
}
// угол на ближайшего видимого врага в пределах range (cone — только в конусе ±cone° перед героем); нет — куда смотрит герой
function aimAt(W, range, cone = 180) {
  const p = W.player; let best = null, bd = range;
  for (const e of W.enemies) { if (e.dead) continue; const dx = e.x - p.x, dz = e.z - p.z, d = len(dx, dz); let a = Math.atan2(dx, dz) - p.face; a = Math.atan2(Math.sin(a), Math.cos(a));
    if (d < bd && Math.abs(a) <= cone * Math.PI / 180 && !lineBlocked(W.map, p.x, p.z, e.x, e.z)) { bd = d; best = e; } }
  return best ? { ang: Math.atan2(best.x - p.x, best.z - p.z), e: best } : { ang: p.face, e: null };
}
const near = (W, r) => W.enemies.filter(e => !e.dead && len(e.x - W.player.x, e.z - W.player.z) < r + W.cfg.enemies[e.type].radius);

const ACT = {
  // Торн
  charge(W, A, r) {
    const p = W.player;
    let best = null, bd = A.dist + 2;              // доворот на ближайшего врага впереди
    for (const e of W.enemies) { if (e.dead) continue; const d = len(e.x - p.x, e.z - p.z); if (d < bd) { bd = d; best = e; } }
    if (best && bd > .5) p.face = Math.atan2(best.x - p.x, best.z - p.z);
    const dist = best ? Math.max(1.5, Math.min(A.dist, bd - W.cfg.enemies[best.type].radius - A.stop)) : A.dist;     // к цели — останавливается перед ней, а не пролетает за спину
    Object.assign(p, { state: 'dash', dashT: 0, dashDur: A.time * dist / A.dist, dashV: A.dist / A.time, dashX: Math.sin(p.face), dashZ: Math.cos(p.face), dashHit: [], dashMul: A.mul[r], dashKnock: A.knock, atkT: 0 });
    p.inv = Math.max(p.inv, A.time);
  },
  cry(W, A, r) {
    for (const e of near(W, A.r)) applyStatus(W, e, 'fear', 0, A.fear[r]);
    const ex = W.buffs.find(b => b.src === 'cry'); if (ex) ex.t = A.t; else W.buffs.push({ stat: 'armor', amt: A.armor[r], t: A.t, src: 'cry' });
  },
  whirl(W, A, r) { for (const e of near(W, A.r)) abilityHit(W, e, A.mul[r], { knock: A.knock }); W.shake = Math.max(W.shake, W.cfg.fx.shake * 1.6); },
  iron(W, A, r) { W.abuf.iron = A.t[r]; W.abuf.ironTaken = A.taken; },
  rage(W, A, r) { W.abuf.rage = A.t[r]; W.abuf.rageMul = 1 + A.dmg[r] / 100; W.abuf.rageSwing = A.swing; W.abuf.rageDrain = A.drain; },
  // Сойка
  leap(W, A, r) {                                  // отскок прочь от ближайшего врага и выстрел в него
    const p = W.player, { ang } = aimAt(W, A.range);
    abilityArrow(W, ang, A.mul[r]); p.face = ang;
    Object.assign(p, { state: 'dash', dashT: 0, dashDur: A.time, dashV: A.dist / A.time, dashX: -Math.sin(ang), dashZ: -Math.cos(ang), dashHit: [], dashMul: 0, dashKnock: 0 });
    p.inv = Math.max(p.inv, A.time);
  },
  volley(W, A, r) { const { ang } = aimAt(W, 16, 60); W.player.face = ang; for (let k = 0; k < A.n; k++) abilityArrow(W, ang + (k / (A.n - 1) - .5) * A.spread * Math.PI / 180, A.mul[r]); },
  trap(W, A, r) {
    const p = W.player; W.traps.push({ x: p.x + Math.sin(p.face) * A.ahead, z: p.z + Math.cos(p.face) * A.ahead, t: A.life, r: A.r, root: A.root[r], mul: A.mul[r], lvl: W.lvl });
    while (W.traps.length > A.max) W.traps.shift();
  },
  venom(W, A, r) { const { ang } = aimAt(W, 16, 60); W.player.face = ang; abilityArrow(W, ang, A.mul[r], { poison: [A.dps[r], A.t], pierce: A.pierce, kind: 'venom' }); },
  rain(W, A, r) {                                  // град: на ближайшего видимого врага или вперёд
    const p = W.player, { e } = aimAt(W, A.range), x = e ? e.x : p.x + Math.sin(p.face) * A.ahead, z = e ? e.z : p.z + Math.cos(p.face) * A.ahead;
    W.zones.push({ x, z, r: A.r, t: A.t, tick: A.tick, acc: 0, mul: A.mul[r], lvl: W.lvl });
  },
  // Вейл
  blink(W, A, r) {                                 // к врагу в конусе: встать за спину (если там стена — перед ним) и ударить
    const p = W.player, { e } = aimAt(W, A.range, A.cone); if (!e) return false;
    const dx = e.x - p.x, dz = e.z - p.z, d = len(dx, dz) || 1, ux = dx / d, uz = dz / d, R = W.cfg.enemies[e.type].radius + A.behind;
    const fx = p.x, fz = p.z; let tx = e.x + ux * R, tz = e.z + uz * R;
    if (insideOf(W.map, tx, tz) >= 0 || resolve(W.map, { x: tx, z: tz }, W.cfg.player.radius) || lineBlocked(W.map, e.x, e.z, tx, tz)) { tx = e.x - ux * R; tz = e.z - uz * R; }
    p.x = tx; p.z = tz; p.vx = p.vz = 0; p.face = Math.atan2(e.x - tx, e.z - tz);
    abilityHit(W, e, A.mul[r], { knock: .6 });
    W.ev.push({ k: 'blink', x: fx, z: fz, x2: tx, z2: tz });
  },
  parry(W, A, r) { W.abuf.parry = A.t[r]; W.abuf.parryStun = A.stun[r]; W.abuf.parryMul = A.mul[r]; },
  dance(W, A, r) { W.abuf.dance = A.t; W.abuf.danceGap = A.t / A.hits; W.abuf.danceAcc = W.abuf.danceGap; W.abuf.danceMul = A.mul[r]; W.abuf.danceR = A.r; W.player.inv = Math.max(W.player.inv, A.t * .5); },
  shadow(W, A, r) {
    const p = W.player; for (let i = W.allies.length - 1; i >= 0; i--) if (W.allies[i].decoy) W.allies.splice(i, 1);     // одна тень за раз
    W.allies.push({ id: W.aid++, guest: true, decoy: true, type: 'guest', name: 'Тень', x: p.x + Math.sin(p.face) * 1.2, z: p.z + Math.cos(p.face) * 1.2, vx: 0, vz: 0, face: p.face, hp: A.hp[r], maxhp: A.hp[r], state: 'idle', t: A.t[r], cd: 0, gap: A.hit, r: A.r, mul: A.mul[r], dead: false, deadT: 0, flash: 0, calm: 0, tgt: 0, moving: false, lvl: W.lvl });
  },
  execute(W, A, r) {
    const p = W.player, { e } = aimAt(W, A.reach + 1, A.cone); if (!e || len(e.x - p.x, e.z - p.z) > A.reach + W.cfg.enemies[e.type].radius) return false;
    if (!e.boss && e.hp / e.maxhp < A.kill[r]) { abilityHit(W, e, A.mul[r], { knock: 1.5 }); if (!e.dead) { e.hp = 0; W.fx.kill(e); } W.ev.push({ k: 'execute', x: e.x, z: e.z }); return; }
    abilityHit(W, e, A.mul[r] * (1 + (1 - e.hp / e.maxhp)), { knock: 1.5, stun: .4 });
  }
};

// рывок: двигает героя (sim.js, состояние 'dash') и бьёт каждого врага на пути один раз
export function dashStep(W) {
  const p = W.player;
  for (const e of W.enemies) {
    if (!p.dashMul || e.dead || p.dashHit.includes(e.id) || len(e.x - p.x, e.z - p.z) > W.cfg.abilities.thorn.charge.width / 2 + W.cfg.enemies[e.type].radius + .4) continue;
    p.dashHit.push(e.id); abilityHit(W, e, p.dashMul, { knock: p.dashKnock, heavy: true });
  }
}
// перезарядки и действие баффов умений
export function tickAbilities(W, dt) {
  for (const k of Object.keys(W.acd)) if ((W.acd[k] -= dt) <= 0) delete W.acd[k];
  const b = W.abuf, p = W.player;
  // капканы: первый враг, наступивший в круг, получает удар и корни; капкан пропадает (живут на своём уровне)
  W.traps = W.traps.filter(tp => tp.lvl === W.lvl && (tp.t -= dt) > 0);
  for (let i = W.traps.length - 1; i >= 0; i--) { const tp = W.traps[i], e = W.enemies.find(o => !o.dead && len(o.x - tp.x, o.z - tp.z) < tp.r + W.cfg.enemies[o.type].radius);
    if (e) { abilityHit(W, e, tp.mul, { knock: .1 }); applyStatus(W, e, 'root', 0, tp.root); W.ev.push({ k: 'trapSnap', x: tp.x, z: tp.z }); W.traps.splice(i, 1); } }
  // град стрел: удар по всем в круге каждые tick секунд
  W.zones = W.zones.filter(zn => zn.lvl === W.lvl && zn.t > 0);
  for (const zn of W.zones) { zn.t -= dt; zn.acc += dt; while (zn.acc >= zn.tick) { zn.acc -= zn.tick; for (const e of W.enemies) if (!e.dead && len(e.x - zn.x, e.z - zn.z) < zn.r + W.cfg.enemies[e.type].radius) abilityHit(W, e, zn.mul, { knock: .15 }); } }
  if (b.iron > 0) b.iron -= dt;
  if (b.parry > 0) b.parry -= dt;
  // танец клинков: удар каждые danceGap секунд по ближнему врагу вокруг
  if (b.dance > 0) { b.dance -= dt; b.danceAcc += dt;
    while (b.danceAcc >= b.danceGap) { b.danceAcc -= b.danceGap; const list = near(W, b.danceR); if (!list.length) break; const e = list.reduce((a, o) => (len(o.x - p.x, o.z - p.z) < len(a.x - p.x, a.z - p.z) ? o : a)); p.face = Math.atan2(e.x - p.x, e.z - p.z); abilityHit(W, e, b.danceMul, { knock: .3 }); W.ev.push({ k: 'danceHit', x: e.x, z: e.z }); } }
  // тень-двойник: стоит, режет ближнего, тает по времени; на другом уровне пропадает
  for (let i = W.allies.length - 1; i >= 0; i--) { const a = W.allies[i]; if (!a.decoy) continue;
    if (a.lvl !== W.lvl || a.dead || (a.t -= dt) <= 0) { if (!a.dead) W.ev.push({ k: 'shadowEnd', x: a.x, z: a.z }); W.allies.splice(i, 1); continue; }
    if (a.flash > 0) a.flash -= dt;
    if ((a.cd -= dt) <= 0) { let best = null, bd = a.r; for (const e of W.enemies) { if (e.dead) continue; const d = len(e.x - a.x, e.z - a.z) - W.cfg.enemies[e.type].radius; if (d < bd) { bd = d; best = e; } }
      if (best) { a.cd = a.gap; a.face = Math.atan2(best.x - a.x, best.z - a.z); const hp0 = best.hp; abilityHit(W, best, a.mul, { knock: .4 }); W.ev.push({ k: 'shadowHit', x: best.x, z: best.z, dmg: hp0 - best.hp }); } } }
  if (b.rage > 0) { b.rage -= dt; if (!p.dead && p.hp > 1) p.hp = Math.max(1, p.hp - b.rageDrain * dt); }
}
// для интерфейса: список умений героя с состоянием
export function abilityView(W) {
  return heroAbilities(W).map((a, i) => {
    const A = cfgOf(W, a.id), L = rankLvs(W.cfg, i), rank = W.ab[a.id] || 0, r = rankIdx(W.cfg, i, Math.max(1, rank));
    return { ...a, slot: i, lv: L[0], max: L.length, nextLv: rank < L.length ? L[rank] : 0, rank, open: W.lv >= L[0], cd: W.acd[a.id] || 0, cdMax: A.cd[r], now: rank ? a.text(A, r) : '', next: rank < L.length ? a.text(A, rankIdx(W.cfg, i, rank + 1)) : '' };
  });
}
