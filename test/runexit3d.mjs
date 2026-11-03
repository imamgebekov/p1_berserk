// Тест выхода из подземелья кнопкой 3D (2026-11-03): слепок при входе, потеря половины добычи, если убиты не все боссы; все убиты — без потерь;
// надетое и снятое добычей не считается; обычный выход через портал ничего не отнимает; на поверхности и мёртвым нельзя.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, mulberry32 } from '../3d/src/sim.js';
import { travel, isInstance, SURFACE } from '../3d/src/levels3d.js';
import { exitRun, exitBlock, exitPreview, allBossesDead } from '../3d/src/runexit3d.js';
import { addItem } from '../3d/src/inv.js';
import { CATALOG } from '../3d/src/data/items.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const mk = seed => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.events.on = false; c.wanderer.on = false; return createWorld(c, mulberry32(seed)); };
const inst = CFG3.instances.list[0].id, bosses = CFG3.bosses.list.filter(b => b.level === inst);
const mats = CATALOG.filter(i => i.stack >= 20 && i.cat !== 'gem').slice(0, 2).map(i => i.id), sword = CATALOG.find(i => i.cat === 'weapon').id;

{ const W = mk(1); ok(exitBlock(W) === 'Это не подземелье' && exitRun(W) === 'block', 'выход с поверхности');
  W.inv.ash = 100; addItem(W.inv, mats[0], 4, 99);
  ok(travel(W, inst, 0, 0) && isInstance(W, inst) && W.run && W.run.ash === 100, 'нет слепка при входе');
  ok(bosses.length > 0 && !allBossesDead(W, inst), 'боссы подземелья убиты сразу');
  // добыча захода: пепел +60, вещи +10 и новый меч; 4 вещи были и в слепке
  W.inv.ash += 60; addItem(W.inv, mats[0], 10, 99); addItem(W.inv, sword, 1, 99);
  const pv = exitPreview(W); ok(!pv.free && pv.ash === 30 && pv.items[mats[0]] === 5, 'подсказка потерь: ' + JSON.stringify(pv));
  ok(exitRun(W) === 'ok' && W.lvl === SURFACE && !W.run, 'выход не на поверхность или слепок остался');
  const have = W.inv.bag.filter(s => s.id === mats[0]).reduce((a, s) => a + s.n, 0), sw = W.inv.bag.filter(s => s.id === sword).length;
  ok(W.inv.ash === 130 && have === 9, `после выхода пепла ${W.inv.ash} (ждали 130), вещей ${have} (ждали 9)`); ok(sw <= 1, 'меч задвоился');
  ok(W.ev.some(v => v.k === 'runExit' && !v.free && v.ash === 30), 'нет события выхода'); }

{ const W = mk(2); W.inv.ash = 40; travel(W, inst, 0, 0); W.inv.ash += 80; addItem(W.inv, mats[1], 8, 99);
  for (const b of bosses) W.bossDead[b.type] = 100;     // убиты все боссы
  ok(allBossesDead(W, inst) && exitPreview(W).free, 'все боссы убиты — потери остались');
  ok(exitRun(W) === 'ok' && W.inv.ash === 120 && W.inv.bag.filter(s => s.id === mats[1]).reduce((a, s) => a + s.n, 0) === 8, 'при всех убитых боссах отняли добычу'); }

{ const W = mk(3); W.inv.ash = 50; travel(W, inst, 0, 0);     // надеть и снять — не добыча; пепел потрачен — не отрицательно
  W.inv.ash = 10; ok(exitPreview(W).ash === 0, 'отняли пепел, которого не прибавилось');
  const p = W.player; p.dead = true; ok(exitBlock(W) === 'Вы мертвы', 'выход мёртвым'); p.dead = false; }

{ const W = mk(4); W.inv.ash = 70; travel(W, inst, 0, 0); W.inv.ash += 50; const q = W.map.portals.find(p => p.up && !p.stair);     // обычный выход через портал — без потерь
  travel(W, q.to, q.tx, q.tz); ok(W.lvl === SURFACE && W.inv.ash === 120 && !W.run, 'обычный выход отнял добычу или оставил слепок'); }

if (fails.length) { console.log('ПРОВАЛ:\n' + [...new Set(fails)].join('\n')); process.exit(1); }
console.log('Выход из подземелья 3D: OK');
