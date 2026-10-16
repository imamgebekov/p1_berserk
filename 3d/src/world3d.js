// Мир вокруг домов: дороги, кладбище, ферма, рынок, руины, лагерь, фонари. Чистая геометрия (Node-тесты).
// Результат: decor — список предметов для рендера, solids — круги, о которые спотыкаются, spots — дополнительные контейнеры.

import { campOf, campGates, insideCamp } from './map.js';
import { riverOf, waterDist } from './terrain3d.js';
const TAU = Math.PI * 2;
export function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export function genWorld(cfg, buildings) {
  const M = cfg.map, rnd = mulberry(cfg.world.seed * 31 + 5), R = cfg.world.radius;
  const decor = [], solids = [], spots = [], roads = [];
  const inBuilding = (x, z, pad) => buildings.some(b => x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad);
  const inSolid = (x, z, r) => solids.some(s => Math.hypot(s.x - x, s.z - z) < s.r + r);
  const nearRoad = (x, z, w) => roads.some(([a, b]) => distSeg(x, z, a, b) < w);
  const river = riverOf(cfg), wet = (x, z, pad) => !!river && waterDist(river, x, z) < pad;     // река (C2): декор не в воде
  const free = (x, z, pad) => Math.hypot(x, z) < R - 4 && !inBuilding(x, z, pad) && !inSolid(x, z, pad) && !wet(x, z, pad);
  const doors = buildings.map(b => b.door);
  const blocksDoor = (x, z, r) => doors.some(d => Math.hypot(d.out.x - x, d.out.z - z) < r + 2.4 || Math.hypot(d.x - x, d.z - z) < r + 2.4);
  const put = (t, x, z, extra = {}) => { if (!wet(x, z, .3)) decor.push({ t, x, z, ...extra }); };
  // твёрдый предмет: рисуем и ставим круг-препятствие, но не у двери (дверь всегда должна быть доступна)
  const solid = (t, x, z, r, extra = {}) => { if (blocksDoor(x, z, r) || wet(x, z, r)) return false; put(t, x, z, extra); solids.push({ x, z, r }); return true; };
  const ring = (x, z, r, n, f) => { for (let i = 0; i < n; i++) { const a = rnd() * TAU, d = Math.sqrt(rnd()) * r; f(x + Math.cos(a) * d, z + Math.sin(a) * d, i); } };

  // дороги: от костра к двери каждого здания; к домам за частоколом лагеря — через ближайшие ворота
  const camp = campOf(cfg), gates = camp ? campGates(camp) : [], used = new Set();
  for (const b of buildings) {
    const o = b.door.out;
    if (!camp || insideCamp(camp, o.x, o.z)) { roads.push([{ x: 0, z: 0 }, { x: o.x, z: o.z }]); continue; }
    const g = gates.reduce((a, q) => (Math.hypot(q.x - o.x, q.z - o.z) < Math.hypot(a.x - o.x, a.z - o.z) ? q : a));
    const r = g.a * Math.PI / 180, gx = camp.x + Math.sin(r) * (camp.r + camp.roadOut), gz = camp.z + Math.cos(r) * (camp.r + camp.roadOut);     // из ворот — прямо наружу, потом к дому: дорога не срезает частокол
    if (!used.has(g.a)) { used.add(g.a); roads.push([{ x: 0, z: 0 }, { x: g.x, z: g.z }], [{ x: g.x, z: g.z }, { x: gx, z: gz }]); }
    roads.push([{ x: gx, z: gz }, { x: o.x, z: o.z }]);
  }
  const nearWall = (x, z) => camp && Math.abs(Math.hypot(x - camp.x, z - camp.z) - camp.r) < 2;
  // фонари вдоль дорог через каждые ~11 м (только вблизи центра), не на домах
  for (const [a, b] of roads) {
    const L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.floor(L / 11);
    for (let i = 1; i <= n; i++) {
      const k = i * 11 / L, nx = -(b.z - a.z) / L, nz = (b.x - a.x) / L, x = a.x + (b.x - a.x) * k + nx * 1.8, z = a.z + (b.z - a.z) * k + nz * 1.8;
      if (L > 14 && !inBuilding(x, z, 1.5) && !nearWall(x, z) && !decor.some(d => d.t === 'lamp' && Math.hypot(d.x - x, d.z - z) < 7)) put('lamp', x, z);
    }
  }

  for (const zn of M.zones || []) {
    if (zn.type === 'graveyard') {
      const x0 = zn.x - zn.w / 2, x1 = zn.x + zn.w / 2, z0 = zn.z - zn.d / 2, z1 = zn.z + zn.d / 2;
      // ограда с воротами на юге (к часовне)
      for (let x = x0; x < x1; x += 2) { put('fence', x + 1, z0, { rot: 0, w: 2 }); if (Math.abs(x + 1 - zn.x) > 2.4) put('fence', x + 1, z1, { rot: 0, w: 2 }); }
      for (let z = z0; z < z1; z += 2) { put('fence', x0, z + 1, { rot: 1, w: 2 }); put('fence', x1, z + 1, { rot: 1, w: 2 }); }
      put('gate', zn.x, z1, {});
      // могилы рядами: часть из них — контейнеры
      let g = 0;
      for (let x = x0 + 3; x < x1 - 2; x += 3.2) for (let z = z0 + 3; z < z1 - 3; z += 3.4) {
        const jx = x + (rnd() - .5) * .8, jz = z + (rnd() - .5) * .8;
        if (inBuilding(jx, jz, 1) || (Math.abs(jx - zn.x) < 1.6 && jz > z1 - 5)) continue;
        if (rnd() < .22) { spots.push({ kind: 'grave', x: jx, z: jz + .6 }); put('mound', jx, jz + .6, {}); put('tomb', jx, jz, { rot: (rnd() - .5) * .3, s: .9 + rnd() * .4 }); }
        else if (rnd() < .75) put(rnd() < .35 ? 'cross' : 'tomb', jx, jz, { rot: (rnd() - .5) * .5, s: .8 + rnd() * .5 });
        g++;
      }
      put('dead_tree', x0 + 1.5, z0 + 1.5, { s: 1.4 }); put('dead_tree', x1 - 1.5, z0 + 2, { s: 1.2 });
      solid('mausoleum', zn.x, z0 + 3.2, 2);
      spots.push({ kind: 'altar', x: zn.x, z: z0 + 6.4 });
    }
    if (zn.type === 'farm') {
      const x0 = zn.x - zn.w / 2, x1 = zn.x + zn.w / 2, z0 = zn.z - zn.d / 2, z1 = zn.z + zn.d / 2;
      for (let z = z0 + 2; z < z1 - 1; z += 1.6) if (!inBuilding((x0 + x1) / 2, z, 2)) put('furrow', (x0 + x1) / 2, z, { w: zn.w - 6, rot: 0 });
      for (let x = x0; x < x1; x += 2) { put('fence', x + 1, z0, { rot: 0, w: 2 }); put('fence', x + 1, z1, { rot: 0, w: 2 }); }
      for (let z = z0; z < z1; z += 2) { put('fence', x0, z + 1, { rot: 1, w: 2 }); put('fence', x1, z + 1, { rot: 1, w: 2 }); }
      for (let i = 0; i < 6; i++) { const x = x0 + 3 + rnd() * (zn.w - 6), z = z0 + 3 + rnd() * (zn.d - 6); if (!inBuilding(x, z, 3) && !inSolid(x, z, 2)) solid('haystack', x, z, 1.3, { s: .9 + rnd() * .5 }); }
      solid('scarecrow', zn.x, zn.z, .5);
      spots.push({ kind: 'sack', x: x0 + 3, z: z1 - 3 }, { kind: 'wagon', x: x1 - 4, z: z0 + 3 });
    }
    if (zn.type === 'market') {
      // четыре прилавка по дуге, колодец
      for (let i = 0; i < 4; i++) { const a = -1.4 + i * .8, x = zn.x + Math.cos(a) * zn.r, z = zn.z + Math.sin(a) * zn.r; solid('stall', x, z, 1.2, { rot: a + Math.PI / 2, c: ['#6a2428', '#2e4a5a', '#5a4a24', '#4a2a5a'][i] }); }
      solid('well', zn.x, zn.z, 1.1);
      for (let i = 0; i < 6; i++) ring(zn.x, zn.z, zn.r + 2, 1, (x, z) => { if (free(x, z, 2.5)) put(i % 2 ? 'crate_d' : 'barrel_d', x, z, { rot: rnd() * 3 }); });
    }
    if (zn.type === 'ruins') {
      ring(zn.x, zn.z, zn.r, 9, (x, z) => { if (free(x, z, 1.5)) solid('wallfrag', x, z, .9, { rot: rnd() * 3, s: .7 + rnd() * .9 }); });
      ring(zn.x, zn.z, zn.r + 2, 14, (x, z) => { if (free(x, z, 1)) put('rubble', x, z, { rot: rnd() * 3, s: .5 + rnd() }); });
      spots.push({ kind: 'cache', x: zn.x + 1, z: zn.z - 2 }, { kind: 'corpse', x: zn.x - 3, z: zn.z + 2 }, { kind: 'locked', x: zn.x + 4, z: zn.z + 3 });
    }
    if (zn.type === 'camp') {
      solid('campfire', zn.x, zn.z, .8);
      for (let i = 0; i < 4; i++) { const a = i * 1.6 + .4, x = zn.x + Math.cos(a) * 4.6, z = zn.z + Math.sin(a) * 4.6; solid('tent', x, z, 1.6, { rot: a }); }
      spots.push({ kind: 'ironchest', x: zn.x + 2.2, z: zn.z - 1.6 }, { kind: 'locked', x: zn.x - 2.4, z: zn.z + 1.4 }, { kind: 'rack', x: zn.x, z: zn.z - 6.2 });
    }
  }
  // колодец и бочки у костра, остатки частокола у границы
  solid('well', 6.5, -3.5, 1.1);
  return { decor, solids, spots, roads };
}

function distSeg(x, z, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
  return Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
}
export { distSeg };
