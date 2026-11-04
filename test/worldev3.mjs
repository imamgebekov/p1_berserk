// Мировые события: вторжение, бродячий мини-босс, дракон; награда рядом стоящим; боты приходят и справляются без героя; свой поток случайных чисел
import { createWorld, step, mulberry32 } from '../3d/src/sim.js';
import { CFG3 } from '../3d/src/config3d.js';
import { wevTick, activeEvents } from '../3d/src/worldev3.js';
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('✗', m); } };
const mk = seed => { const W = createWorld(CFG3, mulberry32(seed)); W.wantBots = true; W.player.maxhp = W.player.hp = 1e9; step(W, 1 / 30, {}); return W; };
const K = CFG3.worldEv;
// без ботов событий нет
{ const W = createWorld(CFG3, mulberry32(2)); for (let i = 0; i < 100; i++) step(W, 1 / 30, {}); ok(!W.wev, 'события без ботов'); }
// старт по таймеру, каждый вид отдельно
for (const kind of ['invasion', 'roamer', 'dragon']) {
  const W = mk(3); const k = Object.fromEntries(Object.keys(K.kinds).map(n => [n, n === kind ? 1 : 0])); W.cfg = { ...W.cfg, worldEv: { ...K, kinds: k, first: [1, 1] } };
  W.ev.length = 0; for (let i = 0; i < 90; i++) step(W, 1 / 30, {});
  const ev = activeEvents(W)[0]; ok(ev && ev.kind === kind, `${kind}: не началось`); if (!ev) continue;
  ok(W.ev.some(v => v.k === 'wevStart') && ev.place && ev.name && ev.foes.length >= 1, `${kind}: нет оповещения, места или врагов`);
  const fs = ev.foes.map(id => W.enemies.find(e => e.id === id)); ok(fs.every(e => e && e.wev === ev.id), `${kind}: враги не помечены`);
  if (kind === 'dragon') ok(fs[0].type === 'drake' && fs[0].chief === 'Пепельный дракон' && fs[0].maxhp > 3000, 'дракон не тот'); if (kind === 'roamer') ok(fs.length === 1 && fs[0].chief && fs[0].mode === 'patrol' && fs[0].route.length >= 3, 'бродячий без маршрута или звания');
  if (kind === 'invasion') ok(fs.length >= K.invasion.n[0] && fs.some(e => e.chief), 'вторжение: мало врагов или нет предводителя');
  ok(ev.bots.length >= 1 && W.bots.filter(a => a.wevId === ev.id).length === ev.bots.length, `${kind}: боты не пришли`);
}
// победа героя: награда рядом стоящему и ботам; без героя — только ботам
{ const W = mk(4); W.cfg = { ...W.cfg, worldEv: { ...K, kinds: { invasion: 1, roamer: 0, dragon: 0 }, first: [1, 1] } }; for (let i = 0; i < 60; i++) step(W, 1 / 30, {}); const ev = activeEvents(W)[0]; ok(!!ev, 'нет вторжения');
  W.player.x = ev.x + 5; W.player.z = ev.z; const ash0 = W.inv.ash, d0 = W.drops.length, bot = W.bots.find(a => a.wevId === ev.id); bot.x = ev.x + 3; bot.z = ev.z + 3; const k0 = bot.kills; W.ev.length = 0;
  for (const id of ev.foes) { const e = W.enemies.find(q => q.id === id); if (e) { e.dead = true; e.hp = 0; } } step(W, 1 / 30, {});
  ok(activeEvents(W).length === 0 && W.ev.some(v => v.k === 'wevDone' && v.hero), 'победа не засчитана'); ok(W.inv.ash > ash0 && W.drops.length > d0, 'герой рядом без награды'); ok(bot.kills > k0 && !bot.wevId && bot.home === bot.home0 === false, 'бот без счёта или не вернулся домой'); }
{ const W = mk(5); W.cfg = { ...W.cfg, worldEv: { ...K, kinds: { invasion: 1, roamer: 0, dragon: 0 }, first: [1, 1] } }; for (let i = 0; i < 60; i++) step(W, 1 / 30, {}); const ev = activeEvents(W)[0];
  W.player.x = ev.x + 400; W.player.z = ev.z; for (const a of W.bots) if (a.wevId === ev.id) { a.x = ev.x + 4; a.z = ev.z; a.near = false; }
  const ash0 = W.inv.ash; let t = 0; for (; t < 300 && activeEvents(W).length; t++) { for (const a of W.bots) if (a.wevId === ev.id) { a.x = ev.x + 4; a.z = ev.z; a.dead = false; } wevTick(W, 1); }
  ok(!activeEvents(W).length && W.ev.some(v => v.k === 'wevDone' && v.by === 'bots' && !v.hero) && W.inv.ash === ash0, `боты не справились сами за ${t} с или герою дали награду`); }
// дракона боты не одолеют: время выходит, дракон улетает
{ const W = mk(6); W.cfg = { ...W.cfg, worldEv: { ...K, kinds: { invasion: 0, roamer: 0, dragon: 1 }, first: [1, 1], every: [1e6, 1e6] } }; for (let i = 0; i < 60; i++) step(W, 1 / 30, {}); const ev = activeEvents(W)[0]; ok(!!ev, 'нет дракона'); W.player.x = ev.x + 500; W.player.z = ev.z;
  for (let t = 0; t < K.dragon.time + 5 && activeEvents(W).length; t += 5) wevTick(W, 5); ok(!activeEvents(W).length && W.ev.some(v => v.k === 'wevFail') && !W.enemies.some(e => e.type === 'drake'), 'дракон не улетел'); }
// предел одновременных, не в подземелье
{ const W = mk(7); W.cfg = { ...W.cfg, worldEv: { ...K, first: [1, 1], every: [1, 1], max: 2 } }; for (let i = 0; i < 400; i++) step(W, 1 / 30, {}); ok(activeEvents(W).length <= 2, 'событий больше max'); }
// потоки боя и ботов не сдвигаются
{ const A = mk(8), B = mk(8); B.cfg = { ...B.cfg, worldEv: { ...K, first: [1, 1] } }; for (let i = 0; i < 90; i++) { step(A, 1 / 30, {}); step(B, 1 / 30, {}); } ok(activeEvents(B).length >= 1, 'у B нет события'); ok(A.rng() === B.rng(), 'события сдвинули поток боя'); }
if (bad) { console.log('Мировые события 3D: упало', bad); process.exit(1); } console.log('Мировые события 3D: OK');
