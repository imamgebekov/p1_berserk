// Облик подземелий (2026-10-20, просьба владельца): залы крупнее, необычные формы — круг, восьмигранник, колонны, провал
// с мостом-крестом; разная наполненность (пустой, обычный, забитый). Форма и наполненность — по хешу id подземелья и зала,
// не по случайным числам боя. styleDef меняет описание подземелья один раз; стены по форме строит map.js (shapeParts).
export const styleOn = cfg => !!(cfg.dungeons && cfg.dungeons.style && cfg.dungeons.style.on);
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) / 4294967296; };
const wpick = (u, w) => { const e = Object.entries(w), t = e.reduce((a, [, v]) => a + v, 0); let r = u * t; for (const [k, v] of e) if ((r -= v) < 0) return k; return e[0][0]; };
const sc = (p, k, keys = ['x', 'z']) => { if (p) for (const q of keys) if (Number.isFinite(p[q])) p[q] *= k; };
const inRect = (r, x, z) => Math.abs(x - r.x) <= r.w / 2 && Math.abs(z - r.z) <= r.d / 2;

// полуширина формы по x на смещении dz от центра (и наоборот — по z на dx)
export function extent(R, along, off) {
  const hw = R.w / 2, hd = R.d / 2, [a, b] = along === 'x' ? [hw, hd] : [hd, hw], o = Math.abs(off);
  if (o > b) return -1;
  if (R.shape === 'round') return a * Math.sqrt(Math.max(0, 1 - (o / b) ** 2));
  if (R.shape === 'oct') return Math.min(a, a + b - R.cut - o);
  return a;
}
// точка внутри формы зала (с отступом pad от края) и не в провале, не в колонне
export function shapeFree(R, x, z, pad = 0) {
  const dx = x - R.x, dz = z - R.z;
  if (Math.abs(dx) > R.w / 2 - pad || Math.abs(dz) > R.d / 2 - pad) return false;
  if (R.shape === 'round') { const a = R.w / 2 - pad, b = R.d / 2 - pad; if (a <= 0 || b <= 0 || (dx / a) ** 2 + (dz / b) ** 2 > 1) return false; }
  if (R.shape === 'oct' && Math.abs(dx) + Math.abs(dz) > R.w / 2 + R.d / 2 - R.cut - pad * 1.42) return false;
  for (const p of pitsOf(R)) if (x > p.x0 - pad && x < p.x1 + pad && z > p.z0 - pad && z < p.z1 + pad) return false;
  for (const c of pillarsOf(R)) if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return false;
  return true;
}
// провалы: четыре ямы по углам, между ними мост-крест (центр и середины стен свободны)
export function pitsOf(R) {
  if (R.shape !== 'pit') return [];
  const m = R.pitPad, b = R.bridge, out = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const xa = R.x + sx * b, xb = R.x + sx * (R.w / 2 - m), za = R.z + sz * b, zb = R.z + sz * (R.d / 2 - m);
    const q = { x0: Math.min(xa, xb), x1: Math.max(xa, xb), z0: Math.min(za, zb), z1: Math.max(za, zb) };
    if (q.x1 - q.x0 >= 1.2 && q.z1 - q.z0 >= 1.2) out.push(q);
  }
  return out;
}
export function pillarsOf(R) {
  if (R.shape !== 'pillars') return [];
  const n = R.cols, out = [];
  for (let i = 0; i < n; i++) { const a = (i + .5) / n * Math.PI * 2; out.push({ x: R.x + Math.cos(a) * R.w * .31, z: R.z + Math.sin(a) * R.d * .31, r: R.colR }); }
  return out;
}

// один раз на подземелье: масштаб, формы, наполненность; bosses — боссы этого уровня (их x, z тоже в масштабе)
export function styleDef(cfg, def, bosses = []) {
  const S = cfg.dungeons.style; if (!S || !S.on || def.styled) return def;
  def.styled = true;
  const k = S.scale, cmax = cfg.dungeons.corridorMax;
  for (const r of def.rooms) { r.corr = Math.min(r.w, r.d) <= cmax; sc(r, k, ['x', 'z', 'w', 'd']); }
  sc(def.entry, k); sc(def.exit, k); sc(def.fire, k); for (const c of def.chests || []) sc(c, k); for (const q of def.props || []) sc(q, k); for (const q of def.traps || []) { sc(q, k, ['x', 'z', 'w', 'd']); sc(q.lever, k); }     // fire — костёр перед финальным боссом (план подземелий, 1е)
  if (def.guard) sc(def.guard, k);
  if (def.throne) sc(def.throne, k, ['x', 'z', 'w', 'd']);
  if (def.down) { sc(def.down, k); if (def.down.to !== 'surface') sc(def.down, k, ['tx', 'tz']); }
  if (def.upTo && def.upTo !== 'surface' && def.back) sc(def.back, k);     // выход нижнего этажа ведёт к лестнице верхнего — тоже в масштабе
  for (const b of bosses) sc(b, k);
  // точки, которые нельзя ставить в провал или колонну
  const busy = [def.entry, def.exit, def.down, def.guard, def.fire, ...bosses].filter(Boolean);
  for (const r of def.rooms) {
    if (r.corr || r.shape || r.kind) continue;     // kind — ключевой зал (план подземелий, 2а): форма уже задана
    const u = hash(def.id + '|' + r.id), u2 = hash(r.id + '#' + def.id);
    r.fill = Math.min(r.w, r.d) >= S.fillMin ? wpick(u2, S.fill) : 'normal';
    if (Math.min(r.w, r.d) < S.shapeMin) continue;
    let sh = wpick(u, S.shapes);
    if (sh === 'pit' && busy.some(p => inRect(r, p.x, p.z))) sh = 'round';     // провал — только в зале без лестниц, входа и боссов
    if (sh === 'rect') continue;
    r.shape = sh;
    if (sh === 'oct') r.cut = Math.min(r.w, r.d) * S.octCut;
    if (sh === 'pit') { r.pitPad = S.pit.pad; r.bridge = S.pit.bridge; }
    if (sh === 'pillars') { r.cols = Math.min(r.w, r.d) >= S.pillars.big ? 8 : 6; r.colR = S.pillars.r; }
  }
  // сундуки, вход, лестницы, страж, боссы — внутрь формы (к центру зала, пока не встанут свободно)
  const fix = p => { const r = def.rooms.find(q => !q.corr && q.shape && inRect(q, p.x, p.z)); if (!r) return; for (let i = 0; i < 40 && !shapeFree(r, p.x, p.z, 1.1); i++) { p.x += (r.x - p.x) * .12; p.z += (r.z - p.z) * .12; } if (!shapeFree(r, p.x, p.z, .9)) { p.x = r.x; p.z = r.z + (r.shape === 'pit' ? 0 : 1.5); } };
  for (const p of [...(def.chests || []), ...busy]) fix(p);
  // наполненность: в забитых залах больше врагов, в пустых меньше
  for (const s of def.spawns || []) { const r = def.rooms.find(q => q.id === s.room); if (r && r.fill === 'full') s.n += S.fullAdd; else if (r && r.fill === 'empty') s.n = Math.max(0, s.n - S.emptyCut); }
  return def;
}
// все подземелья мира и их боссы (после expandWorld)
export function styleDungeons(cfg) {
  if (!styleOn(cfg)) return cfg;
  for (const def of cfg.dungeons.list) styleDef(cfg, def, (cfg.bosses.list || []).filter(b => b.level === def.id));
  cfg.dungeons.doorMax *= cfg.dungeons.style.scale;     // проходы шире вместе с залами
  return cfg;
}

// стены формы для map.js: блоки-заливки углов (ступеньками, вырезаны проходы), провалы, колонны и гладкая линия стены для вида
export function shapeParts(cfg, room, links, cut) {
  const R = room.sh;     // описание зала из styleDef: центр, размеры, форма и её числа
  const out = { fills: [], pits: pitsOf(R), pillars: pillarsOf(R), arcs: [] };
  if (R.shape !== 'round' && R.shape !== 'oct') return out;
  const s = cfg.dungeons.style.step, E = 1e-6;
  // проходы в стенах зала: прямоугольник от края до линии формы (+ запас) — заливку там вырезаем, линию стены не рисуем
  const throats = [];
  for (const l of links) {
    if (l.vert) { const e = Math.min(extent(R, 'x', l.s0 - R.z), extent(R, 'x', l.s1 - R.z)), dep = Math.min(R.w / 2, R.w / 2 - Math.max(0, e) + .25), inX = Math.abs(l.line - room.x0) < E ? 1 : -1; throats.push(inX > 0 ? { x0: l.line, x1: l.line + dep, z0: l.s0, z1: l.s1 } : { x0: l.line - dep, x1: l.line, z0: l.s0, z1: l.s1 }); }
    else { const e = Math.min(extent(R, 'z', l.s0 - R.x), extent(R, 'z', l.s1 - R.x)), dep = Math.min(R.d / 2, R.d / 2 - Math.max(0, e) + .25), inZ = Math.abs(l.line - room.z0) < E ? 1 : -1; throats.push(inZ > 0 ? { x0: l.s0, x1: l.s1, z0: l.line, z1: l.line + dep } : { x0: l.s0, x1: l.s1, z0: l.line - dep, z1: l.line }); }
  }
  let fills = [];
  for (let xa = room.x0; xa < room.x1 - E; xa += s) {     // столбцы: снаружи формы по z
    const xb = Math.min(room.x1, xa + s), dx = xa <= R.x && xb >= R.x ? 0 : Math.min(Math.abs(xa - R.x), Math.abs(xb - R.x)), e = extent(R, 'z', dx);
    if (e < 0) { fills.push({ x0: xa, x1: xb, z0: room.z0, z1: room.z1 }); continue; }
    if (R.z - e > room.z0 + E) fills.push({ x0: xa, x1: xb, z0: room.z0, z1: R.z - e });
    if (R.z + e < room.z1 - E) fills.push({ x0: xa, x1: xb, z0: R.z + e, z1: room.z1 });
  }
  for (let za = room.z0; za < room.z1 - E; za += s) {     // строки: снаружи формы по x
    const zb = Math.min(room.z1, za + s), dz = za <= R.z && zb >= R.z ? 0 : Math.min(Math.abs(za - R.z), Math.abs(zb - R.z)), e = extent(R, 'x', dz);
    if (e < 0) continue;
    if (R.x - e > room.x0 + E) fills.push({ x0: room.x0, x1: R.x - e, z0: za, z1: zb });
    if (R.x + e < room.x1 - E) fills.push({ x0: R.x + e, x1: room.x1, z0: za, z1: zb });
  }
  for (const t of throats) fills = fills.flatMap(w => cut(w, t));
  out.fills = fills.filter(w => w.x1 - w.x0 > .02 && w.z1 - w.z0 > .02).map(w => ({ ...w, fill: true }));
  // линия стены: эллипс — 48+ отрезков; восьмигранник — четыре скоса
  const pts = [];
  if (R.shape === 'round') { const n = Math.max(32, Math.round((R.w + R.d) * 2.2)); for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2; pts.push([R.x + Math.cos(a) * R.w / 2, R.z + Math.sin(a) * R.d / 2]); } }
  const segs = [];
  if (R.shape === 'round') for (let i = 1; i < pts.length; i++) segs.push([...pts[i - 1], ...pts[i]]);
  else { const hw = R.w / 2, hd = R.d / 2, c = R.cut; for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) segs.push([R.x + sx * (hw - c), R.z + sz * hd, R.x + sx * hw, R.z + sz * (hd - c)]); }
  const inT = (x, z) => throats.some(t => x > t.x0 - .3 && x < t.x1 + .3 && z > t.z0 - .3 && z < t.z1 + .3);
  for (const [x0, z0, x1, z1] of segs) if (!inT((x0 + x1) / 2, (z0 + z1) / 2)) out.arcs.push({ x0, z0, x1, z1, cx: R.x, cz: R.z });
  return out;
}
