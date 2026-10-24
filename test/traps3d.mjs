// Ловушки подземелий (план подземелий, этап 2в): в коридорах главного пути — шипы, огонь и маятник; число в пределах; зона удара —
// внутри коридора, рычаг — в зале перед ним; предупреждение перед ударом; удар — раз за круг, по герою, отряду и врагам (не боссам);
// рычаг выключает ловушку; без героя рядом с рычагом ловушка работает; новая раскладка — новые ловушки.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnEnemy } from '../3d/src/sim.js';
import { travel } from '../3d/src/levels3d.js';
import { roomAt } from '../3d/src/map.js';
import { trapPhase, trapHits } from '../3d/src/traps3d.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const T = CFG3.dungeons.traps, I = CFG3.dungeons.list.filter(d => d.inst);
const mk = () => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.events.on = false; c.wanderer.on = false; const W = createWorld(c, mulberry32(8)); W.lv = 40; return W; };
const W = mk();
// раскладка
for (const d of I) { travel(W, d.id, 0, 0); const M = W.map, lim = d.raid ? T.raid : T.dungeon, Q = M.traps;
  ok(Q.length >= 1 && Q.length <= lim[1], `${d.id}: ловушек ${Q.length}`);
  for (const q of Q) { const r = roomAt(M, q.x, q.z), lr = roomAt(M, q.lever.x, q.lever.z); ok(r >= 0 && M.rooms[r].corridor, `${d.id}: ловушка не в коридоре`); ok(lr >= 0 && !M.rooms[lr].corridor, `${d.id}: рычаг не в зале`); ok(['spikes', 'fire', 'blade'].includes(q.kind), 'вид ловушки ' + q.kind); }
  travel(W, 'surface', 0, 4); }
// фазы: предупреждение до удара, у маятника — качание
{ const q = { kind: 'spikes', period: T.period.spikes, off: 0, on: true }, P = q.period, H = T.hot.spikes; let armed = false, hot = false, order = true;
  for (let t = 0; t < P; t += .02) { const ph = trapPhase(CFG3, q, t); if (ph.arm > 0) armed = true; if (ph.hot) { hot = true; if (!armed) order = false; } }
  ok(armed && hot && order, 'шипы: нет предупреждения перед ударом'); ok(Math.abs(trapPhase(CFG3, { ...q, on: false }, P - H / 2).hot) === 0, 'выключенная ловушка бьёт');
  const b = { kind: 'blade', period: T.period.blade, off: 0, on: true, along: 'x', x: 0, z: 0, w: 3, d: 3 }; ok(trapHits(CFG3, b, trapPhase(CFG3, b, 0), 0, 0) && !trapHits(CFG3, b, trapPhase(CFG3, b, b.period / 4), 0, 0), 'маятник не качается через середину'); }
// удар по герою и врагу раз за круг; рычаг выключает
{ const d = I.find(x => !x.raid); travel(W, d.id, 0, 0); const q = W.map.traps.find(o => o.kind !== 'blade') || W.map.traps[0], p = W.player;
  W.enemies.length = 0; p.x = q.x; p.z = q.z; p.inv = 0; p.maxhp = p.hp = 1000; const e = spawnEnemy(W, 'brute', q.x + .3, q.z); e.hp = e.maxhp = 1000; e.cd = 99;
  let hits = 0; W.t = 0; for (let i = 0; i < Math.round(q.period * 2 * 60); i++) { p.x = q.x; p.z = q.z; p.inv = 0; e.x = q.x + .3; e.z = q.z; e.vx = e.vz = 0; step(W, 1 / 60, {}); hits += W.ev.filter(v => v.k === 'trapHit').length; W.ev.length = 0; }
  ok(hits >= 1 && hits <= 3, `герой получил ударов ловушки за 2 круга: ${hits}`); ok(p.hp < 1000 && e.hp < 1000, `ловушка не ранила героя (${p.hp}) или врага (${e.hp})`);
  p.x = q.lever.x; p.z = q.lever.z; step(W, 1 / 60, {}); ok(!q.on && W.ev.some(v => v.k === 'lever'), 'рычаг не выключил ловушку');
  const hp0 = p.hp; for (let i = 0; i < Math.round(q.period * 60); i++) { p.x = q.x; p.z = q.z; p.inv = 0; step(W, 1 / 60, {}); } ok(p.hp >= hp0, 'выключенная ловушка ранит');
  const n0 = JSON.stringify(W.map.traps.map(o => [o.x, o.z])); travel(W, 'surface', 0, 4); travel(W, d.id, 0, 0); ok(JSON.stringify(W.map.traps.map(o => [o.x, o.z])) !== n0 && W.map.traps.every(o => o.on), 'новая раскладка — те же ловушки или выключены'); }

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Ловушки подземелий 3D: OK');
