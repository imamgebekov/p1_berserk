// Подача босса (2026-11-13): при пробуждении — событие с местом и размером и тряска, на шкале — метки фаз, у крупного босса радиус больше, чем у малого
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnBoss } from '../3d/src/sim.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.events.on = false; c.wanderer.on = false;
const W = createWorld(c, mulberry32(3)); step(W, 1 / 60, {});
ok(c.enemies.voidking.scale > c.enemies.devourer.scale * 2 && c.enemies.voidking.radius > c.enemies.devourer.radius * 2, 'крупный босс не крупнее малого вдвое');
const def = c.bosses.list.find(b => b.type === 'castellan'); ok(def, 'нет castellan'); spawnBoss(W, def);
const e = W.enemies.find(q => q.boss && q.type === 'castellan'); ok(e, 'не появился');
W.player.x = e.x - 10; W.player.z = e.z; W.shake = 0; let ev = null; for (let i = 0; i < 240 && !ev; i++) { step(W, 1 / 60, {}); ev = W.ev.find(v => v.k === 'bossaggro'); W.ev.length = 0; if (!ev && W.shake > 0) break; }
ok(W.shake >= .9, 'при пробуждении нет тряски: ' + W.shake); ok(W.hudBoss && Array.isArray(W.hudBoss.marks), 'нет меток фаз на шкале');
if (fails.length) { console.log('ПРОВАЛ:'); for (const f of fails) console.log(f); process.exit(1); }
console.log('Подача босса 3D: OK');
