// Окно заданий: вкладка «Здесь» (что даёт ближайший NPC) и «Мои» (все взятые). Логика в quests3d.js.
import { QUESTS, GIVER_NAME } from './data/quests3d.js';
import { BY_ID } from './data/items.js';
import { questState, acceptQuest, claimQuest, abandonQuest, progressOf, questsOf, activeCount, MAX_ACTIVE } from './quests3d.js';
import { GI } from './data/gicons.js';

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
  // карточка задания (2026-10-20, просьба владельца: проще и нагляднее): значок вида, имя, строка описания, цель с полосой, награда фишками
  const TYPE_IC = { kill: 'map:fight', boss: 'map:boss', visit: 'ui:map', bring: 'ui:bag', craft: 'ui:anvil', tome: 'ui:book', open: 'map:chest', hire: 'map:fight', hunt: 'ui:eye', track: 'ui:eye', defend: 'ui:bell' };
  const gi = (k, cls) => { const sv = doc.createElementNS('http://www.w3.org/2000/svg', 'svg'); sv.setAttribute('viewBox', '0 0 512 512'); sv.setAttribute('class', cls); if (GI[k]) { const pa = doc.createElementNS('http://www.w3.org/2000/svg', 'path'); pa.setAttribute('d', GI[k]); pa.setAttribute('fill', 'currentColor'); sv.appendChild(pa); } return sv; };
  const chip = (txt, cls, ic) => { const c = el('span', 'qchip ' + (cls || '')); if (ic) c.appendChild(gi(ic, 'qci')); c.append(txt); return c; };
  function card(q, s) {
    const r = el('div', 'qcard ' + s), p = progressOf(W, q), main = el('div', 'qmain');
    const ic = el('div', 'qic'); ic.appendChild(gi(TYPE_IC[q.type] || 'ui:scroll', 'qsvg')); r.append(ic);
    const head = el('div', 'qhead'); head.append(el('span', 'qname', q.name)); if (s === 'ready') head.append(chip('Готово — сдать', 'ok')); if (q.minLv && W.lv < q.minLv) head.append(chip(`ур. ${q.minLv}+`, 'warn'));
    const goal = el('div', 'qgoal'); goal.append(el('span', 'qgt', goalText(q)));
    if (p && p[1] > 1) { const bar = el('span', 'qbar'), fill = el('i'); fill.style.width = Math.round(Math.min(1, p[0] / p[1]) * 100) + '%'; bar.append(fill); goal.append(bar, el('span', 'qpn', `${p[0]}/${p[1]}`)); }
    const rw = el('div', 'qrew'); if (q.reward.ash) rw.append(chip(`${q.reward.ash} пепла`, 'ash', 'ui:fire')); if (q.reward.xp) rw.append(chip(`${q.reward.xp} опыта`, 'xp', 'ui:sparkle')); for (const [id, n] of q.reward.items || []) rw.append(chip(BY_ID[id].name + (n > 1 ? ' ×' + n : ''), 'item', 'ui:gem'));
    main.append(head, el('div', 'qtext', q.text), goal, rw); r.append(main);
    const near = W.nearNpc === q.giver, acts = el('div', 'qacts'), btn = (txt, cls, f) => { const b = el('button', 'qbtn ' + (cls || ''), txt); b.type = 'button'; b.addEventListener('click', f); acts.append(b); return b; };
    if (s === 'available') btn('Взять', near ? 'main' : 'main no', () => { const res = acceptQuest(W, q.id); flash(res === 'ok' ? 'Задание взято' : res === 'full' ? `Не больше ${MAX_ACTIVE} заданий` : 'Подойдите к тому, кто выдаёт'); if (res === 'ok' && !W.questFocus) W.questFocus = q.id; render(); onChange && onChange(); });
    if (s === 'ready') btn('Сдать', near ? 'main' : 'main no', () => { const res = claimQuest(W, q.id); flash(res === 'ok' ? 'Награда получена' : 'Сдавать нужно: ' + GIVER_NAME[q.giver]); if (res === 'ok' && W.questFocus === q.id) W.questFocus = null; render(); onChange && onChange(); });
    if (s === 'active' || s === 'ready') {
      const on = W.questFocus === q.id; btn(on ? '✓ Ведём' : 'Вести', on ? 'focus on' : 'focus', () => { W.questFocus = on ? null : q.id; flash(on ? 'Метки пути выключены' : 'Метки пути — к этому заданию'); render(); onChange && onChange(); });
      if (s === 'active') btn(armed === q.id ? 'Точно бросить?' : 'Бросить', 'quiet', () => { if (armed !== q.id) { armed = q.id; setTimeout(() => { armed = ''; render(); }, 2500); render(); return; } armed = ''; if (W.questFocus === q.id) W.questFocus = null; abandonQuest(W, q.id); render(); onChange && onChange(); }); }
    if (s === 'cooldown') acts.append(el('span', 'qstate', 'Позже'));
    r.append(acts); return r;
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
      const done = items.filter(([, s]) => s === 'done'); for (const [q, s] of items) if (s !== 'done') listEl.appendChild(card(q, s));
      if (done.length) { const d = el('details', 'qdone'), sm = el('summary', '', `Выполнено: ${done.length}`); d.append(sm); for (const [q] of done) d.append(el('div', 'qdl', '✓ ' + q.name)); listEl.appendChild(d); }     // выполненные — свёрнуто
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
