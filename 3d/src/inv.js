// Сумка и экипировка: чистая логика (тестируется в Node). Состояние — { bag: [{id,n}], eq: {слот: id|null}, ash }.
import { BY_ID, SLOTS, CATALOG, STAT_NAME } from './data/items.js';
import { SETS, SET_SLOTS, FX_TEXT } from './data/sets3d.js';
import { canWield, canOff } from './data/heroes3d.js';

export const UP_MAX = 5;
// up — уровень улучшения (+N) у надетых вещей по слотам; в сумке — поле up у записи
export const createInv = () => ({ bag: [], eq: Object.fromEntries(SLOTS.map(s => [s, null])), up: {}, ash: 0 });

// положить n штук; возвращает, сколько НЕ влезло
export function addItem(inv, id, n, maxSlots) {
  const it = BY_ID[id]; if (!it) return n;
  for (const s of inv.bag) { if (n <= 0) break; if (s.id === id && !s.up && s.n < it.stack) { const t = Math.min(n, it.stack - s.n); s.n += t; n -= t; } }
  while (n > 0 && inv.bag.length < maxSlots) { const t = Math.min(n, it.stack); inv.bag.push({ id, n: t }); n -= t; }
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
  const prev = inv.eq[it.slot], prevUp = inv.up[it.slot] || 0;
  removeAt(inv, idx, 1);
  inv.eq[it.slot] = it.id; if (s.up) inv.up[it.slot] = s.up; else delete inv.up[it.slot];
  if (prev) { const e = { id: prev, n: 1 }; if (prevUp) e.up = prevUp; inv.bag.splice(Math.min(idx, inv.bag.length), 0, e); }     // старая вещь встаёт на место новой
  return true;
}
// во вторую руку: щит или (у дуэлянта) второй клинок
export function equipOff(inv, idx, hero) {
  const s = inv.bag[idx], it = s && BY_ID[s.id]; if (!it || !canOff(hero, it)) return false;
  const prev = inv.eq.offhand, prevUp = inv.up.offhand || 0;
  removeAt(inv, idx, 1);
  inv.eq.offhand = it.id; if (s.up) inv.up.offhand = s.up; else delete inv.up.offhand;
  if (prev) { const e = { id: prev, n: 1 }; if (prevUp) e.up = prevUp; inv.bag.splice(Math.min(idx, inv.bag.length), 0, e); }
  return true;
}
export function unequip(inv, slot, maxSlots) {
  const id = inv.eq[slot]; if (!id) return false;
  if (inv.bag.length >= maxSlots) return false;
  const e = { id, n: 1 }; if (inv.up[slot]) e.up = inv.up[slot];
  inv.eq[slot] = null; delete inv.up[slot]; inv.bag.push(e); return true;
}
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
  for (const slot of SLOTS) { const id = inv.eq[slot], it = id && BY_ID[id]; if (!it || (slot === 'offhand' && it.slot === 'weapon')) continue; const m = 1 + (inv.up[slot] || 0) * bonus; for (const [k, v] of Object.entries(it.stats)) { if (k === 'swing') g.swing *= v; else if (v > 0 && (k === 'dmg' || k === 'armor' || k === 'hp' || k === 'crit' || k === 'leech')) g[k] += Math.round(v * m); else g[k] += v; } }
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
export function serialize(inv) { return { bag: inv.bag.map(s => (s.up ? { id: s.id, n: s.n, up: s.up } : { id: s.id, n: s.n })), eq: { ...inv.eq }, up: { ...inv.up }, ash: inv.ash }; }
// hero — чьё сохранение: чужое оружие в руке уходит в сумку (даже сверх размера — вещи не пропадают)
export function deserialize(data, maxSlots, hero) {
  const inv = createInv();
  if (!data || typeof data !== 'object') return inv;
  for (const s of Array.isArray(data.bag) ? data.bag : []) if (s && BY_ID[s.id] && Number.isFinite(s.n) && s.n > 0) { const n = Math.min(Math.floor(s.n), BY_ID[s.id].stack); if (BY_ID[s.id].slot && Number.isFinite(s.up) && s.up > 0) { if (inv.bag.length < maxSlots) inv.bag.push({ id: s.id, n: 1, up: Math.min(UP_MAX, Math.floor(s.up)) }); } else addItem(inv, s.id, n, maxSlots); }
  for (const slot of SLOTS) { const id = data.eq && data.eq[slot]; if (id && BY_ID[id] && (BY_ID[id].slot === slot || (slot === 'offhand' && BY_ID[id].slot === 'weapon'))) { inv.eq[slot] = id; const u = data.up && data.up[slot]; if (Number.isFinite(u) && u > 0) inv.up[slot] = Math.min(UP_MAX, Math.floor(u)); } }
  inv.ash = Number.isFinite(data.ash) && data.ash > 0 ? Math.floor(data.ash) : 0;
  const back = slot => { const e = { id: inv.eq[slot], n: 1 }; if (inv.up[slot]) e.up = inv.up[slot]; inv.bag.unshift(e); delete inv.eq[slot]; delete inv.up[slot]; };
  if (hero && inv.eq.weapon && !canWield(hero, BY_ID[inv.eq.weapon])) back('weapon');
  if (inv.eq.offhand && (BY_ID[inv.eq.offhand].slot === 'weapon' ? !hero || !canOff(hero, BY_ID[inv.eq.offhand]) : hero && !canOff(hero, BY_ID[inv.eq.offhand]))) back('offhand');     // клинок во второй руке — только у своего героя
  return inv;
}

// сравнение по характеристикам: строки {k, name, a — у надетого, b — у этой вещи, d — +1 лучше / −1 хуже / 0}; у скорости удара меньше — лучше.
// upIt, upWorn — уровни заточки (как в gearStats: урон, броня, здоровье, крит, вампиризм × (1 + уровень × bonus))
const UPS = ['dmg', 'armor', 'hp', 'crit', 'leech'];
const upped = (st, up, bonus) => { const o = { ...st }; if (up) for (const k of UPS) if (o[k] > 0) o[k] = Math.round(o[k] * (1 + up * bonus)); return o; };
export function statDiff(it, worn, upIt = 0, upWorn = 0, bonus = .1) {
  const a = upped((worn && worn.stats) || {}, upWorn, bonus), b = upped((it && it.stats) || {}, upIt, bonus), keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  return keys.map(k => {
    const x = a[k] ?? (k === 'swing' ? 1 : 0), y = b[k] ?? (k === 'swing' ? 1 : 0), better = k === 'swing' ? y < x : y > x, worse = k === 'swing' ? y > x : y < x;
    return { k, name: STAT_NAME[k] || k, a: x, b: y, d: worn ? (better ? 1 : worse ? -1 : 0) : 0 };
  });
}
// оценка вещи с учётом заточки (для строки «в целом лучше на N»)
export const scoreUp = (it, up = 0, bonus = .1) => score({ stats: upped(it.stats || {}, up, bonus) });
