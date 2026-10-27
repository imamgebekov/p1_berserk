// Малые миры (просьба владельца 2026-10-27): подземелье — не залы под землёй, а мир под открытым небом размером ~1/14 большого.
// Раскладка — тот же генератор залов (dungeongen3d) в масштабе мира: залы — поляны, коридоры — тропы. Граф залов и проходов
// остаётся, поэтому пути врагов и отряда, ключи, ловушки, тайники и события работают без правок. Здесь — только то, что
// делает раскладку миром: широкие тропы виляют коленами, у края полян — валуны и деревья (твёрдые), на полянах — обстановка темы.
// Числа — config3d.js → dungeons.wild. Чистая логика.
import { mulberry } from './dungeongen3d.js';

// пробный мир: включён меткой и подземелье в списке only
export const wildOn = (cfg, def) => { const X = cfg.dungeons.wild; return !!(X && X.on && def && def.inst && X.only.includes(def.id)); };
export const wildTheme = (cfg, def) => { const T = cfg.dungeons.wild.themes; return T[T.by[def.id]] || null; };

// настройки генератора залов для мира: своя раскладка, формы полян, ширина узкой тропы, тайник крупнее
export function wildCfg(cfg) {
  const X = cfg.dungeons.wild, D = cfg.dungeons;
  return { ...cfg, dungeons: { ...D, gen: X.gen, style: X.style, corridorMax: X.corridorMax, secrets: { ...D.secrets, size: X.secrets } } };
}

const busyOf = def => [def.entry, def.exit, def.fire, ...(def.bosses || []), ...(def.chests || []), ...(def.events || []), ...(def.traps || []).flatMap(q => [q, q.lever]), ...(def.props || [])].filter(Boolean);

// широкая тропа: прямоугольник коридора → колена со сдвигом в сторону; концы — на оси, чтобы касаться полян
function bend(T, r, rnd) {
  const along = r.w >= r.d ? 'x' : 'z', len = along === 'x' ? r.w : r.d, w = T.w[0] + rnd() * (T.w[1] - T.w[0]);
  const n = Math.max(3, Math.round(len / T.seg)), seg = len / n, out = [];
  let off = 0;
  for (let i = 0; i < n; i++) {
    const end = i === 0 || i === n - 1, want = end ? 0 : (rnd() * 2 - 1) * T.amp, lim = w - T.overlap;
    off = Math.max(off - lim, Math.min(off + lim, want));
    if (i === n - 2) off = Math.max(-lim, Math.min(lim, off));     // предпоследнее колено — так, чтобы последнее (на оси) с ним сходилось
    const c = (along === 'x' ? r.x - r.w / 2 : r.z - r.d / 2) + seg * (i + .5);
    out.push(along === 'x' ? { id: i ? `${r.id}_${i}` : r.id, x: c, z: r.z + off, w: seg, d: w, corr: true } : { id: i ? `${r.id}_${i}` : r.id, x: r.x + off, z: c, w, d: seg, corr: true });
  }
  return out;
}

// точки по краю поляны (прямоугольник или эллипс), снаружи проходов
function edgeSpots(E, r, links, rnd) {
  const out = [], round = r.shape === 'round' || r.shape === 'oct', hw = r.w / 2, hd = r.d / 2;
  const nearLink = (x, z) => links.some(l => Math.hypot(x - l.x, z - l.z) < l.half + E.clear);
  if (round) {
    const n = Math.round(Math.PI * (hw + hd) / E.step);
    for (let i = 0; i < n; i++) { const a = (i + rnd() * .6) / n * Math.PI * 2, k = 1 - (E.inset[0] + rnd() * (E.inset[1] - E.inset[0])) / Math.min(hw, hd), x = r.x + Math.cos(a) * hw * k, z = r.z + Math.sin(a) * hd * k; if (!nearLink(x, z)) out.push({ x, z, side: Math.sin(a) }); }
    return out;
  }
  for (const [ax, az, nx, nz, L] of [[r.x - hw, r.z - hd, 1, 0, r.w], [r.x - hw, r.z + hd, 1, 0, r.w], [r.x - hw, r.z - hd, 0, 1, r.d], [r.x + hw, r.z - hd, 0, 1, r.d]]) {
    const ix = nz ? (ax < r.x ? 1 : -1) : 0, iz = nx ? (az < r.z ? 1 : -1) : 0;     // внутрь поляны
    for (let s = rnd() * E.step; s < L; s += E.step * (.7 + rnd() * .6)) { const ins = E.inset[0] + rnd() * (E.inset[1] - E.inset[0]), x = ax + nx * s + ix * ins, z = az + nz * s + iz * ins; if (!nearLink(x, z)) out.push({ x, z, side: -iz }); }
  }
  return out;
}

// поляны — не по сетке: каждая сдвинута внутри своей клетки; тропа упирается в её сторону (поперёк — на прежней оси клетки),
// концы троп — к новым краям; вход, сундуки, обстановка, события, рычаги ловушек и боссы едут вместе с поляной
function jitter(X, def, rnd, bosses) {
  const J = X.jitter, C = X.gen.cell, halls = def.rooms.filter(r => !r.corr), wc = X.trail.w[1];
  const ties = def.rooms.filter(r => r.corr).map(c => ({ c, ends: halls.filter(h => touch(c, h)), along: c.w >= c.d ? 'x' : 'z' })).filter(t => t.ends.length === 2);
  const trapTie = (def.traps || []).map(q => ties.find(t => Math.abs(t.c.x - q.x) < t.c.w / 2 + .01 && Math.abs(t.c.z - q.z) < t.c.d / 2 + .01));
  const sh = new Map();
  for (const h of halls) { if (h.secret) continue;     // тайник — на месте
    let lx = (C - h.w) / 2 - J.gap, lz = (C - h.d) / 2 - J.gap;
    for (const t of ties) if (t.ends.includes(h)) { if (t.along === 'x') lz = Math.min(lz, h.d / 2 - wc / 2 - J.edge); else lx = Math.min(lx, h.w / 2 - wc / 2 - J.edge); }
    lx = Math.max(0, Math.min(lx, J.max)); lz = Math.max(0, Math.min(lz, J.max)); sh.set(h, [(rnd() * 2 - 1) * lx, (rnd() * 2 - 1) * lz]); }
  const inside = (h, p) => Math.abs(p.x - h.x) <= h.w / 2 + .01 && Math.abs(p.z - h.z) <= h.d / 2 + .01;
  const pts = [def.entry, def.exit, def.fire, ...(def.chests || []), ...(def.props || []), ...(def.events || []), ...(def.traps || []).map(q => q.lever), ...bosses].filter(Boolean);
  for (const p of pts) { const h = halls.find(q => sh.has(q) && inside(q, p)); if (h) { const [dx, dz] = sh.get(h); p.x += dx; p.z += dz; } }
  for (const [h, [dx, dz]] of sh) { h.x += dx; h.z += dz; }
  for (const t of ties) { const [a, b] = t.ends, c = t.c;
    if (t.along === 'x') { const [P, Q] = a.x < b.x ? [a, b] : [b, a], x0 = P.x + P.w / 2, x1 = Q.x - Q.w / 2; c.x = (x0 + x1) / 2; c.w = x1 - x0; }
    else { const [P, Q] = a.z < b.z ? [a, b] : [b, a], z0 = P.z + P.d / 2, z1 = Q.z - Q.d / 2; c.z = (z0 + z1) / 2; c.d = z1 - z0; } }
  (def.traps || []).forEach((q, i) => { const t = trapTie[i]; if (t) { if (t.along === 'x') q.x = t.c.x; else q.z = t.c.z; } });     // ловушка — в середине своей тропы
}
// раскладка (genDef + styleDef) → мир: тропы-колена, неровный край, обстановка темы; помечает def.wild
export function wildFinish(cfg, def, seed, bosses = []) {
  const X = cfg.dungeons.wild, th = wildTheme(cfg, def), rnd = mulberry(seed ^ 0x5bd1e995);
  jitter(X, def, rnd, bosses);
  const keep = new Set([...(def.doors || []).flatMap(d => [d.a, d.b]), ...(def.traps || []).map(q => roomOfTrap(def, q))]);     // ворота и ловушки — на узкой прямой тропе (перешеек)
  const rooms = [];
  for (const r of def.rooms) { if (r.corr && !r.secret && !keep.has(r.id) && Math.max(r.w, r.d) > X.trail.seg * 2) rooms.push(...bend(X.trail, r, rnd)); else rooms.push(r); }
  def.rooms = rooms;
  // проходы для краёв: середины общих границ поляны с тропами
  const props = def.props || (def.props = []), busy = busyOf(def).concat(bosses), E = X.edge;
  for (const r of rooms) {
    if (r.corr || r.secret) continue;
    const links = rooms.filter(o => o.corr && touch(r, o)).map(o => ({ x: clampTo(o.x, r.x - r.w / 2, r.x + r.w / 2), z: clampTo(o.z, r.z - r.d / 2, r.z + r.d / 2), half: Math.abs(Math.abs(o.x - r.x) - (o.w + r.w) / 2) < 1e-3 ? o.d / 2 : o.w / 2 }));     // проём на вертикальной границе — по высоте тропы, иначе — по ширине
    for (const q of edgeSpots(E, r, links, rnd)) {
      if (busy.some(b => Math.hypot(b.x - q.x, b.z - q.z) < 4)) continue;
      const tree = q.side < .3 && rnd() < E.tree, rr = E.r[0] + rnd() * (E.r[1] - E.r[0]);     // ближний к камере край — без деревьев (не закрывают героя)
      props.push({ t: tree ? 'w_tree' : 'w_rock', x: q.x, z: q.z, r: tree ? .6 : rr * .8, s: tree ? .9 + rnd() * .4 : rr * .55, rot: rnd() * 6.283 });
    }
    // обстановка поляны: по весам темы, не в центре боя и не у занятых точек
    if (th && !r.kind) { const tot = th.decor.reduce((a, d) => a + d[1], 0), n = Math.round(r.w * r.d / 160);
      for (let k = 0; k < n; k++) { let u = rnd() * tot, t = th.decor[0][0]; for (const [dt, wt] of th.decor) if ((u -= wt) <= 0) { t = dt; break; }
        const a = rnd() * Math.PI * 2, f = .25 + rnd() * .65, x = r.x + Math.cos(a) * r.w / 2 * f, z = r.z + Math.sin(a) * r.d / 2 * f;
        if (busy.some(b => Math.hypot(b.x - x, b.z - z) < 3) || props.some(p => p.r && Math.hypot(p.x - x, p.z - z) < p.r + 2)) continue;
        props.push({ t, x, z, rot: rnd() * 6.283, s: .8 + rnd() * .6, ...(t === 'barrow' ? { r: 2.6 } : t === 'menhir' ? { r: .6 } : {}) }); } }
  }
  def.wild = { theme: th ? Object.keys(X.themes).find(k => X.themes[k] === th) : null };
  return def;
}
const clampTo = (v, a, b) => Math.max(a, Math.min(b, v));
const touch = (a, b) => Math.abs(a.x - b.x) <= (a.w + b.w) / 2 + 1e-6 && Math.abs(a.z - b.z) <= (a.d + b.d) / 2 + 1e-6;
const roomOfTrap = (def, q) => { const r = def.rooms.find(o => o.corr && Math.abs(o.x - q.x) < o.w / 2 + .01 && Math.abs(o.z - q.z) < o.d / 2 + .01); return r ? r.id : null; };
