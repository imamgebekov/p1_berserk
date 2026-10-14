// Сумка и экипировка: окно с надетым, списком вещей, карточкой вещи и действиями.
import { BY_ID, RARITY, SLOTS, SLOT_NAME, STAT_NAME, statLine } from './data/items.js';
import { betterThanWorn, equipAt, unequip, score, nameOf } from './inv.js';
import { PERKS } from './data/weapons3d.js';
import { useItem, dropItem, refreshGear, sellItem, sellPrice } from './sim.js';

const TABS = [['all', 'Всё'], ['weapon', 'Оружие'], ['armor', 'Броня'], ['use', 'Расходное'], ['other', 'Прочее']];
const tabOf = it => it.slot === 'weapon' ? 'weapon' : it.slot ? 'armor' : it.cat === 'consumable' ? 'use' : 'other';

export function createBag(doc, W, cfg, { onChange, onOpen, onClose, onReset } = {}) {
  const $ = id => doc.getElementById(id);
  const root = $('bag'), eqEl = $('bagEq'), listEl = $('bagList'), cardEl = $('bagCard'), tabsEl = $('bagTabs'), statsEl = $('bagStats'), headEl = $('bagHead');
  let tab = 'all', sel = null, resetArmed = false;       // sel: {from:'bag', i} | {from:'eq', slot}

  const el = (tag, cls, txt) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const nm = (it, n, up = 0) => { const s = el('span', 'nm', nameOf(it.id, up) + (n > 1 ? ' ×' + n : '')); s.style.color = RARITY[it.rar].color; return s; };

  for (const [id, label] of TABS) { const b = el('button', 'tab', label); b.type = 'button'; b.dataset.tab = id; b.addEventListener('click', () => { tab = id; sel = null; render(); }); tabsEl.appendChild(b); }

  function stats() {
    const g = W.gear, P = cfg.player, p = W.player;
    const parts = [`Урон ${Math.round(P.attackDamage + g.dmg)}`, `Броня ${g.armor}`, `Здоровье ${Math.ceil(p.hp)}/${p.maxhp}`];
    if (g.spd) parts.push(`Скорость ${g.spd > 0 ? '+' : ''}${g.spd}%`);
    parts.push(`Крит ${Math.round(12 + g.crit)}%`);
    parts.splice(1, 0, `Ур. ${W.lv}`);
    if (g.leech) parts.push(`Вампиризм ${g.leech}%`);
    if (g.luck) parts.push(`Удача ${g.luck}`);
    if (g.reach) parts.push(`Дальность ${g.reach > 0 ? '+' : ''}${g.reach.toFixed(1)}`);
    return parts.join(' · ');
  }

  function card() {
    cardEl.textContent = ''; cardEl.hidden = !sel; if (!sel) return;
    const id = sel.from === 'eq' ? W.inv.eq[sel.slot] : (W.inv.bag[sel.i] || {}).id, it = id && BY_ID[id];
    if (!it) { sel = null; cardEl.hidden = true; return; }
    const n = sel.from === 'bag' ? W.inv.bag[sel.i].n : 1, up = sel.from === 'eq' ? W.inv.up[sel.slot] || 0 : W.inv.bag[sel.i].up || 0;
    const h = el('div', 'ch'); h.append(nm(it, n, sel.from === 'eq' ? W.inv.up[sel.slot] || 0 : W.inv.bag[sel.i].up || 0)); h.append(el('span', 'rr', RARITY[it.rar].name + (it.slot ? ' · ' + SLOT_NAME[it.slot] : ''))); cardEl.appendChild(h);
    if (it.stats) cardEl.appendChild(el('div', 'cs', statLine(it)));
    if (it.slot && sel.from === 'bag') {
      const cur = W.inv.eq[it.slot], c = cur && BY_ID[cur];
      if (c) { const d = Math.round(score(it) - score(c)); cardEl.appendChild(el('div', 'cmp ' + (d > 0 ? 'up' : d < 0 ? 'down' : ''), `Надето: ${c.name} (${statLine(c)}) — ${d > 0 ? 'лучше на ' + d : d < 0 ? 'хуже на ' + -d : 'так же'}`)); }
      else cardEl.appendChild(el('div', 'cmp up', 'Слот пуст'));
    }
    if (it.perks && it.perks.length) cardEl.appendChild(el('div', 'cs', 'Свойства: ' + it.perks.map(id => PERKS[id].name).join(', ')));
    if (it.text) cardEl.appendChild(el('div', 'ct', it.text));
    cardEl.appendChild(el('div', 'cv', `Продажа: ${sellPrice(it, cfg, up, W.gear.trade)} пепла (только у торговца)`));
    const row = el('div', 'acts');
    const btn = (label, fn, cls) => { const b = el('button', cls || '', label); b.type = 'button'; b.addEventListener('click', () => { fn(); render(); onChange && onChange(); }); row.appendChild(b); };
    if (sel.from === 'eq') btn('Снять', () => { if (!unequip(W.inv, sel.slot, cfg.bag.slots)) flash('Сумка полна'); else sel = null; }, 'main');
    else {
      if (it.slot) btn('Надеть', () => { equipAt(W.inv, sel.i); sel = null; }, 'main');
      if (it.use) btn('Использовать', () => { if (!useItem(W, sel.i)) flash('Сейчас не нужно'); else if (!W.inv.bag[sel.i] || W.inv.bag[sel.i].id !== it.id) sel = null; }, 'main');
      btn(`Продать · ${sellPrice(it, cfg, up, W.gear.trade) * n}`, () => { if (sellItem(W, sel.i, n) === 'far') flash('Продавать можно только у торговца'); else sel = null; });
      if (n > 1) btn(`Продать 1 · ${sellPrice(it, cfg, up, W.gear.trade)}`, () => { if (sellItem(W, sel.i, 1) === 'far') flash('Продавать можно только у торговца'); });
      btn('Выбросить', () => { dropItem(W, sel.i, n); sel = null; });
    }
    cardEl.appendChild(row);
  }
  let flashT = 0; function flash(t) { const f = $('bagFlash'); f.textContent = t; clearTimeout(flashT); flashT = setTimeout(() => { f.textContent = ''; }, 1800); }

  function render() {
    refreshGear(W);
    headEl.textContent = `Сумка ${W.inv.bag.length}/${cfg.bag.slots} · пепел ${W.inv.ash}`;
    statsEl.textContent = stats();
    for (const b of tabsEl.children) b.classList.toggle('on', b.dataset.tab === tab);
    // надетое
    eqEl.textContent = '';
    for (const slot of SLOTS) {
      const id = W.inv.eq[slot], it = id && BY_ID[id];
      const b = el('button', 'slot' + (sel && sel.from === 'eq' && sel.slot === slot ? ' sel' : '')); b.type = 'button';
      b.append(el('span', 'sl', SLOT_NAME[slot]));
      if (it) b.append(nm(it, 1, W.inv.up[slot] || 0)); else b.append(el('span', 'nm empty', '—'));
      b.addEventListener('click', () => { if (it) { sel = { from: 'eq', slot }; render(); } });
      eqEl.appendChild(b);
    }
    // вещи: по редкости (лучшие сверху), внутри — по названию
    listEl.textContent = '';
    const rows = W.inv.bag.map((s, i) => ({ s, i, it: BY_ID[s.id] })).filter(r => tab === 'all' || tabOf(r.it) === tab).sort((a, b) => b.it.rar - a.it.rar || a.it.name.localeCompare(b.it.name, 'ru'));
    if (!rows.length) listEl.appendChild(el('div', 'emptyl', W.inv.bag.length ? 'В этой вкладке пусто.' : 'Сумка пуста. Ищите сундуки, бочки и могилы, обшаривайте дома.'));
    for (const r of rows) {
      const b = el('button', 'item' + (sel && sel.from === 'bag' && sel.i === r.i ? ' sel' : '')); b.type = 'button';
      const dot = el('i', 'dot'); dot.style.background = RARITY[r.it.rar].color; b.append(dot, nm(r.it, r.s.n, r.s.up || 0));
      if (betterThanWorn(W.inv, r.it)) b.append(el('span', 'up', '▲'));
      b.append(el('span', 'sub', r.it.stats ? statLine(r.it) : r.it.use ? r.it.text : ''));
      b.addEventListener('click', () => { sel = { from: 'bag', i: r.i }; render(); });
      listEl.appendChild(b);
    }
    card();
    const rs = $('bagReset'); rs.textContent = resetArmed ? 'Точно? Всё сотрётся' : 'Сбросить прогресс'; rs.classList.toggle('warn', resetArmed);
  }
  $('bagReset').addEventListener('click', () => { if (!resetArmed) { resetArmed = true; render(); setTimeout(() => { resetArmed = false; render(); }, 3000); return; } resetArmed = false; onReset && onReset(); });
  const open = () => { sel = null; render(); root.hidden = false; onOpen && onOpen(); };
  const close = () => { root.hidden = true; onClose && onClose(); };
  $('bagBtn').addEventListener('click', () => (root.hidden ? open() : close()));
  $('bagClose').addEventListener('click', close);
  return { open, close, render, isOpen: () => !root.hidden };
}
