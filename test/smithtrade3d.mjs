// Лавка кузнеца (Мир 5.0, этап 3, просьба владельца 2026-10-23): кузнец продаёт и скупает камни силы, материалы и реагенты; ассортимент —
// по уровню места (Брод 20, лагеря 25 / 45 / 65 → ступени 1 / 2 / 3): ранги камней, редкие материалы, уголёк и осколок — только на 3-й;
// цены лагеря × price; покупка и продажа — только у кузнеца; завоз раз в shop.restock с; общий W.rng не тратится.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32 } from '../3d/src/sim.js';
import { smithShop, smithPrice, buySmith, sellSmith, smithBuys, tierOf } from '../3d/src/smithtrade3d.js';
import { buyPrice } from '../3d/src/economy3d.js';
import { BY_ID } from '../3d/src/data/items.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0;
const W = createWorld(c, mulberry32(6)); W.lv = 50; W.inv.ash = 1e6; step(W, 1 / 60, {});
const at = b => { W.player.x = b.npc.x + 1; W.player.z = b.npc.z; step(W, 1 / 60, {}); };
const smiths = [W.map.buildings.find(b => b.npc && b.npc.kind === 'smith' && !b.vil), ...W.map.outposts.map(o => W.map.buildings.find(b => b.vil === o.id && b.npc && b.npc.kind === 'smith'))];
ok(smiths.every(Boolean), 'нет кузнеца в Броде или в лагере');
const S = [];
for (const b of smiths) { at(b); const sh = smithShop(W); ok(sh && sh.stock.length >= 8, `витрина кузнеца пуста: ${b.vil || 'Брод'}`); if (sh) S.push(sh); }
ok(S.map(s => s.tier).join() === '1,1,2,3', 'ступени лавок не 1,1,2,3: ' + S.map(s => `${s.lv}→${s.tier}`).join(' '));
for (const sh of S) { const R = CFG3.smithTrade.gemRank[sh.tier - 1], gems = sh.stock.filter(s => /^gem_/.test(s.id));
  ok(gems.length && gems.every(s => BY_ID[s.id].rank >= R[0] && BY_ID[s.id].rank <= R[1]), `ступень ${sh.tier}: камни не тех рангов`);
  ok(sh.stock.some(s => Object.values(CFG3.craft.reag).includes(s.id)), `ступень ${sh.tier}: нет реагентов`);
  ok(sh.stock.some(s => s.id === CFG3.craft.ember) === (sh.tier === 3), `ступень ${sh.tier}: уголёк не там`); }
ok(Math.abs(smithPrice(W, S[3], S[3].stock[0]) / buyPrice(BY_ID[S[3].stock[0].id], W.cfg, W.dif.buy) - W.map.outposts[2].price) < .02, 'цены кузнеца лагеря не × price');
// покупка и продажа, общий генератор не тратится
{ at(smiths[2]); const sh = smithShop(W), s0 = sh.stock[0], id = s0.id, n0 = s0.n, pr = smithPrice(W, sh, s0), a0 = W.inv.ash; let calls = 0; const rng0 = W.rng; W.rng = () => { calls++; return rng0(); };
  ok(buySmith(W, 0) === 'ok' && W.inv.ash === a0 - pr && W.inv.bag.some(q => q.id === id) && (n0 === 1 || sh.stock[0].n === n0 - 1), 'покупка у кузнеца не сработала');
  W.rng = rng0; ok(!calls, 'лавка кузнеца тратит общий W.rng');
  const i = W.inv.bag.findIndex(q => q.id === id), a1 = W.inv.ash; ok(smithBuys(W.inv.bag[i]) && sellSmith(W, i, 1) === 'ok' && W.inv.ash > a1, 'продажа кузнецу не сработала');
  W.inv.bag.push({ id: 'w_sword_iron', n: 1 }); ok(sellSmith(W, W.inv.bag.length - 1) === 'none', 'кузнец скупает оружие'); }
// далеко от кузнеца — нельзя; завоз раз в restock
{ W.player.x += 30; step(W, 1 / 60, {}); ok(!smithShop(W) && buySmith(W, 0) === 'far', 'торговля вдали от кузнеца');
  at(smiths[1]); const a = smithShop(W).stock.map(s => s.id).join(); W.t += CFG3.shop.restock + 1; const b = smithShop(W).stock.map(s => s.id).join(); ok(a !== b, 'завоз не обновился'); }
ok(tierOf(20) === 1 && tierOf(45) === 2 && tierOf(65) === 3, 'ступени по уровню');

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Лавка кузнеца 3D: OK (' + S.map(s => `${s.name} ${s.lv} ур. — ступень ${s.tier}, товаров ${s.stock.length}`).join('; ') + ')');
