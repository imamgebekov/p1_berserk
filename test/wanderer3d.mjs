// Тест сказочного торговца 3D (шаг A4): появляется в окне времени, стоит stay секунд и уезжает (но не при герое рядом),
// встаёт только вне лагеря, опасных мест и домов, не появляется, пока герой в подземелье; торгует с наценкой и ночью;
// сказочные товары не выпадают из сундуков и врагов; свиток возврата переносит в лагерь, эликсир лечит; поток боя не сдвигается.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, travel, buyItem, sellItem, buyPrice, useItem } from '../3d/src/sim.js';
import { wandererSpot, wandererStock } from '../3d/src/events3d.js';
import { insideOf, placeAt, insideCamp } from '../3d/src/map.js';
import { CONTAINERS, DROPS, rollLoot, rollDrop } from '../3d/src/data/loot.js';
import { BY_ID } from '../3d/src/data/items.js';
import { addItem } from '../3d/src/inv.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const clone = () => JSON.parse(JSON.stringify(CFG3));
const C = CFG3.wanderer;
const mk = (seed = 1, tweak) => { const c = clone(); c.enemies.count = 0; for (const d of c.dungeons.list) d.spawns = []; if (tweak) tweak(c); const W = createWorld(c, mulberry32(seed)); W.player.hp = W.player.maxhp = 1e9; return W; };
// шаги до события k; возвращает время события или -1
const until = (W, k, sec) => { for (let i = 0; i < sec * 60; i++) { step(W, 1 / 60, {}); const hit = W.ev.some(v => v.k === k); W.ev.length = 0; if (hit) return W.t; } return -1; };
// торговец рядом с героем, с заданной витриной
const standBy = (W, stock) => { W.wanderer = { x: W.player.x + 2.6, z: W.player.z, face: 0, t: 999, stock }; W.wandT = 1e9; step(W, 1 / 60, {}); };

// ---------- 1. окно появления, отъезд по таймеру, следующее окно ----------
for (let s = 1; s <= 4; s++) {
  const W = mk(s), t1 = until(W, 'wanderer', C.first[1] + 5);
  ok(t1 >= C.first[0] && t1 <= C.first[1] + 1, `сид ${s}: первое появление в ${t1.toFixed(0)} с вне окна ${C.first}`);
  ok(W.wanderer && W.wanderer.stock.length >= C.fairy + C.gear[0], `сид ${s}: у торговца мало товара`);
  const d = W.wanderer && Math.hypot(W.wanderer.x - W.player.x, W.wanderer.z - W.player.z);
  ok(d >= C.dist[0] && d <= C.dist[1], `сид ${s}: повозка в ${d && d.toFixed(1)} м от героя`);
  const t2 = until(W, 'wanderLeave', C.stay + 5);
  ok(t2 > 0 && Math.abs(t2 - t1 - C.stay) < .1 && !W.wanderer, `сид ${s}: уехал через ${(t2 - t1).toFixed(1)} с, а не ${C.stay}`);
  const t3 = until(W, 'wanderer', C.every[1] + 5);
  ok(t3 - t2 >= C.every[0] - .1 && t3 - t2 <= C.every[1] + .1, `сид ${s}: повтор через ${(t3 - t2).toFixed(0)} с вне окна ${C.every}`);
}
// ---------- 2. не уезжает, пока герой рядом ----------
{
  const W = mk(7); until(W, 'wanderer', C.first[1] + 5); const w = W.wanderer;
  W.player.x = w.x + 2.4; W.player.z = w.z;
  let left = false; for (let i = 0; i < (C.stay + 30) * 60 && !left; i++) { step(W, 1 / 60, {}); left = W.ev.some(v => v.k === 'wanderLeave'); W.ev.length = 0; }
  ok(!left && W.wanderer === w, 'торговец уехал, хотя герой стоял рядом');
  ok(W.nearNpc === 'wanderer' && W.nearMerchant, 'рядом с повозкой нельзя торговать');
  W.player.x += 30; ok(until(W, 'wanderLeave', 2) > 0, 'торговец не уехал, когда герой ушёл');
}
// ---------- 3. место: вне лагеря, опасных мест, домов, в границах мира ----------
{
  const W = mk(9), M = W.map; let n = 0, bad = 0;
  for (let k = 0; k < 400; k++) {
    const a = k * 2.4, r = (k % 10) * 7; W.player.x = Math.cos(a) * r; W.player.z = Math.sin(a) * r;
    const s = wandererSpot(W); if (!s) continue; n++;
    if (insideCamp(M.camp, s.x, s.z, -C.campPad) || (placeAt(M, s.x, s.z) || {}).danger || insideOf(M, s.x, s.z) >= 0 || Math.hypot(s.x, s.z) > CFG3.world.radius - 4) bad++;
  }
  ok(M.camp && n > 300 && bad === 0, `мест найдено ${n}, плохих ${bad}`);
}
// ---------- 4. в подземелье не появляется ----------
{
  const W = mk(11), D = CFG3.dungeons.list[0]; travel(W, D.id, D.entry.x, D.entry.z);
  ok(until(W, 'wanderer', C.first[1] + 60) < 0 && !W.wanderer, 'торговец появился, пока герой в подземелье');
  travel(W, 'surface', 0, 4); ok(until(W, 'wanderer', C.retry + 2) > 0, 'после подъёма торговец не появился');
  const w = W.wanderer; travel(W, D.id, D.entry.x, D.entry.z); w.x = W.player.x + 1; w.z = W.player.z; w.t = 999; step(W, 1 / 60, {});
  ok(W.nearNpc !== 'wanderer', 'с торговцем можно торговать из подземелья');
}
// ---------- 5. покупка с наценкой, ночью тоже; обычный торговец ночью спит ----------
{
  const W = mk(13); standBy(W, [{ id: 'p_fairy_elixir', n: 2 }]); W.inv.ash = 1e5; W.night = true;
  const it = BY_ID.p_fairy_elixir, price = buyPrice(it, W.cfg, W.dif.buy * C.priceMul);
  ok(price > buyPrice(it, W.cfg, W.dif.buy), 'наценки нет');
  ok(buyItem(W, 0) === 'ok' && W.inv.ash === 1e5 - price && W.wanderer.stock[0].n === 1, 'покупка у сказочного торговца не прошла или цена не та');
  ok(W.inv.bag.some(s => s.id === 'p_fairy_elixir'), 'купленного нет в сумке');
  const before = W.inv.ash; ok(sellItem(W, W.inv.bag.findIndex(s => s.id === 'p_fairy_elixir')) === 'ok' && W.inv.ash > before, 'ночью сказочный торговец не покупает');
  ok(W.shop.stock.length > 0, 'витрина лавки пуста — проверка ниже бессмысленна');
  const W2 = mk(14); const m = W2.map.buildings.find(b => b.npc && b.npc.kind === 'merchant').npc;
  W2.player.x = m.x + 1; W2.player.z = m.z + 1; step(W2, 1 / 60, {}); W2.inv.ash = 1e5; W2.night = true;
  ok(W2.nearNpc === 'merchant' && buyItem(W2, 0) === 'closed', 'обычный торговец торгует ночью');
}
// ---------- 6. товар: сказочные вещи и великое снаряжение ----------
{
  const W = mk(15); let fairy = 0, epic = 0, uniq = 0;
  for (let i = 0; i < 300; i++) for (const s of wandererStock(W)) { const it = BY_ID[s.id]; if (it.pool === 'fairy') fairy++; else if (it.rar === 4) uniq++; else if (it.slot && it.rar === 3) epic++; }
  ok(fairy === 300 * C.fairy, 'сказочных товаров не столько, сколько задано');
  ok(epic >= 300 * C.gear[0] && epic <= 300 * C.gear[1], 'великого снаряжения не столько, сколько задано');
  ok(uniq > 300 * C.uniqueChance * .6 && uniq < 300 * C.uniqueChance * 1.4, `именных вещей ${uniq} из 300`);
  const rng = mulberry32(3); let leak = 0;
  for (let i = 0; i < 3000; i++) { for (const k of Object.keys(CONTAINERS)) for (const x of rollLoot(CONTAINERS[k], rng, 1, 100)) if (BY_ID[x.id].pool === 'fairy') leak++; for (const k of Object.keys(DROPS)) { const d = rollDrop(k, rng, 1, 100); for (const x of [].concat(d || [])) if (x && BY_ID[x.id] && BY_ID[x.id].pool === 'fairy') leak++; } }
  ok(leak === 0, 'сказочные товары выпадают из сундуков или врагов');
}
// ---------- 7. свиток возврата и эликсир ----------
{
  const W = mk(17), D = CFG3.dungeons.list[0]; travel(W, D.id, D.entry.x, D.entry.z);
  addItem(W.inv, 'u_recall', 2, 30); ok(useItem(W, W.inv.bag.findIndex(s => s.id === 'u_recall')), 'свиток не читается');
  ok(W.lvl === 'surface' && W.player.x === 0 && W.player.z === 4, `свиток перенёс не в лагерь: ${W.lvl} ${W.player.x},${W.player.z}`);
  W.player.x = 60; W.player.z = 10; ok(useItem(W, W.inv.bag.findIndex(s => s.id === 'u_recall')) && W.player.x === 0 && W.player.z === 4, 'свиток не работает на поверхности');
  ok(!W.inv.bag.some(s => s.id === 'u_recall'), 'свитки не тратятся');
  W.player.maxhp = 200; W.player.hp = 10; addItem(W.inv, 'p_fairy_elixir', 1, 30);
  ok(useItem(W, W.inv.bag.findIndex(s => s.id === 'p_fairy_elixir')) && W.player.hp === 200 && W.buffs.some(b => b.stat === 'regen'), 'эликсир феи не лечит полностью');
}
// ---------- 8. поток боя не сдвигается (события выключены: у них с торговцем общий генератор, а в спокойном мире они стартуют) ----------
{
  const run = on => { const W = mk(21, c => { c.enemies.count = 8; c.wanderer.on = on; c.events.on = false; }); W.player.x = 40; W.player.z = 40; for (let i = 0; i < 60 * 700; i++) { step(W, 1 / 60, { attack: i % 30 === 0 }); W.ev.length = 0; } return JSON.stringify([W.kills, W.enemies.map(e => [e.type, e.x.toFixed(3), e.z.toFixed(3), e.hp]), W.rng()]); };
  ok(run(true) === run(false), 'торговец сдвинул поток боя');
}

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Сказочный торговец 3D: OK');
