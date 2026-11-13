// Банк (2026-11-13): кладут и берут только рядом с жителем, вещь целиком (уровень, свойства, замок), стопки сливаются, места нет — вещь остаётся, сохранение и порча сохранения
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, bagSlots } from '../3d/src/sim.js';
import { BY_ID } from '../3d/src/data/items.js';
import { entryOf } from '../3d/src/inv.js';
import { createSaver, loadSave } from '../3d/src/save3d.js';
import { bankOf, bankCap, deposit, withdraw, sanitizeBank } from '../3d/src/bank3d.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0;
const W = createWorld(c, mulberry32(4)); step(W, 1 / 60, {}); W.inv.bag.length = 0;
const bld = W.map.buildings.find(b => b.npc && b.npc.kind === 'merchant' && !b.vil);
// далеко от жителя — нельзя
W.player.x = 300; W.player.z = 300; step(W, 1 / 60, {}); W.inv.bag.push(entryOf('w_sword_iron', 0, null, 7)); ok(deposit(W, 0, 1) === 'far', 'далеко от жителя положили'); ok(W.inv.bag.length === 1 && !bankOf(W).length, 'вещь ушла без права');
W.player.x = bld.npc.x + 1; W.player.z = bld.npc.z; step(W, 1 / 60, {}); ok(W.nearNpc, 'рядом с жителем nearNpc пуст');
// вещь целиком: уровень, улучшение, замок
const s0 = W.inv.bag[0]; s0.up = 2; s0.lock = true; ok(deposit(W, 0, 1) === 'ok', 'не положилось'); ok(!W.inv.bag.length && bankOf(W).length === 1, 'банк: ' + bankOf(W).length);
const b0 = bankOf(W)[0]; ok(b0.id === 'w_sword_iron' && b0.il === 7 && b0.up === 2 && b0.lock, 'потеряны свойства вещи: ' + JSON.stringify(b0));
ok(withdraw(W, 0) === 'ok' && W.inv.bag.length === 1 && W.inv.bag[0].il === 7 && W.inv.bag[0].up === 2 && !bankOf(W).length, 'не вернулось целиком');
// стопки
const stk = Object.values(BY_ID).find(i => i.stack > 4 && i.cat !== 'key'); W.inv.bag.length = 0; W.inv.bag.push({ id: stk.id, n: 3 }, { id: stk.id, n: 2 });
ok(deposit(W, 0, 3) === 'ok' && deposit(W, 0, 2) === 'ok', 'стопки не положились'); ok(bankOf(W).length === 1 && bankOf(W)[0].n === 5, 'стопки не слились: ' + JSON.stringify(bankOf(W)));
ok(withdraw(W, 0) === 'ok' && W.inv.bag.length === 1 && W.inv.bag[0].n === 5, 'стопка не вернулась');
// банк полон — вещь остаётся в сумке
W.bank = []; const cap = bankCap(W); for (let i = 0; i < cap; i++) W.bank.push({ id: 'w_sword_iron', n: 1, il: i + 1 }); W.inv.bag.length = 0; W.inv.bag.push(entryOf('w_axe_iron', 0, null, 3));
ok(deposit(W, 0, 1) === 'full' && W.inv.bag.length === 1 && W.bank.length === cap, 'банк переполнился или вещь пропала');
// сумка полна — вещь остаётся в банке
W.bank = [{ id: 'w_sword_iron', n: 1, il: 9 }]; W.inv.bag.length = 0; for (let i = 0; i < bagSlots(W); i++) W.inv.bag.push(entryOf('w_axe_iron', 0, null, i + 1));
ok(withdraw(W, 0) === 'full' && W.bank.length === 1 && W.inv.bag.length === bagSlots(W), 'сумка переполнена или вещь пропала');
// сохранение и порча
W.bank = [{ id: 'w_sword_iron', n: 1, il: 5, up: 1 }]; { const mem = {}, st = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  createSaver(W, st).write(true); const s = loadSave(1, st); ok(s && s.bank && s.bank.length === 1 && s.bank[0].il === 5 && s.bank[0].up === 1, 'банка нет в сохранении: ' + JSON.stringify(s && s.bank)); }
const bad = sanitizeBank([{ id: 'нет такого', n: 5 }, null, { id: 'w_sword_iron', n: 999, up: 99, il: -5 }, 'x'], 60); ok(bad.length === 1 && bad[0].n === 1 && bad[0].up === 5 && !bad[0].il, 'порча не очищена: ' + JSON.stringify(bad));
ok(sanitizeBank(null).length === 0, 'старое сохранение без банка');
if (fails.length) { console.log('ПРОВАЛ:'); for (const f of fails) console.log(f); process.exit(1); }
console.log('Банк 3D: OK');
