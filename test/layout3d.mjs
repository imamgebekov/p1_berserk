// Тест сборки подземелий 3D (шаг H2): комнаты и коридоры не наложены, все связаны, стены не залезают на пол,
// вход, лестница и контейнеры свободны, до каждой комнаты можно дойти (с отрядом, через двери), бот не выходит за стены, туман внизу.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, travel, spawnAlly, isSeen } from '../3d/src/sim.js';
import { makeLevelMap, makeMap, roomAt, pathStep, resolve } from '../3d/src/map.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const clone = () => JSON.parse(JSON.stringify(CFG3));
const D = CFG3.dungeons;
const area = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0));
const center = r => ({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 });
const free = (M, x, z, r) => { const o = { x, z }; resolve(M, o, r); return Math.hypot(o.x - x, o.z - z) < 1e-6; };
const mk = (seed = 1) => { const c = clone(); c.enemies.count = 0; c.party.on = false; for (const d of c.dungeons.list) { d.spawns = []; d.guard = null; } c.bosses.list = c.bosses.list.filter(b => !b.level); const W = createWorld(c, mulberry32(seed)); for (const k of Object.keys(c.dungeons.keys)) W.keys[k] = true; return W; };   // ключи — в locks3d.mjs   // геометрия без врагов: они — в delve3d.mjs
// довести героя до точки: по графу комнат через проходы; false — не дошёл за время
function walkTo(W, tx, tz, sec = 25) {
  const p = W.player;
  for (let i = 0; i < sec * 60; i++) {
    if (Math.hypot(p.x - tx, p.z - tz) < .7) return true;
    const w = pathStep(W.map, p.x, p.z, tx, tz, W.keys) || { x: tx, z: tz }, dx = w.x - p.x, dz = w.z - p.z, d = Math.hypot(dx, dz) || 1;
    step(W, 1 / 60, { mx: dx / d, mz: dz / d });
  }
  return false;
}

// ---------- 1. геометрия каждого подземелья ----------
for (const def of D.list) {
  let M = null;
  try { M = makeLevelMap(CFG3, def); } catch (e) { ok(false, `${def.id}: карта не собралась: ${e.message}`); continue; }
  const R = M.rooms, tag = def.id;
  ok(new Set(R.map(r => r.id)).size === R.length, `${tag}: имена комнат не повторяются`);
  for (let a = 0; a < R.length; a++) for (let b = a + 1; b < R.length; b++) ok(area(R[a], R[b]) < 1e-6, `${tag}: комнаты ${R[a].id} и ${R[b].id} наложены`);
  for (const w of M.blocks) if (!w.fill && !w.pit) for (const r of R) ok(area(w, r) < 1e-6, `${tag}: стена залезает на пол ${r.id}`);     // заливка углов круглых залов и провалы — внутри зала намеренно
  // связность: из комнаты входа достижима любая
  const ri = roomAt(M, def.entry.x, def.entry.z), seen = new Set([ri]), q = [ri];
  ok(ri >= 0, `${tag}: вход не в комнате`);
  while (q.length) { const r = q.shift(); for (const li of M.adj[r]) { const l = M.links[li], o = l.a === r ? l.b : l.a; if (!seen.has(o)) { seen.add(o); q.push(o); } } }
  ok(seen.size === R.length, `${tag}: не все комнаты связаны (${seen.size} из ${R.length})`);
  // проходы не уже героя, двери не шире предела
  for (const l of M.links) ok(l.s1 - l.s0 >= 1.6, `${tag}: проход ${R[l.a].id}–${R[l.b].id} уже 1.6 м`);
  for (const d of M.doors) ok(d.w <= D.doorMax + 1e-6, `${tag}: дверь шире ${D.doorMax} м`);
  ok(M.doors.length === (def.doors || []).length, `${tag}: все двери на месте`);
  // точки: вход, лестница, контейнеры — в комнатах и не в стенах
  ok(roomAt(M, def.exit.x, def.exit.z) >= 0 && free(M, def.exit.x, def.exit.z, .5), `${tag}: лестница в стене или вне комнат`);
  ok(free(M, def.entry.x, def.entry.z, .5), `${tag}: вход в стене`);
  ok(Math.hypot(def.entry.x - def.exit.x, def.entry.z - def.exit.z) > D.reach, `${tag}: вход ближе кнопки к лестнице`);
  for (const c of M.containers) ok(roomAt(M, c.x, c.z) >= 0 && free(M, c.x, c.z, .45), `${tag}: контейнер ${c.kind} в стене или вне комнат`);
  for (const r of R) ok(free(M, center(r).x, center(r).z, .5), `${tag}: центр ${r.id} занят`);
  // закрытая дверь держит, открытая пропускает
  for (const d of M.doors) {
    const o = { x: d.x, z: d.z }; d.open = 0; resolve(M, o, .5); ok(Math.hypot(o.x - d.x, o.z - d.z) > .3, `${tag}: закрытая дверь не держит`);
    const o2 = { x: d.x, z: d.z }; d.open = 1; resolve(M, o2, .5); ok(Math.hypot(o2.x - d.x, o2.z - d.z) < 1e-6, `${tag}: открытая дверь не пропускает`);
    d.open = 0;
  }
}

// ---------- 2. пешком до каждой комнаты, отряд следом ----------
for (const def of D.list) {
  const W = mk(3); W.lv = 20;
  spawnAlly(W, 'guard'); spawnAlly(W, 'guard'); spawnAlly(W, 'guard');
  travel(W, def.id, def.entry.x, def.entry.z);
  const M = W.map;
  ok(W.allies.length === 3 && W.allies.every(a => roomAt(M, a.x, a.z) >= 0), `${def.id}: отряд спустился`);
  // обход в порядке удалённости по графу, затем возврат к лестнице
  for (const r of M.rooms) {
    const c = center(r);
    ok(walkTo(W, c.x, c.z), `${def.id}: не дошёл до ${r.id} (застрял у ${W.player.x.toFixed(1)}, ${W.player.z.toFixed(1)})`);
    for (let i = 0; i < 240; i++) step(W, 1 / 60, {});
    const pr = roomAt(M, W.player.x, W.player.z);
    ok(W.allies.every(a => Math.hypot(a.x - W.player.x, a.z - W.player.z) < 7), `${def.id}: отряд отстал в ${r.id}: ` + W.allies.map(a => `${a.x.toFixed(1)},${a.z.toFixed(1)}`).join(' | '));
    ok(pr >= 0, `${def.id}: герой вне комнат в ${r.id}`);
  }
  ok(walkTo(W, def.exit.x + .5, def.exit.z, 60), `${def.id}: не вернулся к лестнице`);
  ok(M.doors.every(d => d.open >= 0 && d.open <= 1), `${def.id}: двери в пределах 0–1`);
}

// ---------- 3. бот бегает и перекатывается 60 с: не выходит за стены ----------
for (const def of D.list) {
  const W = mk(4), rnd = mulberry32(11);
  travel(W, def.id, def.entry.x, def.entry.z);
  let out = 0, dir = 0;
  for (let i = 0; i < 3600; i++) {
    if (i % 40 === 0) dir = rnd() * Math.PI * 2;
    step(W, 1 / 60, { mx: Math.sin(dir), mz: Math.cos(dir), roll: i % 53 === 0 });
    if (roomAt(W.map, W.player.x, W.player.z) < 0) out++;
  }
  ok(out === 0, `${def.id}: бот выходил за стены ${out} кадров`);
}

// ---------- 4. туман внизу: своя клетка, открывается рядом с героем ----------
{
  const def = D.list.reduce((a, b) => (b.rooms.length > a.rooms.length ? b : a)), W = mk(5);
  travel(W, def.id, def.entry.x, def.entry.z);
  ok(W.seenC === D.cell && W.revR === D.reveal, 'внизу своя клетка тумана и радиус');
  const far = W.map.rooms.reduce((a, r) => (Math.hypot(center(r).x - def.entry.x, center(r).z - def.entry.z) > Math.hypot(center(a).x - def.entry.x, center(a).z - def.entry.z) ? r : a));
  ok(isSeen(W, def.entry.x, def.entry.z) && !isSeen(W, center(far).x, center(far).z), 'у входа открыто, дальняя комната в тумане');
  walkTo(W, center(far).x, center(far).z); step(W, .4, {});
  ok(isSeen(W, center(far).x, center(far).z), 'дошёл — дальняя комната открылась');
  travel(W, 'surface', 0, 4);
  ok(W.seenC === CFG3.map.cell && W.revR === CFG3.map.reveal, 'наверху прежняя клетка тумана');
}

// ---------- 5. скорость: шаг мира в самом большом подземелье с отрядом ----------
{
  const def = D.list.reduce((a, b) => (b.rooms.length > a.rooms.length ? b : a)), W = mk(6); W.lv = 20;
  spawnAlly(W, 'guard'); spawnAlly(W, 'guard'); spawnAlly(W, 'guard');
  travel(W, def.id, def.entry.x, def.entry.z);
  const t0 = performance.now(); for (let i = 0; i < 1200; i++) step(W, 1 / 60, { mx: Math.sin(i / 90), mz: Math.cos(i / 70) }); const ms = performance.now() - t0;
  console.log(`  ${def.id}: стен ${W.map.blocks.length}, дверей ${W.map.doors.length}, 1200 шагов за ${ms.toFixed(0)} мс`);
  ok(ms < 3000, 'шаг мира внизу слишком медленный: ' + ms.toFixed(0) + ' мс');
}

// ---------- 6. скрытые подземелья не видны наверху ----------
{
  const map = makeMap(clone());
  for (const def of D.list) ok(map.portals.some(q => q.to === def.id) === (!def.hidden && !def.sub), `${def.id}: люк наверху ${def.hidden ? 'есть, хотя скрыто' : 'пропал'}`);
}

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Сборка подземелий 3D: OK');
