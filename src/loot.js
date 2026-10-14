// Таблицы выпадения: что и с какой редкостью падает с врагов и Предвестника.
import { CFG } from './config.js';
import { P, W } from './state.js';
import { clamp, random, pick, riIn } from './util.js';
import { ITEMS } from './data/items.js';
import { newItem, giveItem, defOf, sellValue } from './inventory.js';
import { chat } from './chat.js';
import { burst } from './fx.js';
import { sfx } from './audio.js';

const byRarity = {};
for (const r of CFG.loot.rarityOrder) byRarity[r] = ITEMS.filter(i => i.rarity === r);

export function depthAt(x) {
  return clamp((x - CFG.world.town) / (CFG.world.length - CFG.world.town), 0, 1);
}

export function luckAt(x, bonus = 0) {
  const L = CFG.loot;
  return depthAt(x) * L.luckPerDepth + (P.lv - 1) * L.luckPerLevel + W.cycle * L.luckPerCycle + bonus;
}

export const maxTierFor = (luck, tierBonus = 0) => 1 + Math.floor(Math.max(0, luck) / CFG.loot.tierStep) + tierBonus;

// Бросок редкости по таблице; редкости без подходящих по tier предметов пропускаются
export function rollRarity(tableName, luck, maxTier) {
  const T = CFG.loot.tables[tableName];
  const order = CFG.loot.rarityOrder, w = [];
  let sum = 0;
  for (const r of order) {
    const has = byRarity[r].some(i => i.tier <= maxTier);
    const v = has ? Math.max(0, T.base[r] * (1 + luck * T.grow[r])) : 0;
    w.push(v); sum += v;
  }
  if (sum <= 0) return 'common';
  let x = random() * sum;
  for (let i = 0; i < order.length; i++) { x -= w[i]; if (x < 0) return order[i]; }
  return 'common';
}

export function pickItem(rarity, maxTier) {
  const pool = byRarity[rarity].filter(i => i.tier <= maxTier);
  return pool.length ? pick(pool) : null;
}

// Предметы, выпавшие с врага данного типа в точке x (массив определений)
export function rollDrop(type, x) {
  const D = CFG.loot.drops[type];
  if (!D) return [];
  if (random() >= D.chance) return [];
  const luck = luckAt(x, D.luck);
  const maxTier = maxTierFor(luck, type === 'boss' ? CFG.loot.bossTierBonus : 0);
  const out = [];
  for (let i = 0; i < D.rolls; i++) {
    const def = pickItem(rollRarity(D.table, luck, maxTier), maxTier) || pickItem('common', maxTier);
    if (def) out.push(def);
  }
  return out;
}

// Пепел за убитого врага: диапазон по типу × рост с уровнем и глубиной
export function ashFor(e) {
  const L = CFG.loot, r = L.ash[e.type];
  if (!r) return 0;
  const mult = 1 + (P.lv - 1) * L.ashPerLevel + depthAt(e.x) * L.ashPerDepth;
  return Math.max(1, Math.round(riIn(r) * mult));
}

// Выдать добычу за убитого врага игроку (вызывается из killEnemy)
export function lootFor(e) {
  const cols = CFG.items.rarity;
  for (const def of rollDrop(e.type, e.x)) {
    const it = newItem(def.id);
    const where = giveItem(it);
    const col = cols[def.rarity].color;
    chat('', where === 'bag' ? 'Получено: ' + def.name : 'Сумка полна, продано: ' + def.name + ' (+' + sellValue(it) + ')', 'loot', col);
    burst(e.x, e.h * .6, def.rarity === 'common' ? 4 : 12, [col, '#f6eed9'], 40, 50);
    sfx.loot(def.rarity);
  }
}

export { defOf };
