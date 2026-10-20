// Большой мир (C3b): вокруг ручного ядра (лагерь, посёлки, логова — радиус worldgen.coreR) по зерну строится пояс до края мира.
// Чистая логика без графики (проверяется в Node). Выход — обычные части конфига: места, области, дома, ориентиры, связи посёлков,
// продолжение реки и мосты на нём. Дальше их строит нынешний код (дома, кладбища, руины, сундуки, тропы, таблицы врагов).
// biomeAt / biomeTint — какой биом в точке (пять секторов с волнистыми границами) и его оттенок земли с плавными стыками.
import { riverOf, waterDist } from './terrain3d.js';
import { castleFloors } from './castle3d.js';
import { styleDungeons } from './dungeonstyle3d.js';
import { zoneAt, zoneLevel, allZones } from './zones3d.js';

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

// доли биомов в точке (для текстур земли, 2026-10-20): те же сектора и мягкие стыки, что у biomeTint; core — ядро без биома
export function biomeWeights(cfg, x, z) {
  const G = cfg.worldgen, w = { core: 1 }; if (!G || !G.on || cfg.world.radius <= G.coreR) return w;
  const d = Math.hypot(x, z), kc = Math.max(0, Math.min(1, (d - G.coreR) / G.belt)); if (kc <= 0) return w;
  const n = BIOMES.length, f = turnOf(G, x, z) * n, i = Math.floor(f) % n, fr = f - Math.floor(f), edge = .12, a = BIOMES[i];
  w.core = 1 - kc; let o = null, k = 0;
  if (fr > 1 - edge) { k = (fr - (1 - edge)) / (2 * edge); o = BIOMES[(i + 1) % n]; } else if (fr < edge) { k = (edge - fr) / (2 * edge); o = BIOMES[(i + n - 1) % n]; }
  w[a] = (w[a] || 0) + kc * (1 - k); if (o) w[o] = (w[o] || 0) + kc * k;
  return w;
}

const NAMES = {
  village: [['Тихий', 'Сырой', 'Мшистый', 'Каменный', 'Серый', 'Ясный', 'Горький', 'Ветреный', 'Ольховый', 'Дальний', 'Нижний', 'Кривой'], ['Яр', 'Лог', 'Хутор', 'Двор', 'Ключ', 'Мыс', 'Бор', 'Затон', 'Выселок', 'Починок']],
  camp: [['Стоянка', 'Лагерь', 'Логово'], ['Волчья', 'Ржавых', 'Чёрных', 'Беглых', 'Серых', 'Дымная']],
  ruins: [['Руины', 'Развалины', 'Остов'], ['Сторожки', 'Часовни', 'Мельницы', 'Острога', 'Заставы', 'Усадьбы']],
  graveyard: [['Погост', 'Курганы', 'Кладбище'], ['Вдовий', 'Топкий', 'Старый', 'Безымянный', 'Немой', 'Гнилой']],
  farm: [['Брошенная ферма', 'Пустой хутор', 'Мёртвые поля'], ['у брода', 'на холме', 'у леса', 'за рекой', 'у топи', 'на отшибе']],
  bandits: [['Стоянка', 'Лёжка', 'Засека'], ['разбойников', 'лихих людей', 'беглых', 'Кривого', 'Рыжего', 'Безухого', 'Хромого', 'Чёрной шайки']],
  barrow: [['Курган', 'Могильник'], ['Старый', 'Безымянный', 'Вождя', 'Трёх воинов', 'Немой', 'Чёрный', 'Высокий', 'Ведьмин']],
  shrine: [['Святилище', 'Алтарь', 'Капище'], ['Ветра', 'Луны', 'Дуба', 'Родника', 'Звёзд', 'Камня', 'Зари', 'Предков', 'Тумана']],
  warcamp: [['Острог', 'Лагерь', 'Укрепление'], ['Ржавых', 'Пепельных', 'Кровавых', 'Чёрного клыка', 'Безглазых', 'Волчьей стаи', 'Серых плащей']],
  city: [['Павший', 'Мёртвый', 'Пепельный'], ['Вельград', 'Красноград', 'Остромир', 'Белоград', 'Звенигор']]
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
    let s = null; for (let t = 0; t < 40; t++) { s = freeSpot(T0.r[0], T0.r[1], 70, 30); if (!s || !cfg.map.links.some(([a, b]) => segD(s.x, s.z, a, b) < 48)) break; s = null; }     // не на тропе (с запасом на изгиб)
    if (!s) continue;
    const T = { ...T0, at: { x: s.x, z: s.z }, back: { x: s.x, z: s.z + 3 } }, C = castleFloors(T, cfg.world.seed * 7 + k * 101);
    cfg.dungeons.list.push(...C.floors); Object.assign(cfg.dungeons.keys, C.keys);
    cfg.map.places.push({ id: T.id, name: T.name, type: 'danger', x: s.x, z: s.z, r: 16, danger: 3, gen: 1, castle: true });
    cfg.map.castles.push({ id: T.id, x: s.x, z: s.z, name: T.name }); taken.push({ x: s.x, z: s.z, r: 34 });
    const top = C.floors[C.floors.length - 1]; if (T.boss && top.throne) cfg.bosses.list.push({ ...T.boss, x: top.throne.x + top.throne.w * .25, z: top.throne.z, level: top.id, castle: T.id, final: true });     // босс — в тронном зале
  }
  // плато с обрывами (C3c): в горах, вдали от мест, ориентиров и реки; 1–2 пологих въезда
  cfg.map.plateaus = [];
  for (let i = 0, tries = 0; i < G.plateaus.n && tries < 600; tries++) {
    const r0 = G.plateaus.r[0] + r() * (G.plateaus.r[1] - G.plateaus.r[0]), s = freeSpot(G.coreR + 60, R - r0 - 15, r0 + 18, r0 + 12); if (!s) break;
    if (cfg.map.links.some(([a, b]) => segD(s.x, s.z, a, b) < r0 + G.plateaus.len + 26) || biomeAt(cfg, s.x, s.z) !== 'mountains' || [0, 1.57, 3.14, 4.71].some(a => biomeAt(cfg, s.x + Math.sin(a) * r0, s.z + Math.cos(a) * r0) !== 'mountains')) continue;
    const a0 = r() * TAU, ramps = r() < .5 ? [a0] : [a0, a0 + Math.PI * (.7 + r() * .6)];
    cfg.map.plateaus.push({ x: s.x, z: s.z, r: r0, h: G.plateaus.h, ramps, rw: G.plateaus.rw, len: G.plateaus.len }); taken.push({ x: s.x, z: s.z, r: r0 + G.plateaus.len + 4 }); i++;
  }
  // точки интереса (G2): свой генератор — места выше не сдвигаются; не у троп, не в воде, не у других мест
  cfg.map.pois = [];
  if (G.pois) {
    const P = G.pois, rp = mul(cfg.world.seed * 2017 + 9);
    for (let i = 0, tries = 0; i < P.n && tries < P.n * 60; tries++) {
      const a = rp() * TAU, d = G.coreR + 25 + Math.sqrt(rp()) * (R - G.coreR - 50), x = Math.sin(a) * d, z = Math.cos(a) * d;
      const bio = biomeAt(cfg, x, z) || 'forest', tbl = P.kinds[bio]; let w = rp() * tbl.reduce((t, k) => t + k[1], 0), t = tbl[0][0];
      for (const [k, n] of tbl) { w -= n; if (w <= 0) { t = k; break; } }
      const pr = P.r[t];
      if (wetAt(x, z, Math.max(pr + 2, 13)) || taken.some(q => Math.hypot(q.x - x, q.z - z) < P.gap * .5 + pr + q.r) || cfg.map.links.some(([A, B]) => segD(x, z, A, B) < P.road + pr)) continue;
      const id = 'p' + i, k = (d - G.coreR) / (R - G.coreR); let place = null;
      if (t === 'bandits' || t === 'barrow') {
        place = { id, name: nameOf(r, t, used), type: 'danger', x, z, r: pr + 5, danger: Math.min(3, 1 + Math.floor(k * 3)), gen: 1, poi: t };
        cfg.map.zones.push({ type: t, x, z, r: pr - 2, biome: bio, gen: 1, poi: 1 });
      } else if (t === 'shrine') place = { id, name: nameOf(r, t, used), type: 'shrine', x, z, r: 7, safe: true, gen: 1, poi: t };      // у святилища враги не появляются
      if (place) cfg.map.places.push(place);
      cfg.map.pois.push({ id, t, x, z, r: pr, rot: rp() * TAU, bio, place: place && place.id }); taken.push({ x, z, r: pr + P.gap * .5 }); i++;
    }
  }
  // озёра и ручьи (2026-10-18): свой генератор — всё выше не сдвигается; озёра — не у мест, троп, логов и реки; пруды — маленькие озёра
  const WA = cfg.water;
  if (rv && WA) {
    const rl = mul(cfg.world.seed * 3031 + 11), lakes = [], LK = WA.lakes, shape = (x, z, r) => ({ x, z, r, a: [LK.amp[0] * (.5 + rl()), LK.amp[1] * (.5 + rl())], p: [rl() * TAU, rl() * TAU] });
    for (const q of cfg.map.pois) if (q.t === 'pond') lakes.push(shape(q.x, q.z, q.r * LK.pond));
    const lair = cfg.bosses.list.filter(b => !b.level), bioW = Object.values(LK.bio).reduce((a, b) => a + b, 0) / BIOMES.length;
    for (let i = 0, tries = 0; i < LK.n && tries < LK.n * 80; tries++) {
      const r0 = LK.r[0] + rl() * (LK.r[1] - LK.r[0]), a = rl() * TAU, d = G.coreR + 30 + r0 + Math.sqrt(rl()) * (R - G.coreR - 50 - r0 * 2), x = Math.sin(a) * d, z = Math.cos(a) * d;
      if (rl() * bioW * 2 > (LK.bio[biomeAt(cfg, x, z)] || 1)) continue;     // по биомам: на болоте чаще, в пустоши редко
      if (wetAt(x, z, r0 * 1.3 + 10) || taken.some(q => Math.hypot(q.x - x, q.z - z) < r0 * 1.3 + LK.gap + q.r) || lakes.some(q => Math.hypot(q.x - x, q.z - z) < (q.r + r0) * 1.3 + LK.gap)) continue;
      if (cfg.map.links.some(([A, B]) => segD(x, z, A, B) < r0 * 1.3 + LK.road) || lair.some(b => Math.hypot(b.x - x, b.z - z) < r0 * 1.3 + 20)) continue;
      lakes.push(shape(x, z, r0)); taken.push({ x, z, r: r0 * 1.3 }); i++;
    }
    // ручьи: от точки в лесу, горах или на болоте — к ближайшей воде (озеру или реке), петляя; через места не текут
    const ST = WA.streams, streams = [], waterNear = (x, z) => Math.min(waterDist(rv, x, z), ...lakes.map(L => Math.hypot(L.x - x, L.z - z) - L.r * .9));
    for (let i = 0, tries = 0; i < ST.n && tries < ST.n * 40; tries++) {
      const a = rl() * TAU, d = G.coreR + 20 + rl() * (R - G.coreR - 40), x0 = Math.sin(a) * d, z0 = Math.cos(a) * d;
      if (!['forest', 'mountains', 'swamp'].includes(biomeAt(cfg, x0, z0)) || taken.some(q => Math.hypot(q.x - x0, q.z - z0) < q.r + 6)) continue;
      let tgt = null, td = 1e9; for (const L of lakes) { const dd = Math.hypot(L.x - x0, L.z - z0); if (dd < td) { td = dd; tgt = { x: L.x, z: L.z }; } }
      for (const P of rv.pts) { const dd = Math.hypot(P.x - x0, P.z - z0); if (dd < td) { td = dd; tgt = P; } }
      if (!tgt || td < ST.from[0] || td > ST.from[1]) continue;
      const pts = [{ x: x0, z: z0 }]; let ang = Math.atan2(tgt.x - x0, tgt.z - z0), ok = false, bad = false;
      for (let k = 0; k < ST.max; k++) { const p = pts[pts.length - 1], want = Math.atan2(tgt.x - p.x, tgt.z - p.z); ang += (want - ang) * .35 + (rl() - .5) * ST.wobble * 2;
        const q = { x: p.x + Math.sin(ang) * ST.step, z: p.z + Math.cos(ang) * ST.step }; pts.push(q);
        if (taken.some(t => Math.hypot(t.x - q.x, t.z - q.z) < t.r) || Math.hypot(q.x, q.z) > R - 8) { bad = true; break; }
        if (waterNear(q.x, q.z) < 0) { ok = true; break; } }
      if (!ok || bad) continue;
      streams.push({ pts, w: ST.w[0] + rl() * (ST.w[1] - ST.w[0]) }); i++;
    }
    T.river.lakes = lakes; T.river.streams = streams;
  }
  // посёлки крупнее, вражеские лагеря и павшие города (2026-10-18): свой генератор — всё выше не сдвигается
  { const rc = mul(cfg.world.seed * 4049 + 13), L0 = (T && T.river) || {}, lakes = L0.lakes || [], streams = L0.streams || [];
    const wet2 = (x, z, pad) => wetAt(x, z, pad) || lakes.some(q => Math.hypot(q.x - x, q.z - z) < q.r * 1.3 + pad) || streams.some(st => st.pts.some((q, i) => i > 0 && segD(x, z, st.pts[i - 1], q) < pad));
    const onRoad = (x, z, pad) => cfg.map.links.some(([a, b]) => segD(x, z, a, b) < pad);
    const overB = (x, z, w, d, pad) => cfg.map.buildings.some(b => Math.abs(b.x - x) < (b.w + w) / 2 + pad && Math.abs(b.z - z) < (b.d + d) / 2 + pad);
    const big = [];     // лагеря и города: между собой не ближе gap
    const isPoi = q => cfg.map.pois.some(p => p.t !== 'pond' && Math.abs(p.x - q.x) < .01 && Math.abs(p.z - q.z) < .01);     // мелкая точка интереса (не пруд) — город может встать на её место
    const spot2 = (dMin, dMax, gap, pad, soft = false) => { for (let k = 0; k < 900; k++) { const a = rc() * TAU, d = dMin + Math.sqrt(rc()) * (dMax - dMin), x = Math.sin(a) * d, z = Math.cos(a) * d;
      if (wet2(x, z, pad) || onRoad(x, z, pad) || taken.some(q => !(soft && isPoi(q)) && Math.hypot(q.x - x, q.z - z) < pad + q.r) || big.some(q => Math.hypot(q.x - x, q.z - z) < gap) || (cfg.map.plateaus || []).some(q => Math.hypot(q.x - x, q.z - z) < q.r + q.len + pad)) continue; big.push({ x, z }); return { x, z }; } return null; };
    const doorTo = (ox, oz) => (Math.abs(ox) >= Math.abs(oz) ? (ox > 0 ? 'w' : 'e') : (oz > 0 ? 'n' : 's'));     // дверь — к центру
    // посёлки: ещё 2–4 дома внешним кольцом (не на тропе, не в воде, не на других домах); безопасная зона шире
    const VM = G.villagesMore;
    if (VM) for (const v of villages) {
      const k = VM.extra[0] + ((rc() * (VM.extra[1] - VM.extra[0] + 1)) | 0);
      for (let j = 0, t = 0; j < k && t < 30; t++) { const a = rc() * TAU, x = Math.round((v.x + Math.sin(a) * VM.ring) * 2) / 2, z = Math.round((v.z + Math.cos(a) * VM.ring) * 2) / 2, w = 5 + ((rc() * 3) | 0), d = 5 + ((rc() * 2) | 0);
        if (overB(x, z, w, d, 2.5) || wet2(x, z, 6) || onRoad(x, z, 5) || Math.hypot(x, z) > R - 12) continue;
        cfg.map.buildings.push({ x, z, w, d, door: doorTo(x - v.x, z - v.z), kind: ['house', 'hut', 'warehouse', 'house'][(rc() * 4) | 0], chests: ['chest', 'crate', 'barrel', 'sack', 'wardrobe'].filter(() => rc() < .4).slice(0, 2), vil: v.id }); j++; }
      v.r = 21;
    }
    // вражеские лагеря: квадрат частокола, ворота к центру мира и напротив; гарнизон и вожак — при подходе героя (sim.js → garrisons)
    const F = G.forts; cfg.map.forts = [];
    if (F) for (let i = 0; i < F.n; i++) {
      const s = spot2(G.coreR + 70, R - F.H - 20, F.gap, F.H * 1.42 + 4); if (!s) continue;
      const k = (Math.hypot(s.x, s.z) - G.coreR) / (R - G.coreR), id = 'wf' + i;
      cfg.map.places.push({ id, name: nameOf(rc, 'warcamp', used), type: 'danger', x: s.x, z: s.z, r: F.H + 5, danger: Math.min(3, 2 + Math.floor(k * 1.6)), gen: 1, fort: true });
      cfg.map.zones.push({ type: 'warcamp', x: s.x, z: s.z, w: F.H * 2 - 4, d: F.H * 2 - 4, gen: 1 });
      const toC = Math.abs(s.x) > Math.abs(s.z) ? (s.x > 0 ? 'w' : 'e') : (s.z > 0 ? 'n' : 's'), opp = { w: 'e', e: 'w', n: 's', s: 'n' }[toC];
      cfg.map.forts.push({ id, x: s.x, z: s.z, H: F.H, gate: F.gate, gates: [toC, opp], tents: F.tents }); taken.push({ x: s.x, z: s.z, r: F.H * 1.45 + 8 });
    }
    // павшие города: каменные стены, ворота на четыре стороны, дома кварталами вокруг площади, босс на площади; дорога — к ближайшему посёлку
    const CI = G.cities; cfg.map.cities = [];
    if (CI) for (let i = 0; i < CI.n; i++) {
      const s = spot2(CI.ring[0], Math.min(CI.ring[1], R - CI.H - 20), CI.gap, CI.H * 1.42 + 6, true); if (!s) continue;
      const id = 'wc' + i, H = CI.H;
      { const gone = cfg.map.pois.filter(p => p.t !== 'pond' && Math.abs(p.x - s.x) < H + p.r + 4 && Math.abs(p.z - s.z) < H + p.r + 4), ids = new Set(gone.map(p => p.place).filter(Boolean));     // точки интереса на месте города убираются вместе с их местами
        cfg.map.pois = cfg.map.pois.filter(p => !gone.includes(p)); cfg.map.places = cfg.map.places.filter(p => !ids.has(p.id)); cfg.map.zones = cfg.map.zones.filter(zn => !(zn.poi && gone.some(p => Math.abs(p.x - zn.x) < .01 && Math.abs(p.z - zn.z) < .01))); }
      cfg.map.places.push({ id, name: nameOf(rc, 'city', used), type: 'danger', x: s.x, z: s.z, r: H + 4, danger: 3, gen: 1, city: true });
      cfg.map.zones.push({ type: 'city', x: s.x, z: s.z, w: H * 2 - 4, d: H * 2 - 4, gen: 1 });
      const cells = []; for (const ox of [-24, -12, 0, 12, 24]) for (const oz of [-24, -12, 0, 12, 24]) if (Math.max(Math.abs(ox), Math.abs(oz)) > CI.plaza + 2 && ox !== 0 && oz !== 0) cells.push([ox, oz]);     // кварталы; улицы по осям — к воротам
      for (let j = 0; j < CI.houses && cells.length; j++) { const [ox, oz] = cells.splice((rc() * cells.length) | 0, 1)[0], w = 7 + ((rc() * 2) | 0), d = 6 + ((rc() * 2) | 0);
        cfg.map.buildings.push({ x: s.x + ox, z: s.z + oz, w, d, door: doorTo(ox, oz), kind: ['house', 'warehouse', 'house', 'hut'][(rc() * 4) | 0], chests: ['locked', 'ironchest', 'chest', 'wardrobe', 'coffer'].filter(() => rc() < .45).slice(0, 2), vil: id, city: id }); }
      cfg.bosses.list.push({ ...CI.bosses[i % CI.bosses.length], x: s.x, z: s.z, city: id });
      cfg.map.cities.push({ id, x: s.x, z: s.z, H, gate: CI.gate, name: cfg.map.places[cfg.map.places.length - 1].name }); taken.push({ x: s.x, z: s.z, r: H * 1.45 + 10 });
      const to = villages.reduce((a, v) => (!a || Math.hypot(v.x - s.x, v.z - s.z) < Math.hypot(a.x - s.x, a.z - s.z) ? v : a), null);     // дорога — к ближайшему посёлку, из ворот на его сторону
      if (to) { const dx = to.x - s.x, dz = to.z - s.z, gs = [['s', 0, 1], ['n', 0, -1], ['e', 1, 0], ['w', -1, 0]].reduce((a, q) => (q[1] * dx + q[2] * dz > a[1] * dx + a[2] * dz ? q : a)); const lk = [{ x: to.x, z: to.z }, { x: s.x + gs[1] * (H + 6), z: s.z + gs[2] * (H + 6) }]; cfg.map.links.push(lk);
        const gone = cfg.map.pois.filter(p => p.t !== 'pond' && segD(p.x, p.z, lk[0], lk[1]) < p.r + 14), ids = new Set(gone.map(p => p.place).filter(Boolean));     // точки интереса на новой дороге убираются (тропа гнётся до ~12 м)
        cfg.map.pois = cfg.map.pois.filter(p => !gone.includes(p)); cfg.map.places = cfg.map.places.filter(p => !ids.has(p.id)); cfg.map.zones = cfg.map.zones.filter(zn => !(zn.poi && gone.some(p => Math.abs(p.x - zn.x) < .01 && Math.abs(p.z - zn.z) < .01))); }
    }
    // города-узлы зон (этап 1, 2026-10-19): в каждой зоне за ядром — посёлок с торговцем и кузнецом; ближайший к внутренней границе зоны,
    // а где посёлка нет — новый (свой генератор: всё выше не сдвигается), с дорогой к ближайшему посёлку
    if (cfg.zones) { const rh = mul(cfg.world.seed * 6151 + 29), Z = cfg.zones;
      for (const zone of allZones(cfg).filter(q => q.ring >= 0)) {
        let hub = villages.map(v => ({ v, q: zoneAt(cfg, v.x, v.z) })).filter(o => o.q.id === zone.id).sort((a, b) => a.q.t - b.q.t)[0]?.v;
        if (!hub) { let s = null; for (let k = 0; k < 900 && !s; k++) { const a = rh() * TAU, d = G.coreR + 30 + rh() * (R - G.coreR - 60), x = Math.sin(a) * d, z = Math.cos(a) * d, q = zoneAt(cfg, x, z);
            if (q.id !== zone.id || q.t < .12 || q.t > .5 || wet2(x, z, 20) || onRoad(x, z, 14) || taken.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 20) || (cfg.map.plateaus || []).some(o => Math.hypot(o.x - x, o.z - z) < o.r + o.len + 20)) continue; s = { x, z }; }
          if (!s) continue;
          hub = { id: 'h_' + zone.id, name: nameOf(rh, 'village', used), type: 'hamlet', x: s.x, z: s.z, r: 21, safe: true, gen: 1 }; cfg.map.places.push(hub); taken.push({ x: s.x, z: s.z, r: 24 });
          for (let j = 0, a0 = rh() * TAU; j < 4; j++) { const a = a0 + j * TAU / 4, bx = Math.round((s.x + Math.sin(a) * 9) * 2) / 2, bz = Math.round((s.z + Math.cos(a) * 9) * 2) / 2;
            cfg.map.buildings.push({ x: bx, z: bz, w: 6 + (j % 2), d: 5, door: doorTo(bx - s.x, bz - s.z), kind: j < 2 ? 'house' : ['hut', 'warehouse'][j % 2], chests: j > 1 ? ['chest'] : [], vil: hub.id }); }
          const to = [...villages, ...gates.map(g => ({ x: g.x, z: g.z }))].reduce((a, v) => (!a || Math.hypot(v.x - s.x, v.z - s.z) < Math.hypot(a.x - s.x, a.z - s.z) ? v : a), null);
          const lk = [{ x: to.x, z: to.z }, { x: s.x, z: s.z }]; cfg.map.links.push(lk); villages.push(hub);
          const gone = cfg.map.pois.filter(p => p.t !== 'pond' && segD(p.x, p.z, lk[0], lk[1]) < p.r + 14), ids = new Set(gone.map(p => p.place).filter(Boolean));     // точки интереса на новой дороге убираются
          cfg.map.pois = cfg.map.pois.filter(p => !gone.includes(p)); cfg.map.places = cfg.map.places.filter(p => !ids.has(p.id)); cfg.map.zones = cfg.map.zones.filter(zn => !(zn.poi && gone.some(p => Math.abs(p.x - zn.x) < .01 && Math.abs(p.z - zn.z) < .01))); }
        hub.hub = zone.id; if (Z.hub.names && Z.hub.names[zone.id]) hub.name = Z.hub.names[zone.id];     // своё имя узла (Ставка короля — Акт II)
        const hb = cfg.map.buildings.filter(b => b.vil === hub.id && !b.npc);
        Z.hub.npcs.forEach((k, i) => { if (hb[i]) { hb[i].npc = k; hb[i].chests = []; } });     // торговец и кузнец — в домах узла
      } }
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
  // подземелья зон (этап 5): вход из config (ядро) или место в своей зоне с уровнем lv ±1, не у троп и воды; последним и своим генератором — остальной мир не сдвигается
  { const ri = mul(cfg.world.seed * 4049 + 3), RV = (T && T.river) || {}, wet3 = (x, z, pad) => wetAt(x, z, pad) || (RV.lakes || []).some(q => Math.hypot(q.x - x, q.z - z) < q.r * 1.3 + pad) || (RV.streams || []).some(st => st.pts.some(q => Math.hypot(q.x - x, q.z - z) < pad));
    for (const I of (cfg.instances && cfg.instances.list) || []) {
      let at = I.at || null;
      for (let k = 0; !at && k < 3000; k++) {
        const a = ri() * TAU, d = G.coreR + 30 + ri() * (R - G.coreR - 60), x = Math.sin(a) * d, z = Math.cos(a) * d, q = zoneAt(cfg, x, z);
        if (!q || q.id !== I.zone || Math.abs(zoneLevel(cfg, x, z) - I.lv) > 1 || wet3(x, z, 14) || taken.some(t => Math.hypot(t.x - x, t.z - z) < t.r + 22) || cfg.map.links.some(([p0, p1]) => segD(x, z, p0, p1) < 20)) continue;
        at = { x, z };
      }
      if (!at) continue;
      cfg.dungeons.list.push({ id: I.id, name: I.name, inst: true, raid: !!I.raid, at, back: I.back || { x: at.x, z: at.z + 3 }, level: I.level, depth: I.depth, danger: I.danger, rooms: I.rooms, doors: I.doors, foes: I.foes, spawns: I.spawns, entry: I.entry, exit: I.exit, chests: I.chests });
      taken.push({ x: at.x, z: at.z, r: 10 });
      I.bosses.forEach((B, k) => { const rm = I.rooms.find(q => q.id === B.room); cfg.bosses.list.push({ ...B, x: rm.x, z: rm.z, level: I.id, base: I.base, inst: I.id, final: k === I.bosses.length - 1 }); });     // final — главный босс подземелья
    }
  }
  return styleDungeons(cfg);     // облик подземелий: крупнее, необычные залы (2026-10-20)
}
