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

export function createWorld(cfg, rng = Math.random) {
  const P = cfg.player;
  return {
    cfg, rng, t: 0, kills: 0, eid: 1, spawnT: 1, freeze: 0, shake: 0, ev: [],
    player: { x: 0, z: 4, vx: 0, vz: 0, face: Math.PI, hp: P.hp, maxhp: P.hp, state: 'idle', atkT: 0, atkHit: false, rollT: 0, rollDirX: 0, rollDirZ: 1, rollCd: 0, inv: 0, dead: false, deadT: 0, dodgeCd: 0 },
    enemies: []
  };
}

const rr = (W, a, b) => a + W.rng() * (b - a);

export function spawnEnemy(W, type, x, z) {
  const C = W.cfg.enemies[type];
  const e = { id: W.eid++, type, x, z, vx: 0, vz: 0, hp: C.hp, maxhp: C.hp, face: 0, state: 'chase', t: 0, cd: rr(W, .2, .9), flash: 0, dead: false, deadT: 0, hitMe: false };
  W.enemies.push(e);
  return e;
}

function spawnRing(W) {
  const [lo, hi] = W.cfg.enemies.ring, p = W.player;
  const a = rr(W, 0, TAU), d = rr(W, lo, hi), R = W.cfg.world.radius - 2;
  let x = p.x + Math.sin(a) * d, z = p.z + Math.cos(a) * d;
  const l = len(x, z); if (l > R) { x *= R / l; z *= R / l; }
  spawnEnemy(W, W.rng() < W.cfg.enemies.brutePart ? 'brute' : 'imp', x, z);
}

export const aliveEnemies = W => W.enemies.filter(e => !e.dead);

function hurtPlayer(W, dmg, fromX, fromZ) {
  const p = W.player;
  if (p.dead) return false;
  if (p.state === 'roll' || p.inv > 0) {
    if (p.state === 'roll' && p.dodgeCd <= 0) { p.dodgeCd = .3; W.ev.push({ k: 'dodge', x: p.x, z: p.z }); }
    return false;
  }
  p.hp -= dmg; p.inv = W.cfg.player.hurtInvuln; W.shake = Math.max(W.shake, W.cfg.fx.shake * 1.4);
  const d = len(p.x - fromX, p.z - fromZ) || 1;
  p.vx += (p.x - fromX) / d * 5; p.vz += (p.z - fromZ) / d * 5;
  W.ev.push({ k: 'hurt', x: p.x, z: p.z, dmg });
  if (p.hp <= 0) { p.hp = 0; p.dead = true; p.state = 'dead'; p.deadT = 0; W.ev.push({ k: 'playerDead', x: p.x, z: p.z }); }
  return true;
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
  const half = P.attackArc * DEG / 2;
  let hits = 0;
  for (const e of W.enemies) {
    if (e.dead) continue;
    const C = W.cfg.enemies[e.type], dx = e.x - p.x, dz = e.z - p.z, d = len(dx, dz);
    if (d > P.attackRange + C.radius) continue;
    if (Math.abs(angDiff(Math.atan2(dx, dz), p.face)) > half) continue;
    const dmg = Math.round(P.attackDamage * rr(W, .9, 1.15)), crit = W.rng() < .12;
    const dealt = crit ? Math.round(dmg * 1.7) : dmg;
    e.hp -= dealt; e.flash = .12;
    const k = P.knockback / (C.scale > 1.2 ? 2.2 : 1), n = d || 1;
    e.vx += dx / n * k; e.vz += dz / n * k;
    if (e.state === 'wind') { e.state = 'chase'; e.t = 0; e.cd = .3; }       // удар прерывает замах
    W.ev.push({ k: 'hit', x: e.x, z: e.z, dmg: dealt, crit, id: e.id });
    hits++;
    if (e.hp <= 0) { e.dead = true; e.deadT = 0; W.kills++; W.ev.push({ k: 'die', x: e.x, z: e.z, type: e.type, id: e.id }); }
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
    p.state = 'roll'; p.rollT = 0; p.rollCd = P.rollCooldown; p.inv = Math.max(p.inv, P.rollInvuln);
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
      if (!p.atkHit && p.atkT >= P.attackHitAt) { p.atkHit = true; attackHit(W); }
      if (p.atkT >= P.attackTime) p.state = 'idle';
    }
    // бег с разгоном; при ударе медленнее
    const sp = P.speed * (p.state === 'atk' ? P.attackSlow : 1);
    const tx = moving ? mx * sp : 0, tz = moving ? mz * sp : 0;
    const a = P.accel * dt;
    const dvx = tx - p.vx, dvz = tz - p.vz, dl = len(dvx, dvz);
    if (dl <= a) { p.vx = tx; p.vz = tz; } else { p.vx += dvx / dl * a; p.vz += dvz / dl * a; }
    if (moving && p.state !== 'atk') p.face += clamp(angDiff(Math.atan2(mx, mz), p.face), -P.turnSpeed * dt, P.turnSpeed * dt);
    if (p.state === 'idle' && moving) p.state = 'run'; else if (p.state === 'run' && !moving) p.state = 'idle';
  }
  p.x += p.vx * dt; p.z += p.vz * dt;
  const l = len(p.x, p.z); if (l > R) { p.x *= R / l; p.z *= R / l; }
}

function updateEnemies(W, dt) {
  const p = W.player, E = W.cfg.enemies;
  for (const e of W.enemies) {
    const C = E[e.type];
    if (e.flash > 0) e.flash -= dt;
    if (e.dead) { e.deadT += dt; continue; }
    const dx = p.x - e.x, dz = p.z - e.z, d = len(dx, dz) || 1e-6;
    e.x += e.vx * dt; e.z += e.vz * dt;
    const kd = Math.exp(-E.knockDecay * dt); e.vx *= kd; e.vz *= kd;
    if (e.state === 'chase') {
      e.face = Math.atan2(dx, dz);
      if (!p.dead && d < E.aggro) {
        if (d > C.range * .85) { e.x += dx / d * C.speed * dt; e.z += dz / d * C.speed * dt; }
        else { e.cd -= dt; if (e.cd <= 0) { e.state = 'wind'; e.t = 0; } }
      }
    } else if (e.state === 'wind') {
      e.t += dt; e.face = Math.atan2(dx, dz);
      if (e.t >= C.wind) {
        e.state = 'rec'; e.t = 0;
        if (!p.dead && d <= C.range + P_RADIUS(W) + .35) hurtPlayer(W, C.damage, e.x, e.z);
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
  { const R = W.cfg.world.radius, l = len(p.x, p.z); if (l > R) { p.x *= R / l; p.z *= R / l; } }    // расталкивание не выносит героя за границу
  W.enemies = W.enemies.filter(e => !(e.dead && e.deadT > .6));
  // держим нужное число врагов
  const alive = W.enemies.filter(e => !e.dead).length;
  if (alive < E.count && !p.dead) { W.spawnT -= dt; if (W.spawnT <= 0) { W.spawnT = E.respawn; spawnRing(W); } }
  else W.spawnT = Math.max(W.spawnT, .6);
}
const P_RADIUS = W => W.cfg.player.radius;

// input: { mx, mz (−1..1), attack (держится), roll (нажатие) }
export function step(W, dt, input = {}) {
  if (!(dt > 0)) return;                                          // нулевой или отрицательный шаг (первый кадр rAF) ничего не двигает
  W.t += dt;
  if (W.freeze > 0) { W.freeze -= dt; return; }
  updatePlayer(W, dt, input);
  updateEnemies(W, dt);
  if (W.shake > 0) W.shake = Math.max(0, W.shake - dt * 1.4);
  if (W.ev.length > 200) W.ev.splice(0, W.ev.length - 200);     // события забирает рендер; потолок защищает, если никто не забирает
}

export function respawnPlayer(W) {
  const P = W.cfg.player, p = W.player;
  Object.assign(p, { x: 0, z: 4, vx: 0, vz: 0, face: Math.PI, hp: P.hp, maxhp: P.hp, state: 'idle', atkT: 0, rollT: 0, rollCd: 0, inv: 1.2, dead: false, deadT: 0 });
  W.enemies.length = 0; W.spawnT = 1.2;
}
