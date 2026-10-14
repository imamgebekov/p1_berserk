// Карта: дома, стены, двери. Чистая геометрия без графики (тестируется в Node).
// Стены — прямоугольники (AABB); герой и враги — круги, которые выталкиваются из стен и скользят вдоль них.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const vertDoor = side => side === 'e' || side === 'w';

export function makeMap(cfg) {
  const M = cfg.map, t = M.wall, hw = M.doorW / 2;
  const buildings = [], walls = [], containers = [];
  const addC = (kind, x, z, bid) => containers.push({ id: containers.length, kind, x, z, b: bid, ready: false, t: 0, items: [], locked: false, keyTier: 0 });
  M.buildings.forEach((b, id) => {
    const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, z0 = b.z - b.d / 2, z1 = b.z + b.d / 2;
    const off = b.off || 0;
    // дверь: центр проёма, точки «снаружи» и «внутри» для ходьбы врагов, ось стены
    const door = { open: 0, rect: null, side: b.door, x: 0, z: 0, out: { x: 0, z: 0 }, in: { x: 0, z: 0 } };
    const dx = b.door === 'e' ? 1 : b.door === 'w' ? -1 : 0, dz = b.door === 's' ? 1 : b.door === 'n' ? -1 : 0;
    door.x = b.x + dx * b.w / 2 + (dz ? off : 0); door.z = b.z + dz * b.d / 2 + (dx ? off : 0);
    door.out = { x: door.x + dx * 1.7, z: door.z + dz * 1.7 };
    door.in = { x: door.x - dx * 1.7, z: door.z - dz * 1.7 };
    door.rect = vertDoor(b.door) ? { x0: b.door === 'e' ? x1 - t : x0, x1: b.door === 'e' ? x1 : x0 + t, z0: door.z - hw, z1: door.z + hw }
      : { x0: door.x - hw, x1: door.x + hw, z0: b.door === 's' ? z1 - t : z0, z1: b.door === 's' ? z1 : z0 + t };
    const bw = [];
    // стены по x (север/юг) с вырезом под дверь
    const hSeg = (z, zz, side) => {
      if (b.door === side) { const c = b.x + off; bw.push({ x0, x1: c - hw, z0: z, z1: zz }, { x0: c + hw, x1, z0: z, z1: zz }); }
      else bw.push({ x0, x1, z0: z, z1: zz });
    };
    const vSeg = (x, xx, side) => {
      if (b.door === side) { const c = b.z + off; bw.push({ x0: x, x1: xx, z0: z0 + t, z1: c - hw }, { x0: x, x1: xx, z0: c + hw, z1: z1 - t }); }
      else bw.push({ x0: x, x1: xx, z0: z0 + t, z1: z1 - t });
    };
    hSeg(z0, z0 + t, 'n'); hSeg(z1 - t, z1, 's'); vSeg(x0, x0 + t, 'w'); vSeg(x1 - t, x1, 'e');
    const w2 = bw.filter(r => r.x1 - r.x0 > 1e-6 && r.z1 - r.z0 > 1e-6);
    walls.push(...w2);
    buildings.push({ id, x: b.x, z: b.z, w: b.w, d: b.d, x0, x1, z0, z1, ix0: x0 + t, ix1: x1 - t, iz0: z0 + t, iz1: z1 - t, door, walls: w2, kind: b.kind || 'house', chests: [] });
    // контейнеры в углах, дальние от двери — первыми
    const bb = buildings[buildings.length - 1], cs = [[bb.ix0 + .8, bb.iz0 + .8], [bb.ix1 - .8, bb.iz0 + .8], [bb.ix0 + .8, bb.iz1 - .8], [bb.ix1 - .8, bb.iz1 - .8]];
    cs.sort((p, q) => Math.hypot(q[0] - door.x, q[1] - door.z) - Math.hypot(p[0] - door.x, p[1] - door.z));
    (b.chests || []).slice(0, 4).forEach((k, i) => { addC(k, cs[i][0], cs[i][1], id); bb.chests.push(containers[containers.length - 1]); });
  });
  for (const sp of M.spots || []) addC(sp.kind, sp.x, sp.z, -1);
  return { buildings, walls, containers, cfg: M };
}

// какой дом содержит точку (внутри стен), иначе −1
export function insideOf(map, x, z, pad = 0) {
  for (const b of map.buildings) if (x > b.ix0 - pad && x < b.ix1 + pad && z > b.iz0 - pad && z < b.iz1 + pad) return b.id;
  return -1;
}
// точка у здания (с запасом снаружи): для расстановки деревьев и появления врагов
export function nearBuilding(map, x, z, pad) {
  for (const b of map.buildings) if (x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad) return true;
  return false;
}

// вытолкнуть круг (x, z, r) из стен; возвращает true, если сдвинули
export function resolve(map, o, r) {
  let hit = false;
  for (let it = 0; it < 2; it++) {
    for (const b of map.buildings) {
      if (o.x < b.x0 - r || o.x > b.x1 + r || o.z < b.z0 - r || o.z > b.z1 + r) continue;
      const list = b.door.open < .6 ? b.walls.concat(b.door.rect) : b.walls;
      for (const w of list) {
        const cx = clamp(o.x, w.x0, w.x1), cz = clamp(o.z, w.z0, w.z1), dx = o.x - cx, dz = o.z - cz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        hit = true;
        if (d2 > 1e-12) { const d = Math.sqrt(d2), k = (r - d) / d; o.x += dx * k; o.z += dz * k; }
        else {   // центр внутри стены: выходим по наименьшему проникновению
          const l = o.x - w.x0, rr = w.x1 - o.x, tp = o.z - w.z0, bt = w.z1 - o.z, m = Math.min(l, rr, tp, bt);
          if (m === l) o.x = w.x0 - r; else if (m === rr) o.x = w.x1 + r; else if (m === tp) o.z = w.z0 - r; else o.z = w.z1 + r;
        }
      }
    }
  }
  return hit;
}

// сдвиг с шагами не длиннее 0.25: быстрый перекат не пролетает сквозь стену
export function slide(map, o, dx, dz, r) {
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .25));
  for (let i = 0; i < n; i++) { o.x += dx / n; o.z += dz / n; resolve(map, o, r); }
}

// поворот ввода джойстика под угол камеры (экран → мир)
export function rotateInput(mx, mz, yawDeg) {
  const a = yawDeg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return { mx: mx * c + mz * s, mz: -mx * s + mz * c };
}
