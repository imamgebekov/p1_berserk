// Приёмы «числовых» врагов (этап 2 «круче»): каждый из 10 видов делает своё — прыжок до героя без перелёта, удар по земле
// и плевок (подсветка на земле с задержкой), вой (стая быстрее), притягивание, каменная кожа, «сквозь тьму», засада за спину.
// Помощники босса и выключатель enemies.moves — без приёмов (выключено = прежний бой).
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnEnemy } from '../3d/src/sim.js';

const fail = []; const ok = (c, m) => { if (!c) fail.push(m); };
const mk = (moves = true) => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.moves = moves; c.events.on = false; c.wanderer.on = false; c.bosses.list = []; c.enemies.count = 0; c.enemies.roam.on = false; c.enemies.posts.range = 0;
  const W = createWorld(c, mulberry32(5)); W.enemies.length = 0; const p = W.player; p.x = 230; p.z = 0; p.maxhp = p.hp = 1e6; return W; };
const put = (W, t, d) => { const e = spawnEnemy(W, t, W.player.x + d, W.player.z); e.alert = true; e.mcd = 0; return e; };
const run = (W, s, f) => { for (let i = 0; i < s * 60; i++) { W.player.hp = W.player.maxhp; step(W, 1 / 60, {}); if (f && f()) return true; } return false; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

for (const t of ['imp', 'brute', 'hound', 'ghoul', 'drowned', 'golem', 'blackdog', 'eclipse_fiend', 'war_ghost', 'demon_guard']) ok(CFG3.enemies[t].ai === 'move' && CFG3.enemies[t].move && CFG3.enemies[t].move.kind, `у «${t}» нет своего приёма`);
// удар по земле: подсветка вокруг рогача; выключено — нет
{ const W = mk(), e = put(W, 'brute', 1.5); ok(run(W, 1, () => W.haz.some(h => h.mv && h.by === e.id && dist(h, e) < .1)), 'рогач не бьёт по земле'); const h = W.haz.find(h => h.by === e.id); ok(h && h.r === CFG3.enemies.brute.move.r && h.delay > 0, 'удар по земле без радиуса или задержки'); }
{ const W = mk(false), e = put(W, 'brute', 1.5); ok(!run(W, 2, () => W.haz.some(h => h.by === e.id)), 'выключено — рогач всё равно бьёт по земле'); }
// плевок: лужа под героем
{ const W = mk(), e = put(W, 'ghoul', 6); ok(run(W, 1, () => W.haz.some(h => h.mv && h.by === e.id)), 'упырь не плюёт'); const h = W.haz.find(h => h.by === e.id); ok(h && dist(h, W.player) < 1.5, 'лужа не под героем'); }
// прыжок-наскок: до героя, без перелёта
{ const W = mk(), e = put(W, 'imp', 5.5); let aimed = false; ok(run(W, 2, () => { if (e.state === 'aim') aimed = true; return aimed && e.state === 'rec'; }), 'бес не прыгает'); ok(dist(e, W.player) < 2.2, `бес перелетел героя: ${dist(e, W.player).toFixed(1)} м`); }
// вой: вся стая рядом быстрее
{ const W = mk(), a = put(W, 'hound', 6), b = put(W, 'hound', 8); b.mcd = 99; run(W, .2); ok(a.hasteT > 0 && b.hasteT > 0 && b.haste > 1, 'вой не ускорил стаю'); }
// притягивание: героя тянет к утопленнику
{ const W = mk(), e = put(W, 'drowned', 5); const d0 = dist(e, W.player); let pulled = false; run(W, 2, () => { if (W.ev.some(v => v.k === 'pull')) pulled = true; return pulled; }); run(W, .3); ok(pulled && dist(e, W.player) < d0 - .5, `не тянет: было ${d0.toFixed(1)}, стало ${dist(e, W.player).toFixed(1)}`); }
// каменная кожа: на половине здоровья, урон вдвое меньше
{ const W = mk(), e = put(W, 'golem', 6); e.hp = e.maxhp * .4; run(W, .2); ok(e.skinT > 0, 'нет каменной кожи на половине здоровья'); const h0 = e.hp; W.fx.deal(e, 100); ok(Math.abs((h0 - e.hp) - 100 * CFG3.enemies.golem.move.mul) < 2, `кожа не режет урон: −${(h0 - e.hp).toFixed(0)}`); }
// «сквозь тьму»: почти неуязвим и быстрее
{ const W = mk(), e = put(W, 'war_ghost', 8); run(W, .2); ok(e.phaseT > 0 && e.hasteT > 0, 'призрак не уходит во тьму'); const h0 = e.hp; W.fx.deal(e, 100); ok(h0 - e.hp <= 100 * CFG3.enemies.war_ghost.move.mul + 1, 'во тьме урон проходит'); }
// засада: чёрный пёс за спиной
{ const W = mk(), e = put(W, 'blackdog', 8); W.player.face = 0; ok(run(W, 1, () => W.ev.some(v => v.k === 'blink')), 'пёс не прыгает в засаду'); ok(dist(e, W.player) < 2.5, 'засада не у героя'); }
// помощник босса — без приёмов
{ const W = mk(), e = put(W, 'brute', 1.5); e.minion = true; ok(!run(W, 2, () => W.haz.some(h => h.by === e.id)), 'помощник босса бьёт по земле'); }
// элита (этап 2 «круче»): новые свойства выпадают, глубоко — второе свойство; ледяной замедляет героя, зеркальный возвращает урон,
// призыватель на половине здоровья зовёт беса, блуждающий прыгает к герою
{ const { rollElite, eliteOnHit, eliteTick } = await import('../3d/src/foes3d.js'); const W = mk(); W.cfg.elite.chance = 1; const seen = new Set();
  for (let i = 0; i < 200; i++) { const e = spawnEnemy(W, 'imp', 400, 400); e.elite = false; delete e.aff; delete e.aff2; rollElite(W, e, .2, 0); seen.add(e.aff); e.dead = true; }
  ok(['frost', 'mirror', 'blink', 'summoner'].every(k => seen.has(k)), 'новые свойства элиты не выпадают: ' + [...seen]);
  const deep = spawnEnemy(W, 'brute', 400, 410); deep.elite = false; delete deep.aff; rollElite(W, deep, 1.8, 0); ok(deep.aff2 && deep.aff2 !== deep.aff && / и /.test(deep.affName), 'глубоко нет второго свойства: ' + deep.affName);
  const off = mk(); off.cfg.elite.chance = 1; off.cfg.elite.extra = false; const o = spawnEnemy(off, 'imp', 400, 400); o.elite = false; delete o.aff; rollElite(off, o, 1.8, 0); ok(!o.aff2 && Object.keys(CFG3.elite.affixes).includes(o.aff), 'выключено — новые свойства есть');
  const f = put(W, 'imp', 2); f.elite = true; f.aff = 'frost'; eliteOnHit(W, f, 5); ok(W.chillT > 0, 'ледяной не замедлил героя');
  const m = put(W, 'imp', 1.2); m.elite = true; m.aff = 'mirror'; m.hp = m.maxhp = 1e5; const h0 = W.player.hp; W.player.face = Math.PI / 2; for (let i = 0; i < 90; i++) step(W, 1 / 60, { attackPress: i % 20 === 0, aimPt: { x: m.x, z: m.z } }); ok(W.ev.some(v => v.k === 'mirror') || W.player.hp < h0, 'зеркальный не вернул урон');
  const s = put(W, 'brute', 6); s.elite = true; s.aff = 'summoner'; s.hp = s.maxhp * .4; const n0 = W.enemies.filter(x => !x.dead).length; eliteTick(W, s, 1 / 60); ok(W.enemies.filter(x => !x.dead).length === n0 + CFG3.elite.affixes2.summoner.n && W.enemies.some(x => x.minion && !x.dead), 'призыватель не позвал подмогу');
  const b = put(W, 'imp', 9); b.elite = true; b.aff = 'blink'; b.ebcd = 0; b.state = 'chase'; eliteTick(W, b, 1 / 60); ok(dist(b, W.player) < 3, 'блуждающий не прыгнул к герою'); }
// босс (этап 2 «круче»): на первой фазе — новый приём, которого не было; выключено — нет
{ const { phaseMove } = await import('../3d/src/boss3d.js'); const dev = CFG3.bosses.list.find(b => b.type === 'devourer'), a = phaseMove(dev, CFG3.bosses.phaseMoves);
  ok(a && !dev.attacks.some(x => x.kind === a.kind) && a.mv, 'Пожиратель не получает новый приём: ' + (a && a.kind));
  const all = CFG3.bosses.list.map(d => phaseMove(d, CFG3.bosses.phaseMoves)).filter(Boolean); ok(all.length >= CFG3.bosses.list.length * .8, `новый приём есть у ${all.length} из ${CFG3.bosses.list.length} боссов`);
  const { spawnBoss } = await import('../3d/src/sim.js'); const W = mk(); W.cfg.bosses.list = [dev]; const e = spawnBoss(W, dev); W.player.x = e.x + 3; W.player.z = e.z; e.alert = true; e.hp = e.maxhp * .6; run(W, .1);
  ok(e.b.extra.length === 1 && e.b.extra[0].kind === a.kind && W.ev.some(v => v.k === 'bossphase' && /новый приём/.test(v.what)) || e.b.newMove === a.kind, 'босс не взял новый приём на фазе');
  const W2 = mk(); W2.cfg.bosses.phaseMoves = null; W2.cfg.bosses.list = [dev]; const e2 = spawnBoss(W2, dev); W2.player.x = e2.x + 3; W2.player.z = e2.z; e2.alert = true; e2.hp = e2.maxhp * .6; run(W2, .1); ok(!e2.b.extra.length, 'выключено — новый приём есть'); }
if (fail.length) { console.log('ПРОВАЛ:\n' + fail.join('\n')); process.exit(1); }
console.log('Приёмы врагов 3D: OK');
