// Окно заданий: вкладка «Здесь» (что даёт ближайший NPC) и «Мои» (все взятые). Логика в quests3d.js.
import { QUESTS, GIVER_NAME } from './data/quests3d.js';
import { BY_ID } from './data/items.js';
import { questState, acceptQuest, claimQuest, abandonQuest, progressOf, questsOf, activeCount, MAX_ACTIVE } from './quests3d.js';

export function createQuests(doc, W, cfg, { onOpen, onClose, onChange } = {}) {
  const $ = id => doc.getElementById(id);
  const root = $('quests'), listEl = $('questList'), tabsEl = $('questTabs'), headEl = $('questHead'), flashEl = $('questFlash');
  let tab = 'here', flashT = 0, armed = '';
  const el = (tag, cls, txt) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const flash = t => { flashEl.textContent = t; clearTimeout(flashT); flashT = setTimeout(() => { flashEl.textContent = ''; }, 2600); };
  for (const [id, label] of [['here', 'Здесь'], ['mine', 'Мои']]) { const b = el('button', 'tab', label); b.type = 'button'; b.dataset.tab = id; b.addEventListener('click', () => { tab = id; render(); }); tabsEl.appendChild(b); }
  const rewardText = q => [q.reward.ash ? `${q.reward.ash} пепла` : '', q.reward.xp ? `${q.reward.xp} опыта` : '', ...(q.reward.items || []).map(([id, n]) => BY_ID[id].name + (n > 1 ? ' ×' + n : ''))].filter(Boolean).join(', ');
  const goalText = q => ({
    kill: () => `Убить: ${cfg.enemies[q.enemy].name} ×${q.n}`,
    boss: () => `Победить: ${cfg.enemies[q.boss].name}`,
    visit: () => `Дойти: ${(cfg.map.places.find(p => p.id === q.place) || {}).name}`,
    bring: () => `Принести: ${BY_ID[q.item].name} ×${q.n}`,
    craft: () => `Выковать: ${BY_ID[q.item].name}`,
    tome: () => 'Прочитать книгу',
    open: () => `Вскрыть контейнеров: ${q.n}`,
    hire: () => 'Нанять бойца',
    hunt: () => `Охота: ${q.beast} (${cfg.enemies[q.enemy].name}) — место на карте`,     // этап 5 «круче»
    track: () => `Выследить: ${q.beast} — следов ${q.n}, потом логово`,
    defend: () => `Оборона: ${q.waves.length} волны — место на карте`
  }[q.type])() + (q.limit ? ` · срок ${Math.round(q.limit / 60)} мин` : '');
  function card(q, s) {
    const r = el('div', 'srow qrow ' + s), info = el('div', 'sinfo'), p = progressOf(W, q);
    const nm = el('span', 'nm', q.name); if (s === 'ready') nm.style.color = '#a8e0a0';
    info.append(nm, el('div', 'sub', q.text), el('div', 'sub', goalText(q) + (p && p[1] > 1 ? ` · ${p[0]}/${p[1]}` : '')), el('div', 'sub g', 'Награда: ' + rewardText(q)));
    if (q.minLv && W.lv < q.minLv) info.append(el('div', 'sub z', `Рекомендуется уровень ${q.minLv}`));
    r.append(info);
    const near = W.nearNpc === q.giver;
    let b = null;
    if (s === 'available') { b = el('button', 'buy' + (near ? '' : ' no'), 'Взять'); b.addEventListener('click', () => { const res = acceptQuest(W, q.id); flash(res === 'ok' ? 'Задание взято' : res === 'full' ? `Не больше ${MAX_ACTIVE} заданий` : 'Подойдите к тому, кто выдаёт'); render(); onChange && onChange(); }); }
    else if (s === 'ready') { b = el('button', 'buy' + (near ? '' : ' no'), 'Сдать'); b.addEventListener('click', () => { const res = claimQuest(W, q.id); flash(res === 'ok' ? 'Награда получена' : 'Сдавать нужно: ' + GIVER_NAME[q.giver]); render(); onChange && onChange(); }); }
    else if (s === 'active') { b = el('button', 'buy', armed === q.id ? 'Точно?' : 'Бросить'); b.addEventListener('click', () => { if (armed !== q.id) { armed = q.id; setTimeout(() => { armed = ''; render(); }, 2500); render(); return; } armed = ''; abandonQuest(W, q.id); render(); onChange && onChange(); }); }
    else r.append(el('span', 'sub' + (s === 'done' ? ' g' : ''), { cooldown: 'Позже', done: 'Выполнено' }[s] || ''));
    if (b) { b.type = 'button'; r.append(b); }
    return r;
  }
  function render() {
    for (const b of tabsEl.children) b.classList.toggle('on', b.dataset.tab === tab);
    headEl.textContent = `Задания · взято ${activeCount(W)}/${MAX_ACTIVE}`;
    listEl.textContent = '';
    if (tab === 'here') {
      const g = W.nearNpc;
      if (!g) { listEl.appendChild(el('div', 'emptyl', 'Подойдите к торговцу, кузнецу или капитану. У каждого свои поручения.')); return; }
      listEl.appendChild(el('div', 'ssec', GIVER_NAME[g]));
      const order = { ready: 0, available: 1, active: 2, cooldown: 3, done: 4 };
      const items = questsOf(W, g).map(q => [q, questState(W, q)]).filter(([, s]) => s !== 'locked').sort((a, b) => order[a[1]] - order[b[1]]);
      for (const [q, s] of items) listEl.appendChild(card(q, s));
      if (!items.length) listEl.appendChild(el('div', 'emptyl', 'Пока нечего поручить. Загляните позже.'));
    } else {
      const act = QUESTS.map(q => [q, questState(W, q)]).filter(([, s]) => s === 'active' || s === 'ready');
      if (!act.length) listEl.appendChild(el('div', 'emptyl', 'Нет взятых заданий.'));
      for (const [q, s] of act) { listEl.appendChild(el('div', 'ssec', GIVER_NAME[q.giver])); listEl.appendChild(card(q, s)); }
    }
  }
  const open = t => { tab = t || (W.nearNpc ? 'here' : 'mine'); render(); root.hidden = false; onOpen && onOpen(); };
  const close = () => { root.hidden = true; onClose && onClose(); };
  $('questClose').addEventListener('click', close);
  return { open, close, render, isOpen: () => !root.hidden };
}
