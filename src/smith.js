// Кузнец: улучшение оружия за пепел. Без DOM.
import { CFG } from './config.js';
import { P } from './state.js';
import { random } from './util.js';
import { defOf, itemStats, recalc } from './inventory.js';

export const isUpgradable = it => !!it && defOf(it).slot === 'weapon';
export const maxed = it => (it.up || 0) >= CFG.smith.maxLevel;

export function upgradeCost(it) {
  const S = CFG.smith;
  return Math.round((S.baseCost + defOf(it).price * S.costPerPrice) * Math.pow(S.costGrowth, it.up || 0));
}
export const upgradeChance = it => CFG.smith.success[it.up || 0] ?? 0;

// Урон сейчас и после успешного улучшения (для карточки)
export function dmgNowNext(it) {
  const now = itemStats(it).dmg || 0;
  const next = itemStats({ ...it, up: (it.up || 0) + 1 }).dmg || 0;
  return { now, next };
}

// Попытка улучшения. Возвращает { r: 'max' | 'ash' | 'success' | 'fail' | 'down', cost, up }
export function tryUpgrade(it) {
  if (!isUpgradable(it)) return { r: 'bad' };
  if (maxed(it)) return { r: 'max' };
  const cost = upgradeCost(it);
  if (P.ash < cost) return { r: 'ash', cost };
  P.ash -= cost;
  if (random() < upgradeChance(it)) { it.up = (it.up || 0) + 1; recalc(); return { r: 'success', cost, up: it.up }; }
  const S = CFG.smith;
  if ((it.up || 0) >= S.breakFrom && random() < S.breakChance) { it.up--; recalc(); return { r: 'down', cost, up: it.up }; }
  return { r: 'fail', cost, up: it.up || 0 };
}

// Оружие, которое можно улучшить: надетое и из сумки
export function upgradables() {
  const list = [];
  if (P.eq.weapon) list.push({ it: P.eq.weapon, src: 'eq' });
  P.bag.forEach((it, i) => { if (isUpgradable(it)) list.push({ it, src: 'bag', i }); });
  return list;
}
