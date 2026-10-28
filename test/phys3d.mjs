// Физика боя (план физики, 2026-10-25), этап 1 — движение героя: разгон как раньше, торможение длиннее, резкий разворот
// придерживает скорость, путь переката как раньше и не зависит от частоты кадров; выключено (phys.move.on: false) — как раньше.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnEnemy, abilityHit, hurtPlayer, killEnemy } from '../3d/src/sim.js';
import { applyStatus } from '../3d/src/status3d.js';
import { rollK } from '../3d/src/phys3d.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const M = CFG3.phys.move, P = CFG3.player, K = CFG3.phys.knock;
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

// ---------- этап 2: отбрасывание с весом ----------
const foe = (W, type, x, z) => { const e = spawnEnemy(W, type, x, z); e.hp = e.maxhp = 1e5; e.cd = 99; e.vx = e.vz = 0; return e; };
const kick = (W, e) => { e.vx = e.vz = 0; const p = W.player; p.x = e.x; p.z = e.z - 1.5; abilityHit(W, e, .05, { knock: 1 }); return Math.hypot(e.vx, e.vz); };
const clear = W => { W.enemies.length = 0; W.ev.length = 0; };
// 5. обычные враги в среднем отлетают как раньше; крупные и тяжёлые — меньше; босс почти не сдвигается
{ const W = mk(), E = CFG3.enemies, norm = Object.keys(E).filter(t => E[t] && E[t].hp && !E[t].boss && !E[t].heavy && (E[t].scale || 1) <= 1.25);
  let a = 0, b = 0; for (const t of norm) { clear(W); W.cfg.phys.knock.on = true; a += kick(W, foe(W, t, home.x + 3, home.z + 3)); clear(W); W.cfg.phys.knock.on = false; b += kick(W, foe(W, t, home.x + 3, home.z + 3)); }
  W.cfg.phys.knock.on = true; ok(Math.abs(a / b - 1) < .1, `средний отлёт обычных врагов изменился: ${(a / norm.length).toFixed(2)} / ${(b / norm.length).toFixed(2)} м/с`);
  clear(W); const imp = kick(W, foe(W, 'imp', home.x + 3, home.z + 3)); clear(W); const brute = kick(W, foe(W, 'brute', home.x + 3, home.z + 3)); clear(W); const troll = kick(W, foe(W, 'troll', home.x + 3, home.z + 3));
  ok(imp > brute && brute > troll, `отлёт не по весу: бес ${imp.toFixed(2)}, рогач ${brute.toFixed(2)}, тролль ${troll.toFixed(2)}`);
  clear(W); const B = foe(W, 'devourer', home.x + 3, home.z + 3); B.boss = true; ok(kick(W, B) < 1, 'обычный удар заметно сдвигает босса'); }
// 6. стойкость босса: накопленный урон пробивает — сильный отлёт и событие poise
{ const W = mk(); clear(W); const B = foe(W, 'devourer', home.x + 3, home.z + 3); B.boss = true; B.maxhp = 400; let small = 0, big = 0, n = 0;
  for (let i = 0; i < 30 && !big; i++) { W.ev.length = 0; const v = kick(W, B); if (W.ev.some(q => q.k === 'poise')) big = v; else { small = Math.max(small, v); n++; } }
  ok(big > 0 && n > 0, `стойкость босса не пробивается (ударов ${n})`); ok(big > small * 4, `пробитая стойкость не отбрасывает: ${big.toFixed(2)} против ${small.toFixed(2)} м/с`); }
// 7. отлёт героя — по весу бьющего и героя; выключено — как раньше (5 м/с)
{ const W = mk(); clear(W); const hv = att => { const p = W.player; Object.assign(p, { x: home.x, z: home.z, vx: 0, vz: 0, inv: 0, state: 'idle' }); hurtPlayer(W, 1, p.x, p.z - 1, null, att); return Math.hypot(p.vx, p.vz); };
  const imp = foe(W, 'imp', home.x, home.z - 1), troll = foe(W, 'troll', home.x, home.z - 1);
  const vi = hv(imp), vt = hv(troll); W.cfg.phys.knock.on = false; const off = hv(imp); W.cfg.phys.knock.on = true;
  ok(vt > vi * 1.2, `тролль отбрасывает героя не сильнее беса: ${vt.toFixed(2)} / ${vi.toFixed(2)}`); ok(Math.abs(off - 5) < 1e-6, 'выключено — отлёт героя не 5 м/с');
  const H = W.hero; W.hero = 'thorn'; const vth = hv(imp); W.hero = H; ok(vth < vi || (K.hero.mass[H] || 1) >= K.hero.mass.thorn, `Торн не тяжелее: ${vth.toFixed(2)} / ${vi.toFixed(2)}`); }
// 8. отброшенный герой не «упирается», даже если игрок жмёт навстречу удару
{ const W = mk(); clear(W); const p = W.player; run(W, .6, { mz: -1 }); p.inv = 0; hurtPlayer(W, 1, p.x, p.z - 1, null, null); step(W, 1 / 60, { mz: -1 }); ok(!(p.turnT > 0), 'отлёт героя гасится упором разворота'); }
// 9. удар о стену: урон, оглушение, событие slam
{ const W = mk(); clear(W); let w = null; for (const b of W.map.buildings) { w = b.walls.find(q => q.x1 - q.x0 > 3 && q.z1 - q.z0 < 1); if (w) break; }
  ok(!!w, 'на карте нет стены для проверки');
  if (w) { const r = CFG3.enemies.imp.radius, e = foe(W, 'imp', (w.x0 + w.x1) / 2, w.z0 - r - .3); applyStatus(W, e, 'stun', 0, 5); const hp0 = e.hp; kick(W, e); const hp1 = e.hp;
    for (let i = 0; i < 20; i++) step(W, 1 / 60, {});
    ok(W.ev.some(q => q.k === 'slam') || e.slamCd > 0, 'удар о стену не замечен'); ok(e.hp < hp1, `удар о стену без урона (${hp0} → ${hp1} → ${e.hp})`); } }
// 10. толкнул соседа: тот получает свою скорость (от одного расталкивания — нет); третий скорости не получает (одно звено)
{ const push = on => { const W = mk(); clear(W); const C = W.cfg.phys.knock.chain, v0 = C.v; if (!on) C.v = 1e9; const x = home.x + 6, z = home.z + 6, a = foe(W, 'imp', x, z), b = foe(W, 'imp', x, z + 1.05), c = foe(W, 'imp', x, z + 3.2);
    for (const e of [a, b, c]) applyStatus(W, e, 'stun', 0, 5); kick(W, a); let cv = 0, bv = 0; for (let i = 0; i < 30; i++) { step(W, 1 / 60, {}); cv = Math.max(cv, Math.hypot(c.vx, c.vz)); bv = Math.max(bv, Math.hypot(b.vx, b.vz)); } C.v = v0; return { bv, cv }; };
  const on = push(true), off = push(false);
  ok(on.bv > 1.5 && off.bv < .1, `толчок соседа: скорость ${on.bv.toFixed(2)} м/с (без толчка ${off.bv.toFixed(2)})`); ok(on.cv < .5, `толчок передан дальше одного звена: третий ${on.cv.toFixed(2)} м/с`); }

// ---------- этап 3: тела ----------
const BD = CFG3.phys.body;
// 11. убивающий удар: тело скользит по удару и замирает, лицом к удару; добыча в теле едет с ним; через 0,6 с — в списке лежащих тел
{ const W = mk(); clear(W); W.bodies = []; W.corpses = []; const e = foe(W, 'imp', home.x + 4, home.z + 4), p = W.player; p.x = e.x; p.z = e.z - 1.5;
  e.hp = 1; abilityHit(W, e, 1, { knock: 1 }); ok(e.dead, 'бес не убит');
  const x0 = e.x, z0 = e.z; W.corpses.push({ id: 'c' + e.id, x: e.x, z: e.z, type: e.type, t: 0, life: 99, empty: 0, lvl: W.lvl }); W.drops.push({ id: 'ash', n: 1, x: e.x, z: e.z, corpse: 'c' + e.id });
  ok(Math.abs(Math.cos(e.face) + 1) < .05, `тело не лицом к удару: face ${e.face.toFixed(2)}`);
  for (let i = 0; i < 45; i++) step(W, 1 / 60, {});
  const moved = e.z - z0, c = W.corpses.find(q => q.id === 'c' + e.id), dr = W.drops.find(q => q.corpse === 'c' + e.id);
  ok(moved > .5 && Math.abs(e.x - x0) < .1, `тело не скользит по удару: ${moved.toFixed(2)} м`); ok(Math.hypot(e.vx, e.vz) < .3, `тело не замирает: ${Math.hypot(e.vx, e.vz).toFixed(2)} м/с`);
  ok(c && dr && Math.abs(c.z - e.z) < 1e-6 && Math.abs(dr.z - e.z) < 1e-6, 'добыча не едет с телом');
  for (let i = 0; i < 20; i++) step(W, 1 / 60, {});
  const b = W.bodies.find(q => q.id === e.id); ok(!!b && !W.enemies.includes(e), 'тело не попало в список лежащих');
  ok(b && Math.abs(b.z - e.z) < 1e-6 && b.cid === 'c' + e.id, 'лежащее тело не там, где замерло'); }
// 12. тело без добычи уходит через life с, с добычей — лежит; список не растёт больше keep
{ const W = mk(); clear(W); W.bodies = []; W.corpses = []; const kill = (x, z) => { const e = foe(W, 'imp', x, z); e.hp = 1; killEnemy(W, e, 0); return e; };
  const a = kill(home.x + 3, home.z), b = kill(home.x - 3, home.z); W.corpses.push({ id: 'c' + b.id, x: b.x, z: b.z, t: 0, life: 1e9, empty: 0, lvl: W.lvl }); W.drops.push({ id: 'ash', n: 1, x: b.x, z: b.z, corpse: 'c' + b.id });
  for (let i = 0; i < 60; i++) step(W, 1 / 60, {}); W.cfg.corpse.empty = 1e9;
  const n0 = W.bodies.length; for (const q of W.bodies) q.t = BD.life + 1; step(W, 1 / 60, {});
  ok(n0 === 2 && W.bodies.length === 1 && W.bodies[0].id === b.id, `тела не уходят по времени: было ${n0}, стало ${W.bodies.length}`); W.cfg.corpse.empty = CFG3.corpse.empty;
  W.bodies = []; for (let i = 0; i < BD.keep + 6; i++) kill(home.x + (i % 6) * 2, home.z + 8 + (i / 6 | 0) * 2); for (let i = 0; i < 60; i++) step(W, 1 / 60, {});
  ok(W.bodies.length === BD.keep, `лежащих тел ${W.bodies.length}, предел ${BD.keep}`); }

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Физика боя 3D (движение, отбрасывание, тела): OK');
