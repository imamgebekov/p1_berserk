// Вид уровней: подземелье (пол, низкие стены, лестница наверх, факелы) и люки на поверхности. Только графика.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildContainers } from './containers.js';
import { roomAt, GATE } from './map.js';
import { paintMat, paintOn } from './paint3d.js';
import { buildDecor, decorModel } from './decor.js';
import { themeOf, glowParts } from './dungeontheme3d.js';
import { dungeonDetails } from './details3d.js';

const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const mat = (c, kind, opt) => (kind ? paintMat(new THREE.MeshLambertMaterial({ color: c }), kind, opt) : new THREE.MeshLambertMaterial({ color: c }));     // kind — материал (T3)

// лестница наверх: ступени поднимаются к ближней стене своей комнаты
function stairs(q, B) {
  const g = new THREE.Group(), toX = Math.abs(q.x - B.x0) < Math.abs(q.x - B.x1) ? -1 : 1;
  const parts = []; for (let i = 0; i < 4; i++) parts.push(box(.45, .18 * (i + 1), 1.6, toX * (i * .45 - .2), .09 * (i + 1), 0));
  g.add(new THREE.Mesh(mergeGeometries(parts), mat('#5a5048', 'masonry')));
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ color: '#d8b070', transparent: true, opacity: .22, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2; glow.position.set(0, .04, 0); g.add(glow);
  g.position.set(q.x, 0, q.z); return g;
}

// люк в земле: рама и две створки
export function makeHatch(q) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(mergeGeometries([box(1.7, .12, .14, 0, .06, -.78), box(1.7, .12, .14, 0, .06, .78), box(.14, .12, 1.7, -.78, .06, 0), box(.14, .12, 1.7, .78, .06, 0)]), mat('#2a2018', 'auto')));
  g.add(new THREE.Mesh(mergeGeometries([box(.7, .08, 1.42, -.36, .05, 0), box(.7, .08, 1.42, .36, .05, 0)]), mat('#5a3f28', 'auto', { plank: .2 })));
  g.add(new THREE.Mesh(mergeGeometries([box(.06, .1, .3, -.06, .12, 0), box(.06, .1, .3, .06, .12, 0)]), mat('#8a8070', 'metal')));
  g.position.set(q.x, 0, q.z); return g;
}

// ворота подземелья и рейда (4.18в): каменный вход с тёмным проёмом и ступенями вниз; руны — синие (подземелье) или зелёные (рейд), у рейда — жаровни
export function makeGate(q, y0 = 0) {
  const g = new THREE.Group(), raid = q.gate === 'raid', rune = raid ? '#4adf7a' : '#4a9aff', st = mat(raid ? '#5a5650' : '#6a6460', 'masonry'), dark = new THREE.MeshBasicMaterial({ color: '#050403' });
  g.add(new THREE.Mesh(mergeGeometries([box(5.2, 1.2, 4.6, 0, -.45, -.7), box(4.6, 3.6, 1.4, 0, 1.8, -1.8), box(.7, 3.3, 1.8, -1.95, 1.65, -.2), box(.7, 3.3, 1.8, 1.95, 1.65, -.2), box(4.9, .7, 1.2, 0, 3.55, -.1), box(3.4, .5, .9, 0, 4.1, -.5)]), st));
  g.add(new THREE.Mesh(mergeGeometries([box(2.8, 2.6, .1, 0, 1.3, -1.05), box(2.8, .04, 1.3, 0, .17, -.45)]), dark));     // проём и спуск
  g.add(new THREE.Mesh(mergeGeometries([0, 1, 2].map(i => box(2.6, .14, .4, 0, .12 - i * .05, .45 - i * .35))), mat('#4a4440', 'masonry')));     // ступени вниз
  g.add(new THREE.Mesh(mergeGeometries([box(2, .22, .06, 0, 3.55, .52), box(.22, .22, .06, -1.95, 2.6, .72), box(.22, .22, .06, 1.95, 2.6, .72)]), new THREE.MeshBasicMaterial({ color: rune })));     // руны
  if (raid) for (const sx of [-1, 1]) { g.add(new THREE.Mesh(box(.35, 1.1, .35, sx * 3, .55, 1.1), mat('#3a3430', 'metal'))); g.add(new THREE.Mesh(new THREE.SphereGeometry(.32, 10, 8).translate(sx * 3, 1.3, 1.1), new THREE.MeshBasicMaterial({ color: rune }))); }     // жаровни рейда
  const [fx, fz] = q.face || [0, 1]; g.rotation.y = Math.atan2(fx, fz); g.scale.setScalar(GATE[q.gate] || 1); g.position.set(q.x, y0, q.z); return g;
}

// лестница в доме на второй этаж (2026-10-21): обычные ступени вдоль стены от подножия к верху, сбоку — тетива
export function makeStairs(q, y0 = 0) {
  const S = q.st, r = S.rect, n = 12, g = new THREE.Group(), steps = [], side = [];
  const alongX = !!S.up[0], L = alongX ? r.x1 - r.x0 : r.z1 - r.z0, W2 = alongX ? r.z1 - r.z0 : r.x1 - r.x0, dir = alongX ? S.up[0] : S.up[1], c0 = alongX ? (dir > 0 ? r.x0 : r.x1) : (dir > 0 ? r.z0 : r.z1);
  for (let i = 0; i < n; i++) { const h = S.h * (i + 1) / n, a = c0 + dir * (i + .5) * L / n;
    steps.push(alongX ? box(L / n + .02, h, W2, a, h / 2, (r.z0 + r.z1) / 2) : box(W2, h, L / n + .02, (r.x0 + r.x1) / 2, h / 2, a)); }
  const mid = c0 + dir * L / 2, open = alongX ? r.z1 : r.x1;     // тетива — с открытой стороны (не у стены)
  side.push(alongX ? box(L, .12, .08, mid, S.h / 2 + .45, open - .04) : box(.08, .12, L, open - .04, S.h / 2 + .45, mid));
  for (let i = 0; i <= 3; i++) { const a = c0 + dir * (i / 3) * L, hh = S.h * (i / 3) + .9; side.push(alongX ? box(.08, hh, .08, a, hh / 2, open - .04) : box(.08, hh, .08, open - .04, hh / 2, a)); }
  g.add(new THREE.Mesh(mergeGeometries(steps), mat('#7a5636', 'auto', { plank: .25 })));
  const rail = new THREE.Mesh(mergeGeometries(side), mat('#4a3020', 'auto')); g.add(rail);
  g.position.y = y0; return g;
}
// второй этаж: доски, низкие стены (срез, как у первого этажа изнутри — видна улица), проём лестницы с перилами и ступенями вниз,
// кровать и стол; снизу — толщина перекрытия. Рисуется над своим домом (render.js сдвигает группу на высоту этажа)
function buildFloorView(L, cfg) {
  const M = L.map, D = cfg.dungeons, group = new THREE.Group(), H = (cfg.map.floors && cfg.map.floors.wallH) || .9, S = M.stair, r = S.rect;
  const fl = [], seams = [];
  for (const q of M.rooms) { const w = q.x1 - q.x0, d = q.z1 - q.z0, cx = (q.x0 + q.x1) / 2, cz = (q.z0 + q.z1) / 2;
    fl.push(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(cx, 0, cz));
    for (let x = q.x0 + .55; x < q.x1; x += .55) seams.push(box(.03, .01, d, x, .004, cz)); }
  group.add(new THREE.Mesh(mergeGeometries(fl), mat('#6e4c30', 'auto', { plank: .3 })));
  if (seams.length && !paintOn()) group.add(new THREE.Mesh(mergeGeometries(seams), mat('#3a2818')));
  const solid = M.blocks.filter(w => !w.pit);
  group.add(new THREE.Mesh(mergeGeometries(solid.map(w => box(w.x1 - w.x0, H, w.z1 - w.z0, (w.x0 + w.x1) / 2, H / 2, (w.z0 + w.z1) / 2))), mat('#5a3e26', 'auto', { plank: .2 })));
  group.add(new THREE.Mesh(mergeGeometries(solid.map(w => box(w.x1 - w.x0, .04, w.z1 - w.z0, (w.x0 + w.x1) / 2, H + .02, (w.z0 + w.z1) / 2))), new THREE.MeshBasicMaterial({ color: '#1a120c' })));
  { const B0 = M.bounds; group.add(new THREE.Mesh(box(B0.x1 - B0.x0 + D.wall * 2, .25, B0.z1 - B0.z0 + D.wall * 2, (B0.x0 + B0.x1) / 2, -.14, (B0.z0 + B0.z1) / 2), mat('#3a2818', 'auto', { plank: .2 }))); }     // перекрытие: толщина пола этажа
  const B = M.bounds;
  // проём лестницы: тёмная дыра, верхние ступени уходят вниз, перила с открытых сторон
  const alongX = !!S.up[0], dir = alongX ? S.up[0] : S.up[1], cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2, Lr = alongX ? r.x1 - r.x0 : r.z1 - r.z0, top = alongX ? (dir > 0 ? r.x1 : r.x0) : (dir > 0 ? r.z1 : r.z0);
  group.add(new THREE.Mesh(box(r.x1 - r.x0, .02, r.z1 - r.z0, cx, .005, cz), new THREE.MeshBasicMaterial({ color: '#080504' })));
  const st = []; for (let i = 1; i <= 4; i++) { const a = top - dir * (i - .5) * Lr / 12, y = -.22 * i; st.push(alongX ? box(Lr / 12, .06, r.z1 - r.z0 - .1, a, y + .03, cz) : box(r.x1 - r.x0 - .1, .06, Lr / 12, cx, y + .03, a)); }
  group.add(new THREE.Mesh(mergeGeometries(st), mat('#7a5636', 'auto', { plank: .25 })));
  const rail = [], post = (x, z) => rail.push(box(.08, .95, .08, x, .475, z));
  if (alongX) { const zo = r.z1 + .04; rail.push(box(Lr, .07, .07, cx, .95, zo)); for (let i = 0; i <= 3; i++) post(r.x0 + i / 3 * Lr, zo); const xe = dir > 0 ? r.x0 - .04 : r.x1 + .04; rail.push(box(.07, .07, r.z1 - r.z0, xe, .95, cz)); post(xe, r.z0 + .05); }
  else { const xo = r.x1 + .04; rail.push(box(.07, .07, Lr, xo, .95, cz)); for (let i = 0; i <= 3; i++) post(xo, r.z0 + i / 3 * Lr); const ze = dir > 0 ? r.z0 - .04 : r.z1 + .04; rail.push(box(r.x1 - r.x0, .07, .07, cx, .95, ze)); post(r.x0 + .05, ze); }
  group.add(new THREE.Mesh(mergeGeometries(rail), mat('#4a3020', 'auto')));
  // кровать у стены напротив лестницы и стол посередине
  { const far = alongX ? (r.z0 - B.z0 < B.z1 - r.z1 ? B.z1 : B.z0) : (r.x0 - B.x0 < B.x1 - r.x1 ? B.x1 : B.x0), fur = [], blank = [];
    if (alongX) { const z = far + (far > cz ? -1 : 1) * 1.05, x = (B.x0 + B.x1) / 2 + (B.x1 - B.x0) * .22; fur.push(box(1.9, .35, 1.0, x, .2, z)); blank.push(box(1.3, .12, .96, x + .25, .42, z)); fur.push(box(.12, .8, 1.0, x - .95, .4, z)); }
    else { const x = far + (far > cx ? -1 : 1) * 1.05, z = (B.z0 + B.z1) / 2 + (B.z1 - B.z0) * .22; fur.push(box(1.0, .35, 1.9, x, .2, z)); blank.push(box(.96, .12, 1.3, x, .42, z + .25)); fur.push(box(1.0, .8, .12, x, .4, z - .95)); }
    const tx = (B.x0 + B.x1) / 2 - (alongX ? (B.x1 - B.x0) * .12 : 0), tz = (B.z0 + B.z1) / 2 + (alongX ? 0 : -(B.z1 - B.z0) * .12);
    fur.push(box(1.2, .08, .8, tx, .75, tz), box(.08, .72, .08, tx - .5, .36, tz - .32), box(.08, .72, .08, tx + .5, .36, tz - .32), box(.08, .72, .08, tx - .5, .36, tz + .32), box(.08, .72, .08, tx + .5, .36, tz + .32));
    group.add(new THREE.Mesh(mergeGeometries(fur), mat('#5e4028', 'auto', { plank: .2 }))); group.add(new THREE.Mesh(mergeGeometries(blank), mat('#8a3a2a', 'cloth'))); }
  { const B2 = M.bounds, l1 = new THREE.PointLight('#ffcf8a', 1.2, Math.max(B2.x1 - B2.x0, B2.z1 - B2.z0) * 1.2, 1.5); l1.position.set((B2.x0 + B2.x1) / 2, 2, (B2.z0 + B2.z1) / 2); group.add(l1); }     // тёплый свет лампы (ночью видно)
  const conts = buildContainers(M); group.add(conts.group);
  return { group, conts, flame: null, update: null };
}
export function buildLevelView(L, cfg) {
  if (L.map.floor) return buildFloorView(L, cfg);
  const M = L.map, D = cfg.dungeons, group = new THREE.Group(), th = themeOf(cfg, L.def) || {};     // 4.14: стиль подземелья
  // пол: по прямоугольнику на комнату, с лёгкой «плиткой» из полос
  const floor = [], seams = [];
  const rings = [];     // круглые залы: швы кольцами и мозаика в центре
  for (const r of M.rooms) {
    const w = r.x1 - r.x0, d = r.z1 - r.z0, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    floor.push(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(cx, 0, cz));
    if (r.shape === 'round') { for (let k = 1.6; k < Math.min(w, d) / 2 - .3; k += 1.6) rings.push(new THREE.RingGeometry(k - .03, k + .03, 48).rotateX(-Math.PI / 2).scale(w / Math.min(w, d), 1, d / Math.min(w, d)).translate(cx, .006, cz)); rings.push(new THREE.CircleGeometry(1.2, 32).rotateX(-Math.PI / 2).translate(cx, .004, cz)); continue; }
    for (let x = r.x0 + 1.5; x < r.x1; x += 1.5) seams.push(box(.05, .01, d, x, .005, cz));
    for (let z = r.z0 + 1.5; z < r.z1; z += 1.5) seams.push(box(w, .01, .05, cx, .005, z));
  }
  group.add(new THREE.Mesh(mergeGeometries(floor), mat(th.floor || '#2c2622', 'masonry')));
  if (seams.length && !paintOn()) group.add(new THREE.Mesh(mergeGeometries(seams), mat('#1a1614')));     // с материалами плиты рисует шейдер
  if (rings.length) group.add(new THREE.Mesh(mergeGeometries(rings), mat('#3a3029', 'masonry')));
  // стены одним мешем; сверху тёмный «срез», чтобы читалась толщина. Провалы — не стены; у круглых залов поверх заливки — гладкая линия стены
  const solid = M.blocks.filter(w => !w.pit), arc = (a, h, y) => { const L = Math.hypot(a.x1 - a.x0, a.z1 - a.z0), mx = (a.x0 + a.x1) / 2, mz = (a.z0 + a.z1) / 2, n = Math.hypot(mx - a.cx, mz - a.cz) || 1, t = D.wall; return new THREE.BoxGeometry(L + .06, h, t).rotateY(-Math.atan2(a.z1 - a.z0, a.x1 - a.x0)).translate(mx + (mx - a.cx) / n * t / 2, y, mz + (mz - a.cz) / n * t / 2); };
  const walls = solid.map(w => box(w.x1 - w.x0, D.wallH, w.z1 - w.z0, (w.x0 + w.x1) / 2, D.wallH / 2, (w.z0 + w.z1) / 2)).concat((M.arcs || []).map(a => arc(a, D.wallH, D.wallH / 2)));
  group.add(new THREE.Mesh(mergeGeometries(walls), mat(th.wall || '#4a4038', 'masonry')));
  const caps = solid.map(w => box(w.x1 - w.x0, .04, w.z1 - w.z0, (w.x0 + w.x1) / 2, D.wallH + .02, (w.z0 + w.z1) / 2)).concat((M.arcs || []).map(a => arc(a, .04, D.wallH + .03)));
  group.add(new THREE.Mesh(mergeGeometries(caps), new THREE.MeshBasicMaterial({ color: th.cap || '#141010' })));
  // провалы: чёрная пустота с каменной кромкой и багровым отсветом из глубины
  if ((M.pits || []).length) {
    const hole = [], rim = [], glow = [];
    for (const q of M.pits) {
      const w = q.x1 - q.x0, d = q.z1 - q.z0, cx = (q.x0 + q.x1) / 2, cz = (q.z0 + q.z1) / 2;
      hole.push(box(w, .02, d, cx, .01, cz)); glow.push(new THREE.PlaneGeometry(Math.max(.2, w - 1.2), Math.max(.2, d - 1.2)).rotateX(-Math.PI / 2).translate(cx, .025, cz));
      rim.push(box(w + .3, .1, .15, cx, .05, q.z0 - .075), box(w + .3, .1, .15, cx, .05, q.z1 + .075), box(.15, .1, d, q.x0 - .075, .05, cz), box(.15, .1, d, q.x1 + .075, .05, cz));
    }
    group.add(new THREE.Mesh(mergeGeometries(hole), new THREE.MeshBasicMaterial({ color: '#040303' })));
    group.add(new THREE.Mesh(mergeGeometries(glow), new THREE.MeshBasicMaterial({ color: '#7a1c0a', transparent: true, opacity: .22, depthWrite: false })));
    group.add(new THREE.Mesh(mergeGeometries(rim), mat('#5a5048', 'masonry')));
  }
  // 4.10: модели KayKit Dungeon, если загружены (факелы, колонны, знамёна); иначе — прежние коробки
  const kit = [], putKit = (name, x, y, z, rot, sx, sy = sx, sz = sx) => { const S = decorModel(name); if (!S) return false; const g = S.clone(); g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)), new THREE.Vector3(sx, sy, sz))); kit.push(g); return true; };
  // колонны: база, ствол, капитель
  if ((M.pillars || []).length) {
    const col = [];
    for (const c of M.pillars) if (!putKit('pillar', c.x, 0, c.z, 0, c.r * 1.6, .78, c.r * 1.6)) col.push(box(c.r * 2.4, .25, c.r * 2.4, c.x, .125, c.z), new THREE.CylinderGeometry(c.r * .85, c.r, 2.6, 10).translate(c.x, 1.55, c.z), box(c.r * 2.2, .22, c.r * 2.2, c.x, 2.95, c.z));
    if (col.length) group.add(new THREE.Mesh(mergeGeometries(col.map(g => g.index ? g.toNonIndexed() : g)), mat('#6a6058', 'masonry')));
  }
  // факелы на сплошных стенах комнат (не в проходах и не на ближней к камере стене; без источников света — свет даёт фонарь героя)
  const torches = [], flames = [], open = (x, z) => M.links.some(l => (l.vert ? Math.abs(x - l.line) < .2 && z > l.s0 - .6 && z < l.s1 + .6 : Math.abs(z - l.line) < .2 && x > l.s0 - .6 && x < l.s1 + .6));
  for (const r of M.rooms) if (!r.corridor) for (const [x, z, ex, ez] of [[r.x0, (r.z0 + r.z1) / 2, .12, 0], [r.x1, (r.z0 + r.z1) / 2, -.12, 0], [(r.x0 + r.x1) / 2, r.z0, 0, .12]]) {
    if (open(x, z)) continue;
    if (!putKit('torch_mounted', x + ex * .6, D.wallH * .55 - .25, z + ez * .6, ex > 0 ? Math.PI / 2 : ex < 0 ? -Math.PI / 2 : 0, .6)) torches.push(box(.1, .5, .1, x + ex, D.wallH * .55, z + ez));
    flames.push(box(.16, .2, .16, x + ex, D.wallH * .55 + .32, z + ez));
  }
  for (let i = 0; i < M.rooms.length; i++) { const r = M.rooms[i]; if (r.corridor || r.x1 - r.x0 < 7 || i % 2) continue;     // знамёна на дальней стене каждого второго зала
    for (const [k, name] of [[.25, 'banner_patternA_red'], [.75, 'banner_shield_red']]) { const x = r.x0 + k * (r.x1 - r.x0), S = decorModel(name); if (!S || open(x, r.z0)) continue; const s = D.wallH * .85 / S.userData.h; putKit(name, x, D.wallH * .1, r.z0 + .08 + S.userData.d * s / 2, 0, s); } }
  if (kit.length) group.add(new THREE.Mesh(mergeGeometries(kit), paintMat(new THREE.MeshLambertMaterial({ vertexColors: true }), 'auto')));
  if (torches.length) group.add(new THREE.Mesh(mergeGeometries(torches), mat('#3a2a1a')));
  { const salt = [...String(M.level || '')].reduce((h, ch) => Math.imul(h, 31) + ch.charCodeAt(0) | 0, 7), det = dungeonDetails(M, cfg, salt); if (M.fire) det.push({ t: 'campfire', x: M.fire.x, z: M.fire.z, fire: true });     // детали подземелья (T5); костёр перед финальным боссом (план подземелий, 1е)
    if (det.length) group.add(buildDecor({ decor: det }, null, null).group); }
  const fl = flames.length ? new THREE.Mesh(mergeGeometries(flames), new THREE.MeshBasicMaterial({ color: th.flame || '#ffb050' })) : null; if (fl) group.add(fl);
  { const gp = glowParts(M, th, open); if (gp) group.add(new THREE.Mesh(mergeGeometries(gp), new THREE.MeshBasicMaterial({ color: th.glow.color, fog: false, toneMapped: false }))); }     // 4.14: кристаллы, грибы, лава — светятся сквозь туман
  for (const q of M.portals) { const ri = roomAt(M, q.x, q.z); group.add(stairs(q, ri >= 0 ? M.rooms[ri] : M.bounds)); }
  // двери: створка на петле у края проёма, открывается внутрь дальней комнаты
  const doorMat = mat('#5a3f28', 'auto', { plank: .25 }), bandMat = mat('#2a2018', 'metal'), doors = [];
  for (const d of M.doors) {
    const hinge = new THREE.Group(), w = d.w, th = D.wall * .5;
    hinge.add(new THREE.Mesh(new THREE.BoxGeometry(w, D.wallH * .95, th).translate(w / 2, D.wallH * .475, 0), doorMat));
    hinge.add(new THREE.Mesh(mergeGeometries([box(w, .08, th + .04, w / 2, D.wallH * .25, 0), box(w, .08, th + .04, w / 2, D.wallH * .7, 0)]), bandMat));
    if (d.vert) { hinge.position.set(d.line, 0, d.s0); hinge.rotation.y = -Math.PI / 2; } else hinge.position.set(d.s0, 0, d.line);
    // замок на запертой двери: золотая коробка с дужкой посередине створки (с обеих сторон)
    let lock = null;
    if (d.lock) { lock = new THREE.Group(); const gold = new THREE.MeshBasicMaterial({ color: '#d8a838' }); lock.add(new THREE.Mesh(new THREE.BoxGeometry(.3, .32, th + .3), gold), new THREE.Mesh(new THREE.BoxGeometry(.06, .2, th + .34), new THREE.MeshBasicMaterial({ color: '#2a1a08' })).translateY(-.02)); lock.position.set(w / 2, D.wallH * .5, 0); hinge.add(lock); }
    group.add(hinge); doors.push({ d, hinge, base: hinge.rotation.y, lock });
  }
  function update() { for (const it of doors) { it.hinge.rotation.y = it.base + it.d.open * Math.PI / 2; if (it.lock) it.lock.visible = !!it.d.locked; } }
  const conts = buildContainers(M); group.add(conts.group);
  return { group, conts, flame: fl, update };
}

// поверхность: контейнеры по карте мира и люки
export function buildSurfaceView(L, Y) {
  const group = new THREE.Group(), conts = buildContainers(L.map, Y), stairs = []; group.add(conts.group);
  for (const q of L.map.portals) { const m = q.stair ? makeStairs(q, Y ? Y((q.st.rect.x0 + q.st.rect.x1) / 2, (q.st.rect.z0 + q.st.rect.z1) / 2) : 0) : q.gate ? makeGate(q, Y ? Y(q.x, q.z) : 0) : makeHatch(q); if (q.stair) { m.userData.house = q.house; m.visible = false; stairs.push(m); } group.add(m); }     // лестница на второй этаж — ступени в доме
  return { group, conts, flame: null, stairs };
}
