// Инвентарь: сумка, надетое, итоговые статы, продажа. Без DOM.
import { CFG } from './config.js';
import { P, W } from './state.js';
import { clamp } from './util.js';
import { ITEMS_BY_ID, SLOTS, STAT_KEYS } from './data/items.js';
import { weaponLen } from './data/looks.js';
import { mods } from './skills.js';
import { emit } from './events.js';

export const emptyStats = () => ({ dmg: 0, armor: 0, hp: 0, speed: 0, crit: 0, rage: 0 });
export const defOf = it => ITEMS_BY_ID[it.id];

export function newItem(id) {
  if (!ITEMS_BY_ID[id]) throw new Error('нет предмета ' + id);
  return { uid: ++W.itemSeq, id, up: 0 };
}

// Статы экземпляра: у оружия урон растёт с уровнем улучшения кузнеца
export function itemStats(it) {
  const d = defOf(it);
  if (!it.up || d.slot !== 'weapon') return d.stats;
  const S = CFG.smith, base = d.stats.dmg || 0;
  return { ...d.stats, dmg: base + Math.round(it.up * (S.dmgFlat + base * S.dmgPercent)) };
}

export const itemName = it => defOf(it).name + (it.up ? ' +' + it.up : '');

export const sellValue = it => Math.max(1, Math.round(defOf(it).price * CFG.items.sellRatio));

export const armorReduction = armor => armor / (armor + CFG.items.armorK);

// Пересчёт итоговых статов и максимума здоровья. Рост максимума добавляет здоровья столько же (надел — не «пустой»),
// падение — обрезает до нового максимума.
export function recalc() {
  const I = CFG.items, s = emptyStats();
  for (const slot of SLOTS) {
    const it = P.eq[slot];
    if (!it) continue;
    const st = itemStats(it);
    for (const k of STAT_KEYS) s[k] += st[k] || 0;
  }
  const m = mods();                       // навыки добавляют к тем же итогам, что и предметы
  s.crit += m.crit; s.rage += m.rage; s.hp += m.hp; s.speed += m.speed;
  s.armor = Math.max(I.armorMin, s.armor);
  s.crit = clamp(s.crit, 0, I.critCap);
  s.speed = clamp(s.speed, I.speedMin, I.speedMax);
  s.rage = clamp(s.rage, -50, I.rageMax);
  P.stats = s;
  const prev = P.maxhp;
  P.maxhp = Math.max(I.hpFloor, CFG.player.maxHp + (P.lv - 1) * CFG.player.hpPerLevel + s.hp);
  if (!P.dead && P.maxhp > prev) P.hp += P.maxhp - prev;
  if (P.hp > P.maxhp) P.hp = P.maxhp;
  emit('gear');
}

// Что видит игрок на экране персонажа / в итоговой строке
export function derived() {
  const s = P.stats, C = CFG.player;
  const dmg = Math.max(1, Math.round(C.baseDamage + P.lv * C.damagePerLevel + s.dmg));
  return {
    dmg, heavy: Math.round(dmg * C.heavyMult),
    reach: Math.round(C.reachLight + (weaponLen(P.eq) - C.weaponBaseLen) * C.reachPerLen),
    armor: s.armor, reduction: Math.round(100 * armorReduction(s.armor)),
    hp: P.maxhp, speed: s.speed, crit: s.crit, rage: s.rage
  };
}

export const bagFull = () => P.bag.length >= CFG.items.bagSize;

// Добавить предмет в сумку. Если нет места — сразу продаётся за пепел. Возвращает 'bag' | 'sold'.
export function giveItem(it) {
  if (!bagFull()) { P.bag.push(it); P.newItems++; return 'bag'; }
  P.ash += sellValue(it);
  return 'sold';
}

export function equipFromBag(index) {
  const it = P.bag[index];
  if (!it) return false;
  const slot = defOf(it).slot, old = P.eq[slot];
  if (old) P.bag[index] = old; else P.bag.splice(index, 1);
  P.eq[slot] = it;
  recalc();
  return true;
}

export function unequip(slot) {
  const it = P.eq[slot];
  if (!it || bagFull()) return false;
  P.eq[slot] = null;
  P.bag.push(it);
  recalc();
  return true;
}

export function sellFromBag(index) {
  const it = P.bag[index];
  if (!it) return 0;
  P.bag.splice(index, 1);
  const v = sellValue(it);
  P.ash += v;
  return v;
}

export function dropFromBag(index) {
  if (!P.bag[index]) return false;
  P.bag.splice(index, 1);
  return true;
}

// Сравнение с надетым в том же слоте: [{k, now, was, diff}] по всем статам, которые есть хоть у одного
export function compare(it) {
  const def = defOf(it), worn = P.eq[def.slot];
  const a = itemStats(it), b = worn && worn !== it ? itemStats(worn) : null;
  const rows = [];
  for (const k of STAT_KEYS) {
    const now = a[k] || 0, was = b ? (b[k] || 0) : 0;
    if (now || was) rows.push({ k, now, was, diff: b ? now - was : null });
  }
  return rows;
}
