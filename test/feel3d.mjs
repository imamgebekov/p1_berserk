// Ощущение боя (этап 1 «круче»): замедление на убийстве, элите и боссе гаснет само; серия с третьего убийства подряд;
// сильное ранение — вспышка; красная кайма и сердце только при низком здоровье (чаще — чем меньше здоровья);
// «уменьшить движение» — без замедления и наезда; карточка уровня знает, что открылось.
import { CFG3 } from '../3d/src/config3d.js';
import { createFeel, unlocksAt } from '../3d/src/feel3d.js';
import { ABILITIES } from '../3d/src/data/abilities3d.js';

const fail = []; const ok = (c, m) => { if (!c) fail.push(m); };
const run = (f, s, hp = 1, calm = false) => { let last; for (let t = 0; t < s; t += 1 / 60) last = f.tick(1 / 60, hp, calm); return last; };
const F = CFG3.feel;
{ const f = createFeel(CFG3); ok(f.event({ k: 'die' }) === null, 'обычное убийство без звука серии'); const a = f.tick(1 / 120); ok(a.scale === F.kill[0], 'нет короткого замедления на убийстве'); ok(run(f, .2).scale === 1, 'замедление убийства не прошло'); }
{ const f = createFeel(CFG3); ok(f.event({ k: 'die', elite: true }) === 'eliteKill', 'нет звука элиты'); const a = f.tick(1 / 60); ok(a.scale < .5 && a.flash.a > .1, 'элита: нет замедления или вспышки'); ok(run(f, .5).scale === 1, 'замедление элиты не прошло'); }
{ const f = createFeel(CFG3); ok(f.event({ k: 'die', boss: true }) === 'bossKill', 'нет звука босса'); const a = f.tick(1 / 60); ok(a.scale <= F.boss[0] + .01 && a.zoom > .1, 'босс: нет замедления или наезда');
  const mid = run(f, F.boss[1] * .7); ok(mid.scale > a.scale && mid.scale < 1, 'босс: замедление не выходит плавно'); const end = run(f, 2.5); ok(end.scale === 1 && end.zoom < .01 && end.flash.a === 0, 'босс: эффект не погас'); }
{ const f = createFeel(CFG3); const r = [1, 2, 3, 4].map(() => { const x = f.event({ k: 'die' }); run(f, .5); return x; });
  ok(r[0] === null && r[1] === null && r[2] === 'streak' && r[3] === 'streak', 'серия не с третьего убийства: ' + r); ok(f.state().shown === 4, 'счёт серии не 4');
  run(f, F.streak.gap + .1); ok(f.tick(1 / 60).streak === 0, 'серия не обнулилась после паузы'); ok(f.event({ k: 'die' }) === null, 'после паузы серия продолжилась'); }
{ const f = createFeel(CFG3); ok(f.event({ k: 'hurt', dmg: 5 }, 100) === null, 'слабый удар — уже вспышка'); ok(f.event({ k: 'hurt', dmg: 20 }, 100) === 'hurtBig' && f.tick(1 / 60).flash.a > .1, 'сильный удар без отклика'); }
{ const f = createFeel(CFG3); ok(run(f, 1, .8).vig === 0, 'кайма при полном здоровье'); ok(run(f, .1, .1).vig > 0, 'нет каймы при низком здоровье');
  const beats = hp => { const g = createFeel(CFG3); let n = 0; for (let t = 0; t < 6; t += 1 / 60) if (g.tick(1 / 60, hp).beat) n++; return n; };
  ok(beats(.05) > beats(.28) && beats(.6) === 0, `сердце: ${beats(.05)} при 5%, ${beats(.28)} при 28%, ${beats(.6)} при 60%`); }
{ const f = createFeel(CFG3); f.event({ k: 'die', boss: true }); const a = f.tick(1 / 60, 1, true); ok(a.scale === 1 && a.zoom === 0 && a.flash.a < F.boss[3], '«уменьшить движение»: есть замедление, наезд или полная вспышка'); }
{ const f = createFeel({ ...CFG3, feel: { ...F, on: false } }); ok(f.event({ k: 'die', boss: true }) === null && f.tick(1 / 60).scale === 1, 'выключено — эффекты есть'); }
{ const A = ABILITIES.thorn, u3 = unlocksAt(3, CFG3, A), u8 = unlocksAt(8, CFG3, A), u7 = unlocksAt(7, CFG3, A);
  ok(u3.some(x => x.kind === 'ability' && x.name === A[0].name), 'на 3-м не открылось первое умение'); ok(u8.some(x => x.kind === 'squad' && x.n === 2), 'на 8-м нет второго бойца');
  ok(u7.some(x => x.kind === 'rank' && x.rank === 2), 'на 7-м нет второго ранга'); ok(unlocksAt(2, CFG3, A).length === 0 && unlocksAt(32, CFG3, A).length > 0, 'на 2-м что-то открылось или на 32-м пусто (древо: умения открываются почти каждый уровень)'); }
if (fail.length) { console.log('ПРОВАЛ:\n' + fail.join('\n')); process.exit(1); }
console.log('Ощущение боя 3D: OK');
