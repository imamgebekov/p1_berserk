// Экран «Сумка»: надетое (6 слотов), сетка 5×4, карточка предмета со сравнением, действия.
// Пока экран открыт, игра на паузе.
import { CFG, xpNeed } from '../config.js';
import { P, W, keys } from '../state.js';
import { createPreview } from './preview.js';
import { SLOTS, SLOT_NAMES } from '../data/items.js';
import { h as H, makeCell, fmtPct, createConfirmer, renderItemCard } from './common.js';
import { defOf, equipFromBag, unequip, sellFromBag, dropFromBag, sellValue, bagFull, derived, itemName } from '../inventory.js';

export function createInventoryUI(doc) {
  const $ = id => doc.getElementById(id);
  const root = $('bag'), eqEl = $('eq'), gridEl = $('grid'), sumEl = $('bagSum'), ashEl = $('bagAsh'), msgEl = $('bagMsg');
  const heroTab = $('heroTab'), bagTab = $('bagTab'), hL = $('hL'), hR = $('hR'), hStats = $('hStats');
  const preview = createPreview($('hPrev'));
  let tab = 'hero';
  const sheet = $('cardWrap'), card = $('card');
  const RAR = CFG.items.rarity;
  let sel = null;            // { src: 'bag', i } | { src: 'eq', slot }
  let open_ = false;

  const h = (tag, cls, text) => H(doc, tag, cls, text);
  const cell = (it, key, opts = {}) => makeCell(doc, it, { ...opts, key, sel: !!sel && ((sel.src === 'bag' && key === 'b' + sel.i) || (sel.src === 'eq' && key === 'e' + sel.slot)) });
  const confirm_ = createConfirmer(() => renderCard());

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

  const clearConfirm = () => confirm_.clear();

  function renderCard() {
    const it = selectedItem();
    if (!it) { sheet.hidden = true; card.textContent = ''; return; }
    const d = defOf(it), rare = d.rarity !== 'common';
    const buttons = [];
    if (sel.src === 'bag') {
      const i = sel.i;
      buttons.push({ label: 'Надеть', cls: 'main', onClick: () => { equipFromBag(i); sel = null; msg('Надето: ' + itemName(it)); render(); } });
      buttons.push({ label: 'Продать +' + sellValue(it), confirmKey: rare ? 's' + it.uid : null, onClick: () => { const v = sellFromBag(i); sel = null; msg('Продано: ' + itemName(it) + ' (+' + v + ' пепла)'); render(); } });
      buttons.push({ label: 'Выбросить', confirmKey: 'd' + it.uid, onClick: () => { dropFromBag(i); sel = null; msg('Выброшено: ' + itemName(it)); render(); } });
    } else {
      const slot = sel.slot;
      buttons.push({ label: bagFull() ? 'Сумка полна' : 'Снять', cls: 'main', disabled: bagFull(), onClick: () => { if (unequip(slot)) { sel = null; msg('Снято: ' + itemName(it)); render(); } } });
    }
    buttons.push({ label: 'Закрыть', cls: 'close', onClick: () => { sel = null; render(); } });
    const worn = sel.src === 'bag' ? P.eq[d.slot] : null;
    renderItemCard(doc, card, it, {
      sub: sel.src === 'eq' ? 'надето' : '', worn, buttons, confirmer: confirm_, rerender: renderCard,
      lines: worn ? ['Сравнение с надетым: ' + itemName(worn)] : sel.src === 'bag' ? ['В этом слоте ничего не надето'] : []
    });
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
