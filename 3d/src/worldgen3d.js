// Большой мир (C3b): вокруг ручного ядра (лагерь, посёлки, логова — радиус worldgen.coreR) по зерну строится пояс до края мира.
// Чистая логика без графики (проверяется в Node). Выход — обычные части конфига: места, области, дома, ориентиры, связи посёлков,
// продолжение реки и мосты на нём. Дальше их строит нынешний код (дома, кладбища, руины, сундуки, тропы, таблицы врагов).
// biomeAt / biomeTint — какой биом в точке (пять секторов с волнистыми границами) и его оттенок земли с плавными стыками.
import { riverOf, waterDist } from './terrain3d.js';
import { castleFloors } from './castle3d.js';

const TAU = Math.PI * 2;
const mul = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
export const BIOMES = ['forest', 'swamp', 'mountains', 'waste', 'coast'];

// доля оборота 0..1 с волной границы (зависит от угла и расстояния) — сектор биома
function turnOf(G, x, z) { const d = Math.hypot(x, z), a = (Math.atan2(x, z) / TAU + 1 + G.turn) % 1; return (a + G.wobble * (Math.sin(a * TAU * 3 + d * .021) + .5 * Math.sin(d * .047 + 1.3)) + 1) % 1; }
export function biomeAt(cfg, x, z) {
  const G = cfg.worldgen; if (!G || !G.on || cfg.world.radius <= G.coreR || Math.hypot(x, z) < G.coreR + G.belt / 2) return null;
  return BIOMES[Math.floor(turnOf(G, x, z) * BIOMES.length) % BIOMES.length];
}
// множитель цвета земли [r, g, b]: травяная текстура × множитель ≈ цвет земли биома (в линейном цвете); у ядра — 1;
// на стыках секторов и у ядра — плавно
const lin = h => [1, 3, 5].map(i => { const c = parseInt(h.slice(i, i + 2), 16) / 255; return c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); });
const TINTS = new WeakMap();
function tints(cfg) { const G = cfg.worldgen; let T = TINTS.get(G); if (!T) { const base = lin(cfg.look.ground[1]); T = Object.fromEntries(BIOMES.map(b => [b, lin(G.ground[b]).map((v, i) => v / base[i])])); TINTS.set(G, T); } return T; }
export function biomeTint(cfg, x, z) {
  const G = cfg.worldgen; if (!G || !G.on || cfg.world.radius <= G.coreR) return [1, 1, 1];
  const TT = tints(cfg);
  const d = Math.hypot(x, z), kc = Math.max(0, Math.min(1, (d - G.coreR) / G.belt)); if (kc <= 0) return [1, 1, 1];
  const n = BIOMES.length, f = turnOf(G, x, z) * n, i = Math.floor(f) % n, fr = f - Math.floor(f), edge = .12;
  let t = TT[BIOMES[i]];
  if (fr > 1 - edge) { const k = (fr - (1 - edge)) / (2 * edge), o = TT[BIOMES[(i + 1) % n]]; t = t.map((v, j) => v + (o[j] - v) * k); }
  else if (fr < edge) { const k = (edge - fr) / (2 * edge), o = TT[BIOMES[(i + n - 1) % n]]; t = t.map((v, j) => v + (o[j] - v) * k); }
  return t.map(v => 1 + (v - 1) * kc);
}

const NAMES = {
  village: [['Тихий', 'Сырой', 'Мшистый', 'Каменный', 'Серый', 'Ясный', 'Горький', 'Ветреный', 'Ольховый', 'Дальний', 'Нижний', 'Кривой'], ['Яр', 'Лог', 'Хутор', 'Двор', 'Ключ', 'Мыс', 'Бор', 'Затон', 'Выселок', 'Починок']],
  camp: [['Стоянка', 'Лагерь', 'Логово'], ['Волчья', 'Ржавых', 'Чёрных', 'Беглых', 'Серых', 'Дымная']],
  ruins: [['Руины', 'Развалины', 'Остов'], ['Сторожки', 'Часовни', 'Мельницы', 'Острога', 'Заставы', 'Усадьбы']],
  graveyard: [['Погост', 'Курганы', 'Кладбище'], ['Вдовий', 'Топкий', 'Старый', 'Безымянный', 'Немой', 'Гнилой']],
  farm: [['Брошенная ферма', 'Пустой хутор', 'Мёртвые поля'], ['у брода', 'на холме', 'у леса', 'за рекой', 'у топи', 'на отшибе']]
};
const nameOf = (r, kind, used) => { const [a, b] = NAMES[kind]; for (let k = 0; k < 40; k++) { const n = a[(r() * a.length) | 0] + ' ' + (kind === 'village' ? b[(r() * b.length) | 0] : b[(r() * b.length) | 0]); if (!used.has(n)) { used.add(n); return n; } } return a[0] + ' ' + used.size; };

// продолжение реки от конца ядра к краю мира: шаг step м, поворот не больше max от направления «наружу»
function extendRiver(r, from, prev, R, step) {
  const out = []; let p = from, ang = Math.atan2(from.x - prev.x, from.z - prev.z);
  for (let k = 0; k < 400 && Math.hypot(p.x, p.z) < R + 8; k++) {
    const rad = Math.atan2(p.x, p.z); let da = ang - rad; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
    ang = rad + Math.max(-1, Math.min(1, da + (r() - .5) * .5));                  // извилисто, но наружу
    p = { x: p.x + Math.sin(ang) * step, z: p.z + Math.cos(ang) * step }; out.push(p);
  }
  return out;
}
// расстояние от точки до отрезка ab
const segD = (x, z, a, b) => { const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2)); return Math.hypot(x - a.x - dx * t, z - a.z - dz * t); };
// пересечение отрезков ab и cd: доля по ab или -1
function cross(a, b, c, d) {
  const rx = b.x - a.x, rz = b.z - a.z, sx = d.x - c.x, sz = d.z - c.z, den = rx * sz - rz * sx; if (Math.abs(den) < 1e-9) return -1;
  const t = ((c.x - a.x) * sz - (c.z - a.z) * sx) / den, u = ((c.x - a.x) * rz - (c.z - a.z) * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : -1;
}

export function expandWorld(base) {
  const cfg = JSON.parse(JSON.stringify(base)), G = cfg.worldgen, R = cfg.world.radius;
  if (!G || !G.on || R <= G.coreR) return cfg;
  const r = mul(cfg.world.seed * 1013 + 5), used = new Set(cfg.map.places.map(p => p.name)), T = cfg.terrain;
  cfg.world.depth = [[0, 0], [G.coreR, 1], [R, G.depthMax]]; cfg.world.depthMax = G.depthMax;
  cfg.world.props = Math.round(cfg.world.props * ((R - 1) ** 2 - 49) / ((G.coreR - 1) ** 2 - 49));     // плотность деревьев как в ядре
  // река: ядро на прежнем радиусе, концы продлеваются к краю мира
  let rv = null;
  if (T && T.on && T.river) {
    T.river.rad = G.coreR + T.river.out;
    const core = riverOf(cfg).pts, n = core.length;
    T.river.head = extendRiver(r, core[0], core[1], R, G.riverStep).reverse(); T.river.tail = extendRiver(r, core[n - 1], core[n - 2], R, G.riverStep);
    rv = riverOf(cfg);
  }
  const wetAt = (x, z, pad) => !!rv && waterDist(rv, x, z) < pad;
  const taken = [...cfg.map.places.map(p => ({ x: p.x, z: p.z, r: p.r }))];
  const freeSpot = (dMin, dMax, gap, pad) => { for (let k = 0; k < 400; k++) { const a = r() * TAU, d = dMin + Math.sqrt(r()) * (dMax - dMin), x = Math.sin(a) * d, z = Math.cos(a) * d;
    if (wetAt(x, z, pad) || taken.some(q => Math.hypot(q.x - x, q.z - z) < gap + q.r)) continue; return { x, z }; } return null; };
  // посёлки: безопасные места с 2–4 домами кольцом, двери к центру
  const villages = [];
  for (let i = 0; i < G.villages; i++) {
    const s = freeSpot(G.coreR + 50, R - 45, G.villageGap, 22); if (!s) break;
    const id = 'v' + i, pl = { id, name: nameOf(r, 'village', used), type: 'hamlet', x: s.x, z: s.z, r: 15, safe: true, gen: 1 };
    cfg.map.places.push(pl); taken.push({ x: s.x, z: s.z, r: 18 }); villages.push(pl);
    const k = 2 + ((r() * 3) | 0), a0 = r() * TAU;
    for (let j = 0; j < k; j++) {
      const a = a0 + j * TAU / k + (r() - .5) * .3, bx = s.x + Math.sin(a) * 8.5, bz = s.z + Math.cos(a) * 8.5, w = 6 + ((r() * 3) | 0), d = 5 + ((r() * 2) | 0);
      const door = Math.abs(Math.sin(a)) > Math.abs(Math.cos(a)) ? (Math.sin(a) > 0 ? 'w' : 'e') : (Math.cos(a) > 0 ? 'n' : 's');
      cfg.map.buildings.push({ x: Math.round(bx * 2) / 2, z: Math.round(bz * 2) / 2, w, d, door, kind: ['house', 'hut', 'warehouse'][(r() * 3) | 0], chests: ['chest', 'crate', 'barrel', 'sack', 'wardrobe'].filter(() => r() < .4).slice(0, 2), vil: id });
    }
  }
  // опасные места: вид по биому, опасность растёт к краю мира
  for (let i = 0; i < G.dangers; i++) {
    const s = freeSpot(G.coreR + 40, R - 30, G.dangerGap, 16); if (!s) break;
    const bio = biomeAt(cfg, s.x, s.z) || 'forest', kinds = G.dangerTypes[bio], type = kinds[(r() * kinds.length) | 0];
    const zone = type === 'graveyard' ? { type, x: s.x, z: s.z, w: 22, d: 16 } : type === 'farm' ? { type, x: s.x, z: s.z, w: 24, d: 18 } : { type, x: s.x, z: s.z, r: type === 'ruins' ? 9 : 7 };
    const pr = zone.w ? Math.max(zone.w, zone.d) / 2 + 8 : zone.r + 7, k = (Math.hypot(s.x, s.z) - G.coreR) / (R - G.coreR);
    cfg.map.places.push({ id: 'd' + i, name: nameOf(r, type, used), type: 'danger', x: s.x, z: s.z, r: pr, danger: Math.min(3, 1 + Math.floor(k * 3)), gen: 1 });
    cfg.map.zones.push({ ...zone, biome: bio, gen: 1 }); taken.push({ x: s.x, z: s.z, r: pr });
  }
  // ориентиры: башни, мельницы, руины крепостей (видно издалека; твёрдые)
  cfg.map.landmarks = [];
  for (let i = 0; i < G.landmarks; i++) {
    const s = freeSpot(G.coreR + 30, R - 20, 30, 8); if (!s) break;
    const bio = biomeAt(cfg, s.x, s.z) || 'forest', kinds = G.landmarkTypes[bio], t = kinds[(r() * kinds.length) | 0];
    cfg.map.landmarks.push({ t, x: s.x, z: s.z, r: { tower: 2.2, mill: 2.4, fort: 3.4 }[t], rot: r() * TAU }); taken.push({ x: s.x, z: s.z, r: 8 });
  }
  // связи: каждый посёлок — к ближайшему узлу ближе к центру (ворота лагеря или другой посёлок); мосты там, где связь пересекает реку
  const C = cfg.camp, gates = C ? C.gates.map(g => { const a = g * Math.PI / 180; return { x: C.x + Math.sin(a) * (C.r + C.roadOut), z: C.z + Math.cos(a) * (C.r + C.roadOut) }; }) : [{ x: 0, z: 0 }];
  cfg.map.links = [];
  const order = [...villages].sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z)), nodes = [...gates];
  for (const v of order) {
    const to = nodes.reduce((a, q) => (Math.hypot(q.x - v.x, q.z - v.z) < Math.hypot(a.x - v.x, a.z - v.z) ? q : a));
    cfg.map.links.push([{ x: to.x, z: to.z }, { x: v.x, z: v.z }]); nodes.push({ x: v.x, z: v.z });
  }
  // замки (C4): вход — ворота в дальнем поясе; этажи — подземелья по зерну
  cfg.map.castles = [];
  for (const [k, T0] of (G.castles || []).entries()) {
    const s = freeSpot(T0.r[0], T0.r[1], 70, 30); if (!s) continue;
    const T = { ...T0, at: { x: s.x, z: s.z }, back: { x: s.x, z: s.z + 3 } }, C = castleFloors(T, cfg.world.seed * 7 + k * 101);
    cfg.dungeons.list.push(...C.floors); Object.assign(cfg.dungeons.keys, C.keys);
    cfg.map.places.push({ id: T.id, name: T.name, type: 'danger', x: s.x, z: s.z, r: 16, danger: 3, gen: 1, castle: true });
    cfg.map.castles.push({ id: T.id, x: s.x, z: s.z, name: T.name }); taken.push({ x: s.x, z: s.z, r: 34 });
  }
  // плато с обрывами (C3c): в горах, вдали от мест, ориентиров и реки; 1–2 пологих въезда
  cfg.map.plateaus = [];
  for (let i = 0, tries = 0; i < G.plateaus.n && tries < 600; tries++) {
    const r0 = G.plateaus.r[0] + r() * (G.plateaus.r[1] - G.plateaus.r[0]), s = freeSpot(G.coreR + 60, R - r0 - 15, r0 + 18, r0 + 12); if (!s) break;
    if (cfg.map.links.some(([a, b]) => segD(s.x, s.z, a, b) < r0 + G.plateaus.len + 26) || biomeAt(cfg, s.x, s.z) !== 'mountains' || [0, 1.57, 3.14, 4.71].some(a => biomeAt(cfg, s.x + Math.sin(a) * r0, s.z + Math.cos(a) * r0) !== 'mountains')) continue;
    const a0 = r() * TAU, ramps = r() < .5 ? [a0] : [a0, a0 + Math.PI * (.7 + r() * .6)];
    cfg.map.plateaus.push({ x: s.x, z: s.z, r: r0, h: G.plateaus.h, ramps, rw: G.plateaus.rw, len: G.plateaus.len }); taken.push({ x: s.x, z: s.z, r: r0 + G.plateaus.len + 4 }); i++;
  }
  if (rv) {
    const extra = [], B = T.bridge;
    for (const [a, b] of cfg.map.links) for (let i = 1; i < rv.pts.length; i++) {
      const t = cross(a, b, rv.pts[i - 1], rv.pts[i]); if (t < 0) continue;
      const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, P = rv.pts[i - 1], Q = rv.pts[i];
      if ([...rv.bridges, ...extra].some(q => Math.hypot(q.x - x, q.z - z) < 15)) continue;
      extra.push({ x, z, ang: Math.atan2(Q.x - P.x, Q.z - P.z) + Math.PI / 2, len: T.river.w + B.over * 2, w: B.w });
    }
    T.river.extraBridges = extra;
  }
  return cfg;
}
