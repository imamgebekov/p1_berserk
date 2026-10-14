// Журнал знаний: бестиарий, атлас, рецепты и источники предметов. Показывает только то, что игрок уже узнал.
import { BY_ID, RARITY } from './data/items.js';
import { TOMES, TOME_BY_ID } from './data/tomes3d.js';
import { RECIPES } from './data/recipes3d.js';
import { CONTAINERS } from './data/loot.js';
import { sourcesOf, bestiaryEntry, POOL_NAME, recipeKnown } from './craft3d.js';

const TYPES = ['imp', 'brute', 'hound', 'ghoul', 'archer', 'witch', 'devourer', 'lord', 'chief'];
export function createJournal(doc, W, cfg, { onOpen, onClose } = {}) {
  const $ = id => doc.getElementById(id);
  const root = $('journal'), listEl = $('journalList'), tabsEl = $('journalTabs');
  let tab = 'bestiary', sel = null, filter = 'all';
  const el = (tag, cls, txt) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const row = (cls, html) => { const r = el('div', 'jrow ' + (cls || '')); r.innerHTML = html; return r; };
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  for (const [id, label] of [['bestiary', 'Бестиарий'], ['atlas', 'Атлас'], ['recipes', 'Рецепты'], ['sources', 'Источники']]) { const b = el('button', 'tab', label); b.type = 'button'; b.dataset.tab = id; b.addEventListener('click', () => { tab = id; sel = null; render(); }); tabsEl.appendChild(b); }
  const K = () => W.known;
  const kindName = k => (K().kinds[k] ? CONTAINERS[k].name : '???');
  const enemyName = t => (K().bestiary[t] ? bestiaryEntry(t, cfg).name : '???');

  function bestiary() {
    for (const t of TYPES) {
      const lv = K().bestiary[t] || 0;
      if (!lv) { listEl.appendChild(row('dim', '<b>???</b><div class="sub">Неизвестный враг. Победите его или найдите книгу.</div>')); continue; }
      const b = bestiaryEntry(t, cfg);
      let h = `<b>${esc(b.name)}</b>${b.boss ? ' <span class="z">босс</span>' : ''}<div class="sub">Где: ${esc(b.where.join(', '))}</div>`;
      if (lv >= 2) {
        h += `<div class="sub">Здоровье ${b.hp} · урон ${b.dmg} · скорость ${b.speed}${b.on ? ' · наносит: ' + b.on : ''}</div>`;
        if (b.immune.length) h += `<div class="sub z">Не поддаётся: ${esc(b.immune.join(', '))}</div>`;
        h += `<div class="sub">Добыча: ${esc(b.loot.join(', '))}. Опыт: ${b.xp}.</div>`;
      } else h += '<div class="sub">Остальное скрыто. Нужна книга знаний.</div>';
      listEl.appendChild(row('', h));
    }
  }
  function atlas() {
    listEl.appendChild(row('', '<b>Места</b>'));
    for (const p of cfg.map.places) {
      if (!K().places[p.id]) { listEl.appendChild(row('dim', '<b>???</b><div class="sub">Неизвестное место.</div>')); continue; }
      const npcs = W.map.buildings.filter(b => b.npc && Math.hypot(b.x - p.x, b.z - p.z) < p.r).map(b => ({ merchant: 'торговец', smith: 'кузнец', captain: 'капитан' }[b.npc.kind]));
      const bosses = cfg.bosses.list.filter(b => Math.hypot(b.x - p.x, b.z - p.z) < p.r).map(b => cfg.enemies[b.type].name);
      listEl.appendChild(row('', `<b>${esc(p.name)}</b> <span class="${p.safe ? 'g' : 'z'}">${p.safe ? 'безопасно' : 'опасность ' + p.danger + '/3'}</span>${npcs.length ? `<div class="sub">Здесь: ${esc(npcs.join(', '))}</div>` : ''}${bosses.length && K().bestiary[cfg.bosses.list.find(b => cfg.enemies[b.type].name === bosses[0]).type] ? `<div class="sub z">Логово: ${esc(bosses.join(', '))}</div>` : ''}`));
    }
    listEl.appendChild(row('', '<b>Контейнеры</b>'));
    for (const [k, d] of Object.entries(CONTAINERS)) {
      if (!K().kinds[k]) { listEl.appendChild(row('dim', '<b>???</b>')); continue; }
      const what = [...new Set(d.pools.filter(p => p[1] > 0 && POOL_NAME[p[0]]).map(p => POOL_NAME[p[0]]))];
      listEl.appendChild(row('', `<b>${esc(d.name)}</b>${d.locked ? ' <span class="k">нужен ключ</span>' : ''}<div class="sub">Внутри бывает: ${esc(what.join(', '))}</div>`));
    }
  }
  function recipes() {
    const known = RECIPES.filter(r => recipeKnown(K(), r));
    listEl.appendChild(row('', `<b>Известно рецептов: ${known.length} из ${RECIPES.length}</b>`));
    for (const r of known) { const it = BY_ID[r.result.id]; listEl.appendChild(row('', `<b style="color:${RARITY[it.rar].color}">${esc(it.name)}</b><div class="sub">${esc(r.mats.map(([m, n]) => BY_ID[m].name + ' ×' + n).join(', '))}; пепел ${r.ash}</div>`)); }
    const locked = TOMES.filter(t => !K().tomes[t.id] && RECIPES.some(r => r.needs === t.id));
    if (locked.length) listEl.appendChild(row('', '<b>Закрытые рецепты</b><div class="sub">Их открывают книги. Слухи о том, где искать:</div>'));
    for (const t of locked) listEl.appendChild(row('dim', `<b>«${esc(t.name)}»</b> · ${RECIPES.filter(r => r.needs === t.id).length} рец.<div class="sub">${esc(t.hint)}</div>`));
  }
  function sources() {
    const FILTERS = [['all', 'Всё'], ['material', 'Материалы'], ['weapon', 'Оружие'], ['armor', 'Броня'], ['tome', 'Книги']];
    const bar = el('div', 'tabs'); bar.style.display = 'flex'; bar.style.gap = '6px'; bar.style.overflowX = 'auto';
    for (const [id, label] of FILTERS) { const b = el('button', 'tab' + (filter === id ? ' on' : ''), label); b.type = 'button'; b.addEventListener('click', () => { filter = id; sel = null; render(); }); bar.appendChild(b); }
    listEl.appendChild(bar);
    const ids = Object.keys(K().items).filter(id => BY_ID[id] && (filter === 'all' || BY_ID[id].cat === filter || (filter === 'weapon' && BY_ID[id].slot === 'weapon') || (filter === 'armor' && BY_ID[id].slot && BY_ID[id].slot !== 'weapon'))).sort((a, b) => BY_ID[b].rar - BY_ID[a].rar || BY_ID[a].name.localeCompare(BY_ID[b].name, 'ru'));
    if (!ids.length) { listEl.appendChild(el('div', 'emptyl', 'Здесь появятся предметы, которые вы уже находили, с подсказками, где их искать.')); return; }
    if (sel && K().items[sel]) {
      const it = BY_ID[sel], s = sourcesOf(sel), lines = [];
      if (s.containers.length) lines.push('Контейнеры: ' + s.containers.map(kindName).join(', '));
      if (s.drops.length) lines.push('С врагов: ' + s.drops.map(enemyName).join(', '));
      if (s.bosses.length) lines.push('С боссов: ' + s.bosses.map(enemyName).join(', '));
      if (s.shop) lines.push('Продаётся у торговца');
      if (s.craft.length) lines.push('Куётся: ' + s.craft.map(id => RECIPES.find(r => r.id === id)).map(r => (recipeKnown(K(), r) ? 'рецепт известен' : 'нужна книга «' + TOME_BY_ID[r.needs].name + '»')).join('; '));
      if (s.uses.length) lines.push('Идёт в крафт: ' + [...new Set(s.uses.map(id => BY_ID[RECIPES.find(r => r.id === id).result.id].name))].slice(0, 6).join(', ') + (s.uses.length > 6 ? ' и ещё' : ''));
      if (!lines.length) lines.push('Источник неизвестен');
      const card = row('', `<b style="color:${RARITY[it.rar].color}">${esc(it.name)}</b>${lines.map(l => `<div class="sub">${esc(l)}</div>`).join('')}`);
      const back = el('button', 'junk', 'К списку'); back.type = 'button'; back.addEventListener('click', () => { sel = null; render(); });
      listEl.append(card, back); return;
    }
    for (const id of ids.slice(0, 120)) { const it = BY_ID[id]; const b = el('button', 'jrow'); b.type = 'button'; b.innerHTML = `<b style="color:${RARITY[it.rar].color}">${esc(it.name)}</b><div class="sub">${esc(it.cat === 'tome' ? 'книга' : it.slot ? 'снаряжение' : it.cat === 'material' ? 'материал' : it.cat)}</div>`; b.addEventListener('click', () => { sel = id; render(); }); listEl.appendChild(b); }
  }
  function render() {
    for (const b of tabsEl.children) b.classList.toggle('on', b.dataset.tab === tab);
    listEl.textContent = '';
    ({ bestiary, atlas, recipes, sources })[tab]();
  }
  const open = () => { render(); root.hidden = false; onOpen && onOpen(); };
  const close = () => { root.hidden = true; onClose && onClose(); };
  $('journalClose').addEventListener('click', close);
  return { open, close, render, isOpen: () => !root.hidden };
}
