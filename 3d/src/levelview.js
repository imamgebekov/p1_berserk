// Вид уровней: подземелье (пол, низкие стены, лестница наверх, факелы) и люки на поверхности. Только графика.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildContainers } from './containers.js';
import { roomAt } from './map.js';
import { paintMat, paintOn } from './paint3d.js';
import { buildDecor } from './decor.js';
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

export function buildLevelView(L, cfg) {
  const M = L.map, D = cfg.dungeons, group = new THREE.Group();
  // пол: по прямоугольнику на комнату, с лёгкой «плиткой» из полос
  const floor = [], seams = [];
  for (const r of M.rooms) {
    const w = r.x1 - r.x0, d = r.z1 - r.z0, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    floor.push(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(cx, 0, cz));
    for (let x = r.x0 + 1.5; x < r.x1; x += 1.5) seams.push(box(.05, .01, d, x, .005, cz));
    for (let z = r.z0 + 1.5; z < r.z1; z += 1.5) seams.push(box(w, .01, .05, cx, .005, z));
  }
  group.add(new THREE.Mesh(mergeGeometries(floor), mat('#2c2622', 'masonry')));
  if (seams.length && !paintOn()) group.add(new THREE.Mesh(mergeGeometries(seams), mat('#1a1614')));     // с материалами плиты рисует шейдер
  // стены одним мешем; сверху тёмный «срез», чтобы читалась толщина
  const walls = M.blocks.map(w => box(w.x1 - w.x0, D.wallH, w.z1 - w.z0, (w.x0 + w.x1) / 2, D.wallH / 2, (w.z0 + w.z1) / 2));
  group.add(new THREE.Mesh(mergeGeometries(walls), mat('#4a4038', 'masonry')));
  const caps = M.blocks.map(w => box(w.x1 - w.x0, .04, w.z1 - w.z0, (w.x0 + w.x1) / 2, D.wallH + .02, (w.z0 + w.z1) / 2));
  group.add(new THREE.Mesh(mergeGeometries(caps), new THREE.MeshBasicMaterial({ color: '#141010' })));
  // факелы на сплошных стенах комнат (не в проходах и не на ближней к камере стене; без источников света — свет даёт фонарь героя)
  const torches = [], flames = [], open = (x, z) => M.links.some(l => (l.vert ? Math.abs(x - l.line) < .2 && z > l.s0 - .6 && z < l.s1 + .6 : Math.abs(z - l.line) < .2 && x > l.s0 - .6 && x < l.s1 + .6));
  for (const r of M.rooms) if (!r.corridor) for (const [x, z, ex, ez] of [[r.x0, (r.z0 + r.z1) / 2, .12, 0], [r.x1, (r.z0 + r.z1) / 2, -.12, 0], [(r.x0 + r.x1) / 2, r.z0, 0, .12]]) {
    if (open(x, z)) continue;
    torches.push(box(.1, .5, .1, x + ex, D.wallH * .55, z + ez)); flames.push(box(.16, .2, .16, x + ex, D.wallH * .55 + .32, z + ez));
  }
  if (torches.length) group.add(new THREE.Mesh(mergeGeometries(torches), mat('#3a2a1a')));
  { const salt = [...String(M.level || '')].reduce((h, ch) => Math.imul(h, 31) + ch.charCodeAt(0) | 0, 7), det = dungeonDetails(M, cfg, salt);     // детали подземелья (T5)
    if (det.length) group.add(buildDecor({ decor: det }, null, null).group); }
  const fl = flames.length ? new THREE.Mesh(mergeGeometries(flames), new THREE.MeshBasicMaterial({ color: '#ffb050' })) : null; if (fl) group.add(fl);
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
  const group = new THREE.Group(), conts = buildContainers(L.map, Y); group.add(conts.group);
  for (const q of L.map.portals) group.add(makeHatch(q));
  return { group, conts, flame: null };
}
