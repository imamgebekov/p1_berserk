// Библиотека зачарований (4.00, просьба владельца): книжница в доме с полками в лагере. Разбор вещи из сумки даёт чародейскую пыль,
// за пыль и пепел — добавить свойство, перековать одно свойство или поднять качество. Счётчик зачарований вещи хранится в af.en
// и поднимает цену. Свой генератор (счётчик W.enN + зерно мира): бой и его случайности не сдвигаются. Числа — cfg.enchant. Чистая логика.
import { BY_ID } from './data/items.js';
import { removeAt, addItem, hasGems, qOf, ilOf } from './inv.js';
import { rng, rollValue, poolOf, kindOf, affixCount } from './affix3d.js';

const E = W => W.cfg.enchant;
const near = W => E(W) && E(W).on && W.nearNpc === E(W).npc;
const maxSlots = W => W.cfg.bag.slots + ((W.gear && W.gear.bag) || 0);
const rngOf = W => { W.enN = (W.enN || 0) + 1; return rng((W.cfg.world.seed * 31337 + W.enN * 2654435761 + Math.floor((W.t || 0) * 1000)) >>> 0); };
export const dustOf = W => W.inv.bag.reduce((a, s) => a + (s.id === E(W).item ? s.n : 0), 0);
// вещь по месту: { slot } — надетая, { idx } — в сумке
export function itemAt(W, where) {
  const inv = W.inv;
  if (where.slot) { const id = inv.eq[where.slot]; return id ? { id, it: BY_ID[id], af: inv.af && inv.af[where.slot], il: (inv.il && inv.il[where.slot]) || 0, up: inv.up[where.slot] || 0 } : null; }
  const s = inv.bag[where.idx]; return s ? { id: s.id, it: BY_ID[s.id], af: s.af, il: s.il || 0, up: s.up || 0, s } : null;
}
const setAf = (W, where, af) => { if (where.slot) { W.inv.af ||= {}; W.inv.af[where.slot] = af; } else W.inv.bag[where.idx].af = af; };
// что можно сделать с вещью и почём
export function enchantInfo(W, where) {
  const x = itemAt(W, where), C = E(W); if (!x || !x.it || !x.it.slot || !C) return null;
  const en = (x.af && x.af.en) || 0, k = 1 + en * C.grow, rar = x.it.rar || 0, A = W.cfg.affix;
  const cost = { ash: Math.round((C.base + (x.it.value || 0) * C.valueK) * k), dust: Math.ceil(C.dust[rar] * k) };
  const n = affixCount(x.af), cap = Math.min(C.cap, (A.count[rar] || 0) + C.extra), free = poolOf(x.it).filter(key => !(x.af && key in x.af));
  const hasQ = kindOf(x.it) !== 'jewel' && !!A.quality;
  return { ...x, en, cost, n, cap, canAdd: n < cap && free.length > 0, canQ: hasQ && qOf(x.af) < A.quality[1], keys: Object.keys(x.af || {}).filter(key => key !== 'q' && key !== 'en'), free };
}
// op: 'add' — новое свойство; 'reroll' — свойство key сменить на другое; 'quality' — качество заново, но не ниже прежнего.
// Вернёт 'ok' | 'far' | 'none' | 'max' | 'ash' | 'dust'
export function enchant(W, where, op, key) {
  if (!near(W)) return 'far';
  const I = enchantInfo(W, where); if (!I) return 'none';
  if (op === 'add' && !I.canAdd) return 'max';
  if (op === 'quality' && !I.canQ) return 'max';
  if (op === 'reroll' && (!I.keys.includes(key) || !I.free.length)) return 'none';
  if (!['add', 'quality', 'reroll'].includes(op)) return 'none';
  if (W.inv.ash < I.cost.ash) return 'ash';
  if (dustOf(W) < I.cost.dust) return 'dust';
  const A = W.cfg.affix, r = rngOf(W), af = { ...(I.af || {}) }, L = ilOf(I.it, I.il) || 1;
  if (op === 'add' || op === 'reroll') { if (op === 'reroll') delete af[key]; const k = I.free[Math.floor(r() * I.free.length)]; af[k] = rollValue(A, k, L, r); }
  else { const [q0, q1] = A.quality, q = Math.round((q0 + (q1 - q0) * r()) * 100) / 100; af.q = Math.max(qOf(I.af), q); }
  af.en = I.en + 1;
  W.inv.ash -= I.cost.ash; let left = I.cost.dust;
  for (let i = W.inv.bag.length - 1; i >= 0 && left > 0; i--) { const s = W.inv.bag[i]; if (s.id !== E(W).item) continue; const t = Math.min(left, s.n), len0 = W.inv.bag.length; left -= t; removeAt(W.inv, i, t); if (W.inv.bag.length < len0 && where.idx !== undefined && i < where.idx) where = { idx: where.idx - 1 }; }     // пыль ушла из сумки: место вещи сдвигается
  setAf(W, where, af); W.ev.push({ k: 'enchant', op, id: I.id }); return 'ok';
}
// пыль за разбор вещи
export const yieldOf = (W, x) => (E(W).yield[x.it.rar || 0] || 0) + (x.up || 0) * E(W).upYield;
// разобрать вещь из сумки. Вернёт { n } (сколько пыли) или 'far' | 'none' | 'lock' | 'gems' | 'full'
export function disenchant(W, idx) {
  if (!near(W)) return 'far';
  const x = itemAt(W, { idx }); if (!x || !x.it || !x.it.slot) return 'none';
  if (x.s.lock) return 'lock'; if (hasGems(x.s.g)) return 'gems';
  const n = yieldOf(W, x), tmp = { bag: W.inv.bag.slice() }; tmp.bag.splice(idx, 1);
  if (addItem({ bag: tmp.bag.map(s => ({ ...s })) }, E(W).item, n, maxSlots(W)) > 0) return 'full';
  removeAt(W.inv, idx, 1); addItem(W.inv, E(W).item, n, maxSlots(W)); W.ev.push({ k: 'disenchant', id: x.id, n }); return { n };
}
