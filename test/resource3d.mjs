// Тест ресурса умений 3D (2026-10-18): Ярость Торна копится от ударов и урона и гаснет вне боя, Концентрация Сойки
// восстанавливается сама, Концентрация Вейла — тоже (с 2026-10-18); запас в пределах 0..max; умение без ресурса не срабатывает
// и не уходит на перезарядку; с ресурсом — тратит цену; удары оружием дают ресурс, удары умений — нет; у героя свой запас.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnEnemy, refreshGear } from '../3d/src/sim.js';
import { resGain, resTick, resNow, resSpend } from '../3d/src/resource3d.js';
import { abilityPoints, upgradeAbility, useAbility } from '../3d/src/abilities3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const R = CFG3.abilities.res, near = (a, b) => Math.abs(a - b) < 1e-6;
const fake = hero => ({ cfg: CFG3, hero });
// чистые правила
{ const W = fake('thorn'); ok(resNow(W) === R.thorn.start, 'Ярость не с нуля');
  resGain(W, 'hit'); ok(near(resNow(W), R.thorn.hit), 'удар не дал ярости'); resGain(W, 'hurt', 20); ok(near(resNow(W), R.thorn.hit + 20 * R.thorn.hurt), 'урон не дал ярости');
  const v = resNow(W); resTick(W, R.thorn.idle - .5); ok(near(resNow(W), v), 'ярость гаснет в бою'); resTick(W, 1); ok(resNow(W) < v, 'ярость не гаснет вне боя');
  for (let i = 0; i < 100; i++) resGain(W, 'hit'); ok(resNow(W) === R.thorn.max, 'ярость выше предела'); for (let i = 0; i < 100; i++) resTick(W, 1); ok(resNow(W) === 0, 'ярость ниже нуля или не гаснет до конца');
  ok(!resSpend(W, 10) && resNow(W) === 0, 'потрачено больше, чем есть'); }
{ const W = fake('jay'); ok(resNow(W) === R.jay.start, 'Концентрация не полная в начале'); resSpend(W, 60); const v = resNow(W); resTick(W, 2); ok(near(resNow(W), v + 2 * R.jay.regen), 'Концентрация не восстанавливается'); }
{ const W = fake('vale'); ok(resNow(W) === R.vale.start && R.vale.regen > 0, 'Концентрация Вейла не полная в начале'); resSpend(W, 60); const v0 = resNow(W); resTick(W, 2); ok(near(resNow(W), v0 + 2 * R.vale.regen), 'Концентрация Вейла не восстанавливается сама'); W.hero = 'thorn'; ok(resNow(W) === R.thorn.start, 'смена героя не сбросила запас'); }
// умения: цена и перезарядка
const mk = hero => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.bosses.list = []; c.map.places = []; c.events.on = false; c.wanderer.on = false; c.ambient.on = false;
  const W = createWorld(c, mulberry32(4)); W.hero = hero; W.lv = 30; W.ap = abilityPoints(30, c); W.inv.eq.weapon = hero === 'jay' ? 'w_bow_rust' : hero === 'vale' ? 'w_dagger_rust' : 'w_sword_iron'; refreshGear(W);
  Object.assign(W.player, { x: 40, z: 40, face: 0, inv: 0 }); W.player.hp = W.player.maxhp; return W; };
{ const W = mk('thorn'); upgradeAbility(W, 'whirl'); const e = spawnEnemy(W, 'brute', 41.5, 40); e.hp = e.maxhp = 1e5; e.cd = 99;
  const cost = CFG3.abilities.thorn.whirl.cost; resNow(W); W.res = cost - 1;
  ok(useAbility(W, 2) === 'res' && !(W.acd.whirl > 0) && e.hp === e.maxhp, 'умение без ресурса сработало или ушло на перезарядку');
  W.res = cost + 5; ok(useAbility(W, 2) === 'ok' && W.acd.whirl > 0 && e.hp < e.maxhp, 'умение с ресурсом не сработало');
  ok(near(W.res, 5), 'удар умения дал ярость или цена списана не та: ' + W.res); }
// удары оружием дают ресурс (в бою, через симуляцию)
{ const W = mk('thorn'); const e = spawnEnemy(W, 'brute', 40, 41.2); e.hp = e.maxhp = 1e5; e.cd = 99; W.player.face = 0;
  for (let i = 0; i < 60 * 3; i++) step(W, 1 / 60, { attack: i % 20 < 2 });
  ok(e.hp < e.maxhp && resNow(W) > 0, `удары мечом не дали ярости (урон ${e.maxhp - e.hp}, ярость ${resNow(W)})`); }

if (fails.length) { console.log('resource3d FAIL\n' + [...new Set(fails)].join('\n')); process.exit(1); }
console.log('Ресурс умений 3D: OK');
