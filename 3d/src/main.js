import { CFG3 } from './config3d.js';
import { createWorld, step, respawnPlayer } from './sim.js';
import { createRenderer } from './render.js';
import { rotateInput } from './map.js';
import { createInput } from './input.js';
import { loadTweaks, createTweakPanel } from './tweak.js';

const $ = id => document.getElementById(id);
const defaults = JSON.parse(JSON.stringify(CFG3));
const cfg = JSON.parse(JSON.stringify(CFG3));
loadTweaks(cfg);

// iOS Safari местами игнорирует touch-action: страницу нельзя ни листать, ни тянуть, ни масштабировать, пока открыта не панель
const inPanel = e => e.target.closest && e.target.closest('#panel');
document.addEventListener('touchmove', e => { if (!inPanel(e)) e.preventDefault(); }, { passive: false });
for (const g of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(g, e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = $('gl');
let renderer;
try {
  renderer = createRenderer(canvas, cfg, { onText, onHurt, preserve: new URLSearchParams(location.search).has('shot') });
} catch (e) {
  $('nogl').hidden = false; console.warn('WebGL недоступен', e);
}

const W = createWorld(cfg);
const input = createInput(document, window);
let panelOpen = false, landscape = false;

function onText(x, y, z, txt, cls) {
  if (!renderer) return;
  const p = renderer.project(x, y, z);
  if (!p.vis) return;
  const d = document.createElement('div');
  d.className = 'num ' + cls; d.textContent = txt;
  d.style.left = p.x + 'px'; d.style.top = p.y + 'px';
  $('dmg').appendChild(d);
  setTimeout(() => d.remove(), 900);
}
function onHurt() {
  if (reduce) return;
  const f = $('flash'); f.classList.add('on');
  requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on')));
}

const fit = () => {
  landscape = innerWidth > innerHeight * 1.15 && innerHeight < 520;
  $('rotate').hidden = !landscape;
  renderer && renderer.resize(innerWidth, innerHeight);
};
addEventListener('resize', fit);
addEventListener('orientationchange', () => setTimeout(fit, 200));
fit();

createTweakPanel(document, cfg, defaults, {
  onChange: t => { if (t && (t.reload || t.path === 'view.pixelScale')) fit(); },
  onOpen: () => { panelOpen = true; input.release(); },
  onClose: () => { panelOpen = false; }
});
$('again').addEventListener('click', () => { respawnPlayer(W); $('dead').hidden = true; });
document.addEventListener('visibilitychange', () => { if (document.hidden) input.release(); });

const hpFill = $('hpFill'), hpTxt = $('hpTxt'), killsEl = $('kills');
let lastHp = -1, lastKills = -1, lastAsh = -1, last = performance.now();
function loop(now) {
  const real = (now - last) / 1000, dt = Math.max(0, Math.min(.05, real)); last = now;
  if (!panelOpen && !landscape) {
    const inp = input.read();
    Object.assign(inp, rotateInput(inp.mx, inp.mz, cfg.view.camYaw));        // «вверх» на джойстике = вверх на экране при любом повороте камеры
    if (W.player.dead) inp.attack = inp.roll = false;
    step(W, dt, inp);
  }
  if (renderer) renderer.render(W, panelOpen || landscape ? 0 : dt);
  const hp = Math.ceil(W.player.hp);
  if (hp !== lastHp) { lastHp = hp; hpFill.style.transform = `scaleX(${W.player.hp / W.player.maxhp})`; hpTxt.textContent = hp; }
  if (W.kills !== lastKills || W.ash !== lastAsh) { lastKills = W.kills; lastAsh = W.ash; killsEl.textContent = `убито ${W.kills} · пепел ${W.ash}`; }
  if (W.player.dead && W.player.deadT > .9 && $('dead').hidden) $('dead').hidden = false;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

window.__b3d = { W, cfg, renderer, input, step, respawnPlayer };
