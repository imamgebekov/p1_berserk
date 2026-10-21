// Дальние враги (лучник, колдун), снаряды, опасные пятна и элитные враги с особыми свойствами. Чистая логика.
import { clamp, len, rr } from './util3d.js';
import { hurtPlayer, angDiff } from './sim.js';
import { hurtAlly } from './squad3d.js';
import { speedMul } from './status3d.js';
import { ngMul } from './ng3d.js';
import { slide, resolve, roomAt, insideOf } from './map.js';
import { zoneAt } from './zones3d.js';

// ---- элитные враги: шанс по глубине, опасности и ночи; считается от номера врага, без расхода генератора случайных чисел ----
const hash01 = (id, seed) => { const s = Math.sin(id * 12.9898 + seed * 78.233) * 43758.5453; return s - Math.floor(s); };
export const affOf = (W, id) => W.cfg.elite.affixes[id] || (W.cfg.elite.affixes2 || {})[id];
export const hasAff = (e, id) => e.aff === id || e.aff2 === id;     // второе свойство элиты (этап 2 «круче»)
export function rollElite(W, e, depth, danger) {
  const K = W.cfg.elite, C = W.cfg.enemies[e.type]; if (!K || C.boss || C.noElite) return false;
  const zr = (!W.lvl || W.lvl === 'surface') && K.outerK ? zoneAt(W.cfg, e.x, e.z) : null, outer = zr && zr.ring >= 2 ? zr.ring - 1 : 0;     // мир ×2 (4.06): кольца 60–70 и 70–80 — элита чаще и всегда с двумя свойствами
  const G = W.ng ? ngMul(W) : null, p = K.chance + K.depthK * depth + K.dangerK * danger + (W.night ? K.nightK : 0) + (G ? G.elite : 0) + outer * (K.outerK || 0);     // «Новый круг» — элита чаще
  if (hash01(e.id, W.cfg.world.seed) >= p) return false;
  const ids = Object.keys(K.affixes).concat(K.extra && K.affixes2 ? Object.keys(K.affixes2) : []), id = ids[Math.floor(hash01(e.id + .5, W.cfg.world.seed) * ids.length) % ids.length], A = affOf(W, id);     // extra — новые свойства (этап 2 «круче»)
  e.elite = true; e.aff = id; e.affName = C.g === 'f' && A.nameF ? A.nameF : A.name; e.affColor = A.color;      // «Пылающая Гончая», а не «Пылающий»
  e.hp = e.maxhp = Math.round(e.maxhp * K.hp * (A.hp || 1)); e.dmgMul *= K.dmg; e.scaleMul = K.scale; e.spdMul = A.speed || 1;
  if (A.on) e.onx = A.on; if (A.immune) e.imm = A.immune;
  if (K.extra && (depth >= K.dual || (G && G.dual) || outer > 0)) {                                           // глубоко — второе свойство: «Быстрый и ледяной Бес»
    const rest = ids.filter(x => x !== id), id2 = rest[Math.floor(hash01(e.id + .25, W.cfg.world.seed) * rest.length) % rest.length], B = affOf(W, id2);
    e.aff2 = id2; e.affName += ' и ' + (C.g === 'f' && B.nameF ? B.nameF : B.name).toLowerCase(); e.hp = e.maxhp = Math.round(e.maxhp * (B.hp || 1)); e.spdMul *= B.speed || 1;
    if (B.on && !e.onx) e.onx = B.on; if (B.immune) e.imm = (e.imm || []).concat(B.immune);
  }
  return true;
}
// свойства элиты в бою (этап 2 «круче»): блуждающий прыгает к герою, призыватель на половине здоровья зовёт подмогу
export function eliteTick(W, e, dt) {
  const p = W.player, d = len(p.x - e.x, p.z - e.z), C = W.cfg.enemies[e.type];
  if (hasAff(e, 'blink') && (e.ebcd = (e.ebcd ?? 2) - dt) <= 0 && d > 3.5 && d < 14 && e.state === 'chase') { const B = affOf(W, 'blink'); e.ebcd = blinkTo(W, e, C, { behind: 1.4, extra: .2, cd: e.bcd || 0 }) ? B.cd : .5; }
  if (hasAff(e, 'summoner') && !e.summoned && e.hp < e.maxhp * affOf(W, 'summoner').at) {
    const S = affOf(W, 'summoner'); e.summoned = true; W.ev.push({ k: 'eliteCall', x: e.x, z: e.z });
    for (let i = 0; i < S.n; i++) { const a = e.id + i * 2.1, m = W.fx.spawn(S.type, e.x + Math.sin(a) * 2.5, e.z + Math.cos(a) * 2.5); if (m) { m.alert = true; m.minion = true; } }
  }
}
// вожак (мини-босс места, 2026-10-18): всегда элита со свойством, крепче в k раз, со званием; метка на карте — как у элиты
export function makeChief(W, e, title, k) {
  if (!e.elite) { const K = W.cfg.elite, ids = Object.keys(K.affixes), id = ids[e.id % ids.length], A = K.affixes[id], C = W.cfg.enemies[e.type];
    e.elite = true; e.aff = id; e.affName = C.g === 'f' && A.nameF ? A.nameF : A.name; e.affColor = A.color; e.hp = e.maxhp = Math.round(e.maxhp * K.hp * (A.hp || 1)); e.dmgMul *= K.dmg; e.scaleMul = K.scale; e.spdMul = A.speed || 1; if (A.on) e.onx = A.on; if (A.immune) e.imm = A.immune; }
  e.hp = e.maxhp = Math.round(e.maxhp * k); e.chief = title; e.scaleMul = (e.scaleMul || 1) * 1.15;
}
export const eliteName = (W, e) => (e.chief ? `${e.chief} · ${e.affName.toLowerCase()}` : e.elite ? `${e.affName} ${W.cfg.enemies[e.type].name || ''}`.trim() : '');
// вампир лечится от нанесённого урона; вызывается после удара по герою
export function eliteOnHit(W, e, dmg) { if (hasAff(e, 'vampiric')) e.hp = Math.min(e.maxhp, e.hp + dmg * W.cfg.elite.affixes.vampiric.heal); if (hasAff(e, 'frost')) { W.chillT = affOf(W, 'frost').t; W.ev.push({ k: 'chill', x: W.player.x, z: W.player.z }); } }     // ледяной — герой медленнее
// взрывной оставляет пятно: через пару мгновений рванёт и заденет всех рядом
export function eliteOnDeath(W, e) {
  if (!hasAff(e, 'explosive')) return;
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
export function hitsWall(map, x, z) {
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
    const q = W.proj[i]; if (q.friendly) continue;                // стрелы героя летят в sim.js (updateArrows)
    q.life -= dt; q.x += q.vx * dt; q.z += q.vz * dt;
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
    if (e.t >= C.lunge.aim) { e.state = 'dash'; e.t = 0; e.dashLeft = e.tele && e.tele.mv ? Math.min(C.lunge.len, len(p.x - e.x, p.z - e.z) + .3) : C.lunge.len;     // прыжок-наскок (этап 2 «круче») — до героя, без перелёта
      e.hitDone = false; W.ev.push({ k: 'lunge', x: e.x, z: e.z }); }
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
  if (C.ai === 'flee') { e.alert = true; e.state = 'chase'; e.runT = (e.runT || 0) + dt; const rest = e.runT % (C.run[0] + C.run[1]) > C.run[0];     // бежит run[0] с, переводит дух run[1] с
    if (d < C.flee && !p.dead && !rest) { const sp = C.speed * speedMul(e) * dt, a = Math.atan2(-dx, -dz) + Math.sin(W.t * 2.3 + e.id) * .6; e.face = a; slide(W.map, e, Math.sin(a) * sp, Math.cos(a) * sp, C.radius); } return true; }     // вор бежит прочь зигзагом, не бьёт
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
  if (C.ai === 'move') return moveAI(W, e, C, d, dx, dz, dt);
  if (C.ai === 'blink' && (e.bcd = (e.bcd || 0) - dt) <= 0 && d >= C.blink.min && d <= C.blink.max) { if (blinkTo(W, e, C, C.blink)) return true; e.bcd = .5; }     // места нет — попробует позже
  return false;
}
// прыжок тенью за спину героя; false — места нет
function blinkTo(W, e, C, B) {
  const p = W.player;
  {
    const tx = p.x - Math.sin(p.face) * B.behind, tz = p.z - Math.cos(p.face) * B.behind, o = { x: tx, z: tz };
    resolve(W.map, o, C.radius);
    const okLevel = W.map.rooms ? roomAt(W.map, o.x, o.z) >= 0 : len(o.x, o.z) < W.cfg.world.radius - 2;
    if (okLevel && len(o.x - tx, o.z - tz) < .6 && insideOf(W.map, o.x, o.z) === W.inside) {
      W.ev.push({ k: 'blink', x: e.x, z: e.z, x2: o.x, z2: o.z });
      e.x = o.x; e.z = o.z; e.vx = e.vz = 0; e.face = Math.atan2(p.x - e.x, p.z - e.z);
      e.state = 'wind'; e.t = -B.extra; e.bcd = B.cd;
      return true;
    }
  }
  return false;
}

// приёмы «числовых» врагов (этап 2 «круче»; cfg.enemies.moves — общий выключатель): leap — прыжок-наскок (механизм рывка),
// slam — удар по земле волной вокруг себя, spit — плевок лужей под героя (зоны W.haz с задержкой — их видно на земле),
// howl — вой: стая рядом быстрее, pull — притягивает героя, skin — каменная кожа на половине здоровья, phase — сквозь тьму
// (почти неуязвим и быстрее), ambush — прыжок за спину. true — кадр обработан здесь
export function moveAI(W, e, C, d, dx, dz, dt) {
  const M = C.move, p = W.player; if (!M || !W.cfg.enemies.moves || e.minion) return false;
  if (e.state === 'mcast') {
    e.t += dt; e.vx = e.vz = 0;
    if (e.t >= M.wind) { e.state = 'rec'; e.t = 0;
      if (M.kind === 'pull' && !p.dead && len(p.x - e.x, p.z - e.z) <= M.max + 1) { W.ev.push({ k: 'pull', x: e.x, z: e.z, x2: p.x, z2: p.z }); const dd = len(p.x - e.x, p.z - e.z) || 1; if (hurtPlayer(W, Math.round(C.damage * M.mul * (e.dmgMul || 1)), p.x + (p.x - e.x), p.z + (p.z - e.z), null, e) !== false) { p.vx -= (p.x - e.x) / dd * M.force; p.vz -= (p.z - e.z) / dd * M.force; } } }     // увернулся — не тянет     // удар «из-за спины» героя толкает его к врагу
    return true;
  }
  e.mcd = (e.mcd ?? (M.first ?? 1.5)) - dt; if (e.mcd > 0) return false;
  const dmg = Math.round(C.damage * (M.mul || 1) * (e.dmgMul || 1));
  switch (M.kind) {
    case 'leap': if (d < M.min || d > M.max) return false; e.state = 'aim'; e.t = 0; e.face = Math.atan2(dx, dz); e.tele = { len: C.lunge.len, w: C.lunge.w, aim: C.lunge.aim, mv: true }; e.lcd = C.lunge.cd; e.mcd = M.cd; return true;
    case 'slam': if (d > M.r * .8) return false; W.haz.push({ x: e.x, z: e.z, r: M.r, t: 0, delay: M.wind, dmg, on: M.on || C.on, by: e.id, mv: true }); W.ev.push({ k: 'slam', x: e.x, z: e.z }); e.state = 'mcast'; e.t = 0; e.mcd = M.cd; return true;
    case 'spit': if (d < M.min || d > M.max) return false; W.haz.push({ x: p.x, z: p.z, r: M.r, t: 0, delay: M.delay, dmg, on: M.on || C.on, by: e.id, mv: true }); W.ev.push({ k: 'spit', x: e.x, z: e.z }); e.state = 'mcast'; e.t = 0; e.mcd = M.cd; return true;
    case 'pull': if (d < M.min || d > M.max) return false; W.ev.push({ k: 'pullStart', x: e.x, z: e.z }); e.state = 'mcast'; e.t = 0; e.face = Math.atan2(dx, dz); e.mcd = M.cd; return true;
    case 'howl': e.mcd = M.cd; for (const o of W.enemies) if (!o.dead && o.type === e.type && len(o.x - e.x, o.z - e.z) < M.r) { o.hasteT = M.t; o.haste = M.spd; o.alert = true; } W.ev.push({ k: 'howl', x: e.x, z: e.z }); return false;
    case 'skin': if (e.skinUsed || e.hp > e.maxhp * M.at) { e.mcd = .3; return false; } e.skinUsed = true; e.skinT = M.t; e.skinMul = M.mul; W.ev.push({ k: 'skin', x: e.x, z: e.z, id: e.id }); return false;
    case 'phase': if (d < M.min || d > M.max) return false; e.phaseT = M.t; e.skinMul = M.mul; e.hasteT = M.t; e.haste = M.spd; e.mcd = M.cd; W.ev.push({ k: 'phase', x: e.x, z: e.z, id: e.id }); return false;
    case 'ambush': if (d < M.min || d > M.max) return false; e.mcd = blinkTo(W, e, C, M) ? M.cd : .5; return e.state === 'wind';
  }
  return false;
}
