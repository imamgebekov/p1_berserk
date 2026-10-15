// Активные умения (B3): очки умений, ранги, перезарядки и действия. Действия собраны из того, что уже есть в бою:
// удар по врагу (abilityHit), статусы (страх, оглушение), баффы (броня), рывок (состояние героя 'dash').
import { ABILITIES } from './data/abilities3d.js';
import { abilityHit, abilityArrow } from './sim.js';
import { lineBlocked } from './map.js';
import { applyStatus } from './status3d.js';
import { len } from './util3d.js';

export const heroAbilities = W => ABILITIES[W.hero] || [];
const cfgOf = (W, id) => (W.cfg.abilities[W.hero] || {})[id];
export const unlockLv = (W, i) => W.cfg.abilities.unlock[i];
// очков умений за уровень lv: по одному за каждый уровень с from-го
export const abilityPoints = (lv, cfg) => Math.max(0, lv - cfg.abilities.from + 1);
export const spentAbility = ab => Object.values(ab || {}).reduce((a, b) => a + b, 0);

// можно ли улучшить: 'ok' | 'lvl' (рано) | 'max' | 'points'
export function canUpgrade(W, id) {
  const i = heroAbilities(W).findIndex(a => a.id === id); if (i < 0) return 'none';
  if (W.lv < unlockLv(W, i)) return 'lvl';
  if ((W.ab[id] || 0) >= W.cfg.abilities.maxRank) return 'max';
  return W.ap > 0 ? 'ok' : 'points';
}
export function upgradeAbility(W, id) { const r = canUpgrade(W, id); if (r !== 'ok') return r; W.ab[id] = (W.ab[id] || 0) + 1; W.ap--; return 'ok'; }
export const respecAbilityCost = W => W.cfg.abilities.respec * W.lv;
export function respecAbilities(W) {
  const spent = spentAbility(W.ab); if (!spent) return 'none';
  const cost = respecAbilityCost(W); if (W.inv.ash < cost) return 'ash';
  W.inv.ash -= cost; W.ap += spent; W.ab = {}; W.acd = {}; return 'ok';
}

// применить умение слота i (0–4): 'ok' | 'none' | 'rank' (не вкачано) | 'cd' | 'busy'
export function useAbility(W, i) {
  const def = heroAbilities(W)[i], p = W.player; if (!def) return 'none';
  const rank = W.ab[def.id] || 0; if (!rank) return 'rank';
  if ((W.acd[def.id] || 0) > 0) return 'cd';
  if (p.dead || p.state === 'roll' || p.state === 'dash') return 'busy';
  const A = cfgOf(W, def.id), r = rank - 1;
  ACT[def.id](W, A, r);
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
    Object.assign(p, { state: 'dash', dashT: 0, dashDur: A.time, dashV: A.dist / A.time, dashX: Math.sin(p.face), dashZ: Math.cos(p.face), dashHit: [], dashMul: A.mul[r], dashKnock: A.knock, atkT: 0 });
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
  if (b.rage > 0) { b.rage -= dt; if (!p.dead && p.hp > 1) p.hp = Math.max(1, p.hp - b.rageDrain * dt); }
}
// для интерфейса: список умений героя с состоянием
export function abilityView(W) {
  return heroAbilities(W).map((a, i) => {
    const A = cfgOf(W, a.id), rank = W.ab[a.id] || 0, r = Math.max(0, rank - 1);
    return { ...a, slot: i, lv: unlockLv(W, i), rank, open: W.lv >= unlockLv(W, i), cd: W.acd[a.id] || 0, cdMax: A.cd[r], now: rank ? a.text(A, r) : '', next: rank < W.cfg.abilities.maxRank ? a.text(A, rank) : '' };
  });
}
