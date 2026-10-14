// Шаг симуляции. Порядок такой же, как в исходной игре: затмение → игрок → спавн → враги → NPC → эффекты.
import { CFG } from './config.js';
import { P, W, V, keys } from './state.js';
import { rnd, ri, pick, sgn, clamp, random } from './util.js';
import { chat, npcSay, idleLine } from './chat.js';
import { runTimers } from './clock.js';
import { sfx, setDrone } from './audio.js';
import { stepParticles, stepNums, stepPopups } from './fx.js';
import { spawnEnemy, spawnBoss, pickSpawnType } from './world.js';
import { updateEnemies, updateProjectiles } from './ai.js';
import { startSwing, hurtEnemy, rollSwing, speedMult } from './combat.js';
import { updateNpcs } from './npc.js';
import { weaponLen } from './data/looks.js';
import { mods } from './skills.js';

export function step(dt) {
  W.T += dt;
  runTimers();
  if (!W.started || W.paused || W.hold) return;
  if (P.dead) { stepParticles(dt, true); return; }
  update(dt);
}

function updatePlayer(dt) {
  const C = CFG.player, rage = P.rageOn > 0;
  const dir = (keys.r ? 1 : 0) - (keys.l ? 1 : 0);
  const spd = (rage ? C.rageSpeed : C.walkSpeed) * speedMult(), active = P.swingT >= 0;
  const rolling = P.rollT >= 0;
  if (P.rollCd > 0) P.rollCd -= dt;
  if (P.dodgeCd > 0) P.dodgeCd -= dt;
  if (rolling) {
    // перекат: рывок вперёд с затуханием; пока длится — ни ходьбы, ни прыжка, ни удара
    const R = CFG.roll, p = P.rollT / R.duration;
    P.rollT += dt;
    P.x += P.rollDir * R.speed * (1.25 - .75 * p) * dt;
    if (random() < dt * 40) W.parts.length < CFG.fx.maxParticles && W.parts.push({ x: P.x - P.rollDir * 4, z: 1, vx: -P.rollDir * rnd(5, 25), vz: rnd(5, 25), life: rnd(.2, .45), c: pick(['#6a5a4a', '#3a2d26']), s: 1 });
    if (P.rollT >= R.duration) { P.rollT = -1; P.rollCd = Math.max(.2, R.cooldown - mods().rollCd); }
  } else if (dir) { P.x += dir * spd * (active ? C.swingMoveFactor : 1) * dt; if (!active) P.face = dir; P.walk += dt * 10; }
  P.x += P.vx * dt; P.vx *= Math.pow(C.knockDecay, dt);
  P.x = clamp(P.x, 12, CFG.world.length - 12);
  if (!rolling && keys.jump && P.z === 0) { P.vz = C.jumpVel; sfx.jump(); }
  if (P.z > 0 || P.vz > 0) { P.vz -= C.gravity * dt; P.z += P.vz * dt; if (P.z <= 0) { P.z = 0; P.vz = 0; } }

  if (!rolling && keys.atk && P.swingT < 0) startSwing();
  if (P.swingT >= 0) {
    P.swingT += dt;
    const p = P.swingT / P.swingDur;
    if (p > C.hitWindow[0] && p < C.hitWindow[1]) {
      const reach = (P.heavy ? C.reachHeavy : C.reachLight) + (weaponLen(P.eq) - C.weaponBaseLen) * C.reachPerLen;
      for (const e of W.enemies.slice()) {
        if (P.hitSet.has(e.id)) continue;
        const dx = (e.x - P.x) * P.face;
        const ez = e.z || 0;                                  // прыгун в воздухе
        if (dx > C.hitBehind && dx < reach + e.w / 2 && P.z < ez + e.h + C.hitHeightSlack && ez < P.z + 22) {
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
  // враги появляются за краем экрана: на широком кадре (планшет) дальше
  const lo = Math.max(S.distance[0], V.LW / 2 + 14), hi = lo + (S.distance[1] - S.distance[0]);
  const x = clamp(P.x + pick([-1, 1]) * rnd(lo, hi), CFG.world.town + 30, CFG.world.length - 30);
  if (Math.abs(x - P.x) <= S.minDistance) return;
  if (W.killsSinceLord >= S.lordEvery) {
    spawnEnemy('lord', x); W.killsSinceLord = 0; chat('', 'Из тени вышел Слуга Затмения.', 'sys');
  } else spawnEnemy(pickSpawnType(), x);
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
  updateProjectiles(dt);
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
