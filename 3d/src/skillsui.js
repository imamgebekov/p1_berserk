// Окно навыков: три ветки, ранги, очки, сброс за пепел; вкладка «Умения» — активные умения героя со своими очками (B3).
import { BRANCHES, TIER_STEP, spentIn, canRank } from './data/skills3d.js';
import { spendSkill, respec, respecCost, xpNeed } from './sim.js';
import { abilityView, upgradeAbility, canUpgrade, respecAbilities, respecAbilityCost, spentAbility } from './abilities3d.js';

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
  let branch = BRANCHES[0].id, armed = false, flashT = 0;
  const el = (tag, cls, txt) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const flash = t => { flashEl.textContent = t; clearTimeout(flashT); flashT = setTimeout(() => { flashEl.textContent = ''; }, 2200); };
  for (const b of [...BRANCHES, { id: 'abil', name: 'Умения' }]) { const t = el('button', 'tab', b.name); t.type = 'button'; t.dataset.tab = b.id; t.addEventListener('click', () => { branch = b.id; armed = false; render(); }); tabsEl.appendChild(t); }
  function renderAbil() {
    const AC = '#e8c04a', list = abilityView(W);
    if (!list.length) listEl.appendChild(el('div', 'emptyl', 'У этого героя умений пока нет.'));
    for (const a of list) {
      const row = el('div', 'skrow' + (a.open ? '' : ' lock')), info = el('div', 'sinfo');
      const nm = el('span', 'nm', `${a.icon} ${a.name}`); nm.style.color = AC;
      const pips = el('span', 'pips'); pips.style.setProperty('--pc', AC); for (let k = 0; k < a.max; k++) pips.appendChild(el('i', k < a.rank ? 'on' : ''));
      const when = a.nextLv > W.lv ? ' — с уровня ' + a.nextLv : '';
      if (!a.open) info.append(nm, pips, el('div', 'sub', `Откроется на уровне ${a.lv}. ${a.next}`));
      else if (!a.rank) info.append(nm, pips, el('div', 'sub', `Клавиша ${a.slot + 1}. Открыть${when}: ${a.next}`));
      else info.append(nm, pips, el('div', 'sub', `Сейчас: ${a.now}`), el('div', 'sub nx', a.next ? `Ранг ${a.rank + 1}${when}: ${rankDiff(a.now, a.next) || a.next}` : 'Максимум.'));     // только разница (шаг 10)
      const st = canUpgrade(W, a.id), b = el('button', 'plus', '+'); b.type = 'button'; b.disabled = st !== 'ok'; b.setAttribute('aria-label', 'Улучшить: ' + a.name);
      b.addEventListener('click', () => { upgradeAbility(W, a.id); render(); onChange && onChange(); });
      row.append(info, b); listEl.appendChild(row);
    }
    resetBtn.textContent = armed ? 'Точно? Очки умений вернутся, пепел спишется' : `Сбросить умения · ${respecAbilityCost(W)} пепла`;
    resetBtn.classList.toggle('warn', armed); resetBtn.disabled = !spentAbility(W.ab);
  }
  function render() {
    headEl.textContent = `Навыки · очков: ${W.sp} · умений: ${W.ap}`;
    xpEl.textContent = W.lv >= cfg.level.max ? `Уровень ${W.lv} (максимум)` : `Уровень ${W.lv} · опыт ${W.xp}/${xpNeed(W.lv, cfg)}`;
    for (const t of tabsEl.children) { const b = BRANCHES.find(x => x.id === t.dataset.tab); t.classList.toggle('on', t.dataset.tab === branch); t.textContent = b ? `${b.name} · ${spentIn(W.skills, b.id)}` : `Умения · ${spentAbility(W.ab)}`; }
    listEl.textContent = '';
    if (branch === 'abil') { renderAbil(); return; }
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
    armed = false; const r = branch === 'abil' ? respecAbilities(W) : respec(W); if (r === 'ash') flash('Не хватает пепла'); render(); onChange && onChange();
  });
  const open = () => { render(); root.hidden = false; onOpen && onOpen(); };
  const close = () => { root.hidden = true; onClose && onClose(); };
  $('skillBtn').addEventListener('click', () => (root.hidden ? open() : close()));
  $('skillClose').addEventListener('click', close);
  return { open, close, render, isOpen: () => !root.hidden };
}
