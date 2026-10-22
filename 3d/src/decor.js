// Уличный декор: дороги, фонари, заборы, кладбище, ферма, рынок, руины, лагерь. Всё сливается в два меша (обычный и «светящийся»).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pushBox, addTree } from './models.js';
import { paintMat, tagKind } from './paint3d.js';

// вид деталей (T3): серое у построек из камня — кладкой; шатры — тканью; клетка и жаровня — металлом
const PART_OF = { cwall: 'masonry', ctower: 'masonry', cgate: 'masonry', tower: 'masonry', fort: 'masonry', wallfrag: 'masonry', ruinwall: 'masonry', mausoleum: 'masonry', shrine: 'masonry', well: 'masonry', paving: 'masonry', mill: 'masonry', tent: 'cloth', bigtent: 'cloth', cage: 'metal', brazier: 'metal', lamp: 'metal' };

// готовые постройки KayKit (2026-10-20, выбор владельца): геометрии с цветом в вершинах (buildings.glb); пока нет — свои кубики
let BLD = null;
export function setDecorLib(lib) { BLD = lib; }
const TM = new THREE.Matrix4(), TQ = new THREE.Quaternion(), TE = new THREE.Euler(), TP = new THREE.Vector3(), TS = new THREE.Vector3();
// модель name: центр в (x, z), поворот rot, масштаб по осям модели; dim — тёмнее/светлее
function putModel(L, name, x, z, rot, sx, sy, sz, dim = 1, y = 0) {
  const src = BLD && BLD[name]; if (!src) return false;
  const g = src.clone(); TE.set(0, rot, 0); TQ.setFromEuler(TE); TP.set(x, y, z); TS.set(sx, sy, sz); TM.compose(TP, TQ, TS); g.applyMatrix4(TM);
  if (dim !== 1) { const c = g.attributes.color; for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * dim, c.getY(i) * dim, c.getZ(i) * dim); }
  L.push(g); return true;
}
// замена своего декора: true — заменили. Ряды (стены, частокол, ограды) — отрезками модели вдоль длинной стороны
function swapDecor(d, L, rnd) {
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
    case 'kbanner': case 'banner': { const name = d.t === 'kbanner' ? (rnd() < .5 ? 'banner_patternA_red' : 'banner_shield_red') : 'banner_thin_red', M = BLD[name]; if (!M) return false;     // 4.09: знамя KayKit на столбе с перекладиной
      const c = Math.cos(r), sn = Math.sin(r), k = 1.75 / M.userData.h, top = 3.5, at = (lx, lz) => [d.x + lx * c + lz * sn, d.z - lx * sn + lz * c];
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
    default: return false;
  }
}
export function buildDecor(map, rnd, grime = null) {
  // клетки 64 м (C3b): каждая — свои меши, поэтому дальний и невидимый декор отсекается
  const glowList = () => Object.assign([], { glow: true });     // светящееся — без градиента (шаг 7)
  let L = [], G = glowList(); const cells = new Map(), use = (x, z) => { const k = Math.floor(x / 64) + ',' + Math.floor(z / 64); if (!cells.has(k)) cells.set(k, { L: [], G: glowList() }); ({ L, G } = cells.get(k)); };
  // коробка в локальных координатах предмета (поворот по оси y вокруг его центра)
  const mk = (x, z, rot) => { const c = Math.cos(rot), s = Math.sin(rot); return (lx, ly, lz, w, h, d, color, glow) => { const T = glow === true ? G : L; pushBox(T, w, h, d, x + lx * c + lz * s, ly + h / 2, z - lx * s + lz * c, 0, rot, 0, color); if (typeof glow === 'string') tagKind(T[T.length - 1], glow); }; };     // glow-строка — вид детали (ткань, металл…)

  // дороги нарисованы цветом земли (шаг 6 аудита, render.js → hillsGeo), плит больше нет
  for (const d of map.decor) {
    use(d.x, d.z);
    const f = mk(d.x, d.z, d.rot || 0), s = d.s || 1, n0 = L.length;
    if (BLD && swapDecor(d, L, rnd)) { for (let i = n0; i < L.length; i++) if (!L[i].attributes.pkind) tagKind(L[i], PART_OF[d.t] || 'auto'); continue; }
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
        f(.62, 1.3, .04, .3, .22, .03, { smithy: '#8a8478', shop: '#c8a24a', tavern: '#8a5a2a', warehouse: '#7a6a4a' }[d.kind] || '#8a8478', 'metal'); break;
      case 'rug': f(0, 0, 0, 1.4, .03, .9, d.c || '#7a2a24', 'cloth'); f(0, .01, 0, 1.15, .03, .65, '#c8b080', 'cloth'); f(0, .02, 0, 1.0, .03, .5, d.c || '#7a2a24', 'cloth'); break;
      case 'rusty_sword': f(0, 0, 0, .08, .9, .03, '#6a5a4a', 'metal'); f(0, .85, 0, .36, .06, .08, '#4a3a2a', 'metal'); f(0, .91, 0, .06, .24, .06, '#3a2618'); break;
      case 'skulls': f(0, 0, 0, .26, .22, .26, '#d8cfb8'); f(.3, 0, .12, .22, .2, .22, '#cfc6b0'); f(.12, .2, .05, .22, .2, .22, '#d8cfb8'); f(0, .07, .13, .16, .06, .02, '#2a2018', 'plain'); break;
      case 'wreck': f(0, .25, 0, 1.6, .18, 1.0, '#4a3220'); f(.6, 0, .55, .7, .7, .1, '#2a1c12'); f(-.5, 0, -.2, .9, .08, .2, '#5a3e26'); f(.2, 0, -.6, .12, .5, .12, '#3a2618'); f(-.7, .43, .3, .1, .4, .1, '#3a2618'); break;
      case 'candles': f(0, 0, 0, .12, .3, .12, '#e8dcc0'); f(0, .3, 0, .07, .12, .07, '#ffc870', true); f(.16, 0, .08, .1, .22, .1, '#e0d4b8'); f(.16, .22, .08, .06, .1, .06, '#ffc870', true);
        f(-.1, 0, .14, .1, .16, .1, '#d8ccb0'); f(-.1, .16, .14, .06, .09, .06, '#ffc870', true); f(.02, 0, .04, .44, .02, .36, '#d8ccb0', 'plain'); break;
      case 'chain': f(0, 1.3, 0, .3, .08, .1, '#2a2622', 'metal'); for (let i = 0; i < 5; i++) f(0, 1.1 - i * .19, .04, i % 2 ? .05 : .12, .18, i % 2 ? .12 : .05, '#3a3632', 'metal'); break;
      case 'grate': f(0, .05, .02, .9, .95, .02, '#0c0a08', 'plain'); for (const y of [.05, .95]) f(0, y, .05, 1.0, .06, .08, '#2a2622', 'metal'); for (let k = -2; k <= 2; k++) f(k * .2, .05, .05, .05, .96, .05, '#2a2622', 'metal'); break;
      case 'reed': f(0, 0, 0, .06, 1.1 * s, .06, '#5a6a2e'); f(.12, 0, .05, .06, .9 * s, .06, '#6a7a36'); f(0, 1.1 * s, 0, .1, .26, .1, '#5a3a22'); break;
      default: break;
    }
    if (PART_OF[d.t]) for (let i = n0; i < L.length; i++) if (!L[i].attributes.pkind) tagKind(L[i], PART_OF[d.t]);
  }
  const group = new THREE.Group(), lam = paintMat(new THREE.MeshLambertMaterial({ vertexColors: true }), 'auto', { plank: .22 }), bas = new THREE.MeshBasicMaterial({ vertexColors: true }); let glow = 0;
  if (grime && grime.on) {                                                    // потёртости (V2b): пятна по мировым координатам, низ темнее
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
