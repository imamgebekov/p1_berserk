// ИИ врагов: ближний бой, лучник, прыгун, Предвестник (две фазы, взмах крылом, призыв), стрелы.
import { CFG } from './config.js';
import { P, W } from './state.js';
import { rnd, rndIn, sgn, clamp, random } from './util.js';
import { chat } from './chat.js';
import { sfx } from './audio.js';
import { burst, lootPopup } from './fx.js';
import { hurtPlayer } from './combat.js';
import { summonAround } from './world.js';

const A = CFG.enemyAi, B = CFG.bossPhase;

function cooldown(e) {
  if (e.type === 'archer') return rndIn(A.archerCooldown);
  let c = rndIn(A.cooldown);
  if (e.type === 'leaper') c *= 1.2;
  if (e.type === 'boss') { c *= A.bossCooldownMult; if (e.phase === 2) c *= B.cooldownMult; }
  return c;
}

// --- Предвестник ---
function checkPhase(e) {
  if (e.phase !== 1 || e.hp > e.maxhp * B.hpFrac) return;
  e.phase = 2; e.spd *= B.speedMult;
  e.st = 'rec'; e.t = -.6;                            // рёв: пауза, чтобы игрок успел собраться
  W.shake = Math.max(W.shake, CFG.fx.shakeBossDown); sfx.roar();
  chat('', 'Предвестник ревёт: затмение сгущается.', 'sys');
  lootPopup(e.x, e.h + 14, 'Ярость!', '#ff6a3a');
  burst(e.x, e.h * .6, 40, ['#a1121f', '#c4161c', '#3a0c0c'], 90, 60);
  summonAround(e);
}

function bossStrike(e) {
  if (e.atk === 'sweep') {
    // взмах крылом по всей линии: спасает прыжок или перекат
    sfx.slam(); W.shake = Math.max(W.shake, CFG.fx.shakeBoss);
    burst(e.x, 3, 22, ['#6a5a4a', '#3a2d26', '#a1121f'], 110, 24);
    if (Math.abs(P.x - e.x) < B.sweepRange && P.z < B.sweepMaxZ) hurtPlayer(Math.round(e.dmg * .9), e.face);
  } else {
    const cx = e.x + e.face * A.bossSlamForward;
    sfx.slam(); W.shake = Math.max(W.shake, CFG.fx.shakeBoss);
    burst(cx, 2, 16, ['#6a5a4a', '#3a2d26', '#a1121f'], 80, 30);
    if (Math.abs(P.x - cx) < A.bossSlamRange && P.z < A.bossSlamMaxZ) hurtPlayer(e.dmg, e.face);
  }
}

// --- ближний бой: бес, рогач, Слуга, Предвестник ---
function meleeAi(e, d, dt) {
  const isBoss = e.type === 'boss';
  if (e.st === 'walk') {
    if (Math.abs(d) > e.reach) { if (Math.abs(d) < A.aggroDist) e.x += e.face * e.spd * dt; }
    else {
      e.cd -= dt;
      if (e.cd <= 0) { e.st = 'wind'; e.t = 0; if (isBoss) e.atk = e.phase === 2 && random() < B.sweepChance ? 'sweep' : 'slam'; }
    }
  } else if (e.st === 'wind') {
    e.t += dt;
    let wind = e.wind;
    if (isBoss) { if (e.atk === 'sweep') wind = B.sweepWind; if (e.phase === 2) wind *= B.windMult; }
    if (e.t >= wind) {
      e.st = 'rec'; e.t = 0;
      if (isBoss) bossStrike(e);
      else if (Math.abs(P.x - e.x) < e.reach + 6 && P.z < e.h * A.lordHitZ) hurtPlayer(e.dmg, e.face);
    }
  } else {
    e.t += dt;
    if (e.t > (isBoss ? A.bossRecoverTime : A.recoverTime)) { e.st = 'walk'; e.cd = cooldown(e); }
  }
}

// --- лучник: держит дистанцию, стреляет ---
function archerAi(e, d, dt) {
  const ad = Math.abs(d), [near, far] = A.archerRange;
  if (e.st === 'walk') {
    if (ad < near) e.x -= e.face * e.spd * A.archerRetreat * dt;
    else if (ad > far && ad < A.aggroDist) e.x += e.face * e.spd * dt;
    if (ad < A.aggroDist) { e.cd -= dt; if (e.cd <= 0 && ad < far + 24) { e.st = 'wind'; e.t = 0; } }
  } else if (e.st === 'wind') {
    e.t += dt;
    if (e.t >= e.wind) {
      e.st = 'rec'; e.t = 0;
      if (W.proj.length < A.maxArrows) { W.proj.push({ x: e.x + e.face * 6, z: A.arrowZ, vx: e.face * A.arrowSpeed, dmg: e.dmg, life: A.arrowLife, face: e.face }); sfx.twang(); }
    }
  } else {
    e.t += dt;
    if (e.t > A.archerRecover) { e.st = 'walk'; e.cd = cooldown(e); }
  }
}

// --- прыгун: присел и бросился по дуге ---
function leaperAi(e, d, dt) {
  const ad = Math.abs(d);
  if (e.st === 'walk') {
    if (ad < A.aggroDist) {
      if (ad > A.leapRange) e.x += e.face * e.spd * dt;
      else { e.cd -= dt; if (e.cd <= 0) { e.st = 'wind'; e.t = 0; } }
    }
  } else if (e.st === 'wind') {
    e.t += dt;
    if (e.t >= e.wind) { e.st = 'leap'; e.t = 0; e.vz = A.leapVz; e.z = .01; e.leapDir = e.face; e.leapHit = false; sfx.leap(); }
  } else if (e.st === 'leap') {
    e.x += e.leapDir * A.leapSpeed * dt; e.vz -= A.leapGravity * dt; e.z += e.vz * dt;
    if (!e.leapHit && Math.abs(P.x - e.x) < 9 && P.z < e.z + 8 && P.z + 22 > e.z) { e.leapHit = true; hurtPlayer(Math.round(e.dmg * .7), e.leapDir); }
    if (e.z <= 0) {
      e.z = 0; e.vz = 0; e.st = 'rec'; e.t = 0;
      burst(e.x, 2, 8, ['#6a5a4a', '#3a2d26'], 50, 20);
      if (!e.leapHit && Math.abs(P.x - e.x) < 16 && P.z < 10) hurtPlayer(Math.round(e.dmg * A.leapDamageMult), e.leapDir);
    }
  } else {
    e.t += dt;
    if (e.t > A.leapRecover) { e.st = 'walk'; e.cd = cooldown(e); }
  }
}

export function updateEnemies(dt) {
  for (const e of W.enemies.slice()) {
    if (e.flash > 0) e.flash -= dt;
    e.x += e.vx * dt; e.vx *= Math.pow(.01, dt);
    const isBoss = e.type === 'boss';
    if (!isBoss) e.x = clamp(e.x, CFG.world.town + 20, CFG.world.length - 20);
    if (!W.boss && Math.abs(e.x - P.x) > A.despawnDist && !isBoss) { W.enemies.splice(W.enemies.indexOf(e), 1); continue; }
    if (isBoss) checkPhase(e);
    const d = P.x - e.x;
    if (e.st !== 'leap') e.face = sgn(d);
    if (P.dead) continue;
    if (e.type === 'archer') archerAi(e, d, dt);
    else if (e.type === 'leaper') leaperAi(e, d, dt);
    else meleeAi(e, d, dt);
  }
}

// Стрелы: летят по прямой, попадают, если герой не выше и не в перекате (перекат — «Уклон!»)
export function updateProjectiles(dt) {
  const ps = W.proj;
  let k = 0;
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i];
    a.x += a.vx * dt; a.life -= dt;
    let hit = false;
    if (!P.dead && Math.abs(a.x - P.x) < A.arrowHitX && P.z < A.arrowHitZ) { hurtPlayer(a.dmg, a.face); hit = true; }
    if (!hit && a.life > 0 && a.x > 0 && a.x < CFG.world.length) ps[k++] = a;
  }
  ps.length = k;
}
