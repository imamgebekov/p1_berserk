// Тест защиты сохранений 3D (шаг 11 аудита): раз в bakEvery прошлое сохранение уходит в bak1, прежняя bak1 — в bak2;
// испорченное основное — загрузка из копии (и копия становится основной, испорченное откладывается); копии тоже испорчены —
// новая игра; ошибка записи (кончилось место) — сообщение onFail, игра не падает; сброс стирает и копии; имя файла.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, mulberry32 } from '../3d/src/sim.js';
import { createSaver, loadSaveAny, BAK, BROKEN, saveFileName, exportSave, importSave } from '../3d/src/save3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const clone = () => JSON.parse(JSON.stringify(CFG3));
const mk = (seed = 1) => { const c = clone(); c.enemies.count = 0; c.bosses.list = []; c.map.places = []; return createWorld(c, mulberry32(seed)); };
const mem = (quota = Infinity) => { const o = {}; return { getItem: k => (k in o ? o[k] : null), setItem: (k, v) => { const size = Object.entries(o).reduce((a, [kk, vv]) => a + (kk === k ? 0 : vv.length), 0) + String(v).length; if (size > quota) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; } o[k] = String(v); }, removeItem: k => { delete o[k]; }, o }; };
const slots = 60, KEY = 'berserk3d.save';

// копии по времени
{ const W = mk(), st = mem(); let t = 0; const sv = createSaver(W, st, { now: () => t, bakEvery: 300000 });
  W.kills = 1; sv.write(true); ok(!st.o[BAK[0]], 'копия появилась сразу');
  t = 301000; W.kills = 2; sv.write(true); ok(st.o[BAK[0]] && JSON.parse(st.o[BAK[0]]).kills === 1 && JSON.parse(st.o[KEY]).kills === 2, 'bak1 — не прошлое сохранение');
  W.kills = 3; sv.write(true); ok(JSON.parse(st.o[BAK[0]]).kills === 1, 'копия обновилась раньше срока');
  t = 602000; W.kills = 4; sv.write(true); ok(JSON.parse(st.o[BAK[1]]).kills === 1 && JSON.parse(st.o[BAK[0]]).kills === 3, 'bak2 не сдвинулась');
  // испорченное основное — из копии
  st.o[KEY] = '{"v":6,"hero":'; const r = loadSaveAny(slots, st);
  ok(r && r.from === 'bak1' && r.save.kills === 3, 'не загрузилось из bak1: ' + JSON.stringify(r && { from: r.from, k: r.save.kills }));
  ok(st.o[BROKEN] === '{"v":6,"hero":' && JSON.parse(st.o[KEY]).kills === 3, 'испорченное не отложено или копия не стала основной');
  // испорчены основное и bak1 — из bak2
  st.o[KEY] = 'мусор'; st.o[BAK[0]] = 'мусор'; const r2 = loadSaveAny(slots, st); ok(r2 && r2.from === 'bak2' && r2.save.kills === 1, 'не загрузилось из bak2');
  // всё испорчено — новая игра, без падения
  st.o[KEY] = 'x'; st.o[BAK[0]] = 'x'; st.o[BAK[1]] = 'x'; ok(loadSaveAny(slots, st) === null, 'испорченные копии дали сохранение');
  // нет основного — новая игра, копии не воскрешают сброшенную игру
  delete st.o[KEY]; st.o[BAK[0]] = JSON.stringify({ v: 6 }); ok(loadSaveAny(slots, st) === null, 'после сброса поднялась старая копия'); }
// целое основное — из него
{ const W = mk(), st = mem(); W.kills = 7; createSaver(W, st).write(true); const r = loadSaveAny(slots, st); ok(r && r.from === 'main' && r.save.kills === 7, 'целое основное не загрузилось'); }
// ошибка записи
{ const W = mk(), st = mem(10); let fail = null; const sv = createSaver(W, st, { onFail: e => { fail = e; } });
  let threw = false; try { ok(sv.write(true) === false, 'запись без места вернула успех'); } catch (e) { threw = true; }
  ok(!threw && fail && fail.name === 'QuotaExceededError', 'ошибка записи не дошла до onFail или уронила игру'); }
// сброс стирает и копии
{ const W = mk(), st = mem(); let t = 0; const sv = createSaver(W, st, { now: () => t, bakEvery: 1 }); W.kills = 1; sv.write(true); t = 5; W.kills = 2; sv.write(true); t = 10; W.kills = 3; sv.write(true);
  ok(st.o[BAK[0]] && st.o[BAK[1]], 'копий нет перед сбросом'); sv.reset(); ok(!st.o[KEY] && !st.o[BAK[0]] && !st.o[BAK[1]], 'сброс оставил копии');
  ok(!sv.write() && !sv.write(true) && !st.o[KEY], 'после сброса автосохранение (уход со страницы) вернуло старый прогресс'); }
// файл: имя и код туда-обратно
{ ok(saveFileName(new Date(2026, 9, 7)) === 'berserk3d-save-2026-10-07.txt', 'имя файла: ' + saveFileName(new Date(2026, 9, 7)));
  const W = mk(), st = mem(); W.kills = 9; createSaver(W, st).write(true); const code = exportSave(st), st2 = mem();
  ok(code.startsWith('B3D1:') && importSave(code + '\n', slots, st2) === 'ok' && JSON.parse(st2.o[KEY]).kills === 9, 'код из файла не загрузился'); }

if (fails.length) { console.log('savesafe3d FAIL\n' + [...new Set(fails)].join('\n')); process.exit(1); }
console.log('Защита сохранений 3D: OK');
