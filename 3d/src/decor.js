// Уличный декор: дороги, фонари, заборы, кладбище, ферма, рынок, руины, лагерь. Всё сливается в два меша (обычный и «светящийся»).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pushBox, addTree } from './models.js';
import { distSeg, pathSegs } from './world3d.js';

export function buildDecor(map, rnd) {
  // клетки 64 м (C3b): каждая — свои меши, поэтому дальний и невидимый декор отсекается
  let L = [], G = []; const cells = new Map(), use = (x, z) => { const k = Math.floor(x / 64) + ',' + Math.floor(z / 64); if (!cells.has(k)) cells.set(k, { L: [], G: [] }); ({ L, G } = cells.get(k)); };
  // коробка в локальных координатах предмета (поворот по оси y вокруг его центра)
  const mk = (x, z, rot) => { const c = Math.cos(rot), s = Math.sin(rot); return (lx, ly, lz, w, h, d, color, glow) => pushBox(glow ? G : L, w, h, d, x + lx * c + lz * s, ly + h / 2, z - lx * s + lz * c, 0, rot, 0, color); };
  const inB = (x, z, pad) => map.buildings.some(b => x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad);

  // дороги: плоские плиты вдоль троп от костра к дверям (за лагерем тропы извилистые)
  for (const [a, b] of pathSegs(map)) {
    use((a.x + b.x) / 2, (a.z + b.z) / 2);
    const len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(len / 1.8), yaw = Math.atan2(b.x - a.x, b.z - a.z);
    for (let i = 0; i < n; i++) {
      const k = (i + .5) / n, x = a.x + (b.x - a.x) * k, z = a.z + (b.z - a.z) * k;
      if (inB(x, z, .2) || Math.hypot(x, z) < 1.5) continue;
      const c = ['#3a2c20', '#3e3023', '#34271c'][(rnd() * 3) | 0];
      pushBox(L, 1.9 + rnd() * .5, .05, len / n + .15, x + (rnd() - .5) * .3, .025, z, 0, yaw, 0, c);
    }
  }
  for (const d of map.decor) {
    use(d.x, d.z);
    const f = mk(d.x, d.z, d.rot || 0), s = d.s || 1;
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
      case 'stall': { f(0, .7, 0, 2.2, .1, 1.0, '#4a3524'); f(0, 0, 0, 2.0, .7, .8, '#3a281a'); for (const x of [-1.05, 1.05]) for (const z of [-.45, .45]) f(x, 0, z, .1, 2.2, .1, '#3a281a'); f(0, 2.2, 0, 2.6, .12, 1.4, d.c); f(0, 2.12, .75, 2.6, .12, .1, d.c); f(-.5, .8, 0, .4, .3, .4, '#8a7a62'); f(.2, .8, 0, .3, .2, .3, '#a89a82'); f(.7, .8, 0, .3, .35, .3, '#6a2a2a'); break; }
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
      default: break;
    }
  }
  const group = new THREE.Group(), lam = new THREE.MeshLambertMaterial({ vertexColors: true }), bas = new THREE.MeshBasicMaterial({ vertexColors: true }); let glow = 0;
  for (const [k, c] of cells) {
    const [cx, cz] = k.split(',').map(Number), g = new THREE.Group(); g.userData.cx = (cx + .5) * 64; g.userData.cz = (cz + .5) * 64;
    if (c.L.length) g.add(new THREE.Mesh(mergeGeometries(c.L, false), lam));
    if (c.G.length) { g.add(new THREE.Mesh(mergeGeometries(c.G, false), bas)); glow += c.G.length; }
    group.add(g);
  }
  return { group, glow };
}
