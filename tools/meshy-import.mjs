// Модели Meshy → игра (2026-10-29): враги — в 3d/models/mf_<имя>.glb как есть; оружие и щиты — развёрнуты в общий вид и лежат в 3d/models/mw/.
// Оружие: длинная ось — +y, рукоять внизу (y = 0), конец — y = 1, головка (лезвие топора) — к −x, как у KayKit. Луки и арбалеты — длинная ось по z,
// щиты — лицом к +z. Каждой вещи-оружию — своя модель (по порядку каталога); моделей вида не хватает — повтор с другим цветом (решение владельца 28.10).
// Пишет 3d/src/data/meshyw.js: вещь → [файл, цвет повтора]. Запуск: node tools/meshy-import.mjs [папка meshy_pick]
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOG } from '../3d/src/data/items.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'), SRC = process.argv[2] || join(process.env.HOME, 'p1_berserk_models/_packs/meshy_pick');
const PK = join(SRC, 'packed'), OUTM = join(root, '3d/models'), OUTW = join(OUTM, 'mw');
const SKIP = new Set(['1259_sword', '1291_sword', '1679_scythe', '1684_scythe', '1701_scythe', '1465_mace']);     // чужие бренды (DOWNLOADED.md) и копия 512
const CAT = { 'Мечи': ['sword'], 'Двуручные мечи': ['greatsword'], 'Рапиры': ['rapier'], 'Кинжалы и ножи': ['dagger', 'knife'], 'Топоры': ['axe'], 'Боевые топоры': ['war_axe'], 'Алебарды': ['halberd'],
  'Копья и трезубцы': ['spear'], 'Косы': ['scythe'], 'Серпы': ['sickle'], 'Булавы': ['mace'], 'Дубины': ['club'], 'Молоты': ['hammer'], 'Кирки': ['pick'], 'Кистени': ['flail', 'chain_ball'],
  'Луки': ['longbow', 'bow'], 'Арбалеты': ['crossbow'], 'Посохи': ['staff'], 'Жезлы и скипетры': ['wand'], 'Щиты': ['shield'] };
const FIRST = { 425: 'Мечи', 429: 'Мечи', 441: 'Боевые топоры', 444: 'Топоры', 448: 'Топоры', 459: 'Щиты', 461: 'Щиты', 463: 'Щиты', 464: 'Щиты', 466: 'Щиты', 472: 'Щиты',
  474: 'Молоты', 479: 'Молоты', 485: 'Молоты', 502: 'Молоты', 481: 'Булавы', 512: 'Булавы', 482: 'Дубины' };     // первый выбор (оружие 425–512) — по описанию в LIST.md
const FOES = { '8_gatewarden': 'gatewarden', '12_feeder': 'feeder', '22_ash_thief': 'ash_thief', '39_devourer': 'devourer', '115_firegolem': 'golem', '172_demon_guard': 'demon_guard',
  '174_voidwarden': 'voidwarden', '175_chief': 'chief', '177_hand_lord': 'hand_lord', '230_hagmother': 'hagmother', '274_leviathan': 'leviathan', '278_tidewyrm': 'tidewyrm', '292_troll': 'troll',
  '295_saltwarden': 'saltwarden', '310_borot': 'borot', '312_gneis': 'gneis', '327_brute': 'brute', '331_sapper': 'sapper', '384_riftheart': 'riftheart', '399_hand_net': 'hand_net', '400_swarm': 'swarm',
  '487_armorer': 'armorer', '522_cinderpriest': 'cinderpriest' };
const TINT = { rust: '#c89070', iron: '#c8c8c8', tempered: '#e8e0d0', bone: '#f0e6cc', steel: '#b8c8e0', black: '#707084', blood: '#d07070', crimson: '#e06070', unique: '#f0d8a0', gold: '#f8d870' };
const BLADE = new Set(['sword', 'greatsword', 'rapier', 'dagger', 'knife']);     // у клинков рукоять — у самой широкой части (гарда), у прочих — напротив головки

// --- GLB: одна сетка, POSITION/NORMAL/TEXCOORD_0 (как пишет meshy-pack.mjs)
function readGlb(f) {
  const raw = readFileSync(f), jl = raw.readUInt32LE(12), g = JSON.parse(raw.subarray(20, 20 + jl).toString()), bin = Buffer.from(raw.subarray(20 + jl + 8));
  const view = (i, C) => { const a = g.accessors[i], v = g.bufferViews[a.bufferView]; return new C(bin.buffer, bin.byteOffset + (v.byteOffset || 0) + (a.byteOffset || 0), a.count * ({ VEC3: 3, VEC2: 2, SCALAR: 1 })[a.type]); };
  const pr = g.meshes[0].primitives[0], I = g.accessors[pr.indices].componentType === 5125 ? Uint32Array : Uint16Array;
  return { g, bin, pr, P: view(pr.attributes.POSITION, Float32Array), N: view(pr.attributes.NORMAL, Float32Array), I: view(pr.indices, I) };
}
function writeGlb(f, { g, bin, pr, P }) {
  const a = g.accessors[pr.attributes.POSITION], mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i++) { mn[i % 3] = Math.min(mn[i % 3], P[i]); mx[i % 3] = Math.max(mx[i % 3], P[i]); } a.min = mn; a.max = mx;
  let js = Buffer.from(JSON.stringify(g)); js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  const c = (n, t) => { const b = Buffer.alloc(8); b.writeUInt32LE(n, 0); b.writeUInt32LE(t, 4); return b; };
  writeFileSync(f, Buffer.concat([head, c(js.length, 0x4e4f534a), js, c(bin.length, 0x004e4942), bin]));
}
// --- главные оси по площади треугольников (сетка неравномерная: мелкая гарда не должна перетягивать)
function axes({ P, I }) {
  const C = [0, 0, 0], M = [0, 0, 0, 0, 0, 0, 0, 0, 0]; let S = 0; const tri = [];
  for (let t = 0; t < I.length; t += 3) { const [a, b, c] = [I[t], I[t + 1], I[t + 2]].map(i => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], w = Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2 + 1e-12;
    const m = [0, 1, 2].map(k => (a[k] + b[k] + c[k]) / 3); tri.push([m, w]); S += w; for (let k = 0; k < 3; k++) C[k] += m[k] * w; }
  for (let k = 0; k < 3; k++) C[k] /= S;
  for (const [m, w] of tri) for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) M[r * 3 + q] += (m[r] - C[r]) * (m[q] - C[q]) * w;
  const V = [1, 0, 0, 0, 1, 0, 0, 0, 1], A = M.map(x => x / S);     // Якоби для 3×3
  for (let it = 0; it < 50; it++) { let p = 0, q = 1; for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) if (Math.abs(A[i * 3 + j]) > Math.abs(A[p * 3 + q])) { p = i; q = j; }
    if (Math.abs(A[p * 3 + q]) < 1e-14) break;
    const th = .5 * Math.atan2(2 * A[p * 3 + q], A[q * 3 + q] - A[p * 3 + p]), c = Math.cos(th), s = Math.sin(th);
    for (let k = 0; k < 3; k++) { const akp = A[k * 3 + p], akq = A[k * 3 + q]; A[k * 3 + p] = c * akp - s * akq; A[k * 3 + q] = s * akp + c * akq; }
    for (let k = 0; k < 3; k++) { const apk = A[p * 3 + k], aqk = A[q * 3 + k]; A[p * 3 + k] = c * apk - s * aqk; A[q * 3 + k] = s * apk + c * aqk; }
    for (let k = 0; k < 3; k++) { const vkp = V[k * 3 + p], vkq = V[k * 3 + q]; V[k * 3 + p] = c * vkp - s * vkq; V[k * 3 + q] = s * vkp + c * vkq; } }
  return { C, E: [0, 1, 2].map(i => ({ l: A[i * 4], v: [V[i], V[3 + i], V[6 + i]] })).sort((a, b) => b.l - a.l).map(e => e.v) };
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// повернуть в базис X, Y, Z (строки), сдвинуть на o, умножить на k
function apply(m, X, Y, Z, C) {
  const { P, N } = m, q = new Float32Array(P.length);
  for (let i = 0; i < P.length; i += 3) { const p = [P[i] - C[0], P[i + 1] - C[1], P[i + 2] - C[2]], n = [N[i], N[i + 1], N[i + 2]];
    q[i] = dot(p, X); q[i + 1] = dot(p, Y); q[i + 2] = dot(p, Z); N[i] = dot(n, X); N[i + 1] = dot(n, Y); N[i + 2] = dot(n, Z); }
  P.set(q);
}
const flip = (m, ax) => { for (let i = 0; i < m.P.length; i += 3) for (const a of ax) { m.P[i + a] = -m.P[i + a]; m.N[i + a] = -m.N[i + a]; } };     // два оси разом — поворот, не зеркало
function ext(P, a) { let lo = Infinity, hi = -Infinity; for (let i = a; i < P.length; i += 3) { lo = Math.min(lo, P[i]); hi = Math.max(hi, P[i]); } return [lo, hi]; }
const mean = (P, a, pick) => { let s = 0, n = 0; for (let i = 0; i < P.length; i += 3) if (pick(i)) { s += P[i + a]; n++; } return n ? s / n : 0; };
function place(m, d) { for (let i = 0; i < m.P.length; i += 3) for (let a = 0; a < 3; a++) m.P[i + a] = (m.P[i + a] - d[a]) * d[3]; }

function normLong(m, kind) {     // рукоять внизу, длина 1
  const { C, E } = axes(m), Y = E[0], X = E[1], Z = cross(X, Y); apply(m, X, Y, Z, C);
  const [lo, hi] = ext(m.P, 1), B = 20, w = Array.from({ length: B }, () => [Infinity, -Infinity]);
  for (let i = 0; i < m.P.length; i += 3) { const b = Math.min(B - 1, Math.floor((m.P[i + 1] - lo) / (hi - lo) * B)); w[b][0] = Math.min(w[b][0], m.P[i]); w[b][1] = Math.max(w[b][1], m.P[i]); }
  let wi = 0; for (let b = 1; b < B; b++) if (w[b][1] - w[b][0] > w[wi][1] - w[wi][0]) wi = b;
  const low = wi < B / 2; if (BLADE.has(kind) ? !low : low) flip(m, [0, 1]);
  const [l2, h2] = ext(m.P, 1), L = h2 - l2, grip = i => m.P[i + 1] < l2 + L * .12, head = i => m.P[i + 1] > h2 - L * .35;
  const gx = mean(m.P, 0, grip), gz = mean(m.P, 2, grip); if (!BLADE.has(kind) && mean(m.P, 0, head) - gx > 0) flip(m, [0, 2]);     // головка — к −x
  const gx2 = mean(m.P, 0, grip), gz2 = mean(m.P, 2, grip); void gz; place(m, [gx2, l2, gz2, 1 / L]);
  return { L };
}
function peakAtEnd(P, C, S, O) {     // вдоль оси S самая широкая (по оси O) часть — у края? У арбалета так лежит ложе: дуга на конце
  let lo = Infinity, hi = -Infinity; for (let i = 0; i < P.length; i += 3) { const v = (P[i] - C[0]) * S[0] + (P[i + 1] - C[1]) * S[1] + (P[i + 2] - C[2]) * S[2]; lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const B = 10, w = Array.from({ length: B }, () => [Infinity, -Infinity]);
  for (let i = 0; i < P.length; i += 3) { const d = [P[i] - C[0], P[i + 1] - C[1], P[i + 2] - C[2]], b = Math.min(B - 1, Math.floor((dot(d, S) - lo) / (hi - lo) * B)), o = dot(d, O); w[b][0] = Math.min(w[b][0], o); w[b][1] = Math.max(w[b][1], o); }
  let wi = 0; for (let b = 1; b < B; b++) if (w[b][1] - w[b][0] > w[wi][1] - w[wi][0]) wi = b; return Math.min(wi, B - 1 - wi);
}
function normBow(m, cross_) {     // лук: плечи по z, рукоять (середина) на +x от концов; арбалет: ложе по z, дуга (широкий конец) — к +z
  const { C, E } = axes(m); let [Z, X] = [E[0], E[1]];
  if (cross_ && peakAtEnd(m.P, C, E[1], E[0]) < peakAtEnd(m.P, C, E[0], E[1])) [Z, X] = [E[1], E[0]];     // дуга шире ложа — ложе по второй оси
  const Y = cross(Z, X); apply(m, X, Y, Z, C);
  const [lo, hi] = ext(m.P, 2), L = hi - lo;
  if (!cross_) { const mid = i => Math.abs(m.P[i + 2] - (lo + hi) / 2) < L * .1, tip = i => Math.abs(m.P[i + 2] - (lo + hi) / 2) > L * .4;
    if (mean(m.P, 0, mid) < mean(m.P, 0, tip)) flip(m, [0, 1]);
    place(m, [mean(m.P, 0, mid), mean(m.P, 1, mid), (lo + hi) / 2, 1 / L]); return { L }; }
  const B = 10, w = Array.from({ length: B }, () => [Infinity, -Infinity]);
  for (let i = 0; i < m.P.length; i += 3) { const b = Math.min(B - 1, Math.floor((m.P[i + 2] - lo) / L * B)); w[b][0] = Math.min(w[b][0], m.P[i]); w[b][1] = Math.max(w[b][1], m.P[i]); }
  let wi = 0; for (let b = 1; b < B; b++) if (w[b][1] - w[b][0] > w[wi][1] - w[wi][0]) wi = b;
  if (wi < B / 2) flip(m, [0, 2]);
  const [l2] = ext(m.P, 2), rear = i => m.P[i + 2] < l2 + L * .3;
  place(m, [mean(m.P, 0, rear), mean(m.P, 1, rear), l2, 1 / L]); return { L };
}
function normShield(m) {     // лицом (выпуклой стороной) к +z, высота — по y, размер по большей стороне 1
  const { C, E } = axes(m), Y = E[0], Z = E[2], X = cross(Y, Z); apply(m, X, Y, Z, C);
  const [x0, x1] = ext(m.P, 0), [y0, y1] = ext(m.P, 1), R = Math.max(x1 - x0, y1 - y0) / 2, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, r = i => Math.hypot(m.P[i] - cx, m.P[i + 1] - cy) / R;
  if (mean(m.P, 2, i => r(i) < .3) < mean(m.P, 2, i => r(i) > .8)) flip(m, [0, 2]);
  const [z0, z1] = ext(m.P, 2); place(m, [cx, cy, (z0 + z1) / 2, 1 / (2 * R)]);
  return { tall: (y1 - y0) / (x1 - x0) > 1.3 };
}

// --- список: файл → категория
const rows = [];
for (const l of readFileSync(join(SRC, 'LIST.md'), 'utf8').split('\n')) {
  const c = l.split('|').map(x => x.trim()), f = c.find(x => /^`.+\.glb`$/.test(x)); if (!f) continue;
  const key = f.slice(1, -5), n = parseInt(key), cat = FIRST[n] || c.find(x => CAT[x]); rows.push({ key, n, cat });
}
const have = new Set(readdirSync(PK).map(f => f.replace(/\.glb$/, '')));
const pool = {}; for (const r of rows) if (r.cat && have.has(r.key) && !SKIP.has(r.key)) (pool[r.cat] = pool[r.cat] || []).push(r.key);
for (const k in pool) pool[k].sort((a, b) => (FIRST[parseInt(a)] ? 0 : 1) - (FIRST[parseInt(b)] ? 0 : 1) || parseInt(a) - parseInt(b));

rmSync(OUTW, { recursive: true, force: true }); mkdirSync(OUTW, { recursive: true });
const MW = {}, info = {}, used = new Set();
const shields = [];
for (const r of pool['Щиты'] || []) { const m = readGlb(join(PK, r + '.glb')), s = normShield(m); writeGlb(join(OUTW, r + '.glb'), m); used.add(r); shields.push({ key: r, tall: s.tall }); }
for (const [cat, kinds] of Object.entries(CAT)) {
  if (cat === 'Щиты') continue;
  const list = pool[cat] || []; let at = 0;
  for (const kind of kinds) {
    const items = CATALOG.filter(i => i.cat === 'weapon' && i.kind === kind);
    for (const it of items) { const j = at++, key = list[j % list.length]; if (!key) continue; MW[it.id] = j < list.length ? [key] : [key, TINT[it.mat] || '#d0c0a0']; info[key] = info[key] || kind; }
  }
  for (const key of new Set(list.filter(k => info[k]))) { const kind = info[key], m = readGlb(join(PK, key + '.glb'));
    if (kind === 'longbow' || kind === 'bow') normBow(m, false); else if (kind === 'crossbow') normBow(m, true); else normLong(m, kind);
    writeGlb(join(OUTW, key + '.glb'), m); used.add(key); }
}
{ const items = CATALOG.filter(i => i.kind === 'shield'), tall = shields.filter(s => s.tall), flat = shields.filter(s => !s.tall);
  let a = 0, b = 0; for (const it of items) { const L = it.form === 'tower' && tall.length ? tall : flat.length ? flat : tall, j = it.form === 'tower' && tall.length ? a++ : b++, s = L[j % L.length];
    if (s) MW[it.id] = j < L.length ? [s.key] : [s.key, TINT[it.mat] || '#d0c0a0']; } }

for (const [k, name] of Object.entries(FOES)) if (have.has(k)) copyFileSync(join(PK, k + '.glb'), join(OUTM, 'mf_' + name + '.glb'));
const kinds = {}; for (const id in MW) { const it = CATALOG.find(i => i.id === id), k = it.kind === 'shield' ? 'shield:' + it.form : it.kind; kinds[k] = kinds[k] || [0, 0]; kinds[k][MW[id][1] ? 1 : 0]++; }
writeFileSync(join(root, '3d/src/data/meshyw.js'), `// Вещь-оружие → модель Meshy (3d/models/mw/<файл>.glb) и цвет повтора. Создаётся tools/meshy-import.mjs, руками не править.\nexport const MW = ${JSON.stringify(MW)};\n`);
console.log('моделей оружия:', used.size, '| вещей с моделью:', Object.keys(MW).length, '| врагов:', Object.keys(FOES).filter(k => have.has(k)).length);
console.log('вид: [своя, повтор]', JSON.stringify(kinds));
const none = CATALOG.filter(i => (i.cat === 'weapon' || i.kind === 'shield') && !MW[i.id]).map(i => i.id); console.log('без модели:', none.length, none.slice(0, 20).join(' '));
