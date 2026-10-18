// Тест озёр, ручьёв и живности (2026-10-18): генерация (озёра не у мест и троп, пруды — озёра, ручьи доходят до воды),
// озеро непроходимо и выталкивает на берег, ручей замедляет и мочит, горение гаснет; высоты у озера; звери по биомам,
// утки остаются в озере и отплывают; лягушки ночью у воды.
import { CFG3 } from '../3d/src/config3d.js';
import { makeMap } from '../3d/src/map.js';
import { waterDist, streamDist, inStream, lakeR, lakeDist, buildHeights, heightAt } from '../3d/src/terrain3d.js';
import { expandWorld, biomeAt } from '../3d/src/worldgen3d.js';
import { createWorld, step, spawnEnemy, refreshGear } from '../3d/src/sim.js';
import { applyPlayer } from '../3d/src/status3d.js';
import { beastKind, makeDucks, updateDucks } from '../3d/src/ambient3d.js';
import { mixOf } from '../3d/src/soundscape3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const RV = CFG3.terrain.river, map = makeMap(CFG3), rv = map.river, M = CFG3.map;
const segD = (x, z, a, b) => { const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2)); return Math.hypot(x - a.x - dx * t, z - a.z - dz * t); };

// ---------- 1. генерация ----------
const big = RV.lakes.filter(L => L.r > 7), ponds = M.pois.filter(q => q.t === 'pond');
ok(big.length >= 6 && RV.lakes.length === big.length + ponds.length, `озёр мало или пруды не стали озёрами: ${big.length} больших, ${RV.lakes.length} всего, прудов ${ponds.length}`);
ok(RV.streams.length >= 6, 'ручьёв мало: ' + RV.streams.length);
for (const L of big) {
  ok(!M.places.some(p => Math.hypot(p.x - L.x, p.z - L.z) < p.r + L.r), `озеро (${L.x | 0}, ${L.z | 0}) на месте`);
  ok(!M.links.some(([a, b]) => segD(L.x, L.z, a, b) < L.r * 1.3 + 2), `озеро (${L.x | 0}, ${L.z | 0}) на тропе`);
  ok(!CFG3.bosses.list.some(b => !b.level && Math.hypot(b.x - L.x, b.z - L.z) < L.r + 12), `озеро у логова`);
}
for (const [i, S] of RV.streams.entries()) { const e = S.pts[S.pts.length - 1];
  ok(waterDist(rv, e.x, e.z) < .5, `ручей ${i} не доходит до воды`);
  ok(!M.places.some(p => S.pts.some(q => Math.hypot(p.x - q.x, p.z - q.z) < p.r * .8)), `ручей ${i} течёт через место`); }

// ---------- 2. озеро и ручей в бою ----------
function mk() { const cfg = JSON.parse(JSON.stringify(CFG3)); cfg.enemies.count = 0; cfg.weather.force = 'clear'; cfg.enemies.roam.on = false; cfg.events.on = false; cfg.wanderer.on = false;
  const W = createWorld(cfg, () => .5); W.player.inv = 1e9; step(W, 1 / 60, {}); return W; }
{ const W = mk(), L = big[0]; W.player.x = L.x; W.player.z = L.z; step(W, 1 / 60, {}); ok(lakeDist(L, W.player.x, W.player.z) >= -.05, 'герой остался в озере'); }
{ const W = mk(), L = big[0]; W.player.x = L.x + lakeR(L, Math.PI / 2) + 3; W.player.z = L.z; for (let i = 0; i < 120; i++) step(W, 1 / 60, { mx: -1, mz: 0 });
  ok(waterDist(W.map.river, W.player.x, W.player.z) > -.1, 'герой зашёл в озеро'); }
const S = RV.streams.find(s => s.pts.length > 6), mid = S.pts[3];
{ const run = inS => { const W = mk(), p = W.player, a = S.pts[2], b = S.pts[4], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz);
    p.x = inS ? mid.x : mid.x - dz / l * 6; p.z = inS ? mid.z : mid.z + dx / l * 6; const x0 = p.x, z0 = p.z; for (let i = 0; i < 20; i++) step(W, 1 / 60, { mx: dx / l, mz: dz / l }); return Math.hypot(p.x - x0, p.z - z0); };
  const dry = run(false), wet = run(true); ok(wet < dry * .92 && wet > dry * .75, `в ручье не медленнее: ${wet.toFixed(2)} против ${dry.toFixed(2)}`); }
{ const W = mk(); W.player.x = mid.x; W.player.z = mid.z; ok(inStream(W.map.river, mid.x, mid.z), 'середина ручья — не ручей'); applyPlayer(W, 'burn', 3, 5); step(W, 1 / 60, {}); ok(!W.pst.burn, 'горение не гаснет в ручье'); }
{ const W = mk(), e = spawnEnemy(W, 'brute', mid.x, mid.z); W.player.x = mid.x + 30; W.player.z = mid.z; e.cd = 99; step(W, 1 / 60, {}); ok(e.st && e.st.wet, 'враг в ручье не мокрый'); }

// ---------- 3. высоты ----------
{ const hf = buildHeights(CFG3, map), L = big[0]; ok(heightAt(hf, L.x, L.z) < CFG3.terrain.water - .2, 'дно озера не ниже воды');
  let shore = 0; for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, R = lakeR(L, a) * 1.15 + 1; shore = Math.min(shore, heightAt(hf, L.x + Math.sin(a) * R, L.z + Math.cos(a) * R)); }
  ok(shore > CFG3.terrain.water - .05, 'берег озера ниже воды: ' + shore.toFixed(2)); }

// ---------- 4. живность ----------
{ const A = CFG3.beasts, seen = {}; let s = 1; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (const bio of ['forest', 'swamp', 'mountains', 'waste', 'coast']) { seen[bio] = new Set(); for (let i = 0; i < 200; i++) seen[bio].add(beastKind(A, bio, rnd)); }
  ok(seen.forest.has('fox') && seen.mountains.has('goat') && seen.swamp.has('heron') && !seen.mountains.has('heron'), 'звери не по биомам: ' + JSON.stringify(Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, [...v]])))); }
{ const L = big[0], D = makeDucks(4), A = CFG3.beasts.ducks; let px = L.x + lakeR(L, 0) + 4, pz = L.z, inside = true;
  for (let i = 0; i < 300; i++) { updateDucks(D, px, pz, 1 / 30, RV.lakes, A, lakeR); for (const d of D) if (d.lake && lakeDist(L, d.x, d.z) > -.2) inside = false; }
  ok(D.every(d => d.lake === L || d.lake) && inside, 'утки не на озере или выплыли на берег');
  const d0 = D[0]; px = d0.x + 2; pz = d0.z; const before = Math.hypot(d0.x - px, d0.z - pz); for (let i = 0; i < 30; i++) updateDucks(D, px, pz, 1 / 30, RV.lakes, A, lakeR);
  ok(Math.hypot(d0.x - px, d0.z - pz) > before + .5, 'утка не отплывает от героя');
  updateDucks(D, L.x + 500, L.z + 500, 1 / 30, RV.lakes, A, lakeR); ok(D.every(d => !d.lake || Math.hypot(d.lake.x - L.x - 500, d.lake.z - L.z - 500) < 200), 'утки остались у далёкого озера'); }
{ const W = mk(), L = big[0]; W.player.x = L.x + lakeR(L, 0) + 2; W.player.z = L.z; W.enemies.length = 0; W.light = .1; W.night = true; const n = mixOf(W, CFG3.audio); W.light = 1; W.night = false; const d = mixOf(W, CFG3.audio);
  ok(n.frog > .3 && !(d.frog > .05), `лягушки: ночью у воды ${n.frog}, днём ${d.frog}`); }
void biomeAt; void refreshGear; void expandWorld;

if (fails.length) { console.error('Озёра, ручьи, живность 3D: ПРОВАЛ\n- ' + fails.join('\n- ')); process.exit(1); }
console.log(`Озёра, ручьи, живность 3D: OK (озёр ${big.length} + прудов ${ponds.length}, ручьёв ${RV.streams.length})`);
