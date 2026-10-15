// Сумка и экипировка: окно с надетым, списком вещей, карточкой вещи и действиями.
import { BY_ID, RARITY, SLOTS, SLOT_NAME, STAT_NAME, statLine, KIND_NAME } from './data/items.js';
import { betterThanWorn, equipAt, equipOff, unequip, scoreUp, nameOf, SET_OF, setCounts, bonusText, statDiff } from './inv.js';
import { canWield, canOff, heroOf, NOT_FOR } from './data/heroes3d.js';
import { iconURL, slotIconURL } from './itemicons.js';
import { PERKS } from './data/weapons3d.js';
import { useItem, dropItem, refreshGear, sellItem, sellPrice, bagSlots } from './sim.js';
import { readTome } from './craft3d.js';

const TABS = [['all', 'Всё'], ['weapon', 'Оружие'], ['armor', 'Броня'], ['use', 'Расходное'], ['other', 'Прочее']];
const tabOf = it => it.slot === 'weapon' ? 'weapon' : it.slot ? 'armor' : it.cat === 'consumable' ? 'use' : 'other';

export function createBag(doc, W, cfg, { onChange, onOpen, onClose, onReset, onJournal, onQuests } = {}) {
  const $ = id => doc.getElementById(id);
  const root = $('bag'), eqEl = $('bagEq'), listEl = $('bagList'), cardEl = $('bagCard'), tabsEl = $('bagTabs'), statsEl = $('bagStats'), headEl = $('bagHead');
  let tab = 'all', sel = null, resetArmed = false;       // sel: {from:'bag', i} | {from:'eq', slot}

  const el = (tag, cls, txt) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const nm = (it, n, up = 0) => { const s = el('span', 'nm', nameOf(it.id, up) + (n > 1 ? ' ×' + n : '')); s.style.color = RARITY[it.rar].color; return s; };
  // значок вещи (пиксельный, 16×16, растягивается без размытия) и пустой слот
  const icon = (it, cls = 'ic') => { const i = el('img', cls); i.alt = ''; i.src = iconURL(doc, it); i.draggable = false; return i; };
  const fmt = (k, v) => (k === 'swing' ? (v < 1 ? 'быстрая' : v > 1 ? 'медленная' : 'обычная') : k === 'reach' ? (v > 0 ? '+' : '') + Number(v).toFixed(1) : String(v));

  for (const [id, label] of TABS) { const b = el('button', 'tab', label); b.type = 'button'; b.dataset.tab = id; b.addEventListener('click', () => { tab = id; sel = null; render(); }); tabsEl.appendChild(b); }

  function stats() {
    const g = W.gear, P = cfg.player, p = W.player;
    const parts = [`Урон ${Math.round(P.attackDamage + g.dmg)}`, `Броня ${g.armor}`, `Здоровье ${Math.ceil(p.hp)}/${p.maxhp}`];
    if (g.spd) parts.push(`Скорость ${g.spd > 0 ? '+' : ''}${g.spd}%`);
    parts.push(`Крит ${Math.round(12 + g.crit)}%`);
    for (const c of setCounts(W.inv)) if (c.n >= 2) parts.push(`«${c.set.name}» ${c.n}/4`);
    parts.splice(1, 0, `Ур. ${W.lv}`);
    if (g.leech) parts.push(`Вампиризм ${g.leech}%`);
    if (g.luck) parts.push(`Удача ${g.luck}`);
    if (g.reach) parts.push(`Дальность ${g.reach > 0 ? '+' : ''}${g.reach.toFixed(1)}`);
    const ks = Object.keys(W.keys || {}).filter(k => W.keys[k]).map(k => (cfg.dungeons.keys || {})[k] || k);
    if (ks.length) parts.push('🗝 ' + ks.join(', '));                     // связка ключей подземелий
    return parts.join(' · ');
  }

  function card() {
    cardEl.textContent = ''; cardEl.hidden = !sel; if (!sel) return;
    const id = sel.from === 'eq' ? W.inv.eq[sel.slot] : (W.inv.bag[sel.i] || {}).id, it = id && BY_ID[id];
    if (!it) { sel = null; cardEl.hidden = true; return; }
    const n = sel.from === 'bag' ? W.inv.bag[sel.i].n : 1, up = sel.from === 'eq' ? W.inv.up[sel.slot] || 0 : W.inv.bag[sel.i].up || 0;
    cardEl.className = 'r' + it.rar;
    const h = el('div', 'ch'), t = el('div', 'cht'); h.append(icon(it, 'ic big'));
    t.append(nm(it, n, up), el('div', 'rr', RARITY[it.rar].name + (it.slot ? ' · ' + SLOT_NAME[it.slot] : ''))); h.append(t); cardEl.appendChild(h);
    // характеристики: у вещи из сумки — рядом с надетым (было → стало), стрелка — лучше или хуже
    const worn = it.slot && sel.from === 'bag' && W.inv.eq[it.slot] ? BY_ID[W.inv.eq[it.slot]] : null;
    if (it.stats) {
      const g = el('div', 'stg');
      for (const r of statDiff(it, worn, up, worn ? W.inv.up[it.slot] || 0 : 0, cfg.smith.bonus)) {
        if (!worn && !(r.k in it.stats)) continue;
        const row = el('div', 'str' + (r.d > 0 ? ' up' : r.d < 0 ? ' down' : ''));
        row.append(el('span', 'sk', r.name), el('span', 'sv', worn ? `${fmt(r.k, r.a)} → ${fmt(r.k, r.b)}` : fmt(r.k, r.b)), el('span', 'sd', r.d > 0 ? '▲' : r.d < 0 ? '▼' : ''));
        g.appendChild(row);
      }
      cardEl.appendChild(g);
    }
    const mine = canWield(W.hero, it);
    if (!mine) cardEl.appendChild(el('div', 'cmp down', `${NOT_FOR[W.hero]}: ${heroOf(W.hero).name} держит ${heroOf(W.hero).kinds.map(k => KIND_NAME[k]).join(', ')}. Можно продать торговцу.`));
    if (it.slot && sel.from === 'bag' && mine) {
      const cur = W.inv.eq[it.slot], c = cur && BY_ID[cur];
      if (c) { const d = Math.round(scoreUp(it, up, cfg.smith.bonus) - scoreUp(c, W.inv.up[it.slot] || 0, cfg.smith.bonus)); cardEl.appendChild(el('div', 'cmp ' + (d > 0 ? 'up' : d < 0 ? 'down' : ''), `Надето: ${c.name} — в целом ${d > 0 ? 'лучше на ' + d : d < 0 ? 'хуже на ' + -d : 'так же'}`)); }
      else cardEl.appendChild(el('div', 'cmp up', 'Слот пуст'));
    }
    const st = SET_OF[it.id];
    if (st) {
      const n = (setCounts(W.inv).find(c => c.set === st) || { n: 0 }).n;
      const box = el('div', 'setbox'); box.append(el('div', 'setname', `Сет «${st.name}» ${n}/4`));
      for (const [need, b] of [[2, st.b2], [4, st.b4]]) box.append(el('div', 'setline' + (n >= need ? ' on' : ''), `${need} части: ${bonusText(b)}`));
      cardEl.appendChild(box);
    }
    if (it.perks && it.perks.length) cardEl.appendChild(el('div', 'cs', 'Свойства: ' + it.perks.map(id => PERKS[id].name).join(', ')));
    if (it.text) cardEl.appendChild(el('div', 'ct', it.text));
    cardEl.appendChild(el('div', 'cv', `Продажа: ${sellPrice(it, cfg, up, W.gear.trade)} пепла (только у торговца)`));
    const row = el('div', 'acts');
    const btn = (label, fn, cls) => { const b = el('button', cls || '', label); b.type = 'button'; b.addEventListener('click', () => { fn(); render(); onChange && onChange(); }); row.appendChild(b); };
    if (sel.from === 'eq') btn('Снять', () => { if (!unequip(W.inv, sel.slot, bagSlots(W))) flash('Сумка полна'); else sel = null; }, 'main');
    else {
      if (it.slot && mine) btn('Надеть', () => { if (equipAt(W.inv, sel.i, W.hero)) sel = null; }, 'main');
      if (it.slot === 'weapon' && canOff(W.hero, it)) btn('Во вторую руку', () => { if (equipOff(W.inv, sel.i, W.hero)) sel = null; }, 'main');
      if (it.cat === 'tome') btn('Прочитать', () => { const r = readTome(W, sel.i); if (r === 'known') flash('Эта книга уже прочитана'); else sel = null; }, 'main');
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
    headEl.textContent = `Сумка ${W.inv.bag.length}/${bagSlots(W)} · пепел ${W.inv.ash}`;
    statsEl.textContent = stats();
    for (const b of tabsEl.children) b.classList.toggle('on', b.dataset.tab === tab);
    // надетое
    eqEl.textContent = '';
    for (const slot of SLOTS) {
      const id = W.inv.eq[slot], it = id && BY_ID[id];
      const b = el('button', 'slot' + (it ? ' r' + it.rar : ' none') + (sel && sel.from === 'eq' && sel.slot === slot ? ' sel' : '')); b.type = 'button';
      if (it) b.append(icon(it)); else { const i = el('img', 'ic ghost'); i.alt = ''; i.src = slotIconURL(doc, slot); b.append(i); }
      const tx = el('span', 'stx'); tx.append(el('span', 'sl', SLOT_NAME[slot]));
      if (it) tx.append(nm(it, 1, W.inv.up[slot] || 0)); else tx.append(el('span', 'nm empty', 'пусто'));
      b.append(tx); b.title = it ? nameOf(it.id, W.inv.up[slot] || 0) : SLOT_NAME[slot] + ': пусто';
      b.addEventListener('click', () => { if (it) { sel = { from: 'eq', slot }; render(); } });
      eqEl.appendChild(b);
    }
    // вещи: по редкости (лучшие сверху), внутри — по названию
    listEl.textContent = '';
    const rows = W.inv.bag.map((s, i) => ({ s, i, it: BY_ID[s.id] })).filter(r => tab === 'all' || tabOf(r.it) === tab).sort((a, b) => b.it.rar - a.it.rar || a.it.name.localeCompare(b.it.name, 'ru'));
    if (!rows.length) listEl.appendChild(el('div', 'emptyl', W.inv.bag.length ? 'В этой вкладке пусто.' : 'Сумка пуста. Ищите сундуки, бочки и могилы, обшаривайте дома.'));
    for (const r of rows) {
      const b = el('button', 'tile r' + r.it.rar + (sel && sel.from === 'bag' && sel.i === r.i ? ' sel' : '')); b.type = 'button';
      b.append(icon(r.it));
      if (r.s.n > 1) b.append(el('span', 'cnt', '×' + r.s.n));
      if (r.s.up) b.append(el('span', 'upg', '+' + r.s.up));
      const mine = canWield(W.hero, r.it);
      if (!mine) { b.classList.add('nw'); b.append(el('span', 'bt no', '✕')); } else if (betterThanWorn(W.inv, r.it)) b.append(el('span', 'bt', '▲'));
      b.title = nameOf(r.it.id, r.s.up || 0) + (r.s.n > 1 ? ' ×' + r.s.n : '') + (r.it.stats ? ' — ' + statLine(r.it) : '') + (mine ? '' : ' — ' + NOT_FOR[W.hero]);
      b.setAttribute('aria-label', b.title);
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
  $('bagQuests').addEventListener('click', () => { close(); onQuests && onQuests(); });
  $('bagJournal').addEventListener('click', () => { close(); onJournal && onJournal(); });
  return { open, close, render, isOpen: () => !root.hidden };
}
