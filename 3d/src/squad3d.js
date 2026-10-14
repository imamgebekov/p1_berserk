// Отряд: найм, бой, следование и лечение союзников.
import { len, clamp, rr } from './util3d.js';
import { questEvent } from './quests3d.js';
import { insideOf, resolve, slide, pathStep, roomHops } from './map.js';
import { killEnemy } from './sim.js';

// ---- отряд ----
export const squadMax = W => Math.min(W.cfg.squad.cap, W.cfg.squad.baseMax + Math.floor(W.lv / W.cfg.squad.perLevels));
export const liveAllies = W => W.allies.filter(a => !a.dead);
export function pickAlly(W, e, dPlayer) {
  let best = null, bd = 8;
  for (const a of W.allies) { if (a.dead) continue; const d = len(a.x - e.x, a.z - e.z); if (d < bd && d < dPlayer + 1.5 && insideOf(W.map, a.x, a.z) === insideOf(W.map, e.x, e.z)) { bd = d; best = a; } }
  return best;
}
export function hurtAlly(W, a, dmg, e) {
  if (a.dead) return;
  a.hp -= dmg; a.flash = .12; a.calm = 3;
  const d = len(a.x - e.x, a.z - e.z) || 1; a.vx += (a.x - e.x) / d * 3; a.vz += (a.z - e.z) / d * 3;
  W.ev.push({ k: 'allyhurt', x: a.x, z: a.z, dmg });
  if (a.hp <= 0) { a.hp = 0; a.dead = true; a.deadT = 0; W.ev.push({ k: 'allydead', x: a.x, z: a.z, name: W.cfg.squad.types[a.type].name }); }
}
export function spawnAlly(W, type, hp) {
  const T = W.cfg.squad.types[type], p = W.player, ang = p.face + Math.PI + rr(W, -.8, .8);
  const a = { id: W.aid++, type, x: p.x + Math.sin(ang) * 1.8, z: p.z + Math.cos(ang) * 1.8, vx: 0, vz: 0, face: p.face, hp: hp || T.hp, maxhp: T.hp, state: 'idle', t: 0, cd: 0, dead: false, deadT: 0, flash: 0, calm: 0, tgt: 0, moving: false };
  resolve(W.map, a, .45); W.allies.push(a); return a;
}
export function hireAlly(W, type) {
  const T = W.cfg.squad.types[type]; if (!T) return 'none';
  if (W.nearNpc !== 'captain') return 'far';
  if (liveAllies(W).length >= squadMax(W)) return 'full';
  if (W.inv.ash < T.cost) return 'ash';
  W.inv.ash -= T.cost; spawnAlly(W, type); questEvent(W, 'hire'); W.ev.push({ k: 'hire', name: T.name }); return 'ok';
}
export function dismissAlly(W, id) { const i = W.allies.findIndex(a => a.id === id); if (i < 0) return false; W.allies.splice(i, 1); return true; }
export function restoreAllies(W, list) {
  W.allies.length = 0;
  for (const s of Array.isArray(list) ? list : []) { if (liveAllies(W).length >= squadMax(W)) break; const T = s && W.cfg.squad.types[s.type]; if (T) spawnAlly(W, s.type, clamp(Number.isFinite(s.hp) ? Math.floor(s.hp) : T.hp, 1, T.hp)); }
}
export function updateAllies(W, dt) {
  const S = W.cfg.squad, p = W.player, live = liveAllies(W), enemies = W.enemies.filter(e => !e.dead);
  for (let i = W.allies.length - 1; i >= 0; i--) { const a = W.allies[i]; if (a.dead) { a.deadT += dt; if (a.deadT > 1.4) W.allies.splice(i, 1); } }
  live.forEach((a, idx) => {
    const T = S.types[a.type];
    if (a.flash > 0) a.flash -= dt; if (a.calm > 0) a.calm -= dt;
    const px = a.x, pz = a.z;
    slide(W.map, a, a.vx * dt, a.vz * dt, .45); const kd = Math.exp(-8 * dt); a.vx *= kd; a.vz *= kd;
    // цель: ближайший враг рядом с союзником и не слишком далеко от героя
    let tgt = null, bd = S.sight;
    for (const e of enemies) { const d = len(e.x - a.x, e.z - a.z); if (d < bd && len(e.x - p.x, e.z - p.z) < S.sight + 8 && insideOf(W.map, e.x, e.z) === insideOf(W.map, a.x, a.z) && roomHops(W.map, a.x, a.z, e.x, e.z) <= 1) { bd = d; tgt = e; } }   // в подземелье — враги своей и соседней комнаты
    if (a.state === 'wind') {
      a.t += dt; if (a.tg && !a.tg.dead) a.face = Math.atan2(a.tg.x - a.x, a.tg.z - a.z);
      if (a.t >= T.wind) {
        a.state = 'rec'; a.t = 0;
        const e = a.tg; if (e && !e.dead && len(e.x - a.x, e.z - a.z) <= T.range + W.cfg.enemies[e.type].radius + .5) {
          const dmg = Math.round(T.dmg * rr(W, .9, 1.1)); e.hp -= dmg; e.flash = .12; e.alert = true;
          const d = len(e.x - a.x, e.z - a.z) || 1, C = W.cfg.enemies[e.type], k = 3 / (C.scale > 1.2 ? 2.2 : 1); e.vx += (e.x - a.x) / d * k; e.vz += (e.z - a.z) / d * k;
          if (e.state === 'wind') { e.state = 'chase'; e.t = 0; e.cd = .3; }
          W.ev.push({ k: 'hit', x: e.x, z: e.z, dmg, crit: false, id: e.id, ally: true });
          if (e.hp <= 0) killEnemy(W, e, S.xpShare);
        }
      }
    } else if (a.state === 'rec') { a.t += dt; if (a.t >= T.recover) { a.state = 'idle'; a.t = 0; } }
    else if (tgt) {
      const C = W.cfg.enemies[tgt.type], dx = tgt.x - a.x, dz = tgt.z - a.z, d = len(dx, dz) || 1e-6;
      const wp = pathStep(W.map, a.x, a.z, tgt.x, tgt.z);       // цель в соседней комнате: через проход
      if (wp) { const wx = wp.x - a.x, wz = wp.z - a.z, wd = len(wx, wz) || 1e-6; a.face = Math.atan2(wx, wz); slide(W.map, a, wx / wd * T.speed * dt, wz / wd * T.speed * dt, .45); }
      else {
        a.face = Math.atan2(dx, dz);
        if (d > T.range + C.radius * .5) slide(W.map, a, dx / d * T.speed * dt, dz / d * T.speed * dt, .45);
        else { a.state = 'wind'; a.t = 0; a.tg = tgt; }
      }
    } else {
      // идти за героем: позиция в строю позади него
      const n = live.length, ang = p.face + Math.PI + (idx - (n - 1) / 2) * .95, r = S.follow + (idx % 2) * .8;
      const sx = p.x + Math.sin(ang) * r, sz = p.z + Math.cos(ang) * r, dx = sx - a.x, dz = sz - a.z, d = len(dx, dz);
      const wp = pathStep(W.map, a.x, a.z, p.x, p.z);     // в подземелье герой в другой комнате: идти через проходы
      if (len(p.x - a.x, p.z - a.z) > S.leash) { a.x = sx; a.z = sz; resolve(W.map, a, .45); }
      else if (wp) { const wx = wp.x - a.x, wz = wp.z - a.z, wd = len(wx, wz) || 1e-6; a.face = Math.atan2(wx, wz); slide(W.map, a, wx / wd * T.speed * 1.5 * dt, wz / wd * T.speed * 1.5 * dt, .45); }
      else if (d > .9) { const sp = T.speed * (d > 6 ? 1.5 : 1); a.face = Math.atan2(dx, dz); slide(W.map, a, dx / d * sp * dt, dz / d * sp * dt, .45); }
      // восстановление: вне боя понемногу, у костра быстро
      if (a.calm <= 0 && a.hp < a.maxhp) a.hp = Math.min(a.maxhp, a.hp + (W.lvl === 'surface' && len(a.x, a.z) < W.cfg.player.fire.radius ? S.fireRegen : S.regen) * dt);
    }
    a.moving = len(a.x - px, a.z - pz) > .4 * dt * 3;
  });
}

