// Дальние враги (лучник, колдун), снаряды, опасные пятна и элитные враги с особыми свойствами. Чистая логика.
import { clamp, len, rr } from './util3d.js';
import { hurtPlayer, angDiff } from './sim.js';
import { hurtAlly } from './squad3d.js';
import { slide, resolve, roomAt, insideOf } from './map.js';

// ---- элитные враги: шанс по глубине, опасности и ночи; считается от номера врага, без расхода генератора случайных чисел ----
const hash01 = (id, seed) => { const s = Math.sin(id * 12.9898 + seed * 78.233) * 43758.5453; return s - Math.floor(s); };
export function rollElite(W, e, depth, danger) {
  const K = W.cfg.elite, C = W.cfg.enemies[e.type]; if (!K || C.boss) return false;
  const p = K.chance + K.depthK * depth + K.dangerK * danger + (W.night ? K.nightK : 0);
  if (hash01(e.id, W.cfg.world.seed) >= p) return false;
  const ids = Object.keys(K.affixes), id = ids[Math.floor(hash01(e.id + .5, W.cfg.world.seed) * ids.length) % ids.length], A = K.affixes[id];
  e.elite = true; e.aff = id; e.affName = C.g === 'f' && A.nameF ? A.nameF : A.name; e.affColor = A.color;      // «Пылающая Гончая», а не «Пылающий»
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
    if (h.foes) for (const o of W.enemies.slice()) if (!o.dead && o.id !== h.by && len(o.x - h.x, o.z - h.z) < h.r) W.fx.deal(o, h.dmg, 'fire');   // взрыв тлеющего задевает и врагов
    if (h.bomber) { const b = W.enemies.find(o => o.id === h.by); if (b && !b.dead) W.fx.kill(b); }
    W.ev.push({ k: 'boom', x: h.x, z: h.z, r: h.r }); W.haz.splice(i, 1);
  }
}

// ---- особое поведение новых видов (ai в конфиге) ----
// поворот к цели не быстрее turn рад/с (щитоносец): обойти его можно
export function turnTo(e, C, ang, dt) { if (C.guard) e.face += clamp(angDiff(ang, e.face), -C.guard.turn * dt, C.guard.turn * dt); else e.face = ang; }

// щит: удар спереди почти не проходит (кроме тяжёлого, из переката, по оглушённому или замороженному); возвращает множитель урона
export function guardMul(W, e, C, o) {
  const G = C.guard; if (!G || e.dead) return 1;
  if (o.heavy || o.roll || (e.st && (e.st.stun || e.st.freeze))) return 1;
  const p = W.player, toP = Math.atan2(p.x - e.x, p.z - e.z);
  if (Math.abs(angDiff(toP, e.face)) > G.arc * Math.PI / 360) return 1;
  W.ev.push({ k: 'block', x: e.x, z: e.z, face: e.face });
  return G.mul;
}

// погоня с особым поведением: true — кадр обработан здесь (общая погоня не нужна)
export function foeAI(W, e, C, d, dx, dz, dt, see) {
  const p = W.player;
  if (e.state === 'aim') {                             // копейщик целится: лицо зафиксировано, полоса на земле
    e.t += dt;
    if (e.t >= C.lunge.aim) { e.state = 'dash'; e.t = 0; e.dashLeft = C.lunge.len; e.hitDone = false; W.ev.push({ k: 'lunge', x: e.x, z: e.z }); }
    return true;
  }
  if (e.state === 'dash') {                            // рывок по прямой; стена останавливает
    const L = C.lunge, stepLen = Math.min(e.dashLeft, L.speed * dt), x0 = e.x, z0 = e.z;
    slide(W.map, e, Math.sin(e.face) * stepLen, Math.cos(e.face) * stepLen, C.radius);
    const moved = len(e.x - x0, e.z - z0); e.dashLeft -= stepLen;
    if (!e.hitDone && !p.dead && len(p.x - e.x, p.z - e.z) < C.radius + W.cfg.player.radius + L.w * .5) { e.hitDone = true; hurtPlayer(W, Math.round(C.damage * L.mul * (e.dmgMul || 1)), e.x, e.z, e.onx || C.on, e); }
    if (e.dashLeft <= 0 || moved < stepLen * .4) { e.state = 'rec'; e.t = 0; e.tele = null; e.lcd = L.cd; }
    return true;
  }
  if (e.state === 'fuse') { e.t += dt; e.vx = e.vz = 0; return true; }   // фитиль горит: стоит на месте, взрыв считает пятно
  if (!e.alert || p.dead || !see) return false;
  if (C.ai === 'bomber' && d < C.fuse.at) {
    e.state = 'fuse'; e.t = 0;
    W.haz.push({ x: e.x, z: e.z, r: C.fuse.r, t: 0, delay: C.fuse.t, dmg: Math.round(C.damage * (e.dmgMul || 1)), on: C.on, by: e.id, foes: true, bomber: true });
    W.ev.push({ k: 'fuse', x: e.x, z: e.z });
    return true;
  }
  if (C.ai === 'lunge' && (e.lcd = (e.lcd || 0) - dt) <= 0 && d >= C.lunge.min && d <= C.lunge.max) {
    e.state = 'aim'; e.t = 0; e.face = Math.atan2(dx, dz); e.tele = { len: C.lunge.len, w: C.lunge.w, aim: C.lunge.aim };
    return true;
  }
  if (C.ai === 'blink' && (e.bcd = (e.bcd || 0) - dt) <= 0 && d >= C.blink.min && d <= C.blink.max) {
    const B = C.blink, tx = p.x - Math.sin(p.face) * B.behind, tz = p.z - Math.cos(p.face) * B.behind, o = { x: tx, z: tz };
    resolve(W.map, o, C.radius);
    const okLevel = W.map.rooms ? roomAt(W.map, o.x, o.z) >= 0 : len(o.x, o.z) < W.cfg.world.radius - 2;
    if (okLevel && len(o.x - tx, o.z - tz) < .6 && insideOf(W.map, o.x, o.z) === W.inside) {
      W.ev.push({ k: 'blink', x: e.x, z: e.z, x2: o.x, z2: o.z });
      e.x = o.x; e.z = o.z; e.vx = e.vz = 0; e.face = Math.atan2(p.x - e.x, p.z - e.z);
      e.state = 'wind'; e.t = -B.extra; e.bcd = B.cd;
      return true;
    }
    e.bcd = .5;                                        // места нет — попробует позже
  }
  return false;
}
