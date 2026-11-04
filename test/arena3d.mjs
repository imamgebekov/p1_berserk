// Арена: дуэль с ботом — условия вызова, ставка, победа и поражение, рейтинг Эло, герой не гибнет, побег, сохранение, потоки не сдвигаются
import { createWorld, step, mulberry32 } from '../3d/src/sim.js';
import { CFG3 } from '../3d/src/config3d.js';
import { arenaOf, botRating, startDuel, duelBlock, arenaTick, leaderboard, placeOf, winChance, serializeArena, sanitizeArena, dueling } from '../3d/src/arena3d.js';
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('✗', m); } };
const K = CFG3.arena;
const mk = seed => { const W = createWorld(CFG3, mulberry32(seed)); W.wantBots = true; W.player.maxhp = W.player.hp = 500; step(W, 1 / 30, {}); W.enemies.length = 0; const a = W.bots.filter(b => !b.dead).sort((u, v) => u.lv - v.lv)[0]; a.x = W.player.x + 1.5; a.z = W.player.z; W.player.z = a.z; W.inv.ash = 5000; return { W, a }; };
// у каждого героя есть боец с типом боя
for (const h of Object.keys(CFG3.actors.heroes)) { const e = CFG3.enemies['arena_' + h]; ok(e && e.hp > 0 && e.damage > 0 && CFG3.actors.foes['arena_' + h] === CFG3.actors.heroes[h], 'нет дуэлянта ' + h); }
{ const { W, a } = mk(3);
  ok(duelBlock(W, a, 7) === 'bet', 'левая ставка принята'); ok(duelBlock(W, a, 1e9) === 'bet' || duelBlock(W, a, 1e9) === 'ash', 'огромная ставка');
  W.inv.ash = 10; ok(duelBlock(W, a, 200) === 'ash', 'ставка без пепла'); W.inv.ash = 5000;
  a.x += 30; ok(duelBlock(W, a, 50) === 'far', 'вызов издали'); a.x -= 30;
  W.enemies.push({ id: 9999, x: W.player.x + 5, z: W.player.z, dead: false, alert: true }); ok(duelBlock(W, a, 50) === 'danger', 'вызов при врагах'); W.enemies.length = 0;
  a.dead = true; ok(duelBlock(W, a, 50) !== null, 'вызов павшего'); a.dead = false; const lvl = W.lvl; W.lvl = 'inst_brod'; ok(duelBlock(W, a, 50) === 'place', 'вызов в подземелье'); W.lvl = lvl;
  const ash0 = W.inv.ash; W.ev.length = 0; ok(startDuel(W, a, 200) === 'ok' && W.inv.ash === ash0 - 200 && dueling(W) && W.duelOn && a.arena, 'дуэль не началась');
  const e = W.enemies.find(q => q.duel); ok(e && e.type === 'arena_' + a.hero && e.nick === a.name && e.hp > 0 && e.noLoot && W.ev.some(v => v.k === 'arenaStart'), 'противник не создан');
  ok(startDuel(W, a, 50) === 'busy', 'вторая дуэль разом'); ok(!W.allies.includes(a), 'бот-противник остался в союзниках');
  // победа
  const r0 = arenaOf(W).rating, ash1 = W.inv.ash; e.hp = 0; e.dead = true; W.ev.length = 0; arenaTick(W, .1);
  const end = W.ev.find(v => v.k === 'arenaEnd'); ok(end && end.win && arenaOf(W).wins === 1 && arenaOf(W).rating > r0 && W.inv.ash > ash1 + 400 && !dueling(W) && !W.duelOn && !a.arena && a.duelCd > W.t, 'победа не засчитана');
  ok(duelBlock(W, a, 50) === 'rest', 'бот не отдыхает после боя'); }
// поражение: герой на 1 здоровья
{ const { W, a } = mk(4); startDuel(W, a, 50); W.player.hp = 1; W.ev.length = 0; arenaTick(W, .1); const end = W.ev.find(v => v.k === 'arenaEnd'); ok(end && !end.win && arenaOf(W).losses === 1 && arenaOf(W).rating < 1000 && W.player.hp >= 1 && !W.enemies.some(q => q.duel), 'поражение не засчитано');
  ok(W.player.hp === Math.round(W.player.maxhp * K.loseHp), 'здоровье после поражения'); }
// побег и время
{ const { W, a } = mk(5); startDuel(W, a, 0); W.player.x += K.leash + 5; W.ev.length = 0; arenaTick(W, .1); ok(W.ev.some(v => v.k === 'arenaEnd' && !v.win && v.why === 'fled'), 'побег не засчитан');
  const q = mk(6); startDuel(q.W, q.a, 0); arenaTick(q.W, K.time + 1); ok(q.W.ev.some(v => v.k === 'arenaEnd' && v.why === 'time'), 'время не вышло'); }
// настоящий бой в симуляции: герой не гибнет, бой кончается
{ const { W, a } = mk(7); startDuel(W, a, 0); W.player.hp = W.player.maxhp = 40; let t = 0; for (; t < 120 && dueling(W); t += 1 / 30) step(W, 1 / 30, {}); ok(!W.player.dead && !dueling(W), `дуэль не кончилась или герой пал (${t.toFixed(0)} с)`); ok(arenaOf(W).losses + arenaOf(W).wins === 1, 'исход не записан'); }
// рейтинг, лидеры, шанс
{ const { W } = mk(8); const lb = leaderboard(W, 50); ok(lb.length === W.bots.length + 1 && lb.every((r, i) => !i || lb[i - 1].rating >= r.rating) && lb.some(r => r.me), 'таблица лидеров'); ok(placeOf(W) >= 1 && placeOf(W) <= W.bots.length + 1, 'место');
  const hi = W.bots.slice().sort((u, v) => v.lv - u.lv)[0], lo = W.bots.slice().sort((u, v) => u.lv - v.lv)[0]; ok(botRating(W, hi) > botRating(W, lo) && winChance(W, lo) > winChance(W, hi), 'рейтинг не по уровню'); }
// сохранение
{ const { W } = mk(9); const S = arenaOf(W); S.rating = 1234; S.wins = 5; S.losses = 2; S.streak = 3; S.best = 1300; const back = sanitizeArena(JSON.parse(JSON.stringify(serializeArena(W)))); ok(back.rating === 1234 && back.wins === 5 && back.best === 1300 && !back.duel, 'арена не сохранилась');
  const junk = sanitizeArena({ rating: 'x', wins: -5, losses: 1e12, streak: NaN, best: 99999 }); ok(junk.rating === 1000 && junk.wins === 0 && junk.losses === 1e6 && junk.best === 4000, 'мусор в арене'); ok(sanitizeArena(null).rating === 1000, 'пустое'); }
// потоки боя и ботов не сдвигаются от вызова/исхода
{ const A = mk(10), B = mk(10); startDuel(B.W, B.a, 50); B.W.player.hp = 1; arenaTick(B.W, .1); ok(A.W.rng() === B.W.rng() && A.W.brng() === B.W.brng(), 'дуэль сдвинула потоки'); }
if (bad) { console.log('Арена 3D: упало', bad); process.exit(1); } console.log('Арена 3D: OK');
