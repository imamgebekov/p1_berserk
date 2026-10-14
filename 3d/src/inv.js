// Сумка и экипировка: чистая логика (тестируется в Node). Состояние — { bag: [{id,n}], eq: {слот: id|null}, ash }.
import { BY_ID, SLOTS } from './data/items.js';

export const createInv = () => ({ bag: [], eq: Object.fromEntries(SLOTS.map(s => [s, null])), ash: 0 });

// положить n штук; возвращает, сколько НЕ влезло
export function addItem(inv, id, n, maxSlots) {
  const it = BY_ID[id]; if (!it) return n;
  for (const s of inv.bag) { if (n <= 0) break; if (s.id === id && s.n < it.stack) { const t = Math.min(n, it.stack - s.n); s.n += t; n -= t; } }
  while (n > 0 && inv.bag.length < maxSlots) { const t = Math.min(n, it.stack); inv.bag.push({ id, n: t }); n -= t; }
  return n;
}
export function removeAt(inv, idx, n = 1) {
  const s = inv.bag[idx]; if (!s) return false;
  s.n -= n; if (s.n <= 0) inv.bag.splice(idx, 1);
  return true;
}
export const countOf = (inv, id) => inv.bag.reduce((c, s) => c + (s.id === id ? s.n : 0), 0);

export function equipAt(inv, idx) {
  const s = inv.bag[idx], it = s && BY_ID[s.id]; if (!it || !it.slot) return false;
  const prev = inv.eq[it.slot];
  removeAt(inv, idx, 1);
  inv.eq[it.slot] = it.id;
  if (prev) inv.bag.splice(Math.min(idx, inv.bag.length), 0, { id: prev, n: 1 });     // старая вещь встаёт на место новой
  return true;
}
export function unequip(inv, slot, maxSlots) {
  const id = inv.eq[slot]; if (!id) return false;
  if (inv.bag.length >= maxSlots) return false;
  inv.eq[slot] = null; inv.bag.push({ id, n: 1 }); return true;
}

// суммарные характеристики экипировки и временных баффов
export function gearStats(inv, buffs = []) {
  const g = { dmg: 0, armor: 0, hp: 0, spd: 0, reach: 0, crit: 0, leech: 0, luck: 0, swing: 1 };
  for (const slot of SLOTS) { const id = inv.eq[slot], it = id && BY_ID[id]; if (!it) continue; for (const [k, v] of Object.entries(it.stats)) { if (k === 'swing') g.swing *= v; else g[k] += v; } }
  for (const b of buffs) g[b.stat] += b.amt;
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
export function serialize(inv) { return { bag: inv.bag.map(s => ({ id: s.id, n: s.n })), eq: { ...inv.eq }, ash: inv.ash }; }
export function deserialize(data, maxSlots) {
  const inv = createInv();
  if (!data || typeof data !== 'object') return inv;
  for (const s of Array.isArray(data.bag) ? data.bag : []) if (s && BY_ID[s.id] && Number.isFinite(s.n) && s.n > 0) addItem(inv, s.id, Math.min(Math.floor(s.n), BY_ID[s.id].stack), maxSlots);
  for (const slot of SLOTS) { const id = data.eq && data.eq[slot]; if (id && BY_ID[id] && BY_ID[id].slot === slot) inv.eq[slot] = id; }
  inv.ash = Number.isFinite(data.ash) && data.ash > 0 ? Math.floor(data.ash) : 0;
  return inv;
}
