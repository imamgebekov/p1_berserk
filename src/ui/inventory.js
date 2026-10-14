// Экран «Сумка»: надетое (6 слотов), сетка 5×4, карточка предмета со сравнением, действия.
// Пока экран открыт, игра на паузе.
import { CFG, xpNeed } from '../config.js';
import { P, W, keys } from '../state.js';
import { createPreview } from './preview.js';
import { SLOTS, SLOT_NAMES, STAT_NAMES, STAT_UNITS } from '../data/items.js';
import { defOf, compare, equipFromBag, unequip, sellFromBag, dropFromBag, sellValue, bagFull, derived, itemStats } from '../inventory.js';
import { drawIcon, SLOT_ICON } from '../icons.js';

export function createInventoryUI(doc) {
  const $ = id => doc.getElementById(id);
  const root = $('bag'), eqEl = $('eq'), gridEl = $('grid'), sumEl = $('bagSum'), ashEl = $('bagAsh'), msgEl = $('bagMsg');
  const heroTab = $('heroTab'), bagTab = $('bagTab'), hL = $('hL'), hR = $('hR'), hStats = $('hStats');
  const preview = createPreview($('hPrev'));
  let tab = 'hero';
  const sheet = $('cardWrap'), card = $('card');
  const RAR = CFG.items.rarity;
  let sel = null;            // { src: 'bag', i } | { src: 'eq', slot }
  let confirm = null;        // { key, timer }
  let open_ = false;

  const h = (tag, cls, text) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const fmt = (k, v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + STAT_UNITS[k];
  const fmtPct = (k, v) => v === 0 ? '0%' : fmt(k, v);

  function cell(it, key, opts = {}) {
    const b = h('button', 'cell');
    b.type = 'button'; b.dataset.key = key;
    if (it) {
      const d = defOf(it);
      b.classList.add('r-' + d.rarity);
      b.setAttribute('aria-label', d.name + ', ' + RAR[d.rarity].name);
      const c = doc.createElement('canvas'); drawIcon(c, d.icon, d.pal); b.appendChild(c);
    } else {
      b.classList.add('empty');
      if (opts.slot) {
        b.setAttribute('aria-label', 'Пусто: ' + SLOT_NAMES[opts.slot]);
        const c = doc.createElement('canvas'); drawIcon(c, SLOT_ICON[opts.slot], ['#000', '#000'], true); b.appendChild(c);
      } else b.setAttribute('aria-label', 'Пустая ячейка');
    }
    if (sel && ((sel.src === 'bag' && key === 'b' + sel.i) || (sel.src === 'eq' && key === 'e' + sel.slot))) b.classList.add('sel');
    return b;
  }

  function render() {
    eqEl.textContent = ''; gridEl.textContent = '';
    for (const s of SLOTS) eqEl.appendChild(cell(P.eq[s], 'e' + s, { slot: s }));
    for (let i = 0; i < CFG.items.bagSize; i++) gridEl.appendChild(cell(P.bag[i] || null, 'b' + i));
    ashEl.textContent = 'Пепел: ' + P.ash;
    renderHero();
    const d = derived();
    sumEl.textContent = `Урон ${d.dmg} · Броня ${d.armor}${d.armor ? ' (−' + d.reduction + '%)' : ''} · Здоровье ${d.hp} · Скорость ${fmtPct('speed', d.speed)} · Крит ${d.crit}% · Клеймо ${fmtPct('rage', d.rage)}`;
    renderCard();
  }

  function renderHero() {
    $('hLv').textContent = 'ур. ' + P.lv;
    const need = xpNeed(P.lv);
    $('hXp').style.transform = 'scaleX(' + Math.min(1, P.xp / need) + ')';
    $('hXpTxt').textContent = 'опыт ' + Math.floor(P.xp) + ' / ' + need;
    hL.textContent = ''; hR.textContent = '';
    SLOTS.forEach((s, i) => (i < 3 ? hL : hR).appendChild(cell(P.eq[s], 'e' + s, { slot: s })));
    const d = derived();
    const rows = [
      ['Урон', d.dmg], ['Тяжёлый удар', d.heavy], ['Дальность удара', d.reach],
      ['Броня', d.armor + (d.armor ? ' (−' + d.reduction + '% урона)' : '')], ['Здоровье', d.hp],
      ['Скорость', fmtPct('speed', d.speed)], ['Шанс крита', d.crit + '%'], ['Набор Клейма', fmtPct('rage', d.rage)]
    ];
    hStats.textContent = '';
    for (const [k, v] of rows) {
      const line = h('div', 'crow'); line.appendChild(h('span', 'k', k)); line.appendChild(h('span', 'v', String(v))); hStats.appendChild(line);
    }
  }

  function showTab(t) {
    tab = t;
    heroTab.hidden = t !== 'hero'; bagTab.hidden = t !== 'bag';
    $('tabHero').classList.toggle('on', t === 'hero'); $('tabBag').classList.toggle('on', t === 'bag');
    $('tabHero').setAttribute('aria-selected', t === 'hero'); $('tabBag').setAttribute('aria-selected', t === 'bag');
    if (open_ && t === 'hero') preview.start(); else preview.stop();
    if (t === 'hero') { sel = null; sheet.hidden = true; }
    if (t === 'bag') P.newItems = 0;
  }

  function selectedItem() {
    if (!sel) return null;
    return sel.src === 'bag' ? P.bag[sel.i] : P.eq[sel.slot];
  }

  function twoTap(btn, key, label, action, needConfirm) {
    btn.textContent = confirm && confirm.key === key ? 'Точно?' : label;
    if (confirm && confirm.key === key) btn.classList.add('warn');
    btn.addEventListener('click', () => {
      if (needConfirm && !(confirm && confirm.key === key)) {
        clearConfirm();
        confirm = { key, timer: setTimeout(() => { confirm = null; renderCard(); }, CFG.items.confirmMs) };
        renderCard();
        return;
      }
      clearConfirm();
      action();
    });
  }
  function clearConfirm() { if (confirm) { clearTimeout(confirm.timer); confirm = null; } }

  function renderCard() {
    const it = selectedItem();
    if (!it) { sheet.hidden = true; card.textContent = ''; return; }
    const d = defOf(it), col = RAR[d.rarity].color;
    card.textContent = '';
    card.style.borderTopColor = col;
    card.appendChild(h('div', 'cname', d.name)).style.color = col;
    card.appendChild(h('div', 'csub', `${SLOT_NAMES[d.slot]} · ${RAR[d.rarity].name}${sel.src === 'eq' ? ' · надето' : ''}`));
    card.appendChild(h('div', 'cdesc', d.desc));
    const rows = compare(it);
    const worn = sel.src === 'bag' ? P.eq[d.slot] : null;
    const tbl = h('div', 'cstats');
    for (const r of rows) {
      const line = h('div', 'crow');
      line.appendChild(h('span', 'k', STAT_NAMES[r.k]));
      const v = h('span', 'v', r.now === 0 ? '0' : fmt(r.k, r.now));
      v.classList.add(r.now < 0 ? 'neg' : 'pos');
      line.appendChild(v);
      if (worn) {
        const df = h('span', 'df', r.diff === 0 ? '=' : '(' + (r.diff > 0 ? '+' : '−') + Math.abs(r.diff) + STAT_UNITS[r.k] + ')');
        df.classList.add(r.diff > 0 ? 'pos' : r.diff < 0 ? 'neg' : 'eq');
        line.appendChild(df);
      }
      tbl.appendChild(line);
    }
    card.appendChild(tbl);
    if (worn) card.appendChild(h('div', 'cvs', 'Сравнение с надетым: ' + defOf(worn).name));
    else if (sel.src === 'bag') card.appendChild(h('div', 'cvs', 'В этом слоте ничего не надето'));

    const btns = h('div', 'cbtns');
    const mk = (cls) => { const b = h('button', 'cbtn ' + cls); b.type = 'button'; btns.appendChild(b); return b; };
    const rare = d.rarity !== 'common';
    if (sel.src === 'bag') {
      const i = sel.i;
      const eqb = mk('main'); eqb.textContent = 'Надеть';
      eqb.addEventListener('click', () => { clearConfirm(); equipFromBag(i); sel = null; msg('Надето: ' + d.name); render(); });
      const sb = mk('');
      twoTap(sb, 's' + it.uid, 'Продать +' + sellValue(it), () => { const v = sellFromBag(i); sel = null; msg('Продано: ' + d.name + ' (+' + v + ' пепла)'); render(); }, rare);
      const db = mk('');
      twoTap(db, 'd' + it.uid, 'Выбросить', () => { dropFromBag(i); sel = null; msg('Выброшено: ' + d.name); render(); }, true);
    } else {
      const slot = sel.slot;
      const ub = mk('main'); ub.textContent = bagFull() ? 'Сумка полна' : 'Снять';
      ub.disabled = bagFull();
      ub.addEventListener('click', () => { if (unequip(slot)) { sel = null; msg('Снято: ' + d.name); render(); } });
    }
    const cb = mk('close'); cb.textContent = 'Закрыть';
    cb.addEventListener('click', () => { clearConfirm(); sel = null; renderCard(); render(); });
    card.appendChild(btns);
    sheet.hidden = false;
  }

  function msg(t) { msgEl.textContent = t; }

  gridEl.addEventListener('click', e => {
    const b = e.target.closest('.cell'); if (!b) return;
    const i = Number(b.dataset.key.slice(1));
    clearConfirm();
    if (!P.bag[i]) { sel = null; render(); return; }
    sel = { src: 'bag', i }; P.newItems = 0; render();
  });
  const onEqClick = e => {
    const b = e.target.closest('.cell'); if (!b) return;
    const slot = b.dataset.key.slice(1);
    clearConfirm();
    if (!P.eq[slot]) { sel = null; msg('Слот пуст: ' + SLOT_NAMES[slot]); if (tab === 'hero') $('hHint').textContent = 'Слот пуст: ' + SLOT_NAMES[slot] + '. Наденьте предмет из сумки.'; render(); return; }
    if (tab === 'hero') showTab('bag');
    sel = { src: 'eq', slot }; render();
  };
  eqEl.addEventListener('click', onEqClick); hL.addEventListener('click', onEqClick); hR.addEventListener('click', onEqClick);
  $('tabHero').addEventListener('click', () => { showTab('hero'); render(); });
  $('tabBag').addEventListener('click', () => { showTab('bag'); render(); });
  sheet.addEventListener('click', e => { if (e.target === sheet) { clearConfirm(); sel = null; render(); } });

  function open(which = 'bag') {
    if (!W.started || P.dead) return;
    if (open_) { showTab(which); render(); return; }
    open_ = true; W.paused = true;
    keys.l = keys.r = keys.atk = keys.jump = false;
    sel = null; msg('');
    root.hidden = false; showTab(which); render();
  }
  function close() {
    if (!open_) return;
    open_ = false; W.paused = false; clearConfirm(); sel = null; preview.stop();
    root.hidden = true; sheet.hidden = true;
  }
  const toggle = which => () => (open_ && tab === which ? close() : open(which));
  $('mbag').addEventListener('click', toggle('bag'));
  $('mhero').addEventListener('click', toggle('hero'));
  $('bagClose').addEventListener('click', close);
  doc.defaultView.addEventListener('keydown', e => { if (e.key === 'i' || e.key === 'I') toggle('bag')(); if (e.key === 'h' || e.key === 'H') toggle('hero')(); if (e.key === 'Escape') close(); });

  return { open, close, render, showTab, isOpen: () => open_, tab: () => tab, previewRunning: () => preview.running };
}
