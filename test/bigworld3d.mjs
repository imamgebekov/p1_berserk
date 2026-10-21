// Тест устройства под большой мир (шаг C1): сетка участков даёт те же столкновения и ту же «видимость», что полный перебор
// (поверхность и все подземелья); дальние враги спят и не считаются, бродячие за drop забываются; кривая глубины совпадает
// со старой формулой и обращается; туман по участкам переживает сохранение; версия 5 хранит позицию и номер мира,
// старое сохранение (версия 4) переводится без потерь, другой номер мира сбрасывает туман, позицию и таймеры боссов.
import { pushCliff } from '../3d/src/cliffs3d.js';
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnEnemy } from '../3d/src/sim.js';
import { makeMap, makeLevelMap, resolve, lineBlocked } from '../3d/src/map.js';
import { depthCurve, pointAtDepth } from '../3d/src/levels3d.js';
import { pushWater } from '../3d/src/terrain3d.js';
import { reveal } from '../3d/src/places3d.js';
import { createSaver, loadSave, packSeen, packSeenChunks, unpackSeenChunks, seenSize, SAVE_VERSION } from '../3d/src/save3d.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const clone = () => JSON.parse(JSON.stringify(CFG3));
const mem = () => { const o = {}; return { getItem: k => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); }, removeItem: k => { delete o[k]; }, o }; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- эталон: прежние полные переборы (до сетки) ----
function pushOutRef(o, r, w) {
  if (o.x < w.x0 - r || o.x > w.x1 + r || o.z < w.z0 - r || o.z > w.z1 + r) return false;
  const cx = clamp(o.x, w.x0, w.x1), cz = clamp(o.z, w.z0, w.z1), dx = o.x - cx, dz = o.z - cz, d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;
  if (d2 > 1e-12) { const d = Math.sqrt(d2), k = (r - d) / d; o.x += dx * k; o.z += dz * k; }
  else { const l = o.x - w.x0, rr = w.x1 - o.x, tp = o.z - w.z0, bt = w.z1 - o.z, m = Math.min(l, rr, tp, bt); if (m === l) o.x = w.x0 - r; else if (m === rr) o.x = w.x1 + r; else if (m === tp) o.z = w.z0 - r; else o.z = w.z1 + r; }
  return true;
}
function resolveRef(map, o, r) {
  let hit = false;
  for (let it = 0; it < 2; it++) for (const b of map.buildings) {
    if (o.x < b.x0 - r || o.x > b.x1 + r || o.z < b.z0 - r || o.z > b.z1 + r) continue;
    for (const w of (b.door.open < .6 ? b.walls.concat(b.door.rect) : b.walls)) {
      const cx = clamp(o.x, w.x0, w.x1), cz = clamp(o.z, w.z0, w.z1), dx = o.x - cx, dz = o.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue; hit = true;
      if (d2 > 1e-12) { const d = Math.sqrt(d2), k = (r - d) / d; o.x += dx * k; o.z += dz * k; }
      else { const l = o.x - w.x0, rr = w.x1 - o.x, tp = o.z - w.z0, bt = w.z1 - o.z, m = Math.min(l, rr, tp, bt); if (m === l) o.x = w.x0 - r; else if (m === rr) o.x = w.x1 + r; else if (m === tp) o.z = w.z0 - r; else o.z = w.z1 + r; }
    }
  }
  for (const w of map.blocks || []) if (pushOutRef(o, r, w)) hit = true;
  for (const d of map.doors || []) if (d.open < .6 && pushOutRef(o, r, d.rect)) hit = true;
  for (const q of map.solids) { const dx = o.x - q.x, dz = o.z - q.z, d = Math.hypot(dx, dz), m = q.r + r; if (d < m) { hit = true; if (d > 1e-9) { o.x = q.x + dx / d * m; o.z = q.z + dz / d * m; } else o.x += m; } }
  if (map.river && pushWater(map.river, o, r)) hit = true;      // река — полным перебором участков русла
  if (map.plateaus && map.plateaus.length && pushCliff(map.plateaus, o, r)) hit = true;     // обрывы (C3c)
  return hit;
}
function lineRef(map, x0, z0, x1, z1) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / .25)), inR = (w, x, z) => x > w.x0 && x < w.x1 && z > w.z0 && z < w.z1;
  const bx0 = Math.min(x0, x1), bx1 = Math.max(x0, x1), bz0 = Math.min(z0, z1), bz1 = Math.max(z0, z1);
  const houses = (map.buildings || []).filter(b => b.x1 > bx0 && b.x0 < bx1 && b.z1 > bz0 && b.z0 < bz1);
  for (let i = 1; i < n; i++) {
    const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n;
    if ((map.blocks || []).some(w => inR(w, x, z)) || (map.doors || []).some(d => d.open < .6 && inR(d.rect, x, z))) return true;
    for (const b of houses) if (b.walls.some(w => inR(w, x, z)) || (b.door.open < .6 && inR(b.door.rect, x, z))) return true;
  }
  return false;
}

// ---------- 1. сетка = полный перебор ----------
{
  const maps = [['поверхность', makeMap(CFG3), CFG3.world.radius], ...CFG3.dungeons.list.map(d => [d.name, makeLevelMap(CFG3, d), 40])];
  const rnd = mulberry32(5); let total = 0, diff = 0, ldiff = 0;
  for (const [name, M, R] of maps) {
    (M.doors || []).forEach((d, i) => { d.open = i % 2; });                 // часть дверей подземелий открыта
    M.buildings.forEach((b, i) => { b.door.open = i % 3 ? 0 : 1; });
    for (let k = 0; k < 3000; k++) {
      const x = (rnd() * 2 - 1) * R, z = (rnd() * 2 - 1) * R, r = .3 + rnd() * 1.4;
      const a = { x, z }, b = { x, z }, ha = resolve(M, a, r), hb = resolveRef(M, b, r); total++;
      if (ha !== hb || a.x !== b.x || a.z !== b.z) diff++;
      const x2 = x + (rnd() * 2 - 1) * 20, z2 = z + (rnd() * 2 - 1) * 20; if (lineBlocked(M, x, z, x2, z2) !== lineRef(M, x, z, x2, z2)) ldiff++;
    }
    if (diff || ldiff) { fails.push(`${name}: расхождений столкновений ${diff}, линий ${ldiff}`); diff = ldiff = 0; }
  }
  ok(total >= 3000 * maps.length, 'мало проверок сетки');
  // добавили препятствие — сетка пересобралась
  const M = makeMap(CFG3), o = { x: 70, z: 70 }; resolve(M, o, .5); M.solids.push({ x: 70, z: 70, r: 1 });
  const o2 = { x: 70, z: 70 }; ok(resolve(M, o2, .5) && Math.hypot(o2.x - 70, o2.z - 70) >= 1.49, 'новое препятствие не попало в сетку');
}
// ---------- 2. сон и забывание врагов ----------
{
  const c = clone(); c.enemies.count = 0; c.bosses.list = []; c.map.places = []; c.map.buildings = c.map.buildings.filter(b => Math.hypot(b.x + 50, b.z) > 30);     // поле без домов (ядро раздвинуто в 3.93)
  const W = createWorld(c, mulberry32(3)), S = c.enemies.sleep; W.player.x = -60; W.player.z = 0; W.player.inv = 1e9;
  const far = spawnEnemy(W, 'brute', -60 + S.r + 5, 0), near = spawnEnemy(W, 'imp', -60 + 20, 0); near.alert = true; far.alert = true;
  far.st = { burn: { t: 3, dps: 1 } }; const fx = far.x, fhp = far.hp;
  for (let i = 0; i < 120; i++) step(W, 1 / 60, {});
  ok(far.sleep && far.x === fx && far.hp === fhp && far.st.burn.t === 3, 'дальний враг не спит (ходит или горит)');
  ok(!near.sleep && Math.hypot(near.x + 40, near.z) > .5, 'ближний враг спит');
  // спящие не считаются: вокруг героя рождаются новые
  const c2 = clone(); c2.enemies.count = 3; c2.bosses.list = []; c2.map.places = []; c2.enemies.posts.modes = false;
  const W2 = createWorld(c2, mulberry32(4)); W2.player.x = -60; W2.player.inv = 1e9;
  for (let k = 0; k < 3; k++) spawnEnemy(W2, 'brute', 40, k * 3);    // в 100 м — спят
  for (let i = 0; i < 60 * 6; i++) step(W2, 1 / 60, {});
  ok(W2.enemies.filter(e => !e.dead && Math.hypot(e.x - W2.player.x, e.z - W2.player.z) < c2.enemies.sleep.r).length >= 2, 'спящие вдали заняли места врагов вокруг героя');
  // забывание: бродячий за drop пропадает, сторож — нет
  const W3 = createWorld(c, mulberry32(6)); W3.player.x = 0; W3.player.z = 0; W3.player.inv = 1e9;
  W3.player.x = -80; const roam = spawnEnemy(W3, 'imp', 40, 0), post = spawnEnemy(W3, 'imp', 40, 4, 'guard');
  for (let i = 0; i < 30; i++) step(W3, 1 / 60, {});
  ok(!W3.enemies.includes(roam) && W3.enemies.includes(post), 'забывание: бродячий остался или сторож пропал');
}
// ---------- 3. кривая глубины ----------
{
  const core = CFG3.worldgen.coreR, R = CFG3.world.radius, M = CFG3.world.depthMax;
  const { unwarpDist } = await import('../3d/src/coremap3d.js');     // ядро раздвинуто (3.93): глубина — по прежнему расстоянию
  let bad = 0; for (let d = 0; d <= core; d += .37) if (Math.abs(depthCurve(CFG3, d) - clamp(unwarpDist(CFG3, d) / core, 0, 1)) > 1e-12) bad++;
  ok(!bad, 'в ядре кривая глубины не совпадает со старой формулой: ' + bad);
  let up = true; for (let d = core; d < R + 50; d += 3) up = up && depthCurve(CFG3, d + 3) >= depthCurve(CFG3, d);
  ok(up && Math.abs(depthCurve(CFG3, R) - M) < 1e-9 && depthCurve(CFG3, R + 100) === M, 'за ядром глубина не растёт до depthMax');
  const big = { world: { radius: 600, depth: [[0, 0], [85, .75], [600, 1]] } };
  ok(Math.abs(depthCurve(big, 42.5) - .375) < 1e-9 && Math.abs(depthCurve(big, 342.5) - .875) < 1e-9 && depthCurve(big, 900) === 1, 'кусочная кривая считает не так');
  for (const t of [0, .2, .5, .75, .9, 1]) { const p = pointAtDepth(big, t, 1.3); ok(Math.abs(depthCurve(big, Math.hypot(p.x, p.z)) - t) < 1e-9, `pointAtDepth(${t}) не обращает кривую`); }
}
// ---------- 4. туман по участкам ----------
{
  const c = clone(); c.enemies.count = 0; const W = createWorld(c, mulberry32(8)), n = W.seenN;
  ok(!Object.keys(packSeenChunks(W.seen, n).c).length, 'пустой туман пишет участки');
  reveal(W, -30, 20, 20); reveal(W, 50, -40, 12);
  const pk = packSeenChunks(W.seen, n), a = new Uint8Array(W.seen.length); unpackSeenChunks(pk, a, n);
  ok(a.every((v, i) => v === W.seen[i]), 'туман не восстановился из участков');
  ok(!unpackSeenChunks(pk, new Uint8Array(a.length), n + 1), 'туман чужого размера прочитан');
  W.seen.fill(1); const full = packSeenChunks(W.seen, n); ok(Object.values(full.c).every(s => s === '*') && JSON.stringify(full).length < 14 * Object.keys(full.c).length + 60, 'открытая карта пишется не звёздочками');
  ok(seenSize(CFG3) === n, 'размер сетки тумана считается по-разному');
}
// ---------- 5. сохранение версии 5 ----------
{
  const c = clone(); c.enemies.count = 0; const W = createWorld(c, mulberry32(9)); reveal(W, 20, 30, 15); W.player.x = 31.5; W.player.z = -12.25;
  const st = mem(); createSaver(W, st).write(true); const d = JSON.parse(st.o['berserk3d.save']);
  ok(d.v === SAVE_VERSION && SAVE_VERSION >= 5 && d.gen === CFG3.world.gen && d.pos.x === 31.5 && d.pos.z === -12.25, 'версия 5 не пишет позицию или номер мира');
  const s = loadSave(30, st), a = new Uint8Array(W.seen.length); unpackSeenChunks(s.seen, a, W.seenN);
  ok(s.pos && s.pos.x === 31.5 && a.every((v, i) => v === W.seen[i]), 'позиция или туман не загрузились');
  // старое сохранение версии 4: туман строкой → участки без потерь, позиции нет
  const d4 = { ...d, v: 4, seen: packSeen(W.seen) }; delete d4.pos; delete d4.gen; st.setItem('berserk3d.save', JSON.stringify(d4));
  const s4 = loadSave(30, st), b = new Uint8Array(W.seen.length); unpackSeenChunks(s4.seen, b, W.seenN);
  ok(s4 && !s4.pos && b.every((v, i) => v === W.seen[i]), 'миграция 4 → 5 потеряла туман или выдумала позицию');
  // другой мир: туман, позиция и таймеры боссов сбрасываются, прогресс — нет
  const dg = { ...d, gen: CFG3.world.gen + 1, bosses: { devourer: 300 } }; st.setItem('berserk3d.save', JSON.stringify(dg));
  const sg = loadSave(30, st); ok(sg && !sg.seen && !sg.pos && !Object.keys(sg.bosses).length && sg.prog.lv === W.lv, 'другой номер мира не сбросил туман, позицию или боссов');
  // мусор в участках отбрасывается
  st.setItem('berserk3d.save', JSON.stringify({ ...d, seen: { n: W.seenN, c: { 'a,b': '*', '0,0': '!!!', '999,0': '*', '1,1': '*' } } }));
  const sj = loadSave(30, st); ok(sj && Object.keys(sj.seen.c).join() === '1,1', 'мусор в тумане не отброшен: ' + JSON.stringify(sj && sj.seen));
}

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Устройство большого мира 3D: OK');
