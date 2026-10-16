// Рельеф (C2): река, мосты и высоты земли. Чистая геометрия без графики (проверяется в Node).
// Река — гладкая кривая от края до края мира по параметрам terrain.river (подобраны так, чтобы обходить лагерь, дома, посёлки,
// логова и входы в подземелья). Вода непроходима для героя, врагов и бойцов; мосты — проходимые полосы поперёк русла.
// Высоты нужны только рендеру: бой остаётся плоским.

// ---- река ----
const segDist = (x, z, a, b) => { const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2)); return { d: Math.hypot(x - a.x - dx * t, z - a.z - dz * t), t, px: a.x + dx * t, pz: a.z + dz * t }; };

export function riverOf(cfg) {
  const T = cfg.terrain; if (!T || !T.on || !T.river) return null;
  const RV = T.river, R = RV.rad || cfg.world.radius + RV.out,     // rad — радиус ядра для большого мира (C3b)
    a1 = RV.a1 * Math.PI / 180, a2 = (RV.a1 + RV.da) * Math.PI / 180;
  const A = { x: Math.sin(a1) * R, z: Math.cos(a1) * R }, B = { x: Math.sin(a2) * R, z: Math.cos(a2) * R }, nx = -(B.z - A.z), nz = B.x - A.x, L = Math.hypot(nx, nz);
  const pts = [];
  for (let i = 0; i <= RV.n; i++) { const t = i / RV.n, s = Math.sin(Math.PI * t) * RV.bend + Math.sin(3 * Math.PI * t) * RV.bend * .15; pts.push({ x: A.x + (B.x - A.x) * t + nx / L * s, z: A.z + (B.z - A.z) * t + nz / L * s }); }
  // длины по ломаной — для мостов по доле пути
  const acc = [0]; for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  const at = f => { const s = f * acc[acc.length - 1]; let i = 1; while (i < acc.length - 1 && acc[i] < s) i++; const a = pts[i - 1], b = pts[i], k = (s - acc[i - 1]) / (acc[i] - acc[i - 1] || 1); return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, ang: Math.atan2(b.x - a.x, b.z - a.z) }; };
  const bridges = T.bridges.map(f => { const p = at(f), ang = p.ang + Math.PI / 2; return { x: p.x, z: p.z, ang, len: RV.w + T.bridge.over * 2, w: T.bridge.w }; });   // мост поперёк русла
  bridges.push(...(RV.extraBridges || []).map(b => ({ ...b })));                 // мосты на продолжении (C3b)
  const all = [...(RV.head || []), ...pts, ...(RV.tail || [])];
  // указатель для waterDist: клетки RCELL м → отрезки ближе RPAD м (дальше — «далеко»)
  const cells = new Map();
  for (let i = 1; i < all.length; i++) { const a = all[i - 1], b = all[i];
    for (let cx = Math.floor((Math.min(a.x, b.x) - RPAD) / RCELL); cx <= Math.floor((Math.max(a.x, b.x) + RPAD) / RCELL); cx++)
      for (let cz = Math.floor((Math.min(a.z, b.z) - RPAD) / RCELL); cz <= Math.floor((Math.max(a.z, b.z) + RPAD) / RCELL); cz++) { const k = cx * 100003 + cz; if (!cells.has(k)) cells.set(k, []); cells.get(k).push(i); } }
  return { pts: all, w: RV.w, bridges, cells, core: pts.length };
}
const RCELL = 32, RPAD = 34;
// есть ли река ближе RPAD м к прямоугольнику
export function riverNearBox(rv, x0, z0, x1, z1) {
  if (!rv) return false; if (!rv.cells) return true;
  for (let cx = Math.floor(x0 / RCELL); cx <= Math.floor(x1 / RCELL); cx++) for (let cz = Math.floor(z0 / RCELL); cz <= Math.floor(z1 / RCELL); cz++) if (rv.cells.has(cx * 100003 + cz)) return true;
  return false;
}
// точка на мосту (в прямоугольнике моста, ось ang — вдоль моста)
export function onBridge(rv, x, z, pad = 0) {
  for (const b of rv.bridges) { const s = Math.sin(b.ang), c = Math.cos(b.ang), dx = x - b.x, dz = z - b.z, along = dx * s + dz * c, across = dx * c - dz * s; if (Math.abs(along) <= b.len / 2 + pad && Math.abs(across) <= b.w / 2 + pad) return b; }
  return null;
}
// расстояние от точки до воды (отрицательное — в воде)
export function waterDist(rv, x, z) {
  let d = 1e9; const L = rv.cells ? rv.cells.get(Math.floor(x / RCELL) * 100003 + Math.floor(z / RCELL)) : null;
  if (rv.cells) { if (!L) return 1e3; for (const i of L) d = Math.min(d, segDist(x, z, rv.pts[i - 1], rv.pts[i]).d); }     // точно до RPAD м от воды
  else for (let i = 1; i < rv.pts.length; i++) d = Math.min(d, segDist(x, z, rv.pts[i - 1], rv.pts[i]).d);
  return d - rv.w / 2;
}
export const inWater = (rv, x, z, pad = 0) => !!rv && waterDist(rv, x, z) < pad && !onBridge(rv, x, z);
// вытолкнуть круг из воды на ближайший берег (на мосту — не трогать); segs — индексы участков русла рядом (из сетки), иначе все
export function pushWater(rv, o, r, segs) {
  if (onBridge(rv, o.x, o.z)) return false;
  let hit = false;
  const list = segs || rv.pts.slice(1).map((_, i) => i);
  for (const i of list) {
    const a = rv.pts[i], b = rv.pts[i + 1], q = segDist(o.x, o.z, a, b), m = rv.w / 2 + r;
    if (q.d >= m) continue;
    hit = true;
    if (q.d > 1e-9) { const k = m / q.d; o.x = q.px + (o.x - q.px) * k; o.z = q.pz + (o.z - q.pz) * k; }
    else { const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1; o.x = q.px - dz / l * m; o.z = q.pz + dx / l * m; }
  }
  return hit;
}
// пересекает ли отрезок воду (не по мосту)
export function crossesWater(rv, x0, z0, x1, z1) {
  const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / .5));
  for (let i = 1; i < n; i++) { const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n; if (waterDist(rv, x, z) < 0 && !onBridge(rv, x, z)) return true; }
  return false;
}
// куда идти, чтобы попасть к цели через реку: к ближнему концу лучшего моста, оттуда на ось моста, по мосту — к дальнему концу;
// null — вода не мешает
const ends = (b, k) => { const s = Math.sin(b.ang), c = Math.cos(b.ang); return [{ x: b.x - s * k, z: b.z - c * k }, { x: b.x + s * k, z: b.z + c * k }]; };
const dist = (a, x, z) => Math.hypot(a.x - x, a.z - z);
export function bridgeGoal(rv, x, z, tx, tz) {
  if (!rv || !rv.bridges.length || !crossesWater(rv, x, z, tx, tz)) return null;
  const on = onBridge(rv, x, z);
  if (on) { const [e1, e2] = ends(on, on.len / 2 + .6); return dist(e1, tx, tz) < dist(e2, tx, tz) ? e1 : e2; }       // на мосту — к концу у цели
  let best = null, bc = 1e9;
  for (const b of rv.bridges) {
    const [e1, e2] = ends(b, b.len / 2 + .6), [near, far] = dist(e1, x, z) < dist(e2, x, z) ? [e1, e2] : [e2, e1];
    const cost = dist(near, x, z) + b.len + dist(far, tx, tz);
    if (cost < bc) { bc = cost; if (dist(near, x, z) > 1.2) best = near; else { const [i1, i2] = ends(b, b.len / 2 - .4); best = dist(i1, x, z) < dist(i2, x, z) ? i1 : i2; } }    // у моста — на его ось
  }
  return best;
}

// ---- высоты (только для рендера) ----
// шум значений с зерном мира: две октавы, перепад ±amp. Земля ровная (0) у всего, что стоит или ходит по делу: лагерь, дома,
// дороги, места, зоны, логова, входы, сундуки, постройки — переход blend м. Русло проседает под водой, на мосту — настил.
const hash = (i, j, s) => { let h = (i * 374761393 + j * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const smooth = t => t * t * (3 - 2 * t);
function vnoise(x, z, s) { const i = Math.floor(x), j = Math.floor(z), fx = smooth(x - i), fz = smooth(z - j); const a = hash(i, j, s), b = hash(i + 1, j, s), c = hash(i, j + 1, s), d = hash(i + 1, j + 1, s); return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fz; }
// поле высот лениво, участками CH×CH м (C3a): участок считается, когда в нём впервые спросили высоту. У каждого участка — только
// те «ровные места», что могут его задеть (их расстояние меньше blend внутри рамки), поэтому большой мир считается быстро.
// Значения совпадают с прежним сплошным полем: та же решётка (узлы через cell от нуля), та же формула.
const CH = 64;
export function buildHeights(cfg, map) {
  const T = cfg.terrain, HL = T && T.hills, R = cfg.world.radius + 24, cell = HL ? HL.cell : 2;
  const hf = { R, cell, CH, chunks: new Map(), river: map.river, deck: T && T.bridge ? T.bridge.deck : .3, arch: T && T.bridge ? T.bridge.arch || 0 : 0, flat: !T || !T.on || !HL, built: 0 };
  if (hf.flat) return hf;
  const segD = (x, z, a, b) => segDist(x, z, a, b).d, B = HL.blend, keep = [];        // { f — расстояние до ровного места, рамка влияния }
  const add = (f, x0, x1, z0, z1, pad) => keep.push({ f, x0: x0 - pad - B, x1: x1 + pad + B, z0: z0 - pad - B, z1: z1 + pad + B });
  const circle = (x, z, r) => add((px, pz) => Math.hypot(px - x, pz - z) - r, x, x, z, z, Math.max(0, r));
  if (map.camp) circle(map.camp.x, map.camp.z, map.camp.r + 6);
  circle(0, 0, 8);
  for (const b of map.buildings) add((x, z) => Math.max(b.x0 - 4 - x, x - b.x1 - 4, b.z0 - 4 - z, z - b.z1 - 4), b.x0, b.x1, b.z0, b.z1, 4);
  for (const P of map.paths || (map.roads || []).map(pts => ({ pts }))) for (let i = 1; i < P.pts.length; i++) { const a = P.pts[i - 1], b = P.pts[i]; add((x, z) => segD(x, z, a, b) - 3, Math.min(a.x, b.x), Math.max(a.x, b.x), Math.min(a.z, b.z), Math.max(a.z, b.z), 3); }     // ровно вдоль троп
  for (const p of map.cfg.places || []) if (p.safe) circle(p.x, p.z, p.r);
  for (const zn of map.cfg.zones || []) { if (zn.w) add((x, z) => Math.max(Math.abs(x - zn.x) - zn.w / 2 - 2, Math.abs(z - zn.z) - zn.d / 2 - 2), zn.x - zn.w / 2, zn.x + zn.w / 2, zn.z - zn.d / 2, zn.z + zn.d / 2, 2); else circle(zn.x, zn.z, zn.r + 2); }
  for (const b of cfg.bosses.list) circle(b.x, b.z, 12);
  for (const q of map.portals || []) circle(q.x, q.z, 4);
  for (const c of map.containers) circle(c.x, c.z, 2.5);
  for (const q of map.solids) circle(q.x, q.z, q.r + 1.5);
  hf.keep = keep; hf.seed = cfg.world.seed * 131 + 17; hf.T = T; hf.HL = HL;
  return hf;
}
// узлы участка (ci, cj): (CH/cell + 1)² высот, с краями (соседние участки делят край)
function chunkOf(hf, ci, cj) {
  const key = ci * 100003 + cj; let c = hf.chunks.get(key); if (c) return c;
  const { cell, R, T, HL } = hf, m = Math.round(CH / cell) + 1, data = new Float32Array(m * m), x0 = ci * CH, z0 = cj * CH;
  const ks = hf.keep.filter(k => k.x1 >= x0 && k.x0 <= x0 + CH && k.z1 >= z0 && k.z0 <= z0 + CH);
  const rv = hf.river && riverNearBox(hf.river, x0 - T.bank, z0 - T.bank, x0 + CH + T.bank, z0 + CH + T.bank) ? hf.river : null;     // река далеко — не считаем
  for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) data[j * m + i] = nodeH(hf, x0 + i * cell, z0 + j * cell, ks, rv, true);
  c = { m, data }; hf.chunks.set(key, c); hf.built++; return c;
}
// высота узла решётки: ks — ровные места, rv — река (null — далеко); box — пропускать места, чья рамка не задевает точку
function nodeH(hf, x, z, ks, rv, box) {
  const { R, T, HL } = hf;
  if (Math.abs(x) > R || Math.abs(z) > R) return 0;
  let d = 1e9; for (const k of ks) { if (box && (x < k.x0 || x > k.x1 || z < k.z0 || z > k.z1)) continue; const v = k.f(x, z); if (v < d) d = v; if (d <= 0) break; }
  const kk = d <= 0 ? 0 : d >= HL.blend ? 1 : smooth(d / HL.blend);
  let h = 0; if (kk > 0) { let amp = 1, fr = 1 / HL.scale, sum = 0, norm = 0; for (let o = 0; o < HL.oct; o++) { sum += (vnoise(x * fr, z * fr, hf.seed + o) - .5) * 2 * amp; norm += amp; amp *= .5; fr *= 2; } h = sum / norm * HL.amp * kk; }
  if (rv) { const w = waterDist(rv, x, z); if (w < T.bank) { const t = Math.max(0, Math.min(1, w < 0 ? 0 : w / T.bank)); h = h * smooth(t) + T.bed * (1 - smooth(t)); } }
  const e = R - Math.max(Math.abs(x), Math.abs(z)); if (e < 10) h *= Math.max(0, e / 10);     // к краю мира — ровно
  return h;
}
// эталон для тестов: высота узла по всем ровным местам и всей реке, без участков и рамок
export const nodeHeightRef = (hf, x, z) => (hf.flat ? 0 : nodeH(hf, x, z, hf.keep, hf.river, false));
export const CHUNK = CH;
// высота настила моста в точке: дуга — у концов deck, к середине выше на arch (F4)
export function deckAt(b, x, z, deck, arch) { const a = (x - b.x) * Math.sin(b.ang) + (z - b.z) * Math.cos(b.ang), k = Math.max(0, 1 - Math.pow(2 * a / b.len, 2)); return deck + arch * k; }
// высота земли в точке (плавная выборка); на мосту — высота настила (deck = false — сама земля под мостом, для сетки холмов)
export function heightAt(hf, x, z, deck = true) {
  if (!hf) return 0;
  if (deck && hf.river) { const b = onBridge(hf.river, x, z); if (b) return deckAt(b, x, z, hf.deck, hf.arch || 0); }
  if (hf.flat || x < -hf.R || z < -hf.R || x >= hf.R - hf.cell || z >= hf.R - hf.cell) return 0;
  const ci = Math.floor(x / CH), cj = Math.floor(z / CH), C = chunkOf(hf, ci, cj), m = C.m;
  const fx = (x - ci * CH) / hf.cell, fz = (z - cj * CH) / hf.cell, i = Math.min(m - 2, Math.floor(fx)), j = Math.min(m - 2, Math.floor(fz));
  const tx = fx - i, tz = fz - j, D = C.data, a = D[j * m + i], b = D[j * m + i + 1], c = D[(j + 1) * m + i], d = D[(j + 1) * m + i + 1];
  return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
}
