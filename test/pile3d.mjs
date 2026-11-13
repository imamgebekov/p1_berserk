// Брошенное из сумки (2026-11-13): лежит кучей на земле, само не подбирается, берётся кнопкой через окно добычи; несколько вещей — одна куча; куча исчезает, когда пуста
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, dropItem, lootCorpse, corpseItems } from '../3d/src/sim.js';
import { entryOf } from '../3d/src/inv.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; const W = createWorld(c, mulberry32(5)); step(W, 1 / 60, {});
W.inv.bag.length = 0; W.inv.bag.push(entryOf('w_sword_iron', 0, null, 4), { id: 'f_rye', n: 3 }, entryOf('w_axe_iron', 0, null, 6));
ok(dropItem(W, 0, 3) && dropItem(W, 0, 3) && dropItem(W, 0, 3), 'не выбросилось'); ok(!W.inv.bag.length, 'вещи остались в сумке');
const piles = (W.corpses || []).filter(q => q.type === 'pile'); ok(piles.length === 1, 'куч: ' + piles.length); ok(W.drops.length >= 3 && W.drops.every(q => q.corpse === piles[0].id), 'вещи не в одной куче');
// 10 секунд рядом: само не подбирается
const p = W.player; for (let i = 0; i < 600; i++) { step(W, 1 / 60, {}); } ok(!W.inv.bag.length, 'подобралось само: ' + W.inv.bag.length);
ok(W.nearCorpse && W.nearCorpse.pile, 'рядом с кучей кнопка не видит её');
// берём по одной через окно добычи
const items = corpseItems(W, piles[0].id); ok(items.length === 3, 'в куче ' + items.length);
const r = lootCorpse(W, piles[0].id); ok(r && r.n === 3 && W.inv.bag.length === 3, 'не взялось всё: ' + JSON.stringify(r) + ' ' + W.inv.bag.length);
for (let i = 0; i < 600; i++) step(W, 1 / 60, {}); ok(!(W.corpses || []).some(q => q.type === 'pile') && !W.drops.length, 'пустая куча не исчезла');
if (fails.length) { console.log('ПРОВАЛ:'); for (const f of fails) console.log(f); process.exit(1); }
console.log('Куча брошенного 3D: OK');
