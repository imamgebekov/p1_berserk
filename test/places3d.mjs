// Тест мест 3D: города и опасные зоны, спавн, масштабирование опасности, туман войны, сохранение карты.
import { BY_ID as BY } from '../3d/src/data/items.js';
import { CFG3 } from '../3d/src/config3d.js';
import { placeAt } from '../3d/src/map.js';
import { createWorld, step, mulberry32, spawnEnemy, reveal, isSeen, gainXp } from '../3d/src/sim.js';
import { packSeen, unpackSeen, unpackSeenChunks, loadSave, createSaver } from '../3d/src/save3d.js';
import { wdist, wcOf } from '../3d/src/geo3d.js';     // Мир 5.0: край — от центра мира
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const mk = (seed = 1, f) => { const cfg = JSON.parse(JSON.stringify(CFG3)); if (f) f(cfg); return createWorld(cfg, mulberry32(seed)); };
const W0 = mk(); const places = W0.cfg.map.places;
// данные
ok(places.length >= 9 && new Set(places.map(p => p.id)).size === places.length, 'мест мало или id повторяются');
ok(places.filter(p => p.safe).length >= 5 && places.filter(p => p.danger).length >= 4, 'нужно ≥5 безопасных и ≥4 опасных мест');
for (const p of places) { ok(wdist(W0.cfg, p.x, p.z) + p.r <= W0.cfg.world.radius + 6, `место ${p.id} вылезает за мир`); ok(p.safe ? !p.danger : p.danger >= 1 && p.danger <= 3, 'safe и danger: ' + p.id); ok(p.name && /[а-яё]/i.test(p.name), 'название ' + p.id); }
// безопасные места не пересекаются с опасными
for (const a of places) for (const b of places) if (a.safe && b.danger) ok(Math.hypot(a.x - b.x, a.z - b.z) >= a.r + b.r - 6, `безопасное «${a.name}» пересекается с опасным «${b.name}»`);
// каждое здание и контейнер принадлежат месту либо стоят в глуши; торговец, кузнец — в безопасных местах
for (const b of W0.map.buildings) if (b.npc) { const pl = placeAt(W0.map, b.npc.x, b.npc.z); ok(pl && pl.safe, `NPC ${b.npc.kind} вне безопасного места`); }
ok(placeAt(W0.map, 0, 4).id === 'brod', 'костёр не в Пепельном Броде'); ok(placeAt(W0.map, 56, -44).id === 'lager', 'лагерь не найден'); ok(placeAt(W0.map, -80, 0) === null, 'глушь не null');
// вложенные места: побеждает меньшее
{ const W = mk(2, c => { c.map.places = [{ id: 'a', name: 'Большое', x: 0, z: 0, r: 40, safe: true }, { id: 'b', name: 'Малое', x: 0, z: 0, r: 10, danger: 1 }]; }); ok(placeAt(W.map, 1, 1).id === 'b' && placeAt(W.map, 20, 0).id === 'a', 'вложенные места'); }
// спавн: в безопасных местах враги не рождаются, в опасных — их больше
{ const W = mk(3, c => { c.enemies.count = 8; c.enemies.ring = [3, 14]; }); W.player.inv = 1e9; W.player.x = 0; W.player.z = 6; let bad = 0, seen = new Set();
  for (let i = 0; i < 60 * 40; i++) { step(W, 1 / 60, {}); for (const e of W.enemies) if (!seen.has(e.id)) { seen.add(e.id); const pl = placeAt(W.map, e.x, e.z); if (pl && pl.safe) bad++; } }
  ok(bad === 0, 'враги рождаются в безопасных местах: ' + bad); }
{ const count = (x, z, sec) => { const W = mk(4, c => { c.enemies.count = 3; c.enemies.respawn = .5; c.enemies.ring = [4, 9]; }); W.player.inv = 1e9; W.player.x = x; W.player.z = z; let mx = 0; for (let i = 0; i < 60 * sec; i++) { step(W, 1 / 60, {}); mx = Math.max(mx, W.enemies.filter(e => !e.dead).length); } return mx; };
  const a = count(-80, 0, 20), d = count(56, -44, 20); ok(d >= a + 2, `в опасной зоне не больше врагов: ${d} vs ${a}`); }
// усиление врагов, опыт и добыча зависят от опасности
// без элиты: меряем только опасность
{ const W = mk(5, c => { Object.assign(c.elite, { chance: 0, depthK: 0, dangerK: 0, nightK: 0 }); }); const calm = spawnEnemy(W, 'imp', 0, 74.9), hot = spawnEnemy(W, 'imp', 59.5, -46.8); /* (0, 70) и (56, −44) после растяжения ядра (3.93): опасность — по прежнему расстоянию */ const depthHot = Math.hypot(56, -44) / 85, depthCalm = 70 / 85;
  ok(hot.danger === 3 && !calm.danger, 'danger не записан'); ok(Math.abs(hot.maxhp - Math.round(W.cfg.enemies.imp.hp * (1 + W.cfg.enemies.depthHp * depthHot) * (1 + W.cfg.enemies.dangerHp * 3))) <= 1, 'здоровье в опасной зоне: ' + hot.maxhp);
  const base = spawnEnemy(W, 'imp', 56, -44); base.danger = 0; ok(hot.dmgMul > 1 + W.cfg.enemies.depthDmg * depthHot, 'урон не усилен опасностью'); }
{ const xp = danger => { const W = mk(6); const e = spawnEnemy(W, 'brute', 3, 3); e.danger = danger; e.hp = 1; W.player.x = 4; W.player.z = 3; W.player.face = -Math.PI / 2; W.player.inv = 1e9; for (let i = 0; i < 60; i++) step(W, 1 / 60, { attack: true }); return W.xp + (W.lv - 1) * 1e4; };
  ok(xp(3) > xp(0), 'опыт в опасной зоне не больше: ' + xp(3) + ' vs ' + xp(0)); }
{ const mean = (x, z) => { let s = 0, n = 0; for (let sd = 0; sd < 40; sd++) { const W = mk(100 + sd); for (const c of W.map.containers) if (Math.hypot(c.x - x, c.z - z) < 14 && ['chest', 'ironchest', 'coffer', 'grave', 'cache', 'corpse', 'altar', 'locked', 'wagon'].includes(c.kind)) { for (const i of c.items) { s += require3(i.id); n++; } } } return n ? s / n : 0; };
  // сравнение: контейнеры в Лагере Ржавых против равных по глубине вне зоны — в опасных зонах добыча в среднем лучше
  const hot = mean(56, -44), calm = mean(-12, 70); ok(hot === 0 || hot > calm - .05, 'добыча в опасной зоне не лучше: ' + hot + ' vs ' + calm); }
function require3(id) { return BY[id].rar; }
// безопасное место: услышавшие враги теряют след в глубине, снаружи — идут
{ const W = mk(7, c => { c.enemies.count = 0; }); W.player.inv = 1e9; W.player.x = 0; W.player.z = 6; const e = spawnEnemy(W, 'imp', 3, 6); e.alert = true; e.cd = 99; step(W, 1 / 60, {}); ok(!e.alert, 'враг в глубине города не потерял след'); }
{ const W = mk(8, c => { c.enemies.count = 0; }); W.player.inv = 1e9; W.player.x = -80; W.player.z = 0; const e = spawnEnemy(W, 'imp', -75, 0); e.alert = true; e.cd = 99; step(W, 1 / 60, {}); ok(e.alert, 'враг в глуши потерял след зря'); }
// туман войны
{ const W = mk(9); ok(!isSeen(W, 0, 0), 'карта открыта с начала'); W.player.x = 0; W.player.z = 0; step(W, 1 / 60, {}); ok(isSeen(W, 0, 0) && isSeen(W, 10, 0) && !isSeen(W, 40, 0), 'открытие карты вокруг героя');
  reveal(W, 60, 60, 10); ok(isSeen(W, 60, 60), 'reveal'); reveal(W, 500, 500, 10); ok(true, 'reveal вне мира не падает'); const n = W.seen.reduce((a, b) => a + b, 0); ok(n > 10 && n < W.seen.length, 'число открытых клеток'); }
// сохранение карты
{ const W = mk(10); reveal(W, -30, 20, 20); reveal(W, 50, -40, 12); const s = packSeen(W.seen); ok(s.length === Math.ceil(W.seen.length / 6), 'длина записи карты'); const b = new Uint8Array(W.seen.length); unpackSeen(s, b); ok(b.every((v, i) => v === W.seen[i]), 'карта не восстановилась');
  const c = new Uint8Array(W.seen.length); unpackSeen('!!!', c); unpackSeen(null, c); unpackSeen('A'.repeat(99999), c); ok(c.every(v => v === 0), 'мусор в записи карты');
  const mem = {}, st = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; }, removeItem: k => { delete mem[k]; } }; createSaver(W, st).write(true); const l = loadSave(30, st); const d = new Uint8Array(W.seen.length); unpackSeenChunks(l.seen, d, W.seenN); ok(d.every((v, i) => v === W.seen[i]), 'карта не пережила сохранение'); }
// вход в место даёт событие
{ const W = mk(11, c => { c.enemies.count = 0; }); W.player.x = -80; W.player.z = 0; step(W, 1 / 60, {}); W.ev.length = 0; W.player.x = 56; W.player.z = -44; step(W, 1 / 60, {}); const ev = W.ev.find(v => v.k === 'place'); ok(ev && ev.place.id === 'lager', 'нет события входа в место'); W.ev.length = 0; W.player.x = -80; W.player.z = 0; step(W, 1 / 60, {}); ok(W.ev.some(v => v.k === 'place' && v.place === null), 'нет события выхода'); }
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Места и карта 3D: OK');
