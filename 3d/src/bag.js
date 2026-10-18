// Сумка и экипировка: окно с надетым, списком вещей, карточкой вещи и действиями.
import { BY_ID, RARITY, SLOTS, SLOT_NAME, STAT_NAME, statLine, KIND_NAME } from './data/items.js';
import { betterThanWorn, equipAt, equipOff, unequip, scoreUp, nameOf, SET_OF, setCounts, bonusText, statDiff, bagUsed, freeItem, halfItem } from './inv.js';
import { canWield, canOff, heroOf, NOT_FOR, heavyFor } from './data/heroes3d.js';
import { iconURL, slotIconURL } from './itemicons.js';
import { PERKS } from './data/weapons3d.js';
import { useItem, dropItem, refreshGear, sellItem, sellPrice, bagSlots } from './sim.js';
import { readTome } from './craft3d.js';
import { socketsOf } from './inv.js';
import { weaponMix, armorGemFx } from './stones3d.js';
import { skillOfItem } from './weaponskill3d.js';
import { MIX_NAME, ELEMENT_NAME, mixKey } from './elements3d.js';

const TABS = [['all', 'Всё'], ['weapon', 'Оружие'], ['armor', 'Броня'], ['use', 'Расходное'], ['other', 'Прочее']];
const tabOf = it => it.slot === 'weapon' ? 'weapon' : it.slot ? 'armor' : it.cat === 'consumable' ? 'use' : 'other';

export function createBag(doc, W, cfg, { onChange, onOpen, onClose, onReset, onJournal, onQuests } = {}) {
  const desk = doc.documentElement.hasAttribute('data-desk');
  const $ = id => doc.getElementById(id);
  const root = $('bag'), eqEl = $('bagEq'), listEl = $('bagList'), cardEl = $('bagCard'), tabsEl = $('bagTabs'), statsEl = $('bagStats'), headEl = $('bagHead');
  let tab = 'all', sel = null;       // sel: {from:'bag', i} | {from:'eq', slot}

  const el = (tag, cls, txt) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const nm = (it, n, up = 0) => { const s = el('span', 'nm', nameOf(it.id, up) + (n > 1 ? ' ×' + n : '')); s.style.color = RARITY[it.rar].color; return s; };
  // значок вещи (пиксельный, 16×16, растягивается без размытия) и пустой слот
  const icon = (it, cls = 'ic') => { const i = el('img', cls); i.alt = ''; i.src = iconURL(doc, it); i.draggable = false; return i; };
  const fmt = (k, v) => (k === 'swing' ? (v < 1 ? 'быстрая' : v > 1 ? 'медленная' : 'обычная') : k === 'reach' ? (v > 0 ? '+' : '') + Number(v).toFixed(1) : String(v));

  for (const [id, label] of TABS) { const b = el('button', 'tab', label); b.type = 'button'; b.dataset.tab = id; b.addEventListener('click', () => { tab = id; sel = null; render(); }); tabsEl.appendChild(b); }

  // сводка героя: пары «название — значение» (шаг «сумка как в MMO»)
  function stats() {
    const g = W.gear, P = cfg.player, p = W.player, rows = [['Уровень', W.lv], ['Урон', Math.round(P.attackDamage + g.dmg)], ['Броня', g.armor], ['Здоровье', `${Math.ceil(p.hp)}/${p.maxhp}`], ['Крит', Math.round(12 + g.crit) + '%']];
    if (g.spd) rows.push(['Скорость', (g.spd > 0 ? '+' : '') + g.spd + '%']);
    if (g.leech) rows.push(['Вампиризм', g.leech + '%']);
    if (g.luck) rows.push(['Удача', g.luck]);
    if (g.reach) rows.push(['Дальность', (g.reach > 0 ? '+' : '') + g.reach.toFixed(1)]);
    for (const c of setCounts(W.inv)) if (c.n >= 2) rows.push([`Сет «${c.set.name}»`, c.n + '/4']);
    const ks = Object.keys(W.keys || {}).filter(k => W.keys[k]).map(k => (cfg.dungeons.keys || {})[k] || k);
    statsEl.textContent = '';
    for (const [k, v] of rows) { const r = el('div', 'bs'); r.append(el('span', 'bk', k), el('span', 'bv', String(v))); statsEl.appendChild(r); }
    if (ks.length) statsEl.appendChild(el('div', 'bkeys', 'Ключи: ' + ks.join(', ')));       // связка ключей подземелий
  }
  // силуэт героя между слотами «куклы»
  const FIG = '<svg viewBox="0 0 60 120" aria-hidden="true"><g fill="currentColor"><circle cx="30" cy="16" r="10"/><path d="M16 30h28l5 36h-9l-2 50h-8l-1-34h-2l-1 34h-8l-2-50h-9z"/><path d="M14 31l-8 32 6 2 9-26zM46 31l8 32-6 2-9-26z"/></g></svg>';
  // подсказка при наведении (компьютер): название, редкость, статы со сравнением с надетым
  const tipEl = $('bagTip');
  // гнёзда и сплав камней силы: «Гнёзда 1/2: Камень огня · Сплав: Лава»
  function gemLine(it, g) {
    const n = socketsOf(it, cfg); if (!n) return null;
    const list = Array.from({ length: n }, (_, i) => (g && g[i] ? BY_ID[g[i]].name : 'пусто')), m = it.slot === 'weapon' ? weaponMix(it, g) : null;
    if (it.slot !== 'weapon') { const fx = (g || []).filter(Boolean).map(id => armorGemFx(BY_ID[id], cfg)); return el('div', 'gems', `Гнёзда ${(g || []).filter(Boolean).length}/${n}: ${list.join(', ')}${fx.length ? ' · ' + fx.join('; ') : ''}`); }     // броня
    const mix = !m ? '' : m.b ? ` · сплав «${MIX_NAME[mixKey(m.a, m.b)]}»` : ` · стихия: ${ELEMENT_NAME[m.a].toLowerCase()}`;
    return el('div', 'gems', `Гнёзда ${(g || []).filter(Boolean).length}/${n}: ${list.join(', ')}${mix}`);
  }
  // умение оружия у клеймёного и золотого: «Умение (F): Жатва — …»
  function skillLine(it) { const s = skillOfItem(it, cfg); return s ? el('div', 'wskl', `Умение${desk ? ' (F)' : ''}: ${s.name}${s.gold ? ', золотое — сильнее и с «Солнцем»' : ''}. ${s.text}`) : null; }
  function tip(e, it, up, worn, g) {
    tipEl.textContent = ''; tipEl.className = 'r' + it.rar;
    tipEl.append(nm(it, 1, up), el('div', 'rr', RARITY[it.rar].name + (it.slot ? ' · ' + SLOT_NAME[it.slot] : '')));
    { const gl = gemLine(it, g); if (gl) tipEl.appendChild(gl); const sl = skillLine(it); if (sl) tipEl.appendChild(sl); }
    if (it.stats) for (const r of statDiff(it, worn, up, worn ? W.inv.up[it.slot] || 0 : 0, cfg.smith.bonus)) {
      if (!worn && !(r.k in it.stats)) continue;
      const row = el('div', 'str' + (r.d > 0 ? ' up' : r.d < 0 ? ' down' : '')); row.append(el('span', 'sk', r.name), el('span', 'sv', worn ? `${fmt(r.k, r.a)} → ${fmt(r.k, r.b)}` : fmt(r.k, r.b)), el('span', 'sd', r.d > 0 ? '▲' : r.d < 0 ? '▼' : '')); tipEl.appendChild(row);
    } else if (it.text) tipEl.appendChild(el('div', 'ct', it.text));
    if (!canWield(W.hero, it)) tipEl.appendChild(el('div', 'cmp down', NOT_FOR[W.hero]));
    tipEl.appendChild(el('div', 'hint', it.slot && canWield(W.hero, it) ? 'Двойной щелчок — надеть' : it.use ? 'Двойной щелчок — использовать' : 'Щелчок — подробно'));
    tipEl.hidden = false; moveTip(e);
  }
  function moveTip(e) { const r = tipEl.getBoundingClientRect(), x = Math.min(innerWidth - r.width - 8, e.clientX + 16), y = Math.min(innerHeight - r.height - 8, e.clientY + 12); tipEl.style.left = Math.max(8, x) + 'px'; tipEl.style.top = Math.max(8, y) + 'px'; }
  const hideTip = () => { tipEl.hidden = true; };
  // надеть или использовать сразу (двойной щелчок, долгое касание)
  function quick(i) { const s = W.inv.bag[i], it = s && BY_ID[s.id]; if (!it) return; if (it.slot && canWield(W.hero, it)) { if (equipAt(W.inv, i, W.hero)) sel = null; } else if (it.use) { if (!useItem(W, i)) flash('Сейчас не нужно'); } hideTip(); render(); onChange && onChange(); }
  function hoverable(b, get) {
    b.addEventListener('mouseenter', e => { const g = get(); if (g) tip(e, g.it, g.up, g.worn, g.g); });
    b.addEventListener('mousemove', e => { if (!tipEl.hidden) moveTip(e); });
    b.addEventListener('mouseleave', hideTip);
  }
  // выбор вещи в слот (2026-10-18): нажатие на пустой слот или «Заменить» — список подходящих вещей из сумки; во вторую руку — щит или второй клинок
  const fits = (slot, it) => !!it && (slot === 'offhand' ? canOff(W.hero, it) : it.slot === slot && canWield(W.hero, it));
  function pickCard(slot) {
    cardEl.className = 'pick'; const h = el('div', 'ch'), t = el('div', 'cht');
    t.append(el('div', 'cn', SLOT_NAME[slot]), el('div', 'rr', slot === 'offhand' ? (heroOf(W.hero).off.length ? 'Во вторую руку: ' + (heroOf(W.hero).off.includes('shield') ? 'щит' : 'второй клинок') : `${heroOf(W.hero).name} держит оружие двумя руками`) : 'Что надеть'));
    h.append(t); { const x = el('button', 'cclose', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Закрыть'); x.addEventListener('click', () => { sel = null; render(); }); h.append(x); }
    cardEl.appendChild(h);
    const list = W.inv.bag.map((s, i) => ({ s, i, it: BY_ID[s.id] })).filter(r => fits(slot, r.it)).sort((a, b) => scoreUp(b.it, b.s.up || 0, cfg.smith.bonus) - scoreUp(a.it, a.s.up || 0, cfg.smith.bonus));
    if (!list.length) cardEl.appendChild(el('div', 'emptyl', 'В сумке нет подходящих вещей.'));
    for (const r of list) { const row = el('button', 'pickrow r' + r.it.rar); row.type = 'button'; row.append(icon(r.it), el('span', 'pn', nameOf(r.it.id, r.s.up || 0)), el('span', 'ps', r.it.stats ? statLine(r.it) : ''));
      row.addEventListener('click', () => { const okk = slot === 'offhand' && r.it.slot === 'weapon' ? equipOff(W.inv, r.i, W.hero) : equipAt(W.inv, r.i, W.hero); if (okk) sel = null; render(); onChange && onChange(); });
      if (desk) hoverable(row, () => ({ it: r.it, up: r.s.up || 0, g: r.s.g, worn: W.inv.eq[slot] ? BY_ID[W.inv.eq[slot]] : null }));
      cardEl.appendChild(row); }
  }
  function card() {
    cardEl.textContent = ''; cardEl.hidden = !sel && !desk;
    if (!sel) { if (desk) { cardEl.className = 'idle'; cardEl.append(el('div', 'cph', 'Наведите на вещь — подсказка со сравнением. Щелчок — подробно и действия. Двойной щелчок — надеть или использовать.')); } return; }
    if (sel.from === 'pick') { pickCard(sel.slot); return; }
    const id = sel.from === 'eq' ? W.inv.eq[sel.slot] : (W.inv.bag[sel.i] || {}).id, it = id && BY_ID[id];
    if (!it) { sel = null; cardEl.hidden = true; return; }
    const n = sel.from === 'bag' ? W.inv.bag[sel.i].n : 1, up = sel.from === 'eq' ? W.inv.up[sel.slot] || 0 : W.inv.bag[sel.i].up || 0;
    cardEl.className = 'r' + it.rar;
    const h = el('div', 'ch'), t = el('div', 'cht'); h.append(icon(it, 'ic big'));
    t.append(nm(it, n, up), el('div', 'rr', RARITY[it.rar].name + (it.slot ? ' · ' + SLOT_NAME[it.slot] : ''))); h.append(t);
    { const x = el('button', 'cclose', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Закрыть'); x.addEventListener('click', () => { sel = null; render(); }); h.append(x); }
    cardEl.appendChild(h);
    { const gl = gemLine(it, sel.from === 'eq' ? W.inv.gem[sel.slot] : W.inv.bag[sel.i].g); if (gl) cardEl.appendChild(gl); const sl = skillLine(it); if (sl) cardEl.appendChild(sl); }
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
    if (!mine) cardEl.appendChild(el('div', 'cmp down', heavyFor(W.hero, it) ? `${NOT_FOR[W.hero]}: тяжёлая броня, ${heroOf(W.hero).name} носит только лёгкую. Можно продать торговцу.` : `${NOT_FOR[W.hero]}: ${heroOf(W.hero).name} держит ${heroOf(W.hero).kinds.map(k => KIND_NAME[k]).join(', ')}. Можно продать торговцу.`));
    if (it.slot && sel.from === 'bag' && mine) {
      const cur = W.inv.eq[it.slot], c = cur && BY_ID[cur];
      if (c) { const d = Math.round(scoreUp(it, up, cfg.smith.bonus) - scoreUp(c, W.inv.up[it.slot] || 0, cfg.smith.bonus)); cardEl.appendChild(el('div', 'cmp ' + (d > 0 ? 'up' : d < 0 ? 'down' : ''), `Надето: ${c.name} — в целом ${d > 0 ? 'лучше на ' + d : d < 0 ? 'хуже на ' + -d : 'так же'}`)); }
      else cardEl.appendChild(el('div', 'cmp up', 'Слот пуст'));
    }
    const st = SET_OF[it.id];
    if (st && (!W.path || W.path.sets || !(cfg.path && cfg.path.on))) {     // блок сета — после 2 вещей одного сета (шаг 13)
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
    if (sel.from === 'eq' && W.inv.bag.some(s => fits(sel.slot, BY_ID[s.id]))) btn('Заменить', () => { sel = { from: 'pick', slot: sel.slot }; });
    else {
      if (it.slot && mine) btn('Надеть', () => { if (equipAt(W.inv, sel.i, W.hero)) sel = null; }, 'main');
      if (it.slot === 'weapon' && canOff(W.hero, it)) btn('Во вторую руку', () => { if (equipOff(W.inv, sel.i, W.hero)) sel = null; }, 'main');
      if (it.cat === 'tome') btn('Прочитать', () => { const r = readTome(W, sel.i); if (r === 'known') flash('Эта книга уже прочитана'); else sel = null; }, 'main');
      if (it.use) btn('Использовать', () => { if (!useItem(W, sel.i)) flash('Сейчас не нужно'); else if (!W.inv.bag[sel.i] || W.inv.bag[sel.i].id !== it.id) sel = null; }, 'main');
      btn(`Продать · ${sellPrice(it, cfg, up, W.gear.trade) * n}`, () => { if (sellItem(W, sel.i, n) === 'far') flash('Продавать можно только у торговца'); else sel = null; });
      if (n > 1) btn(`Продать 1 · ${sellPrice(it, cfg, up, W.gear.trade)}`, () => { if (sellItem(W, sel.i, 1) === 'far') flash('Продавать можно только у торговца'); });
      btn('Выбросить', () => { dropItem(W, sel.i, n); sel = null; });
    }
    cardEl.insertBefore(row, cardEl.children[1] || null);      // кнопки — сразу под названием: у длинной карточки их видно без прокрутки
  }
  let flashT = 0; function flash(t) { const f = $('bagFlash'); f.textContent = t; clearTimeout(flashT); flashT = setTimeout(() => { f.textContent = ''; }, 1800); }

  function render() {
    refreshGear(W); hideTip();
    const cap = bagSlots(W), n = bagUsed(W.inv);
    headEl.textContent = 'Сумка';
    stats();
    $('bagAsh').textContent = `Пепел: ${W.inv.ash}`;
    { const c = $('bagCap'); c.dataset.t = `Место: ${n}/${cap}`; c.className = n >= cap ? 'full' : n >= cap * .8 ? 'warn' : ''; c.firstChild.style.width = Math.min(100, n / cap * 100) + '%'; }
    for (const b of tabsEl.children) b.classList.toggle('on', b.dataset.tab === tab);
    // «кукла»: слоты вокруг силуэта героя
    eqEl.textContent = '';
    { const fig = el('div', 'fig'); fig.innerHTML = FIG; fig.append(el('div', 'fign', `${heroOf(W.hero).name} · ур. ${W.lv}`)); eqEl.appendChild(fig); }
    for (const slot of SLOTS) {
      const id = W.inv.eq[slot], it = id && BY_ID[id], up = W.inv.up[slot] || 0;
      const b = el('button', 'slot' + (it ? ' r' + it.rar : ' none') + (sel && sel.from === 'eq' && sel.slot === slot ? ' sel' : '')); b.type = 'button'; b.style.gridArea = slot;
      if (it) { b.append(icon(it)); b.dataset.item = it.id; } else { const i = el('img', 'ic ghost'); i.alt = ''; i.src = slotIconURL(doc, slot); b.append(i); }
      if (it && up) b.append(el('span', 'upg', '+' + up));
      b.append(el('span', 'sl', SLOT_NAME[slot]));
      b.setAttribute('aria-label', it ? SLOT_NAME[slot] + ': ' + nameOf(it.id, up) : SLOT_NAME[slot] + ': пусто');
      if (it) hoverable(b, () => ({ it, up, worn: null, g: W.inv.gem[slot] }));
      b.addEventListener('click', () => { sel = it ? { from: 'eq', slot } : { from: 'pick', slot }; render(); });     // пустой слот — список подходящих вещей
      eqEl.appendChild(b);
    }
    // сетка сумки: вещи (лучшие сверху), во вкладке «Всё» — ещё пустые ячейки до вместимости
    listEl.textContent = '';
    const rows = W.inv.bag.map((s, i) => ({ s, i, it: BY_ID[s.id] })).filter(r => tab === 'all' || tabOf(r.it) === tab).sort((a, b) => b.it.rar - a.it.rar || a.it.name.localeCompare(b.it.name, 'ru'));
    if (!rows.length && tab !== 'all') listEl.appendChild(el('div', 'emptyl', 'В этой вкладке пусто.'));
    const freeTiles = []; let pend = null;
    for (const r of rows) {
      const b = el('button', 'tile r' + r.it.rar + (sel && sel.from === 'bag' && sel.i === r.i ? ' sel' : '')); b.type = 'button';
      b.append(icon(r.it));
      if (r.s.n > 1) b.append(el('span', 'cnt', '×' + r.s.n));
      if (r.s.up) b.append(el('span', 'upg', '+' + r.s.up));
      const mine = canWield(W.hero, r.it);
      if (!mine) { b.classList.add('nw'); b.append(el('span', 'bt no', '✕')); } else if (betterThanWorn(W.inv, r.it)) b.append(el('span', 'bt', '▲'));
      b.dataset.item = r.it.id;     // G — где взять
      b.title = nameOf(r.it.id, r.s.up || 0) + (r.s.n > 1 ? ' ×' + r.s.n : '') + (r.it.stats ? ' — ' + statLine(r.it) : '') + (mine ? '' : ' — ' + NOT_FOR[W.hero]);
      b.setAttribute('aria-label', b.title);
      if (desk) { b.removeAttribute('title'); hoverable(b, () => ({ it: r.it, up: r.s.up || 0, g: r.s.g, worn: r.it.slot && W.inv.eq[r.it.slot] ? BY_ID[W.inv.eq[r.it.slot]] : null })); }
      b.addEventListener('click', () => { sel = { from: 'bag', i: r.i }; render(); });
      b.addEventListener('dblclick', () => quick(r.i));
      { let lp = 0; b.addEventListener('pointerdown', e => { if (e.pointerType !== 'touch') return; lp = setTimeout(() => { lp = 0; quick(r.i); }, 450); });     // долгое касание — надеть или использовать
        for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => { if (lp) clearTimeout(lp); lp = 0; }); }
      if (freeItem(r.it)) { b.classList.add('free'); freeTiles.push(b); continue; }     // ключи и камни — отдельной полосой, места не занимают
      if (halfItem(r.it)) { b.classList.add('half'); if (pend) { pend.append(b); pend = null; } else { pend = el('div', 'pair'); pend.append(b); listEl.appendChild(pend); } continue; }     // два расходника — в одной клетке
      listEl.appendChild(b);
    }
    if (tab === 'all') for (let k = n; k < cap; k++) listEl.appendChild(el('div', 'tile empty'));
    if (freeTiles.length) { listEl.appendChild(el('div', 'freeh', 'Ключи и камни — не занимают места')); for (const t of freeTiles) listEl.appendChild(t); }
    card();
  }
  const open = () => { sel = null; render(); root.hidden = false; onOpen && onOpen(); };
  const close = () => { root.hidden = true; hideTip(); onClose && onClose(); };
  $('bagBtn').addEventListener('click', () => (root.hidden ? open() : close()));
  $('bagClose').addEventListener('click', close);
  $('bagQuests').addEventListener('click', () => { close(); onQuests && onQuests(); });
  $('bagJournal').addEventListener('click', () => { close(); onJournal && onJournal(); });
  return { open, close, render, isOpen: () => !root.hidden };
}
