// Вкладка «Навыки»: три ветки, узлы с рангами, карточка узла, сброс за пепел.
import { P } from '../state.js';
import { BRANCHES, SKILLS } from '../data/skills.js';
import { rankOf, canLearn, learn, respec, respecCost, spentPoints } from '../skills.js';
import { recalc } from '../inventory.js';
import { sfx } from '../audio.js';
import { h as H, createConfirmer } from './common.js';

export function createSkillsUI(doc, onChange) {
  const $ = id => doc.getElementById(id);
  const tree = $('skTree'), foot = $('skFoot'), wrap = $('skWrap'), card = $('skCard');
  const h = (tag, cls, text) => H(doc, tag, cls, text);
  let sel = null, msg = '';
  const confirmer = createConfirmer(() => render());

  function node(id) {
    const s = SKILLS[id], r = rankOf(id), st = canLearn(id);
    const b = h('button', 'sknode'); b.type = 'button'; b.dataset.id = id;
    if (r) b.classList.add('has');
    if (r >= s.max) b.classList.add('max');
    else if (st === 'ok') b.classList.add('can');
    if (st === 'locked') b.classList.add('locked');
    b.appendChild(h('span', 'nm', s.name));
    b.appendChild(h('span', 'pips', '●'.repeat(r) + '○'.repeat(s.max - r)));
    b.setAttribute('aria-label', `${s.name}, ранг ${r} из ${s.max}`);
    return b;
  }

  function render() {
    tree.textContent = '';
    for (const br of BRANCHES) {
      const col = h('div', 'skcol');
      col.appendChild(h('div', 'skhead', br.name));
      for (const id of br.nodes) col.appendChild(node(id));
      tree.appendChild(col);
    }
    foot.textContent = '';
    foot.appendChild(h('div', 'sknote', msg || (P.sp > 0 ? `Свободных очков: ${P.sp}. Нажмите на узел, чтобы изучить.` : 'Очко навыка даётся за каждый новый уровень и за некоторые задания.')));
    const spent = spentPoints();
    const rb = h('button', 'cbtn', spent ? `Сбросить навыки (${respecCost()} пепла)` : 'Нечего сбрасывать'); rb.type = 'button'; rb.disabled = !spent;
    if (confirmer.is('respec')) { rb.textContent = 'Точно? −' + respecCost() + ' пепла'; rb.classList.add('warn'); }
    rb.addEventListener('click', () => {
      if (!confirmer.is('respec')) { confirmer.arm('respec'); render(); return; }
      confirmer.clear();
      const r = respec(recalc);
      msg = r === 'ok' ? 'Навыки сброшены, очки возвращены.' : r === 'ash' ? 'Не хватает пепла на сброс.' : '';
      sel = null; onChange(); render();
    });
    foot.appendChild(rb);
    renderCard();
  }

  function renderCard() {
    if (!sel) { wrap.hidden = true; card.textContent = ''; return; }
    const s = SKILLS[sel], r = rankOf(sel), st = canLearn(sel);
    card.textContent = '';
    const nm = h('div', 'cname', s.name); card.appendChild(nm);
    card.appendChild(h('div', 'csub', `Ранг ${r} из ${s.max}` + (s.req ? ` · требует «${SKILLS[s.req].name}»` : '')));
    card.appendChild(h('div', 'cdesc', s.desc));
    const t = h('div', 'cstats');
    const row = (k, v, cls) => { const l = h('div', 'crow'); l.appendChild(h('span', 'k', k)); const x = h('span', 'v', v); if (cls) x.classList.add(cls); l.appendChild(x); t.appendChild(l); };
    if (r) row('Сейчас', s.effect(r), 'pos');
    if (r < s.max) row('Следующий ранг', s.effect(r + 1));
    else row('Предел', 'изучен полностью', 'pos');
    card.appendChild(t);
    const why = st === 'locked' ? `Сначала изучите «${SKILLS[s.req].name}».` : st === 'points' ? 'Нет свободных очков навыка.' : '';
    if (why) card.appendChild(h('div', 'cvs', why));
    const btns = h('div', 'cbtns');
    const lb = h('button', 'cbtn main', st === 'max' ? 'Изучено' : 'Изучить (1 очко)'); lb.type = 'button'; lb.disabled = st !== 'ok';
    lb.addEventListener('click', () => { if (learn(sel, recalc) === 'ok') { sfx.level(); msg = `Изучено: ${s.name} ${rankOf(sel)}/${s.max}`; onChange(); render(); } });
    const cb = h('button', 'cbtn close', 'Закрыть'); cb.type = 'button';
    cb.addEventListener('click', () => { sel = null; renderCard(); });
    btns.appendChild(lb); btns.appendChild(cb); card.appendChild(btns);
    wrap.hidden = false;
  }

  tree.addEventListener('click', e => { const b = e.target.closest('.sknode'); if (!b) return; confirmer.clear(); sel = b.dataset.id; render(); });
  wrap.addEventListener('click', e => { if (e.target === wrap) { sel = null; renderCard(); } });

  return { render, reset() { sel = null; msg = ''; confirmer.clear(); wrap.hidden = true; } };
}
