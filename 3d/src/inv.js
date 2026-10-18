// Сумка и экипировка: чистая логика (тестируется в Node). Состояние — { bag: [{id,n}], eq: {слот: id|null}, ash }.
import { BY_ID, SLOTS, CATALOG, STAT_NAME } from './data/items.js';
import { SETS, SET_SLOTS, FX_TEXT } from './data/sets3d.js';
import { canWield, canOff } from './data/heroes3d.js';
import { CFG3 } from './config3d.js';

export const UP_MAX = 5;
// up — уровень улучшения (+N) у надетых вещей по слотам; в сумке — поле up у записи
export const createInv = () => ({ bag: [], eq: Object.fromEntries(SLOTS.map(s => [s, null])), up: {}, gem: {}, il: {}, ash: 0 });
// уровень вещи (этап 0, 2026-10-19): у записи сумки — поле il, у надетого — inv.il[слот]; нет — «родной» уровень по редкости (статы как в каталоге)
export const nomIl = it => CFG3.level.il.nom[it.rar] ?? 1;
export const ilOf = (it, il) => (it && it.slot ? il || nomIl(it) : 0);
export const ilMul = (it, il) => { if (!il || !it || !it.slot) return 1; const g = CFG3.level.il.g; return (1 + g * il) / (1 + g * nomIl(it)); };
const IL_KEYS = ['dmg', 'armor', 'hp'];     // от уровня вещи растут урон, броня и здоровье
// камни в гнёздах (2026-10-18): у записи сумки — поле g (массив id камней или null по гнёздам), у надетого — inv.gem[слот].
// Вещь с заточкой или камнями — отдельная запись: не складывается и не идёт в материалы. Камни едут с вещью везде.
export const hasGems = g => Array.isArray(g) && g.some(Boolean);
export const isPlain = s => !s.up && !hasGems(s.g);
const entryOf = (id, up, g, il) => { const e = { id, n: 1 }; if (up) e.up = up; if (hasGems(g)) e.g = g.slice(); if (il) e.il = il; return e; };
export const socketsOf = (it, cfg) => (!it || !cfg || !cfg.stones ? 0 : it.slot === 'weapon' ? cfg.stones.sockets[it.rar] || 0 : cfg.stones.armor && cfg.stones.armor.slots.includes(it.slot) ? cfg.stones.armor.sockets[it.rar] || 0 : 0);     // оружие и броня (2026-10-18)
// камни из сохранения: только настоящие камни, не больше гнёзд
export const cleanGems = (g, n) => { if (!Array.isArray(g) || !n) return null; const o = []; for (let i = 0; i < n; i++) { const x = g[i]; o.push(typeof x === 'string' && BY_ID[x] && BY_ID[x].cat === 'gem' ? x : null); } return hasGems(o) ? o : null; };

// место в сумке (2026-10-18): ключи и камни места не занимают; два расходника (зелья, еда, лекарства) — в одной клетке
export const freeItem = it => !!it && (it.cat === 'gem' || it.cat === 'key');
export const halfItem = it => !!it && it.cat === 'consumable';
export function bagUsed(inv) { let full = 0, half = 0; for (const s of inv.bag) { const it = BY_ID[s.id]; if (freeItem(it)) continue; if (halfItem(it)) half++; else full++; } return full + Math.ceil(half / 2); }
// влезет ли ещё одна запись этой вещи
export function roomFor(inv, id, maxSlots) {
  const it = BY_ID[id]; if (freeItem(it)) return true;
  if (halfItem(it) && inv.bag.filter(s => halfItem(BY_ID[s.id])).length % 2 === 1) return true;     // пара для расходника уже есть
  return bagUsed(inv) < maxSlots;
}
// положить n штук; возвращает, сколько НЕ влезло
export function addItem(inv, id, n, maxSlots) {
  const it = BY_ID[id]; if (!it) return n;
  for (const s of inv.bag) { if (n <= 0) break; if (s.id === id && isPlain(s) && s.n < it.stack) { const t = Math.min(n, it.stack - s.n); s.n += t; n -= t; } }
  while (n > 0 && roomFor(inv, id, maxSlots)) { const t = Math.min(n, it.stack); inv.bag.push({ id, n: t }); n -= t; }
  return n;
}
export function removeAt(inv, idx, n = 1) {
  const s = inv.bag[idx]; if (!s) return false;
  s.n -= n; if (s.n <= 0) inv.bag.splice(idx, 1);
  return true;
}
export const countOf = (inv, id) => inv.bag.reduce((c, s) => c + (s.id === id ? s.n : 0), 0);

// hero — кто надевает: чужое оружие не надевается (без героя — без проверки)
export function equipAt(inv, idx, hero) {
  const s = inv.bag[idx], it = s && BY_ID[s.id]; if (!it || !it.slot) return false;
  if (hero && !canWield(hero, it)) return false;
  const prev = inv.eq[it.slot], prevUp = inv.up[it.slot] || 0, prevG = inv.gem[it.slot], IL = inv.il || (inv.il = {}), prevIl = IL[it.slot];
  removeAt(inv, idx, 1);
  inv.eq[it.slot] = it.id; if (s.up) inv.up[it.slot] = s.up; else delete inv.up[it.slot]; if (s.il) IL[it.slot] = s.il; else delete IL[it.slot];
  if (hasGems(s.g)) inv.gem[it.slot] = s.g.slice(); else delete inv.gem[it.slot];
  if (prev) inv.bag.splice(Math.min(idx, inv.bag.length), 0, entryOf(prev, prevUp, prevG, prevIl));     // старая вещь встаёт на место новой
  return true;
}
// во вторую руку: щит или (у дуэлянта) второй клинок
export function equipOff(inv, idx, hero) {
  const s = inv.bag[idx], it = s && BY_ID[s.id]; if (!it || !canOff(hero, it)) return false;
  const prev = inv.eq.offhand, prevUp = inv.up.offhand || 0, prevG = inv.gem.offhand, IL = inv.il || (inv.il = {}), prevIl = IL.offhand;
  removeAt(inv, idx, 1);
  inv.eq.offhand = it.id; if (s.up) inv.up.offhand = s.up; else delete inv.up.offhand; if (s.il) IL.offhand = s.il; else delete IL.offhand;
  if (hasGems(s.g)) inv.gem.offhand = s.g.slice(); else delete inv.gem.offhand;
  if (prev) inv.bag.splice(Math.min(idx, inv.bag.length), 0, entryOf(prev, prevUp, prevG, prevIl));
  return true;
}
export function unequip(inv, slot, maxSlots) {
  const id = inv.eq[slot]; if (!id) return false;
  if (!roomFor(inv, id, maxSlots)) return false;
  inv.bag.push(entryOf(id, inv.up[slot], inv.gem[slot], inv.il && inv.il[slot]));
  inv.eq[slot] = null; delete inv.up[slot]; delete inv.gem[slot]; if (inv.il) delete inv.il[slot]; return true;
}
export { entryOf };
export const nameOf = (id, up) => (up ? `+${up} ` : '') + BY_ID[id].name;

// ---- сеты ----
// какому сету принадлежит вещь: по материалу (обычные) или по списку (именные)
export const SET_OF = {};
for (const st of SETS) {
  const ids = st.pieces || CATALOG.filter(i => i.cat === 'armor' && i.mat === st.mat && SET_SLOTS.includes(i.slot)).map(i => i.id);
  st.ids = ids; for (const id of ids) SET_OF[id] = st;
}
// сколько частей каждого сета надето: [{ set, n }]
export function setCounts(inv) {
  const c = new Map();
  for (const slot of SET_SLOTS) { const st = SET_OF[inv.eq[slot]]; if (st) c.set(st, (c.get(st) || 0) + 1); }
  return [...c].map(([set, n]) => ({ set, n }));
}
// суммарный бонус сетов: числа и особые эффекты
export function setBonus(inv) {
  const stats = {}, fx = {};
  for (const { set, n } of setCounts(inv)) for (const [need, b] of [[2, set.b2], [4, set.b4]]) {
    if (n < need || !b) continue;
    for (const [k, v] of Object.entries(b.stats || {})) stats[k] = (stats[k] || 0) + v;
    for (const [k, v] of Object.entries(b.fx || {})) fx[k] = Math.max(fx[k] || 0, v);
  }
  return { stats, fx };
}

// текст бонуса сета: «+5 броня; шипы: …»
export function bonusText(b) {
  if (!b) return '';
  const parts = Object.entries(b.stats || {}).map(([k, v]) => `+${v} ${STAT_NAME[k]}`);
  for (const [k, v] of Object.entries(b.fx || {})) parts.push(FX_TEXT[k](v));
  return parts.join('; ');
}

// суммарные характеристики экипировки и временных баффов
export function gearStats(inv, buffs = [], bonus = .1, extra = null) {
  const g = { block: 0, dmg: 0, armor: 0, hp: 0, spd: 0, reach: 0, crit: 0, leech: 0, luck: 0, swing: 1, arc: 0, rollcd: 0, regen: 0, stealth: 0, trade: 0, bag: 0 };
  // второй клинок во второй руке бьёт сам (sim.js offDmg), в сумму характеристик не идёт
  for (const slot of SLOTS) { const id = inv.eq[slot], it = id && BY_ID[id]; if (!it || (slot === 'offhand' && it.slot === 'weapon')) continue; const m = 1 + (inv.up[slot] || 0) * bonus, mi = ilMul(it, inv.il && inv.il[slot]); for (const [k, v] of Object.entries(it.stats)) { if (k === 'swing') g.swing *= v; else if (v > 0 && (k === 'dmg' || k === 'armor' || k === 'hp' || k === 'crit' || k === 'leech')) g[k] += Math.round(v * m * (IL_KEYS.includes(k) ? mi : 1)); else g[k] += v; } }
  for (const b of buffs) g[b.stat] += b.amt;
  { const sb = setBonus(inv).stats; for (const k of Object.keys(sb)) g[k] += sb[k]; }
  if (extra) for (const k of Object.keys(extra)) { if (k === 'swingMul') g.swing *= extra[k]; else g[k] += extra[k]; }
  return g;
}

// «лучше ли вещь надетой» по главному показателю слота (для стрелки ▲ в списке)
export function score(it) {
  const s = it.stats || {};
  return (s.dmg || 0) * 2 + (s.armor || 0) * 1.6 + (s.hp || 0) * .3 + (s.spd || 0) * .8 + (s.crit || 0) * .5 + (s.leech || 0) * 2 + (s.luck || 0) * .3 + (s.reach || 0) * 2 - ((s.swing || 1) - 1) * 6;
}
export function betterThanWorn(inv, it) {
  if (!it.slot) return false;
  const cur = inv.eq[it.slot]; return !cur || score(it) > score(BY_ID[cur]) + .5;
}

// сохранение: только проверенные id; чужое и неизвестное отбрасываем
export function serialize(inv) { return { bag: inv.bag.map(s => { const o = { id: s.id, n: s.n }; if (s.up) o.up = s.up; if (hasGems(s.g)) o.g = s.g.slice(); if (s.il) o.il = s.il; return o; }), eq: { ...inv.eq }, up: { ...inv.up }, il: { ...(inv.il || {}) }, gem: JSON.parse(JSON.stringify(inv.gem || {})), ash: inv.ash }; }
// hero — чьё сохранение: чужое оружие в руке уходит в сумку (даже сверх размера — вещи не пропадают)
export function deserialize(data, maxSlots, hero, cfg) {
  const inv = createInv();
  if (!data || typeof data !== 'object') return inv;
  for (const s of Array.isArray(data.bag) ? data.bag : []) if (s && BY_ID[s.id] && Number.isFinite(s.n) && s.n > 0) { const n = Math.min(Math.floor(s.n), BY_ID[s.id].stack), up = BY_ID[s.id].slot && Number.isFinite(s.up) && s.up > 0 ? Math.min(UP_MAX, Math.floor(s.up)) : 0, g = cleanGems(s.g, socketsOf(BY_ID[s.id], cfg)), il = BY_ID[s.id].slot ? saneIl(s.il) : 0; if (up || g || il) { if (inv.bag.length < maxSlots) inv.bag.push(entryOf(s.id, up, g, il)); } else addItem(inv, s.id, n, maxSlots); }
  for (const slot of SLOTS) { const id = data.eq && data.eq[slot]; if (id && BY_ID[id] && (BY_ID[id].slot === slot || (slot === 'offhand' && BY_ID[id].slot === 'weapon'))) { inv.eq[slot] = id; const u = data.up && data.up[slot]; if (Number.isFinite(u) && u > 0) inv.up[slot] = Math.min(UP_MAX, Math.floor(u)); const g = cleanGems(data.gem && data.gem[slot], socketsOf(BY_ID[id], cfg)); if (g) inv.gem[slot] = g; const li = saneIl(data.il && data.il[slot]); if (li) inv.il[slot] = li; } }
  inv.ash = Number.isFinite(data.ash) && data.ash > 0 ? Math.floor(data.ash) : 0;
  const back = slot => { inv.bag.unshift(entryOf(inv.eq[slot], inv.up[slot], inv.gem[slot], inv.il[slot])); delete inv.eq[slot]; delete inv.up[slot]; delete inv.gem[slot]; delete inv.il[slot]; };
  if (hero && inv.eq.weapon && !canWield(hero, BY_ID[inv.eq.weapon])) back('weapon');
  if (hero) for (const sl of ['head', 'body', 'cloak', 'boots']) if (inv.eq[sl] && !canWield(hero, BY_ID[inv.eq[sl]])) back(sl);     // запрещённая герою броня — в сумку
  if (inv.eq.offhand && (BY_ID[inv.eq.offhand].slot === 'weapon' ? !hero || !canOff(hero, BY_ID[inv.eq.offhand]) : hero && !canOff(hero, BY_ID[inv.eq.offhand]))) back('offhand');     // клинок во второй руке — только у своего героя
  return inv;
}

// сравнение по характеристикам: строки {k, name, a — у надетого, b — у этой вещи, d — +1 лучше / −1 хуже / 0}; у скорости удара меньше — лучше.
// upIt, upWorn — уровни заточки (как в gearStats: урон, броня, здоровье, крит, вампиризм × (1 + уровень × bonus))
const UPS = ['dmg', 'armor', 'hp', 'crit', 'leech'];
const upped = (st, up, bonus, mi = 1) => { const o = { ...st }; if (up || mi !== 1) for (const k of UPS) if (o[k] > 0) o[k] = Math.round(o[k] * (1 + up * bonus) * (IL_KEYS.includes(k) ? mi : 1)); return o; };
const saneIl = v => (Number.isFinite(v) && v >= 1 ? Math.min(99, Math.floor(v)) : 0);
export function statDiff(it, worn, upIt = 0, upWorn = 0, bonus = .1, ilIt = 0, ilWorn = 0) {
  const a = upped((worn && worn.stats) || {}, upWorn, bonus, ilMul(worn, ilWorn)), b = upped((it && it.stats) || {}, upIt, bonus, ilMul(it, ilIt)), keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  return keys.map(k => {
    const x = a[k] ?? (k === 'swing' ? 1 : 0), y = b[k] ?? (k === 'swing' ? 1 : 0), better = k === 'swing' ? y < x : y > x, worse = k === 'swing' ? y > x : y < x;
    return { k, name: STAT_NAME[k] || k, a: x, b: y, d: worn ? (better ? 1 : worse ? -1 : 0) : 0 };
  });
}
// оценка вещи с учётом заточки (для строки «в целом лучше на N»)
export const scoreUp = (it, up = 0, bonus = .1, il = 0) => score({ stats: upped(it.stats || {}, up, bonus, ilMul(it, il)) });
