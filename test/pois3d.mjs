// Тест наполненного мира 3D (шаг G2): посёлков, опасных мест и ориентиров больше; ~150 точек интереса не в воде, не на тропах
// и не друг в друге, у стоянок, телег и курганов есть сундуки; гарнизон появляется, когда герой подходит (вне экрана), не
// возрождается сразу после зачистки и забывается вдали; святилище даёт дар раз в again с, таймер сохраняется; деревья за
// ядром растут рощами; звери пугаются героя и убегают.
import { CFG3 } from '../3d/src/config3d.js';
import { makeMap } from '../3d/src/map.js';
import { createWorld, step, mulberry32, killEnemy } from '../3d/src/sim.js';
import { waterDist } from '../3d/src/terrain3d.js';
import { pathSegs, distSeg } from '../3d/src/world3d.js';
import { inCliff } from '../3d/src/cliffs3d.js';
import { propsIn, groveAt } from '../3d/src/chunks3d.js';
import { biomeAt } from '../3d/src/worldgen3d.js';
import { makeBeasts, updateBeasts } from '../3d/src/ambient3d.js';
import { createSaver, loadSave } from '../3d/src/save3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const M = CFG3.map, G = CFG3.worldgen, R = CFG3.world.radius, map = makeMap(CFG3), segs = pathSegs(map);

// ---------- 1. генератор ----------
const gen = M.places.filter(p => p.gen);
ok(gen.filter(p => p.type === 'hamlet').length === G.villages, 'посёлков не ' + G.villages);
ok(gen.filter(p => p.type === 'danger' && !p.poi && !p.castle).length === G.dangers, 'опасных мест не ' + G.dangers);
ok(M.landmarks.length === G.landmarks, 'ориентиров не ' + G.landmarks);
ok(M.pois.length >= G.pois.n * .95, 'точек интереса мало: ' + M.pois.length);
for (const t of Object.keys(G.pois.r)) ok(M.pois.filter(q => q.t === t).length >= 8, `точек «${t}» меньше 8`);
for (const [i, q] of M.pois.entries()) {
  const d = Math.hypot(q.x, q.z);
  ok(d > G.coreR + 20 && d < R - 20, `${q.id}: в ядре или у края`);
  if (q.t === 'pond') ok(waterDist(map.river, q.x, q.z) < 0 && waterDist(map.river, q.x, q.z, false) > q.r + 1, `${q.id}: пруд не стал озером или в реке`);     // пруды — маленькие озёра (2026-10-18)
  else ok(waterDist(map.river, q.x, q.z) > q.r + 1, `${q.id}: в воде`);
  ok(!segs.some(([a, b]) => distSeg(q.x, q.z, a, b) < q.r + 1), `${q.id}: на тропе`);
  ok(!inCliff(map.plateaus, q.x, q.z, q.r), `${q.id}: на обрыве`);
  ok(!map.buildings.some(b => q.x > b.x0 - q.r && q.x < b.x1 + q.r && q.z > b.z0 - q.r && q.z < b.z1 + q.r), `${q.id}: в доме`);
  ok(!M.castles.some(c => Math.hypot(c.x - q.x, c.z - q.z) < 22 + q.r), `${q.id}: в замке`);
  ok(!M.pois.some((o, j) => j > i && Math.hypot(o.x - q.x, o.z - q.z) < o.r + q.r), `${q.id}: налезает на другую точку`);
  const box = map.containers.filter(c => Math.hypot(c.x - q.x, c.z - q.z) < q.r + 1).length;
  ok(box >= ({ bandits: 2, wagon: 1, barrow: 1, hut: 1 }[q.t] || 0), `${q.id} (${q.t}): сундуков ${box}`);
}
{ const a = JSON.stringify(CFG3.map.pois); ok(a === JSON.stringify((await import('../3d/src/config3d.js?again')).CFG3.map.pois), 'точки не те же при повторной сборке мира'); }

// ---------- 2. гарнизон ----------
const mk = (seed, tweak) => { const c = JSON.parse(JSON.stringify(CFG3)); c.events.on = false; c.wanderer.on = false; c.enemies.count = 0; c.bosses.list = []; if (tweak) tweak(c); return createWorld(c, mulberry32(seed)); };
const run = (W, s) => { for (let i = 0; i < 60 * s; i++) { W.player.inv = 1e9; W.player.hp = W.player.maxhp; step(W, 1 / 60, {}); } };
{
  const C = CFG3.enemies.garrison, B = M.places.find(p => p.poi === 'bandits'), W = mk(4), p = W.player, mine = () => W.enemies.filter(e => e.garr === B.id && !e.dead);
  p.x = B.x + 15; p.z = B.z; run(W, 1); ok(!mine().length, 'гарнизон появился на глазах у героя');
  p.x = B.x + 50; p.z = B.z; run(W, 1);
  ok(mine().length === C.n.bandits && mine().every(e => e.mode === 'guard' || e.mode === 'patrol'), 'гарнизон стоянки не появился или не сторожит: ' + mine().length);
  ok(mine().every(e => Math.hypot(e.x - B.x, e.z - B.z) < B.r), 'гарнизон не на стоянке');
  for (const e of mine()) killEnemy(W, e, 1); run(W, 3); ok(!mine().length, 'гарнизон возродился сразу после зачистки');
  W.t += C.respawn + 1; run(W, 1); ok(mine().length === C.n.bandits, 'гарнизон не вернулся через respawn');
  p.x = B.x + 300; p.z = B.z; run(W, 1); ok(!W.enemies.some(e => e.garr === B.id), 'дальний гарнизон не забылся');
  p.x = B.x + 50; p.z = B.z; run(W, 1); ok(mine().length === C.n.bandits, 'забытый незачищенный гарнизон не вернулся');
  const W2 = mk(4, c => { c.enemies.roam.on = false; }); W2.player.x = B.x + 50; W2.player.z = B.z; run(W2, 1); ok(!W2.enemies.some(e => e.garr), 'гарнизон при прежнем напоре');
}
// ---------- 3. святилище ----------
{
  const S = CFG3.shrine, Q = M.pois.find(q => q.t === 'shrine'), W = mk(5), p = W.player, gifts = () => W.ev.filter(v => v.k === 'shrine').length;
  ok(M.places.some(pl => pl.id === Q.place && pl.safe), 'святилище не безопасное место');
  p.x = Q.x + S.reach - .4; p.z = Q.z; W.ev.length = 0; run(W, .1);
  const b = W.buffs.find(x => x.src && x.src.startsWith('shrine:'));
  ok(gifts() === 1 && b && b.t > 0, 'святилище не дало дар');
  run(W, 2); ok(gifts() === 1, 'дар дан повторно сразу');
  const mem = (() => { const o = {}; return { getItem: k => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); }, removeItem: k => { delete o[k]; } }; })();
  createSaver(W, mem).write(true); const sv = loadSave(30, mem); ok(sv && sv.shrines[Q.id] > W.t, 'таймер святилища не сохранился');
  W.t += S.again + 1; W.ev.length = 0; run(W, .1); ok(gifts() === 1, 'святилище не дало дар снова через again');
}
// ---------- 4. рощи: в лесу за ядром в роще деревьев гуще, на поляне — реже ----------
{
  const GR = G.groves, grove = [], glade = [];
  for (let ci = -9; ci < 9; ci++) for (let cj = -9; cj < 9; cj++) {
    const cx = (ci + .5) * 64, cz = (cj + .5) * 64, d = Math.hypot(cx, cz); if (d < 160 || d > 540 || biomeAt(CFG3, cx, cz) !== 'forest') continue;
    const g = groveAt(GR, cx, cz), n = propsIn(map, CFG3, ci, cj).filter(q => q.tree && !q.edge).length;
    if (g > .8) grove.push(n); else if (g < .35) glade.push(n);
  }
  const avg = a => a.reduce((t, v) => t + v, 0) / Math.max(1, a.length);
  console.log(`лес за ядром: в роще ${avg(grove).toFixed(1)} деревьев на участок (${grove.length}), на поляне ${avg(glade).toFixed(1)} (${glade.length})`);
  ok(grove.length >= 3 && glade.length >= 3 && avg(grove) > 2.5 * avg(glade), 'деревья за ядром растут ровно, без рощ и полян');
}
// ---------- 5. звери ----------
{
  const A = CFG3.beasts, B = makeBeasts(A.n), rnd = mulberry32(3); let px = 0, pz = 0;
  for (let i = 0; i < 10; i++) updateBeasts(B, px, pz, 1 / 60, A, rnd, () => true);
  ok(B.every(b => b.state !== 'gone' && Math.hypot(b.x, b.z) >= A.ring[0] - .1), 'звери не появились вокруг героя или у самого героя');
  const b = B[0]; px = b.x - 3; pz = b.z; const d0 = Math.hypot(b.x - px, b.z - pz);
  for (let i = 0; i < 60; i++) updateBeasts(B, px, pz, 1 / 60, A, rnd, () => true);
  ok(b.state === 'flee' && Math.hypot(b.x - px, b.z - pz) > d0 + 3, 'зверь не убегает от героя');
  px += 500; updateBeasts(B, px, pz, 1 / 60, A, rnd, () => true); ok(B.every(q => Math.hypot(q.x - px, q.z - pz) < A.ring[1] + .1), 'звери не вернулись к ушедшему герою');
  const C = makeBeasts(3); updateBeasts(C, 0, 0, 1 / 60, A, rnd, () => false); ok(C.every(q => q.state === 'gone'), 'зверь встал там, где нельзя');
}

if (fails.length) { console.log('ПРОВАЛ:\n' + [...new Set(fails)].slice(0, 25).join('\n')); process.exit(1); }
console.log('Наполненный мир 3D: OK');
