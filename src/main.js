import './style.css';
import { CFG } from './config.js';
import { W } from './state.js';
import { env } from './env.js';
import { step } from './sim.js';
import { makeNpcs } from './world.js';
import { rise } from './combat.js';
import { chat, npcSay } from './chat.js';
import { after } from './clock.js';
import { ensureAudio, isMuted, setMuted } from './audio.js';
import { createRenderer } from './render/index.js';
import { createHud } from './hud.js';
import { bindInput } from './input.js';
import { createInventoryUI } from './ui/inventory.js';
import { giveItem, newItem, recalc } from './inventory.js';
import { P } from './state.js';

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
const inventoryUI = createInventoryUI(document);

$('go').addEventListener('click', () => {
  ensureAudio(); $('start').hidden = true; W.started = true;
  chat('', 'Ты вошёл в мир. Костёр слева, пустошь справа.', 'sys');
  after(2.2, () => npcSay('новенький? у костра можно отдышаться'));
});
$('rise').addEventListener('click', rise);
$('mute').addEventListener('click', () => {
  setMuted(!isMuted()); $('mute').textContent = 'звук: ' + (isMuted() ? 'выкл' : 'вкл');
});

let last = performance.now();
function loop(now) {
  const dt = Math.min(CFG.view.maxDt, (now - last) / 1000); last = now;
  step(dt);
  renderer.render(dt);
  hud.update();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// для отладки с компьютера: window.__berserk
import { ITEMS_BY_ID } from './data/items.js';
window.__berserk = { W, P, giveItem, newItem, inventoryUI, slotOf: id => ITEMS_BY_ID[id].slot, recalc };
