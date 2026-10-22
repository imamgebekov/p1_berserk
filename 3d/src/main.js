import { GI } from './data/gicons.js';     // значки game-icons.net на панели умений (2026-10-20)
import { CFG3 } from './config3d.js';
import { createWorld, step, respawnPlayer, spawnEnemy, spawnBoss, rerollRare, corpseItems, lootCorpse } from './sim.js';
import { BY_ID, RARITY, STAT_NAME, SLOT_NAME } from './data/items.js';
import { CONTAINERS } from './data/loot.js';
import { createBag } from './bag.js';
import { createShop, createSmith, createCaptain } from './shop.js';
import { createLibrary } from './libui.js';
import { createMapClouds } from './mapclouds.js';
import { createSkills } from './skillsui.js';
import { createJournal } from './journal.js';
import { createQuests } from './questsui.js';
import { ensureAudio, setVolume, setUserMix, setMuted, isMuted, suspendAudio, setAmbient, sfx, setScene, tickAudio, audioStats, setOwnMusicOn } from './audio3d.js';
import { loadOwn, onOwnChange, ownIcon, ownMusic, ownIconCount, setOwnIcon, clearOwnIcon, clearOwnIcons, addOwnMusic, clearOwnMusic, player as ownPlayer } from './custom3d.js';
import { mixOf } from './soundscape3d.js';
import { clockText, lightOf, phaseOf, mix } from './daynight.js';
import { loadPrefs, savePrefs, nextHint, buzz, UI_SCALES } from './prefs3d.js';
import { trackerLines, questMarks, questMark, questsOf } from './quests3d.js';
import { eventLine, eventAt } from './events3d.js';
import { abyssLine, weekOf, eclipseMods, eclipseDoneThisWeek, modName } from './abyss3d.js';
import { ngOpen, startNg } from './ng3d.js';
import { fireNear, knownFires, fastTravel, travelBlock, sanitizeFires } from './fires3d.js';
import { sleep, sleepSpot, sleepBlock } from './sleep3d.js';
import { isNight } from './daynight.js';
import { bagUsed, createInv } from './inv.js';
import { createHeroView } from './bagview3d.js';
import { xpNeed, reveal, restoreAllies, restoreBosses, setDifficulty, usePortal, eclipseGo, portalName, travel, bagSlots, bagCap, refreshGear, switchHero } from './sim.js';
import { HEROES, HERO_IDS } from './data/heroes3d.js';
import { abilityView, resView, barOf, abilityAim } from './abilities3d.js';
import { createFeel, unlocksAt } from './feel3d.js';
import { ABILITIES, abilityPointsAt } from './data/abilities3d.js';
import { giKeyOf, iconURL } from './itemicons.js';
import { artURL } from './spellicons3d.js';
import { createTracks } from './music3d.js';
import { weaponSkillView } from './weaponskill3d.js';
import { comboReady } from './combos3d.js';
import { ELEMENT_COLOR } from './elements3d.js';
import { KIND_NAME } from './data/items.js';
import { drawMap, tickRelief } from './mapdraw.js';
import { zoneAt } from './zones3d.js';
import { storyTalk, storyTalked, storyTalkable, storyGoal, storyAutoPending, storyActors, storyChoice } from './story3d.js';
import { SPEAKERS } from './data/story3d.js';
import { liveAllies, squadCommand } from './squad3d.js';
import { setHeroic, isInstance, heroicOpen } from './levels3d.js';
import { nodeNear, gather, mountToggle, coachNear, coachList, flightCost, fly } from './life3d.js';
import { STATUS_NAME, STATUS_COLOR } from './status3d.js';
import { loadSaveAny, createSaver, unpackSeenChunks, applyDseen, applyDungeonState, exportSave, importSave, saveFileName } from './save3d.js';
import { createRenderer } from './render.js';
import { runBench } from './bench3d.js';
import { rotateInput, resolve } from './map.js';
import { createInput } from './input.js';
import { loadTweaks, createTweakPanel } from './tweak.js';
import { setIconText, applyIcons } from './uiicons.js';
import { QUALITY_IDS, QUALITY_NAMES, makeAutoRes } from './quality3d.js';
import { sparkFresh, sparkEvent, sparkTick, goalOf, sanitizeSpark } from './spark3d.js';
import { mentorFresh, sanitizeMentor, mentorEvent, mentorTick, mentorLine, MENTOR_WHO } from './mentor3d.js';
import { PATH, pathFresh, sanitizePath, pathEvent, pathTick, pathGoal, pathIndex, unlocks, lockedHint } from './ashpath3d.js';

const $ = id => document.getElementById(id);
applyIcons(document);     // иконки-силуэты вместо эмодзи в кнопках разметки (шаг 10)
$('keysMore').addEventListener('click', () => { const p = $('keysAll'); p.hidden = !p.hidden; $('keysMore').setAttribute('aria-expanded', String(!p.hidden)); });     // все клавиши по «?»
const defaults = JSON.parse(JSON.stringify(CFG3));
if (new URLSearchParams(location.search).has('boxy')) CFG3.shapes.volume = false;     // ?boxy — прежние модели из кубиков (сравнение)
if (new URLSearchParams(location.search).has('flat') && CFG3.shaders.paint) CFG3.shaders.paint.on = false;
if (new URLSearchParams(location.search).has('nodetails') && CFG3.details) CFG3.details.on = false;     // ?nodetails — без деталей мира (сравнение T5)
if (new URLSearchParams(location.search).has('nofeel') && CFG3.feel) CFG3.feel.on = false;     // ?nofeel — без отклика боя (сравнение этапа 1)     // ?flat — без материалов (сравнение «было — стало»)
const cfg = JSON.parse(JSON.stringify(CFG3));
loadTweaks(cfg);

// iOS Safari местами игнорирует touch-action: страницу нельзя ни листать, ни тянуть, ни масштабировать, пока открыта не панель
const inPanel = e => e.target.closest && e.target.closest('#panel, #bag, #shop, #smith, #lib, #skills, #map, #captain, #journal, #quests');
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
  if (cfg.view.smooth) renderer.setDprMax(desk ? cfg.view.smooth.dprMax.desk : cfg.view.smooth.dprMax.phone);
} catch (e) {
  $('nogl').hidden = false; console.warn('WebGL недоступен', e);
}

const W = createWorld(cfg);
// 4.12: приближение камеры — колесо, + и −, щипок двумя пальцами; запоминается в этом браузере
if (renderer && cfg.view.zoom) {
  const ZK = 'berserk3d.zoom', Z = cfg.view.zoom; let z0 = 1; try { z0 = Number(localStorage.getItem(ZK)) || 1; } catch (e) { /* без сохранения */ }
  const setZ = z => { const v = renderer.camZoom(z); try { localStorage.setItem(ZK, String(Math.round(v * 100) / 100)); } catch (e) { /* без сохранения */ } };
  { const zq = Number(new URLSearchParams(location.search).get('zoom')); if (zq) z0 = zq; }     // ?zoom=1.6 — для замера кадров
  renderer.camZoom(z0);
  canvas.addEventListener('wheel', e => { e.preventDefault(); setZ(renderer.camZoom() * Math.exp(e.deltaY * Z.wheel)); }, { passive: false });
  addEventListener('keydown', e => { if (e.metaKey || e.ctrlKey || (e.target && e.target.closest && e.target.closest('input, textarea'))) return; if (e.code === 'Equal' || e.code === 'NumpadAdd') setZ(renderer.camZoom() / Z.key); else if (e.code === 'Minus' || e.code === 'NumpadSubtract') setZ(renderer.camZoom() * Z.key); });
  const tp = new Map(); let pd = 0, pz = 1;     // касания по полю: два пальца — щипок
  canvas.addEventListener('pointerdown', e => { if (e.pointerType !== 'touch') return; tp.set(e.pointerId, [e.clientX, e.clientY]); if (tp.size === 2) { const [a, b] = [...tp.values()]; pd = Math.hypot(a[0] - b[0], a[1] - b[1]); pz = renderer.camZoom(); } });
  canvas.addEventListener('pointermove', e => { if (!tp.has(e.pointerId)) return; tp.set(e.pointerId, [e.clientX, e.clientY]); if (tp.size === 2 && pd > 20) { const [a, b] = [...tp.values()]; setZ(pz * pd / Math.max(20, Math.hypot(a[0] - b[0], a[1] - b[1]))); } });
  for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, e => { tp.delete(e.pointerId); if (tp.size < 2) pd = 0; });
}
const BENCH = new URLSearchParams(location.search).has('bench');      // ?bench: замер на устройстве — новая игра, сохранение не трогаем
const memStore = (() => { const o = {}; return { getItem: k => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); }, removeItem: k => { delete o[k]; } }; })();
const loaded = BENCH ? null : loadSaveAny(bagCap(cfg)), saved = loaded && loaded.save;     // испорчено основное — из резервной копии (шаг 11)
if (loaded && loaded.from !== 'main') setTimeout(() => toast('Сохранение было повреждено — загружена резервная копия', 'bad', '#ffb060', 'warn'), 1200);
if (!BENCH && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});     // попросить браузер не чистить сохранение
if (saved) { W.questFocus = saved.qf || null; W.hero = saved.hero; W.heroes = saved.heroes || {}; if (W.story && saved.story) W.story = saved.story; if (saved.ach) W.ach = saved.ach; if (W.life && saved.life) W.life = saved.life; W.inv = saved.inv; W.kills = saved.kills; Object.assign(W, saved.prog); unpackSeenChunks(saved.seen, W.seen, W.seenN); if (saved.pos) { W.player.x = saved.pos.x; W.player.z = saved.pos.z; resolve(W.map, W.player, cfg.player.radius); } applyDseen(W, saved.dseen); applyDungeonState(W, saved); restoreAllies(W, saved.squad); W.fires = sanitizeFires(saved.fires, W.map.fires.map(f => f.id)); restoreBosses(W, saved.bosses); if (saved.difficulty) setDifficulty(W, saved.difficulty); W.iron = saved.iron; W.tomb = saved.tomb; W.known = saved.known; W.quests = saved.quests; W.t = saved.t; W.shrines = saved.shrines; rerollRare(W); }
W.spark = saved && saved.prog.spark ? sanitizeSpark(saved.prog.spark, W) : sparkFresh(W);
W.mentor = saved && saved.prog.mentor ? sanitizeMentor(saved.prog.mentor) : mentorFresh();     // советы первопроходцу (4.01)     // «Первая искра» (шаг 12): ветерану без неё — сразу пройдена
W.path = saved && saved.prog.path ? sanitizePath(saved.prog.path, W) : pathFresh(W);
if (W.treeReset) { delete W.treeReset; setTimeout(() => toast('Новое древо умений: все очки возвращены — распределите их в окне умений', '', '#e8c04a', 'skills'), 2500); }     // переход на древо (2026-10-20)     // «Путь пепла» (шаг 13): старому сохранению — по уже сделанному
let saveFailT = -1e9;     // ошибка записи (кончилось место): сообщаем не чаще раза в минуту
const saver = BENCH ? createSaver(W, memStore) : createSaver(W, globalThis.localStorage, { onFail: () => { const t = performance.now(); if (t - saveFailT > 60000) { saveFailT = t; toast('Не удалось сохранить: в браузере мало места. Меню → Сохранение → «Сохранить в файл»', 'bad', '#ff8a6a', 'warn'); } } });

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
  if (heroSwitching) { if (!switchHero(W, id)) return; toast(`Теперь вы — ${H.name}, уровень ${W.lv}`, '', '#e8c04a'); }
  else { W.hero = id; if (H.start && !W.inv.eq.weapon) W.inv.eq.weapon = H.start; refreshGear(W); W.player.hp = W.player.maxhp; toast(`${H.name} выходит из пепла`, '', '#e8c04a'); }
  rerollRare(W); closeHeroPick(); saver.write(true);     // полка редкостей — под выбранного героя
}
function closeHeroPick() { $('heroPick').hidden = true; panelOpen = false; heroSwitching = false; }
// выбор героя по макету А (выбор владельца 2026-10-22): слева — имя, роль, описание и «Войти в мир»; в центре — 3D-модель; справа — список
let heroSel = null, heroView = null;
const heroLv = id => (id === W.hero ? W.lv : (W.heroes && W.heroes[id] ? W.heroes[id].lv : 1));
function drawHeroPick(switching = heroSwitching) {
  const box = $('heroCards'), H = HEROES[heroSel], R = cfg.abilities.res[heroSel], role = cfg.party && cfg.party.heroRole[heroSel], el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  box.textContent = '';
  const info = el('div', 'hinfo'), cur = switching && heroSel === W.hero;
  const go = el('button', 'hgo', cur ? 'Сейчас' : switching ? `Стать: ${H.name}` : 'Войти в мир'); go.type = 'button'; go.id = 'heroGo'; go.disabled = !H.open || cur; go.addEventListener('click', () => pickHero(heroSel));     // первая кнопка в #heroCards — выбрать (тесты жмут её)
  info.append(el('div', 'hnm', H.name + (switching ? ` · ур. ${heroLv(heroSel)}` : '')), el('div', 'hrole', H.role), el('div', 'htxt', H.text));
  const facts = el('div', 'hfacts'), fact = (k, v, c) => { const r = el('div', 'hf'), b = el('span', 'hv', v); if (c) { const d = el('i', 'hdot'); d.style.background = c; b.prepend(d); } r.append(el('span', 'hk', k), b); facts.append(r); };
  if (role) fact('В отряде', (Array.isArray(role) ? [...new Set(role)] : [role]).map(r => cfg.party.roleName[r] || r).join(' / ') + (Array.isArray(role) && new Set(role).size > 1 ? ' — по школе' : ''));     // школы (2026-10-22)
  if (R) fact('Ресурс', R.name, R.color);
  fact('Оружие', H.kinds.length ? H.kinds.map(k => KIND_NAME[k]).join(', ') : H.soon);
  info.append(facts, go);
  const stage = el('div', 'hstage');
  { const inv = createInv(); if (switching && heroSel === W.hero) Object.assign(inv.eq, W.inv.eq); else if (H.start) inv.eq.weapon = H.start;
    const cv = (heroView || (heroView = createHeroView(document))).show({ hero: heroSel, inv, ach: W.ach }); if (cv) stage.append(cv); else { const p = document.createElement('canvas'); p.width = p.height = 16; p.className = 'hpix'; drawPortrait(p, H.look); stage.append(p); } }
  const list = el('div', 'hlist'); list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', 'Герои');
  HERO_IDS.forEach((id, i) => {
    const Q = HEROES[id], row = el('button', 'hcard' + (id === heroSel ? ' on' : '') + (Q.open ? '' : ' shut') + (switching && id === W.hero ? ' cur' : '')); row.type = 'button'; row.dataset.hero = id; row.setAttribute('role', 'option'); row.setAttribute('aria-selected', String(id === heroSel));
    const p = document.createElement('canvas'); p.width = p.height = 16; drawPortrait(p, Q.look);
    const t = el('span', 'ht'); t.append(el('span', 'nm', Q.name + (switching ? ` · ${heroLv(id)}` : '')), el('span', 'role', Q.role));
    row.append(p, t); if (desk) row.append(el('span', 'hkey', String(i + 1)));
    row.addEventListener('click', () => { if (!Q.open) return; heroSel = id; drawHeroPick(); });
    row.addEventListener('dblclick', () => { heroSel = id; pickHero(id); });
    list.append(row);
  });
  box.append(info, stage, list);
}
function openHeroPick(switching = false) {
  heroSwitching = switching;
  $('heroCancel').hidden = !switching;
  $('heroNote').textContent = switching ? 'У каждого героя свой уровень, навыки и умения. Пепел, вещи и камни общие. Чужое оружие уйдёт в сумку.' : 'Героя можно сменить потом в меню: уровень, пепел и вещи останутся.';
  heroSel = switching ? W.hero : HERO_IDS.find(id => HEROES[id].open); drawHeroPick(switching);
  $('heroPick').hidden = false; panelOpen = true; input.release();
}
const input = createInput(document, window);
let panelOpen = false, landscape = false;
$('heroCancel').addEventListener('click', closeHeroPick);
$('heroSwitch').addEventListener('click', () => { $('tweakClose').click(); openHeroPick(true); });
// кнопки умений: видны только вкачанные; на кнопке значок, номер клавиши (на компьютере) и заливка перезарядки
const abilBtns = [0, 1, 2, 3, 4, 5].map(i => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'ab'; b.dataset.i = i; b.hidden = true;
  b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); b.classList.add('on'); input.ability(i + 1); });
  for (const t of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(t, () => b.classList.remove('on'));
  $('abil').append(b); return b;
});
// умение оружия (клеймёное, золотое): ячейка «F» после пяти умений на компьютере, отдельная кнопка над «Перекатом» на телефоне
const wBtn = document.createElement('button'); wBtn.type = 'button'; wBtn.className = 'ab wsk'; wBtn.dataset.i = 5; wBtn.hidden = true;
wBtn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); wBtn.classList.add('on'); input.ability(7); });
for (const t of ['pointerup', 'pointercancel', 'pointerleave']) wBtn.addEventListener(t, () => wBtn.classList.remove('on'));
$('abil').append(wBtn);
let wKey = '';
function drawWeaponSkill() {
  const v = weaponSkillView(W), show = !!v && !panelOpen && !landscape && !W.player.dead, mx = W.wp.mix, el = mx ? mx.a : W.wp.el;
  const key = show ? v.id + Math.ceil(v.cd * 10) + v.gold + (el || '') : '';
  if (key === wKey) return; wKey = key; if (wBtn.hidden === show) wBtn.hidden = !show; if (!show) return;
  if (wBtn.dataset.id !== v.id + v.gold) { wBtn.dataset.id = v.id + v.gold; wBtn.textContent = v.icon; const k = document.createElement('span'); k.className = 'k'; k.textContent = 'F'; wBtn.append(k);
    wBtn.setAttribute('aria-label', `Умение оружия: ${v.name} (F)`); wBtn.title = `${v.name} · клавиша F · перезарядка ${v.cdMax} с. ${v.text}`; }
  wBtn.classList.toggle('gold', !!v.gold); wBtn.style.setProperty('--wc', el ? ELEMENT_COLOR[el] : '#e8c07a');
  wBtn.style.setProperty('--cd', v.cd > 0 ? (v.cd / v.cdMax).toFixed(3) : 0);
}
let abilKey = '';
// ресурс героя (ярость, концентрация, мана): полоса над панелью умений на компьютере, под здоровьем на телефоне
const resBar = $('resBar'); let resKey = '';
function drawRes() {
  const r = resView(W), show = !!r && !panelOpen && !landscape && !W.player.dead && W.ab && Object.keys(W.ab).length > 0, key = show ? r.name + Math.round(r.now) : '';
  if (resBar.hidden === show) resBar.hidden = !show; if (!show || key === resKey) return; resKey = key;
  resBar.style.setProperty('--rc', r.color); resBar.firstChild.style.width = (100 * r.now / r.max).toFixed(1) + '%'; resBar.lastChild.textContent = desk ? `${r.name} ${Math.round(r.now)}/${r.max}` : String(Math.round(r.now)); resBar.title = r.name;     // на телефоне — только число (мало места)
}
function drawAbil() {
  drawRes(); drawWeaponSkill();
  const all = abilityView(W), bar = barOf(W), v = bar.map(id => all.find(a => a.id === id) || null), next = all.find(a => !a.open), cr = comboReady(W);     // связка: какие кнопки сейчас её завершат
  const key = v.map(a => (a ? a.id + a.rank + Math.ceil(a.cd * 10) + (a.enough ? 1 : 0) : '-')).join() + panelOpen + landscape + W.lv + cr.map(c => c.id).join();
  if (key === abilKey) return; abilKey = key;
  // ячейки панели (выбор — в окне «Навыки»): на компьютере 5 ячеек, как в Minecraft (пустые видны); на телефоне — только занятые, у кнопки удара
  abilBtns.forEach((b, i) => { const a = v[i], show = (!!a || desk) && !panelOpen && !landscape && !W.player.dead; if (b.hidden === show) b.hidden = !show; if (!show) return;
    const tag = a ? a.id + a.rank : 'empty'; if (b.dataset.id !== tag) { b.dataset.id = tag; b.textContent = ''; if (a) { const g = GI['n:' + a.id], own = ownIcon('n:' + a.id) || artURL('n:' + a.id); if (own) b.insertAdjacentHTML('beforeend', `<img class="abgi own" src="${own}" alt="">`); else if (g) b.insertAdjacentHTML('beforeend', `<svg class="abgi" viewBox="0 0 512 512" aria-hidden="true"><path d="${g}"/></svg>`); else b.textContent = a.icon; } const k = document.createElement('span'); k.className = 'k'; k.textContent = i + 1; b.append(k);     // свой значок игрока, потом рисованный, потом силуэт
      if (a) { const c = document.createElement('span'); c.className = 'c'; c.textContent = a.cost; b.append(c); } else if (next) { const l = document.createElement('span'); l.className = 'lv'; l.textContent = 'ур. ' + next.lv; b.append(l); }
      b.setAttribute('aria-label', a ? `${a.name} (${i + 1}), цена ${a.cost}` : 'Пустая ячейка: умение ставится в древе'); b.title = a ? `${a.name} · клавиша ${i + 1} · цена ${a.cost}` : 'Пусто: поставьте умение на панель в древе (карточка умения)'; }
    b.classList.toggle('empty', !a); b.classList.toggle('poor', !!a && !a.enough); { const c = a && cr.find(q => q.id === a.id); b.classList.toggle('combo', !!c); if (c) b.dataset.combo = c.combo.name; else delete b.dataset.combo; } if (!a) { b.style.setProperty('--cd', 0); return; }
    b.style.setProperty('--cd', a.cd > 0 ? (a.cd / a.cdMax).toFixed(3) : 0); });
}
{ const q = new URLSearchParams(location.search).get('hero') || (BENCH ? 'thorn' : null); if (!saved) { openHeroPick(); if (q) pickHero(q); } }

function onText(x, y, z, txt, cls) {
  if (!renderer) return;
  const p = renderer.project(x, y, z);
  if (!p.vis) return;
  const d = document.createElement('div');
  d.className = 'num ' + cls; d.textContent = txt;
  d.style.left = p.x + 'px'; d.style.top = p.y + 'px';
  $('dmg').appendChild(d);
  setTimeout(() => d.remove(), cls === 'say' ? 2500 : 900);     // реплики спутников (Г7) — дольше
}
function toast(txt, cls = '', color, ic) {     // ic — иконка из uiicons.js (шаг 10)
  const box = $('toasts'), d = document.createElement('div');
  d.className = 'toast ' + cls; if (ic) setIconText(d, ic, txt); else d.textContent = txt; if (color) d.style.color = color;
  box.appendChild(d); while (box.children.length > 3) box.firstChild.remove();     // не больше 3 (шаг 9)
  setTimeout(() => d.remove(), 3500);
}
const P = loadPrefs();
const feel = createFeel(cfg), feelFlash = $('feelFlash'), feelVig = $('feelVig'), streakEl = $('streak'), lvlCard = $('lvlCard');     // ощущение боя (этап 1 «круче»)
let lvlCardT = 0, lastFk = null, feelPeak = { scale: 1, flash: 0, zoom: 0 };     // feelPeak — сильнейший отклик с прошлого опроса (для тестов)
function showLevelCard(lv) {                                                    // карточка «Новый уровень»: что открылось
  const u = unlocksAt(lv, cfg, ABILITIES[W.hero] || []), lines = u.map(x => x.kind === 'ability' ? `Новое умение: ${x.name}` : x.kind === 'rank' ? (x.rank === 4 ? `Мастерство: ${x.name}` : `${x.name}: ранг ${x.rank}`) : `Отряд: до ${x.n} бойцов`);
  lines.push('Очко навыков' + (abilityPointsAt(lv, cfg) > abilityPointsAt(lv - 1, cfg) ? ' и очко умений' : ''));
  lvlCard.textContent = ''; const t = document.createElement('div'); t.className = 't'; t.textContent = `Уровень ${lv}`; const box = document.createElement('div'); box.className = 'u';
  for (const l of lines) { const d = document.createElement('div'); d.textContent = l; box.append(d); }
  lvlCard.append(t, box); lvlCard.hidden = false; lvlCard.style.animation = 'none'; void lvlCard.offsetWidth; lvlCard.style.animation = ''; lvlCardT = 3.2;
}
function onEvent(v) {
  { const fs = feel.event(v, W.player.maxhp); if (fs) { sfx(fs); if (fs === 'streak') { const n = feel.state().shown; streakEl.textContent = `Серия ×${n}`; streakEl.hidden = false; streakEl.classList.remove('pop'); void streakEl.offsetWidth; streakEl.classList.add('pop'); } } }
  sparkEvent(W, v);     // «Первая искра»: враги за оградой (шаг 12)
  mentorEvent(W, v);    // советы: сбор, ковка, продажа, библиотека (4.01)
  pathEvent(W, v);      // «Путь пепла»: первая победа над боссом-вехой (шаг 13)
  if (v.k === 'partyFill') toast(`Группа собрана (${v.size}): ${v.list.map(q => q.name).join(', ')}`, '', '#9ad0ff', 'horn');     // сбор группы (4.07)
  else if (v.k === 'partyLeave') toast(`Наёмники подземелья ушли (${v.n})`, '', '#c8c0b0', 'horn');
  if (v.k === 'wear') { const it = BY_ID[v.id]; if (it) toast(v.at === 'broken' ? `${it.name}: прочность на нуле — сила вдвое ниже. Почините у кузнеца` : `${it.name} изношен: сила падает. Почините у кузнеца или ремкомплектом`, 'bad', '#e8a04a', 'warn'); }     // прочность (4.03)
  else if (v.k === 'repair') toast(v.kit ? `Ремкомплект: надетое прочнее` : `Кузнец починил ${v.n}`, '', '#e8c04a', 'anvil');
  if (v.k === 'hurt') buzz(P, 35); else if (v.k === 'level' || v.k === 'questdone') buzz(P, [40, 40, 70]); else if (v.k === 'bossaggro' || v.k === 'bossblast') buzz(P, 90);
  sfx(v.k, v.x === undefined ? null : { x: v.x, z: v.z, px: W.player.x, pz: W.player.z, yaw: cfg.view.camYaw });     // звук мира: тише вдали, панорама по экрану (шаг 8)
  if (v.k === 'fireFound') { toast('Открыт костёр: ' + v.name, '', '#ffb060', 'fire'); sfx('evDone'); }
  else if (v.k === 'dusk') toast('Наступает ночь: торговец спит, враги злее', 'bad');
  else if (v.k === 'dawn') toast('Светает: торговец снова торгует', 'sys');
  if (v.k === 'pickup') { const it = BY_ID[v.id]; toast('+ ' + it.name + (v.n > 1 ? ' ×' + v.n : ''), '', RARITY[it.rar].color); }
  else if (v.k === 'open') toast(CONTAINERS[v.kind].name, 'sys');
  else if (v.k === 'locked') toast(`Заперто: нужен ключ уровня ${v.tier}+`, 'bad');
  else if (v.k === 'unlock') toast('Замок открыт', 'sys');
  else if (v.k === 'full') toast('Сумка полна', 'bad');
  else if (v.k === 'buff') toast('Действует зелье', 'sys');
  else if (v.k === 'place') showPlace(v.place);
  else if (v.k === 'storyGoal') { toast(`${v.name}: ${v.text}`, '', '#e8c04a', 'scroll'); sfx('questready'); }     // сюжет (этап 3)
  else if (v.k === 'storyDone') { toast(v.end ? ({ 1: 'Акт I «Наёмник» пройден. Отряд идёт на войну', 2: 'Акт II «Война» пройден. Вы ушли из отряда', 3: 'Акт III «Затмение» пройден. Впереди — месть', 4: 'Затмение побеждено. Сюжет пройден — у человека в маске есть дела на каждый день' })[v.act] || 'Акт пройден' : `Сцена пройдена: ${v.name}`, '', '#ffd27a', 'scroll'); sfx('questdone'); }
  else if (v.k === 'storyWave') toast(`Волна ${v.n} из ${v.of}`, 'bad', '#ff9a6a', 'warn');
  else if (v.k === 'storyFail') toast(v.text || 'Не вышло. Поговорите снова', 'bad', '#ff8a6a', 'warn');
  else if (v.k === 'bossSay') toast(`${v.who}: ${v.text}`, '', '#e8e0ff', 'scroll');     // реплики в бою рейда (этап 8)
  else if (v.k === 'storyFall') toast(`${v.name} уходит во тьму`, 'bad', '#c8a0ff', 'warn');     // Затмение (этап 7)
  else if (v.k === 'brand') toast('Клеймо жжёт — тени идут', 'bad', '#ff6a6a', 'warn');
  else if (v.k === 'storyEscape') toast(`${v.name} уходит, раненый`, '', '#ffd27a', 'warn');     // этап 7
  else if (v.k === 'drop') { const it = BY_ID[v.id]; if (it && it.rar >= 3) { toast(`Выпало: ${it.name}`, '', RARITY[it.rar].color, 'gem'); sfx(it.rar >= 4 ? 'brand' : 'rare'); } }
  else if (v.k === 'key') toast(`Ключ на связке: ${cfg.dungeons.keys[v.key] || 'ключ'}`, '', '#e8c04a', 'key');
  else if (v.k === 'doorLocked') toast(`Заперто: нужен ${cfg.dungeons.keys[v.key] || 'ключ'}`, 'bad');
  else if (v.k === 'travel') { saver.write(); if (!reduce) { const f = $('fade'); f.style.setProperty('--fade', cfg.dungeons.fade + 's'); f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on'))); } }
  else if (v.k === 'playerDead') {
    const parts = []; if (v.lost) parts.push(`Потеряно ${v.lost} пепла${W.tomb ? ': он лежит там, где вы пали' : ''}.`); if (v.burned) parts.push('Сгорели уровни улучшения.');
    $('deadTxt').textContent = v.iron ? 'Конец пути. Железный режим: сохранение стёрто.' : (parts.join(' ') || 'Потерь нет.');
    if (v.iron) { W.ironDead = true; saver.reset(); $('again').textContent = 'Начать заново'; }
  }
  else if (v.k === 'evStart') { toast(v.kind === 'rescue' ? 'Крик о помощи: путника окружили враги' : v.kind === 'ambush' ? 'Засада!' : v.kind === 'thief' ? 'Пепельный вор с мешком добычи! Догоните его' : `Обоз в «${v.place}» ищет охрану у ворот`, v.kind === 'ambush' ? 'bad' : '', '#ffc040', v.kind === 'ambush' ? 'warn' : 'horn'); sfx(v.kind === 'ambush' ? 'ambush' : 'evStart'); }
  else if (v.k === 'evMove') toast(`Обоз тронулся. Держитесь рядом до «${v.place}»`, 'sys');
  else if (v.k === 'evRaid') { toast('Налёт на обоз!', 'bad'); sfx('ambush'); }
  else if (v.k === 'evDone') { toast(v.kind === 'rescue' ? `Путник спасён: +${v.ash} пепла и его благодарность` : v.kind === 'ambush' ? `Засада отбита: +${v.ash} пепла` : v.kind === 'thief' ? `Вор пойман: +${v.ash} пепла и его мешок` : `Обоз дошёл: +${v.ash} пепла`, '', '#e8c04a'); sfx('evDone'); saver.write(); }
  else if (v.k === 'evFail') { const t = { dead: v.kind === 'caravan' ? 'Обоз разбит' : 'Путник погиб', late: v.kind === 'caravan' ? 'Обоз уехал без вас' : 'Путник не дождался помощи', fled: 'Вы ушли от засады', escaped: 'Вор скрылся в пепле', gone: '' }[v.why]; if (t) toast(t, 'bad'); }
  else if (v.k === 'rainStart') { const R = cfg.weather.combat; toast(`Дождь: враги слышат и видят хуже, огонь слабее${R.storm > 1 ? ', гроза сильнее' : ''}`, '', '#9ac0e0', 'rain'); }
  else if (v.k === 'rainStop') toast('Дождь кончился', '', '#c8d8e8', 'sun');
  else if (v.k === 'shopRare') { const it = BY_ID[v.id]; toast(`У торговца в лагере: ${cfg.shop.rare.tiers[v.tier - 1].name.toLowerCase()} — ${it.name}`, '', RARITY[it.rar].color, 'shop'); sfx(v.tier >= 3 ? 'brand' : 'rare'); }
  else if (v.k === 'shrine') { toast(`${v.name}: ${v.stat === 'regen' ? `+${v.amt} здоровья в секунду` : `+${v.amt} ${STAT_NAME[v.stat]}`} на ${Math.round(v.t / 60)} мин`, '', '#9ad8ff', 'sparkle'); sfx('buff'); }
  else if (v.k === 'wanderer') { toast('У дороги остановилась повозка сказочного торговца', '', '#c8a0ff', 'bell'); sfx('wanderer'); }
  else if (v.k === 'wanderLeave') toast('Сказочный торговец уехал', 'sys');
  else if (v.k === 'recall') toast('Свиток перенёс вас в лагерь', '', '#c8a0ff');
  else if (v.k === 'tomb') toast(`Вы нашли свой пепел: +${v.ash}`, '', '#e8c04a');
  else if (v.k === 'craft') toast('Скрафчено: ' + BY_ID[v.id].name, '', RARITY[BY_ID[v.id].rar].color);
  else if (v.k === 'tome') toast(`Прочитано: «${v.name}»${v.recipes ? ` · рецептов: ${v.recipes}` : ''}`, '', '#e8c04a');
  else if (v.k === 'questaccept') toast('Задание: ' + v.name, 'sys');
  else if (v.k === 'questready') toast('Можно сдать: ' + v.name, '', '#a8e0a0');
  else if (v.k === 'questdone') { toast('Задание выполнено: ' + v.name, '', '#e8c04a'); saver.write(); }
  else if (v.k === 'ach') { toast(`Подвиг: ${v.name} — ${v.reward}`, '', '#ffd45a', 'sparkle'); sfx('questdone'); saver.write(); }     // достижения (этап 6 «круче»)
  else if (v.k === 'ngStart') { toast(`Новый круг ${v.n + 1}: сюжет начинается заново, враги сильнее`, '', '#ffb060', 'fire'); sfx('questdone'); }     // этап 6 «круче»
  else if (v.k === 'eclipseDone') { toast(`Затмение недели пройдено: +${v.ash} пепла`, '', '#ffd45a', 'moon'); sfx('questdone'); saver.write(); }
  else if (v.k === 'abyssEnter') { toast(`Бездна · ярус ${v.tier}${v.mods.length ? ': ' + v.mods.join(', ') : ''}`, '', '#c8a0ff', 'moon'); sfx('questready'); }     // «Бездна» (этап 6 «круче»)
  else if (v.k === 'abyssOpen') { toast(`Ярус ${v.tier} зачищен — спуск открыт`, '', '#a8e0a0'); sfx('questdone'); }
  else if (v.k === 'abyssTier') toast(`Ярус ${v.tier}: +${v.ash} пепла${v.best === v.tier ? ' · рекорд!' : ''}`, '', '#e8c04a', 'ash');
  else if (v.k === 'abyssClosed') toast(`Спуск закрыт: врагов осталось ${v.n}`, 'sys');
  else if (v.k === 'abyssLocked') toast(`Бездна откроется с ${v.lv}-го уровня`, 'sys');
  else if (v.k === 'abyssTime') { toast(`Время вышло: Бездна выбросила вас наверх (ярус ${v.tier})`, '', '#ff8a6a'); saver.write(); }
  else if (v.k === 'questbeast') { toast(`${v.name} здесь!`, '', '#ffb060', 'warn'); sfx('questready'); }     // новые виды заданий (этап 5 «круче»)
  else if (v.k === 'questtrack') { toast(`${v.name}: следы ведут дальше (${v.i + 1}/${v.n})`, '', '#e8c04a', 'scroll'); sfx('questready'); }
  else if (v.k === 'questdefend') toast(`${v.name}: держите место — враги идут`, '', '#ffb060');
  else if (v.k === 'questwave') toast(`${v.name}: волна ${v.i} из ${v.n}`, '', '#ffb060');
  else if (v.k === 'questleft') toast(`${v.name}: вы оставили пост — оборона сначала`, 'sys');
  else if (v.k === 'questfail') { toast(`Задание провалено: ${v.name}${v.why === 'time' ? ' — время вышло' : ''}`, '', '#ff8a6a'); saver.write(); }
  else if (v.k === 'elite') toast('Элита: ' + v.name, 'bad');
  else if (v.k === 'bossaggro') { const e = W.enemies.find(x => x.id === v.id), f = e && cfg.enemies[e.type].g === 'f'; toast(`${v.name} ${f ? 'проснулась' : 'проснулся'}`, 'bad'); }     // род по врагу
  else if (v.k === 'bossphase') toast(`${v.name}: ${v.what}`, 'bad');
  else if (v.k === 'bossdead') toast(`${v.name} повержен!`, '', '#e8c04a');
  else if (v.k === 'allydead') toast(`${v.name} пал`, 'bad');
  else if (v.k === 'allyleft') toast(`${v.name} теперь вы — спутник покинул отряд, ${v.ash} пепла вернулось`);
  else if (v.k === 'gather') { const t = v.items.map(([id, n]) => `${BY_ID[id].name}${n > 1 ? ' ×' + n : ''}`).join(', '); toast(t ? 'Собрано: ' + t : 'Пусто — в этот раз ничего', t ? '' : 'bad'); }     // этап 6
  else if (v.k === 'profUp') { if (v.lv % 5 === 0 || v.lv < 5) toast(`${v.name}: ${v.lv}`, '', '#ffd27a'); }
  else if (v.k === 'mount') toast(v.on ? 'Верхом' : 'Спешились');
  else if (v.k === 'coachFound') toast(`Открыта повозка: ${v.name}`, '', '#ffd27a');
  else if (v.k === 'repTier') { toast(`${v.name}: ${v.tier}`, '', '#ffd27a', 'scroll'); sfx('level'); }
  else if (v.k === 'reward') toast(`Награда: ${v.name}`, '', '#ffd27a');
  else if (v.k === 'bossCast') { toast(`${v.name} читает «${v.what}» — собейте тяжёлым ударом или умением`, 'bad', '#c8a0ff', 'warn'); sfx('fuse'); }     // этап 5
  else if (v.k === 'bossInterrupt') { toast(`Чтение сбито: ${v.name} оглушён`, '', '#ffd27a'); sfx('block'); }
  else if (v.k === 'squadCmd') toast(v.auto ? 'Отряд снова идёт за вами' : v.cmd === 'hold' ? 'Отряд: держим здесь' : v.cmd === 'assist' ? 'Отряд: бьём вашу цель' : 'Отряд: за мной');
  else if (v.k === 'hire') toast(`${v.name} теперь с вами`, 'sys');
  else if (v.k === 'level') showLevelCard(v.lv);
  else if (v.k === 'prank') toast(`Пепельный ранг ${v.n}: +${(v.n * cfg.level.ranks.per * 100).toFixed(1)}% к урону и здоровью`, '', '#ffb060', 'fire');     // этап 3 «круче»     // карточка вместо тоста (этап 1 «круче»)
  else if (v.k === 'xp') onText(v.x, 3, v.z, '+' + v.n + ' оп.', 'xp');
}
// вход в зону (этап 1): крупная надпись с поясом уровней; на поверхности, при смене зоны
let lastZone = null;
function showZone() {
  if (W.lvl !== 'surface' || !$('heroPick').hidden) return; const q = zoneAt(cfg, W.player.x, W.player.z); if (!q || q.id === lastZone) return;
  const first = lastZone === null; lastZone = q.id; const el = $('zoneBan'); el.firstChild.textContent = q.name; el.lastChild.textContent = `уровни ${q.lv[0]}–${q.lv[1]}` + (first ? '' : ' · новая зона');
  el.hidden = false; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
}
function showPlace(pl) {
  const el = $('place'); el.hidden = !pl; if (!pl) return;
  el.className = pl.safe ? 'safe' : 'danger';
  el.textContent = pl.safe || String(W.lvl).startsWith('up:') ? `${pl.name}${String(W.lvl).startsWith('up:') ? '' : ' · безопасно'}` : `${pl.name} · опасность ${'▮'.repeat(pl.danger)}${'▯'.repeat(3 - pl.danger)}`;
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
}
function onHurt() {
  if (reduce) return;
  const f = $('flash'); f.classList.add('on');
  requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on')));
}

const fit = () => {
  landscape = false; document.documentElement.toggleAttribute('data-land', !desk && innerWidth > innerHeight);     // телефон боком — тоже играем (2026-10-21, просьба владельца): раскладка — в style.css [data-land]
  if (desk) {
    const st = document.documentElement.style, dz = Math.min(cfg.view.desk.zoomMax, Math.max(1, innerHeight / cfg.view.desk.baseH)), pz = Math.min(dz, 1.25);
    st.setProperty('--dz', dz.toFixed(3)); st.setProperty('--pz', pz.toFixed(3));
    // высоты окон — в пикселях, делённых на zoom: Safari и Chromium по-разному увеличивают проценты под zoom, а пиксели — одинаково
    st.setProperty('--pbh', Math.floor(innerHeight * .84 / pz) + 'px'); st.setProperty('--blh', Math.floor(innerHeight * .64 / pz) + 'px'); st.setProperty('--pbw', Math.floor(innerWidth * .86 / pz) + 'px'); st.setProperty('--fsw', Math.floor(innerWidth * .97 / pz) + 'px'); st.setProperty('--fsh', Math.floor(innerHeight * .94 / pz) + 'px');     // окна во весь экран (карта, перенос)
  }
  $('rotate').hidden = !landscape;
  renderer && renderer.resize(innerWidth, innerHeight);
};
addEventListener('resize', fit);
addEventListener('orientationchange', () => setTimeout(fit, 200));
fit();

const journal = createJournal(document, W, cfg, {
  onOpen: () => { panelOpen = true; input.release(); },
  onClose: () => { panelOpen = false; },
  onCraft: r => { if (r === 'ok') { sfx('craft'); saver.write(true); } }     // ремёсла и награды славы (этап 6)
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
  onReset: () => { saver.reset(); location.reload(); },     // сброс — из меню «Сохранение» с удержанием (шаг 4)
  onOwnIcon: it => pickOwnIcon(giKeyOf(it)),
  onSource: id => { bag.close(); journal.open('sources', id); }
});
const shop = createShop(document, W, cfg, {
  onOpen: () => { panelOpen = true; input.release(); if (W.spark) W.spark.trader = true; },
  onClose: () => { panelOpen = false; saver.write(); },
  onChange: () => { saver.write(); bag.render(); }
});
const skills = createSkills(document, W, cfg, {
  onOwnIcon: (key, reset) => (reset ? clearOwnIcon(key) : pickOwnIcon(key)),
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
  onChange: () => { saver.write(); bag.render(); },
  onSource: id => { smith.close(); journal.open('sources', id); }
});
const library = createLibrary(document, W, cfg, {
  onOpen: () => { panelOpen = true; input.release(); },
  onClose: () => { panelOpen = false; saver.write(); },
  onChange: () => { saver.write(); bag.render(); }
});
// книга рецептов: кнопка на HUD и клавиша R; G — «где взять» для вещи под курсором (data-item)
$('bookBtn').addEventListener('click', () => { if (!panelOpen) journal.open('recipes'); });
let hoverItem = null;
addEventListener('mouseover', e => { const t = e.target.closest && e.target.closest('[data-item]'); hoverItem = t ? t.dataset.item : null; });
function whereFrom() {
  const id = hoverItem; hideTipAll();
  for (const s of document.querySelectorAll('#bag:not([hidden]) button.close, #smith:not([hidden]) button.close, #lib:not([hidden]) button.close, #shop:not([hidden]) button.close')) s.click();
  journal.open('sources', id || null);
}
const hideTipAll = () => { const t = $('bagTip'); if (t) t.hidden = true; };
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
  onChange: t => { if (t && (t.reload || t.path === 'view.pixelScale')) fit(); applyVol(); },
  onOpen: () => { panelOpen = true; input.release(); renderDif(); { const b = $('ngBtn'); b.hidden = !ngOpen(W); b.dataset.arm = ''; b.textContent = `Новый круг ${(W.ng || 0) + 2}`; } $('heroNow').textContent = `${HEROES[W.hero].name} — ${HEROES[W.hero].role.toLowerCase()}. Смена героя сохраняет уровень, пепел, вещи и навыки.`; },
  onClose: () => { panelOpen = false; }
});
// клавиши компьютера (физические, работают на любой раскладке): действие, карта, сумка, навыки, задания, меню
if (desk) {
  $('keysHelp').hidden = false;
  for (const [id, k] of [['miniBtn', 'M'], ['bagBtn', 'I'], ['skillBtn', 'N'], ['bookBtn', 'R'], ['gear', 'Esc']]) $(id).title = `${$(id).getAttribute('aria-label')} (${k})`;
  const vis = id => !$(id).hidden;
  addEventListener('keydown', e => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const c = e.code;
    if (!$('heroPick').hidden) { const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'].indexOf(c), k = HERO_IDS.indexOf(heroSel);     // выбор героя А: цифра — сразу, стрелки — по списку, Enter — войти
      if (n >= 0 && HERO_IDS[n]) pickHero(HERO_IDS[n]); else if ((c === 'ArrowDown' || c === 'ArrowUp') && k >= 0) { heroSel = HERO_IDS[(k + (c === 'ArrowDown' ? 1 : HERO_IDS.length - 1)) % HERO_IDS.length]; drawHeroPick(); } else if (c === 'Enter') pickHero(heroSel); else if (c === 'Escape' && heroSwitching) closeHeroPick(); return; }
    if (!$('dead').hidden) { if (c === 'Enter' || c === 'KeyE') $('again').click(); return; }
    if (!$('dialog').hidden) { e.preventDefault(); const bs = [...$('dlgOpts').children], n = ['Digit1', 'Digit2', 'Digit3'].indexOf(c); if (n >= 0 && bs[n]) bs[n].click(); else if (c === 'KeyE' || c === 'Space' || c === 'Enter') bs[0] && bs[0].click(); else if (c === 'Escape') { dlg.i = dlg.lines.length; dlgClose(); } return; }     // разговор (этап 3)
    if (c === 'Escape' && aiming && !panelOpen) { e.preventDefault(); aimCancel = true; return; }     // Esc — отмена прицела
    if (c === 'Escape') { e.preventDefault(); const open = document.querySelector('section:not([hidden]) button.close'); if (open) open.click(); else $('gear').click(); return; }
    if (c === 'KeyH' && !panelOpen) { if (vis('heroicBtn')) heroicBtn.click(); return; }
    if ((c === 'KeyZ' || c === 'KeyX' || c === 'KeyC') && !panelOpen) { partyCmd(c === 'KeyZ' ? 'follow' : c === 'KeyX' ? 'hold' : 'assist'); return; }     // команды отряда (этап 4)
    if (c === 'KeyM') { if (!panelOpen || !mapEl.hidden) $('miniBtn').click(); return; }
    if (c === 'KeyI') { if (vis('bag')) $('bagClose').click(); else if (!panelOpen) $('bagBtn').click(); return; }
    if (c === 'KeyN') { if (vis('skills')) $('skillClose').click(); else if (!panelOpen) $('skillBtn').click(); return; }
    if (c === 'KeyQ') { if (vis('quests')) $('questClose').click(); else if (!panelOpen) { if (vis('questBtn')) $('questBtn').click(); else quests.open('mine'); } return; }
    if (c === 'KeyR') { if (vis('journal')) $('journalClose').click(); else if (!panelOpen) journal.open('recipes'); return; }
    if (c === 'KeyG') { if (!panelOpen || vis('bag') || vis('smith') || vis('shop') || vis('journal')) whereFrom(); return; }
    if (c === 'KeyB' && !panelOpen && vis('sleepBtn')) sleepBtn.click();
    if (c === 'KeyE' && !panelOpen) { if (lootOpen) $('lootAll').click(); else if (vis('lootBtn')) lootBtn.click(); else if (vis('portalBtn')) portalBtn.click(); else if (vis('fireBtn')) fireBtn.click(); else if (vis('coachBtn')) coachBtn.click(); else if (vis('gatherBtn')) gatherBtn.click(); else if (vis('talk')) talk.click(); }
    if (c === 'KeyV' && !panelOpen) mountBtn.click();     // конь (этап 6)
  });
}
$('again').addEventListener('click', () => { if (W.ironDead) { location.reload(); return; } respawnPlayer(W); $('dead').hidden = true; });
document.addEventListener('visibilitychange', () => { suspendAudio(document.hidden); if (document.hidden) { input.release(); saver.write(); } });
addEventListener('pagehide', () => saver.write());

try { setMuted(localStorage.getItem('berserk3d.mute') === '1'); } catch (e) { /* без сохранения */ }
let uvol = { all: 1, music: 1, sfx: 1 }; try { Object.assign(uvol, JSON.parse(localStorage.getItem('berserk3d.vol') || '{}')); } catch (e) { /* без сохранения */ }     // 4.08: ползунки громкости игрока
function applyVol() { setVolume(cfg.audio.volume * uvol.all); setUserMix(uvol.music, uvol.sfx); }
applyVol();
for (const [id, key] of [['volAll', 'all'], ['volMusic', 'music'], ['volSfx', 'sfx']]) {
  const el = $(id), out = el.nextElementSibling, show = () => { out.textContent = `${el.value}%`; };
  el.value = Math.round((Number(uvol[key]) || 0) * 100); show();
  el.addEventListener('input', () => { uvol[key] = el.value / 100; show(); applyVol(); try { localStorage.setItem('berserk3d.vol', JSON.stringify(uvol)); } catch (e) { /* без сохранения */ } });
  el.addEventListener('change', () => { ensureAudio(); if (key !== 'music') sfx('pickup'); });
}
for (const ev of ['pointerdown', 'touchstart', 'keydown']) addEventListener(ev, ensureAudio, { passive: true });
const muteBtn = $('muteBtn');
const showMute = () => { setIconText(muteBtn, isMuted() ? 'mute' : 'sound', isMuted() ? 'Звук выключен' : 'Звук включён'); };
// своё с устройства (2026-10-21): музыка и значки игрока — только в этом браузере (custom3d.js)
let ownActive = false, tracksQuiet = false; const tracks = createTracks(cfg, q => { tracksQuiet = q; setOwnMusicOn(ownActive || q); });     // треки оркестра (music3d.js)
let ownMusicOn = true; try { ownMusicOn = localStorage.getItem('berserk3d.ownMusic') !== '0'; } catch (e) { /* без сохранения */ }
let iconKey = null; const iconIn = $('ownIconFile'), musicIn = $('ownMusicFile');
function pickOwnIcon(key) { if (!key) return; iconKey = key; iconIn.value = ''; iconIn.click(); }
iconIn.addEventListener('change', () => { const f = iconIn.files && iconIn.files[0]; if (f && iconKey) setOwnIcon(iconKey, f).then(() => toast('Свой значок поставлен', '', '#a8e0a0')).catch(() => toast('Это не картинка', '', '#ff9a8a', 'warn')); });
$('ownMusicAdd').addEventListener('click', () => { musicIn.value = ''; musicIn.click(); });
musicIn.addEventListener('change', () => { addOwnMusic([...(musicIn.files || [])]).then(n => { toast(n ? `Своя музыка: +${n}` : 'Нет звуковых файлов', '', n ? '#a8e0a0' : '#ff9a8a'); syncOwnMusic(); }); });
$('ownMusicBtn').addEventListener('click', () => { ownMusicOn = !ownMusicOn; try { localStorage.setItem('berserk3d.ownMusic', ownMusicOn ? '1' : '0'); } catch (e) { /* без сохранения */ } syncOwnMusic(); });
$('ownMusicClear').addEventListener('click', () => clearOwnMusic().then(syncOwnMusic));
$('ownIconsClear').addEventListener('click', () => clearOwnIcons());
function syncOwnMusic() {
  const n = ownMusic().length, on = ownMusicOn && n > 0 && !isMuted(); ownActive = on; setOwnMusicOn(on || tracksQuiet); if (on) ownPlayer.start(); else ownPlayer.stop();
  $('ownMusicBtn').hidden = !n; setIconText($('ownMusicBtn'), 'sound', ownMusicOn ? `Своя музыка играет (${n})` : `Своя музыка выключена (${n})`);
  $('ownMusicClear').hidden = !n; $('ownMusicClear').textContent = 'Удалить свою музыку'; $('ownIconsClear').hidden = !ownIconCount(); $('ownIconsClear').textContent = `Вернуть значки игры (своих: ${ownIconCount()})`;
}
onOwnChange(() => { abilKey = ''; if (skills.isOpen()) skills.render(); if (!$('bag').hidden) bag.render(); try { syncOwnMusic(); } catch (e) { console.warn('своя музыка:', e && e.message); } });
loadOwn();
addEventListener('pointerdown', () => { if (ownPlayer.playing()) ownPlayer.pause(false); }, { once: true });
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => { if (!ownActive && !isMuted()) tracks.intro(uvol.all * uvol.music); }, { once: true });     // вступление — по первому жесту     // браузер играет звук только после жеста
muteBtn.addEventListener('click', () => { setMuted(!isMuted()); try { localStorage.setItem('berserk3d.mute', isMuted() ? '1' : '0'); } catch (e) { /* без сохранения */ } showMute(); ensureAudio(); sfx('pickup'); syncOwnMusic(); });
showMute();
const bagFill = $('bagFill');
let reliefDone = false, goalT = 0, ambT = 0, atmoT = 0, stepT = 0, hintT = 8, fpsN = 0, fpsT = 0;
// личные настройки: левша, размер кнопок, вибрация, счётчик кадров, подсказки
const prefBtn = (id, get, label, flip, ic) => { const b = $(id); const show = () => { setIconText(b, ic, label(get())); }; b.addEventListener('click', () => { flip(); savePrefs(P); applyPrefs(); }); return show; };
const uiTabs = $('uiTabs');
for (const [name, v] of UI_SCALES) { const b = document.createElement('button'); b.type = 'button'; b.className = 'tab'; b.dataset.v = v; b.textContent = 'Кнопки ' + name; b.addEventListener('click', () => { P.ui = v; savePrefs(P); applyPrefs(); }); uiTabs.appendChild(b); }
const qualTabs = $('qualTabs');     // пресеты качества (шаг 14)
for (const q of QUALITY_IDS) { const b = document.createElement('button'); b.type = 'button'; b.className = 'tab'; b.dataset.q = q; b.textContent = QUALITY_NAMES[q]; b.addEventListener('click', () => { P.quality = q; savePrefs(P); applyPrefs(); }); qualTabs.appendChild(b); }
const shows = [
  prefBtn('leftyBtn', () => P.lefty, v => v ? 'Режим левши: кнопки слева' : 'Режим левши выключен', () => { P.lefty = !P.lefty; }, 'swap'),
  prefBtn('vibBtn', () => P.vibrate, v => v ? 'Вибрация включена (на iPhone не работает)' : 'Вибрация выключена', () => { P.vibrate = !P.vibrate; }, 'phone'),
  prefBtn('fpsBtn', () => P.fps, v => v ? 'Счётчик кадров включён' : 'Счётчик кадров выключен', () => { P.fps = !P.fps; }, 'timer'),
  prefBtn('asciiBtn', () => P.ascii, v => v ? 'Вид: ASCII (символы)' : 'Вид: обычный', () => { P.ascii = !P.ascii; }, 'eye'),
  prefBtn('ecoBtn', () => ecoOn(), v => v ? 'Экономия заряда включена (30 кадров, меньше нагрев)' : 'Экономия заряда выключена', () => { P.eco = !ecoOn(); }, 'timer'),
  prefBtn('retroBtn', () => P.retro, v => v ? 'Ретро-пиксели включены' : 'Ретро-пиксели выключены', () => { P.retro = !P.retro; }, 'pixels'),
  prefBtn('hintBtn', () => P.hints, v => v ? 'Подсказки включены (нажмите: показать заново)' : 'Подсказки выключены', () => { P.hints = !P.hints; if (P.hints) P.seen = {}; }, 'hint')
];
function applyPrefs() {
  const r = document.documentElement; if (P.lefty) r.setAttribute('data-lefty', ''); else r.removeAttribute('data-lefty');
  r.style.setProperty('--ui', P.ui); $('fps').hidden = !P.fps;
  for (const b of uiTabs.children) b.classList.toggle('on', Number(b.dataset.v) === P.ui);
  for (const b of qualTabs.children) b.classList.toggle('on', b.dataset.q === P.quality);
  $('qualNote').textContent = { auto: 'Разрешение подстраивается под кадры.', low: 'Меньше разрешение, реже трава, без столбов света.', mid: 'Полное разрешение без теней.', high: desk ? 'Мягкие тени от солнца — нужна хорошая видеокарта.' : 'На телефоне — как «Среднее»: тени только на компьютере.' }[P.quality];
  if (renderer && (P.quality !== qualNow || ecoOn() !== ecoNow)) { qualNow = P.quality; ecoNow = ecoOn(); renderer.setQuality(P.quality, desk, ecoNow ? cfg.view.eco : null); if (cfg.view.smooth) renderer.setDprMax(Math.min(desk ? cfg.view.smooth.dprMax.desk : cfg.view.smooth.dprMax.phone, ecoNow ? cfg.view.eco.dpr : 9)); autoRes = P.quality === 'auto' ? makeAutoRes(cfg.view.quality.auto) : null; }
  shows.forEach(f => f());
  if (renderer && P.ascii !== asciiNow) { asciiNow = P.ascii; renderer.setAscii(P.ascii); }
  if (renderer && P.retro !== retroNow) { retroNow = P.retro; renderer.setRetro(P.retro); }
}
let asciiNow = false, retroNow = false, qualNow = null, autoRes = null, ecoNow = null;
// экономия заряда (2026-10-21): по умолчанию на телефоне; меньше кадров, плотности и мелочей вокруг
function ecoOn() { return P.eco === null || P.eco === undefined ? !desk : !!P.eco; }     // качество (шаг 14): пресет и «Авто»
if (new URLSearchParams(location.search).has('ascii')) P.ascii = true;      // для тестов и ссылок: сразу вид ASCII
if (new URLSearchParams(location.search).has('retro')) P.retro = true;      // для тестов и ссылок: сразу вид «Ретро»
applyPrefs();
// панель настройки прототипа и ссылка на 2D — только для разработки (?dev, шаг 4 «Минус»)
if (!new URLSearchParams(location.search).has('dev')) { $('tweakBox').hidden = true; $('back').hidden = true; }
// сброс прогресса: удерживать 1,5 с (шаг 4): случайное касание ничего не сотрёт
// «Новый круг» (этап 6 «круче»): второе нажатие подтверждает
$('ngBtn').addEventListener('click', e => { const b = e.currentTarget; if (!b.dataset.arm) { b.dataset.arm = '1'; b.textContent = 'Нажмите ещё раз: сюжет и задания заново, враги сильнее'; return; }
  if (startNg(W)) { b.hidden = true; saver.write(true); } });
{ const btn = $('saveReset'), HOLD = 1500; let t0 = 0, raf = 0;
  const stop = () => { cancelAnimationFrame(raf); t0 = 0; btn.style.setProperty('--k', 0); btn.classList.remove('on'); };
  const tick = () => { if (!t0) return; const k = Math.min(1, (performance.now() - t0) / HOLD); btn.style.setProperty('--k', k); if (k >= 1) { stop(); saver.reset(); location.reload(); return; } raf = requestAnimationFrame(tick); };
  const go = e => { if (e && e.preventDefault) e.preventDefault(); if (t0) return; t0 = performance.now(); btn.classList.add('on'); raf = requestAnimationFrame(tick); };
  btn.addEventListener('pointerdown', go); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, stop);
  btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') go(e); }); btn.addEventListener('keyup', stop); btn.addEventListener('blur', stop); }
// перенос сохранения
const codeEl = $('saveCode'), saveFlash = $('saveFlash');
const sflash = (t, bad) => { saveFlash.textContent = t; saveFlash.className = bad ? 'bad' : ''; };
$('expBtn').addEventListener('click', async () => {
  saver.write(true); const code = exportSave(); if (!code) { sflash('Сохранять пока нечего', true); return; }
  codeEl.value = code; codeEl.select();
  let ok = false; try { await navigator.clipboard.writeText(code); ok = true; } catch (e) { try { ok = document.execCommand('copy'); } catch (e2) { ok = false; } }
  sflash(ok ? 'Код скопирован. Вставьте его на другом устройстве' : 'Скопируйте код из поля вручную');
});
// сохранение в файл и из файла (шаг 11): файл — тот же код B3D1:…
$('fileSave').addEventListener('click', () => {
  saver.write(true); const code = exportSave(); if (!code) { sflash('Сохранять пока нечего', true); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([code], { type: 'text/plain' })); a.download = saveFileName(); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  sflash('Файл сохранён: ' + a.download);
});
$('fileLoad').addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
  const text = (await f.text()).trim(); if (importSave(text, bagCap(cfg)) !== 'ok') { sflash('В файле нет кода сохранения B3D1:', true); return; }
  sflash('Сохранение загружено, перезапуск…'); W.ironDead = true; setTimeout(() => location.reload(), 600);
});
$('impBtn').addEventListener('click', () => {
  if (importSave(codeEl.value, bagCap(cfg)) !== 'ok') { sflash('Код не подходит: нужна строка, начинающаяся с B3D1:', true); return; }
  sflash('Сохранение загружено, перезапуск…'); W.ironDead = true; setTimeout(() => location.reload(), 600);    // ironDead блокирует перезапись старым состоянием при выходе
});
const questBtn = $('questBtn'), trackerEl = $('tracker'); questBtn.addEventListener('click', e => { e.stopImmediatePropagation(); quests.open('here'); }, true);
let lastTrack = '', lastMark = '';
const talk = $('talk'), xpFill = $('xpFill'), skillBtn = $('skillBtn');
talk.addEventListener('click', e => { e.stopImmediatePropagation(); if (storyTalkable(W, W.nearNpc)) { dlgOpen(storyTalk(W, W.nearNpc)); return; } if (W.nearActor) { if (questsOf(W, W.nearNpc).length) quests.open('here'); else toast(`${W.nearActor.name.split(',')[0]}: «Потом. Делай, что должен.»`, '', W.nearActor.tint); return; } (W.nearNpc === 'smith' ? smith : W.nearNpc === 'captain' ? captain : W.nearNpc === 'scribe' ? library : shop).open(); }, true);     // сюжет первым (этап 3)
// костры (C3d): у костра — список открытых, перенос к выбранному
const fireBtn = $('fireBtn'), firesSec = $('fires');
function openFires() {
  const here = fireNear(W), list = $('firesList'), block = travelBlock(W); list.textContent = ''; firesSec.querySelector('h2').textContent = 'Костры — перенос';
  $('firesNote').textContent = block && block !== 'Подойдите к костру' ? block + ' — перенос невозможен.' : 'Нажмите на костёр на карте или в списке.';
  const p = W.player, pts = [];
  for (const f of knownFires(W).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))) {
    const me = !!(here && here.id === f.id), go = () => { if (fastTravel(W, f.id)) { closeFires(); sfx('travel'); } };
    const d = Math.round(Math.hypot(f.x - p.x, f.z - p.z)), b = document.createElement('button'); b.type = 'button'; b.dataset.id = f.id;
    setIconText(b, 'fire', f.name); const sm = document.createElement('small'); sm.textContent = me ? 'вы здесь' : d + ' м' + (f.danger ? ' · опасность ' + '▮'.repeat(f.danger) : ''); b.appendChild(sm);
    b.disabled = !!block || me; b.addEventListener('click', go); list.appendChild(b);
    pts.push({ x: f.x, z: f.z, name: f.name, icon: 'map:fire', bg: '#d8701c', me, off: !!block, go });
  }
  firesSec.hidden = false; panelOpen = true; input.release(); travelShow(pts);
}
// карта переноса (2026-10-20): та же большая карта мира, точки назначения — значки; нажатие — перенос. Общая для костров и повозки
let travelPick = null;
function travelShow(pts) { travelPick = pts; requestAnimationFrame(travelDraw); }
function travelDraw() {
  const cv = $('firesMap'), pts = travelPick; if (!pts || firesSec.hidden) return;
  const r = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1), w = Math.max(300, Math.round(r.width * d)), h = Math.max(240, Math.round(r.height * d)); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const cx = 0, cz = 0, sc = Math.min(w, h) / (cfg.world.radius * 2 + 12), ctx = cv.getContext('2d'), U = d * 1.2;     // 4.08: весь мир; неоткрытое — под туманом
  drawMap(ctx, mapW(), { w, h, scale: sc, cx, cz, full: true, ui: U, dpr: d });
  const X = x => w / 2 + (x - cx) * sc, Y = z => h / 2 + (z - cz) * sc;
  for (const q of pts) { q.px = X(q.x); q.py = Y(q.z);
    ctx.beginPath(); ctx.arc(q.px, q.py, 13 * U, 0, 6.2832); ctx.fillStyle = q.me ? '#ffe08a' : q.off ? '#8a7a6a' : q.bg; ctx.fill(); ctx.lineWidth = 3 * U; ctx.strokeStyle = q.me ? '#fff6c8' : '#1a0e08'; ctx.stroke();
    ctx.font = `700 ${Math.round(15 * U)}px "Alegreya Sans", Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 4 * U; ctx.strokeStyle = 'rgba(244,236,214,.95)'; ctx.fillStyle = '#2a1408';
    const t = q.name + (q.sub ? ' · ' + q.sub : ''); ctx.strokeText(t, q.px, q.py - 24 * U); ctx.fillText(t, q.px, q.py - 24 * U); ctx.textBaseline = 'alphabetic'; }
}
$('firesMap').addEventListener('click', e => {
  const cv = e.currentTarget, r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * cv.width, y = (e.clientY - r.top) / r.height * cv.height, d = Math.min(2, window.devicePixelRatio || 1);
  let best = null, bd = 30 * d; for (const q of travelPick || []) { const k = Math.hypot(q.px - x, q.py - y); if (k < bd) { bd = k; best = q; } }
  if (best && !best.me && !best.off) best.go();
});
window.addEventListener('resize', () => { if (!firesSec.hidden) travelDraw(); });
function closeFires() { firesSec.hidden = true; panelOpen = false; saver.write(); }
fireBtn.addEventListener('click', e => { e.stopImmediatePropagation(); input.release(); openFires(); }, true);
// жизнь мира (этап 6): повозка — окно костров без карты; сбор; конь
const coachBtn = $('coachBtn'), gatherBtn = $('gatherBtn'), mountBtn = $('mountBtn');
// окно добычи по макету А (4.21, выбор владельца): у тела с добычей — кнопка «Добыча · E»; окно — имя врага, таймер тела, вещи (клик — взять), «Взять всё» (E)
const lootBtn = $('lootBtn'), lootBox = $('loot'); let lootOpen = null, lootKey = '';
const lootEl = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
function openLoot() { const c = W.nearCorpse; if (!c) return; lootOpen = c.id; lootKey = ''; lootBox.hidden = false; drawLoot(c); }
function closeLoot() { lootOpen = null; lootBox.hidden = true; }
function drawLoot(c) {
  const its = corpseItems(W, c.id), left = Math.max(0, Math.ceil(c.life - c.t)), tt = c.fight ? 'Бой идёт — таймер тела стоит' : `Тело исчезнет через ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  const key = its.map(q => q.id + ':' + q.n).join(',') + '|' + tt; if (key === lootKey) return; lootKey = key;
  $('lootName').textContent = c.name; $('lootTime').textContent = tt; const list = $('lootList'); list.textContent = '';
  its.forEach((q, k) => { const it = BY_ID[q.id], b = lootEl('button', 'lrow'), ic = lootEl('span', 'lic'), im = lootEl('img'), tx = lootEl('span', 'ltx'), nm = lootEl('span', 'lnm', it.name);
    b.type = 'button'; b.style.setProperty('--rc', RARITY[it.rar].color); im.alt = ''; im.src = iconURL(document, it); ic.append(im); if (q.n > 1) ic.append(lootEl('i', '', String(q.n))); nm.style.color = RARITY[it.rar].color;
    tx.append(nm, lootEl('span', 'lsub', [it.slot ? SLOT_NAME[it.slot] : '', q.il ? 'ур. ' + q.il : '', RARITY[it.rar].name].filter(Boolean).join(' · '))); b.append(ic, tx);
    b.addEventListener('click', () => { lootCorpse(W, c.id, k); lootKey = ''; }); list.append(b); });
}
function lootUi(free) {
  const c = lootOpen && (W.corpses || []).find(x => x.id === lootOpen && x.lvl === W.lvl), p = W.player;
  if (lootOpen && (!c || p.dead || Math.hypot(c.x - p.x, c.z - p.z) > cfg.corpse.r + 1.5 || !corpseItems(W, c.id).length)) closeLoot();
  const nb = !!(free && W.nearCorpse && !lootOpen); if (lootBtn.hidden === nb) lootBtn.hidden = !nb; if (nb) { const l = 'Добыча' + (desk ? ' · E' : ''); if (lootBtn.textContent !== l) lootBtn.textContent = l; }
  if (lootOpen && c) drawLoot(c);
}
lootBtn.addEventListener('click', e => { e.stopImmediatePropagation(); input.release(); openLoot(); }, true);
$('lootAll').addEventListener('click', e => { e.stopImmediatePropagation(); if (lootOpen) { lootCorpse(W, lootOpen); lootKey = ''; } }, true);
$('lootClose').addEventListener('click', e => { e.stopImmediatePropagation(); closeLoot(); }, true);
const FLY = { far: 'Подойдите к повозке', unknown: 'Этот узел ещё не открыт', danger: 'Рядом враги', ash: 'Не хватает пепла' };
function openCoach() {
  const here = coachNear(W), list = $('firesList'); if (!here) return; list.textContent = ''; firesSec.querySelector('h2').textContent = 'Повозка'; const pts = [];
  $('firesNote').textContent = 'Повозка везёт в открытые города: нажмите на город на карте или в списке.';
  for (const c of coachList(W).filter(q => W.life.coaches[q.id])) {
    const b = document.createElement('button'), me = c.id === here.id, cost = flightCost(W, here, c); b.type = 'button'; b.textContent = c.name;
    const sm = document.createElement('small'); sm.textContent = me ? 'вы здесь' : `${cost} пепла · ${Math.round(Math.hypot(c.x - here.x, c.z - here.z))} м`; b.appendChild(sm); b.disabled = me || W.inv.ash < cost;
    const go = () => { const r = fly(W, c.id); if (r === 'ok') { closeFires(); sfx('travel'); toast(`Повозка: ${c.name}, −${cost} пепла`); } else toast(FLY[r] || 'Нельзя', 'bad'); };
    b.addEventListener('click', go); list.appendChild(b);
    pts.push({ x: c.x, z: c.z, name: c.name, sub: me ? 'вы здесь' : cost + ' пепла', icon: 'map:coach', bg: '#7a4ab8', me, off: W.inv.ash < cost, go });
  }
  firesSec.hidden = false; panelOpen = true; input.release(); travelShow(pts);
}
coachBtn.addEventListener('click', e => { e.stopImmediatePropagation(); input.release(); openCoach(); }, true);
const GATHER = { danger: 'Рядом враги — не до сбора', full: 'Сумка полна', none: 'Нечего собирать' };
gatherBtn.addEventListener('click', e => { e.stopImmediatePropagation(); input.release(); const r = gather(W); if (r === 'ok') sfx('pickup'); else toast(GATHER[r] || 'Нельзя', 'bad'); }, true);
const MOUNT = { none: 'Коня нет: его даёт Застава (слава «Дружелюбие»)', place: 'Здесь верхом нельзя', danger: 'Рядом враги — не сесть', dead: '' };
mountBtn.addEventListener('click', e => { e.stopImmediatePropagation(); input.release(); const r = mountToggle(W); if (MOUNT[r]) toast(MOUNT[r], 'bad'); }, true);
// сон (G4): затемнение, ночь проживается разом, утром — полное здоровье (или «разбудили»)
const sleepBtn = $('sleepBtn'), sleepFade = $('sleepFade'); let sleepingUI = false;
sleepBtn.addEventListener('click', e => {
  e.stopImmediatePropagation(); input.release();
  const why = sleepBlock(W); if (why) { toast(why, '', '#c8d4ff'); return; }
  sleepingUI = true; panelOpen = true; sleepFade.hidden = false; requestAnimationFrame(() => sleepFade.classList.add('on'));
  setTimeout(() => {
    const r = sleep(W); saver.write(true);
    toast(r === 'ok' ? 'Утро. Вы выспались — здоровье полное' : r === 'woken' ? 'Вас разбудили! Враги рядом' : r, '', r === 'ok' ? '#ffe08a' : '#ff8a6a', r === 'ok' ? 'sun' : 'warn');
    sleepFade.classList.remove('on'); setTimeout(() => { sleepFade.hidden = true; sleepingUI = false; panelOpen = false; }, 500);
  }, 650);
}, true);
$('firesClose').addEventListener('click', closeFires);
const portalBtn = $('portalBtn'); portalBtn.addEventListener('click', e => { e.stopImmediatePropagation(); input.release(); const q = W.nearPortal; if (q && !q.up) setHeroic(W, q.to, false); usePortal(W); }, true);     // обычный вход в подземелье снимает героическую
const heroicBtn = $('heroicBtn'); heroicBtn.addEventListener('click', e => { e.stopImmediatePropagation(); input.release(); const q = W.nearPortal; if (q && q.abyssEnter) { eclipseGo(W, weekOf(Date.now())); return; }     // «Затмение недели»
  if (q && !q.up && isInstance(W, q.to)) { setHeroic(W, q.to, true); usePortal(W); } }, true);     // этап 5
const SHOT = new URLSearchParams(location.search).has('shot');     // режим тестов и снимков: пролог сам не открывается
// разговор (этап 3): реплики по одной; у реплики-выбора — кнопки ответов; конец — сюжет идёт дальше
const HAIR = { alaric: '#ece6da', irma: '#2a1a14', timka: '#7a4a24', kord: '#1a1412', masked: '#0a0808', hostess: '#5a3020', captain: '#4a4440', herald: '#6a5030' };
const dlg = { lines: null, i: 0, part: null, scene: '', act: 1 };
// «кинокамера» (этап 5 «круче»): в разговоре сцены камера наезжает на говорящего — между героем и ним, ближе к нему
function cineFocus() {
  if (!dlg.lines || $('dialog').hidden) return null;
  const L = dlg.lines[dlg.i], who = Array.isArray(L) ? L[0] : 'hero', p = W.player, a = who !== 'hero' && storyActors(W).find(q => q.kind === who), b = cfg.view.cine.bias;
  const o = a || W.nearActor || null; return o ? { x: p.x + (o.x - p.x) * (a ? b : .5), z: p.z + (o.z - p.z) * (a ? b : .5) } : { x: p.x, z: p.z };
}
function dlgFace(who) { const cv = $('dlgFace'); if (who === 'hero') { drawPortrait(cv, HEROES[W.hero].look); return; } const S = SPEAKERS[who] || SPEAKERS.hostess;
  drawPortrait(cv, { cape: S.tint, cloth: S.tint, hair: HAIR[who] || '#3a2a1a', capeLen: .8, hood: who === 'masked' }); if (who === 'masked') { const g = cv.getContext('2d'); g.fillStyle = '#d8d0c0'; g.fillRect(5, 3, 6, 4); g.fillStyle = '#000'; g.fillRect(6, 4, 1, 1); g.fillRect(9, 4, 1, 1); } }
function dlgShow() {
  const L = dlg.lines[dlg.i], opts = $('dlgOpts'); opts.textContent = ''; $('dlgScene').textContent = `Акт ${['I', 'II', 'III', 'IV'][dlg.act - 1] || 'I'} · ` + dlg.scene;     // акт сцены (раньше всегда «Акт I»)
  const say = (who, text) => { const S = SPEAKERS[who] || SPEAKERS.hostess; $('dlgWho').textContent = who === 'hero' && W.ach && W.ach.title ? `${S.name}, ${W.ach.title.toLowerCase()}` : S.name; $('dlgWho').style.color = who === 'hero' ? '#e8c04a' : S.tint === '#1c161a' ? '#b0a8b8' : S.tint; $('dlgLine').textContent = text; dlgFace(who); };
  const btn = (label, fn, main) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; if (main) b.className = 'main'; b.addEventListener('click', fn); opts.append(b); return b; };
  if (Array.isArray(L)) { say(L[0], L[1]); btn(dlg.i < dlg.lines.length - 1 ? 'Далее' + (desk ? ' · E' : '') : 'Закончить' + (desk ? ' · E' : ''), dlgNext, true).focus(); return; }
  say('hero', '…'); L.choose.forEach(([label, reply, eff], k) => btn((desk ? `${k + 1}. ` : '') + label, () => { dlg.lines.splice(dlg.i + 1, 0, reply); const v = eff && storyChoice(W, eff); if (v) toast([v.note, v.ash ? `+${v.ash} пепла` : '', v.item, v.rep ? `+${v.rep} репутации` : ''].filter(Boolean).join(' · '), '', '#e8c04a', 'scroll'); dlgNext(); }, k === 0));     // следствие выбора (этап 5 «круче»)
}
function dlgNext() { dlg.i++; if (dlg.i >= dlg.lines.length) dlgClose(); else dlgShow(); }
function dlgClose() { document.body.classList.remove('cine'); $('dialog').hidden = true; panelOpen = false; const part = dlg.part; dlg.lines = null; storyTalked(W, part); saver.write(true); }
function dlgOpen(t) { if (!t || !t.lines || !t.lines.length) { if (t) storyTalked(W, t.part); return; } dlg.lines = t.lines.slice(); dlg.i = 0; dlg.part = t.part; dlg.scene = t.scene; dlg.act = t.act || 1; document.body.classList.add('cine'); $('dialog').hidden = false; panelOpen = true; input.release(); dlgShow(); }
// карта: миникарта в углу, большая карта по касанию
const miniCtx = $('mini').getContext('2d'), mapCv = $('mapCv'), mapCtx = mapCv.getContext('2d'), mapEl = $('map');
let miniT = 0;
// на втором этаже карта — улица вокруг дома (2026-10-21)
const mapW = () => { const L = W.levels && W.levels[W.lvl]; if (!(L && L.map && L.map.floor)) return W; const S = W.levels.surface; return { ...W, map: S.map, lvl: 'surface', seen: S.seen, seenN: S.seenN, seenR: S.seenR, seenC: S.seenC }; };
function drawMini() { drawMap(miniCtx, mapW(), { w: 128, h: 128, scale: 128 / cfg.mapView.miniSpan, cx: W.player.x, cz: W.player.z, full: false }); }     // miniSpan — сколько метров видно поперёк
// большая карта (C3e): масштаб и прокрутка — вид mv { cx, cz, span (м на ширину) }; в подземелье — весь уровень
const MAP_MIN = 60, mv = { cx: 0, cz: 0, span: 220 };
const mapBox = () => { const R = cfg.world.radius, V = cfg.mapView; return [R * (V.wide || 1), R * (V.tall || 1)]; };     // 4.08: края подложки (полуширина, полувысота), м
const mapMax = () => { const [RW, RH] = mapBox(), S = mapSide(); return Math.max(cfg.world.radius * 2 + 6, Math.min(2 * RW * S / mapCv.width, 2 * RH * S / mapCv.height)); };     // отдаление: весь круг мира или подложка во весь экран
const mapClamp = () => { mv.span = Math.max(MAP_MIN, Math.min(mapMax(), mv.span)); const [RW, RH] = mapBox(), k = mv.span / mapSide(), mx = Math.max(0, RW - mapCv.width * k / 2), mz = Math.max(0, RH - mapCv.height * k / 2); mv.cx = Math.max(-mx, Math.min(mx, mv.cx)); mv.cz = Math.max(-mz, Math.min(mz, mv.cz)); };     // 4.08: сдвиг — до края подложки по ширине и высоте
let mapRaf = 0; const mapRedraw = () => { if (!mapRaf) mapRaf = requestAnimationFrame(() => { mapRaf = 0; drawFull(); }); };
// размер холста карты — по окну (почти весь экран, 2026-10-20), с плотностью пикселей; масштаб — метров на ширину
const mapDpr = () => Math.min(2, window.devicePixelRatio || 1);
const mapFit = () => { const r = mapCv.getBoundingClientRect(), d = mapDpr(), w = Math.max(320, Math.round(r.width * d)), h = Math.max(240, Math.round(r.height * d)); if (mapCv.width !== w || mapCv.height !== h) { mapCv.width = w; mapCv.height = h; } };
const mapSide = () => Math.min(mapCv.width, mapCv.height);     // масштаб карты — по меньшей стороне холста (4.04)
const mapZoom = (k, px = mapCv.width / 2, py = mapCv.height / 2) => { const Wd = mapCv.width, Hd = mapCv.height, S = mapSide(), s0 = mv.span, wx = mv.cx + (px - Wd / 2) / S * s0, wz = mv.cz + (py - Hd / 2) / S * s0; mv.span *= k; mapClamp(); mv.cx = wx - (px - Wd / 2) / S * mv.span; mv.cz = wz - (py - Hd / 2) / S * mv.span; mapClamp(); mapRedraw(); };     // точка под курсором остаётся на месте     // точка под курсором остаётся на месте
let mapView = null;     // последний вид большой карты — для облаков
function drawFull() { const B = mapW().map.bounds, cx = B ? (B.x0 + B.x1) / 2 : mv.cx, cz = B ? (B.z0 + B.z1) / 2 : mv.cz, span = B ? Math.max(B.x1 - B.x0, B.z1 - B.z0) + 6 : mv.span; $('mapZoom').hidden = !!B; mapFit(); drawMap(mapCtx, W, { w: mapCv.width, h: mapCv.height, scale: mapSide() / span,     // по меньшей стороне: «весь мир» влезает целиком
 cx, cz, full: true, ui: mapDpr() * 1.15, dpr: mapDpr() }); mapView = { w: mapCv.width, h: mapCv.height, sc: mapSide() / span, cx, cz, under: !!B }; const pl = W.place; legend(B ? `Вы здесь: ${pl ? pl.name : 'подземелье'}` : pl ? `Вы здесь: ${pl.name}` : 'Вы в глуши', B ? LEG_UNDER : LEG_SURF); }
// легенда карты — чипы «значок + слово» вместо абзаца (шаг 10): sq — квадрат, ring — круг-граница, dot — точка, fog — туман
const LEG_SURF = [['sq', '#8a5a30', 'Люк'], ['ring', '#82c878', 'Безопасно'], ['ring', '#dc4632', 'Опасно'], ['dot', '#ffc860', 'Сундук'], ['dot', '#ffd45a', 'Торговец'], ['dot', '#ff8a3a', 'Кузнец'], ['dia', '#ff3a2a', 'Босс'], ['dia', '#c03adf', 'Замок'], ['dia', '#ff9a2a', 'Мини-босс'], ['sq', '#7a4a2a', 'Лагерь врагов'], ['sq', '#b0a898', 'Город'], ['fog', '#2a1e17', 'Не исследовано']];
const LEG_UNDER = [['sq', '#e8d0a0', 'Лестница наверх'], ['dot', '#ffc860', 'Сундук'], ['fog', '#2a1e17', 'Не исследовано']];
function legend(here, items) {
  const box = $('mapLegend'), key = here + items.length; if (box.dataset.k === key) return; box.dataset.k = key;
  const h = document.createElement('div'); h.className = 'here'; h.textContent = here; const row = document.createElement('div'); row.className = 'chips';
  for (const [shape, color, word] of items) { const c = document.createElement('span'), sw = document.createElement('i'); c.className = 'chip'; sw.className = 'sw ' + shape; sw.style.setProperty('--c', color); c.append(sw, word); row.append(c); }
  box.replaceChildren(h, row);
}
// облака над картой (4.05): свой холст поверх #mapCv, кадры — только пока карта открыта; «меньше движения» — облака стоят
const cloudCv = $('mapClouds'), cloudCtx = cloudCv.getContext('2d'), clouds = createMapClouds(document, cfg); let cloudOn = false, cloudLast = 0, reliefShown = 0;
function cloudTick(ts) {
  if (mapEl.hidden) { cloudOn = false; return; }
  requestAnimationFrame(cloudTick); if (ts - cloudLast < 1000 / cfg.mapView.clouds.fps) return; cloudLast = ts;
  const v = mapView; if (!v) return;
  if (cloudCv.width !== v.w || cloudCv.height !== v.h) { cloudCv.width = v.w; cloudCv.height = v.h; }
  const st = cloudCv.style; st.left = mapCv.offsetLeft + 'px'; st.top = mapCv.offsetTop + 'px'; st.width = mapCv.offsetWidth + 'px'; st.height = mapCv.offsetHeight + 'px';
  if (!reliefDone && ts - reliefShown > 300) { reliefShown = ts; mapRedraw(); }     // подложка ещё строится — показываем, что готово
  if (v.under) { cloudCtx.clearRect(0, 0, v.w, v.h); return; }     // под землёй облаков нет
  clouds.draw(cloudCtx, v, CALM_UI ? 0 : ts / 1000);
}
const mapOpen = () => { mv.cx = W.player.x; mv.cz = W.player.z; mapEl.hidden = false; mapFit(); mapClamp(); drawFull(); requestAnimationFrame(drawFull); panelOpen = true; input.release(); if (!cloudOn) { cloudOn = true; requestAnimationFrame(cloudTick); } };     // после показа — размер холста по окну
window.addEventListener('resize', () => { if (!mapEl.hidden) mapRedraw(); });
{ const pts = new Map(), loc = e => { const r = mapCv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * mapCv.width, y: (e.clientY - r.top) / r.height * mapCv.height }; }; let pinch = 0;
  mapCv.addEventListener('wheel', e => { e.preventDefault(); const q = loc(e); mapZoom(Math.exp(e.deltaY * .0015), q.x, q.y); }, { passive: false });
  mapCv.addEventListener('pointerdown', e => { mapCv.setPointerCapture(e.pointerId); pts.set(e.pointerId, loc(e)); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); } });
  mapCv.addEventListener('pointermove', e => { if (!pts.has(e.pointerId)) return; const q = loc(e), o = pts.get(e.pointerId); pts.set(e.pointerId, q);
    if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch > 0 && d > 0) mapZoom(pinch / d, (a.x + b.x) / 2, (a.y + b.y) / 2); pinch = d; }       // щипок
    else { mv.cx -= (q.x - o.x) / mapSide() * mv.span; mv.cz -= (q.y - o.y) / mapSide() * mv.span; mapClamp(); mapRedraw(); } });       // перетаскивание
  const up = e => { pts.delete(e.pointerId); pinch = 0; }; mapCv.addEventListener('pointerup', up); mapCv.addEventListener('pointercancel', up);
  $('mapIn').addEventListener('click', () => mapZoom(1 / 1.5)); $('mapOut').addEventListener('click', () => mapZoom(1.5));
  $('mapMe').addEventListener('click', () => { mv.cx = W.player.x; mv.cz = W.player.z; mapClamp(); mapRedraw(); }); $('mapAll').addEventListener('click', () => { mv.span = mapMax(); mv.cx = mv.cz = 0; mapClamp(); mapRedraw(); }); }
const mapClose = () => { mapEl.hidden = true; panelOpen = false; };
$('miniBtn').addEventListener('click', () => (mapEl.hidden ? mapOpen() : mapClose()));
$('mapClose').addEventListener('click', mapClose);
const bossEl = $('boss'), bossFill = $('bossFill'), bossName = $('bossName');
let lastBoss = '';
const comboEl = $('combo'), statusRow = $('statusRow');
let lastCombo = 0, lastSt = '', hudT = 1, hudP = false;
$('smithJournal').addEventListener('click', () => { smith.close(); journal.open(); });
const hpFill = $('hpFill'), hpGhost = $('hpGhost'), hpTxt = $('hpTxt'), hudLv = $('hudLv'), hudAsh = $('hudAsh'), hudTime = $('hudTime');
// диск времени (4.18г, просьба владельца): сутки по кругу — день, рассвет и закат, ночь; диск крутится, метка сверху — сейчас
const dialEl = (() => { const D = cfg.daynight, st = []; for (let i = 0; i <= 48; i++) { const ph = i / 48, L = lightOf((ph - D.start + 1) % 1 * D.len, D), c = L < .5 ? mix('#1c2650', '#f08a5a', L * 2) : mix('#f08a5a', '#f6d77a', (L - .5) * 2); st.push(`${c} ${(ph * 360).toFixed(1)}deg`); }
  hudTime.textContent = ''; const d = document.createElement('span'), i = document.createElement('i'); d.className = 'dial'; i.style.background = `conic-gradient(${st.join(',')})`; d.append(i); hudTime.append(d); return i; })();
function timeDial(W) { const ph = phaseOf(W.t, cfg.daynight), txt = `${clockText(W.t, cfg.daynight)} · ${W.night ? 'ночь' : 'день'}`; dialEl.style.transform = `rotate(${(-ph * 360).toFixed(1)}deg)`; hudTime.title = txt; hudTime.setAttribute('aria-label', 'Время: ' + txt); }
// прицел умения по площади (2026-10-20, просьба владельца): клавиша — кружок под мышью; клик или та же клавиша — удар; правый клик или Esc — отмена
let aiming = null, aimCancel = false, atkHold = false;
function aimStep(inp) {
  const sl = inp.ability >= 1 && inp.ability <= 6 ? inp.ability - 1 : -1, p = W.player;
  if (atkHold) { if (!inp.attack) atkHold = false; inp.attack = inp.attackPress = false; }     // кнопка мыши после удара ещё зажата — не бить оружием
  if (aiming) {
    const A = abilityAim(W, aiming.slot);
    if (aimCancel || inp.roll || p.dead || !A) { aiming = null; aimCancel = false; inp.roll = false; inp.ability = 0; }     // правый клик отменяет прицел, а не катит
    else if (inp.attackPress || sl === aiming.slot) { inp.ability = aiming.slot + 1; inp.attack = inp.attackPress = false; atkHold = true; aiming = null; }
    else if (sl >= 0) { if (abilityAim(W, sl) && !(W.acd[barOf(W)[sl]] > 0)) { aiming = { slot: sl }; inp.ability = 0; } else aiming = null; }
    else inp.attack = inp.attackPress = false;
  } else if (sl >= 0 && abilityAim(W, sl) && !(W.acd[barOf(W)[sl]] > 0)) { aiming = { slot: sl }; inp.ability = 0; aimCancel = false; }
  if (!renderer) return;
  const A = aiming && abilityAim(W, aiming.slot); if (!A || !inp.aimPt) { renderer.setAim(null); return; }
  const dx = inp.aimPt.x - p.x, dz = inp.aimPt.z - p.z, d = Math.hypot(dx, dz), k = d > A.range ? A.range / d : 1;     // как в умении: точка не дальше дальности
  renderer.setAim({ x: p.x + dx * k, z: p.z + dz * k, r: A.r, el: A.el, px: p.x, pz: p.z, range: A.range });
}
let saveT = 0, lastHp = -1, lastKey = '', last = performance.now(), simK = 1;
const CALM_UI = matchMedia('(prefers-reduced-motion: reduce)').matches;
// замер кадра (C5): время процессора на симуляцию и подготовку отрисовки, вызовы и треугольники; окно последних 600 кадров
const perf = { sim: [], draw: [], calls: 0, tris: 0, max: 0, n: 0 }, PERF_N = 600;
const perfPush = (a, v) => { a.push(v); if (a.length > PERF_N) a.shift(); };
// защита от сбоев (шаг 11): ошибка в кадре не останавливает игру — прогресс сохраняется, следующий кадр всё равно будет;
// ошибки подряд — плашка с перезагрузкой
let crashN = 0, crashShown = false;
function crashed(e) {
  crashN++; try { console.error(e); localStorage.setItem('berserk3d.lastError', String(e && (e.stack || e.message) || e).slice(0, 600)); } catch (e2) { /* без записи */ }
  if (crashN === 1) { try { saver.write(true); } catch (e3) { /* уже сохранено раньше */ } toast('Сбой в игре — прогресс сохранён', 'bad', '#ff8a6a', 'warn'); }
  if (crashN >= 30 && !crashShown) { crashShown = true; showBlocker('Игра столкнулась с ошибкой. Прогресс сохранён.', 'Перезагрузить', () => location.reload()); }
}
function showBlocker(text, btn, act) {
  const v = document.createElement('div'); v.className = 'veil blocker'; v.setAttribute('role', 'alertdialog');
  const p = document.createElement('p'); p.textContent = text; v.append(p);
  if (btn) { const b = document.createElement('button'); b.type = 'button'; b.className = 'main'; b.textContent = btn; b.addEventListener('click', act); v.append(b); }
  document.body.append(v); return v;
}
addEventListener('error', () => { try { saver.write(); } catch (e) { /* без записи */ } });
addEventListener('unhandledrejection', () => { try { saver.write(); } catch (e) { /* без записи */ } });
// потеря WebGL (сон, перегрев, сброс драйвера): сохранить, предупредить; вернулся — перезапустить страницу
$('gl').addEventListener('webglcontextlost', e => { e.preventDefault(); try { saver.write(true); } catch (e2) { /* без записи */ } if (!$('glLost')) showBlocker('Графика перезапускается…').id = 'glLost'; });
$('gl').addEventListener('webglcontextrestored', () => location.reload());
// открытие систем по вехам (шаг 13): закрытые кнопки не видны; у закрытого жителя — подсказка, когда он откроется
const npcLocked = npc => { const L = unlocks(W); return (npc === 'smith' && !L.smith) || (npc === 'captain' && !L.squad); };
let lockedNear = null;
function applyLocks() {
  for (const id of ['bagJournal', 'smithJournal']) { const b = $(id); if (b && b.hidden) b.hidden = false; }     // книга рецептов открыта с начала (2026-10-18); бестиарий и атлас внутри — по вехе
  const n = W.nearNpc && npcLocked(W.nearNpc) ? W.nearNpc : null; if (n && n !== lockedNear && !panelOpen) toast(lockedHint(W, n), 'sys', '#c8b898', 'hint'); lockedNear = n;
}
// финал «Пути пепла»: сводка и «Продолжить» (замки остаются вызовом)
function showEnd() {
  if (W.path.shown) return; W.path.shown = true; saver.write(); sfx('evDone');
  const mins = Math.round((W.t || 0) / 60), v = showBlocker(`Путь пепла пройден. Уровень ${W.lv} · врагов повержено ${W.kills} · в пути ${mins} мин. Дальше — замки: Кастелян Пепла и Королева Пустоши.`, 'Продолжить', () => v.remove());
  v.classList.add('ending'); const h = document.createElement('h1'); h.textContent = 'Пепел улёгся'; v.prepend(h);
}
// отряд-спутники (этап 4): рамки бойцов с полосками здоровья и три команды
const partyEl = $('party'), partyList = $('partyList'), PROLE = { tank: 'защитник', heal: 'лекарь', ranged: 'стрелок', melee: 'боец' };
let partyKey = null;
function partyCmd(cmd) {
  const r = squadCommand(W, cmd); if (r === 'ok') sfx('buff');
  if (r === 'empty') toast('Отряда нет: бойцов и спутников нанимает капитан Заставы', 'bad'); else if (r === 'none') toast('Рядом нет цели: ударьте врага, потом «Цель»', 'bad');
}
for (const b of $('partyCmd').children) b.addEventListener('click', () => partyCmd(b.dataset.cmd));
function drawParty() {
  const live = liveAllies(W), key = live.map(a => a.id).join(',');
  partyEl.hidden = !live.length; if (!live.length) { if (partyKey) document.documentElement.style.setProperty('--ph', '0px'); partyKey = key; return; }
  if (key !== partyKey) {
    partyKey = key; partyList.textContent = '';
    for (const a of live) { const T = cfg.squad.types[a.type], r = document.createElement('div'), nm = document.createElement('div'), b = document.createElement('b'), sp = document.createElement('span'), bar = document.createElement('div');
      r.className = 'pm'; nm.className = 'nm'; bar.className = 'bar'; b.textContent = a.name || T.name; b.style.color = T.tint === '#2e2e34' ? '#c8c8d8' : T.tint; sp.textContent = PROLE[T.role] || ''; nm.append(b, sp); bar.append(document.createElement('i')); r.append(nm, bar); partyList.append(r); }
    document.documentElement.style.setProperty('--ph', partyEl.offsetHeight + 8 + 'px');     // сообщения уходят ниже рамок отряда
  }
  live.forEach((a, i) => { const r = partyList.children[i], k = Math.max(0, Math.min(1, a.hp / a.maxhp)); r.lastChild.firstChild.style.transform = `scaleX(${k})`; r.classList.toggle('low', k < .35); });
  for (const b of $('partyCmd').children) b.classList.toggle('on', b.dataset.cmd === W.party.cmd);
}
let ecoLast = 0;
function loop(now) { if (ecoNow && cfg.view.eco) { const gap = 1000 / (panelOpen ? cfg.view.eco.panelFps : cfg.view.eco.fps) - 2; if (now - ecoLast < gap) { requestAnimationFrame(loop); return; } ecoLast = now; }     // экономия: пропуск кадров
  try { frame(now); if (crashN && !crashShown) crashN = Math.max(0, crashN - .02); } catch (e) { crashed(e); } finally { requestAnimationFrame(loop); } }
function frame(now) {
  const t0 = performance.now(), real = (now - last) / 1000, dt = Math.max(0, Math.min(.05, real)); last = now;
  // под меню (шаг 5): бой останавливается плавно за UI.stopT с (при «уменьшить движение» — сразу), а картинка живёт — вода, ветер, частицы
  const paused = panelOpen || landscape; simK = paused ? (CALM_UI ? 0 : Math.max(0, simK - real / cfg.ui.stopT)) : 1;
  const fk = lastFk = feel.tick(dt, W.player.dead ? 1 : W.player.hp / W.player.maxhp, CALM_UI);     // шаг не длиннее 0,05 с: долгий кадр не «съедает» замедление     // замедление и вспышки — только здесь, не в симуляции
  if (aiming && (paused || !desk)) { aiming = null; if (renderer) renderer.setAim(null); }     // меню открыто — прицел снят
  if (simK > 0) {
    const inp = paused ? {} : input.read();
    Object.assign(inp, rotateInput(inp.mx || 0, inp.mz || 0, cfg.view.camYaw));
    if (desk && renderer && inp.cursor) inp.aimPt = renderer.groundAt(inp.cursor.x, inp.cursor.y);     // прицел курсором: удар, выстрел и умения — в сторону мыши        // «вверх» на джойстике = вверх на экране при любом повороте камеры
    if (W.player.dead) inp.attack = inp.roll = false;
    if (desk) aimStep(inp);
    step(W, dt * simK * fk.scale, inp);
  }
  feelPeak.scale = Math.min(feelPeak.scale, fk.scale); feelPeak.flash = Math.max(feelPeak.flash, fk.flash.a); feelPeak.zoom = Math.max(feelPeak.zoom, fk.zoom);
  { const fa = fk.flash.a > .01, va = !paused && fk.vig > .01; if (feelFlash.hidden === fa) feelFlash.hidden = !fa; if (feelVig.hidden === va) feelVig.hidden = !va;     // скрытый слой не смешивается с кадром
    if (fa) { feelFlash.style.opacity = fk.flash.a.toFixed(3); feelFlash.style.background = fk.flash.c; } if (va) feelVig.style.opacity = fk.vig.toFixed(3); } if (fk.beat && !paused) sfx('heart');
  if (!fk.streak && !streakEl.hidden) streakEl.hidden = true;
  if (lvlCardT > 0 && (lvlCardT -= real) <= 0) lvlCard.hidden = true;
  if (renderer) { renderer.setZoom(fk.zoom); renderer.setCine(cineFocus()); }
  { const n = bagUsed(W.inv), m = bagSlots(W), s = n + '/' + m, cls = n >= m ? 'full' : n >= m * .8 ? 'warn' : ''; if (bagFill.textContent !== s) bagFill.textContent = s; if (bagFill.className !== cls) bagFill.className = cls; }     // заполненность сумки на кнопке
  const t1 = performance.now();
  if (renderer) renderer.render(W, dt);
  { const t2 = performance.now(); perfPush(perf.sim, t1 - t0); perfPush(perf.draw, t2 - t1); perf.max = Math.max(perf.max, t2 - t0); perf.n++; if (renderer) { const i = renderer.info(); perf.calls = i.calls; perf.tris = i.triangles; } }
  const hud = (hudT += real) >= cfg.cull.hud || paused !== hudP; if (hud) { hudT = 0; hudP = paused; }     // кнопки, статусы и умения — 10 раз в секунду (и сразу при открытии меню)
  if (hud) { const show = !!W.nearNpc && (storyTalkable(W, W.nearNpc) || !npcLocked(W.nearNpc)) && !panelOpen && !landscape;     // сюжетный разговор — даже у закрытого жителя
  if (talk.hidden === show) talk.hidden = !show; if (show) { const l = (storyTalkable(W, W.nearNpc) || W.nearActor ? 'Говорить: ' + (SPEAKERS[W.nearNpc] ? SPEAKERS[W.nearNpc].name.split(',')[0] : '') : W.nearNpc === 'smith' ? 'Кузнец' : W.nearNpc === 'captain' ? 'Наём' : W.nearNpc === 'scribe' ? 'Библиотека' : W.nearNpc === 'wanderer' ? 'Сказочный торговец' : W.shop.stock.some(s => s.fresh) ? 'Торговать · новинка' : 'Торговать') + (desk ? ' · E' : ''); if (talk.textContent !== l) talk.textContent = l; } }
  if (hud) { const f = fireNear(W), show = !!f && !W.nearPortal && !panelOpen && !landscape; if (fireBtn.hidden === show) fireBtn.hidden = !show; if (show) setIconText(fireBtn, 'fire', 'Костёр' + (desk ? ' · E' : ''));
    const free = !f && !W.nearPortal && !panelOpen && !landscape && !W.player.dead, cn = free && W.life && coachNear(W), nd = free && !cn && W.life && nodeNear(W);     // этап 6: повозка, сбор, конь
    if (coachBtn.hidden === !!cn) coachBtn.hidden = !cn; if (cn) { const l = 'Повозка' + (desk ? ' · E' : ''); if (coachBtn.textContent !== l) coachBtn.textContent = l; }
    lootUi(free);     // 4.21: окно и кнопка добычи
    if (gatherBtn.hidden === !!nd) gatherBtn.hidden = !nd; if (nd) { const l = 'Собрать: ' + cfg.life.gather.names[nd.kind] + (desk ? ' · E' : ''); if (gatherBtn.textContent !== l) gatherBtn.textContent = l; }
    const ms = !!(W.life && W.life.mount.owned) && W.lvl === 'surface' && !panelOpen && !landscape && !W.player.dead; if (mountBtn.hidden === ms) mountBtn.hidden = !ms; if (ms) { const l = (W.life.mount.on ? 'Спешиться' : 'Конь') + (desk ? ' · V' : ''); if (mountBtn.textContent !== l) mountBtn.textContent = l; } }
  if (hud) { const show = !sleepingUI && !panelOpen && !landscape && !!sleepSpot(W) && isNight(W.t, cfg.daynight); if (sleepBtn.hidden === show) sleepBtn.hidden = !show; if (show) setIconText(sleepBtn, 'sleep', 'Спать до утра' + (desk ? ' · B' : '')); }
  if (hud) { const q = W.nearPortal, show = !!q && !panelOpen && !landscape && !W.player.dead; if (portalBtn.hidden === show) portalBtn.hidden = !show; if (show) { const l = portalName(W, q) + (desk ? ' · E' : ''); if (portalBtn.textContent !== l) portalBtn.textContent = l; }
    const ecl = show && q.abyssEnter && W.lv >= cfg.abyss.lv, wk = weekOf(Date.now()), hshow = ecl || (show && !q.up && isInstance(W, q.to) && heroicOpen(W)); if (heroicBtn.hidden === hshow) heroicBtn.hidden = !hshow; if (hshow) { const l = (ecl ? `Затмение недели: ${eclipseMods(wk).map(modName).join(', ')}${eclipseDoneThisWeek(W, wk) ? ' · пройдено' : ''}` : 'Героическая: ' + W.levels[q.to].def.name) + (desk ? ' · H' : ''); if (heroicBtn.textContent !== l) heroicBtn.textContent = l; } }
  if (hud) { const hb = W.hudBoss, key = hb ? hb.name + Math.round(hb.frac * 200) + hb.enraged + hb.shield + (hb.cast ? hb.cast.name + Math.round(hb.cast.k * 50) : '') : ''; if (key !== lastBoss) { lastBoss = key; bossEl.hidden = !hb; if (hb) { bossName.textContent = hb.name + (hb.enraged ? ' · ярость' : '') + (hb.shield ? ' · щит' : ''); bossFill.style.transform = `scaleX(${Math.max(0, hb.frac)})`; bossEl.classList.toggle('enr', hb.enraged); bossEl.classList.toggle('shield', !!hb.shield);
    const bc = $('bossCast'); bc.hidden = !hb.cast; if (hb.cast) { bc.firstChild.style.transform = `scaleX(${Math.min(1, hb.cast.k)})`; bc.lastChild.textContent = `Читает «${hb.cast.name}» — собейте!`; } } } }     // этап 5: чтение и щит на полосе
  { const n = W.combo.n; if (n !== lastCombo) { comboEl.hidden = n < 2; if (n >= 2) { comboEl.innerHTML = `×${n}<small>+${Math.round(Math.min(.3, n * .02) * 100)}%</small>`; comboEl.classList.remove('pop'); void comboEl.offsetWidth; comboEl.classList.add('pop'); } lastCombo = n; } }
  if (hud) { const ab = W.abuf, buffs = [ab.iron > 0 && ['Несокрушимость', ab.iron, '#9fd0ff'], ab.rage > 0 && ['Ярость', ab.rage, '#ff6a4a']].filter(Boolean);     // статусы и баффы умений
    const key = Object.keys(W.pst).map(k => k + Math.ceil(W.pst[k].t) + (W.pst[k].n || '')).join() + buffs.map(b => b[0] + Math.ceil(b[1])).join();
    if (key !== lastSt) { lastSt = key; statusRow.textContent = ''; const chip = (txt, col) => { const c = document.createElement('span'); c.className = 'stch'; c.style.color = col; c.textContent = txt; statusRow.appendChild(c); };
      for (const k of Object.keys(W.pst)) chip(`${STATUS_NAME[k]}${W.pst[k].n > 1 ? ' ×' + W.pst[k].n : ''} ${Math.ceil(W.pst[k].t)}с`, STATUS_COLOR[k]);
      for (const b of buffs) chip(`${b[0]} ${Math.ceil(b[1])}с`, b[2]); } }
  if (hud) { const near = W.nearNpc, show = !!near && near !== 'wanderer' && !npcLocked(near) && !panelOpen && !landscape; if (questBtn.hidden === show) questBtn.hidden = !show; const mk = show ? questMark(W, near) || '' : ''; if (mk !== lastMark) { lastMark = mk; questBtn.classList.toggle('dot', !!mk); setIconText(questBtn, 'scroll', mk === 'ready' ? 'Сдать задание' : mk ? 'Есть задания!' : 'Задания'); } }
  if (hud) { drawAbil(); showZone(); drawParty(); if (W.story && !SHOT && storyAutoPending(W) && !panelOpen && $('heroPick').hidden && $('dead').hidden) { W.story.autoShown = true; dlgOpen(storyTalk(W, null)); } }     // пролог начинается сам
  { const sr = sparkTick(W); if (sr === 'step') sfx('questready'); else if (sr === 'done') { toast(`Первая искра зажжена: +${cfg.spark.ash} пепла`, '', '#e8c04a', 'fire'); sfx('questdone'); saver.write(); } }
  // строка цели не бывает пустой (шаг 12): событие → «Первая искра» → взятое задание → ближайший неоткрытый костёр
  if ((goalT -= real) <= 0) { goalT = .25;
    { const pr = pathTick(W); if (pr && pr.k === 'step') { toast(`Путь пепла ${pr.i + 1}/${PATH.length - 1}: ${pr.text}`, '', '#e8c04a', 'fire'); sfx('questready'); saver.write(); } else if (pr && pr.k === 'end') { saver.write(); showEnd(); } }
    applyLocks();
    { const mr = mentorTick(W); if (mr && mr.k === 'start') { const who = MENTOR_WHO[mr.L.who]; for (const l of mr.L.lines) toast(`${who.name.split(',')[0]}: «${l}»`, '', '#f0d8a8', 'hint'); sfx('questready'); } else if (mr && mr.k === 'done') { toast(`Совет выполнен: +${mr.ash} пепла`, '', '#e8c04a', 'hint'); sfx('questdone'); saver.write(); } }
    const sp = W.spark && !W.spark.done, pg = pathGoal(W), crypt = pg && PATH[pathIndex(W)].id === 'crypt';
    const sg = !sp && W.story ? storyGoal(W) : null;     // сюжет (этап 3) — главнее «Пути пепла»
    const g = W.lvl === 'surface' ? (sp ? goalOf(W) : sg || pg || goalOf(W)) : crypt && W.lvl === 'crypt_pogost' ? { text: pg.text, at: null } : String(W.lvl).startsWith('up:') ? { text: 'Второй этаж: сундуки; вниз — по лестнице', at: null } : { text: 'Подземелье: сундуки, ключи и выход наверх', at: null };
    // трекер (этап 5 «круче»): главная строка (событие, искра, сюжет, путь) и до трёх заданий; цель на карте не пропадает
    const surf = W.lvl === 'surface', ev = eventLine(W) || abyssLine(W), main = ev || (sp || sg || pg || !surf ? g.text : ''), ql = trackerLines(W, 3);
    W.qmarks = surf ? questMarks(W, storyActors(W)) : [];
    const mt = surf ? mentorLine(W) : null, tl = [main || (ql.length || mt ? '' : g.text), mt && mt.text, ...ql].filter(Boolean).join('\n');     // совет — второй строкой
    const fm = W.questFocus && W.qmarks.find(m => m.id === W.questFocus);     // выбранное задание (кнопка «Вести» в «Моих») — главнее
    W.goal = ev && W.event ? eventAt(W) : ev ? null : fm ? fm : main ? (g.at || W.qmarks[0] || null) : W.qmarks.length ? W.qmarks[0] : mt && mt.at ? mt.at : g.at; W.goalFocus = !!fm && !ev;     // метки на земле — только к выбранному заданию
    if (tl !== lastTrack) { lastTrack = tl; trackerEl.textContent = tl; trackerEl.hidden = !tl; } }
  if ((fpsT += real, ++fpsN, fpsT) > .5) { const f = Math.round(fpsN / fpsT); fpsN = 0; fpsT = 0; if (P.fps) { const q = a => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length * .95)] || 0; }; $('fps').textContent = `${f} кадр/с · ${(q(perf.sim) + q(perf.draw)).toFixed(1)} мс · ${perf.calls} выз · ${Math.round(perf.tris / 1000)} тыс △`; } }
  if (!panelOpen && !W.player.dead && (hintT -= real) <= 0) { hintT = 7; const h = nextHint(W, P); if (h) { P.seen[h.id] = true; savePrefs(P); toast((desk && h.desk) || h.text, 'hint', undefined, 'hint'); } }
  if ((ambT += real) > .5) { ambT = 0; setAmbient(W.light, W.place && W.place.danger ? W.place.danger / 3 : 0); }
  if ((atmoT += real) > .2) { atmoT = 0; const mx = mixOf(W, cfg.audio, renderer ? { wind: renderer.wind().s, trees: renderer.treesNear(W.player.x, W.player.z), rain: renderer.weather().rain } : null); setScene(mx, cfg.audio); tickAudio(); tracks.tick(mx, ownActive || isMuted(), performance.now() / 1000, cfg.audio.musicVol * uvol.all * uvol.music); if (ownPlayer.playing()) ownPlayer.setVolume(cfg.audio.ownMusic * uvol.all * uvol.music * (mx.fight > 0 ? .45 : 1) * (W.player.dead ? .3 : 1)); }     // своя музыка: в бою тише     // атмосфера: река, птицы, музыка
  if (!panelOpen && !W.player.dead && W.player.state === 'run' && (stepT += real) > .32) { stepT = 0; sfx('step'); }
  if (!panelOpen && (miniT += real) > .12) { miniT = 0; drawMini(); }
  if (!reliefDone) reliefDone = tickRelief(document, W);
  if (autoRes && renderer && !panelOpen && !document.hidden && !P.retro && !P.ascii) { const cur = renderer.quality().resScale, nx = autoRes.frame(real, cur); if (nx !== cur) renderer.setResScale(nx); }     // «Авто»: разрешение по кадрам     // подложка карты с рельефом — по 2 мс за кадр, пока не готова (шаг 10б)
  if ((saveT += real) > 8) { saveT = 0; saver.write(); }
  const hp = Math.ceil(W.player.hp) + W.player.maxhp * 1000;
  if (hp !== lastHp) { lastHp = hp; const k = `scaleX(${Math.max(0, W.player.hp / W.player.maxhp)})`; hpFill.style.transform = k; hpGhost.style.transform = k; hpTxt.textContent = Math.ceil(W.player.hp); }     // след потерянного здоровья догоняет с задержкой (шаг 5)
  { const key = W.kills + ':' + W.inv.ash + ':' + W.lv + ':' + W.xp + ':' + W.sp + ':' + W.ap + ':' + clockText(W.t, cfg.daynight) + W.night; if (key !== lastKey) { lastKey = key; hudLv.textContent = `Ур. ${W.lv}${W.ng ? ` · круг ${W.ng + 1}` : ''}`; setIconText(hudAsh, 'ash', String(W.inv.ash)); hudAsh.title = 'Пепел'; timeDial(W); xpFill.style.transform = `scaleX(${W.lv >= cfg.level.max ? 1 : W.xp / xpNeed(W.lv, cfg)})`; skillBtn.classList.toggle('dot', W.sp > 0 || W.ap > 0); } }     // верх HUD — капсулы (шаг 9)
  if (W.player.dead && W.player.deadT > .9 && $('dead').hidden) $('dead').hidden = false;
}
requestAnimationFrame(loop);

window.__b3d = { reliefDone: () => reliefDone, openWin: n => ({ journal, smith, captain, shop, quests }[n] || { open() {} }).open(), emit: v => onEvent(v), feelPeak: () => { const r = { ...feelPeak, now: lastFk }; feelPeak = { scale: 1, flash: 0, zoom: 0 }; return r; }, storyActors: () => storyActors(W), perf: () => { const q = (a, k) => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(b.length * k))] || 0; }, tot = perf.sim.map((v, i) => v + perf.draw[i]); return { n: perf.n, p50: q(tot, .5), p95: q(tot, .95), max: perf.max, sim95: q(perf.sim, .95), draw95: q(perf.draw, .95), calls: perf.calls, tris: perf.tris }; }, perfReset: () => { perf.sim.length = perf.draw.length = 0; perf.max = 0; }, openFires, fastTravel: id => fastTravel(W, id), ui: () => ({ panelOpen, landscape, desk }), life: () => renderer && renderer.life(), usePortal: () => usePortal(W), travel: (id, x, z) => travel(W, id, x, z), journal, quests, spawnBoss: type => spawnBoss(W, cfg.bosses.list.find(d => d.type === type)), captain, reveal: (x, z, r) => reveal(W, x, z, r), mapOpen, mapClose, mapView: () => ({ ...mv }), mapZoom, skills, spawn: (t, x, z) => spawnEnemy(W, t, x, z), bag, shop, smith, saver, W, cfg, renderer, input, step, respawnPlayer, audioStats };
if (BENCH) setTimeout(() => runBench(W, cfg, input, renderer), 1500);
