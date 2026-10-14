import { CFG3 } from './config3d.js';
import { createWorld, step, respawnPlayer, spawnEnemy, spawnBoss } from './sim.js';
import { BY_ID, RARITY } from './data/items.js';
import { CONTAINERS } from './data/loot.js';
import { createBag } from './bag.js';
import { createShop, createSmith, createCaptain } from './shop.js';
import { createSkills } from './skillsui.js';
import { createJournal } from './journal.js';
import { createQuests } from './questsui.js';
import { ensureAudio, setVolume, setMuted, isMuted, suspendAudio, setAmbient, sfx } from './audio3d.js';
import { clockText } from './daynight.js';
import { loadPrefs, savePrefs, nextHint, buzz, UI_SCALES } from './prefs3d.js';
import { trackerLine, questMark } from './quests3d.js';
import { xpNeed, reveal, restoreAllies, restoreBosses, setDifficulty } from './sim.js';
import { drawMap } from './mapdraw.js';
import { STATUS_NAME, STATUS_COLOR } from './status3d.js';
import { loadSave, createSaver, unpackSeen, exportSave, importSave } from './save3d.js';
import { createRenderer } from './render.js';
import { rotateInput } from './map.js';
import { createInput } from './input.js';
import { loadTweaks, createTweakPanel } from './tweak.js';

const $ = id => document.getElementById(id);
const defaults = JSON.parse(JSON.stringify(CFG3));
const cfg = JSON.parse(JSON.stringify(CFG3));
loadTweaks(cfg);

// iOS Safari местами игнорирует touch-action: страницу нельзя ни листать, ни тянуть, ни масштабировать, пока открыта не панель
const inPanel = e => e.target.closest && e.target.closest('#panel, #bag, #shop, #smith, #skills, #map, #captain, #journal, #quests');
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
if (saved) { W.inv = saved.inv; W.kills = saved.kills; Object.assign(W, saved.prog); unpackSeen(saved.seen, W.seen); restoreAllies(W, saved.squad); restoreBosses(W, saved.bosses); if (saved.difficulty) setDifficulty(W, saved.difficulty); W.iron = saved.iron; W.tomb = saved.tomb; W.known = saved.known; W.quests = saved.quests; W.t = saved.t; }
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
const P = loadPrefs();
function onEvent(v) {
  if (v.k === 'hurt') buzz(P, 35); else if (v.k === 'level' || v.k === 'questdone') buzz(P, [40, 40, 70]); else if (v.k === 'bossaggro' || v.k === 'bossblast') buzz(P, 90);
  if (v.x === undefined || Math.hypot(v.x - W.player.x, v.z - W.player.z) < 22) sfx(v.k);
  if (v.k === 'dusk') toast('Наступает ночь: торговец спит, враги злее', 'bad');
  else if (v.k === 'dawn') toast('Светает: торговец снова торгует', 'sys');
  if (v.k === 'pickup') { const it = BY_ID[v.id]; toast('+ ' + it.name + (v.n > 1 ? ' ×' + v.n : ''), '', RARITY[it.rar].color); }
  else if (v.k === 'open') toast(CONTAINERS[v.kind].name, 'sys');
  else if (v.k === 'locked') toast(`Заперто: нужен ключ уровня ${v.tier}+`, 'bad');
  else if (v.k === 'unlock') toast('Замок открыт', 'sys');
  else if (v.k === 'full') toast('Сумка полна', 'bad');
  else if (v.k === 'buff') toast('Действует зелье', 'sys');
  else if (v.k === 'place') showPlace(v.place);
  else if (v.k === 'playerDead') {
    const parts = []; if (v.lost) parts.push(`Потеряно ${v.lost} пепла${W.tomb ? ': он лежит там, где вы пали' : ''}.`); if (v.burned) parts.push('Сгорели уровни улучшения.');
    $('deadTxt').textContent = v.iron ? 'Конец пути. Железный режим: сохранение стёрто.' : (parts.join(' ') || 'Потерь нет.');
    if (v.iron) { W.ironDead = true; saver.reset(); $('again').textContent = 'Начать заново'; }
  }
  else if (v.k === 'tomb') toast(`Вы нашли свой пепел: +${v.ash}`, '', '#e8c04a');
  else if (v.k === 'craft') toast('Скрафчено: ' + BY_ID[v.id].name, '', RARITY[BY_ID[v.id].rar].color);
  else if (v.k === 'tome') toast(`Прочитано: «${v.name}»${v.recipes ? ` · рецептов: ${v.recipes}` : ''}`, '', '#e8c04a');
  else if (v.k === 'questaccept') toast('Задание: ' + v.name, 'sys');
  else if (v.k === 'questready') toast('Можно сдать: ' + v.name, '', '#a8e0a0');
  else if (v.k === 'questdone') { toast('Задание выполнено: ' + v.name, '', '#e8c04a'); saver.write(); }
  else if (v.k === 'bossaggro') toast(`${v.name} проснулся`, 'bad');
  else if (v.k === 'bossphase') toast(`${v.name}: ${v.what}`, 'bad');
  else if (v.k === 'bossdead') toast(`${v.name} повержен!`, '', '#e8c04a');
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

const journal = createJournal(document, W, cfg, {
  onOpen: () => { panelOpen = true; input.release(); },
  onClose: () => { panelOpen = false; }
});
const quests = createQuests(document, W, cfg, {
  onOpen: () => { panelOpen = true; input.release(); },
  onClose: () => { panelOpen = false; saver.write(); bag.render(); },
  onChange: () => { saver.write(); bag.render(); }
});
const bag = createBag(document, W, cfg, {
  onJournal: () => journal.open(),
  onQuests: () => quests.open('mine'),
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
// сложность: выбор в панели ⚙; железный режим только на свежей игре при «Затмении»
const difTabs = $('difTabs'), difText = $('difText'), ironBtn = $('ironBtn');
for (const [id, lv] of Object.entries(cfg.difficulty.levels)) { const b = document.createElement('button'); b.type = 'button'; b.className = 'tab'; b.dataset.id = id; b.textContent = lv.name; b.addEventListener('click', () => { if (W.iron) return; setDifficulty(W, id); saver.write(); renderDif(); }); difTabs.appendChild(b); }
const fresh = () => W.lv === 1 && W.kills === 0 && W.inv.ash === 0 && !W.inv.bag.length;
function renderDif() {
  for (const b of difTabs.children) { b.classList.toggle('on', b.dataset.id === W.difficulty); b.disabled = W.iron && b.dataset.id !== W.difficulty; }
  difText.textContent = W.dif.text;
  ironBtn.hidden = !(W.difficulty === 'eclipse' && (W.iron || fresh()));
  ironBtn.textContent = W.iron ? 'Железный режим включён: смерть стирает сохранение' : (ironArmed ? 'Точно? Назад пути не будет' : 'Включить железный режим (смерть стирает сохранение)');
  ironBtn.classList.toggle('warn', ironArmed || W.iron);
}
let ironArmed = false;
ironBtn.addEventListener('click', () => { if (W.iron) return; if (!ironArmed) { ironArmed = true; renderDif(); setTimeout(() => { ironArmed = false; renderDif(); }, 3000); return; } ironArmed = false; W.iron = true; saver.write(); renderDif(); });
renderDif();
createTweakPanel(document, cfg, defaults, {
  onChange: t => { if (t && (t.reload || t.path === 'view.pixelScale')) fit(); setVolume(cfg.audio.volume); },
  onOpen: () => { panelOpen = true; input.release(); renderDif(); },
  onClose: () => { panelOpen = false; }
});
$('again').addEventListener('click', () => { if (W.ironDead) { location.reload(); return; } respawnPlayer(W); $('dead').hidden = true; });
document.addEventListener('visibilitychange', () => { suspendAudio(document.hidden); if (document.hidden) { input.release(); saver.write(); } });
addEventListener('pagehide', () => saver.write());

try { setMuted(localStorage.getItem('berserk3d.mute') === '1'); } catch (e) { /* без сохранения */ }
setVolume(cfg.audio.volume);
for (const ev of ['pointerdown', 'touchstart', 'keydown']) addEventListener(ev, ensureAudio, { passive: true });
const muteBtn = $('muteBtn');
const showMute = () => { muteBtn.textContent = isMuted() ? '🔇 Звук выключен' : '🔊 Звук включён'; };
muteBtn.addEventListener('click', () => { setMuted(!isMuted()); try { localStorage.setItem('berserk3d.mute', isMuted() ? '1' : '0'); } catch (e) { /* без сохранения */ } showMute(); ensureAudio(); sfx('pickup'); });
showMute();
let ambT = 0, stepT = 0, hintT = 8, fpsN = 0, fpsT = 0, lowT = 0, lowShown = false;
// личные настройки: левша, размер кнопок, вибрация, счётчик кадров, подсказки
const prefBtn = (id, get, label, flip) => { const b = $(id); const show = () => { b.textContent = label(get()); }; b.addEventListener('click', () => { flip(); savePrefs(P); applyPrefs(); }); return show; };
const uiTabs = $('uiTabs');
for (const [name, v] of UI_SCALES) { const b = document.createElement('button'); b.type = 'button'; b.className = 'tab'; b.dataset.v = v; b.textContent = 'Кнопки ' + name; b.addEventListener('click', () => { P.ui = v; savePrefs(P); applyPrefs(); }); uiTabs.appendChild(b); }
const shows = [
  prefBtn('leftyBtn', () => P.lefty, v => v ? '✋ Режим левши: кнопки слева' : '✋ Режим левши выключен', () => { P.lefty = !P.lefty; }),
  prefBtn('vibBtn', () => P.vibrate, v => v ? '📳 Вибрация включена (на iPhone не работает)' : '📳 Вибрация выключена', () => { P.vibrate = !P.vibrate; }),
  prefBtn('fpsBtn', () => P.fps, v => v ? '⏱ Счётчик кадров включён' : '⏱ Счётчик кадров выключен', () => { P.fps = !P.fps; }),
  prefBtn('hintBtn', () => P.hints, v => v ? '💡 Подсказки включены (нажмите: показать заново)' : '💡 Подсказки выключены', () => { P.hints = !P.hints; if (P.hints) P.seen = {}; })
];
function applyPrefs() {
  const r = document.documentElement; if (P.lefty) r.setAttribute('data-lefty', ''); else r.removeAttribute('data-lefty');
  r.style.setProperty('--ui', P.ui); $('fps').hidden = !P.fps;
  for (const b of uiTabs.children) b.classList.toggle('on', Number(b.dataset.v) === P.ui);
  shows.forEach(f => f());
}
applyPrefs();
// перенос сохранения
const codeEl = $('saveCode'), saveFlash = $('saveFlash');
const sflash = (t, bad) => { saveFlash.textContent = t; saveFlash.className = bad ? 'bad' : ''; };
$('expBtn').addEventListener('click', async () => {
  saver.write(true); const code = exportSave(); if (!code) { sflash('Сохранять пока нечего', true); return; }
  codeEl.value = code; codeEl.select();
  let ok = false; try { await navigator.clipboard.writeText(code); ok = true; } catch (e) { try { ok = document.execCommand('copy'); } catch (e2) { ok = false; } }
  sflash(ok ? 'Код скопирован. Вставьте его на другом устройстве' : 'Скопируйте код из поля вручную');
});
$('impBtn').addEventListener('click', () => {
  if (importSave(codeEl.value, cfg.bag.slots) !== 'ok') { sflash('Код не подходит: нужна строка, начинающаяся с B3D1:', true); return; }
  sflash('Сохранение загружено, перезапуск…'); W.ironDead = true; setTimeout(() => location.reload(), 600);    // ironDead блокирует перезапись старым состоянием при выходе
});
const questBtn = $('questBtn'), trackerEl = $('tracker'); questBtn.addEventListener('click', e => { e.stopImmediatePropagation(); quests.open('here'); }, true);
let lastTrack = '', lastMark = '';
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
const bossEl = $('boss'), bossFill = $('bossFill'), bossName = $('bossName');
let lastBoss = '';
const comboEl = $('combo'), statusRow = $('statusRow');
let lastCombo = 0, lastSt = '';
$('smithJournal').addEventListener('click', () => { smith.close(); journal.open(); });
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
  { const hb = W.hudBoss, key = hb ? hb.name + Math.round(hb.frac * 200) + hb.enraged : ''; if (key !== lastBoss) { lastBoss = key; bossEl.hidden = !hb; if (hb) { bossName.textContent = hb.name + (hb.enraged ? ' · ярость' : ''); bossFill.style.transform = `scaleX(${Math.max(0, hb.frac)})`; bossEl.classList.toggle('enr', hb.enraged); } } }
  { const n = W.combo.n; if (n !== lastCombo) { comboEl.hidden = n < 2; if (n >= 2) { comboEl.innerHTML = `×${n}<small>+${Math.round(Math.min(.3, n * .02) * 100)}%</small>`; comboEl.classList.remove('pop'); void comboEl.offsetWidth; comboEl.classList.add('pop'); } lastCombo = n; } }
  { const key = Object.keys(W.pst).map(k => k + Math.ceil(W.pst[k].t) + (W.pst[k].n || '')).join(); if (key !== lastSt) { lastSt = key; statusRow.textContent = ''; for (const k of Object.keys(W.pst)) { const c = document.createElement('span'); c.className = 'stch'; c.style.color = STATUS_COLOR[k]; c.textContent = `${STATUS_NAME[k]}${W.pst[k].n > 1 ? ' ×' + W.pst[k].n : ''} ${Math.ceil(W.pst[k].t)}с`; statusRow.appendChild(c); } } }
  { const near = W.nearNpc, show = !!near && !panelOpen && !landscape; if (questBtn.hidden === show) questBtn.hidden = !show; const mk = show ? questMark(W, near) || '' : ''; if (mk !== lastMark) { lastMark = mk; questBtn.classList.toggle('dot', !!mk); questBtn.textContent = mk === 'ready' ? '📜 Сдать задание' : mk ? '📜 Есть задания ❗' : '📜 Задания'; } }
  { const tl = trackerLine(W); if (tl !== lastTrack) { lastTrack = tl; trackerEl.textContent = tl; trackerEl.hidden = !tl; } }
  if ((fpsT += real, ++fpsN, fpsT) > .5) { const f = Math.round(fpsN / fpsT); fpsN = 0; fpsT = 0; if (P.fps) $('fps').textContent = f + ' кадр/с'; if (f < 32 && !panelOpen && !landscape) lowT += .5; else lowT = Math.max(0, lowT - .5); if (lowT >= 6 && !lowShown && cfg.view.pixelScale < 5) { lowShown = true; toast('Мало кадров: в ⚙ увеличьте «Размер пикселя»', 'bad'); } }
  if (!panelOpen && !W.player.dead && (hintT -= real) <= 0) { hintT = 7; const h = nextHint(W, P); if (h) { P.seen[h.id] = true; savePrefs(P); toast('💡 ' + h.text, 'hint'); } }
  if ((ambT += real) > .5) { ambT = 0; setAmbient(W.light, W.place && W.place.danger ? W.place.danger / 3 : 0); }
  if (!panelOpen && !W.player.dead && W.player.state === 'run' && (stepT += real) > .32) { stepT = 0; sfx('step'); }
  if (!panelOpen && (miniT += real) > .12) { miniT = 0; drawMini(); }
  if ((saveT += real) > 8) { saveT = 0; saver.write(); }
  const hp = Math.ceil(W.player.hp) + W.player.maxhp * 1000;
  if (hp !== lastHp) { lastHp = hp; hpFill.style.transform = `scaleX(${W.player.hp / W.player.maxhp})`; hpTxt.textContent = Math.ceil(W.player.hp); }
  { const key = W.kills + ':' + W.inv.ash + ':' + W.lv + ':' + W.xp + ':' + W.sp + ':' + clockText(W.t, cfg.daynight) + W.night; if (key !== lastKey) { lastKey = key; killsEl.textContent = `Ур. ${W.lv} · пепел ${W.inv.ash} · ${W.night ? '🌙' : '☀'} ${clockText(W.t, cfg.daynight)}`; xpFill.style.transform = `scaleX(${W.lv >= cfg.level.max ? 1 : W.xp / xpNeed(W.lv, cfg)})`; skillBtn.classList.toggle('dot', W.sp > 0); } }
  if (W.player.dead && W.player.deadT > .9 && $('dead').hidden) $('dead').hidden = false;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

window.__b3d = { journal, quests, spawnBoss: type => spawnBoss(W, cfg.bosses.list.find(d => d.type === type)), captain, reveal: (x, z, r) => reveal(W, x, z, r), mapOpen, mapClose, skills, spawn: (t, x, z) => spawnEnemy(W, t, x, z), bag, shop, smith, saver, W, cfg, renderer, input, step, respawnPlayer };
