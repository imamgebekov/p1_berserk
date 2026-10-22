// Добыча с тел (4.21, просьба владельца — как в WoW): выпавшее с врага лежит в его теле, шаг рядом его не подбирает; окно добычи берёт
// одну вещь или всё; пустое тело исчезает через empty с; тело с добычей держится life с (босс — boss с), а пока рядом бой — таймер стоит;
// уйти с тела и вернуться — добыча на месте; on: false — вещи на землю, как раньше.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnEnemy, spawnBoss, killEnemy, corpseItems, lootCorpse } from '../3d/src/sim.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const C = CFG3.corpse;
const mk = (on = true) => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.map.places = []; c.events.on = false; c.wanderer.on = false; c.corpse.on = on; const W = createWorld(c, mulberry32(21)); W.player.hp = W.player.maxhp = 1e6; W.lv = 30; return W; };
const run = (W, sec, inp = {}) => { for (let i = 0; i < Math.round(sec * 60); i++) step(W, 1 / 60, inp); };
const kill = (W, type = 'brute') => { const p = W.player; for (let k = 0; k < 200; k++) { const e = spawnEnemy(W, type, p.x + 1.2, p.z); e.lvl = 30; killEnemy(W, e, 1); const c = (W.corpses || []).find(x => x.id === 'c' + e.id); if (c) return c; } return null; };

// 1. вещи — в теле, шаг не подбирает
{ const W = mk(), bag0 = W.inv.bag.length, c = kill(W);
  ok(c && corpseItems(W, c.id).length > 0, 'нет тела с добычей');
  if (c) { ok(W.drops.filter(q => q.corpse === c.id).every(q => q.x === c.x && q.z === c.z), 'вещи разлетелись от тела');
    run(W, 1.5); ok(corpseItems(W, c.id).length > 0 && W.inv.bag.length === bag0, 'вещи из тела подобрались шагом');
    run(W, .2); ok(W.nearCorpse && W.nearCorpse.id === c.id, 'рядом с телом нет «добычи»');
    const n = corpseItems(W, c.id).length, r1 = lootCorpse(W, c.id, 0); ok(r1.n === 1 && corpseItems(W, c.id).length === n - 1, 'одна вещь не взялась');
    const r = lootCorpse(W, c.id); ok(r.n === n - 1 && !corpseItems(W, c.id).length, 'не взялось всё');
    run(W, C.empty + .3); ok(!(W.corpses || []).some(x => x.id === c.id), 'пустое тело не исчезло'); } }
// 2. тело с добычей держится life с, в бою таймер стоит
{ const W = mk(), c = kill(W); if (c) {
    const e = spawnEnemy(W, 'imp', W.player.x + 6, W.player.z); e.alert = true; e.cd = 1e9; e.speed = 0; c.t = 0;
    for (let i = 0; i < 60 * 10; i++) { e.alert = true; e.x = W.player.x + 6; e.z = W.player.z; step(W, 1 / 60, {}); }
    ok(c.t < 1 && c.fight, 'в бою таймер тела идёт: ' + c.t.toFixed(1)); e.hp = 0; killEnemy(W, e, 1); for (const q of W.drops) if (q.corpse && q.corpse !== c.id) q.corpse = c.id;
    c.t = C.life - 1; run(W, 2); ok(!(W.corpses || []).some(x => x.id === c.id) && !W.drops.some(q => q.corpse === c.id), 'тело не исчезло через life с вместе с добычей'); } }
// 3. тело босса держится boss с
{ const W = mk(), p = W.player, def = CFG3.bosses.list.find(b => !b.level && !b.city && !b.ring), e = spawnBoss(W, { ...def, x: p.x + 2, z: p.z }); killEnemy(W, e, 1);
  const c = (W.corpses || []).find(x => x.id === 'c' + e.id); ok(c && c.boss && c.life === C.boss, 'у тела босса не своё время: ' + (c && c.life));
  if (c) { c.t = C.life + 5; run(W, .5); ok((W.corpses || []).some(x => x.id === c.id), 'тело босса исчезло через 3 минуты'); } }
// 4. выключено — вещи на землю, как раньше
{ const W = mk(false), p = W.player; let got = false; for (let k = 0; k < 200 && !got; k++) { const e = spawnEnemy(W, 'brute', p.x + 1.2, p.z); killEnemy(W, e, 1); got = W.drops.length > 0; }
  ok(got && !W.drops.some(q => q.corpse) && !(W.corpses || []).length, 'выключено — тела всё равно есть'); }

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Добыча с тел 3D: OK');
