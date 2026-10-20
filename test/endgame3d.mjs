// Тест этапа 6 «круче»: достижения (подвиги), «Бездна», «Новый круг», недельное «Затмение».
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, killEnemy, spawnEnemy } from '../3d/src/sim.js';
import { ACH, achEvents, titlesOf, capesOf, serializeAch, sanitizeAch } from '../3d/src/achieve3d.js';
import { abyssDef, abyssLine, eclipseMods, weekOf } from '../3d/src/abyss3d.js';
import { usePortal, portalNear, portalName, eclipseGo } from '../3d/src/sim.js';
import { makeLevelMap, insideOf, roomAt } from '../3d/src/map.js';
import { ngOpen, startNg } from '../3d/src/ng3d.js';
import { createSaver } from '../3d/src/save3d.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const mk = (tweak) => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.wanderer.on = false; c.events.on = false; for (const d of c.dungeons.list) d.spawns = []; if (tweak) tweak(c); return createWorld(c, mulberry32(1)); };
const run = (W, s) => { const out = []; for (let i = 0; i < Math.round(s * 60); i++) { step(W, 1 / 60, {}); out.push(...W.ev.filter(v => v.k === 'ach')); W.ev.length = 0; } return out; };

// ---------- 1. подвиги: список, награды, счётчики, сохранение ----------
{
  ok(ACH.length >= 40 && new Set(ACH.map(a => a.id)).size === ACH.length, `подвигов ${ACH.length}`);
  ok(ACH.every(a => a.n > 0 && (a.reward.ash || a.reward.title || a.reward.cape)), 'подвиг без цели или награды');
  const W = mk(); ok(W.ach && !Object.keys(W.ach.got).length, 'новый мир с подвигами');
  W.kills = 9; ok(run(W, 1.2).length === 0, 'подвиг раньше цели');
  const ash0 = W.inv.ash; W.kills = 10; const got = run(W, 1.2);
  ok(got.some(v => v.id === 'k10') && W.inv.ash >= ash0 + 50, 'подвиг «Первая кровь» или его пепел');
  ok(run(W, 2).every(v => v.id !== 'k10'), 'подвиг выдан дважды');
  // счётчик из событий, в том числе пришедших между шагами (сдача задания из окна)
  W.ev.push({ k: 'questdone', name: 'x' }); for (let i = 0; i < 9; i++) W.ev.push({ k: 'questdone', name: 'x' }); run(W, 1.2);
  ok(W.ach.got.quests10 !== undefined, 'задания из окна не засчитаны: ' + W.ach.c.quest);
  W.ev.push({ k: 'questdone' }); achEvents(W); achEvents(W); ok(W.ach.c.quest === 11, 'событие засчитано дважды: ' + W.ach.c.quest);
  // титул и плащ
  W.kills = 1000; W.lv = 60; run(W, 1.2);
  ok(titlesOf(W).includes('Жнец') && W.ach.title === 'Жнец', 'титул «Жнец» не надет: ' + W.ach.title);
  ok(capesOf(W).some(c => c.name === 'Пепельно-белый плащ'), 'плащ за 60-й уровень');
  W.ach.cape = capesOf(W)[0].color;
  const back = sanitizeAch(JSON.parse(JSON.stringify(serializeAch(W.ach))));
  ok(back.got.k10 !== undefined && back.title === 'Жнец' && back.cape === W.ach.cape && back.c.quest === 11, 'сохранение подвигов');
  const cheat = sanitizeAch({ got: { k10: 5, fake: 1 }, title: 'Глубинный', cape: '#ffffff', c: { kills: -3, x: 'a' } });
  ok(!cheat.got.fake && cheat.title === null && cheat.cape === null && !('kills' in cheat.c), 'мусор или незаработанное в сохранении');
  // элита и босс по событиям
  const W2 = mk(); W2.ev.push({ k: 'die', elite: true }, { k: 'die', boss: true }); achEvents(W2); ok(W2.ach.c.elite === 1 && W2.ach.c.boss === 1, 'элита или босс не посчитаны');
  const off = mk(c => { c.ach.on = false; }); off.kills = 100; ok(run(off, 1.2).length === 0, 'ach.on=false — подвиги выдаются');
}
// ---------- 2. Бездна: ярусы из комнат, вход с уровня, спуск после зачистки, награда, рекорд, время ----------
{
  for (const t of [1, 5, 12, 30]) {
    const d = abyssDef(CFG3, t, CFG3.abyss.at), M = makeLevelMap(CFG3, d);
    ok(d.spawns.length >= 2 && d.spawns.every(s => s.n >= 1) && d.foes.length >= 3, `ярус ${t}: враги`);
    ok(roomAt(M, d.down.x, d.down.z) >= 0 && roomAt(M, d.entry.x, d.entry.z) >= 0, `ярус ${t}: спуск или вход вне комнат`);
    ok(d.level === CFG3.abyss.level[0] + t * CFG3.abyss.level[1] && d.mods.length === Math.min(2, Math.floor(t / CFG3.abyss.modEvery)), `ярус ${t}: уровень или модификаторы`);
    ok(JSON.stringify(abyssDef(CFG3, t, CFG3.abyss.at)) === JSON.stringify(d), `ярус ${t}: разный при повторе`);
  }
  const W = mk(), hatch = W.levels.surface.map.portals.find(q => q.abyssEnter);
  ok(hatch && insideOf(W.map, hatch.x, hatch.z) < 0, 'нет люка Бездны или он в доме');
  W.player.x = hatch.x; W.player.z = hatch.z; run(W, .1);
  ok(portalName(W, portalNear(W)) === 'Спуститься: Бездна', 'имя люка');
  W.lv = CFG3.abyss.lv - 1; ok(!usePortal(W) && W.lvl === 'surface', 'Бездна открыта раньше уровня');
  W.lv = CFG3.abyss.lv; ok(usePortal(W) && W.lvl === 'abyss' && W.abyss && W.abyss.tier === 1 && W.enemies.length >= 4, 'вход в Бездну');
  ok(W.enemies.every(e => e.lvl >= CFG3.abyss.level[0]), 'уровень врагов Бездны');
  const dn = () => W.map.portals.find(q => q.abyssNext);
  W.player.x = dn().x; W.player.z = dn().z; run(W, .1); ok(!usePortal(W) && W.abyss.tier === 1, 'спуск открыт при живых врагах');
  for (const e of W.enemies) killEnemy(W, e, 1); run(W, .5); ok(W.abyss.open && /спуск открыт/.test(abyssLine(W)), 'ярус не открылся: ' + abyssLine(W));
  const ash = W.inv.ash, map1 = W.map; ok(usePortal(W) && W.abyss.tier === 2 && W.map !== map1 && W.inv.ash > ash, 'спуск на ярус 2 или награда');
  run(W, .05); ok(W.ach.c.abyss === 1, 'рекорд Бездны: ' + W.ach.c.abyss);
  ok(W.enemies.every(e => e.abyss && !e.dead) && Math.hypot(W.player.x + 1.5, W.player.z) < 2, 'новый ярус: враги или место героя');
  W.abyss.t = .5; run(W, 1); ok(W.lvl === 'surface' && !W.abyss, 'время вышло — не выброшен наверх');
}
// ---------- 3. Затмение недели: модификаторы по неделе, награда раз в неделю ----------
{
  const wk = weekOf(Date.UTC(2026, 9, 19)); ok(wk === weekOf(Date.UTC(2026, 9, 25)) && wk + 1 === weekOf(Date.UTC(2026, 9, 26)), 'неделя считается не с понедельника');
  ok(eclipseMods(wk).length === 3 && JSON.stringify(eclipseMods(wk)) === JSON.stringify(eclipseMods(wk)) && JSON.stringify(eclipseMods(wk)) !== JSON.stringify(eclipseMods(wk + 1)), 'модификаторы недели');
  const W = mk(c => { c.abyss.eclipse.goal = 2; }), hatch = W.levels.surface.map.portals.find(q => q.abyssEnter); W.lv = 60;
  W.player.x = hatch.x; W.player.z = hatch.z; run(W, .1);
  ok(eclipseGo(W, wk) && W.abyss.week === wk && JSON.stringify(W.abyss.mods) === JSON.stringify(eclipseMods(wk)), 'вход в Затмение');
  const evs = []; const go = () => { for (const e of W.enemies) killEnemy(W, e, 1); for (let i = 0; i < 30; i++) { step(W, 1 / 60, {}); evs.push(...W.ev); W.ev.length = 0; } const d = W.map.portals.find(q => q.abyssNext); W.player.x = d.x; W.player.z = d.z; step(W, 1 / 60, {}); usePortal(W); step(W, 1 / 60, {}); evs.push(...W.ev); W.ev.length = 0; };     // события входа — до шага, как в игре
  go(); ok(W.abyss.tier === 2 && JSON.stringify(W.abyss.mods) === JSON.stringify(eclipseMods(wk)), 'ярус 2 Затмения с теми же модификаторами');
  const ash = W.inv.ash; go(); ok(evs.some(v => v.k === 'eclipseDone') && W.ach.c.ewk === wk, 'Затмение не засчитано');
  ok(!(W.ach.c.abyss > 0), 'Затмение пишет рекорд Бездны');
  run(W, 1.2); ok(W.ach.got.eclipse1 !== undefined, 'подвиг «Неделя Затмения»');
}
// ---------- 4. Новый круг: после Акта IV; сюжет и задания заново, вещи на месте; враги сильнее; сохранение ----------
{
  const W = mk(); ok(!ngOpen(W) && !startNg(W), 'Новый круг до конца сюжета');
  const e0 = spawnEnemy(W, 'brute', 30, 30);
  W.story.st = 'end'; W.story.i = 99; W.quests = { m_imps: { s: 'done', n: 0, ok: false, t: 0 } }; const bag = W.inv.bag.length, lv = W.lv = 60;
  ok(ngOpen(W) && startNg(W) && W.ng === 1 && W.story.i === 0 && W.story.st === 'wait' && !Object.keys(W.quests).length, 'Новый круг не начался');
  ok(W.inv.bag.length === bag && W.lv === lv, 'Новый круг забрал вещи или уровень');
  const e1 = spawnEnemy(W, 'brute', 30, 30); ok(e1.maxhp > e0.maxhp * 1.3 && e1.dmgMul > e0.dmgMul * 1.2, `враг круга не сильнее: ${e0.maxhp} → ${e1.maxhp}`);
  let el = 0, dual = 0; for (let i = 0; i < 300; i++) { const e = spawnEnemy(W, 'hound', 20, 20); if (e.elite) { el++; if (e.aff2) dual++; } }
  ok(el > 0 && dual === el, `элита круга: ${el}, с двумя свойствами ${dual}`);
  const mem = () => { const o = {}; return { getItem: k => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); }, removeItem: k => { delete o[k]; }, o }; };
  const st = mem(); createSaver(W, st).write(true); const raw = JSON.parse(Object.values(st.o).find(v => /"prog"/.test(v))); ok(raw.prog.ng === 1, 'круг не сохранён');
}
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.slice(0, 30).join('\n')); process.exit(1); }
console.log(`Конец игры 3D: OK (подвигов ${ACH.length})`);
