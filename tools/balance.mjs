// Расчёт баланса экономики по реальному config.js и таблицам дропа (Монте-Карло с фиксированным seed).
// Запуск: node tools/balance.mjs   (параметры: KILLS_PER_MIN=18)
// Модуль также экспортирует compute() — его проверяет test/economy.mjs.
import { fileURLToPath } from 'node:url';
import { CFG } from '../src/config.js';
import { P, W, resetState } from '../src/state.js';
import { setRng, mulberry32, random } from '../src/util.js';
import { ITEMS } from '../src/data/items.js';
import { rollDrop, maxTierFor } from '../src/loot.js';
import { sellValue, newItem, recalc } from '../src/inventory.js';
import { buyPrice, shopLuck } from '../src/shop.js';
import { upgradeCost, upgradeChance } from '../src/smith.js';

export const KILLS_PER_MIN = Number(process.env.KILLS_PER_MIN || 18);   // измерено headless-ботом (с учётом убийств «игроков»)
const avg = r => (r[0] + r[1]) / 2;

// доля убитых по типам: каждый (lordEvery+1)-й спавн — Слуга, остальные — по весам пула (враги открываются с уровня)
function mix(lv = 10) {
  const lord = 1 / (CFG.spawn.lordEvery + 1), rest = 1 - lord;
  const pool = CFG.spawn.pool.filter(p => lv >= p.minLv), sum = pool.reduce((s, p) => s + p.w, 0);
  const m = { lord };
  for (const p of pool) m[p.type] = rest * p.w / sum;
  return m;
}

const xAt = depth => CFG.world.town + depth * (CFG.world.length - CFG.world.town);

export function ashPerKill(lv, depth) {
  const m = mix(lv), mult = 1 + (lv - 1) * CFG.loot.ashPerLevel + depth * CFG.loot.ashPerDepth;
  return Object.entries(m).reduce((s, [t, w]) => s + w * avg(CFG.loot.ash[t]) * mult, 0);
}

// ожидаемая стоимость продажи выпавших вещей на одно убийство и вероятности редкостей
export function dropStats(lv, depth, n = 40000) {
  resetState(); setRng(mulberry32(11)); P.lv = lv;
  const m = mix(lv), x = xAt(depth);
  let value = 0; const per = { rare: 0, cursed: 0, branded: 0, items: 0 };
  for (const [type, w] of Object.entries(m)) {
    let v = 0;
    for (let i = 0; i < n; i++) for (const d of rollDrop(type, x)) {
      v += Math.round(d.price * CFG.items.sellRatio); per.items += w / n;
      if (d.rarity !== 'common') per[d.rarity] += w / n;
    }
    value += w * v / n;
  }
  return { value, ...per };
}

// ожидаемая стоимость улучшения оружия до уровня target (Монте-Карло, с учётом неудач и потери уровня)
export function upgradeCostTo(price, target, runs = 4000) {
  setRng(mulberry32(5));
  let total = 0, attempts = 0;
  for (let r = 0; r < runs; r++) {
    const it = { id: ITEMS.find(i => i.price === price && i.slot === 'weapon').id, up: 0 };
    while (it.up < target) {
      total += upgradeCost(it); attempts++;
      if (random() < upgradeChance(it)) it.up++;
      else if (it.up >= CFG.smith.breakFrom && random() < CFG.smith.breakChance) it.up--;
    }
  }
  return { cost: total / runs, attempts: attempts / runs };
}

export function compute() {
  const rate = KILLS_PER_MIN, out = { rate, levels: [], bench: [], upgrades: [], drops: [], cycle: null };
  const depth = .3;
  for (const lv of [1, 5, 10, 20]) {
    const a = ashPerKill(lv, depth), d = dropStats(lv, depth);
    out.levels.push({ lv, ash: a, sales: d.value, total: a + d.value, perMin: (a + d.value) * rate });
  }
  const cache = new Map();
  const inc = lv => { if (!cache.has(lv)) cache.set(lv, ashPerKill(lv, depth) + dropStats(lv, depth, 12000).value); return cache.get(lv); };
  const kills = (cost, lv) => cost / inc(lv);
  const cheapest = (pred, tier) => Math.min(...ITEMS.filter(pred).filter(i => i.tier <= tier).map(i => buyPrice(i)));
  const avgBuy = pred => { const a = ITEMS.filter(pred).map(buyPrice); return a.reduce((s, v) => s + v, 0) / a.length; };
  const row = (name, cost, lv) => out.bench.push({ name, cost: Math.round(cost), lv, kills: kills(cost, lv), min: kills(cost, lv) / rate });
  row('Первая покупка (самая дешёвая вещь)', cheapest(i => i.rarity === 'common', 1), 1);
  row('Обычная вещь 2-го tier (≈ жилет/шлем)', cheapest(i => i.rarity === 'common' && i.tier === 2 && i.slot !== 'weapon', 2), 1);
  row('Лучшее обычное оружие (плита)', Math.max(...ITEMS.filter(i => i.rarity === 'common' && i.slot === 'weapon').map(buyPrice)), 5);
  row('Первый редкий (самый дешёвый)', cheapest(i => i.rarity === 'rare', 1), 3);
  row('Типичный редкий', avgBuy(i => i.rarity === 'rare'), 6);
  row('Типичный проклятый', avgBuy(i => i.rarity === 'cursed'), 8);
  row('Самый дорогой в магазине (проклятый)', Math.max(...ITEMS.filter(i => i.rarity !== 'branded').map(buyPrice)), 10);
  // клеймёное в магазине не продаётся — для справки цена «как если бы»
  row('(справка) цена клеймёного как в магазине', avgBuy(i => i.rarity === 'branded'), 12);

  const bone = ITEMS.find(i => i.id === 'w_bone_edge'), giant = ITEMS.find(i => i.id === 'w_brand_giant');
  for (const [w, lv] of [[bone, 6], [giant, 12]]) for (const t of [3, 5, 8, 10]) {
    const u = upgradeCostTo(w.price, t); out.upgrades.push({ weapon: w.name, target: t, cost: Math.round(u.cost), attempts: +u.attempts.toFixed(1), kills: kills(u.cost, lv), min: kills(u.cost, lv) / rate, lv });
  }

  // выпадение: сколько убийств до первого редкого / проклятого, сколько Предвестников до клеймёного
  for (const [lv, dp] of [[1, .05], [8, .4], [20, .9]]) {
    const d = dropStats(lv, dp);
    out.drops.push({ lv, depth: dp, perKill: d.items, killsToRare: d.rare ? 1 / d.rare : Infinity, killsToCursed: d.cursed ? 1 / d.cursed : Infinity });
  }
  // Предвестник: 3 броска по таблице boss
  resetState(); setRng(mulberry32(3)); P.lv = 10;
  let br = 0, bc = 0, N = 20000, bossValue = 0;
  for (let i = 0; i < N; i++) { let hasB = false; for (const d of rollDrop('boss', 1500)) { bossValue += Math.round(d.price * CFG.items.sellRatio); if (d.rarity === 'branded') hasB = true; } if (hasB) br++; }
  out.boss = { pBranded: br / N, bossesToBranded: N / br, lootValue: bossValue / N, ash: Math.round(CFG.loot.bossAshBase) + 35 };
  // за круг (между Предвестниками)
  const killsPerCycle = rate * CFG.eclipse.nextTimer / 60;
  out.cycle = { kills: killsPerCycle, income: killsPerCycle * inc(8) + out.boss.ash + out.boss.lootValue, lv: 8 };
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const o = compute(), f = (v, d = 1) => Number.isFinite(v) ? v.toFixed(d) : '∞';
  console.log(`Баланс экономики (скорость убийств ${o.rate}/мин; значения из config.js и таблиц дропа)\n`);
  console.log('Доход на одно убийство (глубина 30%, всё выпавшее продаётся):');
  console.log('  ур. |  пепел | продажа дропа | всего | пепла в минуту');
  for (const l of o.levels) console.log(`  ${String(l.lv).padStart(3)} | ${f(l.ash).padStart(6)} | ${f(l.sales).padStart(13)} | ${f(l.total).padStart(5)} | ${f(l.perMin, 0).padStart(10)}`);
  console.log('\nПокупки у торговца (цена = price × наценка редкости):');
  console.log('  что                                           | цена | ур. | убийств | минут');
  for (const r of o.bench) console.log(`  ${r.name.padEnd(46)}| ${String(r.cost).padStart(4)} | ${String(r.lv).padStart(3)} | ${f(r.kills, 0).padStart(7)} | ${f(r.min).padStart(5)}`);
  console.log('\nКузнец (ожидаемая стоимость с учётом неудач и потери уровня):');
  console.log('  оружие              | до | пепла | попыток | ур. | убийств | минут');
  for (const u of o.upgrades) console.log(`  ${u.weapon.padEnd(20)}| +${String(u.target).padStart(2)} | ${String(u.cost).padStart(5)} | ${String(u.attempts).padStart(7)} | ${String(u.lv).padStart(3)} | ${f(u.kills, 0).padStart(7)} | ${f(u.min).padStart(5)}`);
  console.log('\nВыпадение редких вещей (с одного убийства):');
  console.log('  ур. | глубина | вещей/убийство | убийств до редкого | до проклятого');
  for (const d of o.drops) console.log(`  ${String(d.lv).padStart(3)} | ${f(d.depth * 100, 0).padStart(6)}% | ${f(d.perKill, 2).padStart(14)} | ${f(d.killsToRare, 0).padStart(18)} | ${f(d.killsToCursed, 0).padStart(13)}`);
  console.log(`\nПредвестник: клеймёное выпадает в ${f(o.boss.pBranded * 100, 0)}% побед (в среднем раз в ${f(o.boss.bossesToBranded)} победы); добыча с него ≈ ${f(o.boss.lootValue, 0)} пепла при продаже`);
  console.log(`За круг между Предвестниками (≈${f(o.cycle.kills, 0)} убийств, ур.${o.cycle.lv}): ≈ ${f(o.cycle.income, 0)} пепла`);
}
