// Выдача наград за задания. Возвращает строку для чата.
import { P } from './state.js';
import { newItem, giveItem, itemName } from './inventory.js';
import { pickItem, maxTierFor } from './loot.js';
import { shopLuck } from './shop.js';
import { gainXP } from './combat.js';
import { ITEMS_BY_ID } from './data/items.js';

export function grantReward(r) {
  const parts = [];
  if (r.ash) { P.ash += r.ash; parts.push(r.ash + ' пепла'); }
  if (r.xp) { gainXP(r.xp); parts.push(r.xp + ' опыта'); }
  if (r.sp) { P.sp += r.sp; parts.push('+' + r.sp + ' очко навыка'); }
  let def = null;
  if (r.item) def = ITEMS_BY_ID[r.item];
  else if (r.rarity) def = pickItem(r.rarity, maxTierFor(shopLuck(), 1)) || pickItem('common', 4);
  if (def) {
    const it = newItem(def.id), where = giveItem(it);
    parts.push(itemName(it) + (where === 'bag' ? '' : ' (сумка полна — продано)'));
  }
  return parts.join(', ');
}
