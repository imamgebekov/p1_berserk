// Физика боя (план физики, 2026-10-25), этап 1 — движение героя: разгон как раньше, торможение длиннее, резкий разворот
// придерживает скорость, путь переката как раньше и не зависит от частоты кадров; выключено (phys.move.on: false) — как раньше.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32 } from '../3d/src/sim.js';
import { rollK } from '../3d/src/phys3d.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const M = CFG3.phys.move, P = CFG3.player;
const W0 = (() => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.map.places = []; c.events.on = false; c.wanderer.on = false; const W = createWorld(c, mulberry32(7)); W.player.hp = W.player.maxhp = 1e6; W.enemies.length = 0; return W; })();
const home = { x: W0.player.x, z: W0.player.z };
const mk = (on = true) => { const W = W0, p = W.player; W.cfg.phys.move.on = on; W.enemies.length = 0; Object.assign(p, { x: home.x, z: home.z, vx: 0, vz: 0, state: 'idle', rollCd: 0, rollT: 0, turnT: 0, runT: 0, inv: 0, atkBuf: 0, rollPress: false }); return W; };     // один мир: создавать заново долго
const run = (W, sec, inp = {}, dt = 1 / 60) => { for (let i = 0; i < Math.round(sec / dt); i++) step(W, dt, inp); };
const spd = W => Math.hypot(W.player.vx, W.player.vz);
const at = W => ({ x: W.player.x, z: W.player.z }), dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// 1. разгон — как раньше
{ const t = on => { const W = mk(on); let n = 0; run(W, .5, { mx: 1 }); const top = spd(W); const W2 = mk(on); while (spd(W2) < top * .95 && n < 120) { step(W2, 1 / 60, { mx: 1 }); n++; } return { n, top }; };
  const a = t(true), b = t(false);
  ok(Math.abs(a.top - b.top) < 1e-6, `полная скорость изменилась: ${a.top} / ${b.top}`);
  ok(a.n === b.n, `разгон изменился: ${a.n} / ${b.n} кадров`); }

// 2. торможение без ввода — длиннее, но не скольжение
{ const stop = on => { const W = mk(on); run(W, .6, { mx: 1 }); const v = spd(W), a = at(W); run(W, 1); return { d: dist(a, at(W)), v, end: spd(W) }; };
  const a = stop(true), b = stop(false), want = a.v * a.v / (2 * M.brake);
  ok(a.end < 1e-6, 'герой не остановился');
  ok(a.d > b.d, `тормозной путь не длиннее: ${a.d.toFixed(2)} / ${b.d.toFixed(2)}`);
  ok(Math.abs(a.d - want) < .1 && a.d < .7, `тормозной путь ${a.d.toFixed(2)} м, ждали ≈${want.toFixed(2)}`); }

// 3. резкий разворот придерживает скорость; выключено — нет
{ const turn = on => { const W = mk(on); run(W, .6, { mx: 1 }); step(W, 1 / 60, { mx: -1 }); return W.player.turnT > 0; };
  ok(turn(true), 'разворот не замечен');
  { const W = mk(); run(W, .6, { mx: 1 }); const v0 = spd(W); step(W, 1 / 60, { mx: -1 }); ok(spd(W) <= v0 * M.turn.k + 1, `упор на развороте не гасит скорость: ${v0.toFixed(2)} → ${spd(W).toFixed(2)}`); } ok(!turn(false), 'выключено, а разворот замечен');
  const W = mk(); run(W, .6, { mx: 1 }); step(W, 1 / 60, { mz: 1 }); ok(!(W.player.turnT > 0), 'поворот на 90° считается разворотом');
  { const W = mk(); run(W, .6, { mx: 1 }); let n = 0, s = 1; for (let i = 0; i < 120; i++) { if (i % 8 === 0) s = -s; step(W, 1 / 60, { mx: s }); if (W.player.turnT > 0) n++; }     // бот у прохода: ввод туда-сюда каждые 8 кадров
    ok(n <= Math.ceil(M.turn.t * 60) + 1, `дёрганье туда-сюда даёт упор снова и снова: ${n} кадров упора`); } }

// 4. перекат: путь как раньше, кривая — быстрый старт, мягкий конец; от частоты кадров не зависит
{ const roll = (on, dt) => { const W = mk(on), a = at(W); step(W, dt, { roll: true, mx: 1 }); let n = 0; while (W.player.state === 'roll' && n++ < 200) step(W, dt, { mx: 1 }); return dist(a, at(W)); };
  const a = roll(true, 1 / 60), b = roll(false, 1 / 60), lo = roll(true, 1 / 30), hi = roll(true, 1 / 120);
  ok(Math.abs(a - b) / b < .03, `путь переката изменился: ${a.toFixed(2)} / ${b.toFixed(2)} м`);
  ok(Math.abs(lo - hi) / hi < .06, `путь переката зависит от кадров: ${lo.toFixed(2)} (30 к/с) / ${hi.toFixed(2)} (120 к/с)`);
  ok(rollK(M.roll, 0) > 1.25 && Math.abs(rollK(M.roll, 1) - M.roll.lo) < 1e-9, 'кривая переката: старт не быстрее прежнего или конец не lo');
  let s = 0; for (let i = 0; i < 1000; i++) s += rollK(M.roll, (i + .5) / 1000); ok(Math.abs(s / 1000 - M.roll.avg) < 1e-3, 'средняя скорость переката не avg');
  const W = mk(); step(W, 1 / 60, { roll: true, mx: 1 }); while (W.player.state === 'roll') step(W, 1 / 60, { mx: 1 });
  ok(Math.abs(spd(W) - P.rollSpeed * M.roll.lo * M.rollCarry) < .6, `после переката скорость ${spd(W).toFixed(2)}, ждали ≈${(P.rollSpeed * M.roll.lo * M.rollCarry).toFixed(2)}`); }

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Физика боя 3D (движение): OK');
