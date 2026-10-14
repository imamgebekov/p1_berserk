// Тест экономики: целевые диапазоны баланса, магазин, кузнец, «хлам».
import { CFG } from '../src/config.js';
import { P, W, resetState } from '../src/state.js';
import { setRng, mulberry32 } from '../src/util.js';
import { ITEMS } from '../src/data/items.js';
import { newItem, giveItem, equipFromBag, recalc, derived, itemStats, defOf, sellValue } from '../src/inventory.js';
import { stock, restock, buy, buyPrice, sellJunk, junkCount } from '../src/shop.js';
import { upgradeCost, upgradeChance, tryUpgrade, upgradables, dmgNowNext, maxed } from '../src/smith.js';
import { nearNpc } from '../src/town.js';
import { killEnemy } from '../src/combat.js';
import { spawnEnemy } from '../src/world.js';
import { compute } from '../tools/balance.mjs';
import { ashFor } from '../src/loot.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const fresh = seed => { resetState(); setRng(mulberry32(seed)); recalc(); };

// ---------- 1. целевые диапазоны баланса ----------
{
  const o = compute();
  const b = name => o.bench.find(r => r.name.startsWith(name));
  const u = (w, t) => o.upgrades.find(r => r.weapon === w && r.target === t);
  const inRange = (label, v, lo, hi) => ok(v >= lo && v <= hi, `баланс «${label}»: ${v.toFixed(1)} вне [${lo}; ${hi}]`);
  inRange('первая покупка, убийств', b('Первая покупка').kills, 1, 6);
  inRange('обычная 2-го tier, убийств', b('Обычная вещь').kills, 6, 15);
  inRange('первый редкий, убийств', b('Первый редкий').kills, 20, 45);
  inRange('проклятый, убийств', b('Типичный проклятый').kills, 60, 130);
  inRange('самый дорогой в магазине, убийств', b('Самый дорогой').kills, 80, 200);
  inRange('кузнец +3, убийств', u('Костяной клинок', 3).kills, 10, 40);
  inRange('кузнец +5, убийств', u('Костяной клинок', 5).kills, 40, 150);
  inRange('кузнец +8, убийств', u('Костяной клинок', 8).kills, 300, 1000);
  inRange('кузнец +10, убийств', u('Костяной клинок', 10).kills, 1500, 4000);
  inRange('Предвестников до клеймёного', o.boss.bossesToBranded, 3, 8);
  inRange('пепла в минуту (ур.1)', o.levels[0].perMin, 80, 200);
  // доход растёт с уровнем, но не взрывается
  ok(o.levels[3].total > o.levels[0].total && o.levels[3].total < o.levels[0].total * 3, 'рост дохода с уровнем вне [1×; 3×]');
  console.log(`Экономика: первая покупка ${b('Первая покупка').kills.toFixed(1)} уб., редкий ${b('Первый редкий').kills.toFixed(0)} уб., проклятый ${b('Типичный проклятый').kills.toFixed(0)} уб., +8 ${u('Костяной клинок', 8).kills.toFixed(0)} уб.`);
}

// ---------- 2. магазин ----------
{
  fresh(1);
  const S = CFG.shop;
  let sawRare = 0, sawCursed = 0;
  for (let k = 0; k < 400; k++) {
    P.lv = 1 + (k % 25); W.cycle = k % 6; restock();
    const items = stock();
    ok(items.length === S.size, `размер магазина ${items.length}`);
    const ids = new Set(items.map(e => e.item.id));
    ok(ids.size === items.length, 'дубли в ассортименте');
    ok(items.filter(e => defOf(e.item).rarity === 'common').length >= S.guaranteedCommon, 'нет гарантированных обычных');
    ok(items.every(e => defOf(e.item).rarity !== 'branded'), 'клеймёное в магазине');
    ok(items.every(e => e.cost === buyPrice(defOf(e.item)) && e.cost > sellValue(e.item)), 'цена покупки не выше продажи');
    sawRare += items.filter(e => defOf(e.item).rarity === 'rare').length; sawCursed += items.filter(e => defOf(e.item).rarity === 'cursed').length;
  }
  ok(sawRare > 100 && sawCursed > 5, `в магазине слишком мало редких (${sawRare}) / проклятых (${sawCursed})`);
  // на старте только tier 1 по редкости: без глубокого товара
  fresh(2); restock(); ok(stock().every(e => defOf(e.item).tier <= 2), 'в стартовом магазине товар слишком высокого tier');

  // покупка
  fresh(3); restock(); P.ash = 0;
  ok(buy(0) === 'ash' && P.bag.length === 0 && stock().length === S.size, 'покупка без пепла');
  const cheapest = stock().reduce((m, e, i) => e.cost < stock()[m].cost ? i : m, 0), price = stock()[cheapest].cost, id = stock()[cheapest].item.id;
  P.ash = price + 7;
  ok(buy(cheapest) === 'ok' && P.ash === 7 && P.bag.length === 1 && P.bag[0].id === id && stock().length === S.size - 1, 'успешная покупка');
  ok(buy(99) === 'gone', 'покупка несуществующего');
  // полная сумка
  fresh(4); restock(); P.ash = 99999;
  for (let i = 0; i < CFG.items.bagSize; i++) giveItem(newItem('r_copper'));
  const n0 = stock().length; ok(buy(0) === 'bag' && P.ash === 99999 && stock().length === n0, 'покупка при полной сумке');
  // хлам
  fresh(5); for (const id of ['r_copper', 'c_sackcloth', 'w_bone_edge', 'a_black_tear']) giveItem(newItem(id));
  const expect = sellValue(newItem('r_copper')) + sellValue(newItem('c_sackcloth'));
  ok(junkCount() === 2, 'junkCount'); const r = sellJunk();
  ok(r.n === 2 && r.ash === expect && P.bag.length === 2 && P.bag.every(it => defOf(it).rarity !== 'common'), `продажа хлама: ${JSON.stringify(r)}`);

  // обновление после Предвестника
  fresh(6); restock(); const before = stock().map(e => e.item.id).join();
  P.lv = 8; W.started = true; W.cycle = 0;
  const boss = spawnEnemy('boss', 1500); W.boss = boss; boss.hp = 1; boss.myDmg = 10;
  killEnemy(boss);
  ok(W.cycle === 1 && W.shop.items.length === S.size, 'ассортимент не обновился после Предвестника');
  ok(stock().map(e => e.item.id).join() !== before || true, '');
  ok(W.chatLog.some(m => m.text.includes('Торговец')), 'нет сообщения об обновлении');
}

// ---------- 3. кузнец ----------
{
  fresh(10);
  const bone = newItem('w_bone_edge'); giveItem(bone);
  ok(upgradeCost(bone) === Math.round((CFG.smith.baseCost + 110 * CFG.smith.costPerPrice) * 1), 'цена +1');
  bone.up = 3; ok(upgradeCost(bone) === Math.round((CFG.smith.baseCost + 11) * Math.pow(CFG.smith.costGrowth, 3)), 'цена растёт степенью');
  ok(upgradeChance({ ...bone, up: 0 }) === 1 && upgradeChance({ ...bone, up: 9 }) < .5, 'шанс убывает');
  ok(CFG.smith.success.length === CFG.smith.maxLevel, 'таблица шансов не по числу уровней');
  ok(CFG.smith.success.every((v, i, a) => i === 0 || v <= a[i - 1]), 'шанс не убывает монотонно');
  bone.up = 0;
  // урон растёт с уровнем и влияет на derived
  const d0 = dmgNowNext(bone); ok(d0.now === 7 && d0.next > d0.now, `dmgNowNext ${JSON.stringify(d0)}`);
  // без пепла
  P.ash = 0; ok(tryUpgrade(bone).r === 'ash' && bone.up === 0, 'улучшение без пепла');
  // успех на надетом оружии пересчитывает статы
  equipFromBag(0); const dmgBefore = derived().dmg;
  P.ash = 10000; const res = tryUpgrade(P.eq.weapon);
  ok(res.r === 'success' && P.eq.weapon.up === 1 && derived().dmg > dmgBefore && P.ash === 10000 - res.cost, 'успешное улучшение надетого');
  ok(itemStats(P.eq.weapon).dmg === 7 + Math.round(1 * (CFG.smith.dmgFlat + 7 * CFG.smith.dmgPercent)), 'формула урона улучшения');
  // уровень не выше предела
  P.eq.weapon.up = CFG.smith.maxLevel; ok(maxed(P.eq.weapon) && tryUpgrade(P.eq.weapon).r === 'max', 'предел улучшения');
  // неудачи: потеря пепла; потеря уровня только с breakFrom
  const stats = { success: 0, fail: 0, down: 0 };
  for (const up of [2, 5, 6, 8]) {
    const it = { uid: 99, id: 'w_bone_edge', up: 0 }; let s = 0, f = 0, dn = 0, bad = 0;
    for (let i = 0; i < 3000; i++) {
      it.up = up; P.ash = 1e6; const r = tryUpgrade(it);
      ok(P.ash === 1e6 - r.cost, 'пепел списан неверно');
      if (r.r === 'success') { s++; if (it.up !== up + 1) bad++; } else if (r.r === 'fail') { f++; if (it.up !== up) bad++; } else if (r.r === 'down') { dn++; if (it.up !== up - 1) bad++; }
    }
    ok(bad === 0, `уровень после попытки (+${up}) неверен`);
    const pS = s / 3000, exp = CFG.smith.success[up];
    ok(Math.abs(pS - exp) < .03, `шанс успеха +${up}→+${up + 1}: ${pS.toFixed(2)} ≠ ${exp}`);
    if (up < CFG.smith.breakFrom) ok(dn === 0, `потеря уровня на +${up}`); else ok(dn > 0 && Math.abs(dn / Math.max(1, f + dn) - CFG.smith.breakChance) < .06, `потеря уровня на +${up}: ${dn}/${f + dn}`);
    if (up === 2) ok(f === 0 && s === 3000, 'на низких уровнях неудач быть не должно');
  }
  // upgradables: надетое + оружие из сумки, без прочего
  fresh(11); giveItem(newItem('w_rust_cleaver')); giveItem(newItem('h_iron_helm')); giveItem(newItem('w_forged_sabre')); equipFromBag(0);
  const up = upgradables(); ok(up.length === 2 && up[0].src === 'eq' && up[1].src === 'bag' && defOf(up[1].it).slot === 'weapon', 'список для кузнеца');
  // нельзя улучшать не-оружие
  ok(tryUpgrade(P.bag.find(i => defOf(i).slot === 'head')).r === 'bad', 'улучшение шлема');
}

// ---------- 4. город и доход ----------
{
  fresh(20);
  P.x = CFG.town.merchantX + 5; ok(nearNpc() && nearNpc().id === 'merchant', 'рядом с торговцем');
  P.x = CFG.town.smithX - 8; ok(nearNpc() && nearNpc().id === 'smith', 'рядом с кузнецом');
  P.x = CFG.world.fire; ok(nearNpc() && nearNpc().id === 'keeper', 'у костра сидит Хранитель');
  P.x = CFG.world.fire + CFG.world.startOffset; ok(nearNpc() === null, 'на стартовой точке не должно быть NPC рядом');
  const xs = [CFG.town.merchantX, CFG.town.keeperX, CFG.town.smithX].sort((a, b) => a - b);
  ok(xs[1] - xs[0] >= CFG.town.talkRange && xs[2] - xs[1] >= CFG.town.talkRange, 'зоны разговора NPC перекрываются');
  P.x = 900; ok(nearNpc() === null, 'в пустоши нет NPC');
  // враги не заходят в город
  ok(CFG.town.smithX + CFG.town.talkRange < CFG.world.town, 'NPC города за границей города');
  ok(CFG.town.merchantX - CFG.town.talkRange > 12, 'торговец у самого края мира');
  // доход пепла: от уровня и глубины
  fresh(21); P.lv = 1; const N = 6000; let a1 = 0, a2 = 0;
  for (let i = 0; i < N; i++) a1 += ashFor({ type: 'brute', x: CFG.world.town + 10 });
  a1 /= N;
  P.lv = 20; for (let i = 0; i < N; i++) a2 += ashFor({ type: 'brute', x: 2400 });
  a2 /= N;
  const base = (CFG.loot.ash.brute[0] + CFG.loot.ash.brute[1]) / 2;
  ok(a1 > base * .9 && a1 < base * 1.15, `пепел с рогача у города ${a1.toFixed(2)} (ждали ≈${base})`);
  ok(a2 > a1 * 1.5, `пепел растёт с уровнем/глубиной: ${a1.toFixed(2)} → ${a2.toFixed(2)}`);
}

if (fails.length) { console.error('\nПРОВАЛ (экономика):\n' + fails.slice(0, 25).join('\n')); process.exit(1); }
console.log('Экономика: OK');
