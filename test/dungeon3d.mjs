// Тест уровней 3D (шаг H1): люк и лестница, отдельные карта, враги, вещи и туман у каждого уровня, смерть внизу, отряд, сохранение.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, spawnEnemy, respawnPlayer, mulberry32, usePortal, portalNear, depthAt, travel, spawnAlly } from '../3d/src/sim.js';
import { createSaver, loadSave, applyDseen } from '../3d/src/save3d.js';
import { makeMap, insideOf } from '../3d/src/map.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const clone = () => JSON.parse(JSON.stringify(CFG3));
const mk = (seed = 1, tweak) => { const c = clone(); c.enemies.count = 0; for (const d of c.dungeons.list) { d.spawns = []; d.guard = null; } c.bosses.list = c.bosses.list.filter(b => !b.level); if (tweak) tweak(c); return createWorld(c, mulberry32(seed)); };   // враги внизу — в delve3d.mjs
const run = (W, sec, input = {}, dt = 1 / 60) => { for (let i = 0; i < Math.round(sec / dt); i++) step(W, dt, typeof input === 'function' ? input(i) : input); };
const D = CFG3.dungeons.list[0];
const toHatch = W => { W.player.x = D.at.x + .5; W.player.z = D.at.z; step(W, 1 / 60, {}); };
const mem = () => { const o = {}; return { getItem: k => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); }, removeItem: k => { delete o[k]; }, o }; };

// ---------- 1. уровни и люк ----------
{
  const W = mk();
  ok(W.lvl === 'surface' && W.levels[D.id], 'есть поверхность и погреб');
  ok(W.map.portals.filter(q => !q.abyssEnter && !q.stair).length === CFG3.dungeons.list.filter(d => !d.hidden && !d.sub).length, 'на поверхности по люку на каждое открытое подземелье');
  ok(CFG3.dungeons.list.filter(d => d.hidden).every(d => !W.map.portals.some(q => q.to === d.id)), 'у скрытых подземелий люка наверху нет');
  ok(!portalNear(W), 'у костра люка нет');
  toHatch(W);
  ok(W.nearPortal && W.nearPortal.to === D.id, 'у люка кнопка «Спуститься»');
  const surf = W.map, surfSeen = W.seen;
  ok(usePortal(W), 'спуск удался');
  ok(W.lvl === D.id && W.map !== surf && W.map.bounds, 'текущая карта — погреб');
  ok(Math.hypot(W.player.x - D.entry.x, W.player.z - D.entry.z) < .01, 'герой у входа в погреб');
  ok(W.ev.some(v => v.k === 'travel' && v.to === D.id), 'событие перехода');
  ok(W.seen !== surfSeen && W.seen.some(v => v), 'у погреба свой туман, вход открыт');
  run(W, .1);
  ok(W.place && W.place.id === D.id, 'место: ' + (W.place && W.place.name));
  ok(!W.nearPortal, 'у входа кнопка «Подняться» не появляется сразу (не нажать случайно)');
  ok(depthAt(W, 0, 0) === D.depth, 'глубина в погребе из конфига');
  // стены: бег в любую сторону не выводит за комнату
  const B = W.map.bounds;
  for (const [mx, mz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [.7, .7]]) { run(W, 3, { mx, mz }); const p = W.player; ok(p.x > B.x0 && p.x < B.x1 && p.z > B.z0 && p.z < B.z1, `стены держат (${mx}, ${mz}): ${p.x.toFixed(2)}, ${p.z.toFixed(2)}`); }
  // перекат в стену тоже не проходит
  W.player.x = 0; W.player.z = 0; W.player.face = Math.PI / 2; run(W, .1, { roll: true, mx: 1 }); run(W, 1, { mx: 1 }); ok(W.player.x < B.x1, 'перекат не проходит сквозь стену');
  // подъём
  W.player.x = D.exit.x + .3; W.player.z = D.exit.z; step(W, 1 / 60, {});
  ok(W.nearPortal && W.nearPortal.up, 'у лестницы кнопка «Подняться»');
  usePortal(W);
  ok(W.lvl === 'surface' && W.map === surf && W.seen === surfSeen, 'вернулись на поверхность к её карте и туману');
  ok(Math.hypot(W.player.x - D.back.x, W.player.z - D.back.z) < .01, 'наверху герой рядом с люком');
  step(W, 1 / 60, {}); ok(!W.nearPortal, 'наверху герой стоит не на люке');
}

// ---------- 2. люк и место возврата на поверхности: свободны и достижимы ----------
{
  const map = makeMap(clone());
  const rectHit = (x, z, r, w) => { const cx = Math.max(w.x0, Math.min(w.x1, x)), cz = Math.max(w.z0, Math.min(w.z1, z)); return Math.hypot(x - cx, z - cz) < r; };
  const blocked = (x, z, r = .5) => map.walls.some(w => rectHit(x, z, r, w)) || map.solids.some(s => Math.hypot(s.x - x, s.z - z) < s.r + r);
  for (const d of CFG3.dungeons.list.filter(d => !d.hidden && !d.sub)) {
    ok(!blocked(d.at.x, d.at.z, .9) && insideOf(map, d.at.x, d.at.z, 1) === -1, `люк ${d.id} не в стене и не в доме`);
    ok(!blocked(d.back.x, d.back.z, .6), `место возврата ${d.id} свободно`);
    ok(Math.hypot(d.back.x - d.at.x, d.back.z - d.at.z) > CFG3.dungeons.reach, `место возврата ${d.id} дальше кнопки`);
    ok(Math.hypot(d.entry.x - d.exit.x, d.entry.z - d.exit.z) > CFG3.dungeons.reach, `вход ${d.id} дальше лестницы`);
    for (const c of map.containers) ok(Math.hypot(c.x - d.at.x, c.z - d.at.z) > 1.8, `люк ${d.id} рядом с контейнером`);
  }
}

// ---------- 3. контейнеры погреба ----------
{
  const W = mk(2);
  const L = W.levels[D.id];
  ok(L.map.containers.length === D.chests.length && L.map.containers.every(c => c.ready && c.items.length), 'контейнеры погреба наполнены с начала');
  toHatch(W); usePortal(W);
  const c = W.map.containers[0], bag0 = W.inv.bag.length;
  W.player.x = c.x - .6; W.player.z = c.z; run(W, .2);
  ok(!c.ready && W.inv.bag.length > bag0, 'контейнер в погребе открывается');
  W.player.x = D.exit.x; W.player.z = D.exit.z; step(W, 1 / 60, {}); usePortal(W);
  run(W, CFG3.map.containerRespawn + 2, {}, .25);
  ok(c.ready, 'контейнер погреба наполняется, пока герой наверху');
}

// ---------- 4. враги: наверху ждут, внизу кольцом не рождаются ----------
{
  const W = mk(3, c => { c.enemies.count = 6; });
  W.player.x = 60; W.player.z = 60; run(W, 4);
  const before = W.enemies.filter(e => !e.boss).length;
  toHatch(W); const up = W.enemies;
  usePortal(W);
  ok(W.enemies !== up && W.enemies.length === 0, 'в погребе свои враги (пусто)');
  run(W, 30);
  ok(W.enemies.length === 0, 'в погребе враги кольцом не рождаются');
  W.player.x = D.exit.x; W.player.z = D.exit.z; step(W, 1 / 60, {}); usePortal(W);
  ok(W.enemies === up && W.enemies.filter(e => !e.boss).length >= before - 0, 'враги поверхности на месте');
  // враг у люка не бьёт героя, ушедшего вниз
  const e = spawnEnemy(W, 'imp', D.at.x + 1, D.at.z); e.alert = true;
  toHatch(W); const hp = W.player.hp; usePortal(W); run(W, 3);
  ok(W.player.hp >= hp, 'враг сверху не достаёт героя в погребе');
}

// ---------- 5. боссы ----------
{
  const W = mk(4);
  const boss = W.enemies.find(e => e.boss); boss.hp = 1; boss.dead = true; W.bossDead[boss.type] = 2;
  toHatch(W); usePortal(W); run(W, 3);
  ok(!W.enemies.some(e => e.boss), 'босс не появляется в погребе');
  ok(W.levels.surface.enemies.some(e => e.boss && !e.dead && e.type === boss.type), 'босс возродился наверху, пока герой внизу');
  ok(!W.hudBoss, 'полоски босса в погребе нет');
}

// ---------- 6. смерть внизу ----------
{
  const W = mk(5); W.inv.ash = 100;
  toHatch(W); usePortal(W);
  W.player.x = 2; W.player.z = 1; W.player.hp = 1; W.player.inv = 0;
  const e = spawnEnemy(W, 'brute', 3, 1); e.alert = true;
  run(W, 4);
  ok(W.player.dead, 'герой погиб в погребе');
  ok(W.tomb && W.tomb.lvl === D.id, 'могила помнит погреб: ' + JSON.stringify(W.tomb));
  respawnPlayer(W);
  ok(W.lvl === 'surface' && Math.hypot(W.player.x, W.player.z - 4) < .01, 'возрождение у костра на поверхности');
  const ash = W.inv.ash; W.player.x = W.tomb.x; W.player.z = W.tomb.z; run(W, .1);
  ok(W.tomb && W.inv.ash === ash, 'наверху в той же точке пепел не подбирается');
  toHatch(W); usePortal(W); W.player.x = W.tomb.x; W.player.z = W.tomb.z; run(W, .1);
  ok(!W.tomb && W.inv.ash > ash, 'в погребе пепел подбирается');
}

// ---------- 7. отряд идёт следом ----------
{
  const W = mk(6); W.lv = 10;
  toHatch(W); spawnAlly(W, 'guard'); spawnAlly(W, 'guard');
  usePortal(W);
  const B = W.map.bounds;
  ok(W.allies.every(a => a.x >= B.x0 && a.x <= B.x1 && a.z >= B.z0 && a.z <= B.z1), 'бойцы спустились в погреб');
  run(W, 3, { mx: 1 });
  ok(W.allies.every(a => Math.hypot(a.x - W.player.x, a.z - W.player.z) < 6), 'бойцы идут за героем внизу');
}

// ---------- 8. сохранение ----------
{
  const W = mk(7), st = mem(), sv = createSaver(W, st);
  W.player.x = 0; W.player.z = 0; run(W, .5);
  toHatch(W); usePortal(W); run(W, .5);
  W.tomb = { x: 1, z: 1, ash: 5, lvl: D.id };
  sv.write(true);
  const d = JSON.parse(st.o['berserk3d.save']);
  ok(d.dseen && typeof d.dseen[D.id] === 'string', 'туман погреба сохраняется');
  const s = loadSave(CFG3.bag.slots, st);
  ok(s && s.tomb.lvl === D.id && s.dseen[D.id] === d.dseen[D.id], 'загрузка: могила в погребе и туман погреба');
  const W2 = mk(7); applyDseen(W2, s.dseen);
  ok(W2.levels[D.id].seen.join('') === W.levels[D.id].seen.join(''), 'туман погреба восстанавливается при загрузке');
  const W3 = mk(7); applyDseen(W3, { [D.id]: (W.levels[D.id].seenN + 1) + ':' + d.dseen[D.id].split(':')[1] });
  ok(!W3.levels[D.id].seen.some(v => v), 'туман другой сетки (подземелье перестроили) не переносится');
  st.setItem('berserk3d.save', JSON.stringify({ ...d, dseen: { [D.id]: '////' } }));
  ok(!Object.keys(loadSave(CFG3.bag.slots, st).dseen).length, 'туман погреба из H1 (без размера сетки) отброшен');
  const surfSeen = W.levels.surface.seen.reduce((a, b) => a + b, 0);
  ok(surfSeen > 0 && d.seen && Object.keys(d.seen.c).length > 0, 'туман поверхности сохраняется, даже если герой внизу');
  // старое сохранение без уровня и с мусором
  st.setItem('berserk3d.save', JSON.stringify({ ...d, tomb: { x: 1, z: 2, ash: 3 }, dseen: { [D.id]: 5, nope: 'AAAA' } }));
  const o = loadSave(CFG3.bag.slots, st);
  ok(o && o.tomb.lvl === 'surface' && !Object.keys(o.dseen).length, 'старое сохранение: могила наверху, мусор в тумане отброшен');
  st.setItem('berserk3d.save', JSON.stringify({ ...d, tomb: { x: 1, z: 2, ash: 3, lvl: 'нет_такого' } }));
  ok(loadSave(CFG3.bag.slots, st).tomb.lvl === 'surface', 'неизвестный уровень могилы → поверхность');
}

// ---------- 9. устойчивость: много переходов подряд и шаг без ввода ----------
{
  const W = mk(8, c => { c.enemies.count = 5; });
  for (let i = 0; i < 40; i++) { toHatch(W); usePortal(W); run(W, .2, { attack: true }); W.player.x = D.exit.x; W.player.z = D.exit.z; step(W, 1 / 60, {}); usePortal(W); run(W, .2); }
  ok(W.lvl === 'surface' && W.map === W.levels.surface.map && Array.isArray(W.enemies) && Number.isFinite(W.player.x), '40 спусков и подъёмов без поломок');
  ok(!travel(W, 'нет_такого', 0, 0) && W.lvl === 'surface', 'переход на неизвестный уровень отклоняется');
  ok(W.ev.length <= 200, 'очередь событий ограничена');
}

// ---------- 10. свой поток случайных чисел у подземелий ----------
{
  const sig = W => JSON.stringify({ c: W.levels.surface.map.containers.map(c => c.items), s: W.shop.stock, r: [W.rng(), W.rng(), W.rng()] });
  const play = W => {
    const p = W.player; for (const [t, dx, dz] of [['imp', 2, 0], ['brute', -2, 1], ['hound', 0, -2.5]]) spawnEnemy(W, t, p.x + dx, p.z + dz);
    run(W, 20, i => ({ attack: i % 15 < 3, roll: i % 97 === 0 }));
    return { k: W.kills, s: JSON.stringify({ x: p.x.toFixed(4), hp: p.hp.toFixed(4), e: W.enemies.map(e => e.hp), r: W.rng() }) };
  };
  const a = mk(5), b = mk(5, c => { c.dungeons.list = []; });
  ok(sig(a) === sig(b), 'подземелья не сдвигают случайные числа поверхности');
  const pa = play(mk(6)), pb = play(mk(6, c => { c.dungeons.list = []; }));
  ok(pa.k > 0 && pa.k === pb.k && pa.s === pb.s, 'бой наверху одинаков с подземельями и без них: ' + pa.k + ' / ' + pb.k);
  const w = mk(5); toHatch(w); usePortal(w);
  ok(w.rng === w.levels[D.id].rng && w.rng !== w.levels.surface.rng, 'внизу работает поток подземелья');
  w.player.x = D.exit.x; w.player.z = D.exit.z; step(w, 1 / 60, {}); usePortal(w);
  ok(w.rng === w.levels.surface.rng, 'наверху снова поток поверхности');
  const g = createWorld(clone());
  ok(g.levels[D.id].rng === Math.random, 'в игре добыча погреба случайна (Math.random), а не одна и та же');
}

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Уровни и погреб 3D: OK');
