// Окно торговли: «Купить» (витрина) и «Продать» (сумка). Продавать можно только рядом с торговцем.
import { BY_ID, RARITY, SLOTS, SLOT_NAME, statLine } from './data/items.js';
import { betterThanWorn, nameOf } from './inv.js';
import { buyItem, sellItem, sellJunk, sellPrice, buyPrice, refreshGear, upgradeItem, upgradeCost } from './sim.js';

export function createShop(doc, W, cfg, { onOpen, onClose, onChange } = {}) {
  const $ = id => doc.getElementById(id);
  const root = $('shop'), listEl = $('shopList'), headEl = $('shopHead'), tabsEl = $('shopTabs'), flashEl = $('shopFlash'), junkBtn = $('shopJunk');
  let tab = 'buy', armed = null, flashT = 0;
  const el = (tag, cls, txt) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const flash = t => { flashEl.textContent = t; clearTimeout(flashT); flashT = setTimeout(() => { flashEl.textContent = ''; }, 2200); };
  for (const [id, label] of [['buy', 'Купить'], ['sell', 'Продать']]) { const b = el('button', 'tab', label); b.type = 'button'; b.dataset.tab = id; b.addEventListener('click', () => { tab = id; render(); }); tabsEl.appendChild(b); }

  const row = (it, n, sub, price, label, fn, can = true, mark = '', up = 0) => {
    const r = el('div', 'srow'), info = el('div', 'sinfo');
    const nm = el('span', 'nm', nameOf(it.id, up) + (n > 1 ? ' ×' + n : '')); nm.style.color = RARITY[it.rar].color;
    info.append(nm); if (mark) info.append(el('span', 'up', mark)); info.append(el('div', 'sub', sub));
    const b = el('button', 'buy' + (can ? '' : ' no'), `${label} · ${price}`); b.type = 'button';
    b.addEventListener('click', () => { fn(); render(); onChange && onChange(); });
    r.append(info, b); return r;
  };
  function render() {
    refreshGear(W);
    headEl.textContent = `Торговец · пепел ${W.inv.ash}`;
    for (const b of tabsEl.children) b.classList.toggle('on', b.dataset.tab === tab);
    junkBtn.hidden = tab !== 'sell';
    listEl.textContent = '';
    if (tab === 'buy') {
      W.shop.stock.forEach((s, i) => { const it = BY_ID[s.id], price = buyPrice(it, cfg); listEl.appendChild(row(it, s.n, it.stats ? statLine(it) : it.text || '', price, 'Купить', () => { const r = buyItem(W, i); if (r === 'ash') flash('Не хватает пепла'); else if (r === 'full') flash('Сумка полна'); else if (r === 'far') flash('Подойдите к торговцу'); }, W.inv.ash >= price, betterThanWorn(W.inv, it) ? '▲' : '')); });
      if (!W.shop.stock.length) listEl.appendChild(el('div', 'emptyl', 'Всё раскуплено. Витрина обновится позже.'));
    } else {
      const rows = W.inv.bag.map((s, i) => ({ s, i, it: BY_ID[s.id] })).sort((a, b) => b.it.rar - a.it.rar || a.it.name.localeCompare(b.it.name, 'ru'));
      for (const r of rows) {
        const key = r.s.id + ':' + r.i;
        const risky = r.it.rar >= 3 && armed !== key;
        listEl.appendChild(row(r.it, r.s.n, r.it.stats ? statLine(r.it) : r.it.text || '', sellPrice(r.it, cfg, r.s.up || 0, W.gear.trade) * r.s.n, risky ? 'Продать?' : (r.s.n > 1 ? 'Всё' : 'Продать'), () => {
          if (risky) { armed = key; setTimeout(() => { armed = null; render(); }, 2500); return; }
          armed = null; const res = sellItem(W, r.i, r.s.n); if (res === 'far') flash('Подойдите к торговцу');
        }, true, '', r.s.up || 0));
      }
      if (!rows.length) listEl.appendChild(el('div', 'emptyl', 'Сумка пуста.'));
    }
  }
  junkBtn.addEventListener('click', () => { const sum = sellJunk(W); flash(sum < 0 ? 'Подойдите к торговцу' : sum ? `Хлам продан за ${sum}` : 'Хлама нет'); render(); onChange && onChange(); });
  const open = () => { tab = 'buy'; render(); root.hidden = false; onOpen && onOpen(); };
  const close = () => { root.hidden = true; onClose && onClose(); };
  $('shopClose').addEventListener('click', close);
  return { open, close, render, isOpen: () => !root.hidden };
}

// Кузнец: улучшение надетого и лежащего в сумке снаряжения до +5
export function createSmith(doc, W, cfg, { onOpen, onClose, onChange } = {}) {
  const $ = id => doc.getElementById(id);
  const root = $('smith'), listEl = $('smithList'), headEl = $('smithHead'), flashEl = $('smithFlash');
  let flashT = 0;
  const el = (tag, cls, txt) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const flash = t => { flashEl.textContent = t; clearTimeout(flashT); flashT = setTimeout(() => { flashEl.textContent = ''; }, 2200); };
  function rowFor(id, lvl, where, tag) {
    const it = BY_ID[id], max = lvl >= cfg.smith.max, cost = upgradeCost(it, lvl, cfg);
    const r = el('div', 'srow'), info = el('div', 'sinfo');
    const nm = el('span', 'nm', nameOf(id, lvl)); nm.style.color = RARITY[it.rar].color; info.append(nm, el('span', 'up', tag));
    info.append(el('div', 'sub', (statLine(it) || '') + (max ? ' · предел' : ` · +${lvl} → +${lvl + 1}: статы +${Math.round(cfg.smith.bonus * 100)}%`)));
    const b = el('button', 'buy' + (max || W.inv.ash < cost ? ' no' : ''), max ? 'Максимум' : `Улучшить · ${cost}`); b.type = 'button';
    b.addEventListener('click', () => { const res = upgradeItem(W, where); if (res === 'ash') flash('Не хватает пепла'); else if (res === 'max') flash('Выше некуда'); else if (res === 'far') flash('Подойдите к кузнецу'); render(); onChange && onChange(); });
    r.append(info, b); return r;
  }
  function render() {
    refreshGear(W);
    headEl.textContent = `Кузнец · пепел ${W.inv.ash}`; listEl.textContent = '';
    let n = 0;
    for (const slot of SLOTS) { const id = W.inv.eq[slot]; if (id) { listEl.appendChild(rowFor(id, W.inv.up[slot] || 0, { slot }, SLOT_NAME[slot] + ' · надето')); n++; } }
    W.inv.bag.forEach((s, i) => { if (BY_ID[s.id].slot) { listEl.appendChild(rowFor(s.id, s.up || 0, { idx: i }, 'в сумке')); n++; } });
    if (!n) listEl.appendChild(el('div', 'emptyl', 'У вас нет снаряжения. Найдите или купите, потом приходите.'));
  }
  const open = () => { render(); root.hidden = false; onOpen && onOpen(); };
  const close = () => { root.hidden = true; onClose && onClose(); };
  $('smithClose').addEventListener('click', close);
  return { open, close, render, isOpen: () => !root.hidden };
}
