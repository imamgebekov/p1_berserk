// Автоскелет для двуногих моделей без скелета (Meshy, 2026-11-03, задача владельца «скелеты для врагов»): по размерам сетки строим кости
// (таз, спина, голова, бёдра, голени, плечи, предплечья), веса вершин — по расстоянию до костей, клипы (стоит, шаг, бег, удар, попадание)
// пишем кодом. Модель дальше играет как обычная со скелетом (actors3d: те же клипы и смешивание). Только вид.
import * as THREE from 'three';

const SEG = (p, a, b) => { const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby + (p[2] - a[2]) * abz) / (abx * abx + aby * aby + abz * abz || 1))); return Math.hypot(p[0] - a[0] - abx * t, p[1] - a[1] - aby * t, p[2] - a[2] - abz * t); };
const pct = (arr, q) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * q))]; };

// кости: [имя, родитель, точка сустава (мир, м)]; сегменты веса: [кость, от, до, радиус]
export function riggedParts(P, N, o = {}) {
  let y0 = Infinity, y1 = -Infinity; for (let i = 1; i < P.length; i += 3) { y0 = Math.min(y0, P[i]); y1 = Math.max(y1, P[i]); }
  const H = y1 - y0, F = { hip: .5, knee: .27, ankle: .05, sh: .78, elb: .62, wr: .46, neck: .84, ...o }, Y = f => y0 + H * f;
  const sl = (a, b) => { const xs = [], zs = []; for (let i = 0; i < P.length; i += 3) if (P[i + 1] >= Y(a) && P[i + 1] <= Y(b)) { xs.push(P[i]); zs.push(P[i + 2]); } return { xs, zs }; };
  const mid = sl(F.hip, F.sh), cx = (pct(mid.xs, .05) + pct(mid.xs, .95)) / 2, cz = (pct(mid.zs, .05) + pct(mid.zs, .95)) / 2, half = (pct(mid.xs, .95) - pct(mid.xs, .05)) / 2;
  const lg = sl(.12, F.knee + .08), lx = s => { const v = lg.xs.filter(x => (x - cx) * s > 0); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : cx + s * half * .35; };
  const ar = sl(F.wr, F.sh), ax = s => { const v = ar.xs.filter(x => (x - cx) * s > half * .5); return v.length > 20 ? pct(v.map(x => Math.abs(x - cx)), .6) * s + cx : cx + s * half * .9; };
  const J = {};     // суставы (мир)
  J.hip = [cx, Y(F.hip), cz]; J.spine = [cx, Y(F.sh - .08), cz]; J.neck = [cx, Y(F.neck), cz]; J.top = [cx, y1, cz];
  for (const [n, s] of [['L', 1], ['R', -1]]) {
    const X = lx(s), A = ax(s); J['hipj' + n] = [X, Y(F.hip - .02), cz]; J['knee' + n] = [X, Y(F.knee), cz]; J['ank' + n] = [X, Y(F.ankle), cz]; J['toe' + n] = [X, y0, cz];
    J['sh' + n] = [cx + (A - cx) * .75, Y(F.sh), cz]; J['elb' + n] = [A, Y(F.elb), cz]; J['wr' + n] = [A, Y(F.wr), cz]; J['hand' + n] = [A, Y(F.wr - .1), cz];
  }
  const bones = [['rg_root', null, [0, 0, 0]], ['rg_hips', 'rg_root', J.hip], ['rg_spine', 'rg_hips', J.spine], ['rg_head', 'rg_spine', J.neck]];
  for (const n of ['L', 'R']) bones.push(['rg_thigh' + n, 'rg_hips', J['hipj' + n]], ['rg_shin' + n, 'rg_thigh' + n, J['knee' + n]], ['rg_arm' + n, 'rg_spine', J['sh' + n]], ['rg_fore' + n, 'rg_arm' + n, J['elb' + n]], ['rg_hand' + n, 'rg_fore' + n, J['hand' + n]]);     // кисть — только точка для оружия, вершин не ведёт
  const R = half * .55, seg = [['rg_hips', [cx, Y(F.hip - .06), cz], J.hip, R], ['rg_spine', J.hip, J.spine, R], ['rg_head', J.neck, J.top, half * .35]];
  for (const n of ['L', 'R']) seg.push(['rg_thigh' + n, J['hipj' + n], J['knee' + n], half * .1], ['rg_shin' + n, J['knee' + n], J['toe' + n], half * .08], ['rg_arm' + n, J['sh' + n], J['elb' + n], half * .08, [cx, half * .55]], ['rg_fore' + n, J['elb' + n], J['hand' + n], half * .08, [cx, half * .55]]);     // у рук — ещё и отступ от оси тела: плащ и живот руку за собой не тянут
  return { bones, seg, H, y0, cx, cz, half };
}
// четвероногие (2026-11-03): тело вытянуто по z (лицом +z); кости — таз, спина, голова, хвост из двух частей, четыре ноги из двух частей
export function quadParts(P, o = {}) {
  let y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity, x0 = Infinity, x1 = -Infinity; for (let i = 0; i < P.length; i += 3) { x0 = Math.min(x0, P[i]); x1 = Math.max(x1, P[i]); y0 = Math.min(y0, P[i + 1]); y1 = Math.max(y1, P[i + 1]); z0 = Math.min(z0, P[i + 2]); z1 = Math.max(z1, P[i + 2]); }
  const H = y1 - y0, L = z1 - z0, cx = (x0 + x1) / 2, F = { body: .5, knee: .22, ...o }, Y = f => y0 + H * f, Zf = f => z0 + L * f, side = (x1 - x0) * .28;
  const J = { hip: [cx, Y(F.body), Zf(.3)], chest: [cx, Y(F.body + .05), Zf(.68)], neck: [cx, Y(F.body + .12), Zf(.82)], nose: [cx, Y(F.body + .08), z1], tail1: [cx, Y(F.body), Zf(.15)], tail2: [cx, Y(F.body - .1), z0] };
  const bones = [['rg_root', null, [0, 0, 0]], ['rg_hips', 'rg_root', J.hip], ['rg_spine', 'rg_hips', J.chest], ['rg_head', 'rg_spine', J.neck], ['rg_tail1', 'rg_hips', J.tail1], ['rg_tail2', 'rg_tail1', J.tail2]];
  const seg = [['rg_hips', [cx, Y(F.body), Zf(.2)], J.hip, side * 1.2], ['rg_spine', J.hip, J.chest, side * 1.3], ['rg_head', J.neck, J.nose, side * .8], ['rg_tail1', J.hip, J.tail1, side * .4], ['rg_tail2', J.tail1, J.tail2, side * .3]];
  for (const [n, sx] of [['L', 1], ['R', -1]]) for (const [m, zf] of [['F', .72], ['B', .26]]) {
    const top = [cx + sx * side, Y(F.body - .02), Zf(zf)], knee = [cx + sx * side, Y(F.knee), Zf(zf)], foot = [cx + sx * side, y0, Zf(zf)];
    bones.push(['rg_up' + m + n, m === 'F' ? 'rg_spine' : 'rg_hips', top], ['rg_dn' + m + n, 'rg_up' + m + n, knee]); seg.push(['rg_up' + m + n, top, knee, side * .45], ['rg_dn' + m + n, knee, foot, side * .35]);
  }
  return { bones, seg, H, y0 };
}

const bbox = P => { const B = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity }; for (let i = 0; i < P.length; i += 3) { B.x0 = Math.min(B.x0, P[i]); B.x1 = Math.max(B.x1, P[i]); B.y0 = Math.min(B.y0, P[i + 1]); B.y1 = Math.max(B.y1, P[i + 1]); B.z0 = Math.min(B.z0, P[i + 2]); B.z1 = Math.max(B.z1, P[i + 2]); } return B; };
// пауки (2026-11-05): восемь ног по кругу из двух костей, тело — таз и спина; направление ноги d лежит в плоскости xz
export function spiderParts(P, o = {}) {
  const B = bbox(P), H = B.y1 - B.y0, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, R = Math.max(B.x1 - B.x0, B.z1 - B.z0) / 2, F = { body: .42, knee: .6, ...o }, Y = f => B.y0 + H * f, by = Y(F.body);
  const bones = [['rg_root', null, [0, 0, 0]], ['rg_hips', 'rg_root', [cx, by, cz]], ['rg_spine', 'rg_hips', [cx, by + H * .08, cz]]], legs = [];
  const seg = [['rg_hips', [cx, by, cz], [cx, by, cz], R * .32], ['rg_spine', [cx, by + H * .08, cz], [cx, Y(.8), cz], R * .3]];
  for (let k = 0; k < 8; k++) { const th = (k + .5) * Math.PI / 4, d = [Math.sin(th), Math.cos(th)], top = [cx + d[0] * R * .22, by, cz + d[1] * R * .22], knee = [cx + d[0] * R * .62, Y(F.knee), cz + d[1] * R * .62], foot = [cx + d[0] * R, B.y0, cz + d[1] * R];
    bones.push(['rg_up' + k, 'rg_hips', top], ['rg_dn' + k, 'rg_up' + k, knee]); seg.push(['rg_up' + k, top, knee, R * .08], ['rg_dn' + k, knee, foot, R * .07]); legs.push({ k, d }); }
  return { bones, seg, H, y0: B.y0, legs };
}
// дракон (2026-11-05): стоит на месте (ноги и камень не качаем), крылья из двух костей, шея и голова, хвост; тело — таз и спина
export function dragonParts(P, o = {}) {
  const B = bbox(P), H = B.y1 - B.y0, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, W = (B.x1 - B.x0) / 2, F = { wing: .62, ...o }, Y = f => B.y0 + H * f;
  const bones = [['rg_root', null, [0, 0, 0]], ['rg_hips', 'rg_root', [cx, Y(.4), cz]], ['rg_spine', 'rg_hips', [cx, Y(.55), cz]], ['rg_head', 'rg_spine', [cx, Y(.78), cz]]];
  const seg = [['rg_hips', [cx, Y(.2), cz], [cx, Y(.4), cz], W * .5], ['rg_spine', [cx, Y(.4), cz], [cx, Y(.7), cz], W * .3], ['rg_head', [cx, Y(.78), cz], [cx, B.y1, cz], W * .15]];
  for (const [n, s] of [['L', 1], ['R', -1]]) { const sh = [cx + s * W * .22, Y(F.wing), cz], mid = [cx + s * W * .6, Y(F.wing + .12), cz], tip = [cx + s * W * 1, Y(F.wing + .2), cz];
    bones.push(['rg_wing' + n, 'rg_spine', sh], ['rg_wtip' + n, 'rg_wing' + n, mid]); seg.push(['rg_wing' + n, sh, mid, W * .12, [cx, W * .3]], ['rg_wtip' + n, mid, tip, W * .15, [cx, W * .3]]); }
  return { bones, seg, H, y0: B.y0 };
}
// веса вершин: до 3 ближайших костей, вес ~ 1 / (расстояние² + e²)²; внутри радиуса сегмента расстояние нулевое
export function skinWeights(P, seg, H) {
  const n = P.length / 3, idx = new Uint16Array(n * 4), wt = new Float32Array(n * 4), names = [...new Set(seg.map(s => s[0]))], e2 = (H * .02) ** 2;
  for (let v = 0; v < n; v++) {
    const p = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]], best = new Map();
    for (const [nm, a, b, r, lat] of seg) { const d = Math.max(0, SEG(p, a, b) - r) + (lat ? Math.max(0, lat[1] - Math.abs(p[0] - lat[0])) * 1.5 : 0), w = 1 / ((d * d + e2) ** 2); best.set(nm, Math.max(best.get(nm) || 0, w)); }
    const top = [...best].sort((a, b) => b[1] - a[1]).slice(0, 3), sum = top.reduce((s, t) => s + t[1], 0);
    top.forEach(([nm, w], k) => { idx[v * 4 + k] = names.indexOf(nm); wt[v * 4 + k] = w / sum; });
  }
  return { idx, wt, names };
}
const E = (x = 0, y = 0, z = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
// клип по функции позы: pose(f, out) пишет в out[имя кости] = [x, y, z] (радианы), f — доля цикла 0..1; bob — подскок таза (доля роста)
function clip(name, dur, N, pose, bones, hipY, H, bob = 0) {
  const times = [], vals = {}, pos = []; for (const b of bones) vals[b[0]] = [];
  for (let k = 0; k <= N; k++) { const f = k / N, o = {}; pose(f, o); times.push(f * dur);
    for (const b of bones) { const a = o[b[0]] || [0, 0, 0], q = a.isQuaternion ? a : E(a[0], a[1], a[2]); vals[b[0]].push(q.x, q.y, q.z, q.w); }
    pos.push(0, bob ? Math.abs(Math.sin(f * Math.PI * 2)) * bob * H : 0, 0); }
  const tr = bones.map(b => new THREE.QuaternionKeyframeTrack(b[0] + '.quaternion', times, vals[b[0]]));
  return { tr, pos, times };
}
const S = Math.sin, PI2 = Math.PI * 2;
function clipsFor(bones, H, hipPos) {
  const out = [], mk = (name, dur, N, pose, bob) => { const c = clip(name, dur, N, pose, bones, hipPos[1], H, bob), base = hipPos;
    const tr = [...c.tr]; if (bob) tr.push(new THREE.VectorKeyframeTrack('rg_hips.position', c.times, c.pos.map((v, i) => base[i % 3] + v))); out.push(new THREE.AnimationClip(name, dur, tr)); };
  const walk = (A, B, arm) => f => { const p = f * PI2, o = {}; return { thighL: -A * S(p), thighR: A * S(p), shinL: B * Math.max(0, S(p + 1.2)), shinR: B * Math.max(0, -S(p - 1.9)), armL: arm * S(p), armR: -arm * S(p) }; };
  const gait = (A, B, arm, twist, lean) => (f, o) => { const g = walk(A, B, arm)(f), p = f * PI2;
    o.rg_thighL = [g.thighL, 0, 0]; o.rg_thighR = [g.thighR, 0, 0]; o.rg_shinL = [g.shinL, 0, 0]; o.rg_shinR = [g.shinR, 0, 0];
    o.rg_armL = [g.armL, 0, .06]; o.rg_armR = [g.armR, 0, -.06]; o.rg_foreL = [-.35 - Math.abs(g.armL) * .4, 0, 0]; o.rg_foreR = [-.35 - Math.abs(g.armR) * .4, 0, 0];
    o.rg_spine = [lean, twist * S(p), 0]; o.rg_head = [-lean * .6, -twist * S(p) * .8, 0]; o.rg_hips = [0, -twist * S(p) * .6, 0]; };
  mk('Idle', 2.4, 12, (f, o) => { const p = f * PI2; o.rg_spine = [.03 * S(p), .02 * S(p), 0]; o.rg_head = [-.02 * S(p), .03 * S(p + 1), 0]; o.rg_armL = [.06 * S(p), 0, .08]; o.rg_armR = [.06 * S(p + .5), 0, -.08]; o.rg_foreL = [-.25, 0, 0]; o.rg_foreR = [-.25, 0, 0]; });
  mk('Walk', .9, 16, gait(.5, .7, .45, .1, .04), .018);
  mk('Run', .55, 16, gait(.85, 1.1, .8, .16, .14), .03);
  // удар: замах (0–.45) рука вверх-назад, корпус назад; удар (.45–.65) рука вниз-вперёд, корпус вперёд; возврат
  mk('Attack1', .9, 18, (f, o) => { const w = Math.min(1, f / .45), s = f < .45 ? 0 : Math.min(1, (f - .45) / .2), b = f < .65 ? 0 : (f - .65) / .35, k = (1 - b);
    const arm = (-1.8 * w + 1.4 * s) * k, sp = (-.3 * w + .6 * s) * k;     // x > 0 — вперёд у верхней части тела (спина, голова), назад у ног и рук (рука вперёд — минус)
    o.rg_armR = [arm, -.3 * w * k, -.1]; o.rg_foreR = [-.5 * w * k - .3, 0, 0]; o.rg_armL = [arm * .55, .3 * w * k, .1]; o.rg_foreL = [-.5 * w * k - .3, 0, 0];
    o.rg_spine = [sp, (.2 * w - .35 * s) * k, 0]; o.rg_head = [-sp * .5, 0, 0]; o.rg_thighL = [-.35 * s * k, 0, 0]; o.rg_thighR = [.2 * w * k, 0, 0]; o.rg_shinR = [.3 * w * k, 0, 0]; });
  mk('Hit_A', .5, 10, (f, o) => { const k = S(Math.min(1, f * 1.4) * Math.PI), q = k * (1 - f * .3); o.rg_spine = [-.5 * q, .12 * q, 0]; o.rg_head = [-.35 * q, 0, 0]; o.rg_armL = [.5 * q, 0, .3 * q]; o.rg_armR = [.5 * q, 0, -.3 * q]; o.rg_thighL = [-.2 * q, 0, 0]; });
  return out;
}
function quadClips(bones, H, hipPos) {
  const out = [], mk = (name, dur, N, pose, bob) => { const c = clip(name, dur, N, pose, bones, hipPos[1], H, bob), tr = [...c.tr]; if (bob) tr.push(new THREE.VectorKeyframeTrack('rg_hips.position', c.times, c.pos.map((v, i) => hipPos[i % 3] + v))); out.push(new THREE.AnimationClip(name, dur, tr)); };
  const gait = (A, B, wag) => (f, o) => { const p = f * PI2;     // шаг по диагонали: левая передняя с правой задней
    for (const [m, ph] of [['FL', 0], ['BR', 0], ['FR', Math.PI], ['BL', Math.PI]]) { const s = S(p + ph); o['rg_up' + m[0] + m[1]] = [-A * s, 0, 0]; o['rg_dn' + m[0] + m[1]] = [B * Math.max(0, S(p + ph + 1.2)), 0, 0]; }
    o.rg_spine = [.03 * S(p * 2), wag * .5 * S(p), 0]; o.rg_head = [-.04 * S(p * 2), -wag * S(p), 0]; o.rg_tail1 = [0, wag * 2 * S(p), 0]; o.rg_tail2 = [0, wag * 2.5 * S(p + 1), 0]; };
  mk('Idle', 2.4, 12, (f, o) => { const p = f * PI2; o.rg_spine = [.02 * S(p), 0, 0]; o.rg_head = [.04 * S(p + 1), .05 * S(p), 0]; o.rg_tail1 = [0, .15 * S(p), 0]; o.rg_tail2 = [0, .2 * S(p + 1), 0]; });
  mk('Walk', .8, 16, gait(.5, .6, .1), .012); mk('Run', .45, 16, gait(.85, 1, .12), .03);
  mk('Attack1', .8, 16, (f, o) => { const w = Math.min(1, f / .4), s = f < .4 ? 0 : Math.min(1, (f - .4) / .15), b = f < .55 ? 0 : (f - .55) / .45, k = 1 - b;     // замах назад и вниз, выпад вперёд с головой
    o.rg_spine = [(-.25 * w + .45 * s) * k, 0, 0]; o.rg_head = [(-.3 * w + .7 * s) * k, 0, 0]; o.rg_upFL = [(.4 * w - .7 * s) * k, 0, 0]; o.rg_upFR = [(.4 * w - .7 * s) * k, 0, 0]; o.rg_tail1 = [-.3 * s * k, 0, 0]; });
  mk('Hit_A', .5, 10, (f, o) => { const q = S(Math.min(1, f * 1.4) * Math.PI) * (1 - f * .3); o.rg_spine = [-.35 * q, .1 * q, 0]; o.rg_head = [-.4 * q, .2 * q, 0]; o.rg_tail1 = [0, .4 * q, 0]; });
  return out;
}

function spiderClips(bones, H, hipPos, legs) {
  const out = [], mk = (name, dur, N, pose, bob) => { const c = clip(name, dur, N, pose, bones, hipPos[1], H, bob), tr = [...c.tr]; if (bob) tr.push(new THREE.VectorKeyframeTrack('rg_hips.position', c.times, c.pos.map((v, i) => hipPos[i % 3] + v))); out.push(new THREE.AnimationClip(name, dur, tr)); };
  const Y = new THREE.Vector3(0, 1, 0), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion();
  const leg = (o, l, sweep, lift) => { const t = new THREE.Vector3(-l.d[1], 0, l.d[0]); o['rg_up' + l.k] = q1.clone().setFromAxisAngle(Y, sweep).multiply(q2.clone().setFromAxisAngle(t, lift)); o['rg_dn' + l.k] = new THREE.Quaternion().setFromAxisAngle(t, -lift * .6); };
  const gait = (A, L) => (f, o) => { const p = f * PI2; for (const l of legs) { const ph = (l.k % 2) * Math.PI, s = S(p + ph); leg(o, l, A * s * (l.d[1] >= 0 ? 1 : -1), L * Math.max(0, S(p + ph + 1.57))); } o.rg_spine = [.02 * S(p * 2), 0, .03 * S(p)]; };
  mk('Idle', 2.4, 12, (f, o) => { const p = f * PI2; for (const l of legs) leg(o, l, .03 * S(p + l.k), .05 * S(p * 2 + l.k)); o.rg_spine = [.03 * S(p), 0, 0]; });
  mk('Walk', .7, 16, gait(.35, .5), .012); mk('Run', .4, 16, gait(.5, .7), .02);
  mk('Attack1', .85, 17, (f, o) => { const w = Math.min(1, f / .4), s = f < .4 ? 0 : Math.min(1, (f - .4) / .15), b = f < .55 ? 0 : (f - .55) / .45, k = 1 - b;     // передние ноги вверх, корпус назад, затем бросок вперёд
    for (const l of legs) { const fr = l.d[1] > .4 ? 1 : 0; leg(o, l, 0, fr * (1.1 * w - .6 * s) * k); } o.rg_spine = [(-.35 * w + .6 * s) * k, 0, 0]; });
  mk('Hit_A', .5, 10, (f, o) => { const q = S(Math.min(1, f * 1.4) * Math.PI) * (1 - f * .3); for (const l of legs) leg(o, l, 0, .5 * q); o.rg_spine = [-.4 * q, 0, .15 * q]; });
  return out;
}
function dragonClips(bones, H, hipPos) {
  const out = [], mk = (name, dur, N, pose, bob) => { const c = clip(name, dur, N, pose, bones, hipPos[1], H, bob), tr = [...c.tr]; if (bob) tr.push(new THREE.VectorKeyframeTrack('rg_hips.position', c.times, c.pos.map((v, i) => hipPos[i % 3] + v))); out.push(new THREE.AnimationClip(name, dur, tr)); };
  const wings = (A, f, o, ph = 0) => { const p = f * PI2 + ph; o.rg_wingL = [0, 0, A * S(p)]; o.rg_wingR = [0, 0, -A * S(p)]; o.rg_wtipL = [0, 0, A * .8 * S(p - .9)]; o.rg_wtipR = [0, 0, -A * .8 * S(p - .9)]; };     // взмах: крылья вокруг оси z (вверх-вниз), кончик с запаздыванием
  mk('Idle', 3, 15, (f, o) => { const p = f * PI2; wings(.14, f, o); o.rg_spine = [.025 * S(p), 0, 0]; o.rg_head = [-.04 * S(p + 1), .05 * S(p), 0]; });
  mk('Walk', 1.1, 16, (f, o) => { const p = f * PI2; wings(.3, f, o); o.rg_spine = [.03 * S(p), .04 * S(p), 0]; o.rg_head = [0, -.06 * S(p), 0]; }, .015);
  mk('Run', .7, 16, (f, o) => { wings(.5, f, o); o.rg_spine = [.1, 0, 0]; o.rg_head = [-.08, 0, 0]; }, .025);
  mk('Attack1', 1, 20, (f, o) => { const w = Math.min(1, f / .4), s = f < .4 ? 0 : Math.min(1, (f - .4) / .15), b = f < .55 ? 0 : (f - .55) / .45, k = 1 - b;     // замах: крылья вверх, голова назад; бросок головой вперёд
    o.rg_wingL = [0, 0, (.8 * w - .5 * s) * k]; o.rg_wingR = [0, 0, -(.8 * w - .5 * s) * k]; o.rg_wtipL = [0, 0, .4 * w * k]; o.rg_wtipR = [0, 0, -.4 * w * k]; o.rg_spine = [(-.2 * w + .35 * s) * k, 0, 0]; o.rg_head = [(-.3 * w + .6 * s) * k, 0, 0]; });
  mk('Hit_A', .5, 10, (f, o) => { const q = S(Math.min(1, f * 1.4) * Math.PI) * (1 - f * .3); o.rg_spine = [-.3 * q, 0, 0]; o.rg_head = [-.4 * q, .2 * q, 0]; wings(.5, f, o, 0); });
  return out;
}
// собрать скелет на сцене (одна обычная сетка) → { clips }; сетка заменяется на SkinnedMesh. kit.rig — поправки долей роста
export function autoRig(scene, over = {}, type = 'biped') {
  let mesh = null; scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; }); if (!mesh) return null;
  const geo = mesh.geometry, P = geo.attributes.position.array, parts = type === 'quad' ? quadParts(P, over) : type === 'spider' ? spiderParts(P, over) : type === 'dragon' ? dragonParts(P, over) : riggedParts(P, null, over), { bones, seg, H, y0 } = parts, W = skinWeights(P, seg, H), parent = mesh.parent;
  const bm = new Map(), list = [];
  for (const [nm, par, pt] of bones) { const b = new THREE.Bone(); b.name = nm; const pp = par ? bones.find(x => x[0] === par)[2] : [0, 0, 0]; b.position.set(pt[0] - pp[0], pt[1] - pp[1], pt[2] - pp[2]); bm.set(nm, b); list.push(b); if (par) bm.get(par).add(b); }
  const nameOrder = W.names, remap = list.map(b => b.name), order = new Map(remap.map((n, i) => [n, i]));
  const idx = new Uint16Array(W.idx.length); for (let i = 0; i < idx.length; i++) idx[i] = order.get(nameOrder[W.idx[i]]);     // индексы — по порядку костей скелета
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(W.wt, 4));
  const sm = new THREE.SkinnedMesh(geo, mesh.material); sm.name = mesh.name; sm.castShadow = true; sm.frustumCulled = false; sm.matrix.copy(mesh.matrix); sm.matrix.decompose(sm.position, sm.quaternion, sm.scale);
  parent.add(sm, bm.get('rg_root')); parent.remove(mesh); parent.updateMatrixWorld(true);
  sm.bind(new THREE.Skeleton(list));
  return { clips: type === 'quad' ? quadClips(bones, H, bones[1][2]) : type === 'spider' ? spiderClips(bones, H, bones[1][2], parts.legs) : type === 'dragon' ? dragonClips(bones, H, bones[1][2]) : clipsFor(bones, H, bones[1][2]), height: H, y0 };
}
