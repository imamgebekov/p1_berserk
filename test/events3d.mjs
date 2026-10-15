// Тест случайных событий 3D (шаг A5): помощь в беде, засада, обоз. Событие стартует по таймеру и только к месту,
// враги появляются вовремя и встревожены, цели засчитываются, провал при гибели подопечного, награда выдаётся один раз;
// подопечный не входит в отряд, сохранение и переходы; в подземелье и после гибели героя событие пропадает.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, travel, killEnemy, hireAlly, liveAllies } from '../3d/src/sim.js';
import { eventLine } from '../3d/src/events3d.js';
import { createSaver } from '../3d/src/save3d.js';
import { insideCamp, placeAt, insideOf } from '../3d/src/map.js';
import { distSeg as distSegT } from '../3d/src/world3d.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const clone = () => JSON.parse(JSON.stringify(CFG3));
const E = CFG3.events;
const mk = (kind, seed = 1, tweak) => {
  const c = clone(); c.enemies.count = 0; c.wanderer.on = false; c.events.kinds = { [kind]: 1 }; c.events.first = [5, 5];
  for (const d of c.dungeons.list) d.spawns = []; if (tweak) tweak(c);
  const W = createWorld(c, mulberry32(seed)); W.player.inv = 1e9; return W;
};
const evs = [];
const run = (W, sec, input = {}) => { for (let i = 0; i < Math.round(sec * 60); i++) { step(W, 1 / 60, typeof input === 'function' ? input(i) : input); for (const v of W.ev) if (/^ev/.test(v.k)) evs.push(v); W.ev.length = 0; } };
const until = (W, k, sec, input) => { const n = evs.length; for (let i = 0; i < sec * 60; i++) { run(W, 1 / 60, input); if (evs.slice(n).some(v => v.k === k)) return evs.slice(n).find(v => v.k === k); } return null; };
const guest = W => W.event && W.allies.find(a => a.id === W.event.guest);
const foes = W => W.enemies.filter(e => !e.dead && e.evId && W.event && e.evId === W.event.id);
const killAll = W => { for (const e of foes(W)) killEnemy(W, e, 1); };
const mem = () => { const o = {}; return { getItem: k => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); }, removeItem: k => { delete o[k]; }, o }; };
const roadMid = W => { for (const [a, b] of W.map.roads) for (let t = .2; t <= .9; t += .1) { const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, pl = placeAt(W.map, x, z); if (!insideCamp(W.map.camp, x, z, -E.ambush.campPad - 2) && !(pl && pl.safe) && insideOf(W.map, x, z) < 0) return { x, z }; } throw new Error('нет точки на дороге вне поселений'); };

// ---------- 1. помощь в беде: путник ждёт, враги приходят при герое, спасли — награда один раз ----------
{
  const W = mk('rescue', 2), st = until(W, 'evStart', 7);
  const g = guest(W);
  ok(st && st.kind === 'rescue' && g && g.guest && !foes(W).length, 'путник не появился или враги пришли раньше героя');
  const d = g && Math.hypot(g.x - W.player.x, g.z - W.player.z);
  ok(d >= E.rescue.dist[0] && d <= E.rescue.dist[1] && !placeAt(W.map, g.x, g.z), `путник в ${d && d.toFixed(0)} м или в поселении`);
  ok(/Крик о помощи/.test(eventLine(W)), 'нет строки события');
  ok(liveAllies(W).length === 0, 'путник считается бойцом отряда');
  // сохранение не пишет путника
  const st2 = mem(); createSaver(W, st2).write(true); ok(Object.values(st2.o).length && Object.values(st2.o).every(v => !/"guest"|Путник/.test(v)), 'путник попал в сохранение');
  // герой подходит — враги появляются встревоженными и бьют путника
  W.player.x = g.x + E.rescue.wake - 3; W.player.z = g.z;
  ok(until(W, 'evFight', 1), 'враги не появились при подходе героя');
  const n = foes(W).length; ok(n >= E.foes.rescue.n[0] && foes(W).every(e => e.alert), `врагов ${n}, все ли встревожены`);
  const hp0 = g.hp; run(W, 3); ok(g.hp < hp0, 'враги не нападают на путника');
  const ash0 = W.inv.ash, drops0 = W.drops.length; killAll(W);
  const done = until(W, 'evDone', 1);
  ok(done && done.ash > 0 && W.inv.ash === ash0 + done.ash && W.drops.length > drops0, 'награда за спасение не выдана');
  ok(W.buffs.some(b => b.src === 'event' && b.stat === 'luck'), 'нет благодарности путника');
  ok(!W.event && W.evT >= E.every[0] && W.evT <= E.every[1], 'событие не закрылось или таймер не по окну');
  const ash1 = W.inv.ash; run(W, 2); ok(W.inv.ash === ash1 && evs.filter(v => v.k === 'evDone').length === 1, 'награда выдана дважды');
  run(W, E.rescue.thanks + 1); ok(!W.allies.some(a => a.guest), 'путник не ушёл после благодарности');
}
// путник всегда вне поселений и опасных мест
{
  let n = 0, bad = 0;
  for (let s = 30; s < 45; s++) { const W = mk('rescue', s); W.player.x = (s % 5 - 2) * 12; W.player.z = 40 - (s % 3) * 30; run(W, 6); const g = guest(W); if (!g) continue; n++; if (placeAt(W.map, g.x, g.z) || insideOf(W.map, g.x, g.z) >= 0) bad++; }
  ok(n >= 10 && bad === 0, `путников ${n}, в поселениях и домах ${bad}`);
}
// ---------- 2. путник погиб — провал без награды; не дождался — исчезает ----------
{
  const W = mk('rescue', 3); until(W, 'evStart', 7); const g = guest(W);
  W.player.x = g.x + E.rescue.wake - 3; W.player.z = g.z; until(W, 'evFight', 1);
  const ash0 = W.inv.ash; g.hp = 1;
  const f = until(W, 'evFail', 30); ok(f && f.why === 'dead' && W.inv.ash === ash0 && !W.event, 'гибель путника — не провал или с наградой');
  const W2 = mk('rescue', 4); until(W2, 'evStart', 7);
  const f2 = until(W2, 'evFail', E.rescue.wait + 2); ok(f2 && f2.why === 'late' && !W2.allies.some(a => a.guest), 'неспасённый путник не исчез по времени');
}
// ---------- 3. засада: только на дороге вне лагеря; враги впереди; убежал — конец без награды ----------
{
  const W = mk('ambush', 5); run(W, 8);
  ok(!W.event, 'засада в лагере');
  // у самого частокола (снаружи, на дороге) и вдали от дорог — засады нет
  { const C = W.map.camp, r = C.r + E.ambush.campPad - 3; let at = null;
    for (const [a, b] of W.map.roads) for (let t = 0; t <= 1 && !at; t += .02) { const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, d = Math.hypot(x - C.x, z - C.z), pl = placeAt(W.map, x, z); if (Math.abs(d - r) < .6 && !(pl && pl.safe) && insideOf(W.map, x, z) < 0) at = { x, z }; }
    ok(at, 'нет точки у частокола'); if (at) { W.player.x = at.x; W.player.z = at.z; run(W, E.retry + 2); ok(!W.event, 'засада у самого частокола'); } }
  { let off = null; for (let k = 0; k < 400 && !off; k++) { const a = k * 2.39996, d = 45 + (k % 30); const x = Math.sin(a) * d, z = Math.cos(a) * d, pl = placeAt(W.map, x, z); if (!(pl && pl.safe) && insideOf(W.map, x, z) < 0 && !W.map.roads.some(([p, q]) => distSegT(x, z, p, q) < 12)) off = { x, z }; }
    ok(off, 'нет точки вдали от дорог'); if (off) { W.player.x = off.x; W.player.z = off.z; run(W, E.retry + 2); ok(!W.event, 'засада вдали от дороги'); } }
  const m = roadMid(W); W.player.x = m.x; W.player.z = m.z; W.player.face = 0;
  const st = until(W, 'evStart', E.retry + 2); ok(st && st.kind === 'ambush', 'засады на дороге нет');
  const fs = foes(W); ok(fs.length >= E.foes.ambush.n[0] && fs.every(e => { const d = Math.hypot(e.x - m.x, e.z - m.z); return e.alert && d >= E.ambush.r[0] - .5 && d <= E.ambush.r[1] + 1.5; }), 'враги засады не там или не встревожены');
  ok(fs.every(e => !insideCamp(W.map.camp, e.x, e.z)), 'враги засады в лагере');
  const ash0 = W.inv.ash; killAll(W); const d = until(W, 'evDone', 1); ok(d && W.inv.ash > ash0, 'за засаду нет награды');
  const W2 = mk('ambush', 6); const m2 = roadMid(W2); W2.player.x = m2.x; W2.player.z = m2.z; until(W2, 'evStart', 7);
  W2.player.x = 0; W2.player.z = 4; const f = until(W2, 'evFail', 1); ok(f && f.why === 'fled', 'засада не кончилась, когда герой убежал');
}
// ---------- 4. обоз: ждёт, едет только при герое, налёты, дошёл — награда; разбит — провал ----------
{
  const W = mk('caravan', 7); const st = until(W, 'evStart', 7), g = guest(W), ev = W.event;
  ok(st && g && g.cart && ev.place, 'обоз не появился');
  const q = ev.path[1]; ok(!insideCamp(W.map.camp, g.x, g.z) && placeAt(W.map, q.x, q.z).safe, 'обоз не за воротами или едет не в поселение');
  const x0 = g.x; run(W, 3); ok(g.x === x0 && ev.stage === 'wait', 'обоз тронулся без героя');
  const near = () => { W.player.x = g.x - Math.sin(g.face) * 3; W.player.z = g.z - Math.cos(g.face) * 3; };
  near(); run(W, .2); ok(ev.stage === 'move', 'обоз не тронулся при герое');
  run(W, 2, () => { near(); return {}; }); const w1 = ev.went; ok(w1 > 2, 'обоз не едет');
  W.player.x = g.x + 30; run(W, 2); ok(Math.abs(ev.went - w1) < .2, 'обоз уехал без героя');
  let raids = 0; const ash0 = W.inv.ash;
  for (let i = 0; i < 60 * 120 && W.event; i++) { near(); run(W, 1 / 60); killAll(W); raids = evs.filter(v => v.k === 'evRaid').length; }
  const done = evs.find(v => v.k === 'evDone' && v.kind === 'caravan');
  ok(raids === E.caravan.waves.length, `налётов ${raids}, а не ${E.caravan.waves.length}`);
  ok(done && W.inv.ash > ash0 && !W.allies.some(a => a.guest), 'обоз дошёл без награды или остался');
  const W2 = mk('caravan', 8); until(W2, 'evStart', 7); guest(W2).hp = 0; guest(W2).dead = true;
  const f = until(W2, 'evFail', 1); ok(f && f.why === 'dead', 'разбитый обоз — не провал');
}
// ---------- 5. подземелье и гибель героя: не стартует, пропадает; подопечный не идёт вниз ----------
{
  const W = mk('rescue', 9), D = CFG3.dungeons.list[0]; travel(W, D.id, D.entry.x, D.entry.z);
  run(W, 8); ok(!W.event, 'событие стартовало в подземелье');
  travel(W, 'surface', 0, 4); until(W, 'evStart', E.retry + 2); ok(W.event, 'после подъёма событие не стартовало');
  const g = guest(W), gx = g.x; travel(W, D.id, D.entry.x, D.entry.z);
  ok(g.x === gx, 'путник ушёл вниз вместе с героем'); const f = until(W, 'evFail', 1);
  ok(f && f.why === 'gone' && !W.event && !W.allies.some(a => a.guest), 'событие не пропало при спуске');
  const W2 = mk('ambush', 10); const m = roadMid(W2); W2.player.x = m.x; W2.player.z = m.z; until(W2, 'evStart', 7);
  const ash0 = W2.inv.ash; W2.player.dead = true; const f2 = until(W2, 'evFail', 1); ok(f2 && f2.why === 'gone' && W2.inv.ash === ash0, 'гибель героя дала награду или не закрыла событие');
}
// ---------- 6. наём не считает подопечного, events.on: false — событий нет ----------
{
  const W = mk('caravan', 11); until(W, 'evStart', 7); W.inv.ash = 1e6;
  const cap = W.map.buildings.find(b => b.npc && b.npc.kind === 'captain').npc; W.player.x = cap.x + 1; W.player.z = cap.z + 1; run(W, .1);
  ok(hireAlly(W, Object.keys(CFG3.squad.types)[0]) === 'ok' && liveAllies(W).length === 1, 'подопечный занял место в отряде');
  const W2 = mk('rescue', 12, c => { c.events.on = false; }); run(W2, 30); ok(!W2.event, 'при on: false событие стартовало');
}

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Случайные события 3D: OK');
