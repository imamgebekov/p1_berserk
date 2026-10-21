// Дома для рендера: стены (опускаются, когда герой внутри), пол, обстановка, окна, крыша (тает, когда герой внутри).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pushBox, paint } from './models.js';
import { furnish } from './furniture.js';
import { paintMat } from './paint3d.js';

const WALL = ['#5a463a', '#654d3f', '#50403a', '#5d4a3e'];
const ROOF = ['#6a2428', '#5e2124', '#74292c'];

// двускатная крыша (2026-10-18): трёхгранная призма длиной len, шириной dep, высотой h; конёк вдоль x (alongX) или z
function pushGable(list, len, dep, h, x, y, z, alongX, color) {
  let g = new THREE.CylinderGeometry(1, 1, len, 3, 1, false, Math.PI / 2);
  g.rotateZ(Math.PI / 2); g.translate(0, .5, 0); g.scale(1, h / 1.5, dep / 2 / .866);
  if (!alongX) g.rotateY(Math.PI / 2);
  g.translate(x, y, z); g = g.toNonIndexed(); g.computeVertexNormals(); paint(g, color); list.push(g);
}
const flat = list => list.map(g => (g.index ? g.toNonIndexed() : g));     // призмы без индекса — коробки тоже, чтобы слить в один меш
const STRAW = '#a88a4a', BEAM = '#2a1d16', SOOT = ['#3a302a', '#40342c', '#352c26'];

export function buildTown(map, cfg, rnd) {
  const M = cfg.map, H = M.wallH, t = M.wall, hw = M.doorW / 2;
  const group = new THREE.Group();
  const lamb = (vertexColors, kind) => paintMat(new THREE.MeshLambertMaterial({ vertexColors }), kind);
  const merged = list => mergeGeometries(list, false);
  const items = [];

  // общий свет внутри: переезжает в дом, где стоит герой (число источников света не меняется — шейдеры не перекомпилируются)
  const light = new THREE.PointLight('#ffb060', 0, 13, 1.5); light.position.set(0, 2.2, 0); group.add(light);

  for (const b of map.buildings) {
    const wallL = [], winL = Object.assign([], { glow: true }), floorL = [], roofL = [], glowL = Object.assign([], { glow: true });     // окна и свечение — без градиента (шаг 7)
    const pick = a => a[(rnd() * a.length) | 0], ruin = !!b.city && rnd() < .45, tall = !!b.city && !ruin;     // павший город: часть домов разрушена, целые — в два этажа
    // стены; у жилых — фахверк: тёмные балки поясом
    for (const w of b.walls) {
      const cx = (w.x0 + w.x1) / 2, cz = (w.z0 + w.z1) / 2, sx = w.x1 - w.x0, sz = w.z1 - w.z0;
      pushBox(wallL, sx, H, sz, cx, H / 2, cz, 0, 0, 0, ruin ? pick(SOOT) : pick(WALL));
      if (b.kind !== 'hut' && Math.max(sx, sz) > 1) pushBox(wallL, sx + .08, .14, sz + .08, cx, H * .58, cz, 0, 0, 0, BEAM);
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
    // угловые столбы (фахверк) — у всех, кроме изб
    if (b.kind !== 'hut') for (const [x, z] of [[b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1]]) pushBox(wallL, .26, H, .26, x + (x < b.x ? .1 : -.1), H / 2, z + (z < b.z ? .1 : -.1), 0, 0, 0, BEAM);
    // крыша (2026-10-18): двускатная, конёк вдоль длинной стороны; изба — солома; городской дом — второй этаж с выносом; разрушенный — полкрыши и балки
    const ov = .45, alongX = b.w >= b.d, len = (alongX ? b.w : b.d) + ov * 2, dep = (alongX ? b.d : b.w) + ov * 2;
    const RF = cfg.shapes && cfg.shapes.roof, rc = new THREE.Color(b.kind === 'hut' ? STRAW : ruin ? '#3a2a24' : pick(RF ? RF.colors : ROOF)), up = k => rc.clone().multiplyScalar(1 + ((RF ? RF.top : 1) - 1) * k);     // шаг 7: один цвет на дом, верх светлее
    let y0 = H;
    if (tall) { const U = 2.2; pushBox(roofL, b.w + .5, U, b.d + .5, b.x, H + U / 2, b.z, 0, 0, 0, pick(WALL)); pushBox(roofL, b.w + .6, .16, b.d + .6, b.x, H + .08, b.z, 0, 0, 0, BEAM);
      for (const [x, z] of [[b.x0 - .25, b.z0 - .25], [b.x1 + .25, b.z0 - .25], [b.x0 - .25, b.z1 + .25], [b.x1 + .25, b.z1 + .25]]) pushBox(roofL, .24, U, .24, x, H + U / 2, z, 0, 0, 0, BEAM);
      for (const s of [-1, 1]) pushBox(roofL, alongX ? .9 : .08, .8, alongX ? .08 : .9, b.x + (alongX ? s * b.w * .25 : s * (b.w / 2 + .27)), H + 1.2, b.z + (alongX ? s * (b.d / 2 + .27) : s * b.d * .25), 0, 0, 0, '#c88a3c');     // окна второго этажа
      y0 = H + U; }
    const rh = Math.min(3.4, dep * .5);     // скат около 45°: сверху видны оба ската
    if (ruin) { pushGable(roofL, len * .5, dep, rh, b.x - (alongX ? len * .25 : 0), y0, b.z - (alongX ? 0 : len * .25), alongX, up(0));
      for (let i = 0; i < 3; i++) { const k = (i + 1) / 4 - .5; pushBox(roofL, alongX ? .18 : dep * .8, .18, alongX ? dep * .8 : .18, b.x + (alongX ? k * len * .6 + len * .2 : 0), y0 + .3, b.z + (alongX ? 0 : k * len * .6 + len * .2), alongX ? 0 : .3 * (i - 1), 0, alongX ? .3 * (i - 1) : 0, BEAM); }     // голые стропила
      for (let i = 0; i < 4; i++) { const a = rnd() * 6.283, r = Math.max(b.w, b.d) / 2 + .8 + rnd(); pushBox(floorL, .7 + rnd() * .8, .3 + rnd() * .4, .6 + rnd() * .7, b.x + Math.cos(a) * r, .2, b.z + Math.sin(a) * r, 0, rnd() * 3, 0, rnd() < .5 ? '#4a4038' : '#3a2c22'); } }     // завал у стен
    else { pushGable(roofL, len, dep, rh, b.x, y0, b.z, alongX, up(.3)); pushBox(roofL, alongX ? len : .22, .2, alongX ? .22 : len, b.x, y0 + rh + .02, b.z, 0, 0, 0, b.kind === 'hut' ? '#7a6234' : BEAM); }     // конёк

    const walls = new THREE.Group();
    walls.add(new THREE.Mesh(merged(wallL), lamb(true)));
    if (winL.length) walls.add(new THREE.Mesh(merged(winL), new THREE.MeshBasicMaterial({ vertexColors: true })));
    const floor = new THREE.Mesh(merged(flat(floorL)), lamb(true));
    const roofMat = lamb(true, 'roof'); roofMat.transparent = true;
    const roof = new THREE.Mesh(merged(flat(roofL)), roofMat);
    // дверь: створка на петле, открывается внутрь
    const hinge = new THREE.Group(), pan = new THREE.Mesh(new THREE.BoxGeometry(vert ? .12 : hw * 2 - .05, 2.15, vert ? hw * 2 - .05 : .12), paintMat(new THREE.MeshLambertMaterial({ color: '#5a3d26' }), 'auto', { plank: .2 }));
    pan.position.set(vert ? 0 : hw - .02, 1.08, vert ? hw - .02 : 0);
    hinge.add(pan); hinge.position.set(vert ? d.x : d.x - hw, 0, vert ? d.z - hw : d.z);
    walls.add(hinge);
    const doorDir = { n: -1, s: 1, e: -1, w: 1 }[d.side];
    group.add(walls, floor, roof);
    const glowM = glowL.length ? new THREE.Mesh(merged(glowL), new THREE.MeshBasicMaterial({ vertexColors: true })) : null; if (glowM) group.add(glowM);
    items.push({ b, walls, roof, floor, glow: glowM, a: 1, cut: 1, hinge, doorDir, vert, far: false, ruin, tall });
  }

  // наружный вид KayKit (2026-10-20, выбор владельца): модель по назначению дома, растянута по плану, вход — к двери.
  // Снаружи видна модель; внутри — прежние стены (срез), пол и мебель. Столкновения — прежние стены
  const SHELL = { hut: 'home_A_red', house: 'home_B_red', warehouse: 'lumbermill_red', smithy: 'blacksmith_red', shop: 'market_red', barracks: 'barracks_red', tavern: 'tavern_red', chapel: 'church_red' };
  const NPC_SHELL = { smith: 'blacksmith_red', merchant: 'market_red', captain: 'barracks_red', scribe: 'church_red' };     // библиотека — с виду храм книжников
  const YAW = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 };
  function setShells(lib) {
    const mat = paintMat(new THREE.MeshLambertMaterial({ vertexColors: true }), 'auto', { plank: .2 });
    for (const it of items) {
      const b = it.b, name = it.ruin ? 'destroyed' : (b.npc && NPC_SHELL[b.npc.kind]) || SHELL[b.kind] || 'home_B_red', src = lib[name]; if (!src || it.shell) continue;
      const side = b.door.side, yaw = YAW[side] ?? 0, swap = side === 'e' || side === 'w', W0 = src.userData.w, D0 = src.userData.d;
      const sx = (swap ? b.d : b.w) / W0 * 1.04, sz = (swap ? b.w : b.d) / D0 * 1.04, sy = Math.max(H * 1.25 / src.userData.h, (sx + sz) / 2 * (it.tall ? .95 : .8));
      const g = src.clone(); g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(b.x, 0, b.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), new THREE.Vector3(sx, sy, sz)));
      const c = g.attributes.color; for (let i = 0; i < c.count; i++) { const r = c.getX(i), gg = c.getY(i), bb = c.getZ(i), red = r > gg * 1.6 && r > bb * 1.6; c.setXYZ(i, r * (red ? .55 : .85), gg * (red ? .5 : .85), bb * (red ? .5 : .85)); }     // крыши KayKit темнее (мрачная палитра)
      it.shell = new THREE.Mesh(g, mat); it.shell.visible = !it.far; group.add(it.shell);
    }
  }
  function update(inside, dt, wmap = map) {
    const k = Math.min(1, dt * 9);
    for (const it of items) {
      if (it.far) { if (it.shell) it.shell.visible = false; continue; }                                          // дальний дом (C3b) — скрыт, не обновляем
      const on = it.b.id === inside;
      it.a += ((on ? 0 : 1) - it.a) * k;
      it.cut += ((on ? M.cutH : 1) - it.cut) * k;
      if (it.shell) { const out = it.a > .5; it.shell.visible = out; it.walls.visible = it.floor.visible = !out; if (it.glow) it.glow.visible = !out; it.roof.visible = false; if (!out) { it.walls.scale.y = Math.max(.01, it.cut); const sb0 = wmap.buildings[it.b.id]; it.hinge.rotation.y = sb0.door.open * Math.PI / 2 * it.doorDir; } continue; }     // снаружи — модель, внутри — стены срезом
      it.roof.material.opacity = it.a; it.roof.visible = it.a > .03;
      it.walls.scale.y = Math.max(.01, it.cut);
      const sb = wmap.buildings[it.b.id];
      it.hinge.rotation.y = sb.door.open * Math.PI / 2 * it.doorDir;
    }
    const cur = inside >= 0 ? map.buildings[inside] : null;
    if (cur) light.position.set(cur.x, 2.4, cur.z);
    light.intensity += ((cur ? 26 : 0) - light.intensity) * k;
  }
  return { group, update, items, light, setShells };
}
