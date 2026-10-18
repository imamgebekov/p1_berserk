// Тест полировки телефона 3D: личные настройки, подсказки, вибрация, экспорт и импорт сохранения, версии.
import { CFG3 } from '../3d/src/config3d.js';
import { sanitizePrefs, loadPrefs, savePrefs, DEFAULT_PREFS, HINTS, nextHint, buzz, UI_SCALES } from '../3d/src/prefs3d.js';
import { createSaver, loadSave, exportSave, importSave, migrate, SAVE_VERSION } from '../3d/src/save3d.js';
import { abilityPointsAt } from '../3d/src/data/abilities3d.js';
import { createWorld, step, mulberry32 } from '../3d/src/sim.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const mem = () => { const o = {}; return { getItem: k => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); }, removeItem: k => { delete o[k]; }, o }; };

// ---- настройки ----
const d = DEFAULT_PREFS(); ok(!d.lefty && d.ui === 1 && d.vibrate && !d.fps && d.hints && !Object.keys(d.seen).length, 'умолчания');
const s = sanitizePrefs({ lefty: 'да', ui: 5, vibrate: 0, fps: true, hints: false, seen: { move: true, 'Плохо!': true, x: 1, hurt: true } });
ok(s.lefty === false && s.ui === 1 && s.vibrate === true && s.fps === true && s.hints === false && s.seen.move && s.seen.hurt && !s.seen['Плохо!'] && !s.seen.x, 'санитайзер: ' + JSON.stringify(s));
for (const bad of [null, undefined, 5, 'x', []]) ok(JSON.stringify(sanitizePrefs(bad)) === JSON.stringify(d), 'мусор → умолчания');
for (const [, v] of UI_SCALES) ok(sanitizePrefs({ ui: v }).ui === v, 'масштаб ' + v);
{ const st = mem(); const P = DEFAULT_PREFS(); P.lefty = true; P.ui = 1.2; P.seen.move = true; ok(savePrefs(P, st) && JSON.stringify(loadPrefs(st)) === JSON.stringify(P), 'сохранение настроек'); st.setItem('berserk3d.prefs', '{oops'); ok(JSON.stringify(loadPrefs(st)) === JSON.stringify(d), 'битые настройки'); }

// ---- подсказки ----
const mk = (seed = 1) => { const cfg = JSON.parse(JSON.stringify(CFG3)); cfg.enemies.count = 0; cfg.bosses.list = []; return createWorld(cfg, mulberry32(seed)); };
ok(new Set(HINTS.map(h => h.id)).size === HINTS.length && HINTS.every(h => /^[a-z_]{1,20}$/.test(h.id) && h.text.length > 10), 'данные подсказок');
{ const W = mk(), P = DEFAULT_PREFS(); step(W, 1 / 60, {}); ok(nextHint(W, P) === null, 'в самом начале подсказок нет'); W.t = 3; const h = nextHint(W, P); ok(h && h.id === 'move', 'первая подсказка про ходьбу');
  P.seen.move = true; ok(nextHint(W, P) === null, 'показанная не повторяется'); W.player.hp = 10; ok(nextHint(W, P).id === 'hurt', 'подсказка про перекат при низком здоровье');
  P.hints = false; ok(nextHint(W, P) === null, 'выключены'); P.hints = true; W.night = true; P.seen.hurt = true; ok(nextHint(W, P).id === 'night', 'подсказка про ночь');
  for (const x of HINTS) P.seen[x.id] = true; ok(nextHint(W, P) === null, 'все показаны'); }
// ---- вибрация ----
{ let called = 0; const def = v => Object.defineProperty(globalThis, 'navigator', { value: v, configurable: true, writable: true });
  def({ vibrate: () => { called++; } }); buzz({ vibrate: true }, 30); buzz({ vibrate: false }, 30); ok(called === 1, 'вибрация только при включении'); def({}); buzz({ vibrate: true }, 30); def(undefined); buzz({ vibrate: true }, 30); }

// ---- экспорт и импорт ----
{ const W = mk(2); W.inv.ash = 777; W.kills = 12; W.lv = 5; W.sp = 4; W.t = 99; W.quests = { m_imps: { s: 'done', n: 0, ok: false, t: 3 } }; const a = mem(); createSaver(W, a).write(true);
  const code = exportSave(a); ok(code.startsWith('B3D1:') && !/\s/.test(code), 'код выгрузки'); const b = mem(); ok(importSave(code, 30, b) === 'ok', 'импорт кода');
  const l = loadSave(30, b); ok(l && l.inv.ash === 777 && l.kills === 12 && l.prog.lv === 5 && l.t === 99 && l.quests.m_imps.s === 'done', 'данные после переноса: ' + JSON.stringify(l && l.prog));
  ok(exportSave(mem()) === '', 'нечего экспортировать');
  const before = JSON.stringify(b.o); for (const bad of ['', null, 'привет', 'B3D1:', 'B3D1:!!!', 'B3D1:' + btoa('not json'), 'B3D1:' + btoa(JSON.stringify({ v: 99 })), 'B3D1:' + btoa(JSON.stringify([1, 2])), 'X' + code]) ok(importSave(bad, 30, b) === 'bad', 'отказ: ' + String(bad).slice(0, 20));
  ok(JSON.stringify(b.o) === before, 'плохой код ничего не испортил'); ok(importSave(code + ' \n', 30, mem()) === 'ok', 'пробелы вокруг кода'); }
// ---- версии ----
{ const st = mem(); st.setItem('berserk3d.save', JSON.stringify({ v: SAVE_VERSION + 1, inv: {} })); ok(loadSave(30, st) === null, 'сохранение из будущей версии не читается'); st.setItem('berserk3d.save', 'мусор'); ok(loadSave(30, st) === null, 'мусор'); st.setItem('berserk3d.save', 'null'); ok(loadSave(30, st) === null, 'null');
  const d0 = { v: SAVE_VERSION }; ok(migrate(d0) === d0 && d0.v === SAVE_VERSION && !('keys' in d0) && !('hero' in d0) && !('prog' in d0), 'миграция текущей версии ничего не делает');
  const d1 = { v: 1 }; migrate(d1); ok(d1.v === SAVE_VERSION && Array.isArray(d1.keys) && !d1.keys.length && d1.unlocked && !Object.keys(d1.unlocked).length, 'миграция 1 → 2: пустая связка ключей');
  const d2 = { v: 2, keys: ['k'] }; migrate(d2); ok(d2.v === SAVE_VERSION && d2.hero === 'thorn' && d2.keys[0] === 'k', 'миграция 2 → 3: старое сохранение — Торн');
  const d3 = { v: 3, prog: { lv: 10 } }; migrate(d3); ok(d3.v === SAVE_VERSION && d3.prog.ap === abilityPointsAt(10, CFG3) && d3.prog.ap === 8 && !Object.keys(d3.prog.ab).length, 'миграция 3 → 4: очки умений по уровню'); }

if (fails.length) { console.error('prefs3d FAIL\n' + fails.join('\n')); process.exit(1); }
console.log('prefs3d OK, подсказок:', HINTS.length);
