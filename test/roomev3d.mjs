// События залов (план подземелий, этап 2д): в залах главного пути — засада (волны, потом награда), испытание у алтаря (выстоять в зале;
// ушёл — провал), пленник (перебить стражу и подойти — пепел и награда), пепельный вор (догнать и убить — награда); число — в пределах;
// пленник не уходит наверх вместе с героем.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, killEnemy } from '../3d/src/sim.js';
import { travel } from '../3d/src/levels3d.js';
import { roomAt } from '../3d/src/map.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const R = CFG3.dungeons.roomEvents, I = CFG3.dungeons.list.filter(d => d.inst);
const mk = () => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.events.on = false; c.wanderer.on = false; c.dungeons.traps.on = false; const W = createWorld(c, mulberry32(12)); W.lv = 40; return W; };
const run = (W, sec, f) => { for (let i = 0; i < Math.round(sec * 60); i++) { if (f) f(i); step(W, 1 / 60, {}); } };
const killAll = W => { for (const e of W.enemies) if (!e.dead && !e.boss) killEnemy(W, e, 1); };
// раскладка
{ const W = mk(); const seen = new Set();
  for (const d of I) for (let k = 0; k < 2; k++) { travel(W, d.id, 0, 0); const E = W.map.events; ok(E.length >= 1 && E.length <= (d.raid ? R.raid : R.dungeon), `${d.id}: событий ${E.length}`);
    for (const ev of E) { seen.add(ev.kind); const ri = roomAt(W.map, ev.x, ev.z); ok(ri >= 0 && W.map.rooms[ri].id === ev.room && !W.map.rooms[ri].corridor, `${d.id}: событие не в своём зале`); }
    travel(W, 'surface', 0, 4); }
  ok(['ambush', 'trial', 'captive', 'thief'].every(k => seen.has(k)), 'не все виды событий встречаются: ' + [...seen]); }
// каждое событие: найти подземелье с ним и пройти
const play = kind => { const W = mk(); for (let t = 0; t < 40; t++) { const d = I[t % I.length]; travel(W, d.id, 0, 0); const ev = W.map.events.find(e => e.kind === kind); if (ev) return { W, ev }; travel(W, 'surface', 0, 4); } return null; };
{ const g = play('ambush'); ok(g, 'засады нет'); if (g) { const { W, ev } = g, p = W.player; W.enemies.forEach(e => { e.dead = true; }); p.inv = 1e9; p.x = ev.x; p.z = ev.z; const d0 = W.drops.length;
  let waves = 0; for (let k = 0; k < 6 && ev.st !== 'done'; k++) { run(W, .3, () => { p.x = ev.x; p.z = ev.z; }); if (ev.st === 'fight') { waves = Math.max(waves, ev.wave); ok(W.enemies.some(e => !e.dead && ev.foes.includes(e.id)), 'волна засады без врагов'); killAll(W); } }
  ok(ev.st === 'done' && waves === R.ambush.waves && W.drops.length > d0, `засада: волн ${waves}, итог ${ev.st}`); } }
{ const g = play('trial'); ok(g, 'испытания нет'); if (g) { const { W, ev } = g, p = W.player; W.enemies.forEach(e => { e.dead = true; }); p.inv = 1e9; p.x = ev.x + 1.5; p.z = ev.z;
  run(W, .2); ok(ev.st === 'run', 'испытание не началось у алтаря'); const d0 = W.drops.length; run(W, R.trial.time + 1, () => { p.x = ev.x + 1.5; p.z = ev.z; p.hp = p.maxhp; });
  ok(ev.st === 'done' && W.drops.length > d0, 'испытание: выстоял, а награды нет: ' + ev.st);
  const g2 = play('trial'); if (g2) { const { W: W2, ev: e2 } = g2, p2 = W2.player; W2.enemies.forEach(e => { e.dead = true; }); p2.inv = 1e9; p2.x = e2.x + 1.5; p2.z = e2.z; run(W2, .2); p2.x = W2.map.rooms[0].x0 + 2; p2.z = (W2.map.rooms[0].z0 + W2.map.rooms[0].z1) / 2; run(W2, .2); ok(e2.st === 'fail', 'ушёл из зала — испытание не провалено'); } } }
{ const g = play('captive'); ok(g, 'пленника нет'); if (g) { const { W, ev } = g, p = W.player; W.enemies.forEach(e => { e.dead = true; }); p.inv = 1e9; p.x = ev.x + 6; p.z = ev.z; run(W, .2);
  ok(ev.st === 'guard' && W.allies.some(a => a.id === ev.guest), 'пленник не появился'); const a0 = W.inv.ash; p.x = ev.x + 1; p.z = ev.z; run(W, .3); ok(ev.st === 'guard', 'пленник свободен при живой страже');
  killAll(W); run(W, .3, () => { p.x = ev.x + 1; p.z = ev.z; }); ok(ev.st === 'done' && W.inv.ash > a0 && !W.allies.some(a => a.id === ev.guest), 'пленник: нет награды или не ушёл');
  const g2 = play('captive'); if (g2) { const { W: W2, ev: e2 } = g2; W2.player.x = e2.x + 6; W2.player.z = e2.z; W2.enemies.forEach(e => { e.dead = true; }); run(W2, .2); travel(W2, 'surface', 0, 4); ok(!W2.allies.some(a => a.roomEv), 'пленник ушёл наверх с героем'); } } }
{ const g = play('thief'); ok(g, 'вора нет'); if (g) { const { W, ev } = g, p = W.player; W.enemies.forEach(e => { e.dead = true; }); p.inv = 1e9; p.x = ev.x; p.z = ev.z; run(W, .2);
  const t = W.enemies.find(e => !e.dead && e.type === 'ash_thief'); ok(ev.st === 'run' && t, 'вор не появился'); const got = () => W.drops.length + W.inv.bag.reduce((a, q) => a + q.n, 0), d0 = got(); if (t) killEnemy(W, t, 1); run(W, .2); ok(ev.st === 'done' && got() > d0, 'вор пойман, а награды нет'); } }     // награду рядом герой сразу подбирает

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('События залов 3D: OK');
