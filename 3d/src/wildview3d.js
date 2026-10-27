// Вид малого мира (2026-10-27): земля — одна сетка: на полянах и тропах ровно (там ходят), за краем — холмы; лес и камни — полосой
// у края (у ближнего к камере края — только кусты и камни, чтобы не закрывали героя), валуны и деревья края полян — из обстановки
// (w_tree, w_rock), трава — на полянах. Деревья, кусты и камни — копиями нескольких образцов, кусками для отсечения вне кадра.
// Числа — config3d.js → dungeons.wild.view и themes. Только графика.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { addTree, addRock, addBush } from './models.js';
import { mulberry } from './dungeongen3d.js';
import { vnoise } from './terrain3d.js';

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// расстояние от точки до ходимой земли (0 — на поляне или тропе); круглые поляны — эллипсом
export function wildDist(rooms, x, z) {
  let best = Infinity;
  for (const r of rooms) {
    let d;
    if (r.shape === 'round' || r.shape === 'oct') { const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2, hw = (r.x1 - r.x0) / 2, hd = (r.z1 - r.z0) / 2, q = Math.hypot((x - cx) / hw, (z - cz) / hd); d = Math.max(0, q - 1) * Math.min(hw, hd); }
    else d = Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
    if (d < best) { best = d; if (d <= 0) return 0; }
  }
  return best;
}
// образцы: собрать дерево (куст, камень) в начале координат одним куском
function samples(fn, n, look, seed) { const out = []; for (let i = 0; i < n; i++) { const L = []; fn(L, mulberry(seed + i * 977), look); if (!L.length) continue; try { out.push(L.length > 1 ? mergeGeometries(L.map(g => (g.index ? g.toNonIndexed() : g)), false) : L[0]); } catch { out.push(L[0]); } } return out; }

export function buildWildGround(M, cfg) {
  const X = cfg.dungeons.wild, V = X.view, th = X.themes[M.wild.theme] || Object.values(X.themes).find(t => t.ground), look = { ...cfg.look, ...th.look };
  const group = new THREE.Group(), walk = M.rooms.filter(r => !r.pit), B = M.bounds, g = V.grid, m = V.margin;
  const x0 = B.x0 - m, z0 = B.z0 - m, nx = Math.ceil((B.x1 - B.x0 + 2 * m) / g) + 1, nz = Math.ceil((B.z1 - B.z0 + 2 * m) / g) + 1;
  // земля: высота и цвет по расстоянию до края
  const D = new Float32Array(nx * nz), H = new Float32Array(nx * nz), CS = new Float32Array(nx * nz);     // CS — сторона камеры: ходимая земля севернее (ближе к камере склон ниже и без деревьев)
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const x = x0 + i * g, z = z0 + j * g, d = wildDist(walk, x, z), k = j * nx + i; D[k] = d;
    const cs = d <= 0 ? 0 : smooth(0, 1, (d - wildDist(walk, x, z - V.camSide)) / (V.camSide * .6)); CS[k] = cs;
    H[k] = d <= 0 ? 0 : (V.hillH * smooth(0, V.hillW, d) * (.7 + .6 * vnoise(x / 47, z / 47, 3)) + Math.min(1, d / 8) * 1.6 * vnoise(x / 9, z / 9, 5)) * (1 - V.camLow * cs); }
  const hAt = (x, z) => { const fi = Math.max(0, Math.min(nx - 1.001, (x - x0) / g)), fj = Math.max(0, Math.min(nz - 1.001, (z - z0) / g)), i = fi | 0, j = fj | 0, u = fi - i, v = fj - j, k = j * nx + i;
    return H[k] * (1 - u) * (1 - v) + H[k + 1] * u * (1 - v) + H[k + nx] * (1 - u) * v + H[k + nx + 1] * u * v; };
  const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3), C = { gr: new THREE.Color(th.ground), pa: new THREE.Color(th.path), hi: new THREE.Color(th.hill), to: new THREE.Color(th.top), ro: new THREE.Color(th.rock) }, c = new THREE.Color();
  const trails = walk.filter(r => r.corridor);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i, x = x0 + i * g, z = z0 + j * g, d = D[k], h = H[k];
    pos.set([x, h, z], k * 3);
    const n = vnoise(x / 6, z / 6, 9), onPath = d <= 0 && trails.some(r => x > r.x0 - .5 && x < r.x1 + .5 && z > r.z0 - .5 && z < r.z1 + .5);
    c.copy(onPath ? C.pa : C.gr).multiplyScalar(.85 + .3 * n);
    if (d > 0) { c.lerp(C.hi, smooth(0, 5, d)); c.lerp(C.to, smooth(.4, 1, h / V.hillH)); const sl = Math.abs((H[Math.min(nx * nz - 1, k + 1)] - H[Math.max(0, k - 1)]) / (2 * g)) + Math.abs((H[Math.min(nx * nz - 1, k + nx)] - H[Math.max(0, k - nx)]) / (2 * g)); c.lerp(C.ro, smooth(.55, 1.1, sl)); c.multiplyScalar(.9 + .2 * n); }
    col.set([c.r, c.g, c.b], k * 3); }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6); let t = 0;
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, cc = a + nx, dd = cc + 1; idx.set([a, cc, b, b, cc, dd], t); t += 6; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeVertexNormals();
  const land = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })); land.position.y = -.02; land.receiveShadow = true; group.add(land);     // чуть ниже нуля: пятна ловушек и тени — поверх
  // лес и камни: образцы и места
  const S = { tree: samples((L, r, lk) => addTree(L, r, 0, 0, lk), 6, look, 11), bush: samples((L, r, lk) => addBush(L, r, 0, 0, 1, lk), 4, look, 21), rock: samples((L, r, lk) => addRock(L, r, 0, 0, lk), 4, look, 31) };
  const put = { tree: [], bush: [], rock: [] }, rnd = mulberry(Math.round(B.x0 * 31 + B.z1 * 17) | 0);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i, d = D[k]; if (d < 1.5) continue;
    const x = x0 + i * g + (rnd() - .5) * g, z = z0 + j * g + (rnd() - .5) * g, near = CS[k] > .3 && d < V.camSide * 1.5;     // ближний к камере склон: только кусты и камни
    const fade = d < V.band ? 1 : Math.max(0, 1 - (d - V.band) / (V.band * 1.5)) * .35, a = g * g * fade;
    if (!near && rnd() < V.trees * a) put.tree.push([x, z, .8 + rnd() * .5]);
    else if (rnd() < V.bushes * a * (near ? 3 : 1)) put.bush.push([x, z, .8 + rnd() * 1.2]);
    else if (rnd() < V.rocks * a * (near ? 2 : 1)) put.rock.push([x, z, .7 + rnd() * 1.4]); }
  for (const q of M.props || []) if (q.t === 'w_tree') put.tree.push([q.x, q.z, q.s]); else if (q.t === 'w_rock') put.rock.push([q.x, q.z, q.s]);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true }), M4 = new THREE.Matrix4(), Q4 = new THREE.Quaternion(), P4 = new THREE.Vector3(), S4 = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), ch = V.chunk;
  let count = 0;
  for (const [kind, list] of Object.entries(put)) { const by = new Map();     // куски: (вид образца, клетка ch × ch)
    list.forEach((q, n) => { const v = n % S[kind].length, key = v + ':' + Math.floor(q[0] / ch) + ',' + Math.floor(q[1] / ch); if (!by.has(key)) by.set(key, []); by.get(key).push(q); });
    for (const [key, qs] of by) { const im = new THREE.InstancedMesh(S[kind][+key.split(':')[0]], mat, qs.length);
      qs.forEach((q, n) => { Q4.setFromAxisAngle(UP, (q[0] * 12.9898 + q[1] * 78.233) % 6.283); P4.set(q[0], hAt(q[0], q[1]) - .05, q[1]); S4.setScalar(q[2]); M4.compose(P4, Q4, S4); im.setMatrixAt(n, M4); });
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); group.add(im); count += qs.length; } }
  // трава на полянах
  { const gg = new THREE.BufferGeometry(), v = [], cl = [], dark = new THREE.Color(look.leaf[0]), tip = new THREE.Color(look.leaf[2]).multiplyScalar(1.4);
    for (let b = 0; b < 3; b++) { const a = b * Math.PI / 3, cs = Math.cos(a), sn = Math.sin(a); v.push(-.12 * cs, 0, -.12 * sn, .12 * cs, 0, .12 * sn, (b - 1) * .08 * sn, .55 + b * .1, (b - 1) * .08 * cs); cl.push(dark.r, dark.g, dark.b, dark.r, dark.g, dark.b, tip.r, tip.g, tip.b); }
    gg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); gg.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); gg.computeVertexNormals();
    const halls = walk.filter(r => !r.corridor && !r.secret), area = halls.reduce((a, r) => a + (r.x1 - r.x0) * (r.z1 - r.z0), 0), im = new THREE.InstancedMesh(gg, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), V.grass);
    let n = 0; for (const r of halls) { const k = Math.round(V.grass * (r.x1 - r.x0) * (r.z1 - r.z0) / area); for (let i = 0; i < k && n < V.grass; i++) { const x = r.x0 + rnd() * (r.x1 - r.x0), z = r.z0 + rnd() * (r.z1 - r.z0); if (wildDist([r], x, z) > 0) continue; Q4.setFromAxisAngle(UP, rnd() * 6.283); P4.set(x, 0, z); S4.setScalar(.7 + rnd() * .8); M4.compose(P4, Q4, S4); im.setMatrixAt(n++, M4); } }
    im.count = n; im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); group.add(im); }
  group.userData.stats = { verts: nx * nz, things: count };
  return group;
}
