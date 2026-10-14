// Окно навыков: три ветки, ранги, очки, сброс за пепел.
import { BRANCHES, TIER_STEP, spentIn, canRank } from './data/skills3d.js';
import { spendSkill, respec, respecCost, xpNeed } from './sim.js';

export function createSkills(doc, W, cfg, { onOpen, onClose, onChange } = {}) {
  const $ = id => doc.getElementById(id);
  const root = $('skills'), listEl = $('skillList'), tabsEl = $('skillTabs'), headEl = $('skillHead'), xpEl = $('skillXp'), flashEl = $('skillFlash'), resetBtn = $('skillReset');
  let branch = BRANCHES[0].id, armed = false, flashT = 0;
  const el = (tag, cls, txt) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const flash = t => { flashEl.textContent = t; clearTimeout(flashT); flashT = setTimeout(() => { flashEl.textContent = ''; }, 2200); };
  for (const b of BRANCHES) { const t = el('button', 'tab', b.name); t.type = 'button'; t.dataset.tab = b.id; t.addEventListener('click', () => { branch = b.id; render(); }); tabsEl.appendChild(t); }
  function render() {
    headEl.textContent = `Навыки · очков: ${W.sp}`;
    xpEl.textContent = W.lv >= cfg.level.max ? `Уровень ${W.lv} (максимум)` : `Уровень ${W.lv} · опыт ${W.xp}/${xpNeed(W.lv, cfg)}`;
    for (const t of tabsEl.children) { const b = BRANCHES.find(x => x.id === t.dataset.tab); t.classList.toggle('on', t.dataset.tab === branch); t.textContent = `${b.name} · ${spentIn(W.skills, b.id)}`; }
    listEl.textContent = '';
    const br = BRANCHES.find(b => b.id === branch), spent = spentIn(W.skills, branch);
    br.skills.forEach((s, i) => {
      const r = W.skills[s.id] || 0, st = canRank(W.skills, s.id, W.sp), need = i * TIER_STEP;
      const row = el('div', 'skrow' + (spent < need ? ' lock' : '')), info = el('div', 'sinfo');
      const nm = el('span', 'nm', s.name); nm.style.color = br.color;
      const pips = el('span', 'pips'); pips.style.setProperty('--pc', br.color); for (let k = 0; k < s.max; k++) pips.appendChild(el('i', k < r ? 'on' : ''));
      info.append(nm, pips, el('div', 'sub', spent < need ? `Нужно ${need} очков в ветке (сейчас ${spent})` : s.text));
      const b = el('button', 'plus', '+'); b.type = 'button'; b.disabled = st !== 'ok'; b.setAttribute('aria-label', 'Вложить очко: ' + s.name);
      b.addEventListener('click', () => { spendSkill(W, s.id); render(); onChange && onChange(); });
      row.append(info, b); listEl.appendChild(row);
    });
    const cost = respecCost(W), spentAll = Object.values(W.skills).reduce((a, b) => a + b, 0);
    resetBtn.textContent = armed ? 'Точно? Очки вернутся, пепел спишется' : `Сбросить навыки · ${cost} пепла`;
    resetBtn.classList.toggle('warn', armed); resetBtn.disabled = !spentAll;
  }
  resetBtn.addEventListener('click', () => {
    if (!armed) { armed = true; render(); setTimeout(() => { armed = false; render(); }, 3000); return; }
    armed = false; const r = respec(W); if (r === 'ash') flash('Не хватает пепла'); render(); onChange && onChange();
  });
  const open = () => { render(); root.hidden = false; onOpen && onOpen(); };
  const close = () => { root.hidden = true; onClose && onClose(); };
  $('skillBtn').addEventListener('click', () => (root.hidden ? open() : close()));
  $('skillClose').addEventListener('click', close);
  return { open, close, render, isOpen: () => !root.hidden };
}
