// Активные умения (B3): очки умений, ранги, перезарядки и действия. Действия собраны из того, что уже есть в бою:
// удар по врагу (abilityHit), статусы (страх, оглушение), баффы (броня), рывок (состояние героя 'dash').
import { ABILITIES, rankLvs, abilityPointsAt, rankIdx } from './data/abilities3d.js';
import { abilityHit, abilityArrow } from './sim.js';
import { lineBlocked, insideOf, resolve } from './map.js';
import { applyStatus } from './status3d.js';
import { len } from './util3d.js';
import { resTick, resNow, resSpend, resOf, resMax } from './resource3d.js';
import { comboFor, boosted, noteAbility } from './combos3d.js';
import { withTalents } from './data/skills3d.js';

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
export function upgradeAbility(W, id) { const r = canUpgrade(W, id); if (r !== 'ok') return r; W.ab[id] = (W.ab[id] || 0) + 1; W.ap--; if (W.ab[id] === 1) autoBar(W, id); return 'ok'; }
// панель умений (2026-10-18): 5 ячеек (клавиши 1–5), в каждой — id изученного умения или null; изученное умение само встаёт
// в первую пустую ячейку; игрок переставляет в окне «Навыки»
export const BAR = 5;
export function barOf(W) {
  const learned = heroAbilities(W).filter(a => (W.ab[a.id] || 0) > 0).map(a => a.id), own = new Set(learned);
  if (!W.bar || !W.bar.length) return Array.from({ length: BAR }, (_, i) => learned[i] || null);     // старое сохранение: изученные по порядку
  const bar = Array.from({ length: BAR }, (_, i) => (own.has(W.bar[i]) ? W.bar[i] : null));
  for (let i = 0; i < BAR; i++) if (bar[i] && bar.indexOf(bar[i]) !== i) bar[i] = null;     // без повторов
  return bar;
}
function autoBar(W, id) { const bar = barOf(W); if (!bar.includes(id)) { const i = bar.indexOf(null); if (i >= 0) bar[i] = id; } W.bar = bar; }
// поставить умение id в ячейку slot (если оно уже в другой ячейке — меняются местами); null — освободить ячейку
export function setBar(W, slot, id) {
  const bar = barOf(W); if (slot < 0 || slot >= BAR) return false;
  if (id && !(W.ab[id] > 0)) return false;
  const was = id ? bar.indexOf(id) : -1; if (was >= 0) bar[was] = bar[slot]; bar[slot] = id || null; W.bar = bar; return true;
}
// применить умение из ячейки slot (0–4)
export function useSlot(W, slot) { const id = barOf(W)[slot]; if (!id) return 'none'; return useAbility(W, heroAbilities(W).findIndex(a => a.id === id)); }
export const respecAbilityCost = W => W.cfg.abilities.respec * W.lv;
export function respecAbilities(W) {
  const spent = spentAbility(W.ab); if (!spent) return 'none';
  const cost = respecAbilityCost(W); if (W.inv.ash < cost) return 'ash';
  W.inv.ash -= cost; W.ap += spent; W.ab = {}; W.acd = {}; W.bar = []; return 'ok';
}

// применить умение слота i (0–4): 'ok' | 'none' | 'rank' (не вкачано) | 'cd' | 'res' (мало ресурса) | 'busy' | 'target' (некого бить — ни ресурс, ни перезарядка не тратятся)
export function useAbility(W, i) {
  const def = heroAbilities(W)[i], p = W.player; if (!def) return 'none';
  const rank = W.ab[def.id] || 0; if (!rank) return 'rank';
  if ((W.acd[def.id] || 0) > 0) return 'cd';
  if (p.dead || p.state === 'roll' || p.state === 'dash') return 'busy';
  const A = withTalents(cfgOf(W, def.id), W.talAb && W.talAb[def.id]), r = rankIdx(W.cfg, i, rank), cost = A.cost || 0;     // таланты (этап 2)
  if (resNow(W) < cost) return 'res';
  const cb = comboFor(W, def.id);                    // связка: прошлое умение — первое в паре, окно открыто
  W.cmb = cb ? { id: cb.id, ...W.cfg.combos[cb.id] } : null;
  let res; try { res = ACT[def.id](W, cb ? boosted(A, W.cfg.combos[cb.id]) : A, r); } finally { W.cmb = null; }
  if (res === false) return 'target';
  resSpend(W, cost); W.acd[def.id] = A.cd[r]; noteAbility(W, def.id);
  W.ev.push({ k: 'ability', id: def.id, x: p.x, z: p.z, face: p.face });
  if (cb) W.ev.push({ k: 'combo', id: cb.id, name: cb.name, x: p.x, z: p.z });
  return 'ok';
}
// угол на ближайшего видимого врага в пределах range (cone — только в конусе ±cone° перед героем); нет — куда смотрит герой
function aimAt(W, range, cone = 180) {
  const p = W.player, A = W.aimPt && len(W.aimPt.x - p.x, W.aimPt.z - p.z) > .3 ? Math.atan2(W.aimPt.x - p.x, W.aimPt.z - p.z) : null, base = A ?? p.face; let best = null, bd = range;     // курсор: конус вокруг курсора
  if (A !== null) cone = Math.min(cone, W.cfg.player.aimCone);
  for (const e of W.enemies) { if (e.dead) continue; const dx = e.x - p.x, dz = e.z - p.z, d = len(dx, dz); let a = Math.atan2(dx, dz) - base; a = Math.atan2(Math.sin(a), Math.cos(a));
    if (d < bd && Math.abs(a) <= cone * Math.PI / 180 && !lineBlocked(W.map, p.x, p.z, e.x, e.z)) { bd = d; best = e; } }
  return best ? { ang: Math.atan2(best.x - p.x, best.z - p.z), e: best } : { ang: base, e: null };
}
// точка умения по площади: ближайший видимый враг в range или ahead м впереди
const spot = (W, A) => { const p = W.player; if (W.aimPt) { const dx = W.aimPt.x - p.x, dz = W.aimPt.z - p.z, d = len(dx, dz), k = d > A.range ? A.range / d : 1; return { x: p.x + dx * k, z: p.z + dz * k }; }     // курсор: точка под курсором (не дальше range)
  const { e } = aimAt(W, A.range); return e ? { x: e.x, z: e.z } : { x: p.x + Math.sin(p.face) * A.ahead, z: p.z + Math.cos(p.face) * A.ahead }; };
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
  whirl(W, A, r) { const C = W.cmb; for (const e of near(W, A.r)) abilityHit(W, e, A.mul[r] * (C && C.id === 'rift' && e.st && e.st.root ? C.k : 1), { knock: A.knock }); W.shake = Math.max(W.shake, W.cfg.fx.shake * 1.6); },     // «Разлом»: по корням сильнее
  iron(W, A, r) { W.abuf.iron = A.t[r]; W.abuf.ironTaken = A.taken; },
  rage(W, A, r) { W.abuf.rage = A.t[r]; W.abuf.rageMul = 1 + A.dmg[r] / 100; W.abuf.rageSwing = A.swing; W.abuf.rageDrain = A.drain; },
  bash(W, A, r) {                                  // конус перед собой: удар и оглушение (доворот на ближайшего)
    const p = W.player, { ang } = aimAt(W, A.r + 1); p.face = ang; let hit = 0;
    for (const e of near(W, A.r)) { const d = Math.atan2(e.x - p.x, e.z - p.z) - p.face; if (Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) > A.cone / 2 * Math.PI / 180) continue;
      const fear = W.cmb && W.cmb.id === 'dread' && e.st && e.st.fear;     // «Устрашение»: испуганных оглушает дольше
      abilityHit(W, e, A.mul[r], { knock: A.knock }); if (!e.dead) applyStatus(W, e, 'stun', 0, A.stun[r] * (fear ? W.cmb.stun : 1)); hit++; }
    if (!hit) return false;
  },
  quake(W, A, r) {
    const p = W.player; for (const e of near(W, A.r)) { abilityHit(W, e, A.mul[r], { knock: .3 }); if (!e.dead) applyStatus(W, e, 'root', 0, A.root[r]); }
    W.shake = Math.max(W.shake, W.cfg.fx.shake * 2); W.ev.push({ k: 'quake', x: p.x, z: p.z, r: A.r });
  },
  blood(W, A, r) { W.abuf.blood = A.t[r]; W.abuf.bloodLeech = A.leech[r]; },
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
  frost(W, A, r) { const { ang } = aimAt(W, 16, 60); W.player.face = ang; abilityArrow(W, ang, A.mul[r], { freeze: A.freeze[r], pierce: W.cmb && W.cmb.id === 'aimcold' ? W.cmb.pierce : 0 }); },     // «Прицельный холод» — насквозь
  firearrow(W, A, r) { const { ang } = aimAt(W, 16, 60); W.player.face = ang; abilityArrow(W, ang, A.mul[r], { blast: { r: A.r, k: A.splash, dps: A.dps[r], t: A.t } }); },
  hawk(W, A, r) { W.abuf.hawk = A.t[r]; W.abuf.hawkCrit = A.crit[r] / 100; },
  rain(W, A, r) {                                  // град: на ближайшего видимого врага или вперёд
    const p = W.player, C = W.cmb, held = C && C.id === 'snare' ? W.enemies.find(o => !o.dead && o.st && o.st.root && len(o.x - p.x, o.z - p.z) < A.range) : null;     // «Западня»: на пойманного
    let { e } = aimAt(W, A.range); if (held) e = held; const x = e ? e.x : p.x + Math.sin(p.face) * A.ahead, z = e ? e.z : p.z + Math.cos(p.face) * A.ahead;
    W.zones.push({ x, z, r: A.r, t: A.t, tick: A.tick, acc: 0, mul: A.mul[r], lvl: W.lvl, slow: C && C.id === 'icehail' ? C.slow : 0 });     // «Ледяной град» замедляет
  },
  // Вейл
  blink(W, A, r) {                                 // к врагу в конусе: встать за спину (если там стена — перед ним) и ударить
    const p = W.player, { e } = aimAt(W, A.range, A.cone); if (!e) return false;
    const dx = e.x - p.x, dz = e.z - p.z, d = len(dx, dz) || 1, ux = dx / d, uz = dz / d, R = W.cfg.enemies[e.type].radius + A.behind;
    const fx = p.x, fz = p.z; let tx = e.x + ux * R, tz = e.z + uz * R;
    if (insideOf(W.map, tx, tz) >= 0 || resolve(W.map, { x: tx, z: tz }, W.cfg.player.radius) || lineBlocked(W.map, e.x, e.z, tx, tz)) { tx = e.x - ux * R; tz = e.z - uz * R; }
    p.x = tx; p.z = tz; p.vx = p.vz = 0; p.face = Math.atan2(e.x - tx, e.z - tz);
    abilityHit(W, e, A.mul[r], { knock: .6, forceCrit: !!(W.cmb && W.cmb.id === 'shadowstrike') });     // «Удар из тени» — верный крит
    W.ev.push({ k: 'blink', x: fx, z: fz, x2: tx, z2: tz });
  },
  parry(W, A, r) { W.abuf.parry = A.t[r]; W.abuf.parryStun = A.stun[r]; W.abuf.parryMul = A.mul[r]; },
  dance(W, A, r) { W.abuf.twin = !!(W.cmb && W.cmb.id === 'twindance'); W.abuf.dance = A.t; W.abuf.danceGap = A.t / A.hits; W.abuf.danceAcc = W.abuf.danceGap; W.abuf.danceMul = A.mul[r]; W.abuf.danceR = A.r; W.player.inv = Math.max(W.player.inv, A.t * .5); },
  shadow(W, A, r) {
    const p = W.player; for (let i = W.allies.length - 1; i >= 0; i--) if (W.allies[i].decoy) W.allies.splice(i, 1);     // одна тень за раз
    W.allies.push({ id: W.aid++, guest: true, decoy: true, type: 'guest', name: 'Тень', x: p.x + Math.sin(p.face) * 1.2, z: p.z + Math.cos(p.face) * 1.2, vx: 0, vz: 0, face: p.face, hp: A.hp[r], maxhp: A.hp[r], state: 'idle', t: A.t[r], cd: 0, gap: A.hit, r: A.r, mul: A.mul[r], dead: false, deadT: 0, flash: 0, calm: 0, tgt: 0, moving: false, lvl: W.lvl });
  },
  fan(W, A, r) { const { ang } = aimAt(W, 12, 60); W.player.face = ang; for (let k = 0; k < A.n; k++) abilityArrow(W, ang + (k / (A.n - 1) - .5) * A.spread * Math.PI / 180, A.mul[r], { bleed: [A.dps[r], A.t] }); },
  smoke(W, A, r) {                                 // враги рядом теряют героя; короткая «невидимость» и скорость
    const p = W.player; for (const e of near(W, A.r)) { e.alert = false; if (e.state === 'chase' || e.state === 'wind') { e.state = 'rec'; e.t = 0; } }
    W.abuf.smoke = A.hide; const ex = W.buffs.find(b => b.src === 'smoke'); if (ex) ex.t = A.t[r]; else W.buffs.push({ stat: 'spd', amt: A.spd[r], t: A.t[r], src: 'smoke' });
    W.ev.push({ k: 'smoke', x: p.x, z: p.z, r: A.r });
  },
  bloodlet(W, A, r) { const list = near(W, A.r), C = W.cmb; if (!list.length) return false; for (const e of list) { abilityHit(W, e, A.mul[r] * (C && C.id === 'bloodfan' && e.st && e.st.bleed ? C.k : 1), { knock: .4 });     // «Кровавый веер»
 if (!e.dead) applyStatus(W, e, 'bleed', A.dps[r], A.t); } },
  // Ирга
  fireball(W, A, r) { const { ang } = aimAt(W, 16, 60); W.player.face = ang; abilityArrow(W, ang, A.mul[r], { blast: { r: A.r, k: A.splash, dps: A.dps[r], t: A.t }, kind: 'orb', detonate: W.cmb && W.cmb.id === 'detonate' ? W.cmb : null }); },     // «Взрыв облака»
  nova(W, A, r) { const p = W.player, C = W.cmb; for (const e of near(W, A.r)) { abilityHit(W, e, A.mul[r], { knock: .8 }); if (!e.dead) applyStatus(W, e, 'freeze', 0, A.freeze[r]); } W.ev.push({ k: 'nova', x: p.x, z: p.z, r: A.r });
    if (C && C.id === 'icearmor') { const ex = W.buffs.find(b => b.src === 'icearmor'); if (ex) ex.t = C.t; else W.buffs.push({ stat: 'armor', amt: C.armor, t: C.t, src: 'icearmor' }); } },     // «Ледяная броня»
  chain(W, A, r) {                                 // молния: цель впереди, потом прыжки к ближайшим ещё не задетым
    const { e } = aimAt(W, A.range, 70); if (!e) return false;
    const p = W.player; p.face = Math.atan2(e.x - p.x, e.z - p.z); let cur = e, from = p, m = A.mul[r]; const done = new Set();
    for (let i = 0; cur && i <= A.jumps[r]; i++) {
      done.add(cur); W.ev.push({ k: 'chain', x: from.x, z: from.z, x2: cur.x, z2: cur.z });
      const dmg = abilityHit(W, cur, m, { knock: .3 }); if (!cur.dead) applyStatus(W, cur, 'shock', dmg, W.cfg.elements.mark.shock); if (!cur.dead && W.cmb && W.cmb.id === 'frozenstorm') applyStatus(W, cur, 'slow', W.cmb.slow, 2);     // «Ледяная гроза» замедляет
      from = cur; m *= A.fall; let best = null, bd = A.hop; for (const o of W.enemies) { if (o.dead || done.has(o)) continue; const d = len(o.x - from.x, o.z - from.z); if (d < bd) { bd = d; best = o; } } cur = best;
    }
  },
  cloud(W, A, r) { const at = spot(W, A); W.ezones.push({ kind: 'cloud', x: at.x, z: at.z, r: A.r, t: A.t, tick: A.tick, acc: 0, lvl: W.lvl, dps: A.dps[r] }); },
  meteor(W, A, r) { const at = spot(W, A); (W.meteors = W.meteors || []).push({ x: at.x, z: at.z, t: A.delay, r: A.r, mul: A.mul[r], burn: A.burn, lvl: W.lvl }); W.ev.push({ k: 'meteorMark', x: at.x, z: at.z, r: A.r, t: A.delay }); },
  shield(W, A, r) { W.abuf.mshield = A.t[r]; W.abuf.mshieldK = A.absorb[r]; },
  blizzard(W, A, r) { const at = spot(W, A); W.zones.push({ x: at.x, z: at.z, r: A.r, t: A.t, tick: A.tick, acc: 0, mul: A.mul[r], lvl: W.lvl, slow: A.slow, snow: true }); },
  spear(W, A, r) {
    const p = W.player, { e } = aimAt(W, A.range, A.cone); if (!e) return false;
    p.face = Math.atan2(e.x - p.x, e.z - p.z); W.ev.push({ k: 'spear', x: p.x, z: p.z, x2: e.x, z2: e.z });
    abilityHit(W, e, A.mul[r] * (W.cmb && W.cmb.id === 'breach' && e.st && e.st.shock ? W.cmb.k : 1), { knock: 1.5, heavy: true });     // «Пробой»: по «разряду» сильнее
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
    if (!p.dashMul || e.dead || p.dashHit.includes(e.id) || len(e.x - p.x, e.z - p.z) > (p.dashW || W.cfg.abilities.thorn.charge.width) / 2 + W.cfg.enemies[e.type].radius + .4) continue;
    p.dashHit.push(e.id); abilityHit(W, e, p.dashMul, { knock: p.dashKnock, heavy: true, mix: !!p.dashMix });     // dashMix — выпад умения оружия
  }
}
// перезарядки и действие баффов умений
export function tickAbilities(W, dt) {
  resTick(W, dt);     // ресурс героя: восстановление и угасание
  for (const k of Object.keys(W.acd)) if ((W.acd[k] -= dt) <= 0) delete W.acd[k];
  const b = W.abuf, p = W.player;
  // капканы: первый враг, наступивший в круг, получает удар и корни; капкан пропадает (живут на своём уровне)
  W.traps = W.traps.filter(tp => tp.lvl === W.lvl && (tp.t -= dt) > 0);
  for (let i = W.traps.length - 1; i >= 0; i--) { const tp = W.traps[i], e = W.enemies.find(o => !o.dead && len(o.x - tp.x, o.z - tp.z) < tp.r + W.cfg.enemies[o.type].radius);
    if (e) { abilityHit(W, e, tp.mul, { knock: .1 }); applyStatus(W, e, 'root', 0, tp.root); W.ev.push({ k: 'trapSnap', x: tp.x, z: tp.z }); W.traps.splice(i, 1); } }
  // град стрел: удар по всем в круге каждые tick секунд
  W.zones = W.zones.filter(zn => zn.lvl === W.lvl && zn.t > 0);
  for (const zn of W.zones) { zn.t -= dt; zn.acc += dt; while (zn.acc >= zn.tick) { zn.acc -= zn.tick; for (const e of W.enemies) if (!e.dead && len(e.x - zn.x, e.z - zn.z) < zn.r + W.cfg.enemies[e.type].radius) { abilityHit(W, e, zn.mul, { knock: zn.snow ? .05 : .15 }); if (zn.slow && !e.dead) applyStatus(W, e, 'slow', zn.slow, zn.tick + .3); } } }     // вьюга ещё и замедляет
  // метеоры Ирги: через delay с падают в круг — удар и горение (живут на своём уровне)
  W.meteors = (W.meteors || []).filter(m => m.lvl === W.lvl);
  for (let i = W.meteors.length - 1; i >= 0; i--) { const m = W.meteors[i]; if ((m.t -= dt) > 0) continue; W.meteors.splice(i, 1); W.ev.push({ k: 'meteor', x: m.x, z: m.z, r: m.r }); W.shake = Math.max(W.shake, W.cfg.fx.shake * 2);
    for (const e of W.enemies) if (!e.dead && len(e.x - m.x, e.z - m.z) < m.r + W.cfg.enemies[e.type].radius) { abilityHit(W, e, m.mul, { knock: 1 }); if (!e.dead) applyStatus(W, e, 'burn', m.burn[0], m.burn[1]); } }
  if (b.mshield > 0) b.mshield -= dt;
  if (b.iron > 0) b.iron -= dt;
  for (const k of ['blood', 'hawk', 'smoke']) if (b[k] > 0) b[k] -= dt;     // баффы новых умений
  if (b.parry > 0) b.parry -= dt;
  // танец клинков: удар каждые danceGap секунд по ближнему врагу вокруг
  if (b.dance > 0) { b.dance -= dt; b.danceAcc += dt;
    while (b.danceAcc >= b.danceGap) { b.danceAcc -= b.danceGap; const list = near(W, b.danceR); if (!list.length) break; const e = list.reduce((a, o) => (len(o.x - p.x, o.z - p.z) < len(a.x - p.x, a.z - p.z) ? o : a)); p.face = Math.atan2(e.x - p.x, e.z - p.z); abilityHit(W, e, b.danceMul, { knock: .3 }); W.ev.push({ k: 'danceHit', x: e.x, z: e.z });
      const tw = b.twin && W.allies.find(q => q.decoy && !q.dead); if (tw) { const o = W.enemies.filter(q => !q.dead && len(q.x - tw.x, q.z - tw.z) < b.danceR + W.cfg.enemies[q.type].radius).sort((u, v) => len(u.x - tw.x, u.z - tw.z) - len(v.x - tw.x, v.z - tw.z))[0]; if (o) { tw.face = Math.atan2(o.x - tw.x, o.z - tw.z); abilityHit(W, o, b.danceMul, { knock: .3 }); W.ev.push({ k: 'danceHit', x: o.x, z: o.z }); } } } }     // «Двойной танец»: тень тоже режет
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
    const A = withTalents(cfgOf(W, a.id), W.talAb && W.talAb[a.id]), L = rankLvs(W.cfg, i), rank = W.ab[a.id] || 0, r = rankIdx(W.cfg, i, Math.max(1, rank));
    return { ...a, slot: i, lv: L[0], max: L.length, nextLv: rank < L.length ? L[rank] : 0, rank, open: W.lv >= L[0], cd: W.acd[a.id] || 0, cdMax: A.cd[r], cost: A.cost || 0, enough: resNow(W) >= (A.cost || 0), now: rank ? a.text(A, r) : '', next: rank < L.length ? a.text(A, rankIdx(W.cfg, i, rank + 1)) : '' };
  });
}
// ресурс героя для интерфейса: { name, color, now, max }
export function resView(W) { const R = resOf(W); return R ? { name: R.name, color: R.color, now: resNow(W), max: resMax(W, R) } : null; }
