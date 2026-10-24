// Ключевые залы подземелий (план подземелий, этап 2а, решение владельца 2026-10-24): путь и ветви — генератор, а залы боссов
// и 1–2 особых зала у каждого подземелья — свои, узнаваемые: форма и обстановка по архетипу из таблицы dungeons.keyRooms.list.
// Архетипы боссов: arena (круг, жаровни), throne (статуя-трон, жаровни, ковёр, знамёна), colonnade (колонны, свечи),
// chasm (провал с мостом, цепи), crypt (восьмигранник, надгробия). Особые: ossuary (черепа и кости), armory (оружие, ящики,
// чучела), shrine (святилище, свечи, статуи), prison (клетки, цепи). Предметы с r — твёрдые (колонна, статуя, жаровня).
// Числа — config3d.js → dungeons.keyRooms. Чистая логика.
const SHAPE = { arena: 'round', throne: 'rect', colonnade: 'pillars', chasm: 'pit', crypt: 'oct', ossuary: 'rect', armory: 'rect', shrine: 'round', prison: 'rect' };
export const BOSS_ARCH = ['arena', 'throne', 'colonnade', 'chasm', 'crypt'];
export const SPECIAL_ARCH = ['ossuary', 'armory', 'shrine', 'prison'];

// форма зала по архетипу (числа формы — dungeons.style, как у залов стиля)
export function shapeRoom(cfg, r, kind) {
  const S = cfg.dungeons.style, sh = SHAPE[kind] || 'rect'; r.kind = kind; r.fill = 'normal';
  if (sh === 'rect') return r;     // прямоугольный — без формы (стиль его не трогает: у зала есть kind)
  r.shape = sh;
  if (sh === 'oct') r.cut = Math.min(r.w, r.d) * S.octCut;
  if (sh === 'pit') { r.pitPad = S.pit.pad; r.bridge = S.pit.bridge; }
  if (sh === 'pillars') { r.cols = 8; r.colR = S.pillars.r; }
  return r;
}
// обстановка зала: [{ t, x, z, rot, s, r }] — r: радиус твёрдого предмета; дальняя от камеры стена — z0, ближняя (z1) — без предметов
export function propsOf(r, rnd = Math.random) {
  const out = [], x0 = r.x - r.w / 2, x1 = r.x + r.w / 2, z0 = r.z - r.d / 2, m = Math.min(r.w, r.d), P = (t, x, z, o = {}) => out.push({ t, x, z, rot: 0, ...o });
  const ring = (t, n, k, o = {}) => { for (let i = 0; i < n; i++) { const a = (i + .5) / n * Math.PI * 2; P(t, r.x + Math.cos(a) * r.w * k, r.z + Math.sin(a) * r.d * k, o); } };
  switch (r.kind) {
    case 'arena': ring('brazier', 6, .36, { r: .5 }); for (let i = 0; i < 4; i++) P('bones', r.x + (rnd() - .5) * m * .5, r.z + (rnd() - .5) * m * .5, { rot: rnd() * 6.28 }); break;
    case 'throne': P('statue', r.x, z0 + 1.8, { r: 1, s: 1.3 }); for (const sx of [-1, 1]) { P('brazier', r.x + sx * 3.4, z0 + 2.4, { r: .5 }); P('kbanner', r.x + sx * r.w * .3, z0 + .1, { rot: 0 }); }
      for (let k = 0; k < 7; k++) P('rug', r.x, z0 + 3.4 + k * 1.15, { rot: Math.PI / 2, c: '#6a1a18' }); break;
    case 'colonnade': for (const sx of [-1, 1]) P('brazier', r.x + sx * r.w * .12, z0 + 1.6, { r: .5 }); for (const [cx, cz] of [[x0 + .6, z0 + .6], [x1 - .6, z0 + .6]]) P('candles', cx, cz); break;
    case 'chasm': for (const sx of [-1, 1]) P('chain', r.x + sx * r.w * .3, z0 + .08); P('skulls', r.x + 1.2, r.z + .4, { rot: rnd() * 6.28 }); break;
    case 'crypt': for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) P('tomb', r.x + sx * r.w * .3, r.z - r.d * .2 + k * r.d * .18, { r: .6, rot: sx * Math.PI / 2, s: 2 }); break;
    case 'ossuary': for (let k = 0; k < 10; k++) { const t = k % 2 ? 'bones' : 'skulls', side = k % 3; P(t, side === 0 ? x0 + .9 : side === 1 ? x1 - .9 : x0 + 1.5 + rnd() * (r.w - 3), side === 2 ? z0 + .9 : z0 + 1.5 + rnd() * (r.d * .6), { rot: rnd() * 6.28 }); } for (const [cx, cz] of [[x0 + .5, z0 + .5], [x1 - .5, z0 + .5]]) P('candles', cx, cz); break;
    case 'armory': for (let k = 0; k < 5; k++) P('rusty_sword', x0 + 1.5 + k * (r.w - 3) / 4, z0 + .3); for (const sx of [-1, 1]) { P('crate_d', r.x + sx * r.w * .35, r.z, { r: .6, rot: rnd() * .4 }); P('dummy', r.x + sx * r.w * .18, z0 + 2.6, { r: .4 }); } P('barrel_d', x1 - 1.2, z0 + 1.2, { r: .5 }); break;
    case 'shrine': P('shrine', r.x, r.z - r.d * .15, { r: 1 }); ring('candles', 6, .3); for (const sx of [-1, 1]) P('statue', r.x + sx * r.w * .22, r.z - r.d * .28, { r: .9 }); break;     // круглый зал: статуи внутри круга
    case 'prison': for (let k = 0; k < 4; k++) P('cage', x0 + 1.6 + k * (r.w - 3.2) / 3, z0 + 1.4, { r: .9 }); for (const sx of [-1, 1]) P('chain', r.x + sx * r.w * .45, r.z, { rot: sx * Math.PI / 2 }); break;
  }
  return out;
}
// раскладка → ключевые залы: залы боссов (по порядку боссов) и особые залы в тупиках; возвращает предметы обстановки
// вызывать до коридоров: размеры залов меняются и в клетках; rooms — залы по номерам клеток; bossCellsOrdered — клетки боссов в порядке боссов; cells — клетки раскладки; rnd — зерно захода
export function applyKeyRooms(cfg, def0, rooms, cells, bossCellsOrdered, firstN, fireCellN, rnd) {
  const K = cfg.dungeons.keyRooms, T = K && K.on && K.list[def0.id]; if (!T) return [];
  const big = cfg.dungeons.gen.cell - cfg.dungeons.gen.gapMin, props = [];
  bossCellsOrdered.forEach((n, k) => { const kind = T.boss[Math.min(k, T.boss.length - 1)], r = rooms[n]; if (!r || !kind) return;
    r.w = r.d = cells[n].w = cells[n].d = kind === 'crypt' ? big - 2 : big; shapeRoom(cfg, r, kind); props.push(...propsOf(r, rnd)); });
  const want = (def0.raid ? K.special.raid : K.special.dungeon), used = new Set([...bossCellsOrdered, firstN, fireCellN]);
  const cand = cells.filter(c => !used.has(c.n) && c.dead).concat(cells.filter(c => !used.has(c.n) && !c.dead && !c.main));
  for (let k = 0; k < want && k < T.special.length && cand.length; k++) { const c = cand.splice(Math.floor(rnd() * Math.min(cand.length, 3)), 1)[0], r = rooms[c.n];
    r.w = c.w = Math.min(big, Math.max(r.w, K.specialMin)); r.d = c.d = Math.min(big, Math.max(r.d, K.specialMin)); shapeRoom(cfg, r, T.special[k]); props.push(...propsOf(r, rnd)); }
  return props;
}
