// Детали мира (T5): мелочи у домов и в посёлках, следы боя у опасных мест, свечи, цепи и решётки в подземельях.
// Только вид: список в формате декора, в карту боя (solids, blocks) не попадает; числа — свой генератор от зерна мира,
// поэтому бой, баланс и сохранения не сдвигаются. Числа — cfg.details.
import { mulberry32 } from './sim.js';
import { pathSegs, distSeg } from './world3d.js';
import { waterDist } from './terrain3d.js';
import { roomFree } from './map.js';

const YARD = ['barrel_d', 'crate_d', 'woodpile', 'sack_d', 'bucket'];
const SIGNED = new Set(['shop', 'smithy', 'tavern', 'warehouse']);
const RUG = new Set(['house', 'tavern', 'chapel']);
const BATTLE = ['rusty_sword', 'bones', 'skulls', 'wreck', 'rusty_sword', 'skulls'];

// поверхность: у стен домов (кроме стороны с дверью), вывеска и коврик у двери, следы боя у опасных мест, знамя в посёлке
export function surfaceDetails(map, cfg) {
  const D = cfg.details; if (!D || !D.on) return [];
  const rnd = mulberry32((cfg.world.seed ^ 0x5d37) >>> 0), out = [], segs = pathSegs(map), pick = a => a[(rnd() * a.length) | 0];
  const inB = (x, z, m) => map.buildings.some(b => x > b.x0 - m && x < b.x1 + m && z > b.z0 - m && z < b.z1 + m);
  const free = (x, z, road = D.road) => !segs.some(([a, b]) => distSeg(x, z, a, b) < road) && !(map.river && waterDist(map.river, x, z) < 1.5) && !out.some(o => Math.hypot(o.x - x, o.z - z) < D.gap);
  for (const b of map.buildings) {
    const sides = ['n', 's', 'e', 'w'].filter(s => s !== b.door.side), n = D.house[0] + Math.floor(rnd() * (D.house[1] - D.house[0] + 1));
    for (let i = 0; i < n; i++) {
      const s = pick(sides), along = rnd() - .5, off = .55 + rnd() * .3;
      const x = s === 'e' ? b.x1 + off : s === 'w' ? b.x0 - off : b.x + along * (b.x1 - b.x0 - 1.2);
      const z = s === 's' ? b.z1 + off : s === 'n' ? b.z0 - off : b.z + along * (b.z1 - b.z0 - 1.2);
      if (free(x, z) && !map.buildings.some(o => o !== b && x > o.x0 - .6 && x < o.x1 + .6 && z > o.z0 - .6 && z < o.z1 + .6)) out.push({ t: pick(YARD), x, z, rot: rnd() * Math.PI * 2, detail: true });
    }
    const d = b.door, dx = { e: 1, w: -1 }[d.side] || 0, dz = { s: 1, n: -1 }[d.side] || 0, rot = Math.atan2(dx, dz);
    if (SIGNED.has(b.kind)) { const x = d.x + dx * .9 + dz * 1.5, z = d.z + dz * .9 - dx * 1.5; if (free(x, z, 1)) out.push({ t: 'sign', x, z, rot, kind: b.kind, detail: true }); }
    if (RUG.has(b.kind) && rnd() < D.rug) { const x = d.x + dx * 1.1, z = d.z + dz * 1.1; if (!inB(x, z, .1)) out.push({ t: 'rug', x, z, rot, c: pick(D.rugColors), detail: true }); }
  }
  for (const p of map.cfg.places || []) {
    if (p.type === 'danger') {
      const n = D.danger[0] + Math.floor(rnd() * (D.danger[1] - D.danger[0] + 1));
      for (let i = 0; i < n; i++) { const a = rnd() * Math.PI * 2, r = p.r * (.25 + rnd() * .65), x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r; if (free(x, z) && !inB(x, z, 1)) out.push({ t: pick(BATTLE), x, z, rot: rnd() * Math.PI * 2, detail: true }); }
    } else if (p.type === 'hamlet' && rnd() < D.banner) {
      const a = rnd() * Math.PI * 2, x = p.x + Math.cos(a) * p.r * .7, z = p.z + Math.sin(a) * p.r * .7;
      if (free(x, z) && !inB(x, z, 1.5)) out.push({ t: 'banner', x, z, rot: rnd() * Math.PI * 2, c: pick(D.bannerColors), detail: true });
    }
  }
  return out;
}

// подземелье: свечи в углах комнат, цепи и решётки на сплошных стенах, кости и черепа на полу (не в проходах)
export function dungeonDetails(M, cfg, salt = 0) {
  const D = cfg.details; if (!D || !D.on) return [];
  const rnd = mulberry32((cfg.world.seed ^ 0x2c1b ^ Math.imul(salt + 1, 2654435761)) >>> 0), out = [], pick = a => a[(rnd() * a.length) | 0];
  const open = (x, z) => (M.links || []).some(l => (l.vert ? Math.abs(x - l.line) < .3 && z > l.s0 - 1 && z < l.s1 + 1 : Math.abs(z - l.line) < .3 && x > l.s0 - 1 && x < l.s1 + 1));
  const nearPortal = (x, z) => (M.portals || []).some(q => Math.hypot(q.x - x, q.z - z) < 2.5) || (M.containers || []).some(c => Math.hypot(c.x - x, c.z - z) < 1.2);
  const nearLink = (x, z, d) => (M.links || []).some(l => Math.hypot(l.x - x, l.z - z) < d);
  for (const r of M.rooms || []) {
    if (r.corridor) continue;
    const fr = (x, z, pad) => roomFree(r, x, z, pad);     // необычный зал: не в заливке углов, не в провале и не в колонне
    if (r.fill === 'empty') { rnd(); continue; }     // пустой зал — ни свечей, ни хлама (2026-10-20)
    if (r.fill === 'full') for (let k = 0, n = 5 + ((rnd() * 5) | 0), t = 0; k < n && t < 60; t++) {     // забитый зал: хлам вдоль стен
      const x = r.x0 + .8 + rnd() * (r.x1 - r.x0 - 1.6), z = r.z0 + .8 + rnd() * (r.z1 - r.z0 - 1.6);
      if (!fr(x, z, .7) || fr(x, z, 2.4) || nearLink(x, z, 2.6) || nearPortal(x, z)) continue;
      out.push({ t: pick(['crate_d', 'barrel_d', 'sack_d', 'rubble', 'bones', 'skulls', 'rusty_sword', 'wreck', 'crate_d']), x, z, rot: rnd() * 6.28, s: .8 + rnd() * .5, detail: true }); k++;
    }
    for (const [cx, cz] of [[r.x0 + .45, r.z0 + .45], [r.x1 - .45, r.z0 + .45], [r.x0 + .45, r.z1 - .45], [r.x1 - .45, r.z1 - .45]]) if (rnd() < D.candle && !open(cx, cz) && !nearPortal(cx, cz) && fr(cx, cz, .2)) out.push({ t: 'candles', x: cx, z: cz, rot: rnd() * 6.28, detail: true });
    const walls = [[r.x0 + .08, null, Math.PI / 2], [r.x1 - .08, null, -Math.PI / 2], [null, r.z0 + .08, 0]];     // ближняя к камере стена (z1) — без деталей
    for (const [wx, wz, rot] of walls) {
      if (rnd() > D.wall) continue;
      const k = .2 + rnd() * .6, x = wx ?? r.x0 + k * (r.x1 - r.x0), z = wz ?? r.z0 + k * (r.z1 - r.z0);
      if (!open(x, z) && !nearPortal(x, z) && fr(x, z, -.3)) out.push({ t: rnd() < .5 ? 'chain' : 'grate', x, z, rot, detail: true });
    }
    if (rnd() < D.floor) { const x = r.x0 + 1 + rnd() * Math.max(.1, r.x1 - r.x0 - 2), z = r.z0 + 1 + rnd() * Math.max(.1, r.z1 - r.z0 - 2); if (!open(x, z) && !nearPortal(x, z) && fr(x, z, .6)) out.push({ t: pick(['bones', 'skulls']), x, z, rot: rnd() * 6.28, detail: true }); }
  }
  return out;
}
