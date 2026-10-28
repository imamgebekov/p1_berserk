// Второй этаж (2026-10-21, просьба владельца): у больших домов — отдельный уровень «наверху», над тем же местом мира.
// Внизу вдоль боковой стены — обычная лестница со ступенями (переход вверх у её подножия), наверху — проём лестницы (переход вниз).
// Этаж устроен как подземелье без врагов: своя карта (одна комната по полу дома), сундуки, туман войны. Чистая логика.
import { makeLevelMap } from './map.js';

export const floorId = b => 'up:' + b.id;
export const isFloor = id => typeof id === 'string' && id.startsWith('up:');
const SIDE = { e: [1, 0], w: [-1, 0], s: [0, 1], n: [0, -1] };

// лестница дома b: вдоль боковой стены от угла у двери вглубь дома; поднимается к углу у двери
// rect — где стоит (твёрдая внизу, проём наверху), foot — у подножия (переход вверх), top — у верха (прибытие наверх)
export function stairOf(b, F) {
  const [dx, dz] = SIDE[b.door.side], vert = !!dx, run = F.run, wd = F.width, pad = .3;
  if (vert) {     // дверь в восточной или западной стене: лестница вдоль северной стены, по x
    const xs = dx > 0 ? b.ix1 - pad : b.ix0 + pad, xe = xs - dx * run, z0 = b.iz0, z1 = b.iz0 + wd;
    return { rect: { x0: Math.min(xs, xe), x1: Math.max(xs, xe), z0, z1 }, up: [dx, 0], foot: { x: xe - dx * .7, z: z0 + wd / 2 }, top: { x: xs - dx * .5, z: z1 + .8 }, h: F.h };
  }
  const zs = dz > 0 ? b.iz1 - pad : b.iz0 + pad, ze = zs - dz * run, x0 = b.ix0, x1 = b.ix0 + wd;     // дверь в южной или северной: вдоль западной стены, по z
  return { rect: { x0, x1, z0: Math.min(zs, ze), z1: Math.max(zs, ze) }, up: [0, dz], foot: { x: x0 + wd / 2, z: ze - dz * .7 }, top: { x: x1 + .8, z: zs - dz * .5 }, h: F.h };
}
export const fits = (b, F) => F.kinds.includes(b.kind) && b.ix1 - b.ix0 >= F.minW && b.iz1 - b.iz0 >= F.minD;

// уровни этажей для карты поверхности: [{ b, def, stair }]; level — уровень места (для добычи сундуков)
export function floorsOf(cfg, map, levelOf) {
  const F = cfg.map.floors; if (!F || !F.on) return [];
  const out = [];
  for (const b of map.buildings) {
    if (b.deco || !fits(b, F)) continue;     // у домов-декораций второго этажа нет
    const st = stairOf(b, F), r = st.rect, cx = (b.ix0 + b.ix1) / 2, cz = (b.iz0 + b.iz1) / 2;
    // сундуки наверху — в углах, дальних от проёма лестницы
    const cs = [[b.ix0 + .8, b.iz0 + .8], [b.ix1 - .8, b.iz0 + .8], [b.ix0 + .8, b.iz1 - .8], [b.ix1 - .8, b.iz1 - .8]].filter(([x, z]) => x < r.x0 - .6 || x > r.x1 + .6 || z < r.z0 - .6 || z > r.z1 + .6)
      .sort((p, q) => Math.hypot(q[0] - st.top.x, q[1] - st.top.z) - Math.hypot(p[0] - st.top.x, p[1] - st.top.z));
    const n = 1 + (b.id % 2), chests = cs.slice(0, n).map(([x, z], i) => ({ kind: F.chests[(b.id + i) % F.chests.length], x, z }));
    const def = { id: floorId(b), name: 'Второй этаж', floor: true, house: b.id, level: levelOf ? Math.round(levelOf(cx, cz)) : 1, depth: 0, danger: 0, foes: [], spawns: [],
      rooms: [{ id: 'f', x: cx, z: cz, w: b.ix1 - b.ix0, d: b.iz1 - b.iz0, corr: false }], chests, exit: { x: st.top.x, z: st.top.z }, back: st.foot };
    out.push({ b, def, stair: st });
  }
  return out;
}
// карта этажа: комната дома, проём лестницы — провал (туда не шагнуть), переход вниз — у верха лестницы
export function floorMap(cfg, f) {
  const M = makeLevelMap(cfg, f.def), r = f.stair.rect;
  M.blocks.push({ ...r, pit: true, stairwell: true }); (M.pits = M.pits || []).push({ ...r, stairwell: true });
  M.portals = [{ x: f.stair.top.x, z: f.stair.top.z, to: 'surface', tx: f.stair.foot.x, tz: f.stair.foot.z, up: false, stair: true, down: true }];
  M.floor = true; M.house = f.b.id; M.stair = f.stair;
  return M;
}
