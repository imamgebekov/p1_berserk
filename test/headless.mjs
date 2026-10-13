// Headless-тест: тысячи кадров симуляции + отрисовки с эмуляцией ввода. Ловит исключения, NaN, нарушенные инварианты.
// Запуск: npm test   (опция: SEED=123 FRAMES=30000 npm test)
import { fakeCanvas, stats, audioStats, FakeAudioContext } from './stubs.mjs';
import { CFG } from '../src/config.js';
import { P, W, V, keys, resetState } from '../src/state.js';
import { setRng, mulberry32 } from '../src/util.js';
import { env } from '../src/env.js';
import { step } from '../src/sim.js';
import { makeNpcs } from '../src/world.js';
import { rise, tryBrand } from '../src/combat.js';
import { ensureAudio } from '../src/audio.js';
import { createRenderer } from '../src/render/index.js';

globalThis.AudioContext = FakeAudioContext;
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
if (failures.length) {
  console.error('\nПРОВАЛ:\n' + failures.join('\n'));
  process.exit(1);
}
console.log('OK');
