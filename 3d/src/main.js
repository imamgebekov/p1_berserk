import { CFG3 } from './config3d.js';
import { createWorld, step, respawnPlayer, spawnEnemy, spawnBoss, rerollRare } from './sim.js';
import { BY_ID, RARITY, STAT_NAME } from './data/items.js';
import { CONTAINERS } from './data/loot.js';
import { createBag } from './bag.js';
import { createShop, createSmith, createCaptain } from './shop.js';
import { createSkills } from './skillsui.js';
import { createJournal } from './journal.js';
import { createQuests } from './questsui.js';
import { ensureAudio, setVolume, setMuted, isMuted, suspendAudio, setAmbient, sfx, setScene, tickAudio, audioStats } from './audio3d.js';
import { mixOf } from './soundscape3d.js';
import { clockText } from './daynight.js';
import { loadPrefs, savePrefs, nextHint, buzz, UI_SCALES } from './prefs3d.js';
import { trackerLine, questMark } from './quests3d.js';
import { eventLine } from './events3d.js';
import { fireNear, knownFires, fastTravel, travelBlock, sanitizeFires } from './fires3d.js';
import { sleep, sleepSpot, sleepBlock } from './sleep3d.js';
import { isNight } from './daynight.js';
import { xpNeed, reveal, restoreAllies, restoreBosses, setDifficulty, usePortal, portalName, travel, bagSlots, bagCap, refreshGear, switchHero } from './sim.js';
import { HEROES, HERO_IDS } from './data/heroes3d.js';
import { abilityView } from './abilities3d.js';
import { KIND_NAME } from './data/items.js';
import { drawMap } from './mapdraw.js';
import { STATUS_NAME, STATUS_COLOR } from './status3d.js';
import { loadSave, createSaver, unpackSeenChunks, applyDseen, applyDungeonState, exportSave, importSave } from './save3d.js';
import { createRenderer } from './render.js';
import { rotateInput, resolve } from './map.js';
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
// компьютер (мышь, нет касаний): кнопки для пальца прячутся, интерфейс крупнее, клавиши подписаны
const desk = matchMedia('(hover: hover) and (pointer: fine)').matches && !(navigator.maxTouchPoints > 0);
if (desk) document.documentElement.setAttribute('data-desk', '');
const canvas = $('gl');
let renderer;
try {
  renderer = createRenderer(canvas, cfg, { onText, onHurt, onEvent, preserve: new URLSearchParams(location.search).has('shot') });
} catch (e) {
  $('nogl').hidden = false; console.warn('WebGL недоступен', e);
}

const W = createWorld(cfg);
const saved = loadSave(bagCap(cfg));
if (saved) { W.hero = saved.hero; W.inv = saved.inv; W.kills = saved.kills; Object.assign(W, saved.prog); unpackSeenChunks(saved.seen, W.seen, W.seenN); if (saved.pos) { W.player.x = saved.pos.x; W.player.z = saved.pos.z; resolve(W.map, W.player, cfg.player.radius); } applyDseen(W, saved.dseen); applyDungeonState(W, saved); restoreAllies(W, saved.squad); W.fires = sanitizeFires(saved.fires, W.map.fires.map(f => f.id)); restoreBosses(W, saved.bosses); if (saved.difficulty) setDifficulty(W, saved.difficulty); W.iron = saved.iron; W.tomb = saved.tomb; W.known = saved.known; W.quests = saved.quests; W.t = saved.t; W.shrines = saved.shrines; rerollRare(W); }
const saver = createSaver(W);

// выбор героя: при новой игре (сохранения нет) — три карточки; игра стоит, пока герой не выбран. ?hero=id — выбрать сразу (тесты)
function drawPortrait(cv, L) {
  const g = cv.getContext('2d'), r = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  g.clearRect(0, 0, 16, 16);
  r(L.cape, 3, 7, 10, Math.round(8 * L.capeLen) + 1); r(L.cloth, 4, 8, 8, 8); r('#cdb89a', 5, 2, 6, 6); r(L.hair, 5, 1, 6, 2); r(L.hair, 4, 2, 1, 4);
  r('#1a1210', 6, 4, 1, 1); r('#1a1210', 9, 4, 1, 1);
  if (L.hood) { r(L.cape, 4, 1, 8, 2); r(L.cape, 4, 1, 1, 7); r(L.cape, 11, 1, 1, 7); }
  if (L.shoulder) { r('#4a463f', 2, 8, 3, 2); }
  if (L.quiver) { r('#6a4a2a', 12, 6, 2, 7); r('#c8b890', 12, 4, 1, 2); r('#c8b890', 13, 5, 1, 1); }
}
let heroSwitching = false;      // экран выбора открыт из меню: смена героя с сохранением прогресса
function pickHero(id) {
  const H = HEROES[id]; if (!H || !H.open || $('heroPick').hidden) return;
  input.release();
  if (heroSwitching) { if (!switchHero(W, id)) return; toast(`Теперь вы — ${H.name}. Очки умений вернулись`, '', '#e8c04a'); }
  else { W.hero = id; if (H.start && !W.inv.eq.weapon) W.inv.eq.weapon = H.start; refreshGear(W); W.player.hp = W.player.maxhp; toast(`${H.name} выходит из пепла`, '', '#e8c04a'); }
  rerollRare(W); closeHeroPick(); saver.write(true);     // полка редкостей — под выбранного героя
}
function closeHeroPick() { $('heroPick').hidden = true; panelOpen = false; heroSwitching = false; }
function openHeroPick(switching = false) {
  heroSwitching = switching;
  $('heroCancel').hidden = !switching;
  $('heroNote').textContent = switching ? 'Уровень, пепел, вещи и навыки останутся. Очки умений вернутся: умения у героев свои. Чужое оружие уйдёт в сумку.' : 'Героя можно сменить потом в меню (⚙): уровень, пепел и вещи останутся.';
  const box = $('heroCards'); box.textContent = '';
  HERO_IDS.forEach((id, i) => {
    const H = HEROES[id], c = document.createElement('div'), add = (tag, cls, txt) => { const e = document.createElement(tag); e.className = cls; e.textContent = txt; c.append(e); return e; };
    c.className = 'hcard' + (H.open ? '' : ' shut'); c.dataset.hero = id;
    const cv = document.createElement('canvas'); cv.width = cv.height = 16; drawPortrait(cv, H.look); c.append(cv);
    add('div', 'nm', H.name); add('div', 'role', H.role); add('div', 'txt', H.text);
    add('div', 'wk', H.kinds.length ? 'Оружие: ' + H.kinds.map(k => KIND_NAME[k]).join(', ') + '.' : H.soon);
    const cur = switching && id === W.hero; if (cur) c.classList.add('cur');
    const b = add('button', '', cur ? 'Сейчас' : H.open ? 'Выбрать' + (desk ? ' · ' + (i + 1) : '') : 'Скоро'); b.type = 'button'; b.disabled = !H.open || cur;
    b.addEventListener('click', () => pickHero(id));
    box.append(c);
  });
  $('heroPick').hidden = false; panelOpen = true; input.release();
}
const input = createInput(document, window);
let panelOpen = false, landscape = false;
$('heroCancel').addEventListener('click', closeHeroPick);
$('heroSwitch').addEventListener('click', () => { $('tweakClose').click(); openHeroPick(true); });
// кнопки умений: видны только вкачанные; на кнопке значок, номер клавиши (на компьютере) и заливка перезарядки
const abilBtns = [0, 1, 2, 3, 4].map(i => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'ab'; b.dataset.i = i; b.hidden = true;
  b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); b.classList.add('on'); input.ability(i + 1); });
  for (const t of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(t, () => b.classList.remove('on'));
  $('abil').append(b); return b;
});
let abilKey = '';
function drawAbil() {
  const v = abilityView(W), key = v.map(a => a.id + a.rank + Math.ceil(a.cd * 10)).join() + panelOpen + landscape;
  if (key === abilKey) return; abilKey = key;
  abilBtns.forEach((b, i) => { const a = v[i], show = !!a && a.rank > 0 && !panelOpen && !landscape && !W.player.dead; if (b.hidden === show) b.hidden = !show; if (!show) return;
    if (b.dataset.id !== a.id) { b.dataset.id = a.id; b.textContent = a.icon; const k = document.createElement('span'); k.className = 'k'; k.textContent = i + 1; b.append(k); b.setAttribute('aria-label', `${a.name} (${i + 1})`); b.title = `${a.name} · клавиша ${i + 1}`; }
    b.style.setProperty('--cd', a.cd > 0 ? (a.cd / a.cdMax).toFixed(3) : 0); });
}
{ const q = new URLSearchParams(location.search).get('hero'); if (!saved) { openHeroPick(); if (q) pickHero(q); } }

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
  if (v.k === 'fireFound') { toast('🔥 Открыт костёр: ' + v.name, '', '#ffb060'); sfx('evDone'); }
  else if (v.k === 'dusk') toast('Наступает ночь: торговец спит, враги злее', 'bad');
  else if (v.k === 'dawn') toast('Светает: торговец снова торгует', 'sys');
  if (v.k === 'pickup') { const it = BY_ID[v.id]; toast('+ ' + it.name + (v.n > 1 ? ' ×' + v.n : ''), '', RARITY[it.rar].color); }
  else if (v.k === 'open') toast(CONTAINERS[v.kind].name, 'sys');
  else if (v.k === 'locked') toast(`Заперто: нужен ключ уровня ${v.tier}+`, 'bad');
  else if (v.k === 'unlock') toast('Замок открыт', 'sys');
  else if (v.k === 'full') toast('Сумка полна', 'bad');
  else if (v.k === 'buff') toast('Действует зелье', 'sys');
  else if (v.k === 'place') showPlace(v.place);
  else if (v.k === 'drop') { const it = BY_ID[v.id]; if (it && it.rar >= 3) { toast(`✦ Выпало: ${it.name}`, '', RARITY[it.rar].color); sfx(it.rar >= 4 ? 'brand' : 'rare'); } }
  else if (v.k === 'key') toast(`🗝 Ключ на связке: ${cfg.dungeons.keys[v.key] || 'ключ'}`, '', '#e8c04a');
  else if (v.k === 'doorLocked') toast(`Заперто: нужен ${cfg.dungeons.keys[v.key] || 'ключ'}`, 'bad');
  else if (v.k === 'travel') { saver.write(); if (!reduce) { const f = $('fade'); f.style.setProperty('--fade', cfg.dungeons.fade + 's'); f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on'))); } }
  else if (v.k === 'playerDead') {
    const parts = []; if (v.lost) parts.push(`Потеряно ${v.lost} пепла${W.tomb ? ': он лежит там, где вы пали' : ''}.`); if (v.burned) parts.push('Сгорели уровни улучшения.');
    $('deadTxt').textContent = v.iron ? 'Конец пути. Железный режим: сохранение стёрто.' : (parts.join(' ') || 'Потерь нет.');
    if (v.iron) { W.ironDead = true; saver.reset(); $('again').textContent = 'Начать заново'; }
  }
  else if (v.k === 'evStart') { toast(v.kind === 'rescue' ? '📣 Крик о помощи: путника окружили враги' : v.kind === 'ambush' ? '⚔ Засада!' : `🐴 Обоз в «${v.place}» ищет охрану у ворот`, v.kind === 'ambush' ? 'bad' : '', '#ffc040'); sfx(v.kind === 'ambush' ? 'ambush' : 'evStart'); }
  else if (v.k === 'evMove') toast(`Обоз тронулся. Держитесь рядом до «${v.place}»`, 'sys');
  else if (v.k === 'evRaid') { toast('Налёт на обоз!', 'bad'); sfx('ambush'); }
  else if (v.k === 'evDone') { toast(v.kind === 'rescue' ? `Путник спасён: +${v.ash} пепла и его благодарность` : v.kind === 'ambush' ? `Засада отбита: +${v.ash} пепла` : `Обоз дошёл: +${v.ash} пепла`, '', '#e8c04a'); sfx('evDone'); saver.write(); }
  else if (v.k === 'evFail') { const t = { dead: v.kind === 'caravan' ? 'Обоз разбит' : 'Путник погиб', late: v.kind === 'caravan' ? 'Обоз уехал без вас' : 'Путник не дождался помощи', fled: 'Вы ушли от засады', gone: '' }[v.why]; if (t) toast(t, 'bad'); }
  else if (v.k === 'shopRare') { const it = BY_ID[v.id]; toast(`🛒 У торговца в лагере: ${cfg.shop.rare.tiers[v.tier - 1].name.toLowerCase()} — ${it.name}`, '', RARITY[it.rar].color); sfx(v.tier >= 3 ? 'brand' : 'rare'); }
  else if (v.k === 'shrine') { toast(`✨ ${v.name}: ${v.stat === 'regen' ? `+${v.amt} здоровья в секунду` : `+${v.amt} ${STAT_NAME[v.stat]}`} на ${Math.round(v.t / 60)} мин`, '', '#9ad8ff'); sfx('buff'); }
  else if (v.k === 'wanderer') { toast('🔔 У дороги остановилась повозка сказочного торговца', '', '#c8a0ff'); sfx('wanderer'); }
  else if (v.k === 'wanderLeave') toast('Сказочный торговец уехал', 'sys');
  else if (v.k === 'recall') toast('Свиток перенёс вас в лагерь', '', '#c8a0ff');
  else if (v.k === 'tomb') toast(`Вы нашли свой пепел: +${v.ash}`, '', '#e8c04a');
  else if (v.k === 'craft') toast('Скрафчено: ' + BY_ID[v.id].name, '', RARITY[BY_ID[v.id].rar].color);
  else if (v.k === 'tome') toast(`Прочитано: «${v.name}»${v.recipes ? ` · рецептов: ${v.recipes}` : ''}`, '', '#e8c04a');
  else if (v.k === 'questaccept') toast('Задание: ' + v.name, 'sys');
  else if (v.k === 'questready') toast('Можно сдать: ' + v.name, '', '#a8e0a0');
  else if (v.k === 'questdone') { toast('Задание выполнено: ' + v.name, '', '#e8c04a'); saver.write(); }
  else if (v.k === 'elite') toast('Элита: ' + v.name, 'bad');
  else if (v.k === 'bossaggro') { const e = W.enemies.find(x => x.id === v.id), f = e && cfg.enemies[e.type].g === 'f'; toast(`${v.name} ${f ? 'проснулась' : 'проснулся'}`, 'bad'); }     // род по врагу
  else if (v.k === 'bossphase') toast(`${v.name}: ${v.what}`, 'bad');
  else if (v.k === 'bossdead') toast(`${v.name} повержен!`, '', '#e8c04a');
  else if (v.k === 'allydead') toast(`${v.name} пал`, 'bad');
  else if (v.k === 'hire') toast(`${v.name} теперь с вами`, 'sys');
  else if (v.k === 'level') toast(`Уровень ${v.lv}! Очко навыков ✦` + (cfg.abilities.ranks.flat().includes(v.lv) ? ' и умений' : '') + (cfg.abilities.ranks.some(r => r[0] === v.lv) ? ' · открылось умение' : ''), '', '#e8c04a');
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
  landscape = !desk && innerWidth > innerHeight * 1.15 && innerHeight < 520;
  if (desk) {
    const st = document.documentElement.style, dz = Math.min(cfg.view.desk.zoomMax, Math.max(1, innerHeight / cfg.view.desk.baseH)), pz = Math.min(dz, 1.25);
    st.setProperty('--dz', dz.toFixed(3)); st.setProperty('--pz', pz.toFixed(3));
    // высоты окон — в пикселях, делённых на zoom: Safari и Chromium по-разному увеличивают проценты под zoom, а пиксели — одинаково
    st.setProperty('--pbh', Math.floor(innerHeight * .84 / pz) + 'px'); st.setProperty('--blh', Math.floor(innerHeight * .64 / pz) + 'px');
  }
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
  onOpen: () => { panelOpen = true; input.release(); renderDif(); $('heroNow').textContent = `${HEROES[W.hero].name} — ${HEROES[W.hero].role.toLowerCase()}. Смена героя сохраняет уровень, пепел, вещи и навыки.`; },
  onClose: () => { panelOpen = false; }
});
// клавиши компьютера (физические, работают на любой раскладке): действие, карта, сумка, навыки, задания, меню
if (desk) {
  $('keysHelp').hidden = false;
  for (const [id, k] of [['miniBtn', 'M'], ['bagBtn', 'I'], ['skillBtn', 'N'], ['gear', 'Esc']]) $(id).title = `${$(id).getAttribute('aria-label')} (${k})`;
  const vis = id => !$(id).hidden;
  addEventListener('keydown', e => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const c = e.code;
    if (!$('heroPick').hidden) { const n = ['Digit1', 'Digit2', 'Digit3'].indexOf(c); if (n >= 0) pickHero(HERO_IDS[n]); else if (c === 'Escape' && heroSwitching) closeHeroPick(); return; }
    if (!$('dead').hidden) { if (c === 'Enter' || c === 'KeyE') $('again').click(); return; }
    if (c === 'Escape') { e.preventDefault(); const open = document.querySelector('section:not([hidden]) button.main'); if (open) open.click(); else $('gear').click(); return; }
    if (c === 'KeyM') { if (!panelOpen || !mapEl.hidden) $('miniBtn').click(); return; }
    if (c === 'KeyI') { if (vis('bag')) $('bagClose').click(); else if (!panelOpen) $('bagBtn').click(); return; }
    if (c === 'KeyN') { if (vis('skills')) $('skillClose').click(); else if (!panelOpen) $('skillBtn').click(); return; }
    if (c === 'KeyQ') { if (vis('quests')) $('questClose').click(); else if (!panelOpen) { if (vis('questBtn')) $('questBtn').click(); else quests.open('mine'); } return; }
    if (c === 'KeyB' && !panelOpen && vis('sleepBtn')) sleepBtn.click();
    if (c === 'KeyE' && !panelOpen) { if (vis('portalBtn')) portalBtn.click(); else if (vis('fireBtn')) fireBtn.click(); else if (vis('talk')) talk.click(); }
  });
}
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
const bagFill = $('bagFill');
let ambT = 0, atmoT = 0, stepT = 0, hintT = 8, fpsN = 0, fpsT = 0, lowT = 0, lowShown = false;
// личные настройки: левша, размер кнопок, вибрация, счётчик кадров, подсказки
const prefBtn = (id, get, label, flip) => { const b = $(id); const show = () => { b.textContent = label(get()); }; b.addEventListener('click', () => { flip(); savePrefs(P); applyPrefs(); }); return show; };
const uiTabs = $('uiTabs');
for (const [name, v] of UI_SCALES) { const b = document.createElement('button'); b.type = 'button'; b.className = 'tab'; b.dataset.v = v; b.textContent = 'Кнопки ' + name; b.addEventListener('click', () => { P.ui = v; savePrefs(P); applyPrefs(); }); uiTabs.appendChild(b); }
const shows = [
  prefBtn('leftyBtn', () => P.lefty, v => v ? '✋ Режим левши: кнопки слева' : '✋ Режим левши выключен', () => { P.lefty = !P.lefty; }),
  prefBtn('vibBtn', () => P.vibrate, v => v ? '📳 Вибрация включена (на iPhone не работает)' : '📳 Вибрация выключена', () => { P.vibrate = !P.vibrate; }),
  prefBtn('fpsBtn', () => P.fps, v => v ? '⏱ Счётчик кадров включён' : '⏱ Счётчик кадров выключен', () => { P.fps = !P.fps; }),
  prefBtn('asciiBtn', () => P.ascii, v => v ? '🔤 Вид: ASCII (символы)' : '🔤 Вид: обычный', () => { P.ascii = !P.ascii; }),
  prefBtn('hintBtn', () => P.hints, v => v ? '💡 Подсказки включены (нажмите: показать заново)' : '💡 Подсказки выключены', () => { P.hints = !P.hints; if (P.hints) P.seen = {}; })
];
function applyPrefs() {
  const r = document.documentElement; if (P.lefty) r.setAttribute('data-lefty', ''); else r.removeAttribute('data-lefty');
  r.style.setProperty('--ui', P.ui); $('fps').hidden = !P.fps;
  for (const b of uiTabs.children) b.classList.toggle('on', Number(b.dataset.v) === P.ui);
  shows.forEach(f => f());
  if (renderer && P.ascii !== asciiNow) { asciiNow = P.ascii; renderer.setAscii(P.ascii); }
}
let asciiNow = false;
if (new URLSearchParams(location.search).has('ascii')) P.ascii = true;      // для тестов и ссылок: сразу вид ASCII
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
  if (importSave(codeEl.value, bagCap(cfg)) !== 'ok') { sflash('Код не подходит: нужна строка, начинающаяся с B3D1:', true); return; }
  sflash('Сохранение загружено, перезапуск…'); W.ironDead = true; setTimeout(() => location.reload(), 600);    // ironDead блокирует перезапись старым состоянием при выходе
});
const questBtn = $('questBtn'), trackerEl = $('tracker'); questBtn.addEventListener('click', e => { e.stopImmediatePropagation(); quests.open('here'); }, true);
let lastTrack = '', lastMark = '';
const talk = $('talk'), xpFill = $('xpFill'), skillBtn = $('skillBtn');
talk.addEventListener('click', e => { e.stopImmediatePropagation(); (W.nearNpc === 'smith' ? smith : W.nearNpc === 'captain' ? captain : shop).open(); }, true);
// костры (C3d): у костра — список открытых, перенос к выбранному
const fireBtn = $('fireBtn'), firesSec = $('fires');
function openFires() {
  const here = fireNear(W), list = $('firesList'), block = travelBlock(W); list.textContent = '';
  $('firesNote').textContent = block && block !== 'Подойдите к костру' ? block + ' — перенос невозможен.' : 'Перенос к открытому костру. Новые костры открываются, когда к ним подходишь.';
  const p = W.player;
  for (const f of knownFires(W).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.id = f.id; const d = Math.round(Math.hypot(f.x - p.x, f.z - p.z));
    b.textContent = '🔥 ' + f.name; const sm = document.createElement('small'); sm.textContent = here && here.id === f.id ? 'вы здесь' : d + ' м' + (f.danger ? ' · опасность ' + '▮'.repeat(f.danger) : ''); b.appendChild(sm);
    b.disabled = !!block || (here && here.id === f.id);
    b.addEventListener('click', () => { if (fastTravel(W, f.id)) { closeFires(); sfx('travel'); } });
    list.appendChild(b);
  }
  firesSec.hidden = false; panelOpen = true; input.release();
}
function closeFires() { firesSec.hidden = true; panelOpen = false; saver.write(); }
fireBtn.addEventListener('click', e => { e.stopImmediatePropagation(); input.release(); openFires(); }, true);
// сон (G4): затемнение, ночь проживается разом, утром — полное здоровье (или «разбудили»)
const sleepBtn = $('sleepBtn'), sleepFade = $('sleepFade'); let sleepingUI = false;
sleepBtn.addEventListener('click', e => {
  e.stopImmediatePropagation(); input.release();
  const why = sleepBlock(W); if (why) { toast(why, '', '#c8d4ff'); return; }
  sleepingUI = true; panelOpen = true; sleepFade.hidden = false; requestAnimationFrame(() => sleepFade.classList.add('on'));
  setTimeout(() => {
    const r = sleep(W); saver.write(true);
    toast(r === 'ok' ? '☀ Утро. Вы выспались — здоровье полное' : r === 'woken' ? '⚠ Вас разбудили! Враги рядом' : r, '', r === 'ok' ? '#ffe08a' : '#ff8a6a');
    sleepFade.classList.remove('on'); setTimeout(() => { sleepFade.hidden = true; sleepingUI = false; panelOpen = false; }, 500);
  }, 650);
}, true);
$('firesClose').addEventListener('click', closeFires);
const portalBtn = $('portalBtn'); portalBtn.addEventListener('click', e => { e.stopImmediatePropagation(); input.release(); usePortal(W); }, true);
// карта: миникарта в углу, большая карта по касанию
const miniCtx = $('mini').getContext('2d'), mapCv = $('mapCv'), mapCtx = mapCv.getContext('2d'), mapEl = $('map');
let miniT = 0;
function drawMini() { drawMap(miniCtx, W, { w: 92, h: 92, scale: 2.1, cx: W.player.x, cz: W.player.z, full: false }); }
// большая карта (C3e): масштаб и прокрутка — вид mv { cx, cz, span (м на ширину) }; в подземелье — весь уровень
const MAP_MIN = 60, mapMax = () => cfg.world.radius * 2 + 6, mv = { cx: 0, cz: 0, span: 220 };
const mapClamp = () => { mv.span = Math.max(MAP_MIN, Math.min(mapMax(), mv.span)); const R = cfg.world.radius, m = Math.max(0, R - mv.span / 2 + 20); mv.cx = Math.max(-m, Math.min(m, mv.cx)); mv.cz = Math.max(-m, Math.min(m, mv.cz)); };
let mapRaf = 0; const mapRedraw = () => { if (!mapRaf) mapRaf = requestAnimationFrame(() => { mapRaf = 0; drawFull(); }); };
const mapZoom = (k, px = 320, py = 320) => { const s0 = mv.span, wx = mv.cx + (px / 640 - .5) * s0, wz = mv.cz + (py / 640 - .5) * s0; mv.span *= k; mapClamp(); mv.cx = wx - (px / 640 - .5) * mv.span; mv.cz = wz - (py / 640 - .5) * mv.span; mapClamp(); mapRedraw(); };     // точка под курсором остаётся на месте
function drawFull() { const B = W.map.bounds, cx = B ? (B.x0 + B.x1) / 2 : mv.cx, cz = B ? (B.z0 + B.z1) / 2 : mv.cz, span = B ? Math.max(B.x1 - B.x0, B.z1 - B.z0) + 6 : mv.span; $('mapZoom').hidden = !!B; drawMap(mapCtx, W, { w: 640, h: 640, scale: 640 / span, cx, cz, full: true }); const pl = W.place; $('mapLegend').textContent = B ? `Вы здесь: ${pl ? pl.name : 'подземелье'}. Светлый квадрат: лестница наверх. Жёлтые точки: нетронутые контейнеры. Закрытое туманом ещё не исследовано.` : (pl ? `Вы здесь: ${pl.name}. ` : 'Вы в глуши. ') + 'Коричневые квадраты: люки в погреба и подземелья. Зелёные круги безопасны, красные опасны (чем краснее, тем хуже). Жёлтые точки: нетронутые контейнеры. Торговец золотой, кузнец рыжий. Закрытое туманом ещё не исследовано.'; }
const mapOpen = () => { mv.cx = W.player.x; mv.cz = W.player.z; mapClamp(); drawFull(); mapEl.hidden = false; panelOpen = true; input.release(); };
{ const pts = new Map(), loc = e => { const r = mapCv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * 640, y: (e.clientY - r.top) / r.height * 640 }; }; let pinch = 0;
  mapCv.addEventListener('wheel', e => { e.preventDefault(); const q = loc(e); mapZoom(Math.exp(e.deltaY * .0015), q.x, q.y); }, { passive: false });
  mapCv.addEventListener('pointerdown', e => { mapCv.setPointerCapture(e.pointerId); pts.set(e.pointerId, loc(e)); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); } });
  mapCv.addEventListener('pointermove', e => { if (!pts.has(e.pointerId)) return; const q = loc(e), o = pts.get(e.pointerId); pts.set(e.pointerId, q);
    if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch > 0 && d > 0) mapZoom(pinch / d, (a.x + b.x) / 2, (a.y + b.y) / 2); pinch = d; }       // щипок
    else { mv.cx -= (q.x - o.x) / 640 * mv.span; mv.cz -= (q.y - o.y) / 640 * mv.span; mapClamp(); mapRedraw(); } });       // перетаскивание
  const up = e => { pts.delete(e.pointerId); pinch = 0; }; mapCv.addEventListener('pointerup', up); mapCv.addEventListener('pointercancel', up);
  $('mapIn').addEventListener('click', () => mapZoom(1 / 1.5)); $('mapOut').addEventListener('click', () => mapZoom(1.5));
  $('mapMe').addEventListener('click', () => { mv.cx = W.player.x; mv.cz = W.player.z; mapClamp(); mapRedraw(); }); $('mapAll').addEventListener('click', () => { mv.span = mapMax(); mv.cx = mv.cz = 0; mapClamp(); mapRedraw(); }); }
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
// замер кадра (C5): время процессора на симуляцию и подготовку отрисовки, вызовы и треугольники; окно последних 600 кадров
const perf = { sim: [], draw: [], calls: 0, tris: 0, max: 0, n: 0 }, PERF_N = 600;
const perfPush = (a, v) => { a.push(v); if (a.length > PERF_N) a.shift(); };
function loop(now) {
  const t0 = performance.now(), real = (now - last) / 1000, dt = Math.max(0, Math.min(.05, real)); last = now;
  if (!panelOpen && !landscape) {
    const inp = input.read();
    Object.assign(inp, rotateInput(inp.mx, inp.mz, cfg.view.camYaw));        // «вверх» на джойстике = вверх на экране при любом повороте камеры
    if (W.player.dead) inp.attack = inp.roll = false;
    step(W, dt, inp);
  }
  { const n = W.inv.bag.length, m = bagSlots(W), s = n + '/' + m, cls = n >= m ? 'full' : n >= m * .8 ? 'warn' : ''; if (bagFill.textContent !== s) bagFill.textContent = s; if (bagFill.className !== cls) bagFill.className = cls; }     // заполненность сумки на кнопке
  const t1 = performance.now();
  if (renderer) renderer.render(W, panelOpen || landscape ? 0 : dt);
  { const t2 = performance.now(); perfPush(perf.sim, t1 - t0); perfPush(perf.draw, t2 - t1); perf.max = Math.max(perf.max, t2 - t0); perf.n++; if (renderer) { const i = renderer.info(); perf.calls = i.calls; perf.tris = i.triangles; } }
  { const show = !!W.nearNpc && !panelOpen && !landscape; if (talk.hidden === show) talk.hidden = !show; if (show) { const l = (W.nearNpc === 'smith' ? 'Кузнец' : W.nearNpc === 'captain' ? 'Наём' : W.nearNpc === 'wanderer' ? 'Сказочный торговец' : W.shop.stock.some(s => s.fresh) ? 'Торговать · новинка ✦' : 'Торговать') + (desk ? ' · E' : ''); if (talk.textContent !== l) talk.textContent = l; } }
  { const f = fireNear(W), show = !!f && !W.nearPortal && !panelOpen && !landscape; if (fireBtn.hidden === show) fireBtn.hidden = !show; if (show) { const l = '🔥 Костёр' + (desk ? ' · E' : ''); if (fireBtn.textContent !== l) fireBtn.textContent = l; } }
  { const show = !sleepingUI && !panelOpen && !landscape && !!sleepSpot(W) && isNight(W.t, cfg.daynight); if (sleepBtn.hidden === show) sleepBtn.hidden = !show; if (show) { const l = '😴 Спать до утра' + (desk ? ' · B' : ''); if (sleepBtn.textContent !== l) sleepBtn.textContent = l; } }
  { const q = W.nearPortal, show = !!q && !panelOpen && !landscape && !W.player.dead; if (portalBtn.hidden === show) portalBtn.hidden = !show; if (show) { const l = portalName(W, q) + (desk ? ' · E' : ''); if (portalBtn.textContent !== l) portalBtn.textContent = l; } }
  { const hb = W.hudBoss, key = hb ? hb.name + Math.round(hb.frac * 200) + hb.enraged : ''; if (key !== lastBoss) { lastBoss = key; bossEl.hidden = !hb; if (hb) { bossName.textContent = hb.name + (hb.enraged ? ' · ярость' : ''); bossFill.style.transform = `scaleX(${Math.max(0, hb.frac)})`; bossEl.classList.toggle('enr', hb.enraged); } } }
  { const n = W.combo.n; if (n !== lastCombo) { comboEl.hidden = n < 2; if (n >= 2) { comboEl.innerHTML = `×${n}<small>+${Math.round(Math.min(.3, n * .02) * 100)}%</small>`; comboEl.classList.remove('pop'); void comboEl.offsetWidth; comboEl.classList.add('pop'); } lastCombo = n; } }
  { const ab = W.abuf, buffs = [ab.iron > 0 && ['Несокрушимость', ab.iron, '#9fd0ff'], ab.rage > 0 && ['Ярость', ab.rage, '#ff6a4a']].filter(Boolean);     // статусы и баффы умений
    const key = Object.keys(W.pst).map(k => k + Math.ceil(W.pst[k].t) + (W.pst[k].n || '')).join() + buffs.map(b => b[0] + Math.ceil(b[1])).join();
    if (key !== lastSt) { lastSt = key; statusRow.textContent = ''; const chip = (txt, col) => { const c = document.createElement('span'); c.className = 'stch'; c.style.color = col; c.textContent = txt; statusRow.appendChild(c); };
      for (const k of Object.keys(W.pst)) chip(`${STATUS_NAME[k]}${W.pst[k].n > 1 ? ' ×' + W.pst[k].n : ''} ${Math.ceil(W.pst[k].t)}с`, STATUS_COLOR[k]);
      for (const b of buffs) chip(`${b[0]} ${Math.ceil(b[1])}с`, b[2]); } }
  { const near = W.nearNpc, show = !!near && near !== 'wanderer' && !panelOpen && !landscape; if (questBtn.hidden === show) questBtn.hidden = !show; const mk = show ? questMark(W, near) || '' : ''; if (mk !== lastMark) { lastMark = mk; questBtn.classList.toggle('dot', !!mk); questBtn.textContent = mk === 'ready' ? '📜 Сдать задание' : mk ? '📜 Есть задания ❗' : '📜 Задания'; } }
  drawAbil();
  { const tl = eventLine(W) || trackerLine(W); if (tl !== lastTrack) { lastTrack = tl; trackerEl.textContent = tl; trackerEl.hidden = !tl; } }
  if ((fpsT += real, ++fpsN, fpsT) > .5) { const f = Math.round(fpsN / fpsT); fpsN = 0; fpsT = 0; if (P.fps) { const q = a => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length * .95)] || 0; }; $('fps').textContent = `${f} кадр/с · ${(q(perf.sim) + q(perf.draw)).toFixed(1)} мс · ${perf.calls} выз · ${Math.round(perf.tris / 1000)} тыс △`; } if (f < 32 && !panelOpen && !landscape) lowT += .5; else lowT = Math.max(0, lowT - .5); if (lowT >= 6 && !lowShown && (P.ascii || cfg.view.pixelScale < 5)) { lowShown = true; toast(P.ascii ? 'Мало кадров: в ⚙ выключите вид ASCII' : 'Мало кадров: в ⚙ увеличьте «Размер пикселя»', 'bad'); } }
  if (!panelOpen && !W.player.dead && (hintT -= real) <= 0) { hintT = 7; const h = nextHint(W, P); if (h) { P.seen[h.id] = true; savePrefs(P); toast('💡 ' + ((desk && h.desk) || h.text), 'hint'); } }
  if ((ambT += real) > .5) { ambT = 0; setAmbient(W.light, W.place && W.place.danger ? W.place.danger / 3 : 0); }
  if ((atmoT += real) > .2) { atmoT = 0; setScene(mixOf(W, cfg.audio, renderer ? { wind: renderer.wind().s, trees: renderer.treesNear(W.player.x, W.player.z), rain: renderer.weather().rain } : null), cfg.audio); tickAudio(); }     // атмосфера: река, птицы, музыка
  if (!panelOpen && !W.player.dead && W.player.state === 'run' && (stepT += real) > .32) { stepT = 0; sfx('step'); }
  if (!panelOpen && (miniT += real) > .12) { miniT = 0; drawMini(); }
  if ((saveT += real) > 8) { saveT = 0; saver.write(); }
  const hp = Math.ceil(W.player.hp) + W.player.maxhp * 1000;
  if (hp !== lastHp) { lastHp = hp; hpFill.style.transform = `scaleX(${W.player.hp / W.player.maxhp})`; hpTxt.textContent = Math.ceil(W.player.hp); }
  { const key = W.kills + ':' + W.inv.ash + ':' + W.lv + ':' + W.xp + ':' + W.sp + ':' + W.ap + ':' + clockText(W.t, cfg.daynight) + W.night; if (key !== lastKey) { lastKey = key; killsEl.textContent = `Ур. ${W.lv} · пепел ${W.inv.ash} · ${W.night ? '🌙' : '☀'} ${clockText(W.t, cfg.daynight)}`; xpFill.style.transform = `scaleX(${W.lv >= cfg.level.max ? 1 : W.xp / xpNeed(W.lv, cfg)})`; skillBtn.classList.toggle('dot', W.sp > 0 || W.ap > 0); } }
  if (W.player.dead && W.player.deadT > .9 && $('dead').hidden) $('dead').hidden = false;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

window.__b3d = { perf: () => { const q = (a, k) => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(b.length * k))] || 0; }, tot = perf.sim.map((v, i) => v + perf.draw[i]); return { n: perf.n, p50: q(tot, .5), p95: q(tot, .95), max: perf.max, sim95: q(perf.sim, .95), draw95: q(perf.draw, .95), calls: perf.calls, tris: perf.tris }; }, perfReset: () => { perf.sim.length = perf.draw.length = 0; perf.max = 0; }, openFires, fastTravel: id => fastTravel(W, id), ui: () => ({ panelOpen, landscape, desk }), life: () => renderer && renderer.life(), usePortal: () => usePortal(W), travel: (id, x, z) => travel(W, id, x, z), journal, quests, spawnBoss: type => spawnBoss(W, cfg.bosses.list.find(d => d.type === type)), captain, reveal: (x, z, r) => reveal(W, x, z, r), mapOpen, mapClose, mapView: () => ({ ...mv }), mapZoom, skills, spawn: (t, x, z) => spawnEnemy(W, t, x, z), bag, shop, smith, saver, W, cfg, renderer, input, step, respawnPlayer, audioStats };
