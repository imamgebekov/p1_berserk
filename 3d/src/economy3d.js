// Кузнец (улучшение вещей) и торговля: цены, ассортимент, покупка и продажа.
import { BY_ID } from './data/items.js';
import { SHOP, SHOP_STAPLES, rollLoot } from './data/loot.js';
import { addItem, removeAt } from './inv.js';

// ---- кузнец: улучшение вещей за пепел ----
export const upgradeCost = (it, lvl, cfg) => Math.round(cfg.smith.base + it.value * cfg.smith.costK * Math.pow(lvl + 1, cfg.smith.pow));
// where: { slot } для надетой или { idx } для вещи в сумке
export function upgradeItem(W, where) {
  if (W.nearNpc !== 'smith') return 'far';
  const inv = W.inv, e = where.slot ? null : inv.bag[where.idx];
  const id = where.slot ? inv.eq[where.slot] : e && e.id, it = id && BY_ID[id];
  if (!it || !it.slot) return 'none';
  const lvl = where.slot ? inv.up[where.slot] || 0 : e.up || 0;
  if (lvl >= W.cfg.smith.max) return 'max';
  const cost = upgradeCost(it, lvl, W.cfg);
  if (inv.ash < cost) return 'ash';
  inv.ash -= cost; if (where.slot) inv.up[where.slot] = lvl + 1; else e.up = lvl + 1;
  W.ev.push({ k: 'upgrade', x: W.player.x, z: W.player.z, lvl: lvl + 1 }); return 'ok';
}

// ---- торговля ----
export const sellPrice = (it, cfg, up = 0, trade = 0) => Math.max(1, Math.round(it.value * cfg.shop.sellMul * (1 + up * .25) * (1 + trade / 100)));
export const buyPrice = (it, cfg, mul = 1) => Math.max(2, Math.round(it.value * cfg.shop.buyMul * mul));
export function restock(W) {
  const out = SHOP_STAPLES.map(([id, n]) => ({ id, n }));
  for (const it of rollLoot(SHOP, W.rng, .12, W.gear.luck)) { const ex = out.find(o => o.id === it.id); if (ex) ex.n += it.n; else out.push({ ...it }); }
  W.shop.stock = out; W.shop.t = 0;
}
export function buyItem(W, i) {
  const s = W.shop.stock[i]; if (!s || !W.nearMerchant) return 'far'; if (W.night) return 'closed';
  const it = BY_ID[s.id], price = buyPrice(it, W.cfg, W.dif.buy);
  if (W.inv.ash < price) return 'ash';
  if (addItem(W.inv, s.id, 1, W.cfg.bag.slots) > 0) return 'full';
  W.inv.ash -= price; s.n -= 1; if (s.n <= 0) W.shop.stock.splice(i, 1);
  W.ev.push({ k: 'pickup', id: s.id, n: 1 }); return 'ok';
}
export function sellItem(W, idx, n = 1) {
  const s = W.inv.bag[idx]; if (!s) return 'none'; if (!W.nearMerchant) return 'far'; if (W.night) return 'closed';
  const q = Math.min(n, s.n), it = BY_ID[s.id];
  W.inv.ash += sellPrice(it, W.cfg, s.up || 0, W.gear.trade) * q; removeAt(W.inv, idx, q); return 'ok';
}
// продать весь хлам разом: безделушки, деньги, записки и материалы (оружие, броня, ключи и расходники остаются)
export function sellJunk(W) {
  if (!W.nearMerchant || W.night) return -1;
  let sum = 0;
  for (let i = W.inv.bag.length - 1; i >= 0; i--) { const s = W.inv.bag[i], it = BY_ID[s.id]; if (it.cat === 'curio' || it.cat === 'material') { sum += sellPrice(it, W.cfg, 0, W.gear.trade) * s.n; W.inv.bag.splice(i, 1); } }
  W.inv.ash += sum; return sum;
}

