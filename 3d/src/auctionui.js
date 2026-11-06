// Окно аукциона (2026-11-04): вкладки «Купить», «Продать», «Мои лоты»; слева список с поиском и фильтрами, справа карточка выбранного лота.
// Логика — auction3d.js (чистая); здесь только разметка. На телефоне карточка уходит под список, всё прокручивается.
import { BY_ID, RARITY, SLOT_NAME, statLine, STAT_NAME } from './data/items.js';
import { iconURL } from './itemicons.js';
import { nameOf, ilOf, betterThanWorn } from './inv.js';
import { canWield, NOT_FOR } from './data/heroes3d.js';
import { affixLines } from './affix3d.js';
import * as A from './auction3d.js';

export function createAuction(doc, W, cfg, { onOpen, onClose, onChange } = {}) {
  const $ = id => doc.getElementById(id), K = cfg.auction;
  const root = $('auction'), bodyEl = $('aucBody'), tabsEl = $('aucTabs'), flashEl = $('aucFlash'), ashEl = $('aucAsh'), subEl = $('aucSub'), pendEl = $('aucPend');
  const el = (tag, cls, txt) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  let tab = 'buy', flashT = 0, selU = null, selBag = null, page = 1, lastKey = '';
  const F = { q: '', cat: 'all', lvMin: '', lvMax: '', rarMin: 0, pMax: '', buyOnly: false, scope: 'all', sort: 'time', dir: 'asc' };
  const S = { n: 1, start: '', buy: '', dur: 1 };     // форма «Продать»
  const flash = (t, good) => { flashEl.textContent = t; flashEl.className = good ? 'good' : ''; clearTimeout(flashT); flashT = setTimeout(() => { flashEl.textContent = ''; }, 2600); };
  const MSG = { far: 'Подойдите к аукционеру', gone: 'Лот уже ушёл', own: 'Это ваш лот', low: 'Ставка ниже минимальной', ash: 'Не хватает пепла', full: 'Сумка полна', nobuy: 'У лота нет выкупа', none: 'Нет такой вещи', locked: 'Эту вещь выставить нельзя', count: 'Столько нет в сумке', price: 'Проверьте цену: выкуп не ниже стартовой', dur: 'Неверный срок', many: 'Слишком много ваших лотов', bids: 'На лот уже есть ставка — снять нельзя' };
  const coin = () => { const c = el('span', 'tcoin'); c.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3 7-3 13-3-13z"/></svg>'; return c; };
  const money = n => { const s = el('span', 'amoney', n.toLocaleString('ru')); s.prepend(coin()); return s; };
  const ico = it => { const w = el('span', 'sico'), im = doc.createElement('img'); im.src = iconURL(doc, it); im.alt = ''; w.style.setProperty('--rc', RARITY[it.rar || 0].color); w.append(im); return w; };
  const lvTxt = e => { const it = BY_ID[e.id]; return it.slot ? `ур. ${ilOf(it, e.il)}` : it.lv ? `ур. ${it.lv}` : ''; };
  const nameFull = e => nameOf(e.id, e.up || 0) + (e.n > 1 ? ' ×' + e.n : '');
  const num = v => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n > 0 ? n : 0; };

  for (const [id, label] of [['buy', 'Купить'], ['sell', 'Продать'], ['mine', 'Мои лоты']]) { const b = el('button', 'tab', label); b.type = 'button'; b.dataset.tab = id; b.addEventListener('click', () => { tab = id; selU = null; selBag = null; page = 1; render(); }); tabsEl.append(b); }
  { const rf = el('button', 'tab rfr', 'Обновить'); rf.type = 'button'; rf.title = 'Обновить цены и лоты'; rf.addEventListener('click', () => { A.tick(W); render(); flash('Обновлено'); }); tabsEl.append(rf); }     // кнопка «Обновить» (2026-11-06): рынок и так обновляется сам, но так привычнее

  // подробности вещи: свойства, сравнение с надетым, свойства-приставки
  function details(e, into) {
    const it = BY_ID[e.id], worn = it.slot && W.inv.eq[it.slot] ? BY_ID[W.inv.eq[it.slot]] : null;
    into.append(el('div', 'sub', `${RARITY[it.rar || 0].name}${it.slot ? ' · ' + SLOT_NAME[it.slot] : ''}${it.slot && !canWield(W.hero, it) ? ' · ' + NOT_FOR[W.hero] : ''}`));
    if (it.stats) into.append(el('div', 'tdesc', statLine(it)));
    if (it.slot && worn && canWield(W.hero, it) && betterThanWorn(W.inv, it)) into.append(el('div', 'tdesc g', `Лучше надетого «${worn.name}»`));
    if (e.af) { const L = affixLines(e.af, STAT_NAME); if (L.length) into.append(el('div', 'tdesc g', L.join(' · '))); }
    if (it.text) into.append(el('div', 'tdesc t', it.text));
  }
  const field = (label, input) => { const r = el('label', 'afield'); r.append(el('span', null, label), input); return r; };
  const numIn = (val, on, ph) => { const i = el('input'); i.type = 'number'; i.inputMode = 'numeric'; i.min = '0'; i.value = val; if (ph) i.placeholder = ph; i.addEventListener('input', () => on(i.value)); return i; };

  // ---- вкладка «Купить» (и «Мои лоты» — тот же список с областью mine) ----
  function filters(box) {
    const r1 = el('div', 'afil'), q = el('input', 'asearch'); q.type = 'search'; q.placeholder = 'Поиск по названию'; q.value = F.q; q.setAttribute('aria-label', 'Поиск');
    q.addEventListener('input', () => { F.q = q.value; page = 1; refreshList(); }); r1.append(q);
    const sort = el('select', 'tsort'); sort.setAttribute('aria-label', 'Сортировка'); for (const [id, label] of A.SORTS) { const o = el('option', null, label); o.value = id; sort.append(o); } sort.value = F.sort;
    sort.addEventListener('change', () => { F.sort = sort.value; page = 1; refreshList(); });
    const dir = el('button', 'tchip', F.dir === 'asc' ? '↑' : '↓'); dir.type = 'button'; dir.setAttribute('aria-label', 'Направление'); dir.addEventListener('click', () => { F.dir = F.dir === 'asc' ? 'desc' : 'asc'; dir.textContent = F.dir === 'asc' ? '↑' : '↓'; page = 1; refreshList(); });
    const ft = el('button', 'tchip', 'Фильтры ▾'); ft.type = 'button'; ft.addEventListener('click', () => { const n = box.querySelector('.nums'); if (n) { n.classList.toggle('hid'); ft.textContent = n.classList.contains('hid') ? 'Фильтры ▾' : 'Фильтры ▴'; } });
    r1.append(sort, dir, ft); box.append(r1);
    const r2 = el('div', 'tchips');
    for (const [id, label] of A.CATS) { const b = el('button', 'tchip' + (F.cat === id ? ' on' : ''), label); b.type = 'button'; b.addEventListener('click', () => { F.cat = id; page = 1; render(); }); r2.append(b); }
    box.append(r2);
    const r3 = el('div', 'afil nums' + (F.lvMin || F.lvMax || F.pMax || F.rarMin || F.buyOnly || F.scope === 'bids' ? '' : ' hid')); const rs = el('select', 'tsort'); rs.setAttribute('aria-label', 'Редкость'); [['0', 'Любая редкость'], ...[1, 2, 3, 4, 5].map(i => [String(i), RARITY[i].name + ' и выше'])].forEach(([v, l]) => { const o = el('option', null, l); o.value = v; rs.append(o); }); rs.value = String(F.rarMin);
    rs.addEventListener('change', () => { F.rarMin = +rs.value; page = 1; refreshList(); });
    const bo = el('label', 'acheck'); const cb = el('input'); cb.type = 'checkbox'; cb.checked = F.buyOnly; cb.addEventListener('change', () => { F.buyOnly = cb.checked; page = 1; refreshList(); }); bo.append(cb, el('span', null, 'С выкупом'));
    const bids = el('button', 'tchip' + (F.scope === 'bids' ? ' on' : ''), 'Мои ставки'); bids.type = 'button'; bids.addEventListener('click', () => { F.scope = F.scope === 'bids' ? 'all' : 'bids'; page = 1; render(); });
    r3.append(numIn(F.lvMin, v => { F.lvMin = v; page = 1; refreshList(); }, 'Ур. от'), numIn(F.lvMax, v => { F.lvMax = v; page = 1; refreshList(); }, 'до'), numIn(F.pMax, v => { F.pMax = v; page = 1; refreshList(); }, 'Цена до'), rs, bo, bids); box.append(r3);
  }
  const query = scope => ({ ...F, lvMin: num(F.lvMin), lvMax: num(F.lvMax), pMax: num(F.pMax), scope });
  let listEl = null, cardEl = null, countEl = null;
  function row(l) {
    const it = BY_ID[l.e.id], b = el('button', 'arow' + (selU === l.u ? ' sel' : '') + (l.mine ? ' mine' : '') + (l.who === A.ME ? ' lead' : '')); b.type = 'button'; b.style.setProperty('--rc', RARITY[it.rar || 0].color);
    b.append(ico(it)); const info = el('span', 'ainfo'), nm = el('span', 'anm', nameFull(l.e)); nm.style.color = RARITY[it.rar || 0].color;
    info.append(nm, el('span', 'asub', `${lvTxt(l.e)}${lvTxt(l.e) ? ' · ' : ''}${l.mine ? 'ваш лот' : l.sel} · ${A.timeText(A.hoursLeft(W, l))}`)); b.append(info);
    const pr = el('span', 'aprc'); const p1 = money(A.priceOf(l)); p1.title = l.bid ? 'Текущая ставка' : 'Стартовая цена'; pr.append(p1); if (l.buy) { const p2 = money(l.buy); p2.classList.add('bo'); p2.title = 'Выкуп'; pr.append(p2); } b.append(pr);
    if (l.who === A.ME) b.append(el('span', 'abadge', 'ваша ставка')); else if (l.bid) b.append(el('span', 'abadge b', 'есть ставка'));
    b.addEventListener('click', () => { selU = l.u; markSel(); drawCard(); }); return b;
  }
  function markSel() { for (const r of listEl.children) r.classList.toggle('sel', r.dataset.u === String(selU)); }
  function refreshList() {
    const scope = tab === 'mine' ? 'mine' : F.scope, all = A.search(W, query(scope)), show = all.slice(0, page * K.page);
    listEl.textContent = ''; for (const l of show) { const r = row(l); r.dataset.u = l.u; listEl.append(r); }
    if (!show.length) listEl.append(el('div', 'emptyl', tab === 'mine' ? 'У вас нет лотов. Выставьте вещь на вкладке «Продать».' : 'Ничего не нашлось — смягчите фильтры.'));
    if (all.length > show.length) { const m = el('button', 'tchip more', `Показать ещё (${all.length - show.length})`); m.type = 'button'; m.addEventListener('click', () => { page++; refreshList(); }); listEl.append(m); }
    countEl.textContent = `Лотов: ${all.length}`; if (selU != null && !all.some(l => l.u === selU)) selU = null; drawCard();
  }
  function drawCard() {
    cardEl.textContent = ''; const l = selU != null && A.auctionOf(W).lots.find(x => x.u === selU);
    if (!l) { cardEl.append(el('div', 'sub', tab === 'mine' ? 'Выберите свой лот — можно снять, если ставок нет.' : 'Выберите лот: подробности, ставка и выкуп.')); return; }
    const it = BY_ID[l.e.id], rc = RARITY[it.rar || 0].color, head = el('div', 'ahead'), ib = ico(it); ib.classList.add('big');
    const nm = el('div', 'tsn', nameFull(l.e) + (lvTxt(l.e) ? ' · ' + lvTxt(l.e) : '')); nm.style.color = rc; head.append(ib, nm); cardEl.append(head); details(l.e, cardEl);
    const rows = el('div', 'akv'); const kv = (k, v) => { const r = el('div'); r.append(el('span', null, k), typeof v === 'string' ? el('b', null, v) : v); rows.append(r); };
    kv('Продавец', l.mine ? 'вы' : l.sel); kv('Осталось', A.timeText(A.hoursLeft(W, l))); kv(l.bid ? 'Ставка' : 'Старт', money(A.priceOf(l)));
    if (l.bid) kv('Лидирует', l.who === A.ME ? 'вы' : l.who); if (l.buy) kv('Выкуп', money(l.buy));
    const fair = A.fairOf(W, l.e); kv('Рынок', money(fair)); cardEl.append(rows);
    if (l.mine) {
      const c = el('button', 'tact sell' + (l.bid ? ' no' : ''), l.bid ? 'Есть ставка — не снять' : 'Снять лот'); c.type = 'button';
      c.addEventListener('click', () => { const r = A.cancel(W, l.u); if (r === 'ok') { flash('Лот снят, залог не возвращается', true); selU = null; changed(); } else flash(MSG[r] || r); }); cardEl.append(c); return;
    }
    const m = A.minBid(W, l), inp = numIn(String(m), () => { }); inp.className = 'abid'; cardEl.append(field(l.who === A.ME ? 'Поднять ставку до' : 'Ваша ставка', inp));
    const bb = el('button', 'tact buy' + (W.inv.ash < m - (l.who === A.ME ? l.bid : 0) ? ' no' : ''), 'Сделать ставку'); bb.type = 'button';
    bb.addEventListener('click', () => { const r = A.bid(W, l.u, num(inp.value)); if (r === 'ok') { flash('Ставка принята', true); changed(); } else if (r === 'gone') { flash(MSG.gone); selU = null; changed(); } else flash(MSG[r] || r); }); cardEl.append(bb);
    if (l.buy) { const yb = el('button', 'tact sell' + (W.inv.ash < l.buy - (l.who === A.ME ? l.bid : 0) ? ' no' : ''), `Выкупить · ${l.buy.toLocaleString('ru')}`); yb.type = 'button';
      yb.addEventListener('click', () => { const r = A.buyout(W, l.u); if (r === 'ok') { flash('Куплено', true); selU = null; changed(); } else if (r === 'gone') { flash(MSG.gone); selU = null; changed(); } else flash(MSG[r] || r); }); cardEl.append(yb); }
  }
  function buyTab(wrap, mineOnly) {
    const left = el('div', 'apane');
    if (!mineOnly) filters(left); else left.append(el('div', 'sub', 'Ваши лоты на рынке: ждут ставок и выкупа.'));
    countEl = el('div', 'acount'); listEl = el('div', 'alist'); cardEl = el('aside', 'acard'); left.append(countEl, listEl); wrap.append(left, cardEl); refreshList();
  }

  // ---- вкладка «Продать» ----
  function sellTab(wrap) {
    const left = el('div', 'apane'), grid = el('div', 'alist sgridl'); left.append(el('div', 'sub', `Выберите вещь из сумки · лотов ${A.auctionOf(W).lots.filter(l => l.mine).length}/${K.maxMine}`));
    const bag = W.inv.bag; bag.forEach((s, i) => {
      const it = BY_ID[s.id]; if (!it || s.lock || it.cat === 'key') return;
      const b = el('button', 'arow' + (selBag === i ? ' sel' : '')); b.type = 'button'; b.style.setProperty('--rc', RARITY[it.rar || 0].color); b.append(ico(it));
      const info = el('span', 'ainfo'), nm = el('span', 'anm', nameFull({ ...s, n: s.n })); nm.style.color = RARITY[it.rar || 0].color; info.append(nm, el('span', 'asub', lvTxt(s) || RARITY[it.rar || 0].name)); b.append(info);
      b.addEventListener('click', () => { selBag = i; const fair = A.fairOf(W, { ...s, n: s.n }); S.n = s.n; S.start = String(Math.max(1, Math.round(fair * .85))); S.buy = String(Math.round(fair * 1.3)); render(); }); grid.append(b);
    });
    if (!grid.children.length) grid.append(el('div', 'emptyl', 'В сумке нечего продавать.'));
    left.append(grid); const card = el('aside', 'acard'); wrap.append(left, card);
    const s = selBag != null && bag[selBag]; if (!s) { card.append(el('div', 'sub', 'Выберите вещь: задайте цену, выкуп и срок. Комиссия с продажи ' + Math.round(K.fee * 100) + '%, залог вернётся, если лот купят.')); return; }
    const it = BY_ID[s.id], rc = RARITY[it.rar || 0].color, head = el('div', 'ahead'), ib = ico(it); ib.classList.add('big'); const nm = el('div', 'tsn', nameFull(s) + (lvTxt(s) ? ' · ' + lvTxt(s) : '')); nm.style.color = rc; head.append(ib, nm); card.append(head); details(s, card);
    S.n = Math.min(Math.max(1, S.n), s.n); const sum = el('div', 'asum');
    const upd = () => { const n = Math.min(Math.max(1, num(S.n)), s.n), e = { ...s, n }, fair = A.fairOf(W, e), dep = A.depositOf(W, e, S.dur), st = num(S.start), by = num(S.buy);
      sum.textContent = ''; const kv = (k, v) => { const r = el('div'); r.append(el('span', null, k), typeof v === 'string' ? el('b', null, v) : v); sum.append(r); };
      kv('Рынок', money(fair)); kv('Залог', money(dep)); kv('Комиссия при продаже', `${Math.round(K.fee * 100)}% · вы получите ~${(st ? st - A.feeOf(W, by || st) : 0).toLocaleString('ru')}`); post.classList.toggle('no', !st || W.inv.ash < dep); post.textContent = `Выставить · залог ${dep.toLocaleString('ru')}`; };
    const post = el('button', 'tact sell', 'Выставить'); post.type = 'button';
    if (s.n > 1) card.append(field(`Сколько (из ${s.n})`, numIn(String(S.n), v => { S.n = num(v) || 1; upd(); })));
    card.append(field('Стартовая цена', numIn(S.start, v => { S.start = v; upd(); })), field('Выкуп (необязательно)', numIn(S.buy, v => { S.buy = v; upd(); })));
    const dur = el('select', 'tsort'); K.durName.forEach((t, i) => { const o = el('option', null, t); o.value = i; dur.append(o); }); dur.value = String(S.dur); dur.addEventListener('change', () => { S.dur = +dur.value; upd(); }); card.append(field('Срок', dur), sum, post);
    post.addEventListener('click', () => { const r = A.listItem(W, selBag, Math.min(Math.max(1, num(S.n)), s.n), num(S.start), num(S.buy), S.dur); if (typeof r === 'number') { flash('Лот выставлен', true); selBag = null; tab = 'mine'; selU = r; changed(true); } else flash(MSG[r] || r); });
    upd();
  }

  // ---- общее ----
  function pendBar() {
    const P = A.auctionOf(W).pend, items = P.items.reduce((a, e) => a + e.n, 0); pendEl.textContent = '';
    if (!P.ash && !items) { pendEl.hidden = true; return; } pendEl.hidden = false;
    pendEl.append(el('span', null, 'Ждёт вас: ')); if (P.ash) pendEl.append(money(P.ash)); if (items) pendEl.append(el('span', null, ` · вещей ${items}`));
    const b = el('button', 'tact sell', 'Забрать'); b.type = 'button'; b.addEventListener('click', () => { const r = A.claim(W); if (r === 'far') return flash(MSG.far); flash(`Забрано: ${r.ash ? r.ash + ' пепла' : ''}${r.ash && r.n ? ', ' : ''}${r.n ? 'вещей ' + r.n : ''}` || 'Нечего забирать', true); changed(); }); pendEl.append(b);
  }
  function changed(full) { onChange && onChange(); full ? render() : (pendBar(), ashEl.textContent = `${W.inv.ash.toLocaleString('ru')} пепла`, ashEl.prepend(coin()), refreshList()); }
  function render() {
    A.tick(W); const mineN = A.auctionOf(W).lots.filter(l => l.mine).length;
    subEl.textContent = `${A.auctionOf(W).lots.length} лотов · комиссия ${Math.round(K.fee * 100)}%`; ashEl.textContent = `${W.inv.ash.toLocaleString('ru')} пепла`; ashEl.prepend(coin());
    for (const b of tabsEl.children) { b.classList.toggle('on', b.dataset.tab === tab); if (b.dataset.tab === 'mine') b.textContent = `Мои лоты${mineN ? ' · ' + mineN : ''}`; }
    pendBar(); bodyEl.textContent = ''; const wrap = el('div', 'abody ' + tab); bodyEl.append(wrap);
    if (tab === 'sell') sellTab(wrap); else buyTab(wrap, tab === 'mine');
  }
  const open = () => { tab = 'buy'; selU = null; selBag = null; page = 1; render(); root.hidden = false; onOpen && onOpen(); };
  const close = () => { root.hidden = true; onClose && onClose(); };
  $('aucClose').addEventListener('click', close);
  // раз в несколько секунд, пока окно открыто, обновляем цены и сроки (рынок живёт по игровому времени)
  const live = () => { if (root.hidden) return; const n = A.tick(W); if (n) { const act = doc.activeElement; if (!act || !act.closest || !act.closest('#aucBody input, #aucBody select')) { pendBar(); if (tab !== 'sell') refreshList(); } } };
  return { open, close, render, live, isOpen: () => !root.hidden, state: () => ({ tab, F, selU }) };
}
