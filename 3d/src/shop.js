// Окно торговли: «Купить» (витрина) и «Продать» (сумка). Продавать можно только рядом с торговцем.
import { BY_ID, RARITY, SLOTS, SLOT_NAME, statLine } from './data/items.js';
import { betterThanWorn, nameOf } from './inv.js';
import { RECIPES } from './data/recipes3d.js';
import { TOME_BY_ID } from './data/tomes3d.js';
import { craft, craftStatus, missing, recipeKnown } from './craft3d.js';
import { buyItem, sellItem, sellJunk, sellPrice, buyPrice, shopOf, priceMulOf, refreshGear, upgradeItem, upgradeCost, hireAlly, dismissAlly, squadMax } from './sim.js';

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
    const wand = W.nearNpc === 'wanderer' && W.wanderer, sh = shopOf(W), mul = W.dif.buy * priceMulOf(W);
    headEl.textContent = wand ? `Сказочный торговец · уедет через ${Math.max(0, Math.ceil(wand.t))} с · пепел ${W.inv.ash}` : `Торговец · пепел ${W.inv.ash}`;
    for (const b of tabsEl.children) b.classList.toggle('on', b.dataset.tab === tab);
    junkBtn.hidden = tab !== 'sell';
    listEl.textContent = '';
    if (tab === 'buy') {
      sh.stock.forEach((s, i) => { const it = BY_ID[s.id], price = buyPrice(it, cfg, mul); listEl.appendChild(row(it, s.n, it.stats ? statLine(it) : it.text || '', price, 'Купить', () => { const r = buyItem(W, i); if (r === 'closed') flash('Торговец спит до рассвета'); else if (r === 'ash') flash('Не хватает пепла'); else if (r === 'full') flash('Сумка полна'); else if (r === 'far') flash('Подойдите к торговцу'); }, W.inv.ash >= price, betterThanWorn(W.inv, it) ? '▲' : '')); });
      if (!sh.stock.length) listEl.appendChild(el('div', 'emptyl', wand ? 'Всё раскуплено. Сказочный торговец скоро уедет.' : 'Всё раскуплено. Витрина обновится позже.'));
    } else {
      const rows = W.inv.bag.map((s, i) => ({ s, i, it: BY_ID[s.id] })).sort((a, b) => b.it.rar - a.it.rar || a.it.name.localeCompare(b.it.name, 'ru'));
      for (const r of rows) {
        const key = r.s.id + ':' + r.i;
        const risky = r.it.rar >= 3 && armed !== key;
        listEl.appendChild(row(r.it, r.s.n, r.it.stats ? statLine(r.it) : r.it.text || '', sellPrice(r.it, cfg, r.s.up || 0, W.gear.trade) * r.s.n, risky ? 'Продать?' : (r.s.n > 1 ? 'Всё' : 'Продать'), () => {
          if (risky) { armed = key; setTimeout(() => { armed = null; render(); }, 2500); return; }
          armed = null; const res = sellItem(W, r.i, r.s.n); if (res === 'closed') flash('Торговец спит до рассвета'); else if (res === 'far') flash('Подойдите к торговцу');
        }, true, '', r.s.up || 0));
      }
      if (!rows.length) listEl.appendChild(el('div', 'emptyl', 'Сумка пуста.'));
    }
  }
  junkBtn.addEventListener('click', () => { const sum = sellJunk(W); flash(sum < 0 ? (W.night ? 'Торговец спит до рассвета' : 'Подойдите к торговцу') : sum ? `Хлам продан за ${sum}` : 'Хлама нет'); render(); onChange && onChange(); });
  const open = () => { tab = 'buy'; render(); root.hidden = false; onOpen && onOpen(); };
  const close = () => { root.hidden = true; onClose && onClose(); };
  $('shopClose').addEventListener('click', close);
  return { open, close, render, isOpen: () => !root.hidden };
}

// Кузнец: улучшение надетого и лежащего в сумке снаряжения до +5
export function createSmith(doc, W, cfg, { onOpen, onClose, onChange } = {}) {
  const $ = id => doc.getElementById(id);
  const root = $('smith'), listEl = $('smithList'), headEl = $('smithHead'), flashEl = $('smithFlash'), tabsEl = $('smithTabs'), noteEl = $('smithNote');
  let flashT = 0, tab = 'up', onlyReady = true;
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
  for (const [id, label] of [['up', 'Улучшение'], ['craft', 'Ковка']]) { const b = el('button', 'tab', label); b.type = 'button'; b.dataset.tab = id; b.addEventListener('click', () => { tab = id; render(); }); tabsEl.appendChild(b); }
  function craftRow(r) {
    const it = BY_ID[r.result.id], st = craftStatus(W, r), row = el('div', 'srow'), info = el('div', 'sinfo');
    const nm = el('span', 'nm', it.name + (r.result.n > 1 ? ' ×' + r.result.n : '')); nm.style.color = RARITY[it.rar].color; info.append(nm);
    if (st === 'tome') {
      const t = TOME_BY_ID[r.needs]; info.append(el('div', 'sub', `Нужна книга «${t.name}». ${t.hint}`));
    } else {
      info.append(el('div', 'sub', statLine(it) || r.text));
      const m = el('div', 'mats'); for (const [id, n, have] of missing(W, r)) { const c = el('span', have >= n ? 'have' : 'lack', `${BY_ID[id].name} ${have}/${n}`); m.append(c); } m.append(el('span', W.inv.ash >= r.ash ? 'have' : 'lack', `пепел ${r.ash}`)); info.append(m);
    }
    const b = el('button', 'buy' + (st === 'ok' ? '' : ' no'), st === 'tome' ? 'Закрыто' : 'Ковать'); b.type = 'button';
    b.addEventListener('click', () => { if (st === 'tome') return; const res = craft(W, r.id); flash(res === 'ok' ? `Готово: ${it.name}` : res === 'far' ? 'Подойдите к кузнецу' : res === 'mats' ? 'Не хватает материалов' : res === 'ash' ? 'Не хватает пепла' : res === 'full' ? 'Сумка полна' : ''); render(); onChange && onChange(); });
    row.append(info, b); return row;
  }
  function render() {
    refreshGear(W);
    for (const b of tabsEl.children) b.classList.toggle('on', b.dataset.tab === tab);
    headEl.textContent = `Кузнец · пепел ${W.inv.ash}`; listEl.textContent = '';
    if (tab === 'craft') {
      noteEl.textContent = 'Материалы берутся из сумки. Улучшенное оружие и броня на ковку не идут. Новые рецепты открывают книги: читайте их в сумке.';
      const f = el('button', 'junk', onlyReady ? 'Показаны доступные сейчас. Показать все' : 'Показаны все. Только доступные'); f.type = 'button'; f.addEventListener('click', () => { onlyReady = !onlyReady; render(); }); listEl.appendChild(f);
      const order = { ok: 0, mats: 1, ash: 1, far: 1, tome: 3 }, known = RECIPES.filter(r => recipeKnown(W.known, r));
      const list = onlyReady ? RECIPES.filter(r => craftStatus(W, r) === 'ok') : RECIPES.slice().sort((a, b) => order[craftStatus(W, a)] - order[craftStatus(W, b)]);
      for (const r of list) listEl.appendChild(craftRow(r));
      if (!list.length) listEl.appendChild(el('div', 'emptyl', `Нечего ковать из того, что в сумке. Известных рецептов: ${known.length} из ${RECIPES.length}. Покажите все, чтобы увидеть, что нужно.`));
      return;
    }
    noteEl.textContent = 'Каждый уровень даёт +10% к урону, броне, здоровью, криту и вампиризму вещи. Уровней до +5.';
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

// Капитан Заставы: найм бойцов в отряд
export function createCaptain(doc, W, cfg, { onOpen, onClose, onChange } = {}) {
  const $ = id => doc.getElementById(id);
  const root = $('captain'), listEl = $('captainList'), headEl = $('captainHead'), flashEl = $('captainFlash');
  let flashT = 0, armed = 0;
  const el = (tag, cls, txt) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const flash = t => { flashEl.textContent = t; clearTimeout(flashT); flashT = setTimeout(() => { flashEl.textContent = ''; }, 2400); };
  function render() {
    const live = W.allies.filter(a => !a.dead), max = squadMax(W);
    headEl.textContent = `Застава · отряд ${live.length}/${max} · пепел ${W.inv.ash}`;
    listEl.textContent = '';
    listEl.appendChild(el('div', 'ssec', 'Нанять'));
    for (const [id, T] of Object.entries(cfg.squad.types)) {
      const r = el('div', 'srow'), info = el('div', 'sinfo');
      const nm = el('span', 'nm', T.name); nm.style.color = T.tint === '#2e2e34' ? '#c8c8d8' : T.tint;
      info.append(nm, el('div', 'sub', `${T.text} Здоровье ${T.hp}, урон ${T.dmg}.`));
      const full = live.length >= max, b = el('button', 'buy' + (full || W.inv.ash < T.cost ? ' no' : ''), `Нанять · ${T.cost}`); b.type = 'button';
      b.addEventListener('click', () => { const res = hireAlly(W, id); flash(res === 'ok' ? `${T.name} в отряде` : res === 'ash' ? 'Не хватает пепла' : res === 'full' ? `Отряд полон (мест: ${max}). Новые места открываются с уровнем` : 'Подойдите к капитану'); render(); onChange && onChange(); });
      r.append(info, b); listEl.appendChild(r);
    }
    listEl.appendChild(el('div', 'ssec', 'Отряд'));
    if (!live.length) listEl.appendChild(el('div', 'emptyl', 'Пока никого. Бойцы идут за вами, бьют врагов и гибнут навсегда. Лечатся сами вне боя, у костра быстрее.'));
    for (const a of live) {
      const T = cfg.squad.types[a.type], r = el('div', 'srow'), info = el('div', 'sinfo');
      info.append(el('span', 'nm', T.name), el('div', 'sub', `Здоровье ${Math.ceil(a.hp)}/${a.maxhp}`));
      const b = el('button', 'buy', armed === a.id ? 'Точно?' : 'Уволить'); b.type = 'button';
      b.addEventListener('click', () => { if (armed !== a.id) { armed = a.id; setTimeout(() => { armed = 0; render(); }, 2500); render(); return; } armed = 0; dismissAlly(W, a.id); render(); onChange && onChange(); });
      r.append(info, b); listEl.appendChild(r);
    }
  }
  const open = () => { render(); root.hidden = false; onOpen && onOpen(); };
  const close = () => { root.hidden = true; onClose && onClose(); };
  $('captainClose').addEventListener('click', close);
  return { open, close, render, isOpen: () => !root.hidden };
}
