// Боссы: автомат атак (ожидание → предупреждение → удар → восстановление), фазы по здоровью, ярость, возврат в логово.
// Урон и порождение врагов идут через W.fx (из sim.js). Предупреждение лежит в e.b.atk: рендер рисует его, пока оно активно.
import { threatPick } from './threat3d.js';
const len = (x, z) => Math.hypot(x, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;
const HINT = { blink: ' — уйдите с метки', pull: ' — бегите прочь от босса', safe: ' — встаньте в зелёный круг', meteor: ' — уходите с меток' };     // подсказка к своему приёму (4.18б)

export function initBoss(W, e, def) {
  const S = W.cfg.bosses.sig && W.cfg.bosses.sig[def.type];     // свои приёмы и вторая стадия (4.18б)
  if (S) def = { ...def, attacks: def.attacks.concat(S.attacks || []), drain: S.drain || 0, stage2: S.stage2 || null };
  e.boss = true; e.alert = false;
  e.b = { def, extra: [], home: { x: e.x, z: e.z }, t: 0, cd: 1.5, atk: null, state: 'idle', done: new Set(), enraged: false, cds: {}, last: -1, dash: null, minions: [] };
}
// новый приём на первой фазе (этап 2 «круче», cfg.bosses.phaseMoves): первый из луж, кольца, рывка и луча, которого у босса нет (луч долгий — последним)
const PHASE_MOVES = ['pools', 'nova', 'charge', 'beam'], MOVE_NAME = { beam: 'луч', pools: 'огненные лужи', nova: 'кольцо', charge: 'рывок' };
const atkList = b => (b.extra && b.extra.length ? b.def.attacks.concat(b.extra) : b.def.attacks);     // свои атаки + добавленные фазой
export function phaseMove(def, T) { const has = new Set(def.attacks.map(a => a.kind)), k = PHASE_MOVES.find(m => !has.has(m) && T[m]); return k ? { ...T[k], mv: true } : null; }     // mv — метка нового приёма

// герой sec секунд был на другом уровне (в подземелье): босс уже вернулся в логово и лечился, как после ухода за поводок
export function bossAway(W, e, sec) {
  const b = e.b; if (!b || e.dead || sec <= 0) return;
  e.alert = false; b.atk = null; b.state = 'idle'; b.dash = null; e.vx = e.vz = 0;
  e.x = b.home.x; e.z = b.home.z;
  e.hp = Math.min(e.maxhp, e.hp + e.maxhp * W.cfg.bosses.homeHeal * sec);
}

export function updateBoss(W, e, dt, spd) {
  const B = W.cfg.bosses, C = W.cfg.enemies[e.type], b = e.b, p = W.player;
  const foc = e.alert && !p.dead ? threatPick(W, e, len(p.x - e.x, p.z - e.z), dt) : null; e.tgt = foc ? foc.id : 0;     // угроза (этап 4): защитник держит босса на себе
  const dx = (foc || p).x - e.x, dz = (foc || p).z - e.z, d = len(dx, dz) || 1e-6;
  const enr = b.enraged;
  for (const k of Object.keys(b.cds)) if ((b.cds[k] -= dt) <= 0) delete b.cds[k];
  b.minions = b.minions.filter(m => !m.dead && W.enemies.includes(m));     // ушедший с уровня призванный — больше не подмога (щит не залипает)

  // фазы по доле здоровья
  const frac = e.hp / e.maxhp;
  b.def.phases.forEach((ph, i) => {
    if (b.done.has(i) || frac > ph.at) return;
    b.done.add(i);
    if (B.phaseMoves && b.done.size === 1 && !b.newMove) { const a = phaseMove(b.def, B.phaseMoves); if (a) { b.newMove = a.kind; (b.extra || (b.extra = [])).push(a); W.ev.push({ k: 'bossphase', name: C.name, what: 'новый приём: ' + MOVE_NAME[a.kind], x: e.x, z: e.z }); } }
    if (ph.enrage) { b.enraged = true; W.ev.push({ k: 'bossphase', name: C.name, what: 'ярость', x: e.x, z: e.z }); }
    if (ph.summon) summon(W, e, ph.summon.type, ph.summon.n);
    if (ph.say) W.ev.push({ k: 'bossSay', who: ph.who || C.name, text: ph.say });     // реплика в бою (рейд: Пятый)
    if (ph.shield && b.minions.length) { b.shield = true; b.shieldHp = e.hp; W.ev.push({ k: 'bossphase', name: C.name, what: 'щит: сперва убейте подмогу', x: e.x, z: e.z }); }     // этап 5: неуязвим, пока жива подмога
  });
  if (b.shield) { if (!b.minions.length) { b.shield = false; W.ev.push({ k: 'bossphase', name: C.name, what: 'щит пал', x: e.x, z: e.z }); } else e.hp = Math.max(e.hp, b.shieldHp); }
  if (b.def.drain && b.minions.length && e.alert) e.hp = Math.min(e.maxhp, e.hp + e.maxhp * b.def.drain * dt);     // подпитка (4.18б): лечится, пока жива подмога

  // возврат в логово: герой далеко или мёртв
  const homeD = len(e.x - b.home.x, e.z - b.home.z);
  if (p.dead || len(p.x - b.home.x, p.z - b.home.z) > B.leash || (!e.alert && homeD > 2)) {
    e.alert = false; b.atk = null; b.state = 'idle'; b.dash = null;
    if (homeD > 1) { const hx = b.home.x - e.x, hz = b.home.z - e.z, hd = len(hx, hz); W.fx.slide(e, hx / hd * C.speed * 1.5 * dt, hz / hd * C.speed * 1.5 * dt, C.radius); e.face = Math.atan2(hx, hz); }
    e.hp = Math.min(e.maxhp, e.hp + e.maxhp * B.homeHeal * dt);
    if (len(p.x - b.home.x, p.z - b.home.z) < B.aggro && !p.dead) e.alert = true;
    return;
  }
  if (!e.alert) { if (d < B.aggro) { e.alert = true; W.ev.push({ k: 'bossaggro', name: C.name, id: e.id }); } else return; }

  b.t += dt;
  const dmgMul = (enr ? B.enrageDmg : 1) * (e.dmgMul || 1);
  if (b.state === 'wind') {
    const a = b.atk; a.t += dt;
    if (a.kind === 'cast' && (b.kick || a.hp0 - e.hp >= a.brk * e.maxhp)) {     // сбили чтение: тяжёлый удар, умение, защитник отряда или много урона
      b.state = 'rec'; b.t = -a.stun; b.atk = null; b.kick = false; W.ev.push({ k: 'bossInterrupt', name: C.name, what: a.name, x: e.x, z: e.z }); return;
    }
    if (a.kind === 'charge' && a.t < a.wind) e.face = Math.atan2(a.dx, a.dz);
    else if (a.kind !== 'charge') e.face = Math.atan2(dx, dz);
    if (a.t >= a.wind) strikeAttack(W, e, a, dmgMul, C);
    return;
  }
  if (b.state === 'dash') {
    const a = b.atk, step = a.speed * dt; a.run += step;
    W.fx.slide(e, a.dx * step, a.dz * step, C.radius);
    if (!a.hit && distSeg(p.x, p.z, a.x0, a.z0, e.x, e.z) < a.width / 2 + W.cfg.player.radius) { a.hit = true; W.fx.hurtP(Math.round(C.damage * a.mul * dmgMul), e.x, e.z, C.on); }
    for (const al of W.allies) if (!al.dead && !a.hitAllies.has(al.id) && distSeg(al.x, al.z, a.x0, a.z0, e.x, e.z) < a.width / 2 + .5) { a.hitAllies.add(al.id); W.fx.hurtA(al, Math.round(C.damage * a.mul * dmgMul), e); }
    if (a.run >= a.len) { b.state = 'rec'; b.t = 0; b.atk = null; }
    return;
  }
  if (b.state === 'beam') { beamTick(W, e, b.atk, dmgMul, C, dt); return; }
  if (b.state === 'rec') { if (b.t >= C.recover) { b.state = 'idle'; b.t = 0; } return; }

  // idle: идти к герою, выбирать атаку
  b.cd -= dt * (enr ? 1 / B.enrageCd : 1);
  const sp = spd * (enr ? B.enrageSpeed : 1);
  const melee = atkList(b).find(a => a.kind === 'slam');
  if (d > C.range * .8) { W.fx.slide(e, dx / d * sp * dt, dz / d * sp * dt, C.radius); e.face = Math.atan2(dx, dz); }
  if (b.cd > 0) return;
  const opts = atkList(b).map((a, i) => ({ a, i })).filter(o => !b.cds[o.i] && d <= o.a.range && o.i !== b.last);
  if (!opts.length) { const m = atkList(b).map((a, i) => ({ a, i })).filter(o => !b.cds[o.i] && d <= o.a.range); if (!m.length) return; opts.push(m[0]); }
  const pick = opts[Math.floor(W.rng() * opts.length)];
  beginAttack(W, e, pick.a, pick.i, dx, dz, d);
}

function beginAttack(W, e, a, i, dx, dz, d) {
  const b = e.b, B = W.cfg.bosses, enr = b.enraged;
  b.last = i; b.cds[i] = a.cd * (enr ? B.enrageCd : 1); b.cd = .35;
  if (a.kind === 'summon') { summon(W, e, a.type, a.n); b.state = 'rec'; b.t = 0; return; }
  const at = { kind: a.kind, wind: a.wind * (enr ? .85 : 1), t: 0, mul: a.mul, r: a.r || 0, inner: a.inner || 0, x: e.x, z: e.z, i };
  if (a.kind === 'charge') { at.dx = dx / d; at.dz = dz / d; at.len = a.len; at.width = a.width; at.x0 = e.x; at.z0 = e.z; at.speed = 17; at.run = 0; at.hitAllies = new Set(); }
  if (a.kind === 'beam') Object.assign(at, { dx: dx / d, dz: dz / d, len: a.len, width: a.width, dur: a.dur, sweep: a.sweep * (W.rng() < .5 ? -1 : 1), on: 0, tick: 0 });
  if (a.kind === 'cast') { Object.assign(at, { name: a.name, hp0: e.hp, brk: a.brk ?? W.cfg.bosses.mech.brk, stun: a.stun ?? W.cfg.bosses.mech.stun }); b.kick = false; W.ev.push({ k: 'bossCast', name: W.cfg.enemies[e.type].name, what: a.name, x: e.x, z: e.z }); }
  if (a.kind === 'pools') Object.assign(at, { n: a.n, r: a.r, dur: a.dur, spread: a.spread || 1.5, mv: a.mv });
  if (a.kind === 'blink') Object.assign(at, { x: e.x + dx, z: e.z + dz, r: a.r });     // метка — где стоит цель
  if (a.kind === 'pull') Object.assign(at, { r: a.r, inner: a.inner, force: a.force });
  if (a.kind === 'meteor') Object.assign(at, { r: 0, n: a.n, rm: a.r, arm: a.arm, around: a.around || 5 });
  if (a.kind === 'safe') { let g = W.rng() * TAU; for (let k = 0; k < 8 && W.fx.blocked && W.fx.blocked(e.x, e.z, e.x + Math.sin(g) * a.safeD, e.z + Math.cos(g) * a.safeD); k++) g += Math.PI / 4; Object.assign(at, { x: e.x + Math.sin(g) * a.safeD, z: e.z + Math.cos(g) * a.safeD, r: a.r }); }     // круг укрытия — не за стеной
  if (a.name && a.kind !== 'cast') W.ev.push({ k: 'bossphase', name: W.cfg.enemies[e.type].name, what: a.name + (HINT[a.kind] || ''), x: e.x, z: e.z });
  b.atk = at; b.state = 'wind';
}

function strikeAttack(W, e, a, dmgMul, C) {
  const b = e.b, p = W.player;
  if (a.kind === 'charge') { b.state = 'dash'; a.x0 = e.x; a.z0 = e.z; return; }
  if (a.kind === 'beam') { b.state = 'beam'; a.x = e.x; a.z = e.z; W.ev.push({ k: 'bossBeam', x: e.x, z: e.z }); return; }
  if (a.kind === 'pools') { dropPools(W, e, a, dmgMul, C); b.state = 'rec'; b.t = 0; b.atk = null; return; }
  if (a.kind === 'meteor') { dropMeteors(W, e, a, dmgMul, C); b.state = 'rec'; b.t = 0; b.atk = null; return; }
  if (a.kind === 'safe') { safeBlast(W, e, a, dmgMul, C); b.state = 'rec'; b.t = 0; b.atk = null; return; }
  if (a.kind === 'blink') { W.ev.push({ k: 'bossblast', x: e.x, z: e.z, r: 1.5, kind: 'blink' }); const g = Math.atan2(a.x - e.x, a.z - e.z), D = len(a.x - e.x, a.z - e.z); if (D > 1.4) W.fx.slide(e, Math.sin(g) * (D - 1.4), Math.cos(g) * (D - 1.4), C.radius); }     // скачок: встаёт у метки
  if (a.kind === 'pull') { const pull = q => { const qx = e.x - q.x, qz = e.z - q.z, d = len(qx, qz), m = Math.min(a.force, Math.max(0, d - C.radius - 1)); if (d <= a.r && m > 0) W.fx.slide(q, qx / d * m, qz / d * m, W.cfg.player.radius); }; if (!p.dead) pull(p); for (const al of W.allies) if (!al.dead) pull(al); a.x = e.x; a.z = e.z; a.r = a.inner; }     // притяжение: потом удар рядом с боссом
  const dmg = Math.round(C.damage * a.mul * dmgMul);
  const inArea = (x, z) => { const d = len(x - a.x, z - a.z); return a.kind === 'nova' ? d <= a.r && d >= a.inner : d <= a.r; };
  W.ev.push({ k: 'bossblast', x: a.x, z: a.z, r: a.kind === 'cast' ? 10 : a.r, kind: a.kind });     // чтение бьёт весь зал — вспышка по размеру экрана
  if (!p.dead && inArea(p.x, p.z)) W.fx.hurtP(dmg, a.x, a.z, a.kind === 'nova' ? ['burn', 1, 4, 4] : C.on);
  for (const al of W.allies) if (!al.dead && inArea(al.x, al.z)) W.fx.hurtA(al, dmg, e);
  W.shake = Math.max(W.shake, .6);
  b.state = 'rec'; b.t = 0; b.atk = null;
}

// ---- библиотека механик (этап 5) ----
// луч: горит dur секунд от босса вперёд на len, шириной width; поворачивается на sweep рад/с; урон × mul в секунду (тиками)
function beamTick(W, e, a, dmgMul, C, dt) {
  const b = e.b, M = W.cfg.bosses.mech, p = W.player; a.on += dt; a.x = e.x; a.z = e.z;
  const c = Math.cos(a.sweep * dt), s = Math.sin(a.sweep * dt), dx = a.dx * c + a.dz * s, dz = -a.dx * s + a.dz * c; a.dx = dx; a.dz = dz; e.face = Math.atan2(dx, dz);
  if ((a.tick -= dt) <= 0) {
    a.tick = M.tick; const dmg = Math.max(1, Math.round(C.damage * a.mul * dmgMul * M.tick)), ex = e.x + dx * a.len, ez = e.z + dz * a.len;
    if (!p.dead && distSeg(p.x, p.z, e.x, e.z, ex, ez) < a.width / 2 + W.cfg.player.radius) W.fx.hurtP(dmg, e.x, e.z, null, e);
    for (const al of W.allies) if (!al.dead && distSeg(al.x, al.z, e.x, e.z, ex, ez) < a.width / 2 + .4) W.fx.hurtA(al, dmg, e);
  }
  if (a.on >= a.dur) { b.state = 'rec'; b.t = 0; b.atk = null; }
}
// лужи: под героем и бойцами (не больше n), с разбросом; горят dur секунд — стоять в них больно
function dropPools(W, e, a, dmgMul, C) {
  const p = W.player, at = [...(p.dead ? [] : [p]), ...W.allies.filter(x => !x.dead && !x.guest)].slice(0, a.n);
  while (at.length < a.n) { const g = W.rng() * Math.PI * 2, r = 2 + W.rng() * 5; at.push({ x: e.x + Math.sin(g) * r, z: e.z + Math.cos(g) * r }); }
  W.bzones = W.bzones || [];
  for (const q of at) { const g = W.rng() * Math.PI * 2, r = W.rng() * a.spread; W.bzones.push({ x: q.x + Math.sin(g) * r, z: q.z + Math.cos(g) * r, r: a.r, t: a.dur, dps: C.damage * a.mul * dmgMul, tick: 0, by: e.id, lvl: W.lvl, mv: a.mv }); }
  W.ev.push({ k: 'bossPools', x: e.x, z: e.z, n: at.length });
}
// метеоры (4.18б): метки под героем и отрядом (и вокруг героя), через arm с — удар радиусом r; уйти с метки — без урона
function dropMeteors(W, e, a, dmgMul, C) {
  const p = W.player, src = p.dead ? e : p, at = [...(p.dead ? [] : [p]), ...W.allies.filter(x => !x.dead && !x.guest)].slice(0, a.n).map(q => ({ x: q.x, z: q.z }));
  while (at.length < a.n) { const g = W.rng() * TAU, r = 2 + W.rng() * a.around; at.push({ x: src.x + Math.sin(g) * r, z: src.z + Math.cos(g) * r }); }
  W.bzones = W.bzones || [];
  for (const q of at) W.bzones.push({ x: q.x, z: q.z, r: a.rm, t: a.arm + .5, arm: a.arm, arm0: a.arm, hit: Math.round(C.damage * a.mul * dmgMul), dps: 0, tick: 0, by: e.id, lvl: W.lvl, met: true });
  W.ev.push({ k: 'bossPools', x: e.x, z: e.z, n: at.length });
}
// укрытие (4.18б): удар по всему залу, кроме круга у босса — в круге без урона
function safeBlast(W, e, a, dmgMul, C) {
  const p = W.player, dmg = Math.round(C.damage * a.mul * dmgMul), out = (x, z) => len(x - a.x, z - a.z) > a.r;
  W.ev.push({ k: 'bossblast', x: e.x, z: e.z, r: 10, kind: 'cast' });
  if (!p.dead && out(p.x, p.z)) W.fx.hurtP(dmg, e.x, e.z, C.on, e);
  for (const al of W.allies) if (!al.dead && out(al.x, al.z)) W.fx.hurtA(al, dmg, e);
  W.shake = Math.max(W.shake, .8);
}
// вторая стадия (4.18б): вместо смерти босс встаёт с долей здоровья, своими приёмами и фазами (зовёт sim.js → killEnemy)
export function bossRise(W, e) {
  const b = e.b, S = b.def.stage2, C = W.cfg.enemies[e.type];
  b.st2 = true; b.def = { ...b.def, attacks: S.attacks, phases: S.phases || [], drain: S.drain ?? b.def.drain };
  b.done = new Set(); b.extra = []; b.newMove = 'st2'; b.enraged = false; b.shield = false; b.atk = null; b.dash = null; b.state = 'rec'; b.t = -(S.pause || 2); b.cds = {}; b.last = -1;
  e.hp = Math.round(e.maxhp * S.hp); e.dmgMul = (e.dmgMul || 1) * (S.dmg || 1); e.stage = 2;
  W.ev.push({ k: 'bossphase', name: C.name, what: 'вторая стадия — ' + S.name, x: e.x, z: e.z }); if (S.say) W.ev.push({ k: 'bossSay', who: C.name, text: S.say });
  W.shake = Math.max(W.shake, 1);
}
// тики луж (зовёт sim.js каждый шаг): урон стоящим внутри, лужи гаснут по времени и при уходе с уровня
export function tickBossZones(W, dt) {
  const Z = W.bzones; if (!Z || !Z.length) return;
  const M = W.cfg.bosses.mech, p = W.player;
  for (let i = Z.length - 1; i >= 0; i--) {
    const z = Z[i]; z.t -= dt; if (z.t <= 0 || z.lvl !== W.lvl) { Z.splice(i, 1); continue; }
    if (z.met) { if ((z.arm -= dt) > 0) continue; const from = W.enemies.find(q => q.id === z.by) || null; W.ev.push({ k: 'bossblast', x: z.x, z: z.z, r: z.r, kind: 'meteor' });     // метеор: удар один раз
      if (!p.dead && len(p.x - z.x, p.z - z.z) < z.r + W.cfg.player.radius * .5) W.fx.hurtP(z.hit, z.x, z.z, null, from);
      for (const al of W.allies) if (!al.dead && len(al.x - z.x, al.z - z.z) < z.r) W.fx.hurtA(al, z.hit, { x: z.x, z: z.z });
      Z.splice(i, 1); continue; }
    if ((z.tick -= dt) > 0) continue; z.tick = M.tick;
    const dmg = Math.max(1, Math.round(z.dps * M.tick)), from = W.enemies.find(q => q.id === z.by) || null;
    if (!p.dead && len(p.x - z.x, p.z - z.z) < z.r + W.cfg.player.radius * .5) W.fx.hurtP(dmg, z.x, z.z, null, from);
    for (const al of W.allies) if (!al.dead && len(al.x - z.x, al.z - z.z) < z.r) W.fx.hurtA(al, dmg, { x: z.x, z: z.z });
  }
}

function summon(W, e, type, n) {
  const b = e.b, cap = W.cfg.bosses.minionCap;
  W.ev.push({ k: 'bossphase', name: W.cfg.enemies[e.type].name, what: b.def.drain ? 'зовёт подмогу и пьёт её силу — убейте подмогу' : 'зовёт подмогу', x: e.x, z: e.z });
  for (let i = 0; i < n && b.minions.length < cap; i++) {
    let a = W.rng() * Math.PI * 2; for (let k = 0; k < 8 && W.fx.blocked && W.fx.blocked(e.x, e.z, e.x + Math.sin(a) * 3.5, e.z + Math.cos(a) * 3.5); k++) a += Math.PI / 4;     // точка за стеной — поворот на 45°
    const m = W.fx.spawn(type, e.x + Math.sin(a) * 3.5, e.z + Math.cos(a) * 3.5);
    if (m) { m.alert = true; m.minion = true; b.minions.push(m); }     // помощник босса: без своих приёмов (этап 2 «круче»)
  }
}

function distSeg(x, z, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-9, t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1);
  return len(x - (ax + dx * t), z - (az + dz * t));
}
