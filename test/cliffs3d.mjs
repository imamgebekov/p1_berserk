// Тест обрывов и поиска пути 3D (шаг C3c): плато только в горах, вдали от мест, троп и реки; на плато высоко, рядом — низко;
// герой не взбирается по обрыву, но поднимается по въезду; враг снизу доходит до героя на плато через въезд (A*);
// A* обходит стену, а к недостижимой цели возвращает null; деревья и трава не у края; ядро без обрывов.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnEnemy } from '../3d/src/sim.js';
import { makeMap, propsBlocked } from '../3d/src/map.js';
import { buildHeights, heightAt } from '../3d/src/terrain3d.js';
import { inCliff, crossesCliff, WALL } from '../3d/src/cliffs3d.js';
import { findPath, terrainBlocked } from '../3d/src/path3d.js';
import { biomeAt } from '../3d/src/worldgen3d.js';
import { pathSegs, distSeg } from '../3d/src/world3d.js';
import { waterDist } from '../3d/src/terrain3d.js';
import { grassIn } from '../3d/src/chunks3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const map = makeMap(CFG3), PL = map.plateaus, G = CFG3.worldgen;

// ---------- 1. размещение ----------
ok(PL.length >= 4, 'плато мало: ' + PL.length);
for (const P of PL) {
  ok(biomeAt(CFG3, P.x, P.z) === 'mountains', 'плато не в горах');
  ok(Math.hypot(P.x, P.z) > G.coreR + 40, 'плато у ядра');
  ok(waterDist(map.river, P.x, P.z) > P.r + 10, 'плато у реки');
  ok(!pathSegs(map).some(([a, b]) => distSeg(P.x, P.z, a, b) < P.r + 3), 'тропа через плато');
  ok(!CFG3.map.places.some(p => Math.hypot(p.x - P.x, p.z - P.z) < p.r + P.r), 'плато на месте');
  ok(P.ramps.length >= 1, 'у плато нет въезда');
}
// ---------- 2. высоты ----------
{ const hf = buildHeights(CFG3, map);
  for (const P of PL) {
    const top = heightAt(hf, P.x, P.z), a = P.ramps[0] + Math.PI / 2, out = heightAt(hf, P.x + Math.sin(a) * (P.r + 3), P.z + Math.cos(a) * (P.r + 3));
    ok(top - out > P.h - 1.5, `на плато не высоко: ${top.toFixed(2)} против ${out.toFixed(2)}`);
    const ed = heightAt(hf, P.x + Math.sin(a) * (P.r - .5), P.z + Math.cos(a) * (P.r - .5)); ok(ed - out > P.h * .2, `у края плато нет подъёма: ${ed.toFixed(2)}`);     // край — отвесный, но с высотой
    const q = P.ramps[0]; let prev = Infinity, mono = true; for (let d = P.r - 2; d < P.r + P.len; d += .5) { const h = heightAt(hf, P.x + Math.sin(q) * d, P.z + Math.cos(q) * d); mono = mono && h <= prev + .35; prev = h; }
    ok(mono, 'въезд не пологий спуск');
  } }
// ---------- 3. герой и враг ----------
const mk = () => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.bosses.list = []; c.events.on = false; c.wanderer.on = false; return createWorld(c, mulberry32(4)); };
const P = PL[0], side = P.ramps[0] + Math.PI;                                   // напротив въезда
{ const W = mk(), p = W.player; p.x = P.x + Math.sin(side) * (P.r + 3); p.z = P.z + Math.cos(side) * (P.r + 3);
  for (let i = 0; i < 180; i++) step(W, 1 / 60, { mx: -Math.sin(side), mz: -Math.cos(side) });
  ok(Math.hypot(p.x - P.x, p.z - P.z) > P.r + WALL / 2, 'герой взобрался по обрыву'); }
{ const W = mk(), p = W.player, q = P.ramps[0]; p.x = P.x + Math.sin(q) * (P.r + P.len); p.z = P.z + Math.cos(q) * (P.r + P.len);
  for (let i = 0; i < 60 * 6 && Math.hypot(p.x - P.x, p.z - P.z) > P.r - 4; i++) step(W, 1 / 60, { mx: (P.x - p.x) / Math.hypot(P.x - p.x, P.z - p.z), mz: (P.z - p.z) / Math.hypot(P.x - p.x, P.z - p.z) });
  ok(Math.hypot(p.x - P.x, p.z - P.z) <= P.r - 4, 'герой не поднялся по въезду'); }
{ const W = mk(), p = W.player; p.x = P.x; p.z = P.z; p.inv = 1e9;
  const sx = P.x + Math.sin(side) * (P.r + 4), sz = P.z + Math.cos(side) * (P.r + 4), e = spawnEnemy(W, 'imp', sx, sz); e.hp = e.maxhp = 1e6; e.alert = true;
  let best = 1e9, inWall = 0; for (let i = 0; i < 60 * 30 && best > 2.5; i++) { step(W, 1 / 60, {}); p.hp = p.maxhp; p.x = P.x; p.z = P.z; best = Math.min(best, Math.hypot(e.x - p.x, e.z - p.z)); if (inCliff(PL, e.x, e.z, -.05)) inWall++; }
  ok(best <= 2.5, `враг снизу не дошёл до героя на плато: ${best.toFixed(1)} м`); ok(!inWall, 'враг прошёл сквозь стену обрыва'); }
// ---------- 4. A* ----------
{ const a = { x: P.x + Math.sin(side) * (P.r + 4), z: P.z + Math.cos(side) * (P.r + 4) }, t0 = performance.now(), path = findPath(map, a.x, a.z, P.x, P.z), ms = performance.now() - t0;
  ok(path && path.length >= 2, 'A* не нашёл путь на плато');
  if (path) { let cur = a, clear = true; for (const q of path) { clear = clear && !crossesCliff(PL, cur.x, cur.z, q.x, q.z); cur = q; } ok(clear && Math.hypot(cur.x - P.x, cur.z - P.z) < .01, 'путь A* сквозь обрыв или не до цели'); }
  ok(ms < 60, 'A* долгий: ' + ms.toFixed(0) + ' мс');
  const fake = { ...map, plateaus: [{ ...P, ramps: [] }] };                     // без въездов — на плато не попасть
  ok(findPath(fake, a.x, a.z, P.x, P.z) === null, 'A* нашёл путь на закрытое плато');
  ok(!terrainBlocked(map, 0, 0, 10, 10), 'в ядре прямая заблокирована'); }
// ---------- 5. деревья, трава ----------
{ for (const P2 of PL) for (let a = 0; a < 6.28; a += .1) { const x = P2.x + Math.sin(a) * P2.r, z = P2.z + Math.cos(a) * P2.r; if (inCliff(PL, x, z)) ok(propsBlocked(map, x, z), 'дерево может вырасти на обрыве'); }
  const ci = Math.floor(P.x / 64), cj = Math.floor(P.z / 64); ok(grassIn(map, CFG3, ci, cj).every(g => !inCliff(PL, g.x, g.z, .3)), 'трава на обрыве'); }

if (fails.length) { console.log('ПРОВАЛ:\n' + [...new Set(fails)].join('\n')); process.exit(1); }
console.log('Обрывы и поиск пути 3D: OK');
