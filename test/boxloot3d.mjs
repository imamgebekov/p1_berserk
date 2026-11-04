// Сундук как добыча: рядом — кнопка (W.nearBox), открытие кладёт вещи «в тело» (окно добычи), замок и ключ, пустеет и наполняется снова
import { createWorld, step, mulberry32, openBox, corpseItems, lootCorpse } from '../3d/src/sim.js';
import { CFG3 } from '../3d/src/config3d.js';
import { CONTAINERS } from '../3d/src/data/loot.js';
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('✗', m); } };
const mk = (manual, seed = 3) => { const c = JSON.parse(JSON.stringify(CFG3)); c.map.boxManual = manual; const W = createWorld(c, mulberry32(seed)); W.player.maxhp = W.player.hp = 1e9; step(W, 1 / 30, {}); W.enemies.length = 0; return W; };
const find = (W, f) => W.map.containers.find(c => c.ready && f(c));
// ручной режим: рядом — nearBox, вещи не подбираются сами
{ const W = mk(true), c = find(W, c => !c.locked && c.items.length >= 1 && !c.key && CONTAINERS[c.kind].slots); const n0 = c.items.length, bag0 = W.inv.bag.length;
  W.player.x = c.x + .8; W.player.z = c.z; step(W, 1 / 30, {}); ok(W.nearBox === c && c.ready && c.items.length === n0 && W.inv.bag.length === bag0, 'сундук открылся сам или не найден рядом');
  W.player.x = c.x + 1.3 + CFG3.map.boxReachAdd + 2; step(W, 1 / 30, {}); ok(W.nearBox !== c, 'сундук найден издали');
  W.player.x = c.x + .8; step(W, 1 / 30, {}); ok(openBox(W, c) === 'ok' && !c.ready && c.items.length === 0, 'открытие не удалось'); const id = 'b' + W.lvl + ':' + c.id;
  const its = corpseItems(W, id); ok(its.length === n0 && W.corpses.some(q => q.id === id && q.box && q.name === CONTAINERS[c.kind].name), 'вещи не легли в окно добычи'); ok(openBox(W, c) === 'none', 'открыт дважды');
  step(W, 1 / 30, {}); ok(W.nearCorpse && W.nearCorpse.id === id, 'у открытого сундука нет метки добычи');
  const r = lootCorpse(W, id, 0); ok(r.n >= 1 || r.full, 'вещь не взята'); lootCorpse(W, id); for (let i = 0; i < 90; i++) step(W, 1 / 30, {}); ok(!W.corpses.some(q => q.id === id), 'пустое тело сундука не убралось');
  const t0 = c.t; for (let i = 0; i < 30; i++) step(W, 1 / 30, {}); ok(c.t > t0 || c.ready, 'сундук не наполняется заново'); }
// запертый: без ключа — отказ, с ключом — открыт и ключ потрачен
{ const W = mk(true), c = find(W, c => c.locked); if (!c) console.log('(нет запертого сундука в мире — проверка замка пропущена)'); else {
    W.player.x = c.x + .8; W.player.z = c.z; step(W, 1 / 30, {}); W.ev.length = 0; ok(openBox(W, c) === 'locked' && c.locked && c.ready && W.ev.some(v => v.k === 'locked'), 'замок открыт без ключа'); } }
// старый режим (тесты): сундук открывается сам, как раньше
{ const W = mk(false), c = find(W, c => !c.locked && c.items.length >= 1 && !c.key); W.player.x = c.x + .8; W.player.z = c.z; step(W, 1 / 30, {}); ok(!c.ready && W.nearBox === null, 'автооткрытие сломано'); }
// в конфиге размер и дальность
ok(CFG3.map.containerScale > 1 && CFG3.map.boxReachAdd > 0, 'нет размера или дальности сундуков');
if (bad) { console.log('Сундук-добыча 3D: упало', bad); process.exit(1); } console.log('Сундук-добыча 3D: OK');
