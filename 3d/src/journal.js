// Журнал знаний (он же книга рецептов, клавиша R): рецепты с нехваткой материалов, сплавы стихий, камни силы, источники вещей —
// открыты с начала; бестиарий и атлас — после первого босса («Путь пепла»). Материал в рецепте — кнопка «где взять».
import { BY_ID, RARITY } from './data/items.js';
import { TOMES, TOME_BY_ID } from './data/tomes3d.js';
import { RECIPES } from './data/recipes3d.js';
import { CONTAINERS } from './data/loot.js';
import { sourcesOf, bestiaryEntry, POOL_NAME, recipeKnown, missing } from './craft3d.js';
import { ELEMENTS, ELEMENT_NAME, ELEMENT_COLOR, MIX_NAME, MIX_TEXT, mixKey } from './elements3d.js';
import { gemSources, gemId } from './stones3d.js';
import { unlocks } from './ashpath3d.js';
import { combosOf } from './combos3d.js';
import { heroAbilities } from './abilities3d.js';

const TYPES = ['imp', 'brute', 'hound', 'ghoul', 'archer', 'witch', 'devourer', 'lord', 'chief'];
export function createJournal(doc, W, cfg, { onOpen, onClose } = {}) {
  const $ = id => doc.getElementById(id);
  const root = $('journal'), listEl = $('journalList'), tabsEl = $('journalTabs');
  let tab = 'recipes', sel = null, filter = 'all', mixSel = 'water+storm';
  const el = (tag, cls, txt) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const row = (cls, html) => { const r = el('div', 'jrow ' + (cls || '')); r.innerHTML = html; return r; };
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const TABS = [['recipes', 'Рецепты'], ['mixes', 'Сплавы'], ['stones', 'Камни'], ['combos', 'Связки'], ['sources', 'Источники'], ['bestiary', 'Бестиарий'], ['atlas', 'Атлас']], LOCKED = ['bestiary', 'atlas'];
  for (const [id, label] of TABS) { const b = el('button', 'tab', label); b.type = 'button'; b.dataset.tab = id; b.addEventListener('click', () => { tab = id; sel = null; render(); }); tabsEl.appendChild(b); }
  const K = () => W.known;
  const kindName = k => (K().kinds[k] ? CONTAINERS[k].name : '???');
  const enemyName = t => bestiaryEntry(t, cfg).name;     // в источниках имена видны сразу: понятно, на кого идти

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
  // материал — кнопка: «где взять» (вкладка «Источники»)
  const matBtn = (id, txt, okk) => { const b = el('button', 'mat ' + (okk ? 'have' : 'lack'), txt); b.type = 'button'; b.dataset.item = id; b.title = 'Где взять (G)'; b.addEventListener('click', () => { tab = 'sources'; sel = id; render(); }); return b; };
  function recipes() {
    const L = unlocks(W), known = RECIPES.filter(r => recipeKnown(K(), r));
    listEl.appendChild(row('', `<b>Известно рецептов: ${known.length} из ${RECIPES.length}</b><div class="sub">Куётся у кузнеца, вкладка «Ковка». Нажмите на материал — увидите, где его взять.${L.smith ? '' : ' Кузнец раздует горн, когда падёт Пожиратель Погоста.'}</div>`));
    const need = r => missing(W, r).reduce((a, [, n, have]) => a + Math.max(0, n - have), 0) + (W.inv.ash >= r.ash ? 0 : 1);
    for (const r of known.slice().sort((a, b) => need(a) - need(b))) {
      const it = BY_ID[r.result.id], ready = need(r) === 0, card = row(ready ? 'ready' : '', `<b style="color:${RARITY[it.rar].color}">${esc(it.name)}${r.result.n > 1 ? ' ×' + r.result.n : ''}</b> <span class="${ready ? 'g' : 'z'}">${ready ? 'можно ковать' : 'не хватает'}</span>`);
      const m = el('div', 'mats'); for (const [id, n, have] of missing(W, r)) m.append(matBtn(id, `${BY_ID[id].name} ${Math.min(have, n)}/${n}`, have >= n)); m.append(el('span', W.inv.ash >= r.ash ? 'have' : 'lack', `пепел ${r.ash}`)); card.append(m);
      listEl.appendChild(card);
    }
    const locked = TOMES.filter(t => !K().tomes[t.id] && RECIPES.some(r => r.needs === t.id));
    if (locked.length) listEl.appendChild(row('', '<b>Закрытые рецепты</b><div class="sub">Их открывают книги. Слухи о том, где искать:</div>'));
    for (const t of locked) listEl.appendChild(row('dim', `<b>«${esc(t.name)}»</b> · ${RECIPES.filter(r => r.needs === t.id).length} рец.<div class="sub">${esc(t.hint)}</div>`));
  }
  // сплавы стихий: матрица 7×7 и карточка выбранной пары
  function mixes() {
    listEl.appendChild(row('', '<b>Сплавы стихий</b><div class="sub">Две стихии в оружии сплавляются: стихия вещи и камень, или два камня. Та же смесь случается на враге, если вторая стихия ложится поверх первой. Камни вставляет кузнец, вкладка «Камни».</div>'));
    const [a, b] = mixSel.split('+'), card = row('mixcard', `<b>${esc(MIX_NAME[mixSel])}</b> <span class="sub">${esc(ELEMENT_NAME[a])}${a === b ? ' ×2' : ' + ' + esc(ELEMENT_NAME[b])}</span><div class="sub">${esc(MIX_TEXT[mixSel])}</div>`);
    card.style.setProperty('--ca', ELEMENT_COLOR[a]); card.style.setProperty('--cb', ELEMENT_COLOR[b]); listEl.appendChild(card);
    const wrap = el('div', 'mixwrap'), t = el('table', 'mixt'); t.setAttribute('aria-label', 'Таблица сплавов');
    const hr = el('tr'); hr.append(el('th')); for (const c of ELEMENTS) { const th = el('th', '', ELEMENT_NAME[c]); th.style.color = ELEMENT_COLOR[c]; hr.append(th); } t.append(hr);
    for (const r of ELEMENTS) { const tr = el('tr'), th = el('th', '', ELEMENT_NAME[r]); th.style.color = ELEMENT_COLOR[r]; tr.append(th);
      for (const c of ELEMENTS) { const k = mixKey(r, c), td = el('td'), bt = el('button', 'mixc' + (k === mixSel ? ' on' : ''), MIX_NAME[k]); bt.type = 'button'; bt.style.setProperty('--ca', ELEMENT_COLOR[r]); bt.style.setProperty('--cb', ELEMENT_COLOR[c]); bt.setAttribute('aria-pressed', String(k === mixSel)); bt.addEventListener('click', () => { mixSel = k; render(); }); td.append(bt); tr.append(td); }
      t.append(tr); }
    wrap.append(t); listEl.appendChild(wrap);
  }
  // связки умений героя: А → Б не позже window с
  function combos() {
    const cl = combosOf(W.hero), L = heroAbilities(W), nm = id => (L.find(a => a.id === id) || { name: id }).name;
    listEl.appendChild(row('', `<b>Связки умений</b><div class="sub">Умение, потом второе не позже ${cfg.combos.window} с — второе срабатывает сильнее. Пока окно открыто, кнопка второго подсвечена. Умения изучаются в окне «Навыки».</div>`));
    for (const c of cl) { const k = (W.ab[c.a] || 0) > 0 && (W.ab[c.b] || 0) > 0; listEl.appendChild(row(k ? 'ready' : 'dim', `<b style="color:#ffd27a">${esc(c.name)}</b> <span class="${k ? 'g' : 'z'}">${k ? 'доступна' : 'нужны оба умения'}</span><div class="sub">${esc(nm(c.a))} → ${esc(nm(c.b))}: ${esc(c.text)}</div>`)); }
  }
  // камни силы: с каких врагов, ранги, гнёзда
  function stones() {
    const S = cfg.stones;
    listEl.appendChild(row('', `<b>Камни силы</b><div class="sub">Осколок, камень, сердце — сила ×${S.power.join(' / ×')}. Три одинаковых кузнец сплавит в ранг выше. Гнёзда: одно у редкого и великого оружия, два у клеймёного и золотого. Вынуть камень у кузнеца можно за пепел.</div>`));
    for (const e of ELEMENTS) {
      const card = row('gemsrc', `<b style="color:${ELEMENT_COLOR[e]}">${esc(ELEMENT_NAME[e])}</b>`);
      for (const r of [1, 2, 3]) { const id = gemId(e, r), have = W.inv.bag.filter(s => s.id === id).reduce((a, s) => a + s.n, 0); const d = el('div', 'sub'); d.append(matBtn(id, `${BY_ID[id].name}${have ? ' · в сумке ' + have : ''}`, have > 0), document.createTextNode(' ' + gemSources(cfg, id).join('; '))); card.append(d); }
      listEl.appendChild(card);
    }
  }
  function sources() {
    const FILTERS = [['all', 'Всё'], ['material', 'Материалы'], ['weapon', 'Оружие'], ['armor', 'Броня'], ['tome', 'Книги']];
    const bar = el('div', 'tabs'); bar.style.display = 'flex'; bar.style.gap = '6px'; bar.style.overflowX = 'auto';
    for (const [id, label] of FILTERS) { const b = el('button', 'tab' + (filter === id ? ' on' : ''), label); b.type = 'button'; b.addEventListener('click', () => { filter = id; sel = null; render(); }); bar.appendChild(b); }
    listEl.appendChild(bar);
    const ids = Object.keys(K().items).filter(id => BY_ID[id] && (filter === 'all' || BY_ID[id].cat === filter || (filter === 'weapon' && BY_ID[id].slot === 'weapon') || (filter === 'armor' && BY_ID[id].slot && BY_ID[id].slot !== 'weapon'))).sort((a, b) => BY_ID[b].rar - BY_ID[a].rar || BY_ID[a].name.localeCompare(BY_ID[b].name, 'ru'));
    if (!ids.length && !(sel && BY_ID[sel])) { listEl.appendChild(el('div', 'emptyl', 'Здесь появятся предметы, которые вы уже находили, с подсказками, где их искать.')); return; }
    if (sel && BY_ID[sel]) {
      const it = BY_ID[sel], s = sourcesOf(sel), lines = it.cat === 'gem' ? gemSources(cfg, sel) : [];
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
    const lock = !unlocks(W).journal; if (lock && LOCKED.includes(tab)) tab = 'recipes';
    for (const b of tabsEl.children) { b.classList.toggle('on', b.dataset.tab === tab); b.hidden = lock && LOCKED.includes(b.dataset.tab); }
    listEl.textContent = '';
    ({ bestiary, atlas, recipes, mixes, stones, combos, sources })[tab]();
  }
  // open(вкладка, вещь): книга на нужной вкладке; вещь — сразу карточка «где взять»
  const open = (t, item) => { if (t) tab = t; if (item !== undefined) sel = item; else if (t) sel = null; render(); root.hidden = false; onOpen && onOpen(); };
  const close = () => { root.hidden = true; onClose && onClose(); };
  $('journalClose').addEventListener('click', close);
  return { open, close, render, isOpen: () => !root.hidden };
}
