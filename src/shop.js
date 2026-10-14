// Торговец: ассортимент, покупка, быстрая продажа хлама. Без DOM.
import { CFG } from './config.js';
import { P, W } from './state.js';
import { pick } from './util.js';
import { ITEMS } from './data/items.js';
import { newItem, defOf, giveItem, bagFull, sellFromBag } from './inventory.js';
import { rollRarity, pickItem, maxTierFor } from './loot.js';

export const buyPrice = def => Math.max(1, Math.round(def.price * CFG.shop.buyMarkup[def.rarity]));

// Удача магазина: уровень и круг Предвестника, без глубины (торговец стоит в городе)
export function shopLuck() {
  const L = CFG.loot;
  return (P.lv - 1) * L.luckPerLevel + W.cycle * L.luckPerCycle + CFG.shop.luckBonus;
}

export function restock() {
  const S = CFG.shop, luck = shopLuck(), maxTier = maxTierFor(luck);
  const chosen = [], seen = new Set();
  const add = def => { if (def && !seen.has(def.id)) { seen.add(def.id); chosen.push(def); return true; } return false; };
  // гарантированная дешёвая основа
  const commons = ITEMS.filter(i => i.rarity === S.junkRarity && i.tier <= maxTier);
  for (let n = 0; n < 40 && chosen.length < S.guaranteedCommon; n++) add(pick(commons));
  // остальное — по таблице магазина
  for (let n = 0; n < 200 && chosen.length < S.size; n++) add(pickItem(rollRarity('shop', luck, maxTier), maxTier));
  W.shop = {
    built: true,
    items: chosen.map(def => ({ item: newItem(def.id), cost: buyPrice(def) }))
  };
}

export function stock() {
  if (!W.shop.built) restock();
  return W.shop.items;
}

// 'ok' | 'ash' | 'bag' | 'gone'
export function buy(index) {
  const e = stock()[index];
  if (!e) return 'gone';
  if (P.ash < e.cost) return 'ash';
  if (bagFull()) return 'bag';
  P.ash -= e.cost;
  giveItem(e.item);
  W.shop.items.splice(index, 1);
  return 'ok';
}

// Продать всё «хлам» (обычные вещи из сумки). Возвращает { n, ash }
export function sellJunk() {
  let n = 0, ash = 0;
  for (let i = P.bag.length - 1; i >= 0; i--) {
    if (defOf(P.bag[i]).rarity === CFG.shop.junkRarity) { ash += sellFromBag(i); n++; }
  }
  return { n, ash };
}

export const junkCount = () => P.bag.filter(it => defOf(it).rarity === CFG.shop.junkRarity).length;
