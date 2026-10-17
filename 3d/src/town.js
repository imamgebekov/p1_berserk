// Дома для рендера: стены (опускаются, когда герой внутри), пол, обстановка, окна, крыша (тает, когда герой внутри).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pushBox } from './models.js';
import { furnish } from './furniture.js';

const WALL = ['#5a463a', '#654d3f', '#50403a', '#5d4a3e'];
const ROOF = ['#6a2428', '#5e2124', '#74292c'];

export function buildTown(map, cfg, rnd) {
  const M = cfg.map, H = M.wallH, t = M.wall, hw = M.doorW / 2;
  const group = new THREE.Group();
  const lamb = vertexColors => new THREE.MeshLambertMaterial({ vertexColors });
  const merged = list => mergeGeometries(list, false);
  const items = [];

  // общий свет внутри: переезжает в дом, где стоит герой (число источников света не меняется — шейдеры не перекомпилируются)
  const light = new THREE.PointLight('#ffb060', 0, 13, 1.5); light.position.set(0, 2.2, 0); group.add(light);

  for (const b of map.buildings) {
    const wallL = [], winL = Object.assign([], { glow: true }), floorL = [], roofL = [], glowL = Object.assign([], { glow: true });     // окна и свечение — без градиента (шаг 7)
    const pick = a => a[(rnd() * a.length) | 0];
    // стены
    for (const w of b.walls) {
      const cx = (w.x0 + w.x1) / 2, cz = (w.z0 + w.z1) / 2, sx = w.x1 - w.x0, sz = w.z1 - w.z0;
      pushBox(wallL, sx, H, sz, cx, H / 2, cz, 0, 0, 0, pick(WALL));
      pushBox(wallL, sx + .06, .35, sz + .06, cx, .17, cz, 0, 0, 0, '#241a16');            // каменный цоколь
      const horiz = sx >= sz, len = horiz ? sx : sz;
      if (len > 2.8 && rnd() < .8) {                                                       // окно
        const wx = horiz ? cx + (rnd() - .5) * (len - 2.4) : cx, wz = horiz ? cz : cz + (rnd() - .5) * (len - 2.4);
        pushBox(winL, horiz ? 1 : sx + .08, .9, horiz ? sz + .08 : 1, wx, 1.55, wz, 0, 0, 0, '#e89a3c');
        pushBox(wallL, horiz ? 1.2 : sx + .12, .1, horiz ? sz + .12 : 1.2, wx, 2.05, wz, 0, 0, 0, '#1c1411');   // ставень
      }
    }
    // дверной проём: косяки и притолока
    const d = b.door, vert = d.side === 'e' || d.side === 'w';
    const pe = vert ? [t, hw * 2 + .3] : [hw * 2 + .3, t];
    pushBox(wallL, pe[0], H - 2.2, pe[1], d.x, 2.2 + (H - 2.2) / 2, d.z, 0, 0, 0, '#2a1d16');
    for (const sgn of [-1, 1]) pushBox(wallL, vert ? t + .06 : .22, 2.2, vert ? .22 : t + .06, d.x + (vert ? 0 : sgn * hw), 1.1, d.z + (vert ? sgn * hw : 0), 0, 0, 0, '#2a1d16');
    // пол из досок
    const iw = b.ix1 - b.ix0, id = b.iz1 - b.iz0, n = Math.ceil(id / .6);
    for (let i = 0; i < n; i++) { const z = b.iz0 + (i + .5) * id / n; pushBox(floorL, iw, .08, id / n - .03, b.x, .04, z, 0, 0, 0, i % 2 ? '#3a2819' : '#33231a'); }
    furnish(b, floorL, glowL, rnd);
    // крыша: ступенчатая, чуть шире дома
    const ov = .45;
    const RF = cfg.shapes && cfg.shapes.roof, rc = new THREE.Color(pick(RF ? RF.colors : ROOF)), up = k => rc.clone().multiplyScalar(1 + ((RF ? RF.top : 1) - 1) * k);     // шаг 7: один цвет на дом, верх светлее
    pushBox(roofL, b.w + ov * 2, .3, b.d + ov * 2, b.x, H + .15, b.z, 0, 0, 0, up(0));
    pushBox(roofL, b.w * .72, .3, b.d + ov * 1.4, b.x, H + .45, b.z, 0, 0, 0, up(.5));
    pushBox(roofL, b.w * .4, .3, b.d + ov, b.x, H + .75, b.z, 0, 0, 0, up(1));

    const walls = new THREE.Group();
    walls.add(new THREE.Mesh(merged(wallL), lamb(true)));
    if (winL.length) walls.add(new THREE.Mesh(merged(winL), new THREE.MeshBasicMaterial({ vertexColors: true })));
    const floor = new THREE.Mesh(merged(floorL), lamb(true));
    const roofMat = lamb(true); roofMat.transparent = true;
    const roof = new THREE.Mesh(merged(roofL), roofMat);
    // дверь: створка на петле, открывается внутрь
    const hinge = new THREE.Group(), pan = new THREE.Mesh(new THREE.BoxGeometry(vert ? .12 : hw * 2 - .05, 2.15, vert ? hw * 2 - .05 : .12), new THREE.MeshLambertMaterial({ color: '#5a3d26' }));
    pan.position.set(vert ? 0 : hw - .02, 1.08, vert ? hw - .02 : 0);
    hinge.add(pan); hinge.position.set(vert ? d.x : d.x - hw, 0, vert ? d.z - hw : d.z);
    walls.add(hinge);
    const doorDir = { n: -1, s: 1, e: -1, w: 1 }[d.side];
    group.add(walls, floor, roof);
    const glowM = glowL.length ? new THREE.Mesh(merged(glowL), new THREE.MeshBasicMaterial({ vertexColors: true })) : null; if (glowM) group.add(glowM);
    items.push({ b, walls, roof, floor, glow: glowM, a: 1, cut: 1, hinge, doorDir, vert, far: false });
  }

  function update(inside, dt, wmap = map) {
    const k = Math.min(1, dt * 9);
    for (const it of items) {
      if (it.far) continue;                                          // дальний дом (C3b) — скрыт, не обновляем
      const on = it.b.id === inside;
      it.a += ((on ? 0 : 1) - it.a) * k;
      it.cut += ((on ? M.cutH : 1) - it.cut) * k;
      it.roof.material.opacity = it.a; it.roof.visible = it.a > .03;
      it.walls.scale.y = Math.max(.01, it.cut);
      const sb = wmap.buildings[it.b.id];
      it.hinge.rotation.y = sb.door.open * Math.PI / 2 * it.doorDir;
    }
    const cur = inside >= 0 ? map.buildings[inside] : null;
    if (cur) light.position.set(cur.x, 2.4, cur.z);
    light.intensity += ((cur ? 26 : 0) - light.intensity) * k;
  }
  return { group, update, items, light };
}
