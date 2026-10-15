// Облик контейнеров и вещей на земле. Контейнер светится цветом лучшей вещи внутри — видно, стоит ли тратить ключ.
import * as THREE from 'three';
import { RARITY, BY_ID } from './data/items.js';
import { CONTAINERS } from './data/loot.js';

const mats = new Map(), geos = new Map();
const mat = c => { let m = mats.get(c); if (!m) mats.set(c, m = new THREE.MeshLambertMaterial({ color: c })); return m; };
const bm = c => { const k = 'b' + c; let m = mats.get(k); if (!m) mats.set(k, m = new THREE.MeshBasicMaterial({ color: c })); return m; };
const geo = (w, h, d) => { const k = w + ',' + h + ',' + d; let g = geos.get(k); if (!g) geos.set(k, g = new THREE.BoxGeometry(w, h, d)); return g; };
const B = (g, w, h, d, c, x, y, z, basic) => { const m = new THREE.Mesh(geo(w, h, d), basic ? bm(c) : mat(c)); m.position.set(x, y, z); g.add(m); return m; };

// каждый вид: функция, рисующая тело в группе g; вернуть крышку (группу), если она откидывается
const SHAPES = {
  crate: g => { B(g, .8, .7, .8, '#6b4a2c', 0, .35, 0); B(g, .84, .08, .84, '#4a3220', 0, .55, 0); B(g, .84, .08, .84, '#4a3220', 0, .15, 0); },
  barrel: g => { B(g, .7, .9, .7, '#5a3d26', 0, .45, 0); B(g, .75, .07, .75, '#2a2220', 0, .22, 0); B(g, .75, .07, .75, '#2a2220', 0, .68, 0); },
  sack: g => { B(g, .72, .55, .6, '#8a7a5a', 0, .28, 0); B(g, .3, .22, .3, '#7a6a4a', 0, .66, 0); },
  chest: g => chestBody(g, '#5a3a22', '#2a1c12', '#8a6a3a'),
  ironchest: g => chestBody(g, '#3a3632', '#1e1c1a', '#8a8478'),
  locked: g => { const l = chestBody(g, '#34302d', '#1a1816', '#7a746a'); B(g, .16, .2, .08, '#c4161c', 0, .5, .36); return l; },
  coffer: g => { B(g, .62, .3, .44, '#6a4a2a', 0, .15, 0); B(g, .64, .05, .46, '#c8a24a', 0, .3, 0); const l = new THREE.Group(); l.position.set(0, .32, -.22); B(l, .62, .12, .44, '#7a5a34', 0, .06, .22); B(l, .12, .08, .04, '#c8a24a', 0, .06, .46); g.add(l); return l; },
  wardrobe: g => { B(g, 1.0, 1.9, .6, '#4a3322', 0, .95, 0); B(g, .02, 1.7, .02, '#1a120c', 0, .95, .31); B(g, .08, .16, .04, '#c8a24a', -.08, .95, .32); B(g, .08, .16, .04, '#c8a24a', .08, .95, .32); },
  rack: g => { B(g, 1.6, .1, .3, '#4a3322', 0, 1.2, 0); B(g, 1.6, .1, .3, '#4a3322', 0, .5, 0); B(g, .1, 1.4, .3, '#3a281a', -.8, .7, 0); B(g, .1, 1.4, .3, '#3a281a', .8, .7, 0); for (const x of [-.5, 0, .5]) { B(g, .07, 1.1, .05, '#a8a294', x, .95, .1); B(g, .3, .06, .06, '#5a4a30', x, .55, .1); } },
  armorstand: g => { B(g, .12, 1.5, .12, '#3a281a', 0, .75, 0); B(g, .7, .7, .38, '#6a6258', 0, 1.2, 0); B(g, .4, .36, .4, '#7a7468', 0, 1.7, 0); B(g, .9, .1, .12, '#3a281a', 0, 1.45, 0); B(g, .5, .08, .5, '#3a281a', 0, .04, 0); },
  medchest: g => { B(g, .8, .5, .55, '#b8b0a0', 0, .25, 0); B(g, .4, .08, .1, '#a1121f', 0, .53, 0); B(g, .1, .08, .4, '#a1121f', 0, .53, 0); },
  smithchest: g => { B(g, .9, .55, .6, '#3a3633', 0, .28, 0); B(g, .5, .06, .3, '#e0602a', 0, .58, 0, true); B(g, .94, .08, .64, '#6a645c', 0, .08, 0); },
  shelf: g => { B(g, 1.3, 1.7, .4, '#4a3322', 0, .85, 0); const cols = ['#6a2a2a', '#2a3a5a', '#5a4a2a', '#3a5a3a', '#4a2a4a']; for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) B(g, .14, .34, .24, cols[(r * 6 + i) % 5], -.52 + i * .2, .45 + r * .5, .1); },
  corpse: g => { B(g, .5, .22, 1.0, '#3e342e', 0, .12, 0); B(g, .28, .26, .28, '#b8a283', 0, .16, .64); B(g, .14, .1, .6, '#2a2420', .36, .08, .1); B(g, .14, .1, .6, '#2a2420', -.36, .08, -.1); B(g, .5, .1, .5, '#5a1a1a', 0, .02, .1); },
  grave: g => { B(g, .8, .2, 1.6, '#2a2018', 0, .1, 0); B(g, .62, .95, .16, '#6a665e', 0, .55, -.9); B(g, .22, .16, .2, '#6a665e', 0, 1.08, -.9); },
  altar: g => { B(g, 1.2, .8, .7, '#4a4640', 0, .4, 0); B(g, 1.4, .12, .9, '#5a564e', 0, .86, 0); B(g, .1, .3, .1, '#d8d0b8', -.5, 1.08, 0); B(g, .1, .3, .1, '#d8d0b8', .5, 1.08, 0); B(g, .08, .1, .08, '#ffb040', -.5, 1.28, 0, true); B(g, .08, .1, .08, '#ffb040', .5, 1.28, 0, true); B(g, .5, .06, .3, '#8a1018', 0, .92, 0); },
  cache: g => { B(g, .9, .14, .9, '#2a1f16', 0, .07, 0); B(g, .7, .05, .2, '#5a4028', .1, .17, .1); B(g, .6, .05, .18, '#4a3420', -.1, .2, -.15); },
  wagon: g => { B(g, 2, .3, 1, '#5a3d26', 0, .75, 0); B(g, 2, .3, .08, '#4a3220', 0, 1.0, .5); B(g, 2, .3, .08, '#4a3220', 0, 1.0, -.5); B(g, .12, .8, .8, '#2a1c12', -.8, .4, .55); B(g, .12, .8, .8, '#2a1c12', .8, .4, .55); B(g, .12, .8, .8, '#2a1c12', -.8, .4, -.55); B(g, .12, .8, .8, '#2a1c12', .8, .4, -.55); B(g, .6, .5, .6, '#6b4a2c', -.4, 1.1, 0); B(g, .5, .4, .5, '#8a7a5a', .4, 1.05, 0); }
};
function chestBody(g, base, band, trim) {
  B(g, .95, .48, .66, base, 0, .24, 0); B(g, .98, .08, .7, band, 0, .12, 0); B(g, .1, .52, .7, band, -.3, .26, 0); B(g, .1, .52, .7, band, .3, .26, 0);
  const l = new THREE.Group(); l.position.set(0, .48, -.33); B(l, .98, .18, .7, base, 0, .09, .33); B(l, .1, .2, .72, band, -.3, .1, .33); B(l, .1, .2, .72, band, .3, .1, .33); B(l, .12, .1, .04, trim, 0, .0, .7); g.add(l); return l;
}

export function buildContainers(map) {
  const group = new THREE.Group(), items = [];
  const gemGeo = new THREE.OctahedronGeometry(.16);
  for (const c of map.containers) {
    const g = new THREE.Group(); g.position.set(c.x, 0, c.z);
    // повернуть лицом к центру деревни (костру), чтобы замок и крышка смотрели на игрока
    g.rotation.y = Math.atan2(-c.x, -c.z) + (c.b >= 0 ? 0 : 0);
    const lid = (SHAPES[c.kind] || SHAPES.crate)(g) || null;
    const gem = new THREE.Mesh(gemGeo, new THREE.MeshBasicMaterial({ color: '#fff' })); gem.position.set(0, 1.5, 0); gem.rotation.y = 0;
    const beam = new THREE.Mesh(geo(.05, 1.2, .05), new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: .35, depthWrite: false })); beam.position.y = .9;
    g.add(gem, beam); group.add(g);
    items.push({ c, g, lid, gem, beam, last: '' });
  }
  const dropGeo = new THREE.OctahedronGeometry(.2), dropPool = [];
  function update(W, t) {
    for (const it of items) {
      const c = it.c, ready = c.ready;
      it.gem.visible = it.beam.visible = ready;
      if (it.lid) it.lid.rotation.x = ready && !c.locked ? 0 : (ready ? 0 : -1.15);
      if (ready) {
        const key = c.items.map(i => i.id + i.n).join() + c.locked;
        if (key !== it.last) { it.last = key; let best = 0; for (const i of c.items) best = Math.max(best, BY_ID[i.id].rar); const col = c.locked ? '#d63030' : RARITY[best].color; it.gem.material.color.set(col); it.beam.material.color.set(col); it.beam.visible = best >= 1 || c.locked; }
        it.gem.position.y = 1.5 + Math.sin(t * 3 + c.id) * .08; it.gem.rotation.y = t * 2;
      }
    }
    // вещи на земле
    const dr = W.drops;
    // ромб цвета редкости; от редкого и выше — столб света, выше и ярче с редкостью; только что выпавшее подпрыгивает «фонтаном»
    while (dropPool.length < dr.length) {
      const m = new THREE.Mesh(dropGeo, new THREE.MeshBasicMaterial({ color: '#fff' })), beam = new THREE.Mesh(geo(.09, 1, .09), new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: .45, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.userData.beam = beam; group.add(m, beam); dropPool.push(m);
    }
    for (let i = 0; i < dropPool.length; i++) {
      const m = dropPool[i], q = dr[i], beam = m.userData.beam;
      if (!q) { m.visible = beam.visible = false; continue; }
      const rar = BY_ID[q.id].rar, hop = q.t < .45 ? Math.sin(q.t / .45 * Math.PI) * 1.3 : 0;
      m.visible = true; m.position.set(q.x, .45 + hop + Math.sin(t * 4 + i) * .08, q.z); m.rotation.y = t * 2.5;
      const col = RARITY[rar].color; if (m.userData.col !== col) { m.userData.col = col; m.material.color.set(col); beam.material.color.set(col); }
      const blink = q.t > W.cfg.gear.dropLife - 8 ? .6 + .4 * Math.abs(Math.sin(t * 12)) : 1;
      m.scale.setScalar((1 + rar * .18) * blink);
      beam.visible = rar >= 2; if (beam.visible) { const h = 1.6 + rar * 1.1; beam.scale.set(1 + rar * .4, h, 1 + rar * .4); beam.position.set(q.x, h / 2, q.z); beam.material.opacity = (.25 + .1 * rar) * (.75 + .25 * Math.sin(t * 5 + i)) * blink; }
    }
  }
  return { group, update, items };
}
