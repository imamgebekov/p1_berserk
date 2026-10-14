import { CFG3 } from './config3d.js';
import { createWorld, step, respawnPlayer, spawnEnemy } from './sim.js';
import { BY_ID, RARITY } from './data/items.js';
import { CONTAINERS } from './data/loot.js';
import { createBag } from './bag.js';
import { createShop, createSmith, createCaptain } from './shop.js';
import { createSkills } from './skillsui.js';
import { xpNeed, reveal, restoreAllies } from './sim.js';
import { drawMap } from './mapdraw.js';
import { STATUS_NAME, STATUS_COLOR } from './status3d.js';
import { loadSave, createSaver, unpackSeen } from './save3d.js';
import { createRenderer } from './render.js';
import { rotateInput } from './map.js';
import { createInput } from './input.js';
import { loadTweaks, createTweakPanel } from './tweak.js';

const $ = id => document.getElementById(id);
const defaults = JSON.parse(JSON.stringify(CFG3));
const cfg = JSON.parse(JSON.stringify(CFG3));
loadTweaks(cfg);

// iOS Safari местами игнорирует touch-action: страницу нельзя ни листать, ни тянуть, ни масштабировать, пока открыта не панель
const inPanel = e => e.target.closest && e.target.closest('#panel, #bag, #shop, #smith, #skills, #map, #captain');
document.addEventListener('touchmove', e => { if (!inPanel(e)) e.preventDefault(); }, { passive: false });
for (const g of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(g, e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = $('gl');
let renderer;
try {
  renderer = createRenderer(canvas, cfg, { onText, onHurt, onEvent, preserve: new URLSearchParams(location.search).has('shot') });
} catch (e) {
  $('nogl').hidden = false; console.warn('WebGL недоступен', e);
}

const W = createWorld(cfg);
const saved = loadSave(cfg.bag.slots);
if (saved) { W.inv = saved.inv; W.kills = saved.kills; Object.assign(W, saved.prog); unpackSeen(saved.seen, W.seen); restoreAllies(W, saved.squad); }
const saver = createSaver(W);
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
function toast(txt, cls = '', color) {
  const box = $('toasts'), d = document.createElement('div');
  d.className = 'toast ' + cls; d.textContent = txt; if (color) d.style.color = color;
  box.appendChild(d); while (box.children.length > 6) box.firstChild.remove();
  setTimeout(() => d.remove(), 3500);
}
function onEvent(v) {
  if (v.k === 'pickup') { const it = BY_ID[v.id]; toast('+ ' + it.name + (v.n > 1 ? ' ×' + v.n : ''), '', RARITY[it.rar].color); }
  else if (v.k === 'open') toast(CONTAINERS[v.kind].name, 'sys');
  else if (v.k === 'locked') toast(`Заперто: нужен ключ уровня ${v.tier}+`, 'bad');
  else if (v.k === 'unlock') toast('Замок открыт', 'sys');
  else if (v.k === 'full') toast('Сумка полна', 'bad');
  else if (v.k === 'buff') toast('Действует зелье', 'sys');
  else if (v.k === 'place') showPlace(v.place);
  else if (v.k === 'allydead') toast(`${v.name} пал`, 'bad');
  else if (v.k === 'hire') toast(`${v.name} теперь с вами`, 'sys');
  else if (v.k === 'level') toast(`Уровень ${v.lv}! Очко навыков ✦`, '', '#e8c04a');
  else if (v.k === 'xp') onText(v.x, 3, v.z, '+' + v.n + ' оп.', 'xp');
}
function showPlace(pl) {
  const el = $('place'); el.hidden = !pl; if (!pl) return;
  el.className = pl.safe ? 'safe' : 'danger';
  el.textContent = pl.safe ? `${pl.name} · безопасно` : `${pl.name} · опасность ${'▮'.repeat(pl.danger)}${'▯'.repeat(3 - pl.danger)}`;
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
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

const bag = createBag(document, W, cfg, {
  onOpen: () => { panelOpen = true; input.release(); },
  onClose: () => { panelOpen = false; saver.write(); },
  onChange: () => saver.write(),
  onReset: () => { saver.reset(); location.reload(); }
});
const shop = createShop(document, W, cfg, {
  onOpen: () => { panelOpen = true; input.release(); },
  onClose: () => { panelOpen = false; saver.write(); },
  onChange: () => { saver.write(); bag.render(); }
});
const skills = createSkills(document, W, cfg, {
  onOpen: () => { panelOpen = true; input.release(); },
  onClose: () => { panelOpen = false; saver.write(); },
  onChange: () => saver.write()
});
const captain = createCaptain(document, W, cfg, {
  onOpen: () => { panelOpen = true; input.release(); },
  onClose: () => { panelOpen = false; saver.write(); },
  onChange: () => saver.write()
});
const smith = createSmith(document, W, cfg, {
  onOpen: () => { panelOpen = true; input.release(); },
  onClose: () => { panelOpen = false; saver.write(); },
  onChange: () => { saver.write(); bag.render(); }
});
createTweakPanel(document, cfg, defaults, {
  onChange: t => { if (t && (t.reload || t.path === 'view.pixelScale')) fit(); },
  onOpen: () => { panelOpen = true; input.release(); },
  onClose: () => { panelOpen = false; }
});
$('again').addEventListener('click', () => { respawnPlayer(W); $('dead').hidden = true; });
document.addEventListener('visibilitychange', () => { if (document.hidden) { input.release(); saver.write(); } });
addEventListener('pagehide', () => saver.write());

const talk = $('talk'), xpFill = $('xpFill'), skillBtn = $('skillBtn');
talk.addEventListener('click', e => { e.stopImmediatePropagation(); (W.nearNpc === 'smith' ? smith : W.nearNpc === 'captain' ? captain : shop).open(); }, true);
// карта: миникарта в углу, большая карта по касанию
const miniCtx = $('mini').getContext('2d'), mapCv = $('mapCv'), mapCtx = mapCv.getContext('2d'), mapEl = $('map');
let miniT = 0;
function drawMini() { drawMap(miniCtx, W, { w: 92, h: 92, scale: 2.1, cx: W.player.x, cz: W.player.z, full: false }); }
function drawFull() { drawMap(mapCtx, W, { w: 640, h: 640, scale: 640 / (cfg.world.radius * 2 + 6), cx: 0, cz: 0, full: true }); const pl = W.place; $('mapLegend').textContent = (pl ? `Вы здесь: ${pl.name}. ` : 'Вы в глуши. ') + 'Зелёные круги безопасны, красные опасны (чем краснее, тем хуже). Жёлтые точки: нетронутые контейнеры. Торговец золотой, кузнец рыжий. Закрытое туманом ещё не исследовано.'; }
const mapOpen = () => { drawFull(); mapEl.hidden = false; panelOpen = true; input.release(); };
const mapClose = () => { mapEl.hidden = true; panelOpen = false; };
$('miniBtn').addEventListener('click', () => (mapEl.hidden ? mapOpen() : mapClose()));
$('mapClose').addEventListener('click', mapClose);
const comboEl = $('combo'), statusRow = $('statusRow');
let lastCombo = 0, lastSt = '';
const hpFill = $('hpFill'), hpTxt = $('hpTxt'), killsEl = $('kills');
let saveT = 0, lastHp = -1, lastKey = '', last = performance.now();
function loop(now) {
  const real = (now - last) / 1000, dt = Math.max(0, Math.min(.05, real)); last = now;
  if (!panelOpen && !landscape) {
    const inp = input.read();
    Object.assign(inp, rotateInput(inp.mx, inp.mz, cfg.view.camYaw));        // «вверх» на джойстике = вверх на экране при любом повороте камеры
    if (W.player.dead) inp.attack = inp.roll = false;
    step(W, dt, inp);
  }
  if (renderer) renderer.render(W, panelOpen || landscape ? 0 : dt);
  { const show = !!W.nearNpc && !panelOpen && !landscape; if (talk.hidden === show) talk.hidden = !show; if (show) { const l = W.nearNpc === 'smith' ? 'Кузнец' : W.nearNpc === 'captain' ? 'Наём' : 'Торговать'; if (talk.textContent !== l) talk.textContent = l; } }
  { const n = W.combo.n; if (n !== lastCombo) { comboEl.hidden = n < 2; if (n >= 2) { comboEl.innerHTML = `×${n}<small>+${Math.round(Math.min(.3, n * .02) * 100)}%</small>`; comboEl.classList.remove('pop'); void comboEl.offsetWidth; comboEl.classList.add('pop'); } lastCombo = n; } }
  { const key = Object.keys(W.pst).map(k => k + Math.ceil(W.pst[k].t) + (W.pst[k].n || '')).join(); if (key !== lastSt) { lastSt = key; statusRow.textContent = ''; for (const k of Object.keys(W.pst)) { const c = document.createElement('span'); c.className = 'stch'; c.style.color = STATUS_COLOR[k]; c.textContent = `${STATUS_NAME[k]}${W.pst[k].n > 1 ? ' ×' + W.pst[k].n : ''} ${Math.ceil(W.pst[k].t)}с`; statusRow.appendChild(c); } } }
  if (!panelOpen && (miniT += real) > .12) { miniT = 0; drawMini(); }
  if ((saveT += real) > 8) { saveT = 0; saver.write(); }
  const hp = Math.ceil(W.player.hp) + W.player.maxhp * 1000;
  if (hp !== lastHp) { lastHp = hp; hpFill.style.transform = `scaleX(${W.player.hp / W.player.maxhp})`; hpTxt.textContent = Math.ceil(W.player.hp); }
  { const key = W.kills + ':' + W.inv.ash + ':' + W.lv + ':' + W.xp + ':' + W.sp; if (key !== lastKey) { lastKey = key; killsEl.textContent = `Ур. ${W.lv} · пепел ${W.inv.ash}`; xpFill.style.transform = `scaleX(${W.lv >= cfg.level.max ? 1 : W.xp / xpNeed(W.lv, cfg)})`; skillBtn.classList.toggle('dot', W.sp > 0); } }
  if (W.player.dead && W.player.deadT > .9 && $('dead').hidden) $('dead').hidden = false;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

window.__b3d = { captain, reveal: (x, z, r) => reveal(W, x, z, r), mapOpen, mapClose, skills, spawn: (t, x, z) => spawnEnemy(W, t, x, z), bag, shop, smith, saver, W, cfg, renderer, input, step, respawnPlayer };
