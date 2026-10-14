// Дальние враги (лучник, колдун), снаряды, опасные пятна и элитные враги с особыми свойствами. Чистая логика.
import { clamp, len, rr } from './util3d.js';
import { hurtPlayer } from './sim.js';
import { hurtAlly } from './squad3d.js';
import { slide } from './map.js';

// ---- элитные враги: шанс по глубине, опасности и ночи; считается от номера врага, без расхода генератора случайных чисел ----
const hash01 = (id, seed) => { const s = Math.sin(id * 12.9898 + seed * 78.233) * 43758.5453; return s - Math.floor(s); };
export function rollElite(W, e, depth, danger) {
  const K = W.cfg.elite, C = W.cfg.enemies[e.type]; if (!K || C.boss) return false;
  const p = K.chance + K.depthK * depth + K.dangerK * danger + (W.night ? K.nightK : 0);
  if (hash01(e.id, W.cfg.world.seed) >= p) return false;
  const ids = Object.keys(K.affixes), id = ids[Math.floor(hash01(e.id + .5, W.cfg.world.seed) * ids.length) % ids.length], A = K.affixes[id];
  e.elite = true; e.aff = id; e.affName = A.name; e.affColor = A.color;
  e.hp = e.maxhp = Math.round(e.maxhp * K.hp * (A.hp || 1)); e.dmgMul *= K.dmg; e.scaleMul = K.scale; e.spdMul = A.speed || 1;
  if (A.on) e.onx = A.on; if (A.immune) e.imm = A.immune;
  return true;
}
export const eliteName = (W, e) => (e.elite ? `${e.affName} ${W.cfg.enemies[e.type].name || ''}`.trim() : '');
// вампир лечится от нанесённого урона; вызывается после удара по герою
export function eliteOnHit(W, e, dmg) { if (e.aff === 'vampiric') e.hp = Math.min(e.maxhp, e.hp + dmg * W.cfg.elite.affixes.vampiric.heal); }
// взрывной оставляет пятно: через пару мгновений рванёт и заденет всех рядом
export function eliteOnDeath(W, e) {
  if (e.aff !== 'explosive') return;
  const A = W.cfg.elite.affixes.explosive;
  W.haz.push({ x: e.x, z: e.z, r: A.r, t: 0, delay: A.delay, dmg: Math.round(A.dmg * (e.dmgMul || 1)), on: ['burn', 1, 3, 4], by: 'elite' });
}

// ---- дальний бой: держит дистанцию, замах, затем выстрел или заклинание ----
export function rangedMove(W, e, C, d, dx, dz, spd, dt) {
  const R = C.ranged, [lo, hi] = R.keep, nx = dx / d, nz = dz / d;
  e.face = Math.atan2(dx, dz);
  if (d < lo) { const k = spd * .85 * dt; slide(W.map, e, -nx * k, -nz * k, C.radius); }
  else if (d > hi) { slide(W.map, e, nx * spd * dt, nz * spd * dt, C.radius); }
  e.cd -= dt;
  if (e.cd <= 0 && d <= C.range) { e.state = 'wind'; e.t = 0; }
}

export function rangedFire(W, e, C) {
  const p = W.player, R = C.ranged, dmg = Math.round(C.damage * (e.dmgMul || 1));
  if (R.kind === 'arrow') {
    const dx = p.x - e.x, dz = p.z - e.z, d = len(dx, dz) || 1e-6;
    W.proj.push({ x: e.x + dx / d * .8, z: e.z + dz / d * .8, vx: dx / d * R.speed, vz: dz / d * R.speed, dmg, on: e.onx || C.on, life: C.range / R.speed + .5, from: e.id, kind: 'arrow' });
    W.ev.push({ k: 'shot', x: e.x, z: e.z, kind: 'arrow' });
  } else {
    W.haz.push({ x: p.x, z: p.z, r: R.r, t: 0, delay: R.delay, dmg, on: e.onx || C.on, by: e.id });
    W.ev.push({ k: 'shot', x: e.x, z: e.z, kind: 'hex' });
  }
}

// стена на пути снаряда
function hitsWall(map, x, z) {
  for (const b of map.buildings) {
    if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) continue;
    const list = b.door.open < .6 ? b.walls.concat(b.door.rect) : b.walls;
    for (const w of list) if (x >= w.x0 && x <= w.x1 && z >= w.z0 && z <= w.z1) return true;
  }
  for (const w of map.blocks || []) if (x >= w.x0 && x <= w.x1 && z >= w.z0 && z <= w.z1) return true;     // стены подземелий
  for (const d of map.doors || []) { const w = d.rect; if (d.open < .6 && x >= w.x0 && x <= w.x1 && z >= w.z0 && z <= w.z1) return true; }
  return false;
}

export function updateFoes(W, dt) {
  const p = W.player, PR = W.cfg.player.radius;
  for (const e of W.enemies) if (e.elite && !e.seen && !e.dead && len(e.x - p.x, e.z - p.z) < 16) { e.seen = true; W.ev.push({ k: 'elite', name: eliteName(W, e), x: e.x, z: e.z }); }
  for (let i = W.proj.length - 1; i >= 0; i--) {
    const q = W.proj[i]; q.life -= dt; q.x += q.vx * dt; q.z += q.vz * dt;
    let end = q.life <= 0 || hitsWall(W.map, q.x, q.z);
    if (!end && !p.dead && len(q.x - p.x, q.z - p.z) < PR + .3) { const by = W.enemies.find(e => e.id === q.from); hurtPlayer(W, q.dmg, q.x - q.vx * .1, q.z - q.vz * .1, q.on, by && !by.dead ? by : null); end = true; }
    if (!end) for (const a of W.allies) if (!a.dead && len(q.x - a.x, q.z - a.z) < .7) { hurtAlly(W, a, q.dmg, { x: q.x - q.vx * .1, z: q.z - q.vz * .1 }); end = true; break; }
    if (end) { W.ev.push({ k: 'projend', x: q.x, z: q.z }); W.proj.splice(i, 1); }
  }
  for (let i = W.haz.length - 1; i >= 0; i--) {
    const h = W.haz[i]; h.t += dt;
    if (h.t < h.delay) continue;
    if (!p.dead && len(p.x - h.x, p.z - h.z) < h.r + PR * .5) hurtPlayer(W, h.dmg, h.x, h.z, h.on, null);
    for (const a of W.allies) if (!a.dead && len(a.x - h.x, a.z - h.z) < h.r) hurtAlly(W, a, h.dmg, { x: h.x, z: h.z });
    W.ev.push({ k: 'boom', x: h.x, z: h.z, r: h.r }); W.haz.splice(i, 1);
  }
}
