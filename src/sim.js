// Шаг симуляции. Порядок такой же, как в исходной игре: затмение → игрок → спавн → враги → NPC → эффекты.
import { CFG } from './config.js';
import { P, W, V, keys } from './state.js';
import { rnd, ri, pick, sgn, clamp, random } from './util.js';
import { chat, npcSay, idleLine } from './chat.js';
import { runTimers } from './clock.js';
import { sfx, setDrone } from './audio.js';
import { burst } from './fx.js';
import { stepParticles, stepNums, stepPopups } from './fx.js';
import { spawnEnemy, spawnBoss } from './world.js';
import { startSwing, hurtEnemy, hurtPlayer, rollSwing, speedMult } from './combat.js';
import { updateNpcs } from './npc.js';
import { weaponLen } from './data/looks.js';
import { mods } from './skills.js';

export function step(dt) {
  W.T += dt;
  runTimers();
  if (!W.started || W.paused) return;
  if (P.dead) { stepParticles(dt, true); return; }
  update(dt);
}

function updatePlayer(dt) {
  const C = CFG.player, rage = P.rageOn > 0;
  const dir = (keys.r ? 1 : 0) - (keys.l ? 1 : 0);
  const spd = (rage ? C.rageSpeed : C.walkSpeed) * speedMult(), active = P.swingT >= 0;
  if (dir) { P.x += dir * spd * (active ? C.swingMoveFactor : 1) * dt; if (!active) P.face = dir; P.walk += dt * 10; }
  P.x += P.vx * dt; P.vx *= Math.pow(C.knockDecay, dt);
  P.x = clamp(P.x, 12, CFG.world.length - 12);
  if (keys.jump && P.z === 0) { P.vz = C.jumpVel; sfx.jump(); }
  if (P.z > 0 || P.vz > 0) { P.vz -= C.gravity * dt; P.z += P.vz * dt; if (P.z <= 0) { P.z = 0; P.vz = 0; } }

  if (keys.atk && P.swingT < 0) startSwing();
  if (P.swingT >= 0) {
    P.swingT += dt;
    const p = P.swingT / P.swingDur;
    if (p > C.hitWindow[0] && p < C.hitWindow[1]) {
      const reach = (P.heavy ? C.reachHeavy : C.reachLight) + (weaponLen(P.eq) - C.weaponBaseLen) * C.reachPerLen;
      for (const e of W.enemies.slice()) {
        if (P.hitSet.has(e.id)) continue;
        const dx = (e.x - P.x) * P.face;
        if (dx > C.hitBehind && dx < reach + e.w / 2 && P.z < e.h + C.hitHeightSlack) {
          P.hitSet.add(e.id);
          const sw = rollSwing();
          hurtEnemy(e, sw.dmg, P.face, P.heavy, sw.crit);
        }
      }
    }
    if (P.swingT >= P.swingDur) { P.swingT = -1; P.comboT = C.comboWindow; }
  } else if (P.comboT > 0) P.comboT -= dt;

  if (P.inv > 0) P.inv -= dt;
  if (P.inCombat > 0) P.inCombat -= dt;
  if (rage) {
    const R = CFG.rage;
    P.rageOn -= dt; P.rage = Math.max(0, R.max * P.rageOn / P.rageDur);
    P.hp = Math.max(1, P.hp - R.hpDrain * dt);
    if (random() < dt * 30) W.parts.length < CFG.fx.maxParticles && W.parts.push({
      x: P.x + rnd(-4, 4), z: rnd(2, 16), vx: rnd(-8, 8), vz: rnd(20, 50), life: rnd(.4, .8),
      c: pick(['#e0602a', '#a1121f', '#f08a3a']), s: 1
    });
    if (P.rageOn <= 0) { P.rageOn = 0; P.rage = 0; }
  }
  // костёр лечит
  const Wd = CFG.world;
  const sk = mods();
  if (Math.abs(P.x - Wd.fire) < Wd.campfireHealRadius + sk.healRadius && P.inCombat <= 0 && P.hp < P.maxhp)
    P.hp = Math.min(P.maxhp, P.hp + Wd.campfireHealPerSec * sk.healMult * dt);
}

function updateSpawns(dt) {
  const S = CFG.spawn;
  W.spawnT -= dt;
  if (W.spawnT > 0) return;
  W.spawnT = rnd(S.interval[0], S.interval[1]);
  if (W.boss || W.enemies.length >= S.maxAlive || P.x <= CFG.world.town - S.townMargin || P.dead) return;
  const x = clamp(P.x + pick([-1, 1]) * rnd(S.distance[0], S.distance[1]), CFG.world.town + 30, CFG.world.length - 30);
  if (Math.abs(x - P.x) <= S.minDistance) return;
  if (W.killsSinceLord >= S.lordEvery) {
    spawnEnemy('lord', x); W.killsSinceLord = 0; chat('', 'Из тени вышел Слуга Затмения.', 'sys');
  } else spawnEnemy(random() < S.impChance ? 'imp' : 'brute', x);
}

function updateEnemies(dt) {
  const A = CFG.enemyAi;
  for (const e of W.enemies.slice()) {
    if (e.flash > 0) e.flash -= dt;
    e.x += e.vx * dt; e.vx *= Math.pow(.01, dt);
    const isBoss = e.type === 'boss';
    if (!isBoss) e.x = clamp(e.x, CFG.world.town + 20, CFG.world.length - 20);
    if (!W.boss && Math.abs(e.x - P.x) > A.despawnDist && !isBoss) { W.enemies.splice(W.enemies.indexOf(e), 1); continue; }
    const d = P.x - e.x; e.face = sgn(d);
    if (P.dead) continue;
    if (e.st === 'walk') {
      if (Math.abs(d) > e.reach) { if (Math.abs(d) < A.aggroDist) e.x += e.face * e.spd * dt; }
      else { e.cd -= dt; if (e.cd <= 0) { e.st = 'wind'; e.t = 0; } }
    } else if (e.st === 'wind') {
      e.t += dt;
      if (e.t >= e.wind) {
        e.st = 'rec'; e.t = 0;
        const cx = isBoss ? e.x + e.face * A.bossSlamForward : e.x;
        const range = isBoss ? A.bossSlamRange : e.reach + 6;
        if (Math.abs(P.x - cx) < range && P.z < (isBoss ? A.bossSlamMaxZ : e.h * A.lordHitZ)) hurtPlayer(e.dmg, e.face);
        if (isBoss) { sfx.slam(); W.shake = Math.max(W.shake, CFG.fx.shakeBoss); burst(cx, 2, 16, ['#6a5a4a', '#3a2d26', '#a1121f'], 80, 30); }
      }
    } else if (e.st === 'rec') {
      e.t += dt;
      if (e.t > (isBoss ? A.bossRecoverTime : A.recoverTime)) { e.st = 'walk'; e.cd = rnd(A.cooldown[0], A.cooldown[1]) * (isBoss ? A.bossCooldownMult : 1); }
    }
  }
}

function update(dt) {
  if (W.freeze > 0) { W.freeze -= dt; return; }

  // затмение
  if (!W.boss) {
    W.timer -= dt;
    if (W.timer <= 0) spawnBoss();
  }
  W.ecl += ((W.boss ? 1 : 0) - W.ecl) * Math.min(1, dt * CFG.eclipse.smoothing);
  setDrone(W.ecl);

  updatePlayer(dt);
  updateSpawns(dt);
  updateEnemies(dt);
  updateNpcs(dt);

  stepParticles(dt, false);
  stepNums(dt); stepPopups(dt);

  if (W.hurtFlash > 0) W.hurtFlash -= dt;
  if (W.shake > 0) W.shake = Math.max(0, W.shake - dt * CFG.fx.shakeDecay);

  W.chatT -= dt;
  if (W.chatT <= 0) { W.chatT = rnd(CFG.chat.idleInterval[0], CFG.chat.idleInterval[1]); npcSay(idleLine()); }

  const O = CFG.online;
  if (random() < dt * O.updateRate) W.online = O.base + ri(O.jitter[0], O.jitter[1]) + Math.round(W.ecl * O.eclipseBonus);

  const want = clamp(P.x - V.LW / 2 + P.face * 14, 0, CFG.world.length - V.LW);
  W.camX += (want - W.camX) * Math.min(1, dt * 6);
}
