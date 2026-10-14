// Общие куски интерфейса предметов: ячейка, карточка, двойной тап «Точно?».
import { CFG } from '../config.js';
import { SLOT_NAMES, STAT_NAMES, STAT_UNITS } from '../data/items.js';
import { defOf, compare, itemName } from '../inventory.js';
import { drawIcon, SLOT_ICON } from '../icons.js';

const RAR = CFG.items.rarity;

export const h = (doc, tag, cls, text) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
export const fmt = (k, v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + STAT_UNITS[k];
export const fmtPct = (k, v) => v === 0 ? '0%' : fmt(k, v);

// Ячейка предмета. o: { key, slot (силуэт пустого слота), price, priceBad, mark, sel, badge }
export function makeCell(doc, it, o = {}) {
  const b = h(doc, 'button', 'cell');
  b.type = 'button'; b.dataset.key = o.key || '';
  if (it) {
    const d = defOf(it);
    b.classList.add('r-' + d.rarity);
    b.setAttribute('aria-label', itemName(it) + ', ' + RAR[d.rarity].name);
    const c = doc.createElement('canvas'); drawIcon(c, d.icon, d.pal); b.appendChild(c);
    if (it.up) b.appendChild(h(doc, 'span', 'up', '+' + it.up));
  } else {
    b.classList.add('empty');
    if (o.slot) {
      b.setAttribute('aria-label', 'Пусто: ' + SLOT_NAMES[o.slot]);
      const c = doc.createElement('canvas'); drawIcon(c, SLOT_ICON[o.slot], ['#000', '#000'], true); b.appendChild(c);
    } else b.setAttribute('aria-label', 'Пустая ячейка');
  }
  if (o.price != null) b.appendChild(h(doc, 'span', 'price' + (o.priceBad ? ' bad' : ''), String(o.price)));
  if (o.mark) b.appendChild(h(doc, 'span', 'mark', o.mark));
  if (o.sel) b.classList.add('sel');
  return b;
}

// Подтверждение вторым тапом: один активный ключ, сам сбрасывается через confirmMs
export function createConfirmer(onChange) {
  let key = null, timer = 0;
  const clear = () => { if (timer) clearTimeout(timer); timer = 0; key = null; };
  return {
    is: k => key === k,
    arm(k) { clear(); key = k; timer = setTimeout(() => { key = null; timer = 0; onChange(); }, CFG.items.confirmMs); },
    clear
  };
}

// Нижний лист с карточкой предмета.
// o: { sub (строка после «Слот · Редкость»), rows (свои строки статов), lines (доп. строки текста),
//      buttons: [{ label, cls, disabled, confirmKey, onClick }], confirmer }
export function renderItemCard(doc, card, it, o) {
  const d = defOf(it), col = RAR[d.rarity].color;
  card.textContent = '';
  card.style.borderTopColor = col;
  const name = h(doc, 'div', 'cname', itemName(it)); name.style.color = col; card.appendChild(name);
  card.appendChild(h(doc, 'div', 'csub', `${SLOT_NAMES[d.slot]} · ${RAR[d.rarity].name}${o.sub ? ' · ' + o.sub : ''}`));
  card.appendChild(h(doc, 'div', 'cdesc', d.desc));
  const rows = o.rows || compare(it);
  const worn = o.rows ? null : o.worn;
  const tbl = h(doc, 'div', 'cstats');
  for (const r of rows) {
    const line = h(doc, 'div', 'crow');
    line.appendChild(h(doc, 'span', 'k', STAT_NAMES[r.k] || r.k));
    const v = h(doc, 'span', 'v', r.text != null ? r.text : (r.now === 0 ? '0' : fmt(r.k, r.now)));
    v.classList.add(r.now < 0 ? 'neg' : 'pos'); line.appendChild(v);
    if (r.diff != null && (worn || o.rows)) {
      const df = h(doc, 'span', 'df', r.diff === 0 ? '=' : '(' + (r.diff > 0 ? '+' : '−') + Math.abs(r.diff) + (STAT_UNITS[r.k] || '') + ')');
      df.classList.add(r.diff > 0 ? 'pos' : r.diff < 0 ? 'neg' : 'eq'); line.appendChild(df);
    }
    tbl.appendChild(line);
  }
  card.appendChild(tbl);
  for (const t of o.lines || []) card.appendChild(h(doc, 'div', 'cvs', t));
  const btns = h(doc, 'div', 'cbtns');
  for (const b of o.buttons) {
    const e = h(doc, 'button', 'cbtn ' + (b.cls || '')); e.type = 'button';
    const armed = b.confirmKey && o.confirmer && o.confirmer.is(b.confirmKey);
    e.textContent = armed ? 'Точно?' : b.label;
    if (armed) e.classList.add('warn');
    if (b.disabled) e.disabled = true;
    e.addEventListener('click', () => {
      if (b.confirmKey && o.confirmer && !o.confirmer.is(b.confirmKey)) { o.confirmer.arm(b.confirmKey); o.rerender(); return; }
      if (o.confirmer) o.confirmer.clear();
      b.onClick();
    });
    btns.appendChild(e);
  }
  card.appendChild(btns);
}
