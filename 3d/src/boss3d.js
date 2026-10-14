// Боссы: автомат атак (ожидание → предупреждение → удар → восстановление), фазы по здоровью, ярость, возврат в логово.
// Урон и порождение врагов идут через W.fx (из sim.js). Предупреждение лежит в e.b.atk: рендер рисует его, пока оно активно.
const len = (x, z) => Math.hypot(x, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function initBoss(W, e, def) {
  e.boss = true; e.alert = false;
  e.b = { def, home: { x: e.x, z: e.z }, t: 0, cd: 1.5, atk: null, state: 'idle', done: new Set(), enraged: false, cds: {}, last: -1, dash: null, minions: [] };
}

// герой sec секунд был на другом уровне (в подземелье): босс уже вернулся в логово и лечился, как после ухода за поводок
export function bossAway(W, e, sec) {
  const b = e.b; if (!b || e.dead || sec <= 0) return;
  e.alert = false; b.atk = null; b.state = 'idle'; b.dash = null; e.vx = e.vz = 0;
  e.x = b.home.x; e.z = b.home.z;
  e.hp = Math.min(e.maxhp, e.hp + e.maxhp * W.cfg.bosses.homeHeal * sec);
}

export function updateBoss(W, e, dt, spd) {
  const B = W.cfg.bosses, C = W.cfg.enemies[e.type], b = e.b, p = W.player;
  const dx = p.x - e.x, dz = p.z - e.z, d = len(dx, dz) || 1e-6;
  const enr = b.enraged;
  for (const k of Object.keys(b.cds)) if ((b.cds[k] -= dt) <= 0) delete b.cds[k];
  b.minions = b.minions.filter(m => !m.dead);

  // фазы по доле здоровья
  const frac = e.hp / e.maxhp;
  b.def.phases.forEach((ph, i) => {
    if (b.done.has(i) || frac > ph.at) return;
    b.done.add(i);
    if (ph.enrage) { b.enraged = true; W.ev.push({ k: 'bossphase', name: C.name, what: 'ярость', x: e.x, z: e.z }); }
    if (ph.summon) summon(W, e, ph.summon.type, ph.summon.n);
  });

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
  if (b.state === 'rec') { if (b.t >= C.recover) { b.state = 'idle'; b.t = 0; } return; }

  // idle: идти к герою, выбирать атаку
  b.cd -= dt * (enr ? 1 / B.enrageCd : 1);
  const sp = spd * (enr ? B.enrageSpeed : 1);
  const melee = b.def.attacks.find(a => a.kind === 'slam');
  if (d > C.range * .8) { W.fx.slide(e, dx / d * sp * dt, dz / d * sp * dt, C.radius); e.face = Math.atan2(dx, dz); }
  if (b.cd > 0) return;
  const opts = b.def.attacks.map((a, i) => ({ a, i })).filter(o => !b.cds[o.i] && d <= o.a.range && o.i !== b.last);
  if (!opts.length) { const m = b.def.attacks.map((a, i) => ({ a, i })).filter(o => !b.cds[o.i] && d <= o.a.range); if (!m.length) return; opts.push(m[0]); }
  const pick = opts[Math.floor(W.rng() * opts.length)];
  beginAttack(W, e, pick.a, pick.i, dx, dz, d);
}

function beginAttack(W, e, a, i, dx, dz, d) {
  const b = e.b, B = W.cfg.bosses, enr = b.enraged;
  b.last = i; b.cds[i] = a.cd * (enr ? B.enrageCd : 1); b.cd = .35;
  if (a.kind === 'summon') { summon(W, e, a.type, a.n); b.state = 'rec'; b.t = 0; return; }
  const at = { kind: a.kind, wind: a.wind * (enr ? .85 : 1), t: 0, mul: a.mul, r: a.r || 0, inner: a.inner || 0, x: e.x, z: e.z, i };
  if (a.kind === 'charge') { at.dx = dx / d; at.dz = dz / d; at.len = a.len; at.width = a.width; at.x0 = e.x; at.z0 = e.z; at.speed = 17; at.run = 0; at.hitAllies = new Set(); }
  b.atk = at; b.state = 'wind';
}

function strikeAttack(W, e, a, dmgMul, C) {
  const b = e.b, p = W.player;
  if (a.kind === 'charge') { b.state = 'dash'; a.x0 = e.x; a.z0 = e.z; return; }
  const dmg = Math.round(C.damage * a.mul * dmgMul);
  const inArea = (x, z) => { const d = len(x - a.x, z - a.z); return a.kind === 'nova' ? d <= a.r && d >= a.inner : d <= a.r; };
  W.ev.push({ k: 'bossblast', x: a.x, z: a.z, r: a.r, kind: a.kind });
  if (!p.dead && inArea(p.x, p.z)) W.fx.hurtP(dmg, a.x, a.z, a.kind === 'nova' ? ['burn', 1, 4, 4] : C.on);
  for (const al of W.allies) if (!al.dead && inArea(al.x, al.z)) W.fx.hurtA(al, dmg, e);
  W.shake = Math.max(W.shake, .6);
  b.state = 'rec'; b.t = 0; b.atk = null;
}

function summon(W, e, type, n) {
  const b = e.b, cap = W.cfg.bosses.minionCap;
  W.ev.push({ k: 'bossphase', name: W.cfg.enemies[e.type].name, what: 'зовёт подмогу', x: e.x, z: e.z });
  for (let i = 0; i < n && b.minions.length < cap; i++) {
    const a = W.rng() * Math.PI * 2, m = W.fx.spawn(type, e.x + Math.sin(a) * 3.5, e.z + Math.cos(a) * 3.5);
    if (m) { m.alert = true; b.minions.push(m); }
  }
}

function distSeg(x, z, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-9, t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1);
  return len(x - (ax + dx * t), z - (az + dz * t));
}
