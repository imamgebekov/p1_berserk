// Малые миры (просьба владельца 2026-10-27): подземелье и рейд — свободный мир под открытым небом размером ~1/14 большого, как в WoW.
// Мир — зоны-пятна вдоль извилистой оси; между зонами — проходы. В зоне — свой босс; ворота в проходе к следующей зоне открываются,
// когда босс убит (последняя зона — главный босс). Сбоку от зон — карманы: сундуки, тайник за трещиной, карман под ключ, ловушки в проходах.
// Ходимая земля — поле расстояния до края (sdf: внутри > 0); столкновения, вид и карта — по нему. Пути врагов и отряда между
// зонами — через устья проходов (map.nav). Числа — config3d.js → dungeons.wild. Чистая логика.
import { mulberry } from './dungeongen3d.js';
import { propsOf } from './keyrooms3d.js';
import { vnoise } from './terrain3d.js';
import { ROOM_EVENTS } from './roomev3d.js';

export const wildOn = (cfg, def) => { const X = cfg.dungeons.wild; return !!(X && X.on && def && def.inst && X.only.includes(def.id)); };
export const wildTheme = (cfg, def) => { const T = cfg.dungeons.wild.themes; return T[T.by[def.id]] || null; };
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const rr = (rnd, a) => a[0] + rnd() * (a[1] - a[0]);

// поле расстояния по фигурам: круги и капсулы — земля, ямы — вода; noise — неровный край
export function shapeSdf(S, x, z) {
  let s = -Infinity;
  for (const c of S.circles) s = Math.max(s, c.r - Math.hypot(x - c.x, z - c.z));
  for (const q of S.caps) { const dx = q.bx - q.ax, dz = q.bz - q.az, L2 = dx * dx + dz * dz, t = L2 ? Math.max(0, Math.min(1, ((x - q.ax) * dx + (z - q.az) * dz) / L2)) : 0; s = Math.max(s, q.r - Math.hypot(x - q.ax - dx * t, z - q.az - dz * t)); }
  s += S.amp * (vnoise(x / S.scale, z / S.scale, S.seed) - .5) * 2 * Math.min(1, Math.max(0, s + 6) / 6);     // неровность — у края, не в глубине
  for (const h of S.holes) s = Math.min(s, Math.hypot(x - h.x, z - h.z) - h.r);
  return s;
}

// мир из описания подземелья: зоны, проходы, ворота, карманы, враги, сундуки, обстановка
export function freeDef(cfg, def0, seed, bosses) {
  const X = cfg.dungeons.wild, Z = X.zone, P = X.pocket, rnd = mulberry(seed ^ 0x5bd1e995), raid = !!def0.raid, th = wildTheme(cfg, def0);
  const nZ = bosses.length + (X.extra || 0), zones = [], caps = [], circles = [], holes = [];
  // зоны вдоль оси: прямо или с поворотом, не налезая на прежние
  let cx = 0, cz = 0, dir = 0;
  for (let k = 0; k < nZ; k++) {
    const r = rr(rnd, Z.r), ext = r + Z.spread;
    if (k) {
      const prev = zones[k - 1], len = rr(rnd, Z.passLen), opts = [dir, (dir + 1) % 4, (dir + 3) % 4].map(d => [d, (d === dir ? Z.straight : 0) + rnd()]).sort((a, b) => b[1] - a[1]).map(v => v[0]);
      let ok = null;
      for (const d of opts) { const D = prev.ext + len + ext, x = prev.x + DIRS[d][0] * D, z = prev.z + DIRS[d][1] * D; if (zones.every(o => Math.hypot(o.x - x, o.z - z) > o.ext + ext + Z.gap)) { ok = { d, x, z }; break; } }
      if (!ok) { const D = prev.ext + len + ext + Z.gap * 2; ok = { d: dir, x: prev.x + DIRS[dir][0] * D, z: prev.z + DIRS[dir][1] * D }; }
      dir = ok.d; cx = ok.x; cz = ok.z; prev.out = dir;
    }
    const zone = { k, x: cx, z: cz, r, ext, in: k ? dir : null, out: null, blobs: [{ x: cx, z: cz, r }] };
    for (let b = 1; b < rr(rnd, Z.blobs); b++) { const a = rnd() * Math.PI * 2, d = Z.spread * (.5 + rnd() * .5); zone.blobs.push({ x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d, r: r * (.6 + rnd() * .35) }); }
    circles.push(...zone.blobs); zones.push(zone);
  }
  // проходы между зонами; ворота — посередине (вне пятен зон)
  const passes = [];
  for (let k = 1; k < nZ; k++) { const a = zones[k - 1], b = zones[k], w = rr(rnd, Z.pass), d = DIRS[a.out];
    const cap = { ax: a.x + d[0] * a.r * .5, az: a.z + d[1] * a.r * .5, bx: b.x - d[0] * b.r * .5, bz: b.z - d[1] * b.r * .5, r: w / 2 };
    caps.push(cap); passes.push({ a: k - 1, b: k, d: a.out, w, x: (a.x + a.ext * d[0] + b.x - b.ext * d[0]) / 2, z: (a.z + a.ext * d[1] + b.z - b.ext * d[1]) / 2 }); }
  // карманы: тупики сбоку от зон (по свободным сторонам)
  const pockets = [], busySide = z => [z.in != null ? (z.in + 2) % 4 : null, z.out].filter(v => v != null);
  for (const z of zones) for (let n = 0, want = Math.round(rr(rnd, P.n)); n < want; n++) {
    const free = [0, 1, 2, 3].filter(d => !busySide(z).includes(d) && !pockets.some(p => p.zone === z.k && p.d === d)); if (!free.length) break;
    const len = rr(rnd, P.len), pr = rr(rnd, P.r), fits = d => { const D = z.ext + len + pr, x = z.x + DIRS[d][0] * D, y = z.z + DIRS[d][1] * D; return zones.every(o => o === z || Math.hypot(o.x - x, o.z - y) > o.ext + pr + Z.gap * .6) && pockets.every(o => Math.hypot(o.x - x, o.z - y) > o.r + pr + Z.gap * .6); };
    const d = free.sort(() => rnd() - .5).find(fits); if (d === undefined) continue;     // любая свободная сторона, где карман не налезает на зоны и карманы
    const D = z.ext + len + pr, x = z.x + DIRS[d][0] * D, y = z.z + DIRS[d][1] * D;
    caps.push({ ax: z.x + DIRS[d][0] * z.r * .5, az: z.z + DIRS[d][1] * z.r * .5, bx: x, bz: y, r: P.w / 2 }); circles.push({ x, z: y, r: pr });
    pockets.push({ zone: z.k, d, x, z: y, r: pr, mouth: { x: z.x + DIRS[d][0] * (z.ext + 3), z: z.z + DIRS[d][1] * (z.ext + 3) }, mid: { x: z.x + DIRS[d][0] * (z.ext + len * .55), z: z.z + DIRS[d][1] * (z.ext + len * .55) } });
  }
  const S = { circles, caps, holes, amp: X.noise.amp, scale: X.noise.scale, seed: seed & 1023 };
  const inside = (x, z, m = 0) => shapeSdf(S, x, z) > m;
  // вход — в дальней от выхода стороне первой зоны; выход (подняться) — рядом
  const z0 = zones[0], back = z0.out != null ? (z0.out + 2) % 4 : 2, bd = DIRS[back];
  let ez = .7; while (ez > .2 && !inside(z0.x + bd[0] * z0.r * ez, z0.z + bd[1] * z0.r * ez, 5)) ez -= .1;
  const entry = { x: z0.x + bd[0] * z0.r * ez, z: z0.z + bd[1] * z0.r * ez }, exit = { x: entry.x + bd[0] * 1.6, z: entry.z + bd[1] * 1.6 };
  // боссы: k-й — в зоне k + extra, у выхода к следующей; главный — в глубине последней
  const bossAt = bosses.map((b, i) => { const z = zones[i + (X.extra || 0)], d = z.out != null ? DIRS[z.out] : z.in != null ? DIRS[z.in] : [1, 0], f = z.out != null ? .35 : .25; return { x: z.x + d[0] * z.r * f, z: z.z + d[1] * z.r * f, zone: z.k }; });
  bosses.forEach((b, i) => { b.x = bossAt[i].x; b.z = bossAt[i].z; });
  // ворота: проход после зоны босса закрыт до его гибели
  const doors = [];
  passes.forEach(ps => { const bi = bossAt.findIndex(q => q.zone === ps.a); if (bi < 0) return; ps.gate = bosses[bi].type; doors.push(gateDoor(ps.x, ps.z, ps.d, ps.w, 'gate:' + bosses[bi].type, { gate: bosses[bi].type })); });
  // костёр — у входа в последнюю зону (перед главным боссом)
  const zl = zones[nZ - 1], fd = zl.in != null ? DIRS[zl.in] : [1, 0], fire = cfg.dungeons.fire && cfg.dungeons.fire.on && nZ > 1 ? { x: zl.x - fd[0] * zl.r * .55, z: zl.z - fd[1] * zl.r * .55 } : null;
  const chests = [], props = [], traps = [], spawns = [], events = [], pillars = [];
  const busy = () => [entry, exit, fire, ...bossAt, ...chests, ...events, ...doors, ...traps.flatMap(q => [q, q.lever])].filter(Boolean);
  // залы боссов — поляны с обстановкой архетипа (ключевые залы, план подземелий 2а); провал — без ямы
  const K = cfg.dungeons.keyRooms, T = K && K.on && K.list[def0.id];
  bossAt.forEach((q, i) => { const kind = T && T.boss[Math.min(i, T.boss.length - 1)], A = X.arena; if (!kind) return;
    if (kind === 'colonnade') for (let c = 0; c < 8; c++) { const a = (c + .5) / 8 * Math.PI * 2; pillars.push({ x: q.x + Math.cos(a) * A * .75, z: q.z + Math.sin(a) * A * .75, r: .55 }); }
    for (const pr of propsOf({ x: q.x, z: q.z, w: A * 2, d: A * 2, kind }, rnd)) if (inside(pr.x, pr.z, 1.5) && Math.hypot(pr.x - q.x, pr.z - q.z) > 3) props.push(pr); });
  // карманы: тайник за трещиной, карман под ключ, особый зал, сундуки; ловушки — в проходах к карманам
  const lk = cfg.dungeons.locks, sec = cfg.dungeons.secrets, tr = cfg.dungeons.traps, order = pockets.slice().sort(() => rnd() - .5);
  const nSec = sec && sec.on ? (raid ? sec.raid : sec.dungeon) : 0, nLock = lk && lk.on ? Math.round(rr(rnd, raid ? lk.raid : lk.dungeon)) : 0, nTrap = tr && tr.on ? Math.round(rr(rnd, raid ? tr.raid : tr.dungeon)) : 0;
  order.forEach((pk, i) => {
    if (i < nSec) { pk.kind = 'secret'; doors.push(gateDoor(pk.mouth.x, pk.mouth.z, pk.d, P.w, 'crack', { crack: true })); chests.push({ kind: 'cache', x: pk.x, z: pk.z }); return; }
    if (i < nSec + nLock) { pk.kind = 'lock'; const kid = `${def0.id}_k${i - nSec + 1}`; doors.push(gateDoor(pk.mouth.x, pk.mouth.z, pk.d, P.w, kid, {})); chests.push({ kind: 'ironchest', x: pk.x, z: pk.z });
      const z = zones[Math.floor(rnd() * Math.min(nZ, pk.zone + 1))]; let kx = z.x, kz = z.z;
      for (let t = 0; t < 30; t++) { const a = rnd() * 6.283, d = z.r * (.4 + rnd() * .5); kx = z.x + Math.cos(a) * d; kz = z.z + Math.sin(a) * d; if (inside(kx, kz, 3) && busy().every(b => Math.hypot(b.x - kx, b.z - kz) > 6)) break; }
      chests.push({ kind: 'coffer', x: kx, z: kz, key: kid }); return; }
    pk.kind = 'open';
    if (rnd() < P.chest) chests.push({ kind: rnd() < .5 ? 'coffer' : 'grave', x: pk.x + (rnd() - .5) * pk.r * .6, z: pk.z + (rnd() - .5) * pk.r * .6 });
    if (rnd() < P.pack) spawns.push({ x: pk.x, z: pk.z, r: pk.r * .5, n: Math.round(rr(rnd, X.packs.n)) });
  });
  { const sp = (T && T.special) || [], open = order.filter(p => p.kind === 'open'); sp.slice(0, raid ? K.special.raid : K.special.dungeon).forEach((kind, i) => { const pk = open[i]; if (!pk) return; for (const pr of propsOf({ x: pk.x, z: pk.z, w: pk.r * 1.6, d: pk.r * 1.6, kind }, rnd)) if (inside(pr.x, pr.z, 1.2)) props.push(pr); }); }
  order.filter(p => p.kind !== 'secret').slice(0, nTrap).forEach((pk, i) => { const kind = ['spikes', 'fire', 'blade'][Math.floor(rnd() * 3)], d = DIRS[pk.d], along = d[0] ? 'x' : 'z', span = 4, wid = P.w + 2;
    const z = zones[pk.zone], lx = z.x + d[0] * z.r * .45 + (d[0] ? 0 : P.w / 2 + 2.5), lz = z.z + d[1] * z.r * .45 + (d[1] ? 0 : P.w / 2 + 2.5);     // рычаг — в зоне у начала прохода, сбоку
    traps.push({ id: i, kind, along, x: pk.mid.x, z: pk.mid.z, w: along === 'x' ? span : wid, d: along === 'x' ? wid : span, period: tr.period[kind], off: rnd() * tr.period[kind], lever: { x: lx, z: lz } }); });
  // события зон (засада, испытание, пленник, вор) — в зонах до главной
  const RE = cfg.dungeons.roomEvents, nEv = RE && RE.on ? (raid ? RE.raid : RE.dungeon) : 0, kinds = ROOM_EVENTS.slice();
  for (let n = 0, guard = 0; n < nEv && guard < 40 && kinds.length; guard++) { const z = zones[Math.floor(rnd() * Math.max(1, nZ - 1))], a = rnd() * 6.283, x = z.x + Math.cos(a) * z.r * .45, y = z.z + Math.sin(a) * z.r * .45;
    if (!inside(x, y, 8) || busy().some(b => Math.hypot(b.x - x, b.z - y) < 18)) continue;
    const kind = kinds.splice(Math.floor(rnd() * kinds.length), 1)[0]; events.push({ kind, room: 'z' + z.k + '_' + n, x, z: y, r: X.eventR });
    if (kind === 'trial') props.push({ t: 'shrine', x, z: y, r: 1, rot: 0 });
    if (kind === 'captive') props.push({ t: 'chain', x: x - 1.2, z: y - .6, rot: Math.PI / 2 }, { t: 'chain', x: x + 1.2, z: y - .6, rot: -Math.PI / 2 });
    n++; }
  // стаи врагов в зонах: не у входа, не на поляне босса, не на засаде и испытании
  for (const z of zones) { const n = Math.max(1, Math.round(Math.PI * z.r * z.r * (z.blobs.length * .6 + .4) / X.packs.area * (raid ? X.packs.raidMul : 1)));
    for (let k = 0, t = 0; k < n && t < n * 25; t++) { const b = z.blobs[Math.floor(rnd() * z.blobs.length)], a = rnd() * 6.283, d = b.r * Math.sqrt(rnd()) * .85, x = b.x + Math.cos(a) * d, y = b.z + Math.sin(a) * d;
      if (!inside(x, y, 4) || Math.hypot(x - entry.x, y - entry.z) < X.packs.keep || bossAt.some(q => Math.hypot(q.x - x, q.z - y) < X.arena + 4) || (fire && Math.hypot(fire.x - x, fire.z - y) < 12)) continue;
      if (events.some(e => (e.kind === 'ambush' || e.kind === 'trial') && Math.hypot(e.x - x, e.z - y) < e.r + 4) || spawns.some(s => Math.hypot(s.x - x, s.z - y) < X.packs.apart)) continue;
      spawns.push({ x, z: y, r: 4, n: Math.round(rr(rnd, X.packs.n)) }); k++; } }
  // озёра в зонах (по теме): не ходить, в виде — вода
  for (const z of zones) if (rnd() < (th ? th.ponds || 0 : 0)) for (let t = 0; t < 12; t++) { const a = rnd() * 6.283, d = z.r * (.3 + rnd() * .5), x = z.x + Math.cos(a) * d, y = z.z + Math.sin(a) * d, r = rr(rnd, X.pond);
    if (!inside(x, y, r + 6) || busy().some(b => Math.hypot(b.x - x, b.z - y) < r + 8) || spawns.some(s => Math.hypot(s.x - x, s.z - y) < r + 6)) continue; holes.push({ x, z: y, r }); break; }
  if ((def0.chests || []).length && bossAt.length) { const q = bossAt[bossAt.length - 1]; chests.push({ kind: 'altar', x: q.x, z: q.z + 3 }); }     // награда за главным боссом
  return { ...def0, wild: { theme: th ? Object.keys(X.themes).find(k => X.themes[k] === th) : null, S, seed, zones: zones.map(z => ({ k: z.k, x: z.x, z: z.z, r: z.r, ext: z.ext })),
    passes: passes.map(p => ({ a: p.a, b: p.b, x: p.x, z: p.z, w: p.w, d: p.d, gate: p.gate || null })), pockets: pockets.map(p => ({ zone: p.zone, x: p.x, z: p.z, r: p.r, d: p.d, mouth: p.mouth, kind: p.kind })) },
    rooms: [], doors, spawns, chests, entry, exit, fire, props, traps, events, pillars, bossPts: bossAt, gen: { seed, zones: nZ }, guard: null };
}
// дверь поперёк прохода: d — направление прохода (номер в DIRS), w — ширина прохода; лишнее за краем прохода уходит в склон
function gateDoor(x, z, d, w, lock, extra) {
  const vert = DIRS[d][0] !== 0, t = .8, e = 3, rect = vert ? { x0: x - t / 2, x1: x + t / 2, z0: z - w / 2 - e, z1: z + w / 2 + e } : { x0: x - w / 2 - e, x1: x + w / 2 + e, z0: z - t / 2, z1: z + t / 2 };
  return { x, z, vert, line: vert ? x : z, s0: (vert ? z : x) - w / 2, s1: (vert ? z : x) + w / 2, w, rect, open: 0, link: -1, lock, locked: true, cd: 0, ...extra };
}

// карта мира: поле расстояния сеткой, край и препятствия (валуны и деревья у края, рощи), двери, сундуки, выход; nav — устья проходов
export function makeWildMap(cfg, def) {
  const X = cfg.dungeons.wild, S = def.wild.S, c = X.sdf, rnd = mulberry(def.wild.seed + 77), th = wildTheme(cfg, def);
  const xs = S.circles.map(q => [q.x - q.r, q.x + q.r]).concat(S.caps.map(q => [Math.min(q.ax, q.bx) - q.r, Math.max(q.ax, q.bx) + q.r])), zs = S.circles.map(q => [q.z - q.r, q.z + q.r]).concat(S.caps.map(q => [Math.min(q.az, q.bz) - q.r, Math.max(q.az, q.bz) + q.r]));
  const B = { x0: Math.min(...xs.map(v => v[0])) - 6, x1: Math.max(...xs.map(v => v[1])) + 6, z0: Math.min(...zs.map(v => v[0])) - 6, z1: Math.max(...zs.map(v => v[1])) + 6 };
  const n = Math.ceil((B.x1 - B.x0) / c) + 1, m = Math.ceil((B.z1 - B.z0) / c) + 1, data = new Float32Array(n * m);
  for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) data[j * n + i] = shapeSdf(S, B.x0 + i * c, B.z0 + j * c);
  const sdf = { x0: B.x0, z0: B.z0, n, m, c, data }, map0 = { sdf };
  const props = (def.props || []).slice(), solids = [], busy = [def.entry, def.exit, def.fire, ...(def.chests || []), ...(def.events || []), ...(def.traps || []).flatMap(q => [q, q.lever]), ...(def.bossPts || [])].filter(Boolean);
  const free = (x, z, d) => busy.every(b => Math.hypot(b.x - x, b.z - z) > d) && (def.doors || []).every(g => Math.hypot(g.x - x, g.z - z) > g.w / 2 + 6) && (def.spawns || []).every(s => Math.hypot(s.x - x, s.z - z) > s.r + 1);
  // валуны и деревья у края: неровный край без невидимой стены; ближний к камере край — без деревьев
  const E = X.edge;
  for (let j = 0; j < m; j += 2) for (let i = 0; i < n; i += 2) { const s = data[j * n + i], x = B.x0 + i * c + (rnd() - .5) * c * 2, z = B.z0 + j * c + (rnd() - .5) * c * 2;
    if (s < E.band[0] || s > E.band[1] || rnd() > E.p || !free(x, z, 4)) continue;
    const south = wildSdfAt(map0, x, z - 6) > s + 2, tree = !south && rnd() < E.tree, r = rr(rnd, E.r);
    props.push({ t: tree ? 'w_tree' : 'w_rock', x, z, r: tree ? .6 : r * .8, s: tree ? .9 + rnd() * .4 : r * .55, rot: rnd() * 6.283 }); }
  // рощи и груды камней внутри зон: есть что обходить
  for (const zn of def.wild.zones) for (let g = 0, want = Math.round(rr(rnd, X.grove.n)); g < want; g++) { const a = rnd() * 6.283, d = zn.r * (.3 + rnd() * .55), gx = zn.x + Math.cos(a) * d, gz = zn.z + Math.sin(a) * d;
    if (wildSdfAt(map0, gx, gz) < X.grove.r + 3 || !free(gx, gz, X.grove.r + 8)) continue;
    const rock = rnd() < X.grove.rock;
    for (let t = 0, nt = Math.round(rr(rnd, X.grove.trees)); t < nt; t++) { const b = rnd() * 6.283, e = X.grove.r * Math.sqrt(rnd()), x = gx + Math.cos(b) * e, z = gz + Math.sin(b) * e, r = rr(rnd, E.r);
      if (props.some(p => p.r && Math.hypot(p.x - x, p.z - z) < p.r + 1.4)) continue;
      props.push(rock ? { t: 'w_rock', x, z, r: r * .8, s: r * .55, rot: rnd() * 6.283 } : { t: 'w_tree', x, z, r: .6, s: .9 + rnd() * .5, rot: rnd() * 6.283 }); } }
  // обстановка темы по зонам
  if (th) { const tot = th.decor.reduce((a, d) => a + d[1], 0);
    for (const zn of def.wild.zones) for (let k = 0, nk = Math.round(zn.r * zn.r / X.decorArea); k < nk; k++) { let u = rnd() * tot, t = th.decor[0][0]; for (const [dt, wt] of th.decor) if ((u -= wt) <= 0) { t = dt; break; }
      const a = rnd() * 6.283, d = zn.r * Math.sqrt(rnd()), x = zn.x + Math.cos(a) * d, z = zn.z + Math.sin(a) * d;
      if (wildSdfAt(map0, x, z) < 3 || !free(x, z, 4) || props.some(p => p.r && Math.hypot(p.x - x, p.z - z) < p.r + 2)) continue;
      props.push({ t, x, z, rot: rnd() * 6.283, s: .8 + rnd() * .6, ...(t === 'barrow' ? { r: 2.6 } : t === 'menhir' ? { r: .6 } : {}) }); } }
  for (const q of props) if (q.r) solids.push({ x: q.x, z: q.z, r: q.r });
  for (const q of def.pillars || []) solids.push({ x: q.x, z: q.z, r: q.r });
  const containers = (def.chests || []).map((q, i) => ({ id: i, kind: q.kind, x: q.x, z: q.z, b: -1, ready: false, t: 0, items: [], locked: false, keyTier: 0, key: q.key || null }));
  const doors = (def.doors || []).map((d, i) => ({ ...d, id: i, rect: { ...d.rect } }));
  // пути: узлы — зоны и карманы, связи — проходы с устьями по обе стороны и дверью, если есть
  const nz = def.wild.zones.length, areas = def.wild.zones.map(z => ({ x: z.x, z: z.z, r: z.ext })).concat(def.wild.pockets.map(p => ({ x: p.x, z: p.z, r: p.r + 2, pocket: true }))), links = [];
  def.wild.passes.forEach(p => { const D = DIRS[p.d], A = def.wild.zones[p.a], Bz = def.wild.zones[p.b]; links.push({ a: p.a, b: p.b, pa: { x: A.x + D[0] * (A.r * .5), z: A.z + D[1] * (A.r * .5) }, pb: { x: Bz.x - D[0] * (Bz.r * .5), z: Bz.z - D[1] * (Bz.r * .5) }, door: doors.findIndex(g => Math.hypot(g.x - p.x, g.z - p.z) < 1) }); });
  def.wild.pockets.forEach((p, i) => { const D = DIRS[p.d], A = def.wild.zones[p.zone]; links.push({ a: p.zone, b: nz + i, pa: { x: A.x + D[0] * (A.r * .5), z: A.z + D[1] * (A.r * .5) }, pb: { x: p.x, z: p.z }, door: doors.findIndex(g => Math.hypot(g.x - p.mouth.x, g.z - p.mouth.z) < 1) }); });
  const place = { id: def.id, name: def.name, type: 'dungeon', x: (B.x0 + B.x1) / 2, z: (B.z0 + B.z1) / 2, r: Math.hypot(B.x1 - B.x0, B.z1 - B.z0) / 2, danger: def.danger || 0 };
  const portals = [{ x: def.exit.x, z: def.exit.z, to: def.upTo || 'surface', tx: def.back.x, tz: def.back.z, up: true }];
  return { level: def.id, wild: def.wild, sdf, nav: { areas, links }, fire: def.fire || null, props, traps: (def.traps || []).map(q => ({ ...q, lever: { ...q.lever }, on: true, hit: {} })), events: (def.events || []).map(q => ({ ...q, st: 'idle', foes: [] })),
    path: cfg.dungeons.path, buildings: [], walls: [], blocks: [], rooms: [], links: [], adj: null, hops: null, doors, bounds: B, containers, portals, cfg: { places: [place], zones: [] }, solids, arcs: [], pits: [], pillars: def.pillars || [], decor: [], roads: [] };
}
// значение поля в точке (сетка, билинейно); вне сетки — далеко за краем
export function wildSdfAt(map, x, z) {
  const F = map.sdf, fi = (x - F.x0) / F.c, fj = (z - F.z0) / F.c;
  if (fi < 0 || fj < 0 || fi > F.n - 1.001 || fj > F.m - 1.001) return -20;
  const i = fi | 0, j = fj | 0, u = fi - i, v = fj - j, k = j * F.n + i, D = F.data;
  return D[k] * (1 - u) * (1 - v) + D[k + 1] * u * (1 - v) + D[k + F.n] * (1 - u) * v + D[k + F.n + 1] * u * v;
}
// область пути (зона или карман), где стоит точка: ближайшая, внутри которой точка; −1 — нигде
export function navArea(map, x, z) { const A = map.nav.areas; let best = -1, bd = Infinity; for (let i = 0; i < A.length; i++) { const d = Math.hypot(x - A[i].x, z - A[i].z) - A[i].r; if (d < bd) { bd = d; best = i; } } return best; }
// следующая точка пути к цели в другой области: устье прохода (сначала своё, потом — за проходом); запертая дверь без ключа — пути нет
export function navStep(map, x, z, tx, tz, keys = null) {
  const a = navArea(map, x, z), b = navArea(map, tx, tz); if (a < 0 || b < 0 || a === b) return null;
  const L = map.nav.links, prev = new Map([[a, -1]]), q = [a], shut = l => { const d = l.door >= 0 && map.doors[l.door]; return !!d && d.locked && !(keys && keys[d.lock]); };
  while (q.length && !prev.has(b)) { const r = q.shift(); L.forEach((l, i) => { const o = l.a === r ? l.b : l.b === r ? l.a : -1; if (o >= 0 && !prev.has(o) && !shut(l)) { prev.set(o, i); q.push(o); } }); }
  if (!prev.has(b)) return null;
  let r = b, li = prev.get(r); for (;;) { const l = L[li], o = l.a === r ? l.b : l.a; if (o === a) break; r = o; li = prev.get(r); }
  const l = L[li], [mine, far] = l.a === a ? [l.pa, l.pb] : [l.pb, l.pa];
  return Math.hypot(x - mine.x, z - mine.z) > 4 ? mine : far;
}
