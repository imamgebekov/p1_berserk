// Детали мира (T5): мелочи у домов и в посёлках, следы боя у опасных мест, свечи, цепи и решётки в подземельях.
// Только вид: список в формате декора, в карту боя (solids, blocks) не попадает; числа — свой генератор от зерна мира,
// поэтому бой, баланс и сохранения не сдвигаются. Числа — cfg.details.
import { mulberry32 } from './sim.js';
import { pathSegs, distSeg } from './world3d.js';
import { waterDist } from './terrain3d.js';
import { roomFree } from './map.js';
import { gridIndex } from './util3d.js';     // поиск по сетке (2026-10-28)
import { zoneAt } from './zones3d.js';

const YARD = ['barrel_d', 'crate_d', 'woodpile', 'sack_d', 'bucket', 'barrel_l', 'keg', 'barrels', 'crates'];     // 2026-10-28: + большие бочки, бочонки, штабеля
const SIGNED = new Set(['shop', 'smithy', 'tavern', 'warehouse']);
const PROUD = new Set(['smithy', 'tavern', 'barracks', 'chapel']);     // 4.09: у этих домов — знамя у входа (у рынка — нет: прилавки модели стоят перед дверью)
const RUG = new Set(['house', 'tavern', 'chapel']);
const BATTLE = ['rusty_sword', 'bones', 'skulls', 'wreck', 'skulls', 'w_lie', 'w_lie', 'w_stuck', 'w_stuck', 'shield_lie', 'armor_lie', 'armor_pole', 'armor_pile', 'swsh_broken'];     // 2026-10-28: + оружие, щиты и доспехи на земле
const RUINS = ['column_d', 'wall_br', 'wall_hf', 'rubble_s', 'rubble_l', 'arch_k', 'vine', 'column_d'], ROADSIDE = ['crates', 'barrels', 'fence_q', 'rubble_s', 'w_stuck', 'table_broken', 'barrel_l'];
const BIO = { forest: ['stump', 'w_lie', 'barrels', 'woodpile'], swamp: ['stump', 'barrels', 'bones'], mountains: ['crates', 'barrels', 'torch_d', 'rubble_s'], waste: ['w_stuck', 'bones', 'skulls', 'rubble_s', 'armor_lie'], coast: ['barrels', 'crates', 'wreck', 'keg'] };     // у мест интереса — по биому

// поверхность: у стен домов (кроме стороны с дверью), вывеска и коврик у двери, следы боя у опасных мест, знамя в посёлке
export function surfaceDetails(map, cfg) {
  const D = cfg.details; if (!D || !D.on) return [];
  const rnd = mulberry32((cfg.world.seed ^ 0x5d37) >>> 0), out = [], segs = pathSegs(map), pick = a => a[(rnd() * a.length) | 0];
  const gB = gridIndex(map.buildings, b => [b.x0, b.z0, b.x1, b.z1]), gP = gridIndex(segs, ([a, b]) => [Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z)], 32), gO = gridIndex(out, o => [o.x, o.z, o.x, o.z]), gM = gridIndex(map.decor || [], o => [o.x, o.z, o.x, o.z]);     // проверки — по соседям в сетке (загрузка)
  const inB = (x, z, m) => gB.some(x - m, z - m, x + m, z + m, b => x > b.x0 - m && x < b.x1 + m && z > b.z0 - m && z < b.z1 + m);
  const free = (x, z, road = D.road) => !gP.some(x - road, z - road, x + road, z + road, ([a, b]) => distSeg(x, z, a, b) < road) && !(map.river && waterDist(map.river, x, z) < 1.5) && !gO.some(x - D.gap, z - D.gap, x + D.gap, z + D.gap, o => Math.hypot(o.x - x, o.z - z) < D.gap);
  const nearDecor = (x, z, r) => gM.some(x - r, z - r, x + r, z + r, o => Math.hypot(o.x - x, o.z - z) < r);
  for (const b of map.buildings) {
    const sides = ['n', 's', 'e', 'w'].filter(s => s !== b.door.side), n = D.house[0] + Math.floor(rnd() * (D.house[1] - D.house[0] + 1));
    for (let i = 0; i < n; i++) {
      const s = pick(sides), along = rnd() - .5, off = .55 + rnd() * .3;
      const x = s === 'e' ? b.x1 + off : s === 'w' ? b.x0 - off : b.x + along * (b.x1 - b.x0 - 1.2);
      const z = s === 's' ? b.z1 + off : s === 'n' ? b.z0 - off : b.z + along * (b.z1 - b.z0 - 1.2);
      if (free(x, z) && !gB.some(x - .6, z - .6, x + .6, z + .6, o => o !== b && x > o.x0 - .6 && x < o.x1 + .6 && z > o.z0 - .6 && z < o.z1 + .6)) out.push({ t: pick(YARD), x, z, rot: rnd() * Math.PI * 2, detail: true });
    }
    const d = b.door, dx = { e: 1, w: -1 }[d.side] || 0, dz = { s: 1, n: -1 }[d.side] || 0, rot = Math.atan2(dx, dz);
    if (SIGNED.has(b.kind)) { const x = d.x + dx * .9 + dz * 1.5, z = d.z + dz * .9 - dx * 1.5; if (free(x, z, 1)) out.push({ t: 'sign', x, z, rot, kind: b.kind, detail: true }); }
    { const pr = PROUD.has(b.kind) || (!!b.npc && b.npc.kind !== 'merchant' && b.kind !== 'shop'), x = d.x + dx * .9 - dz * 1.7, z = d.z + dz * .9 + dx * 1.7, clear = (x, z) => !nearDecor(x, z, 1.8);     // 4.09: знамя по другую сторону двери от вывески; у простых домов — фонарь
      if (pr && rnd() < (D.kbanner ?? 0) && free(x, z) && !inB(x, z, .2) && clear(x, z)) out.push({ t: 'kbanner', x, z, rot, detail: true });
      else if (!pr && b.kind !== 'hut' && rnd() < (D.lamp ?? 0)) { const lx = d.x + dx * 1.3 - dz * 1.6, lz = d.z + dz * 1.3 + dx * 1.6; if (free(lx, lz) && !inB(lx, lz, .3) && clear(lx, lz)) out.push({ t: 'lamp', x: lx, z: lz, rot: rot + Math.PI / 2, detail: true }); } }
    if ((b.kind === 'shop' || (b.npc && b.npc.kind === 'merchant')) && rnd() < (D.wagon ?? 0)) {     // 4.10: повозка у лавки — вдоль стены сбоку от двери
      const s = pick(sides), h = s === 'e' || s === 'w', wx = s === 'e' ? b.x1 + 2.4 : s === 'w' ? b.x0 - 2.4 : b.x, wz = s === 's' ? b.z1 + 2.4 : s === 'n' ? b.z0 - 2.4 : b.z;
      if (free(wx, wz) && !inB(wx, wz, 1.6) && !nearDecor(wx, wz, 2.6)) out.push({ t: 'wagon', x: wx, z: wz, rot: h ? 0 : Math.PI / 2, detail: true });
    }
    if (RUG.has(b.kind) && rnd() < D.rug) { const x = d.x + dx * 1.1, z = d.z + dz * 1.1; if (!inB(x, z, .1)) out.push({ t: 'rug', x, z, rot, c: pick(D.rugColors), detail: true }); }
  }
  for (const p of map.cfg.places || []) {
    if (p.type === 'danger') {
      const war = !!D.war && (zoneAt(cfg, p.x, p.z) || {}).id === 'war', n = Math.round((D.danger[0] + Math.floor(rnd() * (D.danger[1] - D.danger[0] + 1))) * (war ? D.war : 1));     // поле Великой войны — бой гуще
      for (let i = 0; i < n; i++) { const a = rnd() * Math.PI * 2, r = p.r * (.25 + rnd() * .65) * (war ? 1.4 : 1), x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r; if (free(x, z) && !inB(x, z, 1)) out.push({ t: pick(BATTLE), x, z, rot: rnd() * Math.PI * 2, detail: true }); }
    } else if (p.type === 'hamlet' && rnd() < D.banner) {
      const a = rnd() * Math.PI * 2, x = p.x + Math.cos(a) * p.r * .7, z = p.z + Math.sin(a) * p.r * .7;
      if (free(x, z) && !inB(x, z, 1.5)) out.push({ t: 'banner', x, z, rot: rnd() * Math.PI * 2, c: pick(D.bannerColors), detail: true });
    }
  }
  const sets = D;     // числа мелочей мира — config3d.js → details
  // сёла: стол со скамьями у середины, арка на въезде (на дороге, поперёк)
  for (const p of map.cfg.places || []) if (p.type === 'hamlet') {
    if (rnd() < (sets.table ?? 0)) { const a = rnd() * Math.PI * 2, x = p.x + Math.cos(a) * p.r * .35, z = p.z + Math.sin(a) * p.r * .35; if (free(x, z) && !inB(x, z, 2)) out.push({ t: 'table_set', x, z, rot: rnd() * Math.PI, detail: true }); }
    if (rnd() < (sets.arch ?? 0)) { const s0 = segs.find(([a, b]) => { const da = Math.hypot(a.x - p.x, a.z - p.z), db = Math.hypot(b.x - p.x, b.z - p.z); return (da < p.r * 1.3 && db > p.r * 1.3) || (db < p.r * 1.3 && da > p.r * 1.3); });
      if (s0) { const [a, b] = s0, din = Math.hypot(a.x - p.x, a.z - p.z) < Math.hypot(b.x - p.x, b.z - p.z), q = din ? a : b, o = din ? b : a, L = Math.hypot(o.x - q.x, o.z - q.z) || 1, t = Math.min(1, p.r * .4 / L), x = q.x + (o.x - q.x) * t, z = q.z + (o.z - q.z) * t;
        if (!inB(x, z, 3)) out.push({ t: 'arch_k', x, z, rot: Math.atan2(-(o.x - q.x), -(o.z - q.z)), s: 1.5, detail: true }); } }     // поперёк дороги: проём на тропе
  }
  // у дорог: изредка — ящики, бочки, обломки, оград, воткнутое оружие, разбитый стол
  if (sets.roadside) for (const [a, b] of segs) { const L = Math.hypot(b.x - a.x, b.z - a.z); if (L < 1) continue; const ux = (b.x - a.x) / L, uz = (b.z - a.z) / L;
    for (let t = rnd() * sets.roadside.step; t < L; t += sets.roadside.step) { if (rnd() > sets.roadside.p) continue; const sd = rnd() < .5 ? -1 : 1, x = a.x + ux * t - uz * sd * sets.roadside.off, z = a.z + uz * t + ux * sd * sets.roadside.off;
      if (free(x, z, 2.2) && !inB(x, z, 2)) out.push({ t: pick(ROADSIDE), x, z, rot: Math.atan2(ux, uz) + (rnd() - .5) * .6, detail: true }); } }
  // руины и кладбища: колонны, стены, арки, обломки, плющ; свечи у могил
  for (const zn of map.cfg.zones || []) {
    const hw = zn.w ? zn.w / 2 : zn.r || 6, hd = zn.d ? zn.d / 2 : zn.r || 6;
    const put = (set, lim) => { const n = lim[0] + Math.floor(rnd() * (lim[1] - lim[0] + 1)); for (let i = 0; i < n; i++) { const x = zn.x + (rnd() * 2 - 1) * hw * .9, z = zn.z + (rnd() * 2 - 1) * hd * .9; if (free(x, z) && !inB(x, z, 1.5)) out.push({ t: pick(set), x, z, rot: rnd() * Math.PI * 2, detail: true }); } };
    if (zn.type === 'ruins' && sets.ruins) put(RUINS, sets.ruins);
    else if (zn.type === 'graveyard' && sets.grave) put(['candles3', 'candles3', 'torch_d'], sets.grave);
    else if ((zn.type === 'warcamp' || zn.type === 'bandits') && sets.ruins) put(['armor_rack', 'barrels', 'crates', 'table_set', 'torch_d', 'w_stuck'], sets.ruins);
  }
  // места интереса: по биому
  if (sets.poi) for (const q of map.cfg.pois || []) { const set = BIO[q.bio]; if (!set) continue; const n = sets.poi[0] + Math.floor(rnd() * (sets.poi[1] - sets.poi[0] + 1));
    for (let i = 0; i < n; i++) { const a = rnd() * Math.PI * 2, r = (q.r || 4) + 1 + rnd() * 3, x = q.x + Math.cos(a) * r, z = q.z + Math.sin(a) * r; if (free(x, z) && !inB(x, z, 1.5)) out.push({ t: pick(set), x, z, rot: rnd() * Math.PI * 2, detail: true }); } }
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
    if (r.corridor || r.kind) continue;     // ключевой зал — своя обстановка (план подземелий, 2а)
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
