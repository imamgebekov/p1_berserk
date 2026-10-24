// Лавка кузнеца (Мир 5.0, этап 3, просьба владельца 2026-10-23): кузнец продаёт и скупает камни силы, материалы и реагенты.
// Ассортимент — по уровню места кузнеца: Брод — 20, город-узел — уровень его земли, лагерь Мира 5.0 — его уровень (и его цены).
// Ступень: до 30 — 1, до 55 — 2, выше — 3 (камни старших рангов, редкие материалы, уголёк и осколок). Витрина обновляется раз
// в shop.restock с; свой генератор от места и номера завоза — бой и прочая добыча не сдвигаются. Числа — config3d.js → smithTrade.
import { BY_ID } from './data/items.js';
import { buyPrice, sellPrice } from './economy3d.js';
import { addItem, removeAt, roomFor } from './inv.js';
import { zoneLevel } from './zones3d.js';

const mul = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const surf = W => (W.levels ? W.levels.surface.map : W.map);
export const tierOf = lv => (lv < 30 ? 1 : lv < 55 ? 2 : 3);
// место кузнеца рядом: { id, name, lv, price }
export function smithPlace(W) {
  if (W.nearNpc !== 'smith') return null;
  const M = surf(W), id = W.nearVil || 'camp', O = (M.outposts || []).find(o => o.id === id) || (M.citadel && M.citadel.id === id ? M.citadel : null);
  if (O) return { id, name: O.name, lv: O.lv, price: O.price || 1, tier: O.tier };     // tier — замок: лучшая ступень при своём уровне
  const p = (W.cfg.map.places || []).find(q => q.id === id);
  if (p && p.hub) return { id, name: p.name, lv: Math.round(zoneLevel(W.cfg, p.x, p.z) ?? 20), price: 1 };
  return { id, name: 'Пепельный Брод', lv: 20, price: 1 };
}
// какие вещи может продавать кузнец ступени t
export function smithGoods(cfg, t) {
  const S = cfg.smithTrade, reag = [...new Set(Object.values(cfg.craft.reag))];
  const gems = Object.keys(BY_ID).filter(id => /^gem_/.test(id) && BY_ID[id].rank <= S.gemRank[t - 1][1] && BY_ID[id].rank >= S.gemRank[t - 1][0]);
  return { gems, reag, mats: S.mats[t - 1].filter(id => BY_ID[id]), extra: t >= 3 ? [cfg.craft.ember, cfg.craft.shard].filter(id => id && BY_ID[id]) : [] };
}
function restock(W, P) {
  const S = W.cfg.smithTrade, t = P.tier || tierOf(P.lv), n = Math.floor(W.t / W.cfg.shop.restock), r = mul(hash(P.id) + n * 7919 + (W.cfg.world.seed || 1)), G = smithGoods(W.cfg, t), out = [];
  const pick = (arr, k, [a, b]) => { const pool = [...arr]; for (let i = 0; i < k && pool.length; i++) { const id = pool.splice((r() * pool.length) | 0, 1)[0]; out.push({ id, n: a + ((r() * (b - a + 1)) | 0) }); } };
  pick(G.gems, S.gems[t - 1], S.n.gem); pick(G.reag, S.reag[t - 1], S.n.reag); pick(G.mats, G.mats.length, S.n.mat); pick(G.extra, G.extra.length, [1, 1]);
  return { id: P.id, stock: out, at: W.t, lv: P.lv, tier: t, price: P.price, name: P.name };
}
// витрина кузнеца рядом (завозится заново раз в shop.restock с)
export function smithShop(W) {
  const P = smithPlace(W); if (!P) return null;
  const S = W.smithShops || (W.smithShops = {}); let sh = S[P.id];
  if (!sh || W.t - sh.at > W.cfg.shop.restock) sh = S[P.id] = restock(W, P);
  return sh;
}
export const smithPrice = (W, sh, s) => buyPrice(BY_ID[s.id], W.cfg, W.dif.buy * (sh.price || 1));
// что кузнец скупает: камни силы и материалы (не под замком)
export const smithBuys = s => { const it = BY_ID[s.id]; return !!it && (it.cat === 'gem' || it.cat === 'material') && !s.lock; };
export function buySmith(W, i) {
  const sh = smithShop(W); if (!sh) return 'far'; const s = sh.stock[i]; if (!s) return 'none';
  const price = smithPrice(W, sh, s); if (W.inv.ash < price) return 'ash';
  const mx = W.cfg.bag.slots + ((W.gear && W.gear.bag) || 0); if (!roomFor(W.inv, s.id, mx) || addItem(W.inv, s.id, 1, mx) > 0) return 'full';
  W.inv.ash -= price; s.n -= 1; if (s.n <= 0) sh.stock.splice(i, 1);
  W.ev.push({ k: 'pickup', id: s.id, n: 1 }); return 'ok';
}
export function sellSmith(W, idx, n = 1) {
  if (!smithPlace(W)) return 'far'; const s = W.inv.bag[idx]; if (!s || !smithBuys(s)) return 'none';
  const k = Math.min(n, s.n), gain = sellPrice(BY_ID[s.id], W.cfg) * k; removeAt(W.inv, idx, k); W.inv.ash += gain;
  W.ev.push({ k: 'sold', id: s.id, n: k, ash: gain }); return 'ok';
}
