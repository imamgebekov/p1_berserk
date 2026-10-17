// Тест суток и звука 3D: свет по времени, ночь в симуляции (враги, опыт, торговец), краски неба, набор звуков.
import { CFG3 } from '../3d/src/config3d.js';
import { lightOf, isNight, phaseOf, clockText, mix, skyAt } from '../3d/src/daynight.js';
import { SFX_NAMES, sfx, setAmbient, setVolume } from '../3d/src/audio3d.js';
import { createWorld, step, mulberry32, buyItem, sellItem, sellJunk, gainXp, refreshGear } from '../3d/src/sim.js';
import { readFileSync } from 'node:fs';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const D = CFG3.daynight;

// ---- время ----
ok(!isNight(0, D) && lightOf(0, D) > .9, 'игра начинается днём: ' + lightOf(0, D));
let nights = 0, minL = 1, maxL = 0, prev = isNight(0, D), flips = 0;
for (let t = 0; t < D.len * 3; t += 1) { const L = lightOf(t, D); ok(L >= 0 && L <= 1 && Number.isFinite(L), 'свет вне 0..1'); minL = Math.min(minL, L); maxL = Math.max(maxL, L); const n = isNight(t, D); if (n) nights++; if (n !== prev) flips++; prev = n; }
ok(minL < .05 && maxL > .95, `есть настоящая ночь и день: ${minL} ${maxL}`); const share = nights / (D.len * 3); ok(share > .2 && share < .5, 'доля ночи разумна: ' + share); ok(flips === 6, 'три суток = шесть смен: ' + flips);
ok(Math.abs(lightOf(10, D) - lightOf(10 + D.len, D)) < 1e-9, 'сутки периодичны'); ok(phaseOf(-5, D) >= 0 && phaseOf(-5, D) < 1, 'фаза при отрицательном времени');
ok(/^\d\d:\d\d$/.test(clockText(123, D)) && clockText(0, { ...D, start: 0 }) === '06:00', 'часы: ' + clockText(0, { ...D, start: 0 }));
ok(mix('#000000', '#ffffff', .5) === '#808080' && mix('#102030', '#102030', .3) === '#102030', 'смешение цветов');
for (const L of [0, .3, 1]) { const k = skyAt(L, D.sky); ok(/^#[0-9a-f]{6}$/.test(k.fog) && /^#[0-9a-f]{6}$/.test(k.sun) && k.hemiI > 0 && k.sunI > 0, 'небо при ' + L); }
ok(skyAt(0, D.sky).hemiI + skyAt(0, D.sky).sunI < skyAt(1, D.sky).hemiI + skyAt(1, D.sky).sunI && skyAt(0, D.sky).fog === D.sky.night.fog && skyAt(1, D.sky).fog === D.sky.day.fog, 'ночь темнее дня');

// ---- симуляция ----
const mk = (seed = 1, t = 0) => { const cfg = JSON.parse(JSON.stringify(CFG3)); const W = createWorld(cfg, mulberry32(seed)); W.t = t; return W; };
const nightT = (() => { for (let t = 0; t < D.len; t++) if (isNight(t, D)) return t; return -1; })();
{ const W = mk(1, 0); step(W, 1 / 60, {}); ok(!W.night && W.light > .9, 'день в симуляции');
  W.ev.length = 0; W.t = nightT - .01; step(W, .05, {}); ok(W.night && W.ev.some(v => v.k === 'dusk'), 'событие заката'); W.ev.length = 0; step(W, 1 / 60, {}); ok(!W.ev.some(v => v.k === 'dusk'), 'закат один раз');
  W.t = 0; W.ev.length = 0; step(W, .05, {}); ok(!W.night && W.ev.some(v => v.k === 'dawn'), 'событие рассвета'); }
{ // опыт, удача, торговец
  const d = mk(2, 0), n = mk(2, nightT + 1); step(d, 1 / 60, {}); step(n, 1 / 60, {}); ok(n.night && !d.night, 'ночь/день');
  gainXp(d, 100); gainXp(n, 100); const gx = W => W.ev.filter(v => v.k === 'xp').pop().n; ok(gx(d) === 100 && gx(n) === Math.round(100 * D.night.xp), `ночью больше опыта: ${gx(d)} ${gx(n)}`);
  refreshGear(d); refreshGear(n); ok(n.gear.luck - d.gear.luck === D.night.luck, 'удача ночью');
  for (const W of [d, n]) { const b = W.map.buildings.find(x => x.npc && x.npc.kind === 'merchant'); W.player.x = b.npc.x + 1; W.player.z = b.npc.z; W.inv.ash = 999; W.inv.bag.push({ id: 'k_goblet', n: 1 }); W.shop.stock = W.shop.stock.length ? W.shop.stock : [{ id: 'f_rye', n: 3 }]; W.shop.t = 0; step(W, 1 / 60, {}); }
  ok(buyItem(n, 0) === 'closed' && sellItem(n, n.inv.bag.length - 1) === 'closed' && sellJunk(n) === -1, 'ночью торговец спит'); ok(buyItem(d, 0) === 'ok', 'днём торгует'); }
{ // больше врагов ночью
    // время идёт во время прогона, поэтому сравниваем состояние сразу после первой секунды
  const a = (() => { const W = mk(3, 0); W.player.x = 30; W.player.z = -30; for (let i = 0; i < 600; i++) step(W, 1 / 30, {}); return W.enemies.filter(e => !e.dead && !e.boss).length; })();
  const b = (() => { const W = mk(3, nightT + 5); W.player.x = 30; W.player.z = -30; for (let i = 0; i < 600; i++) step(W, 1 / 30, {}); return W.enemies.filter(e => !e.dead && !e.boss).length; })();
  ok(b >= a + 1, `ночью врагов больше: день ${a}, ночь ${b}`); }

// ---- звук ----
ok(SFX_NAMES.length >= 34, 'звуков мало: ' + SFX_NAMES.length);
sfx('hit'); sfx('нет'); setAmbient(.5, 1); setVolume(5); // без контекста ничего не падает
const src = ['sim', 'squad3d', 'progress3d', 'economy3d', 'places3d'].map(f => readFileSync(new URL(`../3d/src/${f}.js`, import.meta.url), 'utf8')).join('') + readFileSync(new URL('../3d/src/boss3d.js', import.meta.url), 'utf8') + readFileSync(new URL('../3d/src/status3d.js', import.meta.url), 'utf8') + readFileSync(new URL('../3d/src/craft3d.js', import.meta.url), 'utf8');
for (const k of ['swing', 'hit', 'hurt', 'die', 'roll', 'pickup', 'open', 'unlock', 'locked', 'level', 'bossaggro', 'bossdead', 'boom', 'craft', 'hire', 'tomb']) ok(SFX_NAMES.includes(k) && src.includes(`k: '${k}'`), 'звук и событие ' + k);
for (const k of ['dusk', 'dawn']) ok(SFX_NAMES.includes(k), 'звук ' + k);

if (fails.length) { console.error('daynight3d FAIL\n' + fails.join('\n')); process.exit(1); }
console.log('daynight3d OK, ночь с t=' + nightT + ', звуков: ' + SFX_NAMES.length);
