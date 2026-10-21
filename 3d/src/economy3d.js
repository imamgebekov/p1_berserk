// Кузнец (улучшение вещей) и торговля: цены, ассортимент, покупка и продажа.
import { priceRep } from './life3d.js';
import { BY_ID } from './data/items.js';
import { SHOP, SHOP_STAPLES, rollLoot, pickItem } from './data/loot.js';
import { canWield } from './data/heroes3d.js';
import { mulberry32 } from './sim.js';
import { addItem, removeAt, hasGems, roomFor, entryOf, nomIl, ilMul, scoreUp, qOf } from './inv.js';

// ---- кузнец: улучшение вещей за пепел ----
export const upgradeCost = (it, lvl, cfg) => Math.round(cfg.smith.base + it.value * cfg.smith.costK * Math.pow(lvl + 1, cfg.smith.pow));
// where: { slot } для надетой или { idx } для вещи в сумке
export function upgradeItem(W, where) {
  if (W.nearNpc !== 'smith') return 'far';
  const inv = W.inv, e = where.slot ? null : inv.bag[where.idx];
  const id = where.slot ? inv.eq[where.slot] : e && e.id, it = id && BY_ID[id];
  if (!it || !it.slot) return 'none';
  const lvl = where.slot ? inv.up[where.slot] || 0 : e.up || 0;
  if (lvl >= W.cfg.smith.max) return 'max';
  const cost = upgradeCost(it, lvl, W.cfg);
  if (inv.ash < cost) return 'ash';
  inv.ash -= cost; if (where.slot) inv.up[where.slot] = lvl + 1; else e.up = lvl + 1;
  W.ev.push({ k: 'upgrade', x: W.player.x, z: W.player.z, lvl: lvl + 1 }); return 'ok';
}

// ---- торговля ----
export const sellPrice = (it, cfg, up = 0, trade = 0, il = 0, af = null) => Math.max(1, Math.round(it.value * cfg.shop.sellMul * (1 + up * .25) * ilMul(it, il) * qOf(af) * (1 + trade / 100)));     // вещь выше уровнем — дороже
export const buyPrice = (it, cfg, mul = 1) => Math.max(2, Math.round(it.value * cfg.shop.buyMul * mul));
// полка редкостей (G3): при каждом обновлении витрины — свой бросок по уровням (редкое, очень редкое, супер редкое);
// только то, что герой может носить; свой генератор — бой не сдвигается. tier — номер уровня (1–3), fresh — «новинка»
const srng = W => W.srng || (W.srng = W.rng === Math.random ? Math.random : mulberry32((W.cfg.world.seed || 1) * 7907 + 3));
export function rareShelf(W) {
  const R = W.cfg.shop.rare, out = []; if (!R) return out; const rng = srng(W);
  R.tiers.forEach((T, k) => {
    if (rng() >= T.chance) return;
    const n = T.n[0] + ((rng() * (T.n[1] - T.n[0] + 1)) | 0);
    for (let j = 0; j < n; j++) for (let a = 0; a < 16; a++) {
      const P = T.pools || R.pools, it = pickItem(P[(rng() * P.length) | 0], T.rar, rng);
      if (it && it.rar === T.rar && canWield(W.hero, it) && !out.some(o => o.id === it.id)) { out.push({ id: it.id, n: 1, tier: k + 1, fresh: true }); break; }
    }
  });
  return out;
}
export function restock(W) {
  const out = SHOP_STAPLES.map(([id, n]) => ({ id, n }));
  if (W.hero === 'irga') out.push({ id: 'w_staff_iron', n: 1 }, { id: 'w_wand_iron', n: 1 });
  if (W.hero === 'warlock') out.push({ id: 'w_scythe_iron', n: 1 }, { id: 'w_wand_iron', n: 1 });     // Мороку коса и жезл всегда на витрине     // Ирге посох и жезл всегда на витрине (без случайных чисел)
  for (const it of rollLoot(SHOP, W.rng, .12, W.gear.luck)) { const ex = out.find(o => o.id === it.id); if (ex) ex.n += it.n; else out.push({ ...it }); }
  const rare = rareShelf(W);
  W.shop.stock = [...rare, ...out.filter(o => !rare.some(r => r.id === o.id))]; W.shop.t = 0;
  const top = rare.reduce((a, r) => (r.tier > a.tier ? r : a), { tier: 0 });
  if (W.t > 1 && top.tier >= 2) W.ev.push({ k: 'shopRare', id: top.id, tier: top.tier });
}
// полку редкостей — заново под выбранного героя (при старте и загрузке), без сообщения
export function rerollRare(W) { W.shop.stock = [...rareShelf(W), ...W.shop.stock.filter(s => !s.tier)]; }
// цена товара на витрине: наценка сказочного торговца, сложность и уровень редкости полки
export const stockPrice = (W, s) => buyPrice(BY_ID[s.id], W.cfg, W.dif.buy * priceMulOf(W) * (s.tier ? W.cfg.shop.rare.tiers[s.tier - 1].mul : 1));
// у повозки сказочного торговца — его витрина, наценка и торговля ночью
export const shopOf = W => (W.nearNpc === 'wanderer' && W.wanderer) || W.shop;
export const priceMulOf = W => (W.nearNpc === 'wanderer' ? W.cfg.wanderer.priceMul : 1) * (W.life ? priceRep(W) : 1);     // скидка за репутацию у Пепельного Брода (этап 6)
const closed = W => W.night && W.nearNpc !== 'wanderer';
export function buyItem(W, i) {
  const sh = shopOf(W), s = sh.stock[i]; if (!s || !W.nearMerchant) return 'far'; if (closed(W)) return 'closed';
  const price = stockPrice(W, s);
  if (W.inv.ash < price) return 'ash';
  const mx = W.cfg.bag.slots + ((W.gear && W.gear.bag) || 0);
  if (BY_ID[s.id].slot) { if (!roomFor(W.inv, s.id, mx)) return 'full'; W.inv.bag.push(entryOf(s.id, 0, null, Math.max(nomIl(BY_ID[s.id]), W.lv))); }     // снаряжение у торговца — уровня героя (не ниже родного)
  else if (addItem(W.inv, s.id, 1, mx) > 0) return 'full';
  W.inv.ash -= price; s.n -= 1; if (s.n <= 0) sh.stock.splice(i, 1);
  W.ev.push({ k: 'pickup', id: s.id, n: 1 }); return 'ok';
}
export function sellItem(W, idx, n = 1) {
  const s = W.inv.bag[idx]; if (!s) return 'none'; if (!W.nearMerchant) return 'far'; if (closed(W)) return 'closed';
  const q = Math.min(n, s.n), it = BY_ID[s.id];
  if (hasGems(s.g)) {                                                          // камни из проданного оружия возвращаются в сумку
    const tmp = { bag: JSON.parse(JSON.stringify(W.inv.bag)) }; tmp.bag.splice(idx, 1);
    const max = W.cfg.bag.slots + ((W.gear && W.gear.bag) || 0);
    for (const g of s.g) if (g && addItem(tmp, g, 1, max) > 0) return 'full';
    W.inv.bag = tmp.bag; W.inv.ash += sellPrice(it, W.cfg, s.up || 0, W.gear.trade, s.il, s.af); W.ev.push({ k: 'unsocket', n: s.g.filter(Boolean).length }); return 'ok';
  }
  W.inv.ash += sellPrice(it, W.cfg, s.up || 0, W.gear.trade, s.il, s.af) * q; removeAt(W.inv, idx, q); return 'ok';
}
// продать снаряжение хуже надетого (этап 4 «круче»): только то, что герой носит; без замка, заточки и камней; клеймёное и золотое —
// вручную. Вернёт { sum, n } или −1 (торговца рядом нет)
export function sellWorse(W) {
  if (!W.nearMerchant || closed(W)) return -1;
  let sum = 0, n = 0; const B = W.cfg.smith.bonus, inv = W.inv;
  for (let i = inv.bag.length - 1; i >= 0; i--) {
    const s = inv.bag[i], it = BY_ID[s.id]; if (!it || !it.slot || s.lock || s.up || hasGems(s.g) || it.rar >= 4 || !canWield(W.hero, it)) continue;
    const cur = inv.eq[it.slot]; if (!cur) continue;
    if (scoreUp(it, 0, B, s.il, s.af) + .5 >= scoreUp(BY_ID[cur], inv.up[it.slot] || 0, B, inv.il && inv.il[it.slot], inv.af && inv.af[it.slot])) continue;
    sum += sellPrice(it, W.cfg, 0, W.gear.trade, s.il || 0, s.af); inv.bag.splice(i, 1); n++;
  }
  inv.ash += sum; return { sum, n };
}
// продать весь хлам разом: безделушки, деньги, записки и материалы (оружие, броня, ключи и расходники остаются)
export function sellJunk(W) {
  if (!W.nearMerchant || closed(W)) return -1;
  let sum = 0;
  for (let i = W.inv.bag.length - 1; i >= 0; i--) { const s = W.inv.bag[i], it = BY_ID[s.id]; if ((it.cat === 'curio' || it.cat === 'material') && it.pool !== 'arcane') { sum += sellPrice(it, W.cfg, 0, W.gear.trade) * s.n; W.inv.bag.splice(i, 1); } }
  W.inv.ash += sum; return sum;
}

