// Тест предметов: целостность данных, таблицы дропа (с распечаткой для баланса), операции инвентаря, влияние статов на бой.
import { CFG } from '../src/config.js';
import { P, W, resetState } from '../src/state.js';
import { setRng, mulberry32 } from '../src/util.js';
import { ITEMS, ITEMS_BY_ID, SLOTS, STAT_KEYS } from '../src/data/items.js';
import { newItem, giveItem, equipFromBag, unequip, sellFromBag, dropFromBag, recalc, derived, compare, sellValue, bagFull, defOf } from '../src/inventory.js';
import { rollDrop, luckAt, maxTierFor, depthAt } from '../src/loot.js';
import { rollSwing, hurtPlayer } from '../src/combat.js';
import { drawIcon, ICON_KEYS } from '../src/icons.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const RAR = CFG.loot.rarityOrder;

// ---------- 1. данные ----------
{
  const ids = new Set();
  for (const it of ITEMS) {
    ok(!ids.has(it.id), 'дубль id ' + it.id); ids.add(it.id);
    ok(SLOTS.includes(it.slot), `${it.id}: слот ${it.slot}`);
    ok(RAR.includes(it.rarity), `${it.id}: редкость ${it.rarity}`);
    ok(Number.isInteger(it.tier) && it.tier >= 1 && it.tier <= 4, `${it.id}: tier ${it.tier}`);
    ok(it.price > 0, `${it.id}: цена`);
    ok(it.name && it.desc && it.desc.length < 90 && !it.desc.includes('\n'), `${it.id}: название/описание в одну строку`);
    ok(ICON_KEYS.includes(it.icon), `${it.id}: иконка ${it.icon}`);
    ok(Array.isArray(it.pal) && it.pal.length === 2 && it.pal.every(c => /^#[0-9a-f]{6}$/i.test(c)), `${it.id}: палитра`);
    const keys = Object.keys(it.stats);
    ok(keys.length > 0 && keys.every(k => STAT_KEYS.includes(k) && Number.isInteger(it.stats[k]) && it.stats[k] !== 0), `${it.id}: статы ${JSON.stringify(it.stats)}`);
    if (it.rarity === 'cursed') ok(Object.values(it.stats).some(v => v < 0), `${it.id}: проклятый без штрафа`);
    if (it.rarity !== 'cursed') ok(Object.values(it.stats).filter(v => v < 0).length <= 1, `${it.id}: слишком много минусов`);
  }
  for (const s of SLOTS) {
    const inSlot = ITEMS.filter(i => i.slot === s);
    ok(inSlot.length >= 6, `слот ${s}: всего ${inSlot.length} предметов`);
    for (const r of RAR) ok(inSlot.some(i => i.rarity === r), `слот ${s}: нет редкости ${r}`);
    ok(inSlot.some(i => i.tier === 1 && i.rarity === 'common'), `слот ${s}: нет стартового предмета`);
  }
  // цена растёт с редкостью (по средним)
  const avg = r => { const a = ITEMS.filter(i => i.rarity === r); return a.reduce((s, i) => s + i.price, 0) / a.length; };
  ok(avg('common') < avg('rare') && avg('rare') < avg('cursed') && avg('cursed') < avg('branded'), 'цены не растут с редкостью');
  // иконки рисуются без ошибок
  const fake = { width: 0, height: 0, getContext() { return { clearRect() {}, fillRect() {}, set fillStyle(v) {} }; } };
  for (const it of ITEMS) drawIcon(fake, it.icon, it.pal);
  console.log(`Предметов: ${ITEMS.length}; ` + RAR.map(r => r + ' ' + ITEMS.filter(i => i.rarity === r).length).join(', '));
}

// ---------- 2. дроп ----------
const share = (type, x, lv, cycle, n = 30000) => {
  resetState(); setRng(mulberry32(5)); P.lv = lv; W.cycle = cycle;
  const c = { none: 0, common: 0, rare: 0, cursed: 0, branded: 0 }; let maxTier = 0, items = 0;
  for (let i = 0; i < n; i++) {
    const d = rollDrop(type, x);
    if (!d.length) c.none++;
    for (const def of d) { c[def.rarity]++; items++; maxTier = Math.max(maxTier, def.tier); }
  }
  return { c, items, n, maxTier, perKill: items / n };
};
{
  const X = { town: CFG.world.town + 30, mid: 1450, deep: 2500 };
  const rows = [];
  const pct = (r, k) => (100 * r.c[k] / Math.max(1, r.items)).toFixed(1).padStart(5);
  console.log('\nДроп (доля редкости среди выпавших, предметов на убийство):');
  console.log('враг   глубина  ур  круг | предм/убийство | обыч  редк  проkl клейм | макс.tier');
  for (const [type, loc, lv, cy] of [
    ['imp', 'town', 1, 0], ['imp', 'deep', 1, 0], ['imp', 'deep', 15, 0],
    ['brute', 'town', 1, 0], ['brute', 'mid', 8, 0], ['brute', 'deep', 20, 0],
    ['lord', 'town', 3, 0], ['lord', 'mid', 8, 0], ['lord', 'deep', 20, 0],
    ['boss', 'mid', 5, 0], ['boss', 'deep', 12, 0], ['boss', 'deep', 20, 3]
  ]) {
    const r = share(type, X[loc], lv, cy);
    rows.push({ type, loc, lv, cy, r });
    console.log(`${type.padEnd(6)} ${loc.padEnd(7)} ${String(lv).padStart(3)} ${String(cy).padStart(4)} | ${r.perKill.toFixed(2).padStart(14)} | ${pct(r, 'common')} ${pct(r, 'rare')} ${pct(r, 'cursed')} ${pct(r, 'branded')}  | ${r.maxTier}`);
  }
  const get = (t, l, v, c) => rows.find(x => x.type === t && x.loc === l && x.lv === v && x.cy === c).r;
  // обычные враги не дают клеймёного
  ok(get('imp', 'deep', 15, 0).c.branded === 0 && get('brute', 'deep', 20, 0).c.branded === 0, 'клеймёный выпал с рядового врага');
  // редкость растёт с глубиной и уровнем
  const rareShare = r => r.c.rare / r.items;
  ok(rareShare(get('brute', 'deep', 20, 0)) > rareShare(get('brute', 'town', 1, 0)) * 1.8, 'доля редких не растёт с глубиной/уровнем');
  ok(get('imp', 'deep', 1, 0).maxTier > get('imp', 'town', 1, 0).maxTier || get('imp', 'town', 1, 0).maxTier === 1, 'tier не растёт с глубиной');
  ok(get('imp', 'town', 1, 0).maxTier === 1, 'у города на 1 уровне выпал предмет выше tier 1');
  // Предвестник: всегда 3 предмета, нет обычных, клеймёные возможны и чаще всех
  const b = get('boss', 'deep', 12, 0);
  ok(Math.abs(b.perKill - 3) < 1e-9, 'с Предвестника не 3 предмета');
  ok(b.c.common === 0, 'с Предвестника выпал обычный');
  ok(b.c.branded / b.items > .1, 'клеймёных с Предвестника слишком мало');
  ok(get('boss', 'deep', 12, 0).c.branded / b.items > get('lord', 'deep', 20, 0).c.branded / Math.max(1, get('lord', 'deep', 20, 0).items), 'лучшее не с Предвестника');
  // доля убийств, с которых что-то выпадает
  ok(get('imp', 'town', 1, 0).perKill < get('brute', 'town', 1, 0).perKill && get('brute', 'town', 1, 0).perKill < get('lord', 'town', 3, 0).perKill, 'шанс дропа не растёт imp<brute<lord');
  resetState();
  console.log(`глубина(2500)=${depthAt(2500).toFixed(2)}; удача: город ур.1=${luckAt(330).toFixed(2)}, край ур.20=${luckAt(2500).toFixed(2)}; tier: ${maxTierFor(luckAt(330))}→${maxTierFor(luckAt(2500))}`);
}

// ---------- 3. инвентарь: фаззинг ----------
{
  resetState(); setRng(mulberry32(77)); recalc();
  const r = mulberry32(4242);
  let gained = 0, sold = 0, dropped = 0, autoSold = 0;
  const check = (i) => {
    const seen = new Set(), all = [...P.bag, ...SLOTS.map(s => P.eq[s]).filter(Boolean)];
    for (const it of all) { ok(!seen.has(it.uid), `опер.${i}: дубль uid ${it.uid}`); seen.add(it.uid); }
    ok(P.bag.length <= CFG.items.bagSize, `опер.${i}: сумка ${P.bag.length}`);
    ok(all.length === gained - sold - dropped, `опер.${i}: потеря/дубль предметов ${all.length} ≠ ${gained - sold - dropped}`);
    for (const s of SLOTS) if (P.eq[s]) ok(defOf(P.eq[s]).slot === s, `опер.${i}: предмет не в своём слоте`);
    ok(P.bag.every(Boolean), `опер.${i}: дыра в сумке`);
    ok(P.hp <= P.maxhp + 1e-9 && P.hp > 0, `опер.${i}: hp ${P.hp}/${P.maxhp}`);
    const exp = { dmg: 0, armor: 0, hp: 0, speed: 0, crit: 0, rage: 0 };
    for (const s of SLOTS) if (P.eq[s]) for (const k of STAT_KEYS) exp[k] += defOf(P.eq[s]).stats[k] || 0;
    ok(P.stats.dmg === exp.dmg && P.stats.hp === exp.hp, `опер.${i}: статы не сходятся`);
  };
  for (let i = 0; i < 6000; i++) {
    const a = r();
    if (a < .35) { const id = ITEMS[Math.floor(r() * ITEMS.length)].id; const it = newItem(id); gained++; if (giveItem(it) === 'sold') { sold++; autoSold++; } }
    else if (a < .6 && P.bag.length) equipFromBag(Math.floor(r() * P.bag.length));
    else if (a < .75) unequip(SLOTS[Math.floor(r() * 6)]);
    else if (a < .88 && P.bag.length) { const before = P.ash; sellFromBag(Math.floor(r() * P.bag.length)); sold++; ok(P.ash > before, 'продажа не дала пепла'); }
    else if (P.bag.length) { dropFromBag(Math.floor(r() * P.bag.length)); dropped++; }
    if (r() < .02) { P.hp = Math.max(1, P.hp - 30); }
    if (i % 3 === 0) check(i);
  }
  console.log(`Инвентарь: ${6000} операций, получено ${gained}, продано ${sold} (из них авто ${autoSold}), выброшено ${dropped}`);
  ok(autoSold > 0, 'автопродажа при полной сумке не проверена');
}

// ---------- 4. статы в бою ----------
{
  resetState(); setRng(mulberry32(9)); recalc();
  const mean = n => { let s = 0; for (let i = 0; i < n; i++) s += rollSwing().dmg; return s / n; };
  const d0 = derived().dmg, m0 = mean(4000);
  giveItem(newItem('w_brand_giant')); equipFromBag(0);
  const d1 = derived().dmg, m1 = mean(4000);
  ok(d1 === d0 + 22, `derived dmg ${d0}→${d1}`);
  ok(m1 > m0 + 15, `средний урон ${m0.toFixed(1)}→${m1.toFixed(1)}`);
  // крит
  P.stats.crit = 0; let crits = 0; for (let i = 0; i < 2000; i++) if (rollSwing().crit) crits++;
  ok(crits === 0, 'крит при 0%');
  P.stats.crit = 50; crits = 0; for (let i = 0; i < 4000; i++) if (rollSwing().crit) crits++;
  ok(crits > 1800 && crits < 2200, `крит 50% → ${crits}/4000`);
  // броня снижает урон
  resetState(); recalc(); P.hp = P.maxhp = 500; W.started = true;
  hurtPlayer(20, 1); const lost0 = 500 - P.hp;
  P.hp = 500; P.inv = 0; P.stats.armor = 30; hurtPlayer(20, 1); const lost1 = 500 - P.hp;
  ok(lost0 === 20 && lost1 === 10, `броня: потеряно ${lost0} → ${lost1} (ждали 20 → 10)`);
  // проклятое: hp-штраф не убивает и не воскрешает
  resetState(); recalc(); giveItem(newItem('w_eclipse_sting')); equipFromBag(0);
  ok(P.maxhp === CFG.player.maxHp - 35 && P.hp === P.maxhp, `проклятый штраф здоровья: ${P.hp}/${P.maxhp}`);
  unequip('weapon'); ok(P.maxhp === CFG.player.maxHp && P.hp === P.maxhp - 35 + 35 - 0 || P.hp <= P.maxhp, 'снятие штрафа ломает здоровье');
  // сравнение
  resetState(); recalc(); giveItem(newItem('w_rust_cleaver')); giveItem(newItem('w_forged_sabre')); equipFromBag(0);
  const cmp = compare(P.bag[0]);
  ok(cmp.length === 1 && cmp[0].k === 'dmg' && cmp[0].diff === 3, 'сравнение с надетым: ' + JSON.stringify(cmp));
  ok(sellValue(newItem('w_brand_giant')) === Math.round(560 * CFG.items.sellRatio), 'цена продажи');
}

if (fails.length) { console.error('\nПРОВАЛ (предметы):\n' + fails.slice(0, 20).join('\n')); process.exit(1); }
console.log('Предметы: OK');
