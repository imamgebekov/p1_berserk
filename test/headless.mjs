// Headless-тест: тысячи кадров симуляции + отрисовки с эмуляцией ввода. Ловит исключения, NaN, нарушенные инварианты.
// Запуск: npm test   (опция: SEED=123 FRAMES=30000 npm test)
import { fakeCanvas, stats, audioStats, FakeAudioContext } from './stubs.mjs';
import { CFG } from '../src/config.js';
import { P, W, V, keys, resetState } from '../src/state.js';
import { setRng, mulberry32 } from '../src/util.js';
import { env } from '../src/env.js';
import { step } from '../src/sim.js';
import { makeNpcs } from '../src/world.js';
import { rise, tryBrand, tryRoll } from '../src/combat.js';
import { ensureAudio } from '../src/audio.js';
import { createRenderer } from '../src/render/index.js';
import { newItem, giveItem, equipFromBag, recalc } from '../src/inventory.js';
import { ITEMS } from '../src/data/items.js';
import { SKILL_IDS, SKILLS } from '../src/data/skills.js';
import { learn } from '../src/skills.js';
import { accept } from '../src/quests.js';

globalThis.AudioContext = FakeAudioContext;
import { S as SET, sanitize as sanitizeSettings, loadSettings, setSetting, saveSettings, DEFAULTS as SET_DEFAULTS } from '../src/settings.js';
import { addHold, removeHold, hasHold, clearHolds } from '../src/hold.js';
import { getVolume, setVolume, suspendAudio } from '../src/audio.js';
const SEED = Number(process.env.SEED || 1337);
const FRAMES = Number(process.env.FRAMES || 20000);
const failures = [];
let checks = 0;

function fail(scn, frame, msg) { failures.push(`[${scn}] кадр ${frame}: ${msg}`); }
const fin = v => typeof v === 'number' && Number.isFinite(v);

function invariants(scn, f) {
  checks++;
  for (const k of ['x', 'z', 'vx', 'vz', 'hp', 'maxhp', 'rage', 'rageOn', 'xp', 'ash', 'lv']) if (!fin(P[k])) return fail(scn, f, `P.${k}=${P[k]}`);
  if (P.hp > P.maxhp + 1e-6) fail(scn, f, `hp ${P.hp} > max ${P.maxhp}`);
  if (P.hp < 0) fail(scn, f, `hp<0: ${P.hp}`);
  if (P.rage < 0 || P.rage > CFG.rage.max + 1e-6) fail(scn, f, `rage ${P.rage}`);
  if (P.x < 0 || P.x > CFG.world.length) fail(scn, f, `x вне мира: ${P.x}`);
  if (P.z < 0) fail(scn, f, `z<0: ${P.z}`);
  if (!P.dead && P.hp <= 0) fail(scn, f, 'жив при hp<=0');
  const ids = new Set();
  for (const e of W.enemies) {
    for (const k of ['x', 'hp', 'maxhp', 'vx']) if (!fin(e[k])) return fail(scn, f, `враг ${e.type}.${k}=${e[k]}`);
    if (e.hp <= 0) fail(scn, f, `мёртвый враг в списке: ${e.type}`);
    if (ids.has(e.id)) fail(scn, f, `дубль id ${e.id}`); ids.add(e.id);
  }
  if (W.enemies.length > CFG.spawn.maxAlive + 2) fail(scn, f, `врагов слишком много: ${W.enemies.length}`);
  if (W.boss && !W.enemies.includes(W.boss)) fail(scn, f, 'boss не в списке врагов');
  if (W.parts.length > CFG.fx.maxParticles + 40) fail(scn, f, `частиц ${W.parts.length}`);
  if (W.proj.length > CFG.enemyAi.maxArrows) fail(scn, f, `стрел ${W.proj.length}`);
  for (const a of W.proj) if (!fin(a.x) || !fin(a.z) || !fin(a.vx)) fail(scn, f, 'стрела NaN');
  for (const e of W.enemies) if (!fin(e.z) || e.z < -1e-6 || e.z > 60) fail(scn, f, `враг ${e.type} z=${e.z}`);
  if (!fin(P.rollT) || P.rollT > CFG.roll.duration + 1e-6 || P.rollCd < -1 || P.rollCd > 3) fail(scn, f, `перекат rollT=${P.rollT} cd=${P.rollCd}`);
  if (W.popups.length > CFG.fx.maxPopups) fail(scn, f, `подписей добычи ${W.popups.length}`);
  if (W.timers.length > 200) fail(scn, f, `утечка таймеров: ${W.timers.length}`);
  if (W.chatLog.length > CFG.chat.maxLines) fail(scn, f, `чат ${W.chatLog.length}`);
  for (const k of ['camX', 'T', 'ecl', 'timer', 'shake']) if (!fin(W[k])) return fail(scn, f, `W.${k}=${W[k]}`);
  if (W.ecl < -1e-6 || W.ecl > 1 + 1e-6) fail(scn, f, `ecl ${W.ecl}`);
  if (W.camX < -1e-6 || W.camX > CFG.world.length - V.LW + 1e-6) fail(scn, f, `camX ${W.camX}`);
}

function setup(seed, { reduce = false, cssW = 390, cssH = 640, dpr = 3 } = {}) {
  setRng(mulberry32(seed));
  resetState(); makeNpcs();
  env.reduce = reduce;
  const r = createRenderer(fakeCanvas(), fakeCanvas());
  r.resize(cssW, cssH, dpr);
  ensureAudio();
  W.started = true;
  return r;
}

// --- управляющие «пальцы» ---
function randomPlayer(seed) {
  const rr = mulberry32(seed ^ 0x9e3779b9);
  let hold = { l: 0, r: 0, atk: 0, jump: 0 };
  return () => {
    for (const k of ['l', 'r', 'atk', 'jump']) {
      if (--hold[k] <= 0) { keys[k] = rr() < (k === 'atk' ? .6 : k === 'jump' ? .2 : .4); hold[k] = 5 + Math.floor(rr() * 50); }
    }
    if (rr() < .01) tryBrand();
    if (rr() < .02) tryRoll();
  };
}
function botPlayer() {
  return () => {
    let t = null, best = 1e9;
    for (const e of W.enemies) { const d = Math.abs(e.x - P.x); if (d < best) { best = d; t = e; } }
    keys.l = keys.r = false;
    if (t) {
      const dx = t.x - P.x;
      if (Math.abs(dx) > 22) { keys.r = dx > 0; keys.l = dx < 0; } else P.face = dx > 0 ? 1 : -1;
      keys.atk = Math.abs(dx) < 34;
      keys.jump = t.type === 'boss' && t.st === 'wind' && P.z === 0;
    } else { keys.r = P.x < CFG.world.town + 120; keys.atk = false; keys.jump = false; }
    if (P.rage >= CFG.rage.max) tryBrand();
    // уворот: враг замахнулся рядом или стрела рядом
    if (W.enemies.some(e => (e.st === 'wind' || e.st === 'leap') && Math.abs(e.x - P.x) < 40) || W.proj.some(a => Math.abs(a.x - P.x) < 18)) tryRoll();
  };
}

function run(name, { seed = SEED, frames = FRAMES, dt = 1 / 60, control, reduce = false, cssW, cssH, dpr, preset } = {}) {
  const r = setup(seed, { reduce, cssW, cssH, dpr });
  if (preset) preset();
  const ctl = control(seed);
  let deadFor = 0, maxBoss = 0, bossKills = 0, wasBoss = false, deaths = 0, wasDead = false;
  stats.fillRect = 0;
  let maxRects = 0;
  const t0 = performance.now();
  for (let f = 0; f < frames; f++) {
    try {
      ctl();
      step(dt);
      const before = stats.fillRect;
      r.render(dt);
      maxRects = Math.max(maxRects, stats.fillRect - before);
      if (P.dead) { if (!wasDead) deaths++; if (++deadFor > 90) { rise(); deadFor = 0; } } else deadFor = 0;
      wasDead = P.dead;
      if (W.boss) maxBoss = Math.max(maxBoss, W.boss.maxhp); if (wasBoss && !W.boss) bossKills++; wasBoss = !!W.boss;
    } catch (e) { fail(name, f, 'исключение: ' + (e.stack || e).toString().split('\n').slice(0, 3).join(' | ')); break; }
    if (f % 5 === 0) invariants(name, f);
    if (failures.length > 8) break;
  }
  const ms = performance.now() - t0;
  const res = { name, frames, ms: Math.round(ms), kills: P.kills, lv: P.lv, ash: P.ash, deaths, bossKills, cycle: W.cycle, maxRects, T: +W.T.toFixed(1) };
  console.log(' ', JSON.stringify(res));
  return res;
}

const hash = () => JSON.stringify([P.x.toFixed(3), P.hp.toFixed(3), P.lv, P.kills, P.ash, W.enemies.length, W.cycle, W.T.toFixed(3), W.boss ? W.boss.hp : 0]);

console.log(`Headless-тест, seed=${SEED}`);
const results = [];
results.push(run('случайный ввод', { control: randomPlayer }));
results.push(run('бот-боец', { control: botPlayer, frames: FRAMES * 2 }));
results.push(run('бот @120 Гц', { control: botPlayer, dt: 1 / 120, frames: 12000 }));
results.push(run('бот @30 Гц', { control: botPlayer, dt: 1 / 30, frames: 4000 }));
results.push(run('reduced-motion', { control: randomPlayer, reduce: true, frames: 5000, seed: 7 }));
results.push(run('маленький экран 320×480', { control: randomPlayer, cssW: 320, cssH: 480, dpr: 2, frames: 4000, seed: 11 }));
results.push(run('планшет 1024×700', { control: botPlayer, cssW: 1024, cssH: 700, dpr: 1, frames: 4000, seed: 12 }));

// сильный герой: убедиться, что Предвестник реально умирает и затмение возвращается
const strong = run('сильный герой (босс)', {
  control: botPlayer, frames: 14000, seed: 21,
  preset: () => { P.lv = 25; P.maxhp = P.hp = 400; }
});
results.push(strong);

// полный комплект экипировки (проклятый и клеймёный): эффекты оружия, броня, плащ — в полном кадре
for (const [label, rarity] of [['клеймёный комплект', 'branded'], ['проклятый комплект', 'cursed']]) {
  results.push(run('бот: ' + label, {
    control: botPlayer, frames: 6000, seed: 31,
    preset: () => { P.lv = 10; recalc(); for (const it of ITEMS.filter(i => i.rarity === rarity)) { giveItem(newItem(it.id)); equipFromBag(P.bag.length - 1); } P.hp = P.maxhp; }
  }));
}

// все навыки и три задания: цепочка 5 ударов, долгое Клеймо, лечение у костра, прогресс заданий
results.push(run('бот: все навыки и задания', {
  control: botPlayer, frames: 10000, seed: 41,
  preset: () => { P.lv = 20; P.sp = 40; recalc(); for (const id of SKILL_IDS) for (let i = 0; i < SKILLS[id].max; i++) learn(id, recalc); P.hp = P.maxhp; for (const q of ['q_brutes', 'q_imps', 'q_dress']) accept(q); }
}));

// детерминизм
{
  const a = (() => { run('детерминизм A', { control: botPlayer, frames: 6000, seed: 99 }); return hash(); })();
  const b = (() => { run('детерминизм B', { control: botPlayer, frames: 6000, seed: 99 }); return hash(); })();
  if (a !== b) fail('детерминизм', 0, `разные результаты при одном seed:\n  ${a}\n  ${b}`);
}

// смысловые проверки
const main = results[1];
if (main.kills < 20) fail('смысл', 0, `бот убил слишком мало: ${main.kills}`);
if (main.lv < 2) fail('смысл', 0, 'бот не получил уровень');
if (main.cycle < 1 && strong.cycle < 1) fail('смысл', 0, 'Предвестник ни разу не побеждён');
if (strong.bossKills < 1) fail('смысл', 0, 'сильный герой не убил Предвестника');
if (audioStats.tones < 50) fail('звук', 0, `звук почти не играл: ${audioStats.tones}`);
const rectBudget = 2500;
const worst = Math.max(...results.map(r => r.maxRects));
if (worst > rectBudget) fail('кадр', 0, `в кадре ${worst} fillRect (бюджет ${rectBudget})`);

console.log(`Проверок инвариантов: ${checks}; тонов: ${audioStats.tones}, шумов: ${audioStats.noises}; пик fillRect/кадр: ${worst}`);
// ---- чёткие пиксели: целый масштаб на любых экранах ----
{
  const sizes = [[390, 400, 3], [390, 400, 2], [375, 330, 2], [320, 250, 2], [414, 420, 3], [430, 440, 3], [768, 700, 2], [1024, 560, 2], [1024, 700, 1], [1920, 900, 1], [360, 330, 3], [412, 400, 2.625]];
  const seenLW = [];
  for (const [w, h, dpr] of sizes) {
    const cv = fakeCanvas(); cv.style = {}; const lo = fakeCanvas();
    const r = createRenderer(cv, lo); r.resize(w, h, dpr);
    const S = V.S, label = `${w}×${h}@${dpr}`;
    if (!(Number.isInteger(S) && S >= 1)) fail('пиксели', 0, `${label}: масштаб ${S}`);
    if (cv.width !== V.LW * S || cv.height !== V.LH * S) fail('пиксели', 0, `${label}: холст ${cv.width}×${cv.height} не кратен ${V.LW}×${V.LH}×${S}`);
    if (lo.width !== V.LW || lo.height !== V.LH) fail('пиксели', 0, `${label}: низкий холст ${lo.width}×${lo.height}`);
    if (V.SX !== S || V.SY !== S) fail('пиксели', 0, `${label}: SX/SY не равны S`);
    const effDpr = Math.min(dpr, CFG.view.maxDpr), cssW = cv.width / effDpr, cssH = cv.height / effDpr;
    if (cssW > w + 1 || cssH > h + 1) fail('пиксели', 0, `${label}: холст ${cssW.toFixed(0)}×${cssH.toFixed(0)} больше области`);
    if (w - cssW > S / effDpr + 1) fail('пиксели', 0, `${label}: по ширине остаётся ${(w - cssW).toFixed(1)} css-px`);
    if (V.LH < CFG.view.minHeight || V.LW < CFG.view.minWidth) fail('пиксели', 0, `${label}: кадр слишком мал ${V.LW}×${V.LH}`);
    if (parseFloat(cv.style.top) + cssH > h + 1 || parseFloat(cv.style.left) < 0) fail('пиксели', 0, `${label}: холст вне области (${cv.style.left}, ${cv.style.top})`);
    if (w <= 430 && h >= 330 && (V.LW < 150 || V.LW > 230)) fail('пиксели', 0, `${label}: ширина мира ${V.LW} вне [150; 230] на телефоне`);
    seenLW.push(`${label}→S${S} ${V.LW}×${V.LH}`);
    // кадр рисуется без ошибок при любом размере
    resetState(); makeNpcs(); W.started = true; for (let i = 0; i < 120; i++) { step(1 / 60); r.render(1 / 60); }
    invariants('пиксели ' + label, 0);
  }
  console.log('  масштабы:', seenLW.join(' | '));
}

// ---- паузы, громкость, настройки ----
{
  resetState(); setRng(mulberry32(5)); makeNpcs(); W.started = true; env.reduce = false;
  for (let i = 0; i < 60; i++) step(1 / 60);
  const snap = () => JSON.stringify([P.x, P.hp, W.timer, W.enemies.map(e => e.x)]);
  keys.r = true;
  addHold('pause'); const a = snap(); const t0 = W.T; for (let i = 0; i < 120; i++) step(1 / 60);
  if (snap() !== a) fail('пауза', 0, 'мир двигался при паузе');
  if (!(W.T > t0)) fail('пауза', 0, 'часы игры остановились (чат/анимации должны идти)');
  if (keys.r) fail('пауза', 0, 'кнопки не отпущены при паузе');
  addHold('rotate'); removeHold('pause'); for (let i = 0; i < 30; i++) step(1 / 60);
  if (snap() !== a || !W.hold) fail('пауза', 0, 'пауза «поверните телефон» не держит игру');
  removeHold('rotate'); keys.r = true; for (let i = 0; i < 60; i++) step(1 / 60);
  if (snap() === a || W.hold) fail('пауза', 0, 'игра не продолжилась после снятия пауз');
  keys.r = false; clearHolds(); if (W.hold || hasHold('pause')) fail('пауза', 0, 'clearHolds');

  // громкость: запоминается до создания звука, ограничивается, пауза звука не падает
  setVolume(5); if (getVolume() !== 1) fail('громкость', 0, 'верхний предел'); setVolume(-3); if (getVolume() !== 0) fail('громкость', 0, 'нижний предел'); setVolume(.6);
  suspendAudio(true); suspendAudio(false);

  // настройки: очистка, сохранение, недоступное хранилище, влияние на env.reduce
  const m = new Map(), st = { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
  const fakeDoc = { body: { classList: { s: new Set(), toggle(c, on) { on ? this.s.add(c) : this.s.delete(c); } } } };
  loadSettings(fakeDoc, st, false);
  if (JSON.stringify(SET) !== JSON.stringify(SET_DEFAULTS)) fail('настройки', 0, 'значения по умолчанию');
  setSetting(fakeDoc, 'lefty', true); setSetting(fakeDoc, 'volume', .35); setSetting(fakeDoc, 'reduce', 'on');
  if (!fakeDoc.body.classList.s.has('lefty') || !fakeDoc.body.classList.s.has('reduce') || env.reduce !== true) fail('настройки', 0, 'применение классов/reduce');
  if (getVolume() !== .35) fail('настройки', 0, 'громкость не применилась');
  const saved = JSON.parse(m.get('berserk.settings')); if (saved.lefty !== true || saved.volume !== .35 || saved.reduce !== 'on') fail('настройки', 0, 'сохранение ' + m.get('berserk.settings'));
  setSetting(fakeDoc, 'reduce', 'auto'); if (env.reduce !== false) fail('настройки', 0, 'reduce авто');
  loadSettings(fakeDoc, st, true); if (env.reduce !== true) fail('настройки', 0, 'системное reduced-motion не учтено');
  loadSettings(fakeDoc, st, false);
  for (const junk of [null, 5, 'x', [], { volume: 'громко' }, { volume: 9 }, { volume: -1, reduce: 'зачем', lefty: 1 }]) {
    const s = sanitizeSettings(junk);
    if (!(s.volume >= 0 && s.volume <= 1) || !['auto', 'on'].includes(s.reduce) || typeof s.lefty !== 'boolean' || typeof s.muted !== 'boolean') fail('настройки', 0, 'мусор ' + JSON.stringify(junk) + ' → ' + JSON.stringify(s));
  }
  m.set('berserk.settings', '{oops'); loadSettings(fakeDoc, st, false); if (JSON.stringify(SET) !== JSON.stringify(SET_DEFAULTS)) fail('настройки', 0, 'повреждённые настройки не заменены умолчаниями');
  loadSettings(fakeDoc, { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } }, false);
  if (saveSettings() !== false) fail('настройки', 0, 'запись без хранилища должна вернуть false');
  setSetting(fakeDoc, 'volume', .8); loadSettings(fakeDoc, st, false); setSetting(fakeDoc, 'lefty', false); setSetting(fakeDoc, 'volume', .8);
  env.reduce = false; setVolume(.8); resetState();
}

if (failures.length) {
  console.error('\nПРОВАЛ:\n' + failures.join('\n'));
  process.exit(1);
}
console.log('OK');
