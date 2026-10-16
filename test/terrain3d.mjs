// Тест рельефа 3D (шаг C2): река обходит лагерь, дома и места, мосты есть; земля ровная там, где стоят и ходят по делу;
// от лагеря пешком (по мостам) доходят до всех мест, логов, входов и сундуков; герой не входит в воду, но идёт по мосту;
// враг с другого берега доходит до героя через мост. Выключенный рельеф — реки нет.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnEnemy } from '../3d/src/sim.js';
import { makeMap } from '../3d/src/map.js';
import { pathSegs } from '../3d/src/world3d.js';
import { riverOf, onBridge, waterDist, buildHeights, heightAt } from '../3d/src/terrain3d.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const clone = () => JSON.parse(JSON.stringify(CFG3));
const map = makeMap(CFG3), rv = map.river, R = CFG3.world.radius;

// ---------- 1. река и мосты ----------
ok(rv && rv.pts.length > 10 && rv.bridges.length >= 2, 'нет реки или мостов');
{ const c = clone(); c.terrain.on = false; ok(!riverOf(c) && !makeMap(c).river, 'выключенный рельеф всё равно даёт реку'); }
const dry = (x, z, pad, m) => ok(waterDist(rv, x, z) > pad, `${m} в воде или у воды (${x.toFixed(1)}, ${z.toFixed(1)})`);
if (map.camp) dry(map.camp.x, map.camp.z, map.camp.r + 4, 'лагерь');
dry(0, 0, 8, 'костёр');
for (const b of map.buildings) for (const [x, z] of [[b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1]]) dry(x, z, 1, 'дом ' + b.kind);
for (const p of CFG3.map.places || []) if (p.safe) dry(p.x, p.z, p.r, 'место ' + p.name);
for (const b of CFG3.bosses.list) dry(b.x, b.z, 6, 'логово ' + b.id);
for (const q of map.portals || []) dry(q.x, q.z, 3, 'вход');
for (const c of map.containers) dry(c.x, c.z, 1.5, 'сундук');
for (const b of rv.bridges) ok(Math.hypot(b.x, b.z) < R - 4 && waterDist(rv, b.x, b.z) < 0 && onBridge(rv, b.x, b.z), 'мост не над водой или за краем мира');

// ---------- 2. высоты ----------
const hf = buildHeights(CFG3, map);
let maxH = 0; for (const v of hf.data) maxH = Math.max(maxH, Math.abs(v));
ok(maxH > .5 && maxH <= CFG3.terrain.hills.amp + 1e-6 + Math.abs(CFG3.terrain.bed), `холмов нет или они выше нормы: ${maxH.toFixed(2)}`);
const flat = (x, z, m) => ok(Math.abs(heightAt(hf, x, z)) < 1e-6, `${m}: земля не ровная (${heightAt(hf, x, z).toFixed(3)})`);
flat(0, 0, 'костёр'); if (map.camp) flat(map.camp.x + map.camp.r * .7, map.camp.z, 'лагерь');
for (const b of map.buildings) flat((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, 'дом ' + b.kind);
for (const [a, b] of pathSegs(map)) if (waterDist(rv, (a.x + b.x) / 2, (a.z + b.z) / 2) > CFG3.terrain.bank + 1) flat((a.x + b.x) / 2, (a.z + b.z) / 2, 'дорога');
for (const c of map.containers) flat(c.x, c.z, 'сундук');
for (const b of rv.bridges) ok(Math.abs(heightAt(hf, b.x, b.z) - CFG3.terrain.bridge.deck) < 1e-6, 'мост не на высоте настила');
ok(heightAt(hf, rv.pts[rv.pts.length >> 1].x, rv.pts[rv.pts.length >> 1].z) < CFG3.terrain.water, 'дно реки не ниже воды');
{ const c = clone(); c.terrain.on = false; const h0 = buildHeights(c, makeMap(c)); ok(h0.data.every(v => v === 0), 'выключенный рельеф не плоский'); }

// ---------- 3. проходимость от лагеря ----------
{
  const S = 1, N = Math.ceil(2 * R / S) + 1, idx = (x, z) => Math.round((z + R) / S) * N + Math.round((x + R) / S);
  const free = new Uint8Array(N * N), seen = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = -R + i * S, z = -R + j * S; free[j * N + i] = Math.hypot(x, z) < R - .5 && (waterDist(rv, x, z) > .5 || !!onBridge(rv, x, z)) ? 1 : 0; }
  const start = idx(map.camp ? map.camp.x : 0, map.camp ? map.camp.z : 0), q = [start]; seen[start] = 1;
  while (q.length) { const k = q.pop(), i = k % N, j = (k / N) | 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= N || b >= N) continue; const n = b * N + a; if (free[n] && !seen[n]) { seen[n] = 1; q.push(n); } } }
  const reach = (x, z, m) => { for (let r = 0; r <= 3; r++) for (let a = 0; a < 8; a++) { const k = idx(x + Math.sin(a * .785) * r, z + Math.cos(a * .785) * r); if (seen[k]) return; } fails.push(`${m} не достижимо от лагеря (${x.toFixed(0)}, ${z.toFixed(0)})`); };
  for (const p of CFG3.map.places || []) reach(p.x, p.z, 'место ' + p.name);
  for (const b of CFG3.bosses.list) reach(b.x, b.z, 'логово ' + b.id);
  for (const q2 of map.portals || []) reach(q2.x, q2.z, 'вход');
  for (const c of map.containers) reach(c.x, c.z, 'сундук');
  for (const b of map.buildings) if (b.door) reach(b.door.x, b.door.z, 'дверь ' + b.kind);
  // оба берега есть и связаны только мостами: без мостов дальний берег отрезан
  let far = 0; if (rv.bridges.length) for (let k = 0; k < N * N; k++) if (seen[k]) { const i = k % N, j = (k / N) | 0, x = -R + i * S, z = -R + j * S; if (waterDist(rv, x, z) > 3 && Math.hypot(x, z) > Math.hypot(rv.bridges[0].x, rv.bridges[0].z) + 8 && Math.sign(x * rv.bridges[0].x + z * rv.bridges[0].z) > 0) far++; }
  ok(far > 50, 'за рекой нет достижимой земли');
}

// ---------- 4. герой у воды и на мосту ----------
const mk = (seed = 1) => { const c = clone(); c.enemies.count = 0; c.bosses.list = []; c.events.on = false; c.wanderer.on = false; c.ambient && (c.ambient.on = false); return createWorld(c, mulberry32(seed)); };
const br = rv.bridges[0], bs = Math.sin(br.ang), bc = Math.cos(br.ang), half = br.len / 2;
{
  // на берегу в 3 м от моста вдоль русла: идём прямо в воду 3 с
  const W = mk(), p = W.player, ax = Math.cos(br.ang), az = -Math.sin(br.ang);     // вдоль русла (поперёк моста)
  p.x = br.x - bs * (half + 1) + ax * 6; p.z = br.z - bc * (half + 1) + az * 6;
  let minD = 1e9; for (let i = 0; i < 180; i++) { step(W, 1 / 60, { mx: bs, mz: bc }); minD = Math.min(minD, waterDist(rv, p.x, p.z)); }
  ok(minD > -.05, `герой зашёл в воду: ${minD.toFixed(2)}`);
}
{
  const W = mk(), p = W.player; p.x = br.x - bs * (half + 1); p.z = br.z - bc * (half + 1);
  for (let i = 0; i < 240; i++) step(W, 1 / 60, { mx: bs, mz: bc });
  const along = (p.x - br.x) * bs + (p.z - br.z) * bc;
  ok(along > half, `герой не перешёл мост: ${along.toFixed(2)} из ${half.toFixed(2)}`);
}

// ---------- 5. враг идёт через мост (оба моста, разные точки берегов) ----------
let runs = 0;
for (const b of rv.bridges) for (const [lp, le] of [[12, 12], [-10, 6], [4, -8], [0, 0]]) {
  const W = mk(3), p = W.player, s = Math.sin(b.ang), c = Math.cos(b.ang), ax = Math.cos(b.ang), az = -Math.sin(b.ang), h = b.len / 2;
  const P = { x: b.x - s * (h + 3) + ax * lp, z: b.z - c * (h + 3) + az * lp }, Q = { x: b.x + s * (h + 3) + ax * le, z: b.z + c * (h + 3) + az * le };
  if (waterDist(rv, P.x, P.z) < 1 || waterDist(rv, Q.x, Q.z) < 1 || Math.hypot(P.x, P.z) > R - 3 || Math.hypot(Q.x, Q.z) > R - 3) continue;
  runs++; p.x = P.x; p.z = P.z; p.inv = 1e9;
  const e = spawnEnemy(W, 'brute', Q.x, Q.z); e.hp = e.maxhp = 1e6; e.alert = true;
  let wet = 0, best = 1e9;
  for (let i = 0; i < 60 * 25 && best > 3; i++) { step(W, 1 / 60, {}); p.hp = p.maxhp; p.x = P.x; p.z = P.z; if (waterDist(rv, e.x, e.z) < -.05 && !onBridge(rv, e.x, e.z)) wet++; best = Math.min(best, Math.hypot(e.x - p.x, e.z - p.z)); }
  ok(best <= 3, `враг не дошёл через мост (${lp}, ${le}): ближе ${best.toFixed(1)} м`);
  ok(!wet, `враг шёл по воде ${wet} кадров`);
}
ok(runs >= 4, 'мало проверок врага у мостов: ' + runs);

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Рельеф 3D: OK');
