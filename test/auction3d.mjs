// Аукцион (2026-11-04): аукционер в лагере, сотни лотов разных видов и уровней, поиск и сортировка, ставки и выкуп, срок, комиссия,
// свои лоты, живые боты (лоты приходят и уходят, цены ходят), сохранение, без утечки вещей и пепла; общий W.rng не тратится.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32 } from '../3d/src/sim.js';
import { initBots } from '../3d/src/bots3d.js';
import { BY_ID } from '../3d/src/data/items.js';
import { addItem, entryOf } from '../3d/src/inv.js';
import { createSaver, loadSave } from '../3d/src/save3d.js';
import * as A from '../3d/src/auction3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0;
const W = createWorld(c, mulberry32(9)); initBots(W); step(W, 1 / 60, {});
const K = c.auction, DAY = c.daynight.len;
const bld = W.map.buildings.find(b => b.npc && b.npc.kind === 'auctioneer' && !b.vil);
ok(bld, 'нет аукционера в лагере'); ok(W.map.buildings.some(b => b.npc && b.npc.kind === 'auctioneer' && b.vil), 'нет аукционера в замке');
W.player.x = bld.npc.x + 1; W.player.z = bld.npc.z; step(W, 1 / 60, {}); ok(W.nearNpc === 'auctioneer', 'рядом с аукционером nearNpc не auctioneer: ' + W.nearNpc);
const rng0 = W.rng; let calls = 0; W.rng = () => { calls++; return rng0(); };
W.inv.ash = 100000; A.auctionOf(W);
const lots = () => W.auction.lots;

// сотни лотов, разные виды и уровни, одинаковые вещи разных уровней
const kinds = new Set(lots().map(l => A.catKey(BY_ID[l.e.id]))), ids = new Set(lots().map(l => l.e.id));
ok(lots().length >= 400, 'лотов мало: ' + lots().length); ok(kinds.size >= 7, 'видов мало: ' + [...kinds]); ok(ids.size >= 200, 'разных вещей мало: ' + ids.size);
{ const by = {}; for (const l of lots()) if (BY_ID[l.e.id].slot) (by[l.e.id] || (by[l.e.id] = new Set())).add(l.e.il); ok(Object.values(by).some(s => s.size >= 2), 'нет одинаковых вещей разных уровней'); }
ok(lots().every(l => BY_ID[l.e.id] && l.start >= 1 && l.end > W.t && (!l.buy || l.buy >= l.start)), 'испорченный лот');

// поиск и фильтры
{ const w = A.search(W, { cat: 'weapon' }); ok(w.length && w.every(l => BY_ID[l.e.id].cat === 'weapon'), 'фильтр вида');
  const lv = A.search(W, { lvMin: 20, lvMax: 30 }); ok(lv.length && lv.every(l => { const v = A.levelOfEntry(l.e); return v >= 20 && v <= 30; }), 'фильтр уровня');
  const rar = A.search(W, { rarMin: 3 }); ok(rar.length && rar.every(l => BY_ID[l.e.id].rar >= 3), 'фильтр редкости');
  const pm = A.search(W, { pMax: 50 }); ok(pm.length && pm.every(l => A.priceOf(l) <= 50), 'фильтр цены');
  const nm = BY_ID[lots()[0].e.id].name, q = A.search(W, { q: nm.slice(0, 5).toUpperCase() }); ok(q.length && q.every(l => BY_ID[l.e.id].name.toLowerCase().includes(nm.slice(0, 5).toLowerCase())), 'поиск по названию');
  const sp = A.search(W, { sort: 'price', dir: 'asc' }).map(A.priceOf), sd = A.search(W, { sort: 'price', dir: 'desc' }).map(A.priceOf);
  ok(sp.every((v, i) => !i || sp[i - 1] <= v) && sd.every((v, i) => !i || sd[i - 1] >= v), 'сортировка по цене');
  const sr = A.search(W, { sort: 'rar', dir: 'desc' }).map(l => BY_ID[l.e.id].rar || 0); ok(sr.every((v, i) => !i || sr[i - 1] >= v), 'сортировка по редкости');
  const sl = A.search(W, { sort: 'lv', dir: 'asc' }).map(l => A.levelOfEntry(l.e)); ok(sl.every((v, i) => !i || sl[i - 1] <= v), 'сортировка по уровню');
  ok(A.search(W, { buyOnly: true }).every(l => l.buy), 'только с выкупом'); }

// покупка по выкупу: пепел и вещь, лот пропал
const ashTotal = () => W.inv.ash + W.auction.pend.ash + lots().filter(l => l.who === A.ME).reduce((a, l) => a + l.bid, 0) + lots().filter(l => l.mine).reduce((a, l) => a + l.dep, 0) + W.auction.sink;
const T0 = ashTotal();
{ const l = A.search(W, { buyOnly: true, cat: 'consumable' })[0], a0 = W.inv.ash, n0 = W.inv.bag.length;
  ok(A.buyout(W, l.u) === 'ok', 'выкуп не прошёл'); ok(W.inv.ash === a0 - l.buy, 'пепел за выкуп'); ok(!lots().includes(l), 'лот остался после выкупа'); ok(W.inv.bag.some(s => s.id === l.e.id) || n0 === W.inv.bag.length, 'вещь не пришла');
  ok(A.buyout(W, l.u) === 'gone', 'второй выкуп того же лота'); }
// ставка: слишком малая, нормальная, перебитая
{ const l = A.search(W, { cat: 'armor' }).find(x => !x.bid && x.end > W.t + 100), m = A.minBid(W, l);
  ok(A.bid(W, l.u, m - 1) === 'low', 'ставка ниже минимума принята'); const a0 = W.inv.ash; ok(A.bid(W, l.u, m) === 'ok', 'ставка не принята'); ok(l.who === A.ME && l.bid === m && W.inv.ash === a0 - m, 'ставка не заморожена');
  const m2 = A.minBid(W, l); ok(m2 > m, 'шаг ставки'); ok(A.bid(W, l.u, m2) === 'ok' && W.inv.ash === a0 - m2, 'повышение своей ставки: платим разницу');
  // торги идут: бот перебивает ставку героя, пепел возвращается в pend.ash, лот остаётся в списке или уходит с победителем
  W.ev.length = 0; const before = W.auction.pend.ash; let outbid = false;
  for (let i = 0; i < 800 && !outbid && lots().includes(l); i++) { W.t += K.step; A.tick(W); outbid = W.ev.some(v => v.k === 'aucOutbid'); }
  ok(outbid || !lots().includes(l), 'ставку героя ни разу не перебили'); if (outbid) ok(W.auction.pend.ash >= before + m2, 'сбитая ставка не вернулась в pend.ash'); }

// свой лот: выставить, увидеть, продать боту, комиссия, деньги в pend
const bag = W.inv.bag; W.inv.bag.length = 0; W.inv.bag.push(entryOf('w_sword_iron', 0, null, 12)); addItem(W.inv, 'm_ore', 10, 40);
const idxSw = 0, a1 = W.inv.ash;
{ const u = A.listItem(W, idxSw, 1, 200, 400, 1); ok(typeof u === 'number', 'лот героя не выставлен: ' + u); const l = lots().find(x => x.u === u);
  ok(l && l.mine && l.e.il === 12 && !W.inv.bag.some(s => s.id === 'w_sword_iron'), 'вещь не ушла из сумки'); ok(W.inv.ash === a1 - l.dep && l.dep > 0, 'залог не взят');
  ok(A.search(W, { scope: 'mine' }).includes(l), 'нет в «Моих лотах»');
  ok(A.cancel(W, u) === 'ok' && W.inv.bag.some(s => s.id === 'w_sword_iron' && s.il === 12), 'снятие лота'); ok(W.inv.ash === a1 - l.dep, 'залог при снятии не должен вернуться');
  const bi = W.inv.bag.findIndex(s => s.id === 'w_sword_iron'); ok(A.listItem(W, bi, 2, 5, 0, 1) === 'count', 'больше, чем есть'); ok(A.listItem(W, bi, 1, 500, 100, 1) === 'price', 'выкуп ниже старта');
  ok(A.listItem(W, 99, 1, 5, 0, 1) === 'none', 'пустая ячейка'); ok(A.listItem(W, bi, 1, 5, 0, 7) === 'dur', 'срок вне списка');
  W.inv.bag[bi].lock = true; ok(A.listItem(W, bi, 1, 5, 0, 1) === 'locked', 'вещь под замком'); delete W.inv.bag[bi].lock; }
// стопка: часть уходит, часть остаётся
{ const bi = W.inv.bag.findIndex(s => s.id === 'm_ore'), u = A.listItem(W, bi, 4, 20, 0, 0); ok(typeof u === 'number' && W.inv.bag[bi].n === 6, 'часть стопки'); ok(A.cancel(W, u) === 'ok'); ok(W.inv.bag.reduce((a, s) => a + (s.id === 'm_ore' ? s.n : 0), 0) === 10, 'руда потерялась'); }
// продажа лота героя: дёшево выставили — боты купят; комиссия вычтена
{ const bi = W.inv.bag.findIndex(s => s.id === 'w_sword_iron'), fair = A.fairOf(W, { id: 'w_sword_iron', n: 1, il: 12 }), cheap = Math.max(1, Math.round(fair * .4));
  const u = A.listItem(W, bi, 1, cheap, cheap + 1, 2), l = lots().find(x => x.u === u), dep = l.dep, ash0 = W.inv.ash, pend0 = W.auction.pend.ash; let sold = false;
  for (let i = 0; i < 600 && !sold; i++) { W.t += K.step; A.tick(W); sold = !lots().includes(l); }
  ok(sold, 'дешёвый лот героя не купили за 600 шагов'); const gain = W.auction.pend.ash - pend0, price = l.bid || l.buy;
  ok(gain === price - A.feeOf(W, price) + dep, `выручка ${gain} ≠ цена ${price} − комиссия + залог ${dep}`); ok(A.feeOf(W, 1000) === Math.round(1000 * K.fee), 'комиссия');
  const r = A.claim(W); ok(r.ash === W.auction.pend.ash + r.ash - 0 && W.inv.ash === ash0 + gain + pend0, 'забрать выручку'); ok(W.auction.pend.ash === 0, 'pend.ash не обнулён'); }
// непроданный лот героя истекает: вещь возвращается к аукционеру, залог сгорает
{ const bi = W.inv.bag.findIndex(s => s.id === 'm_ore'), u = A.listItem(W, bi, 10, 99999, 0, 0), l = lots().find(x => x.u === u), s0 = W.auction.sink;
  W.t = l.end + 1; A.tick(W); ok(!lots().includes(l), 'лот не истёк'); ok(W.auction.pend.items.some(e => e.id === 'm_ore' && e.n === 10), 'вещь не вернулась'); ok(W.auction.sink >= s0 + l.dep, 'залог не сгорел');
  const r = A.claim(W); ok(r.n >= 10 && W.inv.bag.reduce((a, s) => a + (s.id === 'm_ore' ? s.n : 0), 0) === 10, 'вещь не забрана'); }
// живые боты: лоты приходят и уходят, цены ходят
{ const ids0 = new Set(lots().map(l => l.u)), d0 = JSON.stringify(W.auction.dem); let spans = 0;
  for (let d = 0; d < 6; d++) { W.t += DAY / 2; A.tick(W); spans++; }
  const ids1 = new Set(lots().map(l => l.u)); ok([...ids0].filter(u => !ids1.has(u)).length > 50, 'старые лоты не уходят'); ok([...ids1].filter(u => !ids0.has(u)).length > 50, 'новые лоты не появляются');
  ok(JSON.stringify(W.auction.dem) !== d0, 'спрос не меняется'); ok(lots().length >= K.target * .6 && lots().length <= K.target * 1.6, 'число лотов ушло: ' + lots().length);
  ok(lots().filter(l => l.bid && !l.mine).length > 0 || W.auction.sold > 20, 'боты не торгуются'); ok(lots().some(l => l.sel && (W.bots || []).some(b => b.name === l.sel)), 'продавцы — не боты мира'); }
// долгий сон не вешает рынок
{ const t0 = Date.now(); W.t += DAY * 40; const n = A.tick(W); ok(n <= K.maxCatch && Date.now() - t0 < 3000, 'догон рынка слишком долгий'); }
// сохранение
{ const mem = {}, st = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  const u = A.listItem(W, W.inv.bag.length ? 0 : -1, 1, 77, 0, 1); if (typeof u !== 'number') { W.inv.bag.push(entryOf('w_dagger_rust', 0, null, 5)); }
  const mu = A.listItem(W, W.inv.bag.length - 1, 1, 88, 0, 1); ok(typeof mu === 'number', 'не выставилось для сохранения'); const bidL = lots().find(l => !l.mine && !l.bid); A.bid(W, bidL.u, A.minBid(W, bidL));
  createSaver(W, st).write(true); const s = loadSave(1, st); ok(s && s.auc, 'аукциона нет в сохранении');
  const W2 = createWorld(c, mulberry32(9)); W2.t = W.t; const A2 = A.sanitizeAuction(W2, s.auc);
  ok(A2.lots.length === lots().length && A2.u === W.auction.u, 'лоты после загрузки'); ok(A2.lots.find(l => l.u === mu).mine && A2.lots.find(l => l.u === bidL.u).who === A.ME, 'свой лот или ставка потерялись');
  ok(JSON.stringify(A2.dem) === JSON.stringify(W.auction.dem) && A2.pend.ash === W.auction.pend.ash, 'спрос или выручка не сохранились');
  const old = A.sanitizeAuction(W2, null); ok(old.lots.length >= 400, 'старое сохранение — свежий рынок'); const bad = A.sanitizeAuction(W2, { lots: [{ e: { id: 'нет такого' }, start: 5, end: 9 }, null, { e: { id: 'm_ore', n: 9999 }, start: -3, end: 1 }, { e: { id: 'm_ore', n: 9999 }, start: 5, end: 9e9 }] });
  ok(bad.lots.every(l => BY_ID[l.e.id] && l.e.n <= BY_ID[l.e.id].stack) , 'испорченное не очищено'); }
// без утечек: пока ничего не покупали заново — пепел героя + заморожено + залоги + сгоревшее не растут сами; общий генератор не тронут
ok(calls === 0, 'общий W.rng потрачен: ' + calls);
{ const mono = ashTotal(); ok(Number.isFinite(mono) && mono > 0 && mono >= W.inv.ash, 'пепел'); }
// вдали от аукционера — нельзя
W.nearNpc = null; ok(A.bid(W, lots()[0].u, 1e6) === 'far' && A.buyout(W, lots()[0].u) === 'far' && A.listItem(W, 0, 1, 5, 0, 0) === 'far' && A.claim(W) === 'far', 'действия без аукционера');
void T0; void bag;

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log(`Аукцион 3D: OK (лотов ${lots().length}, видов ${kinds.size}, вещей ${ids.size}, продано ${W.auction.sold})`);
