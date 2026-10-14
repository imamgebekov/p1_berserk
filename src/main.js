import './style.css';
import { CFG } from './config.js';
import { W, P } from './state.js';
import { env } from './env.js';
import { step } from './sim.js';
import { makeNpcs } from './world.js';
import { rise } from './combat.js';
import { chat, npcSay } from './chat.js';
import { after } from './clock.js';
import { on } from './events.js';
import { ensureAudio, isMuted, setMuted } from './audio.js';
import { createRenderer } from './render/index.js';
import { createHud } from './hud.js';
import { bindInput } from './input.js';
import { createInventoryUI } from './ui/inventory.js';
import { createTownUI } from './ui/town.js';
import { createConfirmer } from './ui/common.js';
import { stock, buy } from './shop.js';
import { giveItem, newItem, recalc } from './inventory.js';
import { createSaver, applySave } from './save.js';
import { ITEMS_BY_ID } from './data/items.js';
import './quests.js';          // подписывается на события шины

const $ = id => document.getElementById(id);
const mq = matchMedia('(prefers-reduced-motion: reduce)');
env.reduce = mq.matches;
mq.addEventListener?.('change', e => { env.reduce = e.matches; });

const cv = $('c');
const lo = document.createElement('canvas');
const renderer = createRenderer(cv, lo);
const hud = createHud(document);

function resize() { renderer.resize(innerWidth, cv.clientHeight || 400, devicePixelRatio); }
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();
makeNpcs();
bindInput(document, window);
recalc();

// ---- сохранение ----
const saver = createSaver();
let resetting = false;
const loaded = saver.load();
if (loaded.data) {
  applySave(loaded.data);
  $('mute').textContent = 'звук: ' + (isMuted() ? 'выкл' : 'вкл');
}
function resetProgress() { resetting = true; saver.reset(); location.reload(); }
on('save', () => saver.request());
const flush = () => { if (!resetting && W.started) saver.write(); };
addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

// экран входа: сведения о сохранении
{
  const box = $('saveBox'), txt = $('saveTxt'), ng = $('newGame');
  if (loaded.data) {
    $('go').textContent = 'Продолжить';
    txt.textContent = `Сохранение: ур. ${P.lv} · ${P.ash} пепла · затмений пережито: ${W.cycle}` + (loaded.migrated ? ' (формат обновлён, копия сохранена)' : '');
    box.hidden = false;
  } else if (loaded.error) {
    txt.textContent = 'Сохранение повреждено. Копия отложена, начата новая игра.';
    ng.hidden = true; box.hidden = false;
  } else if (!saver.status.available) {
    txt.textContent = 'Сохранение недоступно в этом браузере: прогресс пропадёт при перезагрузке.';
    ng.hidden = true; box.hidden = false;
  }
  const c = createConfirmer(() => { ng.textContent = 'Начать заново'; ng.classList.remove('warn'); });
  ng.addEventListener('click', () => {
    if (!c.is('ng')) { c.arm('ng'); ng.textContent = 'Точно? Прогресс сотрётся'; ng.classList.add('warn'); return; }
    c.clear(); resetProgress();
  });
}

const inventoryUI = createInventoryUI(document, { saver, onReset: resetProgress });
const townUI = createTownUI(document);

$('go').addEventListener('click', () => {
  ensureAudio(); $('start').hidden = true; W.started = true;
  chat('', loaded.data ? 'С возвращением, Странник.' : 'Ты вошёл в мир. Костёр слева, пустошь справа.', 'sys');
  after(2.2, () => npcSay('новенький? у костра можно отдышаться'));
  saver.request();
});
$('rise').addEventListener('click', rise);
$('mute').addEventListener('click', () => {
  setMuted(!isMuted()); $('mute').textContent = 'звук: ' + (isMuted() ? 'выкл' : 'вкл'); saver.request();
});

let last = performance.now();
function loop(now) {
  const real = (now - last) / 1000, dt = Math.min(CFG.view.maxDt, real); last = now;
  step(dt);
  saver.tick(Math.min(real, 1));
  renderer.render(dt);
  hud.update();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// для отладки с компьютера и для браузерного теста: window.__berserk
window.__berserk = { W, P, giveItem, newItem, inventoryUI, townUI, stock, buy, saver, applySave, slotOf: id => ITEMS_BY_ID[id].slot, recalc };
