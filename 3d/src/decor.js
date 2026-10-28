// Уличный декор: дороги, фонари, заборы, кладбище, ферма, рынок, руины, лагерь. Всё сливается в два меша (обычный и «светящийся»).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pushBox, addTree } from './models.js';
import { paintMat, tagKind } from './paint3d.js';

// вид деталей (T3): серое у построек из камня — кладкой; шатры — тканью; клетка и жаровня — металлом
const PART_OF = { armor_lie: 'metal', armor_pole: 'metal', armor_pile: 'metal', armor_rack: 'metal', w_lie: 'metal', w_stuck: 'metal', swsh: 'metal', swsh_broken: 'metal', cwall: 'masonry', ctower: 'masonry', cgate: 'masonry', tower: 'masonry', fort: 'masonry', wallfrag: 'masonry', ruinwall: 'masonry', mausoleum: 'masonry', shrine: 'masonry', well: 'masonry', paving: 'masonry', mill: 'masonry', tent: 'cloth', bigtent: 'cloth', cage: 'metal', brazier: 'metal', lamp: 'metal' };

// готовые постройки KayKit (2026-10-20, выбор владельца): геометрии с цветом в вершинах (buildings.glb); пока нет — свои кубики
let BLD = null;
const SIGN_ICON = { smithy: ['sword_shield', .26], shop: ['coin_stack_small', .4], tavern: ['bottle_A_labeled_brown', .45], warehouse: ['box_small', .3] };     // модель и масштаб значка
export function setDecorLib(lib) { BLD = lib; }
export const decorModel = name => (BLD && BLD[name]) || null;     // 4.10: модели KayKit для подземелий (levelview.js)
const TM = new THREE.Matrix4(), TQ = new THREE.Quaternion(), TE = new THREE.Euler(), TP = new THREE.Vector3(), TS = new THREE.Vector3();
// модель name: центр в (x, z), поворот rot, масштаб по осям модели; dim — тёмнее/светлее
function putModel(L, name, x, z, rot, sx, sy, sz, dim = 1, y = 0) {
  const src = BLD && BLD[name]; if (!src) return false;
  const g = src.clone(); TE.set(0, rot, 0); TQ.setFromEuler(TE); TP.set(x, y, z); TS.set(sx, sy, sz); TM.compose(TP, TQ, TS); g.applyMatrix4(TM);
  if (dim !== 1) { const c = g.attributes.color; for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * dim, c.getY(i) * dim, c.getZ(i) * dim); }
  L.push(g); return true;
}
// модель с наклоном (2026-10-28): лёжа или воткнутой в землю; поворот — сначала наклон (ex, ez), потом по сторонам (ey); center — середину модели в точку
function putRot(L, name, x, y, z, ex, ey, ez, sc, center = false, dim = 1) {
  const src = BLD && BLD[name]; if (!src) return false;
  const g = src.clone(); if (center) g.translate(0, -src.userData.h / 2, 0); TE.set(ex, ey, ez, 'YXZ'); TQ.setFromEuler(TE); TP.set(x, y, z); TS.set(sc, sc, sc); TM.compose(TP, TQ, TS); g.applyMatrix4(TM);
  if (dim !== 1) { const c = g.attributes.color; for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * dim, c.getY(i) * dim, c.getZ(i) * dim); }
  L.push(g); return true;
}
const WEAPONS = ['sword_1handed', 'sword_2handed', 'axe_1handed', 'axe_2handed', 'rpg_spear', 'rpg_halberd', 'rpg_hammer', 'dagger', 'Skeleton_Blade', 'Skeleton_Axe'], SHIELDS = ['shield_round', 'shield_square', 'shield_badge', 'Skeleton_Shield_Small_A'];
const fit = (name, h) => (BLD && BLD[name] ? h / BLD[name].userData.h : 1);     // масштаб модели под высоту h, м
// замена своего декора: true — заменили. Ряды (стены, частокол, ограды) — отрезками модели вдоль длинной стороны
function swapDecor(d, L, rnd) {
  if (!rnd) { const h = Math.abs(Math.sin(d.x * 12.9898 + d.z * 78.233) * 43758.5453) % 1; rnd = () => h; }     // 4.10: в подземельях декор строится без генератора — выбор по месту
  const s = d.s || 1, r = d.rot || 0;
  // ряд отрезков длиной около seg м вдоль длинной стороны; h — масштаб высоты, depth — масштаб толщины; длинная ось модели — x или z
  const tile = (name, len, seg, h, alongX, depth) => { const M = BLD[name]; if (!M) return false; const mx = M.userData.w >= M.userData.d, Ls = mx ? M.userData.w : M.userData.d, n = Math.max(1, Math.round(len / seg)), k = len / n;
    for (let i = 0; i < n; i++) { const o = -len / 2 + k * (i + .5), rot = mx === alongX ? 0 : Math.PI / 2, sl = k / Ls; putModel(L, name, d.x + (alongX ? o : 0), d.z + (alongX ? 0 : o), rot, mx ? sl : depth, h, mx ? depth : sl, .85); } return true; };
  switch (d.t) {
    case 'tomb': return putModel(L, rnd() < .5 ? 'gravestone' : 'grave_B', d.x, d.z, r, .55 * s, .55 * s, .55 * s, .8);
    case 'cross': return putModel(L, rnd() < .5 ? 'gravemarker_A' : 'gravemarker_B', d.x, d.z, r, .9 * s, .9 * s, .9 * s, .8);
    case 'mausoleum': return putModel(L, 'crypt', d.x, d.z, r, .7, .5, .55, .85);
    case 'well': return putModel(L, 'well_red', d.x, d.z, r, 2.4, 2.4, 2.4, .9);
    case 'tent': return putModel(L, 'tent', d.x, d.z, r, 5, 5, 5, .85);
    case 'bigtent': return putModel(L, 'tent', d.x, d.z, r, 8.5, 8.5, 8.5, .85);
    case 'shrine': return putModel(L, 'shrine_candles', d.x, d.z, r, 1.4, 1.4, 1.4, .9);
    case 'lamp': return putModel(L, 'post_lantern', d.x, d.z, r, 1, 1, 1, .9);
    case 'barrel_d': return putModel(L, 'barrel_small', d.x, d.z, r, .8 * s, .85 * s, .8 * s);     // 4.09: бочки и ящики KayKit Dungeon (лёгкие, ≈200 треугольников)
    case 'crate_d': return rnd() < .6 ? putModel(L, 'box_small', d.x, d.z, r, .78 * s, .72 * s, .78 * s) : putModel(L, 'box_large', d.x, d.z, r, .58 * s, .52 * s, .58 * s);
    case 'wagon': return putModel(L, 'Prop_Wagon', d.x, d.z, r, .9, .9, .9, .85);     // 4.10: повозка Quaternius у лавки
    case 'kbanner': case 'banner': { const name = d.t === 'kbanner' ? (rnd() < .5 ? 'banner_patternA_red' : 'banner_shield_red') : 'banner_thin_red', M = BLD[name]; if (!M) return false;     // 4.09: знамя KayKit на столбе с перекладиной
      const r = 0, c = 1, sn = 0, k = 1.75 / M.userData.h, top = 3.5, at = (lx, lz) => [d.x + lx * c + lz * sn, d.z - lx * sn + lz * c];     // 4.10: полотно лицом к камере — сверху не видно ребром
      { const [px, pz] = at(0, -.14); pushBox(L, .16, top + .2, .16, px, (top + .2) / 2, pz, 0, r, 0, '#2a2420'); pushBox(L, M.userData.w * k + .3, .1, .1, px, top, pz, 0, r, 0, '#2a2420'); }
      return putModel(L, name, d.x, d.z, r, k, k, k, 1, top - 1.75 - .02); }
    case 'fence': return d.grave ? putModel(L, 'fence', d.x, d.z, d.rot ? Math.PI / 2 : 0, (d.w || 2) / 4, .5, .6, .85) : putModel(L, 'fence_wood_straight', d.x, d.z, d.rot ? 0 : Math.PI / 2, 2.2, 2.2, (d.w || 2) / 1.15, .85);
    case 'gate': return putModel(L, 'arch_gate', d.x, d.z, r, .7, .6, .7, .85);
    case 'cwall': { const ax = d.w >= d.d; return tile('wall_straight', Math.max(d.w, d.d), 7.8, 3.9, ax, Math.min(d.w, d.d) / .8 * 1.1); }
    case 'ctower': return putModel(L, 'tower_A_red', d.x, d.z, 0, 4.4, 3.8, 4.4, .85);
    case 'cgate': return putModel(L, 'wall_straight_gate', d.x, d.z, r, ((d.w || 4) + 2.4) / 2, 3.9, 2, .85);
    case 'palwall': { const ax = d.w >= d.d; return tile('fence_wood_straight', Math.max(d.w, d.d), 6.3, 5.5, ax, 5.5); }
    case 'palgate': return putModel(L, 'fence_wood_straight_gate', d.x, d.z, r + Math.PI / 2, 5.5, 5.5, ((d.w || 3) + 1.4) / 1.15, .9);
    case 'ruinwall': case 'wallfrag': return putModel(L, 'destroyed', d.x, d.z, r, 2.2 * s, 2.2 * s, 2.2 * s, .7);
    case 'mill': return putModel(L, 'windmill_red', d.x, d.z, r, 3.4, 3.4, 3.4, .85);
    case 'tower': return putModel(L, 'tower_B_red', d.x, d.z, r, 3.2, 3.6, 3.2, .85);
    // мелочи мира (2026-10-28, владелец: «больше деталей»): KayKit Dungeon — props.glb, Quaternius — qprops.glb, оружие — kk_weapons.glb
    case 'barrel_l': return putModel(L, 'barrel_large', d.x, d.z, r, fit('barrel_large', 1.15 * s), fit('barrel_large', 1.15 * s), fit('barrel_large', 1.15 * s));
    case 'keg': return putModel(L, 'keg', d.x, d.z, r, fit('keg', 1 * s), fit('keg', 1 * s), fit('keg', 1 * s));
    case 'barrels': return putModel(L, 'barrel_small_stack', d.x, d.z, r, fit('barrel_small_stack', 1.1 * s), fit('barrel_small_stack', 1.1 * s), fit('barrel_small_stack', 1.1 * s));
    case 'crates': return putModel(L, 'crates_stacked', d.x, d.z, r, fit('crates_stacked', 1.4 * s), fit('crates_stacked', 1.4 * s), fit('crates_stacked', 1.4 * s));
    case 'chest_d': return putModel(L, 'chest', d.x, d.z, r, fit('chest', .7 * s), fit('chest', .7 * s), fit('chest', .7 * s));
    case 'trunk_d': return putModel(L, 'trunk_medium_A', d.x, d.z, r, fit('trunk_medium_A', .55 * s), fit('trunk_medium_A', .55 * s), fit('trunk_medium_A', .55 * s));
    case 'table_set': { const k = fit('table_medium', .8); if (!putModel(L, 'table_medium', d.x, d.z, r, k, k, k)) return false; const c = Math.cos(r), sn = Math.sin(r); for (const o of [-1, 1]) putModel(L, 'stool', d.x + o * .95 * c, d.z - o * .95 * sn, r, fit('stool', .45), fit('stool', .45), fit('stool', .45)); return true; }
    case 'table_broken': return putModel(L, 'table_long_broken', d.x, d.z, r, fit('table_long_broken', .8 * s), fit('table_long_broken', .8 * s), fit('table_long_broken', .8 * s), .85);
    case 'shelf_d': return putModel(L, 'shelves', d.x, d.z, r, fit('shelves', 1.6 * s), fit('shelves', 1.6 * s), fit('shelves', 1.6 * s));
    case 'candles3': return putModel(L, 'candle_triple', d.x, d.z, r, fit('candle_triple', .45), fit('candle_triple', .45), fit('candle_triple', .45));
    case 'swsh_broken': return putRot(L, 'sword_shield_broken', d.x, .05, d.z, -Math.PI / 2, r, 0, fit('sword_shield_broken', 1.1 * s), true, .9);
    case 'swsh': return putModel(L, 'sword_shield', d.x, d.z, r, fit('sword_shield', 1 * s), fit('sword_shield', 1 * s), fit('sword_shield', 1 * s));
    case 'rubble_s': return putModel(L, 'rubble_half', d.x, d.z, r, fit('rubble_half', .9 * s), fit('rubble_half', .9 * s), fit('rubble_half', .9 * s), .85);
    case 'rubble_l': return putModel(L, 'rubble_large', d.x, d.z, r, fit('rubble_large', 1.1 * s), fit('rubble_large', 1.1 * s), fit('rubble_large', 1.1 * s), .85);
    case 'column_d': return putModel(L, 'column', d.x, d.z, r, fit('column', 2.6 * s) * 1.3, fit('column', 2.6 * s), fit('column', 2.6 * s) * 1.3, .9);
    case 'arch_k': return putModel(L, 'wall_arched', d.x, d.z, r, fit('wall_arched', 3.6 * s), fit('wall_arched', 3.6 * s), fit('wall_arched', 3.6 * s), .85);
    case 'wall_br': return putModel(L, 'wall_broken', d.x, d.z, r, fit('wall_broken', 3.2 * s), fit('wall_broken', 3.2 * s), fit('wall_broken', 3.2 * s), .8);
    case 'wall_hf': return putModel(L, 'wall_half', d.x, d.z, r, fit('wall_half', 2.4 * s), fit('wall_half', 2.4 * s), fit('wall_half', 2.4 * s), .8);
    case 'torch_d': return putModel(L, 'torch_lit', d.x, d.z, r, fit('torch_lit', 1.2), fit('torch_lit', 1.2), fit('torch_lit', 1.2));
    case 'barrier_d': return putModel(L, 'barrier', d.x, d.z, r, fit('barrier', 1 * s), fit('barrier', 1 * s), fit('barrier', 1 * s), .85);
    case 'arch_q': return putModel(L, 'Wall_Arch', d.x, d.z, r, fit('Wall_Arch', 3.4 * s), fit('Wall_Arch', 3.4 * s), fit('Wall_Arch', 3.4 * s) * 6, .9);
    case 'vine': return putModel(L, rnd() < .5 ? 'Prop_Vine6' : 'Prop_Vine2', d.x, d.z, r, fit('Prop_Vine6', 1.8 * s), fit('Prop_Vine6', 1.8 * s), fit('Prop_Vine6', 1.8 * s));
    case 'fence_q': return putModel(L, 'Prop_WoodenFence_Single', d.x, d.z, r, fit('Prop_WoodenFence_Single', 1 * s), fit('Prop_WoodenFence_Single', 1 * s), fit('Prop_WoodenFence_Single', 1 * s), .9);
    case 'w_lie': { const n = WEAPONS[(rnd() * WEAPONS.length) | 0]; return putRot(L, n, d.x, .04, d.z, Math.PI / 2, r, 0, fit(n, (n.startsWith('rpg_') || n.endsWith('2handed') ? 1.6 : 1) * s), true, .85); }     // лежит плашмя
    case 'w_stuck': { const n = WEAPONS[(rnd() * 6) | 0]; return putRot(L, n, d.x, -.25 * s, d.z, .25 * (rnd() - .5), r, Math.PI + .3 * (rnd() - .5), fit(n, 1.1 * s), false, .85); }     // воткнут в землю остриём
    case 'shield_lie': { const n = SHIELDS[(rnd() * SHIELDS.length) | 0]; return putRot(L, n, d.x, .03, d.z, -Math.PI / 2 + .15 * (rnd() - .5), r, 0, fit(n, .75 * s), true, .85); }
    default: return false;
  }
}
export function buildDecor(map, rnd, grime = null, mats = null, Y = null) {     // mats — общие материалы для сборки по клеткам (2026-10-28): первая сборка кладёт их туда
  // клетки 64 м (C3b): каждая — свои меши, поэтому дальний и невидимый декор отсекается
  const glowList = () => Object.assign([], { glow: true });     // светящееся — без градиента (шаг 7)
  let L = [], G = glowList(); const cells = new Map(), use = (x, z) => { const k = Math.floor(x / 64) + ',' + Math.floor(z / 64); if (!cells.has(k)) cells.set(k, { L: [], G: glowList() }); ({ L, G } = cells.get(k)); };
  // коробка в локальных координатах предмета (поворот по оси y вокруг его центра)
  const mk = (x, z, rot) => { const c = Math.cos(rot), s = Math.sin(rot); return (lx, ly, lz, w, h, d, color, glow) => { const T = glow === true ? G : L; pushBox(T, w, h, d, x + lx * c + lz * s, ly + h / 2, z - lx * s + lz * c, 0, rot, 0, color); if (typeof glow === 'string') tagKind(T[T.length - 1], glow); }; };     // glow-строка — вид детали (ткань, металл…)

  // дороги нарисованы цветом земли (шаг 6 аудита, render.js → hillsGeo), плит больше нет
  for (const d of map.decor) {
    use(d.x, d.z);
    const f = mk(d.x, d.z, d.rot || 0), s = d.s || 1, n0 = L.length, g0 = G.length, y0 = Y && !d.flat ? Y(d.x, d.z) : 0, lift = () => { if (y0) { for (let i = n0; i < L.length; i++) L[i].translate(0, y0, 0); for (let i = g0; i < G.length; i++) G[i].translate(0, y0, 0); } };     // Y — высота земли (2026-10-28): мелочи на склонах не висят и не тонут
    if (BLD && swapDecor(d, L, rnd)) { for (let i = n0; i < L.length; i++) if (!L[i].attributes.pkind) tagKind(L[i], PART_OF[d.t] || 'auto'); lift(); continue; }
    switch (d.t) {
      case 'lamp': f(0, 0, 0, .14, 3.2, .14, '#2a2220'); f(0, 3.0, 0, .6, .1, .1, '#2a2220'); f(.28, 2.55, 0, .3, .42, .3, '#ffb35a', true); f(.28, 2.8, 0, .4, .08, .4, '#2a2220'); break;
      case 'fence': { const w = d.w; const f2 = mk(d.x, d.z, d.rot ? Math.PI / 2 : 0); f2(-w / 2, 0, 0, .16, 1.15, .16, '#4a4440'); f2(0, 0, 0, .16, 1.0, .16, '#4a4440'); f2(0, .75, 0, w, .08, .08, '#4a4440'); f2(0, .35, 0, w, .08, .08, '#4a4440'); f2(-w / 2, 1.15, 0, .1, .22, .1, '#3a3532'); break; }
      case 'gate': f(-1.3, 0, 0, .3, 2.2, .3, '#3a3532'); f(1.3, 0, 0, .3, 2.2, .3, '#3a3532'); f(0, 2.1, 0, 2.9, .22, .3, '#3a3532'); f(0, 2.35, 0, .5, .3, .3, '#4a4642'); break;
      case 'tomb': f(0, 0, 0, .6 * s, .85 * s, .16, '#8a867c'); f(0, .85 * s, 0, .46 * s, .14 * s, .16, '#8a867c'); f(0, 0, .3, .8 * s, .08, .5, '#2a2420'); break;
      case 'cross': f(0, 0, 0, .14, 1.0 * s, .14, '#7a6a58'); f(0, .62 * s, 0, .6 * s, .12, .14, '#7a6a58'); break;
      case 'mound': f(0, 0, 0, .8, .16, 1.5, '#2a2018'); break;
      case 'dead_tree': addTree(L, rnd, d.x, d.z); addTree(L, rnd, d.x + .2, d.z + .1); break;
      case 'mausoleum': f(0, 0, 0, 4.2, 2.8, 3.4, '#6a665e'); f(0, 2.8, 0, 4.6, .3, 3.8, '#5a564e'); f(0, 3.1, 0, 3.0, .3, 2.6, '#6a665e'); f(0, 0, 1.72, 1.2, 1.9, .1, '#0a0808'); f(0, 1.9, 1.76, 1.5, .25, .2, '#5a564e'); f(0, 3.4, 0, .3, .8, .3, '#c8a24a'); break;
      case 'furrow': f(0, 0, 0, d.w, .22, .55, '#2a1e14'); f(0, .22, 0, d.w - .4, .06, .22, ['#3a4a2a', '#4a3a22', '#2a3a22'][((d.z * 7) | 0) % 3]); break;
      case 'haystack': f(0, 0, 0, 2.0 * s, 1.0 * s, 2.0 * s, '#8a7234'); f(0, 1.0 * s, 0, 1.5 * s, .7 * s, 1.5 * s, '#9a8240'); f(0, 1.7 * s, 0, .8 * s, .5 * s, .8 * s, '#a8924a'); break;
      case 'scarecrow': f(0, 0, 0, .1, 2.0, .1, '#3a2a1e'); f(0, 1.4, 0, 1.3, .1, .1, '#3a2a1e'); f(0, 1.9, 0, .34, .34, .34, '#b8a283'); f(0, 2.2, 0, .6, .1, .6, '#2a2220'); f(0, 2.25, 0, .3, .3, .3, '#2a2220'); f(0, .9, 0, .5, .8, .2, '#5a3a26'); break;
      case 'stall': { f(0, .7, 0, 2.2, .1, 1.0, '#4a3524'); f(0, 0, 0, 2.0, .7, .8, '#3a281a'); for (const x of [-1.05, 1.05]) for (const z of [-.45, .45]) f(x, 0, z, .1, 2.2, .1, '#3a281a'); f(0, 2.2, 0, 2.6, .12, 1.4, d.c, 'cloth'); f(0, 2.12, .75, 2.6, .12, .1, d.c, 'cloth'); f(-.5, .8, 0, .4, .3, .4, '#8a7a62'); f(.2, .8, 0, .3, .2, .3, '#a89a82'); f(.7, .8, 0, .3, .35, .3, '#6a2a2a'); break; }
      // ориентиры большого мира (C3b): башня, ветряная мельница, развалины крепости
      // замок (C4c): участок стены с зубцами, угловая башня, ворота-арка
      case 'cwall': { const g = mk(d.x, d.z, 0); g(0, 0, 0, d.w, 4.2, d.d, '#6e6a62'); const along = d.w > d.d, L = Math.max(d.w, d.d); for (let k = -L / 2 + .6; k < L / 2; k += 1.6) g(along ? k : 0, 4.2, along ? 0 : k, along ? .8 : d.w, .6, along ? d.d : .8, '#5e5a52'); break; }
      case 'ctower': f(0, 0, 0, 4.2, 7.5, 4.2, '#77736a'); f(0, 7.5, 0, 4.8, .5, 4.8, '#5e5a52'); for (const [x, z] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]]) f(x, 8, z, .9, .9, .9, '#5e5a52'); for (const y of [3, 5.5]) f(0, y, 2.11, .35, .7, .1, '#141210'); break;
      case 'cgate': { const g = mk(d.x, d.z, d.rot || 0); g(0, 4, 0, d.w + 2.4, 1.6, 1.6, '#6e6a62'); for (const s of [-1, 1]) g(s * (d.w / 2 + .6), 0, 0, 1.2, 5.6, 1.8, '#5e5a52'); g(0, 3.4, 0, d.w, .3, .25, '#3a2818'); for (let k = -d.w / 2 + .4; k < d.w / 2; k += .7) g(k, 3.6, 0, .12, 1.4, .12, '#2a2622'); break; }
      case 'tower': f(0, 0, 0, 3.6, 9, 3.6, '#7e7a70'); f(0, 9, 0, 4.4, .6, 4.4, '#6a665e'); for (const [x, z] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) f(x, 9.6, z, .8, 1, .8, '#6a665e'); f(0, 0, 1.81, .9, 1.9, .1, '#2a2220'); for (const y of [3.5, 6.5]) f(0, y, 1.81, .4, .7, .1, '#1a1612'); break;
      case 'mill': f(0, 0, 0, 3.2, 5, 3.2, '#8a6a48'); f(0, 5, 0, 3.6, .5, 3.6, '#5a3e26'); f(0, 5.5, 0, 2.4, 1.2, 2.4, '#5a3e26'); f(0, 1.6, 1.9, .3, 7, .2, '#d8c8a0'); f(0, 5.1, 1.9, 7, .3, .2, '#d8c8a0'); f(0, 4.9, 1.75, .6, .6, .3, '#3a2818'); f(0, 0, 1.61, .9, 1.8, .1, '#2a2220'); break;
      case 'fort': for (let k = 0; k < 6; k++) { if (k === 2) continue; const a = (d.rot || 0) + k * Math.PI / 3, g = mk(d.x + Math.cos(a) * 3.4, d.z + Math.sin(a) * 3.4, -a + Math.PI / 2), h = 1.4 + ((k * 7) % 5) * .5; g(0, 0, 0, 3.1, h, .9, '#7e7a70'); g(-.9, h, 0, .6, .5, .9, '#6a665e'); }
        f(0, 0, 0, 1.6, 2.6, 1.6, '#6a665e'); for (let k = 0; k < 7; k++) f(Math.cos(k * 2.4) * 2.2, 0, Math.sin(k * 2.4) * 2.2, .7, .4, .6, '#8a857a'); break;
      case 'well': for (const [x, z, w, dd] of [[-.6, 0, .25, 1.2], [.6, 0, .25, 1.2], [0, -.6, 1.2, .25], [0, .6, 1.2, .25]]) f(x, 0, z, w, .8, dd, '#5a564e'); f(-.7, 0, 0, .12, 2.2, .12, '#3a281a'); f(.7, 0, 0, .12, 2.2, .12, '#3a281a'); f(0, 2.1, 0, 1.8, .12, 1.2, '#3a281a'); f(0, 1.3, 0, 1.4, .08, .08, '#2a2220'); break;
      case 'crate_d': f(0, 0, 0, .8, .7, .8, '#6b4a2c'); f(0, .7, 0, .84, .08, .84, '#4a3220'); break;
      case 'barrel_d': f(0, 0, 0, .7, .9, .7, '#5a3d26'); f(0, .2, 0, .76, .07, .76, '#2a2220'); f(0, .66, 0, .76, .07, .76, '#2a2220'); break;
      case 'wallfrag': f(0, 0, 0, 2.4 * s, 1.6 * s, .5, '#6a665e'); f(.6 * s, 1.6 * s, 0, 1.0 * s, .8 * s, .5, '#6a665e'); f(-.5 * s, 0, .4, .8, .5, .6, '#5a564e'); break;
      case 'rubble': f(0, 0, 0, .7 * s, .3 * s, .6 * s, '#5a564e'); f(.5, 0, .3, .4 * s, .25 * s, .4 * s, '#6a665e'); f(-.3, 0, -.3, .5 * s, .35 * s, .5 * s, '#2e2a28'); break;
      case 'campfire': for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; f(Math.cos(a) * .5, 0, Math.sin(a) * .5, .5, .18, .18, '#3a2616'); } f(0, .1, 0, .5, .7, .5, '#e0602a', true); f(0, .3, 0, .28, .6, .28, '#ffd27a', true); break;
      case 'tent': { const c = Math.cos(d.rot || 0), sn = Math.sin(d.rot || 0); f(0, 0, 0, 2.6, .12, 2.2, '#2a2018'); for (const sg of [-1, 1]) pushBox(L, 1.9, .08, 2.2, d.x + sg * .8 * c, .85, d.z - sg * .8 * sn, 0, d.rot || 0, -sg * .8, '#7a6850'); f(0, 0, 0, .1, 1.6, 2.2, '#2a2018'); break; }
      // точки интереса большого мира (G2)
      case 'pier': f(0, 0, 0, 1.15, 1.25, 1.15, '#6a665e'); f(0, 1.25, 0, 1.3, .2, 1.3, '#5a564e'); f(0, 0, 0, 1.3, .25, 1.3, '#4a463e'); break;     // опора моста (F5)
      case 'stake': f(0, 0, 0, .22, 1.5 * s, .22, '#4a3622'); f(0, 1.5 * s, 0, .12, .3, .12, '#2e2216'); break;
      // вражеский лагерь (2026-10-18): частокол из брёвен вдоль отрезка w×d, ворота шириной w (поворот rot), сторожевая вышка
      case 'palwall': { const along = d.w >= d.d, Lg = Math.max(d.w, d.d), g = mk(d.x, d.z, 0); for (let k = -Lg / 2 + .25, n = 0; k < Lg / 2; k += .5, n++) { const h = 2.9 + ((n * 7) % 5) * .12; g(along ? k : 0, 0, along ? 0 : k, .46, h, .46, n % 3 ? '#4a3622' : '#3e2c1c'); g(along ? k : 0, h, along ? 0 : k, .24, .32, .24, '#2e2216'); }
        g(0, 1.9, 0, along ? Lg : .2, .16, along ? .2 : Lg, '#2e2216'); break; }     // брёвна с острыми верхушками и поперечина
      case 'palgate': { const g = mk(d.x, d.z, d.rot || 0); for (const sg of [-1, 1]) g(sg * (d.w / 2 + .35), 0, 0, .7, 4, .7, '#3e2c1c'); g(0, 3.6, 0, d.w + 1.4, .4, .5, '#3e2c1c'); g(0, 4, 0, .9, .7, .1, '#8a2a1a'); break; }
      case 'wtower': f(0, 0, 0, .35, 4.6, .35, '#3e2c1c'); for (const [x, z] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) f(x, 0, z, .3, 4.4, .3, '#4a3622'); f(0, 4.4, 0, 2.8, .25, 2.8, '#4a3622'); for (const [x, z, w, dd] of [[0, -1.35, 2.8, .12], [0, 1.35, 2.8, .12], [-1.35, 0, .12, 2.8], [1.35, 0, .12, 2.8]]) f(x, 4.65, z, w, .8, dd, '#3e2c1c'); f(0, 5.5, 0, 3.2, .2, 3.2, '#5a4030'); f(0, 5.7, 0, 2, .6, 2, '#6a4a34'); break;
      case 'banner': f(0, 0, 0, .14, 3.4, .14, '#2e2216'); f(.45, 2.3, 0, .9, 1.1, .05, d.c || '#8a2a1a', 'cloth'); break;
      // города и лагеря (2026-10-18): мостовая плитами w×d, жаровня, обломок стены, разбитая статуя; шатёр вожака, чучело, клетка, тотем
      case 'paving': { const g = mk(d.x, d.z, 0), T = 1.6; for (let a = -d.w / 2 + T / 2; a < d.w / 2; a += T) for (let b = -d.d / 2 + T / 2; b < d.d / 2; b += T) { const k = (Math.abs(Math.round(a * 7 + b * 13)) % 3); g(a, 0, b, T - .12, .07, T - .12, ['#6e685e', '#787266', '#645e56'][k]); } break; }
      case 'brazier': f(0, 0, 0, .3, .9, .3, '#2a2420'); f(0, .9, 0, .9, .3, .9, '#3a322c'); f(0, 1.2, 0, .6, .35, .6, '#ff8a30', true); f(0, 1.5, 0, .3, .3, .3, '#ffd060', true); break;
      case 'ruinwall': f(0, 0, 0, 3.2 * s, 1.6, .7, '#6e6a62'); f(-.6 * s, 1.6, 0, 1.8 * s, .9, .7, '#66625a'); f(-1.1 * s, 2.5, 0, .7 * s, .7, .7, '#5e5a52'); f(1.5 * s, 0, .6, .7, .5, .6, '#5e5a52'); break;
      case 'statue': f(0, 0, 0, 1.8, .8, 1.8, '#5e5a52'); f(0, .8, 0, 1.4, .3, 1.4, '#6e6a62'); f(0, 1.1, 0, .8, 1.6, .5, '#8a857a'); f(0, 2.7, 0, .45, .45, .45, '#8a857a'); f(.55, 1.9, 0, .25, 1.2, .25, '#8a857a'); f(.55, 3.1, 0, .1, 1.4, .1, '#7a756a'); f(-.9, .1, .9, .5, .4, .5, '#8a857a'); break;
      case 'bigtent': { const c = Math.cos(d.rot || 0), sn = Math.sin(d.rot || 0); f(0, 0, 0, 4.6, .14, 4, '#2a2018'); for (const sg of [-1, 1]) pushBox(L, 3.2, .1, 4, d.x + sg * 1.35 * c, 1.35, d.z - sg * 1.35 * sn, 0, d.rot || 0, -sg * .85, '#6a3a2a'); f(0, 0, 0, .14, 2.8, .14, '#2a2018'); f(0, 2.8, 0, .1, 1.2, .1, '#2a2018'); f(.35, 3.5, 0, .6, .4, .04, '#8a2a1a'); break; }
      case 'dummy': f(0, 0, 0, .14, 1.9, .14, '#4a3622'); f(0, 1.35, 0, 1.1, .12, .12, '#4a3622'); f(0, 1.2, 0, .55, .7, .4, '#9a8456'); f(0, 1.75, 0, .35, .35, .35, '#9a8456'); break;
      case 'cage': f(0, 0, 0, 1.8, .15, 1.8, '#3a2c20'); f(0, 1.9, 0, 1.8, .15, 1.8, '#3a2c20'); for (const [x, z] of [[-.85, -.85], [.85, -.85], [-.85, .85], [.85, .85], [0, -.85], [0, .85], [-.85, 0], [.85, 0]]) f(x, .15, z, .1, 1.75, .1, '#2a2420'); f(.2, .15, .1, .5, .25, .3, '#cfc6b0'); break;
      case 'totem': f(0, 0, 0, .3, 3, .3, '#3e2c1c'); f(0, 3, 0, .5, .45, .45, '#d8d0b8'); f(0, 2.95, .24, .3, .12, .04, '#1a1210'); for (const sg of [-1, 1]) f(sg * .4, 3.3, 0, .5, .12, .12, '#d8d0b8'); f(0, 2.2, 0, .9, .1, .1, '#3e2c1c'); f(.35, 1.7, 0, .1, .6, .1, '#8a2a1a'); break;
      case 'bones': f(0, 0, 0, .7, .1, .12, '#cfc6b0'); f(.15, 0, .2, .12, .1, .55, '#bdb39c'); f(-.3, 0, -.2, .26, .24, .26, '#d8cfb8'); break;
      case 'shrine': f(0, 0, 0, 1.8, .4, 1.8, '#6a665e'); f(0, .4, 0, 1.2, .5, 1.2, '#7e7a70'); f(0, .9, 0, .5, 1.3, .5, '#8a867c'); f(0, 1.5, .26, .26, .4, .04, '#9ad8ff', true); f(0, 2.2, 0, .7, .14, .7, '#6a665e'); break;
      case 'candle': f(0, 0, 0, .14, .32, .14, '#e8dcc0'); f(0, .32, 0, .08, .14, .08, '#ffc870', true); break;
      case 'flowers': f(0, 0, 0, .1, .28, .1, '#3e6a2a'); f(0, .28, 0, .22, .1, .22, ['#e8d24a', '#e86a8a', '#b8a0ff', '#f0f0f0'][Math.abs(Math.round(d.x * 7 + d.z * 3)) % 4]); f(.25, 0, .1, .08, .2, .08, '#3e6a2a'); f(.25, .2, .1, .16, .08, .16, '#f0f0f0'); break;
      case 'wheel': f(0, 0, 0, 1.2, .12, 1.2, '#4a3420'); f(0, .12, 0, .3, .1, .3, '#2a2016'); break;
      case 'barrow': f(0, 0, 0, 5.4, .7, 4.4, '#3e4a2a'); f(0, .7, 0, 4.2, .7, 3.4, '#46522e'); f(0, 1.4, 0, 2.8, .6, 2.2, '#4e5a34'); f(0, 0, 2.2, 1.2, 1.3, .2, '#3a3632'); f(0, 0, 2.26, .7, 1.0, .1, '#0c0a08'); break;
      case 'menhir': f(0, 0, 0, .9 * s, 2.4 * s, .6 * s, '#7a766c'); f(0, 2.4 * s, 0, .6 * s, .4 * s, .45 * s, '#6a665e'); f(.1, 1.2 * s, .31 * s, .3, .3, .02, '#3a5a46'); break;
      case 'hut_s': f(0, 0, 0, 3.6, 2.0, 3.0, '#5a4028'); f(0, 2.0, 0, 4.0, .35, 3.5, '#4a3a22'); f(0, 2.35, 0, 4.0, .35, 2.5, '#52402a'); f(0, 2.7, 0, 4.0, .3, 1.4, '#4a3a22'); f(0, 3.0, 0, 4.1, .14, .4, '#3a2c1a'); f(0, 0, 1.51, .9, 1.6, .06, '#2a1e12'); f(1.1, .9, 1.51, .5, .4, .06, '#ffcf7a', true); f(-1.2, 2.2, -.6, .4, 1.2, .4, '#5a564e'); break;
      case 'woodpile': f(0, 0, 0, 1.6, .5, .7, '#6a4a2c'); f(0, .5, 0, 1.3, .4, .6, '#7a5634'); break;
      case 'stump': f(0, 0, 0, .7, .45, .7, '#5a3e26'); f(0, .45, 0, .5, .06, .5, '#a88a5a'); break;
      case 'pond': break;     // пруд — теперь настоящее озеро (render.js: вода и камыш по берегу)
      case 'sack_d': f(0, 0, 0, .55, .45, .45, '#8a7a5a', 'cloth'); f(0, .45, 0, .22, .16, .22, '#7a6a4a', 'cloth'); break;     // детали мира (T5)
      case 'bucket': f(0, 0, 0, .36, .34, .36, '#5a3e26'); f(0, .1, 0, .38, .05, .38, '#2a2220', 'metal'); f(0, .26, 0, .38, .05, .38, '#2a2220', 'metal'); break;
      case 'sign': f(0, 0, 0, .12, 2.2, .12, '#3a281a'); f(.4, 1.9, 0, .9, .08, .08, '#3a281a'); f(.08, 1.85, 0, .08, .1, .04, '#2a2220', 'metal'); f(.62, 1.25, 0, .7, .5, .06, '#6a4a2c');
        { const ic = SIGN_ICON[d.kind], c = Math.cos(d.rot || 0), sn = Math.sin(d.rot || 0);     // 4.10: значок ремесла KayKit на вывеске (меч со щитом, монеты, бутыль, ящик)
          if (!(ic && BLD && BLD[ic[0]] && putModel(L, ic[0], d.x + .62 * c + .07 * sn, d.z - .62 * sn + .07 * c, d.rot || 0, ic[1], ic[1], ic[1] * .4, 1, 1.5 - BLD[ic[0]].userData.h * ic[1] / 2)))
            f(.62, 1.3, .04, .3, .22, .03, { smithy: '#8a8478', shop: '#c8a24a', tavern: '#8a5a2a', warehouse: '#7a6a4a' }[d.kind] || '#8a8478', 'metal'); }
        break;
      case 'rug': f(0, 0, 0, 1.4, .03, .9, d.c || '#7a2a24', 'cloth'); f(0, .01, 0, 1.15, .03, .65, '#c8b080', 'cloth'); f(0, .02, 0, 1.0, .03, .5, d.c || '#7a2a24', 'cloth'); break;
      case 'rusty_sword': f(0, 0, 0, .08, .9, .03, '#6a5a4a', 'metal'); f(0, .85, 0, .36, .06, .08, '#4a3a2a', 'metal'); f(0, .91, 0, .06, .24, .06, '#3a2618'); break;
      case 'skulls': f(0, 0, 0, .26, .22, .26, '#d8cfb8'); f(.3, 0, .12, .22, .2, .22, '#cfc6b0'); f(.12, .2, .05, .22, .2, .22, '#d8cfb8'); f(0, .07, .13, .16, .06, .02, '#2a2018', 'plain'); break;
      case 'wreck': f(0, .25, 0, 1.6, .18, 1.0, '#4a3220'); f(.6, 0, .55, .7, .7, .1, '#2a1c12'); f(-.5, 0, -.2, .9, .08, .2, '#5a3e26'); f(.2, 0, -.6, .12, .5, .12, '#3a2618'); f(-.7, .43, .3, .1, .4, .1, '#3a2618'); break;
      case 'candles': f(0, 0, 0, .12, .3, .12, '#e8dcc0'); f(0, .3, 0, .07, .12, .07, '#ffc870', true); f(.16, 0, .08, .1, .22, .1, '#e0d4b8'); f(.16, .22, .08, .06, .1, .06, '#ffc870', true);
        f(-.1, 0, .14, .1, .16, .1, '#d8ccb0'); f(-.1, .16, .14, .06, .09, .06, '#ffc870', true); f(.02, 0, .04, .44, .02, .36, '#d8ccb0', 'plain'); break;
      case 'chain': f(0, 1.3, 0, .3, .08, .1, '#2a2622', 'metal'); for (let i = 0; i < 5; i++) f(0, 1.1 - i * .19, .04, i % 2 ? .05 : .12, .18, i % 2 ? .12 : .05, '#3a3632', 'metal'); break;
      case 'grate': f(0, .05, .02, .9, .95, .02, '#0c0a08', 'plain'); for (const y of [.05, .95]) f(0, y, .05, 1.0, .06, .08, '#2a2622', 'metal'); for (let k = -2; k <= 2; k++) f(k * .2, .05, .05, .05, .96, .05, '#2a2622', 'metal'); break;
      // мелочи мира (2026-10-28): запасной вид без моделей; доспехи — всегда свои (моделей доспехов нет)
      case 'barrel_l': case 'keg': f(0, 0, 0, .75 * s, 1.05 * s, .75 * s, '#6a4a2c'); f(0, .3 * s, 0, .8 * s, .08, .8 * s, '#3a3a3e'); f(0, .75 * s, 0, .8 * s, .08, .8 * s, '#3a3a3e'); break;
      case 'barrels': f(-.4, 0, 0, .6, .8, .6, '#6a4a2c'); f(.4, 0, 0, .6, .8, .6, '#6a4a2c'); f(0, .8, 0, .6, .7, .6, '#5e4228'); break;
      case 'crates': f(0, 0, 0, 1.1 * s, .8 * s, 1.1 * s, '#7a5a34'); f(.1, .8 * s, .05, .8 * s, .6 * s, .8 * s, '#6e5230'); break;
      case 'chest_d': case 'trunk_d': f(0, 0, 0, .9 * s, .55 * s, .6 * s, '#5a3e26'); f(0, .55 * s, 0, .92 * s, .1, .62 * s, '#3a3a3e'); break;
      case 'table_set': f(0, 0, 0, 1.4, .75, .9, '#6a4a2c'); f(-.95, 0, 0, .4, .45, .4, '#5a3e26'); f(.95, 0, 0, .4, .45, .4, '#5a3e26'); break;
      case 'table_broken': f(0, 0, 0, 1.6, .4, .9, '#5a3e26'); f(.9, 0, 0, .7, .15, .9, '#4a3420'); break;
      case 'shelf_d': f(0, 0, 0, 1.4, 1.6, .4, '#5a3e26'); break;
      case 'candles3': f(0, 0, 0, .1, .35, .1, '#e8dcc0'); f(.12, 0, .05, .1, .25, .1, '#e8dcc0'); f(0, .35, 0, .05, .08, .05, '#ffb050', true); break;
      case 'swsh_broken': case 'swsh': f(0, 0, 0, .7, .06, .7, '#6e6e74'); f(.3, 0, 0, 1, .05, .1, '#8a8a90'); break;
      case 'rubble_s': case 'rubble_l': f(0, 0, 0, 1.6 * s, .5 * s, 1.2 * s, '#6a665e'); f(.6 * s, 0, .4 * s, .8 * s, .7 * s, .7 * s, '#5a564e'); break;
      case 'column_d': f(0, 0, 0, .7, 2.6 * s, .7, '#8a857a'); break;
      case 'arch_k': case 'arch_q': f(-1.3 * s, 0, 0, .5, 3.2 * s, .5, '#7a766c'); f(1.3 * s, 0, 0, .5, 3.2 * s, .5, '#7a766c'); f(0, 2.8 * s, 0, 3.1 * s, .5, .5, '#7a766c'); break;
      case 'wall_br': case 'wall_hf': f(0, 0, 0, 2.6 * s, 1.6 * s, .5, '#6a665e'); f(-.6 * s, 1.6 * s, 0, 1.2 * s, .8 * s, .5, '#5e5a52'); break;
      case 'torch_d': f(0, 0, 0, .12, 1.1, .12, '#3a2a1a'); f(0, 1.1, 0, .2, .25, .2, '#ffb050', true); break;
      case 'barrier_d': f(0, 0, 0, 2.6, .9, .3, '#5a3e26'); break;
      case 'vine': f(0, 0, 0, 1, 1.6 * s, .1, '#3e6a28'); break;
      case 'fence_q': f(0, 0, 0, 2, .8, .1, '#5a3e26'); break;
      case 'w_lie': f(0, 0, 0, 1.1 * s, .05, .1, '#8a8a90'); f(-.35 * s, 0, 0, .06, .05, .32, '#4a3a2a'); break;
      case 'w_stuck': f(0, 0, 0, .08, .9 * s, .03, '#8a8a90'); f(0, .9 * s, 0, .3, .05, .06, '#4a3a2a'); break;
      case 'shield_lie': f(0, 0, 0, .7 * s, .06, .7 * s, '#6a4a2c'); f(0, .06, 0, .2, .04, .2, '#8a8a90'); break;
      case 'armor_lie': f(0, 0, 0, .6, .22, .7, '#7d7d84'); f(-.36, 0, .05, .2, .18, .32, '#6a6a70'); f(.36, 0, .05, .2, .18, .32, '#6a6a70'); f(.75, 0, -.3, .34, .3, .36, '#6e6e76'); f(.75, .14, -.12, .24, .04, .02, '#18181c'); break;     // кираса, наплечники, шлем рядом
      case 'armor_pole': f(0, 0, 0, .1, 1.7, .1, '#4a3420'); f(0, 1.25, 0, .9, .08, .08, '#4a3420'); f(0, .75, .04, .55, .6, .3, '#7d7d84'); f(-.36, 1.15, .04, .24, .18, .3, '#6a6a70'); f(.36, 1.15, .04, .24, .18, .3, '#6a6a70'); f(0, 1.6, 0, .34, .32, .36, '#6e6e76'); f(0, 1.74, .18, .24, .04, .02, '#18181c'); break;     // доспех на колу
      case 'armor_pile': for (const [x, z, k] of [[0, 0, 1], [.5, .3, .9], [-.4, .35, .85], [.15, -.45, .8]]) { f(x, 0, z, .55 * k, .22, .62 * k, k > .9 ? '#7d7d84' : '#6a6a70'); f(x + .2, .22, z - .1, .3 * k, .26 * k, .32 * k, '#6e6e76'); } f(-.6, 0, -.4, .6, .07, .6, '#6a4a2c'); break;     // куча доспехов
      case 'armor_rack': f(0, 0, 0, 1.2, .12, .5, '#4a3420'); f(0, 0, 0, .1, 1.7, .1, '#4a3420'); f(0, .75, .06, .55, .6, .3, '#7d7d84'); f(0, 1.6, .02, .34, .32, .36, '#6e6e76'); f(.5, 0, .1, .06, 1.1, .06, '#8a8a90'); f(-.5, 0, .1, .06, 1.1, .06, '#8a8a90'); break;     // стойка с доспехом и копьями
      case 'reed': f(0, 0, 0, .06, 1.1 * s, .06, '#5a6a2e'); f(.12, 0, .05, .06, .9 * s, .06, '#6a7a36'); f(0, 1.1 * s, 0, .1, .26, .1, '#5a3a22'); break;
      default: break;
    }
    if (PART_OF[d.t]) for (let i = n0; i < L.length; i++) if (!L[i].attributes.pkind) tagKind(L[i], PART_OF[d.t]);
    lift();
  }
  const old = !!(mats && mats.lam), group = new THREE.Group(), lam = old ? mats.lam : paintMat(new THREE.MeshLambertMaterial({ vertexColors: true }), 'auto', { plank: .22 }), bas = old ? mats.bas : new THREE.MeshBasicMaterial({ vertexColors: true }); let glow = 0;
  if (mats && !old) { mats.lam = lam; mats.bas = bas; }
  if (grime && grime.on && !old) {                                                    // потёртости (V2b): пятна по мировым координатам, низ темнее
    const gp = lam.onBeforeCompile, gk = lam.customProgramCacheKey ? lam.customProgramCacheKey() : '';     // поверх материалов (T0)
    lam.onBeforeCompile = (sh, r) => {
      if (gp) gp(sh, r); sh.uniforms.uGrime = { value: grime.k };
      sh.vertexShader = 'varying vec3 vGW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vGW = (modelMatrix * vec4(transformed, 1.)).xyz;');
      sh.fragmentShader = 'uniform float uGrime; varying vec3 vGW;\nfloat lh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\nfloat lvn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(lh(i), lh(i + vec2(1., 0.)), f.x), mix(lh(i + vec2(0., 1.)), lh(i + vec2(1., 1.)), f.x), f.y); }\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  float gn = lvn(vGW.xz * 1.7 + vGW.y * 1.3) * .6 + lvn(vGW.xz * 5.1 - vGW.y * 3.7) * .4;
  diffuseColor.rgb *= 1. - uGrime * (gn - .35) - uGrime * .6 * (1. - smoothstep(0., .5, vGW.y));`);
    };
    lam.customProgramCacheKey = () => gk + 'grime';
  }
  for (const [k, c] of cells) {
    const [cx, cz] = k.split(',').map(Number), g = new THREE.Group(); g.userData.cx = (cx + .5) * 64; g.userData.cz = (cz + .5) * 64;
    if (c.L.length) { for (const q of c.L) if (!q.attributes.pkind) tagKind(q, 'auto'); g.add(new THREE.Mesh(mergeGeometries(c.L, false), lam)); }     // слияние требует одинаковых атрибутов
    if (c.G.length) { g.add(new THREE.Mesh(mergeGeometries(c.G, false), bas)); glow += c.G.length; }
    group.add(g);
  }
  return { group, glow };
}
