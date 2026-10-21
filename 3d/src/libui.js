// Окно библиотеки (4.00): книжница в лагере. «Зачаровать» — надетое и вещи из сумки: добавить свойство, перековать
// одно, поднять качество. «Разобрать» — вещь из сумки в чародейскую пыль. Логика — enchant3d.js, числа — cfg.enchant.
import { BY_ID, RARITY, SLOTS, SLOT_NAME, STAT_NAME } from './data/items.js';
import { iconURL } from './itemicons.js';
import { nameOf } from './inv.js';
import { affixLines } from './affix3d.js';
import { enchantInfo, enchant, disenchant, dustOf, itemAt, yieldOf } from './enchant3d.js';
import { refreshGear } from './sim.js';

export function createLibrary(doc, W, cfg, { onOpen, onClose, onChange } = {}) {
  const $ = id => doc.getElementById(id);
  const root = $('lib'), listEl = $('libList'), headEl = $('libHead'), flashEl = $('libFlash'), tabsEl = $('libTabs'), noteEl = $('libNote');
  let flashT = 0, tab = 'ench', armed = null;
  const el = (tag, cls, txt) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const flash = t => { flashEl.textContent = t; clearTimeout(flashT); flashT = setTimeout(() => { flashEl.textContent = ''; }, 2400); };
  const ico = it => { const w = el('span', 'sico'), im = doc.createElement('img'); im.src = iconURL(doc, it); im.alt = ''; w.style.setProperty('--rc', RARITY[it.rar || 0].color); w.append(im); return w; };
  const MSG = { far: 'Подойдите к книжнице', ash: 'Не хватает пепла', dust: 'Не хватает чародейской пыли', max: 'Больше нельзя', none: 'Нечего менять', lock: 'Вещь под замком', gems: 'Сначала выньте камни у кузнеца', full: 'Сумка полна' };
  const done = (r, ok) => { flash(r === 'ok' || (r && r.n) ? ok(r) : MSG[r] || ''); armed = null; refreshGear(W); render(); onChange && onChange(); };
  const price = c => `пепел ${c.ash}, пыль ${c.dust}`;
  for (const [id, label] of [['ench', 'Зачаровать'], ['break', 'Разобрать']]) { const b = el('button', 'tab', label); b.type = 'button'; b.dataset.tab = id; b.addEventListener('click', () => { tab = id; armed = null; render(); }); tabsEl.appendChild(b); }
  function head(it, tag, af) {
    const info = el('div', 'sinfo'), nm = el('span', 'nm', nameOf(it.id)); nm.style.color = RARITY[it.rar].color; info.append(nm, el('span', 'up', tag));
    const lines = affixLines(af, STAT_NAME); info.append(el('div', 'sub', lines.length ? lines.join(' · ') : 'Без свойств'));
    return info;
  }
  function enchRow(where, tag) {
    const I = enchantInfo(W, where); if (!I) return null;
    const r = el('div', 'srow'), info = head(I.it, tag + (I.en ? ` · зачарована ${I.en}` : ''), I.af); r.append(ico(I.it), info);
    const acts = el('div', 'socks'), poor = W.inv.ash < I.cost.ash || dustOf(W) < I.cost.dust;
    const act = (label, ok, fn) => { const b = el('button', 'sock' + (ok && !poor ? '' : ' no'), label); b.type = 'button'; b.addEventListener('click', fn); acts.append(b); };
    act(I.canAdd ? `Добавить свойство · ${price(I.cost)}` : `Свойств ${I.n} из ${I.cap}`, I.canAdd, () => done(enchant(W, where, 'add'), () => 'Новое свойство вписано'));
    if (I.canQ || I.af && I.af.q) act(I.canQ ? `Качество выше · ${price(I.cost)}` : 'Качество — предел', I.canQ, () => done(enchant(W, where, 'quality'), () => 'Качество переписано'));
    for (const k of I.keys) act(`Перековать «${STAT_NAME[k] || k}» · ${price(I.cost)}`, I.free.length > 0, () => done(enchant(W, where, 'reroll', k), () => 'Свойство перековано'));
    info.append(acts); return r;
  }
  function breakRow(i) {
    const x = itemAt(W, { idx: i }); if (!x || !x.it || !x.it.slot) return null;
    const s = x.s, r = el('div', 'srow'), info = head(x.it, 'в сумке', s.af); r.append(ico(x.it), info);
    const key = s.id + ':' + i, rare = x.it.rar >= 3 || (s.af && s.af.en), n = yieldOf(W, x);
    const b = el('button', 'buy' + (s.lock || (s.g && s.g.some(Boolean)) ? ' no' : ''), s.lock ? 'Под замком' : rare && armed !== key ? `Разобрать? · пыль +${n}` : `Разобрать · пыль +${n}`); b.type = 'button';
    b.addEventListener('click', () => { if (rare && armed !== key && !s.lock) { armed = key; render(); return; } done(disenchant(W, i), q => `Пыль +${q.n}`); });     // редкую и зачарованную — вторым нажатием
    r.append(info, b); return r;
  }
  function render() {
    for (const b of tabsEl.children) b.classList.toggle('on', b.dataset.tab === tab);
    headEl.textContent = `Библиотека · пепел ${W.inv.ash} · пыль ${dustOf(W)}`; listEl.textContent = '';
    let n = 0;
    if (tab === 'break') {
      noteEl.textContent = 'Книжница разбирает оружие, броню и украшения в чародейскую пыль. Чем реже вещь, тем больше пыли. Вещи под замком и с камнями не разбираются.';
      W.inv.bag.forEach((s, i) => { const row = breakRow(i); if (row) { listEl.appendChild(row); n++; } });
      if (!n) listEl.appendChild(el('div', 'emptyl', 'В сумке нет оружия, брони и украшений.'));
      return;
    }
    const C = cfg.enchant;
    noteEl.textContent = `Зачарование стоит пепел и чародейскую пыль. Свойств — не больше своих по редкости +${C.extra} и не больше ${C.cap}. Перековка меняет одно свойство на случайное другое. Качество не падает. Каждое зачарование вещи дороже прежнего.`;
    for (const slot of SLOTS) if (W.inv.eq[slot]) { const row = enchRow({ slot }, SLOT_NAME[slot] + ' · надето'); if (row) { listEl.appendChild(row); n++; } }
    W.inv.bag.forEach((s, i) => { if (BY_ID[s.id] && BY_ID[s.id].slot) { const row = enchRow({ idx: i }, 'в сумке'); if (row) { listEl.appendChild(row); n++; } } });
    if (!n) listEl.appendChild(el('div', 'emptyl', 'Нет оружия, брони и украшений.'));
  }
  const open = () => { armed = null; render(); root.hidden = false; onOpen && onOpen(); };
  const close = () => { root.hidden = true; onClose && onClose(); };
  $('libClose').addEventListener('click', close);
  return { open, close, render, isOpen: () => !root.hidden };
}
