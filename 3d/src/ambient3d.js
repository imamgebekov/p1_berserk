// Мелкое оживление (A6): жители лагеря ходят по делам, вороны взлетают при приближении, дым из труб, туман по утрам.
// Только вид: симуляция, бой и сохранение не меняются. Здесь чистая логика без THREE (проверяется в Node); рисует render.js.
import { campOf, insideCamp, insideOf } from './map.js';
import { phaseOf } from './daynight.js';

const TAU = Math.PI * 2;

// остановки жителей: у двери каждого дома лагеря и «спица» той же дороги у костра (на дорогах свободно)
export function villagerStops(map, cfg) {
  const C = campOf(cfg); if (!C) return [];
  const A = cfg.ambient, out = [];
  for (const [a, b] of map.roads || []) {
    if (!(a.x === 0 && a.z === 0) || !insideCamp(C, b.x, b.z, 2) || insideOf(map, b.x, b.z) >= 0) continue;
    const L = Math.hypot(b.x, b.z) || 1, sx = b.x / L * A.fireGap, sz = b.z / L * A.fireGap;
    let clear = true; for (let k = 0; k <= 40 && clear; k++) clear = insideOf(map, sx + (b.x - sx) * k / 40, sz + (b.z - sz) * k / 40, .3) < 0;     // дорога сквозь чужой дом — не ходим
    if (clear) out.push({ x: b.x, z: b.z, a: Math.atan2(b.x, b.z), sx, sz });
  }
  return out;
}
// путь от двери i к двери j: по своей дороге к костру, по кругу вокруг огня, по чужой дороге к двери
function route(stops, i, j, A) {
  const s = stops[i], t = stops[j], path = [{ x: s.sx, z: s.sz }];
  let d = t.a - s.a; d -= Math.round(d / TAU) * TAU;
  const n = Math.ceil(Math.abs(d) / .35);
  for (let k = 1; k <= n; k++) { const a = s.a + d * k / n; path.push({ x: Math.sin(a) * A.fireGap, z: Math.cos(a) * A.fireGap }); }
  path.push({ x: t.x, z: t.z });
  return path;
}
export function makeVillagers(stops, n, rnd) {
  if (stops.length < 2) return [];
  return Array.from({ length: n }, (_, i) => { const at = (rnd() * stops.length) | 0, s = stops[at]; return { id: i, at, x: s.x, z: s.z, path: [], face: rnd() * TAU, wait: rnd() * 4, moving: false }; });
}
// житель: стоит у двери, потом идёт к другой
export function stepVillager(v, dt, stops, A, rnd) {
  if (v.wait > 0) { v.wait -= dt; v.moving = false; return; }
  if (!v.path.length) { let j = (rnd() * stops.length) | 0; if (j === v.at) j = (j + 1) % stops.length; v.path = route(stops, v.at, j, A); v.at = j; }
  const q = v.path[0], dx = q.x - v.x, dz = q.z - v.z, d = Math.hypot(dx, dz);
  const st = Math.min(d, A.walk * dt); if (d > 1e-9) { v.x += dx / d * st; v.z += dz / d * st; v.face = Math.atan2(dx, dz); }
  v.moving = true;
  if (d - st < 1e-6) { v.path.shift(); if (!v.path.length) { v.wait = A.pause[0] + rnd() * (A.pause[1] - A.pause[0]); v.moving = false; } }
}

// вороны: сидят вне лагеря; герой ближе scare — взлетают прочь и вверх, улетев — исчезают; вернутся через back секунд, если героя рядом нет
export function makeBirds(map, cfg, rnd) {
  const A = cfg.ambient, C = campOf(cfg), R = cfg.world.radius, out = [];
  for (let k = 0; out.length < A.birds && k < A.birds * 40; k++) {
    const a = rnd() * TAU, d = 20 + Math.sqrt(rnd()) * (R - 26), x = Math.sin(a) * d, z = Math.cos(a) * d;
    if ((C && insideCamp(C, x, z, -4)) || insideOf(map, x, z, 1) >= 0 || map.solids.some(s => Math.hypot(s.x - x, s.z - z) < s.r + .5)) continue;
    out.push({ hx: x, hz: z, x, y: 0, z, vx: 0, vy: 0, vz: 0, face: rnd() * TAU, state: 'sit', t: 0, peck: rnd() * 3 });
  }
  return out;
}
export function updateBirds(birds, px, pz, dt, A) {
  for (const b of birds) {
    if (b.state === 'sit') {
      b.peck -= dt; if (b.peck <= 0) { b.peck = 1.5 + (b.hx * 7.31 + b.t) % 2.5; b.face += .7; }
      const dx = b.x - px, dz = b.z - pz, d = Math.hypot(dx, dz);
      if (d < A.scare) { const k = 1 / (d || 1); b.state = 'fly'; b.t = 0; b.vx = dx * k * A.flySpeed; b.vz = dz * k * A.flySpeed; b.vy = A.flyUp; b.face = Math.atan2(b.vx, b.vz); }
    } else if (b.state === 'fly') {
      b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.vy += .6 * dt;
      if (b.t > A.flyTime) { b.state = 'gone'; b.t = 0; }
    } else if ((b.t += dt) > A.back && Math.hypot(b.hx - px, b.hz - pz) > A.scare * 2.5) { b.state = 'sit'; b.x = b.hx; b.z = b.hz; b.y = 0; b.t = 0; }
  }
}

// трубы: у жилых домов, в углу крыши
export function chimneys(map, cfg) {
  const A = cfg.ambient, H = cfg.map.wallH;
  return map.buildings.filter(b => A.smokeKinds.includes(b.kind) || b.npc).map(b => ({ x: b.x1 - 1.1, z: b.z0 + 1.1, y: H + A.chimneyH }));
}

// туман гуще на рассвете: множитель плотности (1 — как днём)
export function fogMul(t, D, A) {
  let d = phaseOf(t, D) - A.fogPeak; d -= Math.round(d);
  return Math.abs(d) < A.fogWidth ? 1 + A.fogAmp * (Math.cos(Math.PI * d / A.fogWidth) + 1) / 2 : 1;
}

// звери (G2): олени и зайцы пасутся вокруг героя вне экрана, пугаются ближе scare м и убегают; ушедшие за away м — появляются заново.
// ok(x, z) — можно ли тут стоять (не вода, не дом, не камень, не лагерь). Только вид.
export function makeBeasts(n) { return Array.from({ length: n }, (_, i) => ({ id: i, kind: i % 3 === 0 ? 'deer' : 'hare', x: 0, z: 0, face: 0, state: 'gone', t: 0, step: 0, moving: false })); }
// вид зверя по биому (2026-10-18): таблица весов A.kinds; вне биомов (ядро) — как в лесу
export function beastKind(A, bio, rnd) { const T = (A.kinds && (A.kinds[bio] || A.kinds.forest)) || [['deer', 1], ['hare', 2]]; let w = rnd() * T.reduce((a, k) => a + k[1], 0); for (const [k, n] of T) { w -= n; if (w <= 0) return k; } return T[0][0]; }
export function updateBeasts(B, px, pz, dt, A, rnd, ok, bioAt) {
  for (const b of B) {
    const dx = b.x - px, dz = b.z - pz, d = Math.hypot(dx, dz);
    if (b.state === 'gone' || d > A.away) {
      const a = rnd() * TAU, r = A.ring[0] + rnd() * (A.ring[1] - A.ring[0]), x = px + Math.sin(a) * r, z = pz + Math.cos(a) * r;
      if (ok(x, z)) Object.assign(b, { x, z, state: 'graze', t: 1 + rnd() * 3, face: rnd() * TAU, kind: bioAt ? beastKind(A, bioAt(x, z), rnd) : b.kind }); else b.state = 'gone';
      continue;
    }
    if (b.state !== 'flee' && d < A.scare) { b.state = 'flee'; b.face = Math.atan2(dx, dz) + (rnd() - .5) * .6; b.t = 0; }
    let v = 0;
    if (b.state === 'graze') { if ((b.t -= dt) <= 0) { b.state = 'walk'; b.t = 1 + rnd() * 2; b.face += (rnd() - .5) * 2; } }
    else if (b.state === 'walk') { v = A.walk; if ((b.t -= dt) <= 0) { b.state = 'graze'; b.t = 2 + rnd() * 4; } }
    else { v = A.run * ((A.speed && A.speed[b.kind]) || (b.kind === 'deer' ? 1.15 : 1)); b.t += dt; if (b.kind === 'hare' && b.t > .45) { b.t = 0; b.face += (rnd() - .5) * 1.4; } }     // заяц петляет
    if (v) {
      const nx = b.x + Math.sin(b.face) * v * dt, nz = b.z + Math.cos(b.face) * v * dt;
      if (ok(nx, nz)) { b.x = nx; b.z = nz; } else b.face += 1.3;
    }
    b.moving = v > 0; b.step += dt * v;
  }
}

// утки (2026-10-18): плавают по ближнему озеру (ближе near м к герою) кругами; герой у воды ближе scare м — отплывают прочь,
// но остаются в озере. lakes — [{ x, z, r }], R(L, ang) — радиус берега по углу. Только вид.
export function makeDucks(n) { return Array.from({ length: n }, (_, i) => ({ id: i, lake: null, a: i * 1.7, rr: .35 + (i % 3) * .15, x: 0, z: 0, face: 0, flee: 0 })); }
export function updateDucks(D, px, pz, dt, lakes, A, R) {
  let lake = null, ld = A.near; for (const L of lakes || []) { const d = Math.hypot(L.x - px, L.z - pz) - L.r; if (d < ld && L.r > 5) { ld = d; lake = L; } }
  for (const d of D) {
    if (d.lake !== lake) { d.lake = lake; d.flee = 0; }
    if (!lake) continue;
    const away = Math.hypot(d.x - px, d.z - pz) < A.scare && d.flee <= 0 ? 1 : 0; if (away) d.flee = 2.5; if (d.flee > 0) d.flee -= dt;
    const w = (A.swim / Math.max(2, lake.r * d.rr)) * (d.flee > 0 ? A.flee : 1) * (d.id % 2 ? 1 : -1); d.a += w * dt;
    if (d.flee > 0) { const pa = Math.atan2(px - lake.x, pz - lake.z), da = Math.atan2(Math.sin(d.a - pa), Math.cos(d.a - pa)); d.a += Math.sign(da || 1) * dt * A.flee * .4; }     // прочь от героя по кругу
    const rad = R(lake, d.a) * d.rr * (d.flee > 0 ? .7 : 1), nx = lake.x + Math.sin(d.a) * rad, nz = lake.z + Math.cos(d.a) * rad;
    d.face = Math.atan2(nx - d.x, nz - d.z); d.x = nx; d.z = nz;
  }
}

