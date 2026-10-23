// Тест ветра 3D (шаг F2): сила в 0..1, плавная (без скачков), бывает и тишь, и ветер, и порывы; повторяемость по зерну;
// направление гуляет в пределах; трава не на тропах, в воде, домах и у препятствий, её достаточно; шелест листвы зависит
// от ветра и деревьев рядом, в бою и под землёй — тише или нет; в тишь шелест почти не слышен.
import { CFG3 } from '../3d/src/config3d.js';
import { windAt, grassSpots } from '../3d/src/wind3d.js';
import { makeMap } from '../3d/src/map.js';
import { pathSegs, distSeg } from '../3d/src/world3d.js';
import { waterDist } from '../3d/src/terrain3d.js';
import { createWorld, mulberry32 } from '../3d/src/sim.js';
import { mixOf } from '../3d/src/soundscape3d.js';
import { wdist, wcOf } from '../3d/src/geo3d.js';     // Мир 5.0: край — от центра мира

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const C = CFG3.wind;

// ---------- 1. сила и направление ----------
{ let calm = 0, windy = 0, gusts = 0, jump = 0, prev = null, n = 0, dmin = 1e9, dmax = -1e9;
  for (let t = 0; t < 3600; t += .25, n++) {
    const w = windAt(t, C, 3); ok(w.s >= 0 && w.s <= 1 && Math.abs(Math.hypot(...w.dir) - 1) < 1e-9, 'сила вне 0..1 или направление не единичное');
    if (w.s < .2) calm++; if (w.s > .5) windy++; if (w.gust > .3) gusts++;
    if (prev) jump = Math.max(jump, Math.abs(w.s - prev.s)); prev = w;
    const d = w.ang * 180 / Math.PI; dmin = Math.min(dmin, d); dmax = Math.max(dmax, d);
  }
  ok(calm / n > .1 && windy / n > .1 && gusts / n > .02, `нет разнообразия: тишь ${(calm / n).toFixed(2)}, ветер ${(windy / n).toFixed(2)}, порывы ${(gusts / n).toFixed(2)}`);
  ok(jump < .12, 'ветер меняется скачком: ' + jump.toFixed(3));     // порыв нарастает примерно за секунду, не мгновенно
  ok(dmax - dmin <= C.dirWander + 1e-6 && dmax - dmin > C.dirWander * .3, `направление гуляет неверно: ${(dmax - dmin).toFixed(0)}°`);
  let diff = 0; for (let t = 0; t < 600; t += 7) if (Math.abs(windAt(t, C, 3).s - windAt(t, C, 4).s) > .05) diff++;
  ok(JSON.stringify(windAt(123.4, C, 3)) === JSON.stringify(windAt(123.4, C, 3)) && diff > 20, 'зерно не влияет или нет повторяемости: ' + diff); }

// ---------- 2. трава ----------
{ const map = makeMap(CFG3), G = grassSpots(map, CFG3, CFG3.world.seed), segs = pathSegs(map);
  ok(G.length > 1500, 'травы мало: ' + G.length);
  ok(G.every(g => waterDist(map.river, g.x, g.z) >= 1.2), 'трава в воде');
  ok(G.every(g => !segs.some(([a, b]) => distSeg(g.x, g.z, a, b) < 1.4)), 'трава на тропе');
  ok(G.every(g => !map.buildings.some(b => g.x > b.x0 - .5 && g.x < b.x1 + .5 && g.z > b.z0 - .5 && g.z < b.z1 + .5)), 'трава в доме');
  ok(G.every(g => wdist(CFG3, g.x, g.z) <= CFG3.world.radius - 2), 'трава за краем мира');
  ok(JSON.stringify(G.slice(0, 20)) === JSON.stringify(grassSpots(map, CFG3, CFG3.world.seed).slice(0, 20)), 'трава не повторяется'); }

// ---------- 3. шелест ----------
{ const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.bosses.list = []; c.events.on = false; c.wanderer.on = false;
  const W = createWorld(c, mulberry32(1)), A = CFG3.audio; W.player.x = 40; W.player.z = 40; W.light = 1;
  const m = env => mixOf(W, A, env).rustle;
  ok(m({ wind: 1, trees: 1 }) > .9 && m({ wind: .05, trees: 1 }) < .15 && m({ wind: 1, trees: 0 }) < .15, 'шелест не от ветра и деревьев');
  ok(m({ wind: .5, trees: .5 }) < m({ wind: 1, trees: .5 }) && m({ wind: .5, trees: .5 }) < m({ wind: .5, trees: 1 }), 'шелест не растёт с ветром и числом деревьев');
  ok(m(undefined) === 0, 'без данных о ветре шелест не ноль');
  W.lvl = 'crypt'; ok(m({ wind: 1, trees: 1 }) === 0, 'под землёй шелестит листва'); }

if (fails.length) { console.log('ПРОВАЛ:\n' + [...new Set(fails)].join('\n')); process.exit(1); }
console.log('Ветер 3D: OK');
