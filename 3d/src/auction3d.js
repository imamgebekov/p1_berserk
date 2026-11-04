// Аукцион (2026-11-04, просьба владельца «как в World of Warcraft»): общий рынок с лотами игроков-ботов и героя.
// Чистая логика (проверяется в Node, test/auction3d.mjs). Состояние — W.auction (есть в сохранении):
//   lots — лоты { u, e: запись сумки, sel: продавец, mine: лот героя, start, buy, bid, who, dep, t0, end };
//   pend — что ждёт у аукциониста: { ash, items[] } (выручка, возвраты ставок, непроданные и выигранные вещи);
//   dem — спрос по видам вещей, hot — «горячие» вещи (дороже), s — свой поток случайных чисел (бой и тесты не сдвигаются).
// Рынок крутится шагами по игровому времени W.t (cfg.auction.step), как торговец; при долгом сне догоняет ограниченным числом шагов.
// Ставка героя замораживает пепел; сбитая ставка возвращается в pend.ash. Комиссия и залог — в cfg.auction. Числа — config3d.js → auction.
import { BY_ID, CATALOG, RARITY } from './data/items.js';
import { addItem, removeAt, roomFor, ilOf, nomIl, ilMul, qOf, isPlain, entryOf, cleanAf, cleanGems, socketsOf } from './inv.js';
import { hasGems } from './inv.js';

export const ME = '@me';     // метка «герой» в поле who
export const CATS = [['all', 'Всё'], ['weapon', 'Оружие'], ['armor', 'Броня'], ['jewel', 'Украшения'], ['consumable', 'Зелья и еда'], ['material', 'Материалы'], ['gem', 'Камни'], ['tome', 'Книги'], ['other', 'Прочее']];
export const catKey = it => (['weapon', 'armor', 'jewel', 'consumable', 'material', 'gem', 'tome'].includes(it.cat) ? it.cat : 'other');
const mk = a => () => { a.s = (a.s + 0x6D2B79F5) | 0; let t = Math.imul(a.s ^ a.s >>> 15, 1 | a.s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const rr = (r, a, b) => a + r() * (b - a);
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const C = W => W.cfg.auction;

// вещи, которые бот может выставить: по виду и редкости (строится один раз)
let IDX = null;
function index() {
  if (IDX) return IDX; IDX = {};
  for (const it of CATALOG) { if (it.cat === 'key' || (it.rar || 0) > 5) continue; const k = catKey(it); ((IDX[k] || (IDX[k] = {}))[it.rar || 0] || (IDX[k][it.rar || 0] = [])).push(it); }
  return IDX;
}
const pickCat = (r, w) => { let x = r() * Object.values(w).reduce((a, b) => a + b, 0); for (const [k, v] of Object.entries(w)) { x -= v; if (x <= 0) return k; } return 'weapon'; };
function pickItem(r, k, lv) {
  const g = index()[k]; if (!g) return null; const tgt = clamp(lv / 11, 0, 5), rs = Object.keys(g).map(Number);
  let tot = 0; const w = rs.map(q => { const v = Math.exp(-Math.abs(q - tgt) * 1.1) * (q >= 5 ? .35 : 1); tot += v; return v; });
  let x = r() * tot, q = rs[0]; for (let i = 0; i < rs.length; i++) { x -= w[i]; if (x <= 0) { q = rs[i]; break; } }
  const L = g[q]; return L[Math.floor(r() * L.length)];
}

// ---- состояние ----
export const levelOfEntry = e => { const it = BY_ID[e.id]; return it.slot ? ilOf(it, e.il) : it.lv || 0; };
export function fresh(W) {
  const A = { v: 1, lots: [], pend: { ash: 0, items: [] }, dem: {}, hot: {}, u: 1, s: ((W.cfg.world.seed || 1) * 7121 + 5) | 0, t: W.t || 0, day: -1, sink: 0, sold: 0, made: 0 };
  for (const [k] of CATS) if (k !== 'all') A.dem[k] = 1;
  W.auction = A; seedLots(W); return A;
}
export const auctionOf = W => W.auction || fresh(W);
const rngOf = (W, A) => (A.r || (A.r = mk(A)));
// продавец-бот: из живых ботов мира (имя, уровень) или из списка имён
function sellerOf(W, r) {
  const B = (W.bots || []).filter(b => b && b.name); if (B.length && r() < .85) { const b = B[Math.floor(r() * B.length)]; return { name: b.name, lv: b.lv }; }
  const N = (W.cfg.bots && W.cfg.bots.names) || ['Торговец']; return { name: N[Math.floor(r() * N.length)], lv: ri(r, 1, 60) };
}
// пока рынок пуст: набрать target лотов со случайным остатком срока
function seedLots(W) {
  const A = W.auction, K = C(W), r = rngOf(W, A);
  for (let i = 0; i < K.target; i++) listBot(W, r, true);
  reindex(A); retrend(W, A, r);
}
// цена за весь лот (сумма за стопку) при нынешнем спросе и запасе
export function fairOf(W, e) {
  const A = auctionOf(W), K = C(W), it = BY_ID[e.id]; if (!it) return 1;
  const sup = A.cnt ? Math.max(K.supply.min, 1 - K.supply.k * Math.max(0, (A.cnt[e.id] || 1) - 1)) : 1;
  const v = it.value * K.baseMul * (it.slot ? ilMul(it, e.il) * qOf(e.af) * (1 + (e.up || 0) * .25) : 1) * (A.dem[catKey(it)] || 1) * (A.hot[e.id] || 1) * sup;
  return Math.max(1, Math.round(v * (e.n || 1)));
}
function reindex(A) { A.cnt = {}; for (const l of A.lots) A.cnt[l.e.id] = (A.cnt[l.e.id] || 0) + l.e.n; }
// суточные «новости»: пять горячих вещей дороже на hotMul
function retrend(W, A, r) {
  const K = C(W), ids = Object.keys(BY_ID).filter(id => BY_ID[id].cat !== 'key' && (BY_ID[id].rar || 0) <= 5);
  A.hot = {}; for (let i = 0; i < K.hotN; i++) A.hot[ids[Math.floor(r() * ids.length)]] = K.hotMul;
}
function listBot(W, r, init) {
  const A = W.auction, K = C(W), s = sellerOf(W, r), cat = pickCat(r, K.mix), it = pickItem(r, cat, s.lv); if (!it) return null;
  const e = { id: it.id, n: 1 };
  if (it.slot) { const nom = nomIl(it); e.il = clamp(Math.round(nom + (s.lv - nom) * .5 + rr(r, -K.ilSpread, K.ilSpread)), 1, 60); }
  else if (it.stack > 1) e.n = 1 + Math.floor(r() * r() * Math.min(it.stack, K.maxStack));
  const fair = fairOf(W, e), di = r() < .5 ? 2 : r() < .6 ? 1 : 0, span = K.dur[di] * W.cfg.daynight.len;
  const l = { u: A.u++, e, sel: s.name, mine: false, start: Math.max(1, Math.round(fair * rr(r, ...K.startK))), buy: r() < K.buyP ? Math.round(fair * rr(r, ...K.buyK)) : 0, bid: 0, who: null, dep: 0, t0: W.t, end: W.t + (init ? span * (.05 + .95 * r()) : span) };
  if (l.buy && l.buy < l.start) l.buy = Math.round(l.start * 1.25);
  A.lots.push(l); return l;
}

// ---- цена и ставки ----
export const priceOf = l => l.bid || l.start;
export const minBid = (W, l) => (l.bid ? l.bid + Math.max(1, Math.ceil(l.bid * C(W).bidStep)) : l.start);
export const feeOf = (W, price) => Math.round(price * C(W).fee);
export const depositOf = (W, e, di) => { const it = BY_ID[e.id]; return Math.max(1, Math.round(it.value * (e.n || 1) * W.cfg.shop.sellMul * C(W).deposit * C(W).dur[di])); };
const near = W => W.nearNpc === 'auctioneer';
export const bagMax = W => W.cfg.bag.slots + ((W.gear && W.gear.bag) || 0);
// вещь в сумку: возвращает false, если нет места (ничего не меняет)
export function giveEntry(W, e) {
  const mx = bagMax(W), inv = W.inv;
  if (isPlain(e) && !e.il) { const left = addItem(inv, e.id, e.n, mx); return left === 0; }
  if (!roomFor(inv, e.id, mx)) return false; inv.bag.push({ ...e, g: e.g && e.g.slice(), af: e.af && { ...e.af } }); return true;
}
function giveSafe(W, e) {
  if (isPlain(e) && !e.il) { const left = addItem(W.inv, e.id, e.n, bagMax(W)); if (left <= 0) return true; if (left < e.n) e.n = left; return false; }     // часть влезла — остаток ждёт
  return giveEntry(W, e);
}
const note = (W, v) => { if (W.ev) W.ev.push(v); };

// продажа лота (по ставке или выкупу): деньги продавцу, вещь покупателю
function settle(W, l, price, buyer) {
  const A = W.auction, i = A.lots.indexOf(l); if (i >= 0) A.lots.splice(i, 1);
  A.sold++; const it = BY_ID[l.e.id], ck = catKey(it);
  A.dem[ck] = clamp(A.dem[ck] + C(W).demand.bump, C(W).demand.min, C(W).demand.max);     // купили — спрос чуть выше
  if (l.mine) { const fee = feeOf(W, price); A.sink += fee; A.pend.ash += price - fee + l.dep; note(W, { k: 'aucSold', id: l.e.id, n: l.e.n, ash: price - fee, who: buyer }); }
  if (buyer === ME) { if (A.pend.items.length < C(W).pendMax) A.pend.items.push(l.e); note(W, { k: 'aucWon', id: l.e.id, n: l.e.n }); }
}
function expire(W, l) {
  const A = W.auction; if (l.bid) { settle(W, l, l.bid, l.who); return; }
  const i = A.lots.indexOf(l); if (i >= 0) A.lots.splice(i, 1);
  if (l.mine) { A.sink += l.dep; if (A.pend.items.length < C(W).pendMax) A.pend.items.push(l.e); note(W, { k: 'aucExpired', id: l.e.id, n: l.e.n }); }
}
function raise(W, l, amount, who) {
  const A = W.auction;
  if (l.who === ME && who !== ME) { A.pend.ash += l.bid; note(W, { k: 'aucOutbid', id: l.e.id, by: who }); }     // сбили ставку героя — пепел вернулся
  l.bid = amount; l.who = who;
  const left = l.end - W.t, soft = C(W).soft * W.cfg.daynight.len; if (left < soft) l.end = W.t + soft;     // ставка на последних минутах продлевает торги
}

// ---- шаг рынка ----
function marketStep(W) {
  const A = W.auction, K = C(W), r = rngOf(W, A), day = Math.floor(W.t / W.cfg.daynight.len);
  if (A.day !== day) { A.day = day; retrend(W, A, r); }
  for (const l of A.lots.slice()) if (l.end <= W.t) expire(W, l);
  for (const k of Object.keys(A.dem)) A.dem[k] = clamp(A.dem[k] + (1 - A.dem[k]) * K.demand.pull + rr(r, -K.demand.jit, K.demand.jit), K.demand.min, K.demand.max);
  reindex(A);
  const want = clamp(Math.round((K.target - A.lots.length) * K.fill) + ri(r, ...K.extra), 0, K.maxNew);
  for (let i = 0; i < want; i++) listBot(W, r, false);
  const names = (W.bots || []).map(b => b.name).filter(Boolean); const buyers = names.length ? names : (W.cfg.bots && W.cfg.bots.names) || ['Покупатель'];
  for (let i = 0; i < K.tries && A.lots.length; i++) {
    const l = A.lots[Math.floor(r() * A.lots.length)], fair = fairOf(W, l.e), who = buyers[Math.floor(r() * buyers.length)];
    if (who === l.sel || who === l.who) continue;
    const worth = fair * rr(r, ...K.worth);     // сколько бот готов отдать
    if (l.buy && l.buy <= worth && r() < K.buyAct) { settle(W, l, l.buy, who); continue; }
    const m = minBid(W, l); if (m <= worth && r() < K.bidAct) raise(W, l, l.mine ? m : Math.min(l.buy ? l.buy - 1 : 1e9, m + Math.round(m * r() * .06)), who);
  }
  reindex(A);
}
// догнать рынок до W.t (не больше maxCatch шагов; дальше — пропуск без шагов, лоты истекают разом)
export function tick(W) {
  const A = auctionOf(W), K = C(W); if (!K || !K.on) return 0;
  let n = Math.floor((W.t - A.t) / K.step); if (n <= 0) return 0;
  if (n > K.maxCatch) { A.t += (n - K.maxCatch) * K.step; n = K.maxCatch; }
  for (let i = 0; i < n; i++) { A.t += K.step; marketStep(W); }
  return n;
}

// ---- поиск и сортировка ----
// o: { q, cat, lvMin, lvMax, rarMin, pMax, buyOnly, scope: 'all'|'mine'|'bids', sort, dir }
export const SORTS = [['time', 'Срок'], ['price', 'Цена'], ['buy', 'Выкуп'], ['rar', 'Редкость'], ['lv', 'Уровень'], ['name', 'Название']];
export function search(W, o = {}) {
  const A = auctionOf(W), q = (o.q || '').trim().toLowerCase(); let L = A.lots.filter(l => {
    const it = BY_ID[l.e.id]; if (!it) return false;
    if (o.scope === 'mine' && !l.mine) return false; if (o.scope === 'bids' && l.who !== ME) return false;
    if (o.cat && o.cat !== 'all' && catKey(it) !== o.cat) return false;
    if (q && !it.name.toLowerCase().includes(q)) return false;
    const lv = levelOfEntry(l.e); if (o.lvMin && lv < o.lvMin) return false; if (o.lvMax && lv > o.lvMax) return false;
    if (o.rarMin && (it.rar || 0) < o.rarMin) return false; if (o.pMax && priceOf(l) > o.pMax) return false; if (o.buyOnly && !l.buy) return false;
    return true;
  });
  const k = o.sort || 'time', d = o.dir === 'desc' ? -1 : 1, key = { time: l => l.end, price: l => priceOf(l), buy: l => l.buy || 1e12, rar: l => BY_ID[l.e.id].rar || 0, lv: l => levelOfEntry(l.e), name: l => BY_ID[l.e.id].name }[k];
  return L.sort((a, b) => { const x = key(a), y = key(b); return (typeof x === 'string' ? x.localeCompare(y, 'ru') : x - y) * d || a.u - b.u; });
}

// ---- действия героя ----
export function bid(W, u, amount) {
  if (!near(W)) return 'far'; tick(W); const A = auctionOf(W), l = A.lots.find(x => x.u === u); if (!l) return 'gone';
  if (l.mine) return 'own'; amount = Math.floor(amount); if (!(amount >= minBid(W, l))) return 'low';
  if (l.buy && amount >= l.buy) return buyout(W, u);
  const pay = amount - (l.who === ME ? l.bid : 0); if (W.inv.ash < pay) return 'ash';
  W.inv.ash -= pay; if (l.who === ME) l.who = null; raise(W, l, amount, ME); return 'ok';     // старая ставка героя заменена новой
}
export function buyout(W, u) {
  if (!near(W)) return 'far'; tick(W); const A = auctionOf(W), l = A.lots.find(x => x.u === u); if (!l) return 'gone'; if (l.mine) return 'own'; if (!l.buy) return 'nobuy';
  const pay = l.buy - (l.who === ME ? l.bid : 0); if (W.inv.ash < pay) return 'ash';
  const e = l.e; if (!roomFor(W.inv, e.id, bagMax(W))) return 'full';     // место проверяем до списания
  W.inv.ash -= pay; const i = A.lots.indexOf(l); if (i >= 0) A.lots.splice(i, 1);
  A.sold++; const ck = catKey(BY_ID[e.id]); A.dem[ck] = clamp(A.dem[ck] + C(W).demand.bump, C(W).demand.min, C(W).demand.max);
  giveEntry(W, e); W.ev.push({ k: 'pickup', id: e.id, n: e.n }); reindex(A); return 'ok';
}
export function listItem(W, idx, n, start, buy, di) {
  if (!near(W)) return 'far'; tick(W); const A = auctionOf(W), K = C(W), s = W.inv.bag[idx]; if (!s) return 'none';
  const it = BY_ID[s.id]; if (!it || s.lock || it.cat === 'key') return 'locked';
  n = Math.floor(n); start = Math.floor(start); buy = Math.floor(buy || 0);
  if (!(n >= 1 && n <= s.n)) return 'count'; if (!(start >= 1 && start <= K.maxPrice)) return 'price'; if (buy && (buy < start || buy > K.maxPrice)) return 'price';
  if (!(di >= 0 && di < K.dur.length)) return 'dur'; if (A.lots.filter(l => l.mine).length >= K.maxMine) return 'many';
  const e = { id: s.id, n }; if (s.up) e.up = s.up; if (s.il) e.il = s.il; if (s.af) e.af = { ...s.af }; if (hasGems(s.g)) e.g = s.g.slice();
  const dep = depositOf(W, e, di); if (W.inv.ash < dep) return 'ash';
  W.inv.ash -= dep; removeAt(W.inv, idx, n);
  const l = { u: A.u++, e, sel: 'Вы', mine: true, start, buy, bid: 0, who: null, dep, t0: W.t, end: W.t + K.dur[di] * W.cfg.daynight.len }; A.lots.push(l); A.made++; reindex(A); return l.u;
}
export function cancel(W, u) {
  if (!near(W)) return 'far'; tick(W); const A = auctionOf(W), l = A.lots.find(x => x.u === u); if (!l || !l.mine) return 'gone'; if (l.bid) return 'bids';
  if (!roomFor(W.inv, l.e.id, bagMax(W))) return 'full';
  A.lots.splice(A.lots.indexOf(l), 1); A.sink += l.dep; giveEntry(W, l.e); reindex(A); return 'ok';     // залог при снятии не возвращается
}
// забрать выручку и вещи у аукциониста (что не влезло — остаётся)
export function claim(W) {
  if (!near(W)) return 'far'; tick(W); const P = auctionOf(W).pend; let ash = P.ash, n = 0;
  W.inv.ash += P.ash; P.ash = 0;
  while (P.items.length) { const e = P.items[0]; const before = e.n; if (giveSafe(W, e)) { P.items.shift(); n += before; } else { n += before - e.n; break; } }
  return { ash, n };
}
export const pendCount = W => { const P = auctionOf(W).pend; return P.items.length + (P.ash > 0 ? 1 : 0); };
// сколько осталось: в игровых часах (сутки = daynight.len с)
export const hoursLeft = (W, l) => Math.max(0, (l.end - W.t) / (W.cfg.daynight.len / 24));
export const timeText = h => (h < .17 ? 'меньше 10 мин' : h < 1 ? `${Math.ceil(h * 6) * 10} мин` : h < 24 ? `${Math.ceil(h)} ч` : `${(h / 24).toFixed(1).replace('.0', '')} сут`);

// ---- сохранение ----
export function serializeAuction(W) {
  const A = W.auction; if (!A) return null;
  return { v: 1, u: A.u, s: A.s, t: Math.round(A.t * 100) / 100, day: A.day, sink: A.sink, sold: A.sold, made: A.made, dem: A.dem, hot: A.hot, pend: A.pend, lots: A.lots };
}
const cleanEntry = e => {
  const it = e && typeof e.id === 'string' && BY_ID[e.id]; if (!it || it.cat === 'key') return null;
  const n = Number.isFinite(e.n) ? clamp(Math.floor(e.n), 1, it.stack || 1) : 1, o = { id: e.id, n };
  if (it.slot) { if (Number.isFinite(e.il) && e.il > 0) o.il = Math.min(99, Math.floor(e.il)); if (Number.isInteger(e.up) && e.up > 0) o.up = Math.min(5, e.up); const af = cleanAf(e.af); if (af) o.af = af; const g = cleanGems(e.g, socketsOf(it, null) || (Array.isArray(e.g) ? e.g.length : 0)); if (g) o.g = g; }
  return o;
};
// из сохранения: чужое и испорченное отбрасывается; нет данных (старое сохранение) — свежий рынок
export function sanitizeAuction(W, d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.lots)) return fresh(W);
  const K = C(W), num = (v, a, b, def) => (Number.isFinite(v) ? clamp(v, a, b) : def), A = { v: 1, lots: [], pend: { ash: 0, items: [] }, dem: {}, hot: {}, u: 1, s: Number.isFinite(d.s) ? d.s | 0 : 1, t: num(d.t, 0, 1e9, W.t || 0), day: Number.isFinite(d.day) ? d.day : -1, sink: num(d.sink, 0, 1e12, 0), sold: num(d.sold, 0, 1e9, 0), made: num(d.made, 0, 1e9, 0) };
  for (const [k] of CATS) if (k !== 'all') A.dem[k] = num(d.dem && d.dem[k], K.demand.min, K.demand.max, 1);
  if (d.hot && typeof d.hot === 'object') for (const [id, m] of Object.entries(d.hot)) if (BY_ID[id] && Number.isFinite(m)) A.hot[id] = clamp(m, 1, 3);
  if (d.pend && typeof d.pend === 'object') { A.pend.ash = Math.floor(num(d.pend.ash, 0, 1e12, 0)); if (Array.isArray(d.pend.items)) for (const x of d.pend.items.slice(0, K.pendMax)) { const e = cleanEntry(x); if (e) A.pend.items.push(e); } }
  let mine = 0; for (const l of d.lots.slice(0, K.target * 3)) {
    const e = cleanEntry(l && l.e); if (!e || !(l.start >= 1) || !Number.isFinite(l.end)) continue;
    const m = !!l.mine; if (m && ++mine > K.maxMine) { A.pend.items.push(e); continue; }
    A.lots.push({ u: Number.isFinite(l.u) ? Math.floor(l.u) : A.u, e, sel: typeof l.sel === 'string' ? l.sel.slice(0, 24) : '?', mine: m, start: Math.floor(l.start), buy: l.buy > 0 ? Math.floor(l.buy) : 0, bid: l.bid > 0 ? Math.floor(l.bid) : 0, who: l.bid > 0 && typeof l.who === 'string' ? l.who.slice(0, 24) : null, dep: m ? Math.floor(num(l.dep, 0, 1e9, 0)) : 0, t0: num(l.t0, 0, 1e9, 0), end: l.end });
  }
  A.u = Math.max(A.u, Number.isFinite(d.u) ? Math.floor(d.u) : 1, ...A.lots.map(l => l.u + 1)); W.auction = A; reindex(A);
  if (!A.lots.length) seedLots(W);
  return A;
}
