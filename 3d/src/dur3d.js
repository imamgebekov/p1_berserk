// Прочность снаряжения (4.03, просьба владельца): износ wr (0–100%) копится от ударов оружием, ранений и смертей и хранится в
// свойствах вещи (af.wr) — переезжает с вещью в сумку, на землю и в сохранение. До soft% вещь работает в полную силу, дальше сила
// плавно падает и к 100% — вдвое (×(1 − drop)); вещь не пропадает. Кузнец чинит за пепел, ремкомплект — в поле. Украшения не изнашиваются.
// Чистая логика; числа — cfg.dur.
import { BY_ID, SLOTS } from './data/items.js';

const WEAR_SLOTS = ['weapon', 'offhand', 'head', 'body', 'cloak', 'boots'];
const jewel = it => !it || it.slot === 'ring' || it.slot === 'amulet';
export const wearOf = af => (af && Number.isFinite(af.wr) ? af.wr : 0);
// множитель силы от износа
export const wearMul = (D, af) => { const w = wearOf(af); return !D || !D.on || w <= D.soft ? 1 : 1 - D.drop * Math.min(1, (w - D.soft) / (100 - D.soft)); };
const step5 = (D, w) => (w <= D.soft ? -1 : Math.floor((w - D.soft) / 5));     // сила пересчитывается каждые 5% износа после порога
// износить надетое в слотах на amount%; вернёт true, если сила вещей изменилась (нужен refreshGear)
export function wear(W, slots, amount) {
  const D = W.cfg.dur; if (!D || !D.on || !(amount > 0)) return false;
  let changed = false; const inv = W.inv; inv.af ||= {};
  for (const slot of slots) {
    const id = inv.eq[slot], it = id && BY_ID[id]; if (!it || jewel(it)) continue;
    const af = inv.af[slot] || (inv.af[slot] = {}), w0 = wearOf(af), w1 = Math.min(100, Math.round((w0 + amount) * 100) / 100); if (w1 === w0) continue;
    af.wr = w1;
    if (step5(D, w0) !== step5(D, w1)) changed = true;
    if (w0 < D.soft && w1 >= D.soft) W.ev.push({ k: 'wear', slot, id, at: 'soft' });
    if (w0 < 100 && w1 >= 100) W.ev.push({ k: 'wear', slot, id, at: 'broken' });
  }
  return changed;
}
export const wearHit = (W, slot = 'weapon') => wear(W, [slot], W.cfg.dur && W.cfg.dur.hit);     // slot — рука, что ударила
export const wearHurt = W => { const off = W.inv.eq.offhand && BY_ID[W.inv.eq.offhand]; return wear(W, ['head', 'body', 'cloak', 'boots', ...(off && off.slot !== 'weapon' ? ['offhand'] : [])], W.cfg.dur && W.cfg.dur.hurt); };     // щит — от ран, клинок во второй руке — от ударов
export const wearDeath = W => wear(W, WEAR_SLOTS, W.cfg.dur && W.cfg.dur.death);
// цена починки вещи
export const repairCost = (cfg, it, af) => { const w = wearOf(af), R = cfg.dur && cfg.dur.repair; return !R || jewel(it) || w <= 0 ? 0 : Math.max(R.min, Math.ceil((it.value || 0) * R.k * w / 100)); };
// всё, что можно починить: надетое и сумка. [{ where, it, af, cost }]
export function repairList(W) {
  const out = [], inv = W.inv;
  for (const slot of SLOTS) { const id = inv.eq[slot], it = id && BY_ID[id], af = inv.af && inv.af[slot]; const c = it ? repairCost(W.cfg, it, af) : 0; if (c) out.push({ where: { slot }, it, af, cost: c }); }
  inv.bag.forEach((s, i) => { const it = BY_ID[s.id], c = it && it.slot ? repairCost(W.cfg, it, s.af) : 0; if (c) out.push({ where: { idx: i }, it, af: s.af, cost: c }); });
  return out;
}
const clear = af => { if (af) delete af.wr; };
// починить всё у кузнеца: { n, cost } или 'far' | 'none' | 'ash'
export function repairAll(W) {
  if (W.nearNpc !== 'smith') return 'far';
  const L = repairList(W); if (!L.length) return 'none';
  const cost = L.reduce((a, x) => a + x.cost, 0); if (W.inv.ash < cost) return 'ash';
  W.inv.ash -= cost; for (const x of L) clear(x.af);
  W.ev.push({ k: 'repair', n: L.length, cost }); return { n: L.length, cost };
}
// ремкомплект: минус amount% износа у надетого (сумка — у кузнеца)
export function repairKit(W, amount) {
  let n = 0; for (const slot of WEAR_SLOTS) { const af = W.inv.af && W.inv.af[slot]; if (wearOf(af) > 0) { af.wr = Math.max(0, Math.round((af.wr - amount) * 100) / 100); if (!af.wr) delete af.wr; n++; } }
  if (n) W.ev.push({ k: 'repair', n, kit: true }); return n;
}
