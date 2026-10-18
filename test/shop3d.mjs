// Тест торговли 3D: цены, доступность только рядом с торговцем, покупка/продажа, хлам, обновление витрины.
import { CFG3 } from '../3d/src/config3d.js';
import { BY_ID, CATALOG } from '../3d/src/data/items.js';
import { createWorld, step, mulberry32, buyItem, sellItem, sellJunk, buyPrice, sellPrice, restock, upgradeItem, upgradeCost } from '../3d/src/sim.js';
import { equipAt, unequip, serialize, deserialize, addItem, gearStats } from '../3d/src/inv.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const cfg = JSON.parse(JSON.stringify(CFG3)); cfg.enemies.count = 0;
const W = createWorld(cfg, mulberry32(7)); W.player.inv = 1e9;
const shopB = W.map.buildings.find(b => b.npc && b.npc.kind === 'merchant'); ok(shopB && shopB.kind === 'shop', 'в мире нет лавки с торговцем');
// нет арбитража: купить дороже, чем продать, у любой вещи
for (const it of CATALOG) ok(buyPrice(it, cfg) > sellPrice(it, cfg), 'арбитраж ' + it.id);
ok(W.shop.stock.length >= 8 && ['p_heal1', 'key_rust', 'f_rye'].every(id => W.shop.stock.some(s => s.id === id)), 'витрина пуста или без базовых товаров: ' + W.shop.stock.length);
ok(W.shop.stock.every(s => BY_ID[s.id] && s.n >= 1), 'мусор на витрине');
// далеко от торговца
W.player.x = 0; W.player.z = 4; step(W, 1 / 60, {}); ok(!W.nearMerchant, 'торговец «рядом» у костра');
W.inv.ash = 1000; ok(buyItem(W, 0) === 'far', 'покупка издалека'); W.inv.bag.push({ id: 'k_brooch', n: 1 }); ok(sellItem(W, 0, 1) === 'far' && sellJunk(W) === -1, 'продажа издалека');
// рядом
W.player.x = shopB.npc.x + 1; W.player.z = shopB.npc.z; step(W, 1 / 60, {}); ok(W.nearMerchant, 'торговец не определился рядом');
const iHeal = W.shop.stock.findIndex(s => s.id === 'p_heal1'), n0 = W.shop.stock[iHeal].n, p = buyPrice(BY_ID.p_heal1, cfg);
W.inv.ash = p - 1; ok(buyItem(W, iHeal) === 'ash' && W.inv.ash === p - 1 && W.shop.stock[iHeal].n === n0, 'покупка без денег прошла');
W.inv.ash = p + 5; ok(buyItem(W, iHeal) === 'ok' && W.inv.ash === 5 && W.inv.bag.some(s => s.id === 'p_heal1') && W.shop.stock[iHeal].n === n0 - 1, 'покупка не сработала');
// полная сумка
{ const sv = W.inv.bag; W.inv.bag = []; for (let i = 0; i < cfg.bag.slots; i++) W.inv.bag.push({ id: 'w_sword_rust', n: 1 }); W.inv.ash = 999; const i2 = W.shop.stock.findIndex(s => !['key', 'gem', 'consumable'].includes(BY_ID[s.id].cat)); ok(buyItem(W, i2) === 'full' && W.inv.ash === 999, 'покупка в полную сумку');
  const ik = W.shop.stock.findIndex(s => s.id === 'key_rust'); ok(ik < 0 || buyItem(W, ik) === 'ok', 'ключ не покупается в полную сумку (ключи места не занимают)'); W.inv.bag = sv; }
// распродажа позиции до нуля убирает её с витрины
{ W.inv.ash = 1e6; const i3 = W.shop.stock.findIndex(s => s.id === 'key_rust'), cnt = W.shop.stock[i3].n; for (let k = 0; k < cnt; k++) buyItem(W, W.shop.stock.findIndex(s => s.id === 'key_rust')); ok(!W.shop.stock.some(s => s.id === 'key_rust'), 'проданная позиция осталась на витрине'); }
// продажа
W.inv.bag = [{ id: 'k_goblet', n: 1 }, { id: 'c_grosh', n: 7 }, { id: 'w_sword_steel', n: 1 }, { id: 'm_ore', n: 3 }, { id: 'p_heal2', n: 2 }]; W.inv.ash = 0;
ok(sellItem(W, 1, 3) === 'ok' && W.inv.ash === sellPrice(BY_ID.c_grosh, cfg) * 3 && W.inv.bag[1].n === 4, 'продажа части стека');
const before = W.inv.ash, sum = sellJunk(W);
ok(sum === sellPrice(BY_ID.k_goblet, cfg) + sellPrice(BY_ID.c_grosh, cfg) * 4 + sellPrice(BY_ID.m_ore, cfg) * 3 && W.inv.ash === before + sum, 'хлам продан неверно: ' + sum);
ok(W.inv.bag.length === 2 && W.inv.bag.every(s => ['w_sword_steel', 'p_heal2'].includes(s.id)), 'оружие и зелья не должны уходить как хлам');
// витрина обновляется со временем
{ const old = JSON.stringify(W.shop.stock); for (let i = 0; i < 60 * (cfg.shop.restock + 2); i += 30) step(W, .5, {}); ok(W.shop.t < cfg.shop.restock, 'витрина не обновилась'); }
// кузнец
{
  const W2 = createWorld(cfg, mulberry32(9)); W2.player.inv = 1e9; const sb = W2.map.buildings.find(b => b.npc && b.npc.kind === 'smith'); ok(sb, 'в мире нет кузнеца');
  W2.inv.eq.weapon = 'w_sword_steel'; W2.inv.bag.push({ id: 'a_body_mail_mail', n: 1 }); W2.inv.ash = 100000;
  step(W2, 1 / 60, {}); ok(W2.nearNpc === null && upgradeItem(W2, { slot: 'weapon' }) === 'far', 'улучшение издалека');
  W2.player.x = sb.npc.x + 1; W2.player.z = sb.npc.z; step(W2, 1 / 60, {}); ok(W2.nearNpc === 'smith' && !W2.nearMerchant, 'кузнец не определился');
  const it = BY_ID.w_sword_steel, d0 = W2.gear.dmg;
  let lvl = 0, spent = 0; const a0 = W2.inv.ash;
  for (; lvl < cfg.smith.max; lvl++) { const c = upgradeCost(it, lvl, cfg); ok(upgradeItem(W2, { slot: 'weapon' }) === 'ok', 'улучшение ' + lvl); spent += c; }
  ok(W2.inv.up.weapon === 5 && a0 - W2.inv.ash === spent, 'цена улучшений не списана точно');
  ok(upgradeItem(W2, { slot: 'weapon' }) === 'max' && W2.inv.up.weapon === 5, 'предел +5 нарушен');
  step(W2, 1 / 60, {}); ok(W2.gear.dmg === Math.round(it.stats.dmg * 1.5), `урон +5: ${W2.gear.dmg}`); ok(W2.gear.dmg > d0, 'урон не вырос');
  ok(upgradeCost(it, 4, cfg) > upgradeCost(it, 0, cfg) * 5, 'цена не растёт достаточно');
  // вещь в сумке: улучшение остаётся при надевании и снятии, не складывается со стопками
  ok(upgradeItem(W2, { idx: W2.inv.bag.findIndex(s => s.id === 'a_body_mail_mail') }) === 'ok', 'улучшение вещи из сумки');
  equipAt(W2.inv, W2.inv.bag.findIndex(s => s.id === 'a_body_mail_mail')); ok(W2.inv.up.body === 1, 'уровень не перенёсся при надевании');
  unequip(W2.inv, 'weapon', cfg.bag.slots); ok(W2.inv.bag.some(s => s.id === 'w_sword_steel' && s.up === 5) && !W2.inv.up.weapon, 'уровень не перенёсся в сумку');
  { const inv = W2.inv; addItem(inv, 'f_rye', 3, 30); const before = inv.bag.length; addItem(inv, 'w_sword_steel', 1, 30); ok(inv.bag.length === before + 1, 'улучшенная вещь слилась со стопкой'); }
  // сохранение
  const d = deserialize(JSON.parse(JSON.stringify(serialize(W2.inv))), 30); ok(d.up.body === 1 && d.bag.some(s => s.id === 'w_sword_steel' && s.up === 5), 'уровни не пережили сохранение');
  const bad = deserialize({ bag: [{ id: 'w_sword_steel', n: 1, up: 99 }, { id: 'f_rye', n: 1, up: 3 }], eq: { weapon: 'w_sword_iron' }, up: { weapon: -4, body: 3 } }, 30);
  ok(bad.bag[0].up === 5 && !bad.bag[1].up && !bad.up.weapon && !bad.up.body, 'мусорные уровни не очищены: ' + JSON.stringify(bad));
  // без денег
  W2.inv.ash = 0; ok(upgradeItem(W2, { slot: 'body' }) === 'ash', 'улучшение без пепла');
  // улучшенная вещь дороже при продаже
  ok(sellPrice(it, cfg, 5) > sellPrice(it, cfg, 0) * 2, 'улучшение не повышает цену продажи');
}
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Торговля 3D: OK');
