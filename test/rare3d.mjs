// Тест редкостей у торговца 3D (шаг G3): при обновлении витрины полка редкостей выпадает с настроенными шансами; вещь уровня —
// ровно своей редкости, снаряжение и по силам герою; цена — с наценкой уровня; покупка списывает эту цену; сообщение — только
// об очень и супер редком и не при создании мира; «новинка» у новых; свой генератор — поток боя не сдвигается.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, mulberry32, restock, rerollRare, stockPrice, buyPrice, buyItem } from '../3d/src/sim.js';
import { BY_ID } from '../3d/src/data/items.js';
import { HEROES, canWield } from '../3d/src/data/heroes3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const R = CFG3.shop.rare, mk = (seed = 1, tweak) => { const c = JSON.parse(JSON.stringify(CFG3)); if (tweak) tweak(c); return createWorld(c, mulberry32(seed)); };

// ---------- 1. шансы и содержимое ----------
for (const hero of Object.keys(HEROES)) {
  const W = mk(2); W.hero = hero; W.t = 10; const got = R.tiers.map(() => 0), N = 3000;
  for (let i = 0; i < N; i++) {
    restock(W); const rare = W.shop.stock.filter(s => s.tier);
    for (const k of new Set(rare.map(s => s.tier))) got[k - 1]++;
    for (const s of rare) {
      const it = BY_ID[s.id], T = R.tiers[s.tier - 1];
      ok(it.rar === T.rar && it.slot && canWield(hero, it), `${hero}: на полке «${T.name}» не та вещь: ${s.id}`);
      ok(s.fresh && s.n === 1, `${hero}: ${s.id} не новинка или не одна`);
    }
    ok(W.shop.stock.findIndex(s => !s.tier) >= rare.length, `${hero}: редкости не сверху витрины`);
  }
  R.tiers.forEach((T, k) => { const f = got[k] / N; ok(Math.abs(f - T.chance) < Math.max(.02, T.chance * .2), `${hero}: «${T.name}» выпадает в ${(f * 100).toFixed(1)}% обновлений, а не в ${T.chance * 100}%`); });
  if (hero === Object.keys(HEROES)[0]) console.log(`за ${N} обновлений: ` + R.tiers.map((T, k) => `${T.name} ${(got[k] / N * 100).toFixed(1)}%`).join(', '));
}
// ---------- 2. цена и покупка ----------
{
  const W = mk(3); W.t = 10; let s = null; for (let i = 0; i < 400 && !s; i++) { restock(W); s = W.shop.stock.find(q => q.tier === 3); }
  ok(!!s, 'супер редкое не выпало за 400 обновлений');
  if (s) {
    const it = BY_ID[s.id], p = stockPrice(W, s); ok(p === buyPrice(it, W.cfg, W.dif.buy * R.tiers[2].mul), 'цена без наценки уровня');
    W.nearNpc = 'merchant'; W.nearMerchant = true; W.night = false; W.inv.ash = p;
    ok(buyItem(W, W.shop.stock.indexOf(s)) === 'ok' && W.inv.ash === 0 && W.inv.bag.some(b => b.id === it.id) && !W.shop.stock.includes(s), 'покупка редкости не по её цене');
  }
}
// ---------- 3. сообщения ----------
{
  const W = mk(4); ok(!W.ev.some(v => v.k === 'shopRare'), 'сообщение о редкости при создании мира');
  W.t = 10; let msg = 0, big = 0;
  for (let i = 0; i < 500; i++) { W.ev.length = 0; restock(W); const e = W.ev.filter(v => v.k === 'shopRare'); msg += e.length; if (W.shop.stock.some(s => s.tier >= 2)) big++; ok(e.every(v => v.tier >= 2 && BY_ID[v.id].rar >= 3), 'сообщение о простом редком'); }
  ok(msg === big, `сообщений ${msg}, а обновлений с очень и супер редким ${big}`);
}
// ---------- 4. под героя и свой генератор ----------
{
  const W = mk(5), other = Object.keys(HEROES).find(h => h !== W.hero); W.hero = other;
  for (let i = 0; i < 50; i++) { rerollRare(W); ok(W.shop.stock.filter(s => s.tier).every(s => canWield(other, BY_ID[s.id])), 'полка не под нового героя'); ok(W.shop.stock.some(s => !s.tier), 'перебор полки стёр витрину'); }
  const flow = rare => { const W = mk(6, c => { if (!rare) c.shop.rare = null; }); W.t = 10; for (let i = 0; i < 30; i++) restock(W); return [W.rng(), W.rng(), JSON.stringify(W.shop.stock.filter(s => !s.tier).map(s => s.id))]; };
  const a = flow(true), b = flow(false); ok(a[0] === b[0] && a[1] === b[1], 'полка редкостей сдвинула общий генератор (бой)');
}

if (fails.length) { console.log('ПРОВАЛ:\n' + [...new Set(fails)].slice(0, 20).join('\n')); process.exit(1); }
console.log('Редкости у торговца 3D: OK');
