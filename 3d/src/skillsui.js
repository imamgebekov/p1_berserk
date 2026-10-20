// Окно навыков: три ветки, ранги, очки, сброс за пепел; вкладка «Умения» — активные умения героя со своими очками (B3).
import { branchesOf, TIER_STEP, spentIn, canRank } from './data/skills3d.js';
import { spendSkill, respec, respecCost, xpNeed, rankNeed } from './sim.js';
import { combosOf } from './combos3d.js';
import { abilityView, upgradeAbility, canUpgrade, respecAbilities, respecAbilityCost, spentAbility, resView, barOf, setBar, BAR } from './abilities3d.js';
import { treeOf, rankOf, canBuy, buy, needText, spentInTree, ROWS, COLS, ROW_STEP } from './tree3d.js';
import { MASTERY_TEXT } from './data/abilities3d.js';
import { GI } from './data/gicons.js';
import { refreshGear } from './sim.js';

// разница рангов (шаг 10): у описаний одинаковый текст, меняются числа — показываем только их: «×1,4 → ×1,6 · 9 с → 8,5 с»;
// если текст рангов разный — null (тогда показываем следующий ранг целиком)
const NUM = /([×+−-]?\d+(?:[.,]\d+)?)(\s?(?:%|(?:с|м|сек)(?![а-яё])))?/gi;
export function rankDiff(now, next) {
  const sk = t => t.replace(NUM, '#'), a = [...now.matchAll(NUM)], b = [...next.matchAll(NUM)];
  if (sk(now) !== sk(next) || a.length !== b.length) return null;
  const out = []; for (let i = 0; i < a.length; i++) if (a[i][0] !== b[i][0]) out.push(`${a[i][0].trim()} → ${b[i][0].trim()}`);
  return out.length ? out.join(' · ') : null;
}
export function createSkills(doc, W, cfg, { onOpen, onClose, onChange } = {}) {
  const $ = id => doc.getElementById(id);
  const root = $('skills'), listEl = $('skillList'), tabsEl = $('skillTabs'), headEl = $('skillHead'), xpEl = $('skillXp'), flashEl = $('skillFlash'), resetBtn = $('skillReset');
  let branch = branchesOf(W.hero)[0].id, armed = false, flashT = 0, tabsHero = null;
  const el = (tag, cls, txt) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const flash = t => { flashEl.textContent = t; clearTimeout(flashT); flashT = setTimeout(() => { flashEl.textContent = ''; }, 2200); };
  // вкладки — специализации героя (этап 2), «Скиталец» и «Умения»; при смене героя строятся заново
  let sel = null;     // выбранный узел древа
  const buildTabs = () => { tabsHero = W.hero; tabsEl.textContent = ''; if (branch !== 'tree' && branch !== 'abil') branch = 'tree'; for (const b of [{ id: 'tree', name: 'Древо' }, { id: 'abil', name: 'Панель и связки' }]) { const t = el('button', 'tab', b.name); t.type = 'button'; t.dataset.tab = b.id; t.addEventListener('click', () => { branch = b.id; armed = false; render(); }); tabsEl.appendChild(t); } };
  function renderAbil() {
    const AC = '#e8c04a', list = abilityView(W), rv = resView(W), resName = rv ? rv.name : '';
    if (!list.length) listEl.appendChild(el('div', 'emptyl', 'У этого героя умений пока нет.'));
    for (const a of list) {
      const row = el('div', 'skrow' + (a.open ? '' : ' lock')), info = el('div', 'sinfo');
      const nm = el('span', 'nm', a.name); nm.style.color = AC; nm.prepend(gi('n:' + a.id, 'gi inl'));
      const pips = el('span', 'pips'); pips.style.setProperty('--pc', AC); for (let k = 0; k < a.max; k++) pips.appendChild(el('i', k < a.rank ? 'on' : ''));
      const when = a.nextLv > W.lv ? ' — с уровня ' + a.nextLv : '';
      if (!a.open) info.append(nm, pips, el('div', 'sub', `Откроется на уровне ${a.lv}. ${a.next}`));
      else if (!a.rank) info.append(nm, pips, el('div', 'sub', `Открыть${when}: ${a.next}`));
      else info.append(nm, pips, el('div', 'sub', `Сейчас: ${a.now}${a.cost && resName ? ` Цена: ${a.cost} (${resName.toLowerCase()}).` : ''}`), el('div', 'sub nx', a.next ? `Ранг ${a.rank + 1}${when}: ${rankDiff(a.now, a.next) || a.next}` : 'Максимум.'));     // только разница (шаг 10)
      if (a.mt) info.append(el('div', 'sub ' + (a.rank >= 4 ? 'g' : 'nx'), `Мастерство (с ${a.mlv}-го ур.): ${a.mt}`));     // мастерство меняет поведение умения
      const st = canUpgrade(W, a.id), b = el('button', 'plus', '+'); b.type = 'button'; b.disabled = st !== 'ok'; b.setAttribute('aria-label', 'Улучшить: ' + a.name);
      b.addEventListener('click', () => { upgradeAbility(W, a.id); render(); onChange && onChange(); });
      // панель (2026-10-18): в какую ячейку 1–5 поставить изученное умение; повторное нажатие убирает с панели
      if (a.rank) { const bar = barOf(W), sl = el('div', 'slots'); sl.append(el('span', 'sl-l', 'На панель:'));
        for (let k = 0; k < BAR; k++) { const sb = el('button', 'bslot' + (bar[k] === a.id ? ' on' : ''), String(k + 1)); sb.type = 'button'; sb.setAttribute('aria-label', `${a.name}: ячейка ${k + 1}`);
          sb.addEventListener('click', () => { setBar(W, k, bar[k] === a.id ? null : a.id); render(); onChange && onChange(); }); sl.append(sb); }
        info.append(sl); }
      void b; row.append(info); listEl.appendChild(row);     // очки — только в древе (2026-10-20)
    }
    // связки (2026-10-18): умение А, потом Б не позже window с — Б сильнее; видно, изучены ли оба и стоят ли на панели
    const cl = combosOf(W.hero); if (cl.length) {
      listEl.appendChild(el('div', 'emptyl', `Связки: умение, потом второе не позже ${W.cfg.combos.window} с — второе сильнее. Кнопка второго подсвечивается.`));
      const name = id => (list.find(a => a.id === id) || { name: id }).name, bar = barOf(W);
      for (const c of cl) { const known = (W.ab[c.a] || 0) > 0 && (W.ab[c.b] || 0) > 0, onBar = bar.includes(c.a) && bar.includes(c.b);
        const row = el('div', 'skrow combo' + (known ? '' : ' lock')), info = el('div', 'sinfo'), nm = el('span', 'nm', c.name); nm.style.color = '#ffd27a';
        info.append(nm, el('div', 'sub', `${name(c.a)} → ${name(c.b)}: ${c.text}`), el('div', 'sub nx', !known ? 'Нужны оба умения.' : onBar ? 'Оба на панели — готово.' : 'Поставьте оба на панель.'));
        row.append(info); listEl.appendChild(row); } }
    const cost = respecCost(W) + respecAbilityCost(W);
    resetBtn.textContent = armed ? 'Точно? Все очки вернутся, пепел спишется' : `Сбросить древо · ${cost} пепла`; resetBtn.classList.toggle('warn', armed); resetBtn.disabled = !(spentAbility(W.ab) || Object.values(W.skills).some(v => v > 0));
  }
  // древо (2026-10-20): три ветки рядом, узлы-значки с рангом; выбор — карточка с описанием и кнопкой
  const gi = (k, cls) => { const d = GI[k], sv = doc.createElementNS('http://www.w3.org/2000/svg', 'svg'); sv.setAttribute('viewBox', '0 0 512 512'); sv.setAttribute('class', cls || 'gi'); if (d) { const pa = doc.createElementNS('http://www.w3.org/2000/svg', 'path'); pa.setAttribute('d', d); sv.appendChild(pa); } return sv; };
  function nodeInfo(n) {
    const ab = n.kind !== 'talent' ? abilityView(W).find(a => a.id === n.id) : null, r = rankOf(W, n), out = [];
    if (n.kind === 'talent') out.push(n.text);
    else if (n.kind === 'mastery') out.push(MASTERY_TEXT[n.id] || '', ab && ab.mlv ? `С ${ab.mlv}-го уровня, нужно умение 3-го ранга.` : '');
    else if (ab) { if (r) out.push('Сейчас: ' + ab.now); if (r < 3 && ab.next) out.push(`${r ? 'Ранг ' + (r + 1) : 'Открыть'}${ab.nextLv > W.lv ? ' — с уровня ' + ab.nextLv : ''}: ${r && ab.now ? rankDiff(ab.now, ab.next) || ab.next : ab.next}`); }
    return out.filter(Boolean);
  }
  function renderTree() {
    const T = treeOf(W.hero), wrap = el('div', 'tree'), card = el('div', 'tcard');
    T.forEach(br => {
      const spent = spentInTree(W, br), col = el('div', 'tbranch'); col.style.setProperty('--bc', br.color);
      { const fa = br.nodes.find(x => x.kind === 'active'); if (fa) col.append(gi(fa.icon, 'twm')); }     // знак ветки на фоне
      col.append(el('div', 'tbh', `${br.name} · ${spent}`), el('div', 'tbr', br.role || ''));
      const grid = el('div', 'tgrid'); grid.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`; grid.style.gridTemplateRows = `repeat(${ROWS}, auto)`;
      const lines = doc.createElementNS('http://www.w3.org/2000/svg', 'svg'); lines.setAttribute('class', 'tlines'); lines.setAttribute('viewBox', `0 0 ${COLS * 10} ${ROWS * 10}`); lines.setAttribute('preserveAspectRatio', 'none');
      for (const n of br.nodes) {
        const r = rankOf(W, n), st = canBuy(W, n.key), b = el('button', 'tnode ' + n.kind + (r >= n.max ? ' full' : r ? ' some' : '') + (st === 'ok' ? ' can' : '') + (st === 'row' || st === 'req' ? ' lock' : '') + (sel === n.key ? ' sel' : ''));
        b.type = 'button'; b.dataset.key = n.key; b.style.gridColumn = String(n.col + 1); b.style.gridRow = String(n.row); b.title = n.name; b.setAttribute('aria-label', `${n.name}: ${r} из ${n.max}`);
        b.append(gi(n.icon), el('span', 'trk', `${r}/${n.max}`));
        b.addEventListener('click', () => { sel = n.key; render(); });
        b.addEventListener('dblclick', () => { if (buy(W, n.key, refreshGear) === 'ok') { render(); onChange && onChange(); } });
        grid.append(b);
        if (n.req) { const q = br.nodes.find(x => x.key === n.req); if (q) { const ln = doc.createElementNS('http://www.w3.org/2000/svg', 'line'); ln.setAttribute('x1', q.col * 10 + 5); ln.setAttribute('y1', q.row * 10 - 3); ln.setAttribute('x2', n.col * 10 + 5); ln.setAttribute('y2', n.row * 10 - 7); ln.setAttribute('class', rankOf(W, q) >= 3 ? 'on' : ''); lines.append(ln); } }
      }
      grid.prepend(lines); col.append(grid); wrap.append(col);
    });
    const view = el('div', 'tview'); view.append(wrap, card); listEl.append(view);
    // карточка выбранного узла
    const f = sel && T.flatMap(b => b.nodes.map(n => ({ b, n }))).find(x => x.n.key === sel);
    if (f) {
      const { b, n } = f, r = rankOf(W, n), st = canBuy(W, n.key), head = el('div', 'tch');
      head.append(gi(n.icon, 'gi big'), el('div', 'tcn', `${n.name} · ${r}/${n.max}`)); head.lastChild.style.color = b.color;
      card.append(head, el('div', 'tck', n.kind === 'talent' ? 'Талант' : n.kind === 'mastery' ? 'Мастерство умения' : 'Активное умение'));
      for (const t of nodeInfo(n)) card.append(el('div', 'sub', t));
      const why = needText(W, n.key); if (why && st !== 'ok' && st !== 'max') card.append(el('div', 'sub z', why));
      if (st === 'max') card.append(el('div', 'tmax', 'Изучено полностью'));
      else { const bt = el('button', 'tbuy', 'Вложить очко'); bt.type = 'button'; bt.disabled = st !== 'ok';
        bt.addEventListener('click', () => { const res = buy(W, n.key, refreshGear); if (res !== 'ok') flash(needText(W, n.key) || 'Нельзя'); render(); onChange && onChange(); });
        card.append(bt); }
      if (n.kind === 'active' && r > 0) { const bar = barOf(W), sl = el('div', 'slots'); sl.append(el('span', 'sl-l', 'На панель:'));
        for (let k = 0; k < BAR; k++) { const sb = el('button', 'bslot' + (bar[k] === n.id ? ' on' : ''), String(k + 1)); sb.type = 'button'; sb.addEventListener('click', () => { setBar(W, k, bar[k] === n.id ? null : n.id); render(); onChange && onChange(); }); sl.append(sb); }
        card.append(sl); }
    } else card.append(el('div', 'sub', 'Нажмите на узел — описание и кнопка «Вложить очко». Двойной щелчок — сразу вложить.'), el('div', 'sub', `Ряд открывается за каждые ${ROW_STEP} очка в ветке. Умения и мастерство — за очки умений, таланты — за очки талантов.`));
    const cost = respecCost(W) + respecAbilityCost(W), any = Object.values(W.skills).some(v => v > 0) || spentAbility(W.ab) > 0;
    resetBtn.textContent = armed ? 'Точно? Все очки вернутся, пепел спишется' : `Сбросить древо · ${cost} пепла`; resetBtn.classList.toggle('warn', armed); resetBtn.disabled = !any;
  }
  function render() {
    if (tabsHero !== W.hero) buildTabs();
    headEl.textContent = `Древо · очков талантов: ${W.sp} · умений: ${W.ap}`;
    xpEl.textContent = W.lv >= cfg.level.max ? (cfg.level.ranks && cfg.level.ranks.on ? `Уровень ${W.lv} · пепельный ранг ${W.prank || 0}` + ((W.prank || 0) < cfg.level.ranks.cap ? ` · опыт ${W.pxp || 0}/${rankNeed(cfg)}` : ' (максимум)') : `Уровень ${W.lv} (максимум)`) : `Уровень ${W.lv} · опыт ${W.xp}/${xpNeed(W.lv, cfg)}`;
    for (const t of tabsEl.children) t.classList.toggle('on', t.dataset.tab === branch);
    listEl.textContent = '';
    if (branch === 'abil') { renderAbil(); return; }
    renderTree(); return;
    const br = branchesOf(W.hero).find(b => b.id === branch), spent = spentIn(W.skills, branch);
    listEl.appendChild(el('div', 'emptyl', br.common ? 'Общая ветка: польза в пути, у всех героев.' : `Специализация «${br.name}» — ${br.role}. Следующий талант открывается за каждые ${TIER_STEP} очка в ветке.`));
    br.skills.forEach((s, i) => {
      const r = W.skills[s.id] || 0, st = canRank(W.skills, s.id, W.sp, W.hero), need = (s.tier ?? i) * TIER_STEP;
      const row = el('div', 'skrow' + (spent < need ? ' lock' : '')), info = el('div', 'sinfo');
      const nm = el('span', 'nm', s.name); nm.style.color = br.color;
      const pips = el('span', 'pips'); pips.style.setProperty('--pc', br.color); for (let k = 0; k < s.max; k++) pips.appendChild(el('i', k < r ? 'on' : ''));
      info.append(nm, pips, el('div', 'sub', spent < need ? `Нужно ${need} очков в ветке (сейчас ${spent})` : s.text));
      const b = el('button', 'plus', '+'); b.type = 'button'; b.disabled = st !== 'ok'; b.setAttribute('aria-label', 'Вложить очко: ' + s.name);
      b.addEventListener('click', () => { spendSkill(W, s.id); render(); onChange && onChange(); });
      row.append(info, b); listEl.appendChild(row);
    });
    const cost = respecCost(W), spentAll = Object.values(W.skills).reduce((a, b) => a + b, 0);
    resetBtn.textContent = armed ? 'Точно? Очки вернутся, пепел спишется' : `Сбросить таланты · ${cost} пепла`;
    resetBtn.classList.toggle('warn', armed); resetBtn.disabled = !spentAll;
  }
  resetBtn.addEventListener('click', () => {
    if (!armed) { armed = true; render(); setTimeout(() => { armed = false; render(); }, 3000); return; }
    armed = false; const need = respecCost(W) + respecAbilityCost(W); if (W.inv.ash < need) { flash('Не хватает пепла'); render(); return; }
    if (spentAbility(W.ab)) respecAbilities(W); if (Object.values(W.skills).some(v => v > 0)) respec(W); sel = null; render(); onChange && onChange();     // сброс всего древа разом
  });
  const open = () => { render(); root.hidden = false; onOpen && onOpen(); };
  const close = () => { root.hidden = true; onClose && onClose(); };
  $('skillBtn').addEventListener('click', () => (root.hidden ? open() : close()));
  $('skillClose').addEventListener('click', close);
  return { open, close, render, isOpen: () => !root.hidden };
}
