// Окно торговли: «Купить» (витрина) и «Продать» (сумка). Продавать можно только рядом с торговцем.
import { BY_ID, RARITY, SLOTS, SLOT_NAME, statLine } from './data/items.js';
import { iconURL } from './itemicons.js';     // значок вещи в строке лавки (2026-10-20)
import { betterThanWorn, nameOf, socketsOf } from './inv.js';
import { socketGem, unsocketGem, fuseGems, gemsAt, weaponMix, unsocketCost, gemId, armorGemFx } from './stones3d.js';
import { MIX_NAME, MIX_TEXT, ELEMENT_NAME, ELEMENT_COLOR, mixKey } from './elements3d.js';
import { canWield, NOT_FOR } from './data/heroes3d.js';
import { RECIPES } from './data/recipes3d.js';
import { TOME_BY_ID } from './data/tomes3d.js';
import { craft, craftStatus, missing, recipeKnown } from './craft3d.js';
import { allyHp, allyDmg, hireable, liveAllies } from './squad3d.js';
import { sellWorse } from './economy3d.js';
import { buyItem, sellItem, sellJunk, sellPrice, buyPrice, stockPrice, shopOf, priceMulOf, refreshGear, upgradeItem, upgradeCost, hireAlly, dismissAlly, squadMax } from './sim.js';

// значок вещи в рамке редкости — для строк лавки и кузни
const icoOf = (doc, it) => { const w = doc.createElement('span'), im = doc.createElement('img'); w.className = 'sico'; im.src = iconURL(doc, it); im.alt = ''; w.style.setProperty('--rc', RARITY[it.rar || 0].color); w.append(im); return w; };
export function createShop(doc, W, cfg, { onOpen, onClose, onChange } = {}) {
  const $ = id => doc.getElementById(id);
  const root = $('shop'), listEl = $('shopList'), headEl = $('shopHead'), tabsEl = $('shopTabs'), flashEl = $('shopFlash'), junkBtn = $('shopJunk'), worseBtn = $('shopWorse');
  let tab = 'buy', armed = null, flashT = 0;
  const el = (tag, cls, txt) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const flash = t => { flashEl.textContent = t; clearTimeout(flashT); flashT = setTimeout(() => { flashEl.textContent = ''; }, 2200); };
  for (const [id, label] of [['buy', 'Купить'], ['sell', 'Продать']]) { const b = el('button', 'tab', label); b.type = 'button'; b.dataset.tab = id; b.addEventListener('click', () => { tab = id; sel = null; render(); }); tabsEl.appendChild(b); }

  // окно торговли (2026-10-20, просьба владельца): слева витрина торговца, справа ваша сумка — сетки значков с ценой;
  // снизу карточка выбранной вещи с кнопкой. На телефоне — вкладки «Купить» и «Продать» с теми же сетками.
  let sel = null;     // { side: 'buy' | 'sell', i }
  const coin = () => { const c = el('span', 'tcoin'); c.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3 7-3 13-3-13z"/></svg>'; return c; };
  const tile = (it, n, price, side, i, extra) => {
    const b = el('button', 'ttile' + (sel && sel.side === side && sel.i === i ? ' sel' : '') + (extra || '')); b.type = 'button'; b.style.setProperty('--rc', RARITY[it.rar || 0].color);
    const im = doc.createElement('img'); im.src = iconURL(doc, it); im.alt = ''; b.append(im);
    if (n > 1) b.append(el('span', 'tn', '×' + n));
    const pr = el('span', 'tpr', String(price)); pr.prepend(coin()); b.append(pr);
    b.title = it.name; b.setAttribute('aria-label', `${it.name}${n > 1 ? ' ×' + n : ''}, ${side === 'buy' ? 'цена' : 'продать за'} ${price}`);
    b.addEventListener('click', () => { sel = { side, i }; render(); });
    b.addEventListener('dblclick', () => { sel = { side, i }; act(); });
    return b;
  };
  function act() {
    if (!sel) return; const sh = shopOf(W);
    if (sel.side === 'buy') { const r = buyItem(W, sel.i); if (r === 'closed') flash('Торговец спит до рассвета'); else if (r === 'far') flash('Подойдите к торговцу'); else if (r === 'ash') flash('Не хватает пепла'); else if (r === 'full') flash('Сумка полна'); else if (!sh.stock[sel.i]) sel = null; }
    else { const s = W.inv.bag[sel.i]; if (!s) { sel = null; render(); return; } const it = BY_ID[s.id], key = s.id + ':' + sel.i;
      if (it.rar >= 3 && armed !== key) { armed = key; setTimeout(() => { armed = null; render(); }, 2500); render(); return; }
      armed = null; const res = sellItem(W, sel.i, s.n); if (res === 'closed') flash('Торговец спит до рассвета'); else if (res === 'far') flash('Подойдите к торговцу'); else if (!W.inv.bag[sel.i] || W.inv.bag[sel.i].id !== s.id) sel = null; }
    render(); onChange && onChange();
  }
  function render() {
    refreshGear(W);
    const wand = W.nearNpc === 'wanderer' && W.wanderer, sh = shopOf(W);
    headEl.textContent = wand ? `Сказочный торговец · уедет через ${Math.max(0, Math.ceil(wand.t))} с` : 'Торговец';
    for (const b of tabsEl.children) b.classList.toggle('on', b.dataset.tab === tab);
    listEl.textContent = '';
    const wrap = el('div', 'trade ' + tab), buyP = el('div', 'tpane buyp'), sellP = el('div', 'tpane sellp');
    { const h = el('div', 'tph'); h.append(el('span', 'tpn', wand ? 'Диковины' : 'Товары торговца'), el('span', 'tps', 'вы покупаете')); buyP.append(h); }
    { const h = el('div', 'tph'); h.append(el('span', 'tpn', 'Ваша сумка'), el('span', 'tps', 'вы продаёте')); const ash = el('span', 'tash', String(W.inv.ash)); ash.prepend(coin()); h.append(ash); sellP.append(h); }
    const gb = el('div', 'tgridx'), gs = el('div', 'tgridx');
    sh.stock.forEach((s, i) => { const it = BY_ID[s.id], price = stockPrice(W, s); gb.append(tile(it, s.n, price, 'buy', i, (W.inv.ash < price ? ' poor' : '') + (it.slot && !canWield(W.hero, it) ? ' nope' : '') + (s.tier ? ' rare' : '') + (s.fresh ? ' fresh' : ''))); });
    if (!sh.stock.length) gb.append(el('div', 'emptyl', wand ? 'Всё раскуплено. Сказочный торговец скоро уедет.' : 'Всё раскуплено. Витрина обновится позже.'));
    W.inv.bag.forEach((s, i) => { const it = BY_ID[s.id]; gs.append(tile(it, s.n, sellPrice(it, cfg, s.up || 0, W.gear.trade, s.il, s.af) * s.n, 'sell', i, s.lock ? ' locked' : '')); });
    if (!W.inv.bag.length) gs.append(el('div', 'emptyl', 'Сумка пуста.'));
    buyP.append(gb); sellP.append(gs, junkBtn, worseBtn); junkBtn.hidden = false; worseBtn.hidden = false;
    wrap.append(buyP, sellP); listEl.append(wrap);
    // карточка выбранной вещи
    const card = el('div', 'tsel');
    const s = sel && (sel.side === 'buy' ? sh.stock[sel.i] : W.inv.bag[sel.i]);
    if (s) {
      const it = BY_ID[s.id], up = s.up || 0, nm = el('div', 'tsn', nameOf(it.id, up) + (s.n > 1 ? ' ×' + s.n : '')); nm.style.color = RARITY[it.rar].color;
      const im = doc.createElement('img'); im.src = iconURL(doc, it); im.alt = ''; const ic = el('span', 'tsi'); ic.style.setProperty('--rc', RARITY[it.rar].color); ic.append(im);
      const info = el('div', 'tsinfo'); info.append(nm, el('div', 'sub', `${RARITY[it.rar].name}${it.slot && !canWield(W.hero, it) ? ' · ' + NOT_FOR[W.hero] : ''}${it.slot && betterThanWorn(W.inv, it) ? ' · ▲ лучше надетого' : ''}`), el('div', 'sub', it.stats ? statLine(it) : it.text || ''));
      if (s.tier) info.append(el('div', 'sub g', cfg.shop.rare.tiers[s.tier - 1].name));
      const price = sel.side === 'buy' ? stockPrice(W, s) : sellPrice(it, cfg, up, W.gear.trade, s.il, s.af) * s.n, key = s.id + ':' + sel.i;
      const b = el('button', 'tact ' + sel.side + (sel.side === 'buy' && W.inv.ash < price ? ' no' : ''), sel.side === 'buy' ? `Купить · ${price}` : (it.rar >= 3 && armed !== key ? `Продать? · ${price}` : `Продать${s.n > 1 ? ' всё' : ''} · ${price}`));
      b.type = 'button'; b.addEventListener('click', act); card.append(ic, info, b);
    } else card.append(el('div', 'sub', 'Нажмите на вещь — подробности и цена. Двойной щелчок — сразу купить или продать.'));
    listEl.append(card);
  }
  worseBtn.addEventListener('click', () => { const r = sellWorse(W); flash(r < 0 ? (W.night ? 'Торговец спит до рассвета' : 'Подойдите к торговцу') : r.n ? `Продано вещей: ${r.n} за ${r.sum}` : 'Хуже надетого нет'); render(); onChange && onChange(); });     // этап 4 «круче»
  junkBtn.addEventListener('click', () => { const sum = sellJunk(W); flash(sum < 0 ? (W.night ? 'Торговец спит до рассвета' : 'Подойдите к торговцу') : sum ? `Хлам продан за ${sum}` : 'Хлама нет'); render(); onChange && onChange(); });
  const open = () => { tab = 'buy'; sel = null; render(); root.hidden = false; onOpen && onOpen(); };
  const close = () => { root.hidden = true; for (const s of W.shop.stock) s.fresh = false; onClose && onClose(); };     // посмотрел — уже не новинка
  $('shopClose').addEventListener('click', close);
  return { open, close, render, isOpen: () => !root.hidden };
}

// Кузнец: улучшение надетого и лежащего в сумке снаряжения до +5
export function createSmith(doc, W, cfg, { onOpen, onClose, onChange, onSource } = {}) {
  const $ = id => doc.getElementById(id);
  const root = $('smith'), listEl = $('smithList'), headEl = $('smithHead'), flashEl = $('smithFlash'), tabsEl = $('smithTabs'), noteEl = $('smithNote');
  let flashT = 0, tab = 'up', onlyReady = false;     // по умолчанию — все известные рецепты, с нехваткой
  const el = (tag, cls, txt) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const flash = t => { flashEl.textContent = t; clearTimeout(flashT); flashT = setTimeout(() => { flashEl.textContent = ''; }, 2200); };
  function rowFor(id, lvl, where, tag) {
    const it = BY_ID[id], max = lvl >= cfg.smith.max, cost = upgradeCost(it, lvl, cfg);
    const r = el('div', 'srow'), info = el('div', 'sinfo'); r.append(icoOf(doc, it));
    const nm = el('span', 'nm', nameOf(id, lvl)); nm.style.color = RARITY[it.rar].color; info.append(nm, el('span', 'up', tag));
    info.append(el('div', 'sub', (statLine(it) || '') + (max ? ' · предел' : ` · +${lvl} → +${lvl + 1}: статы +${Math.round(cfg.smith.bonus * 100)}%`)));
    const b = el('button', 'buy' + (max || W.inv.ash < cost ? ' no' : ''), max ? 'Максимум' : `Улучшить · ${cost}`); b.type = 'button';
    b.addEventListener('click', () => { const res = upgradeItem(W, where); if (res === 'ash') flash('Не хватает пепла'); else if (res === 'max') flash('Выше некуда'); else if (res === 'far') flash('Подойдите к кузнецу'); render(); onChange && onChange(); });
    r.append(info, b); return r;
  }
  for (const [id, label] of [['up', 'Улучшение'], ['craft', 'Ковка'], ['gems', 'Камни']]) { const b = el('button', 'tab', label); b.type = 'button'; b.dataset.tab = id; b.addEventListener('click', () => { tab = id; render(); }); tabsEl.appendChild(b); }
  // камни силы: гнёзда оружия (вставить, вынуть за пепел) и сплав 3 одинаковых → 1 рангом выше
  let pick = null;
  const maxSlots = () => cfg.bag.slots + ((W.gear && W.gear.bag) || 0);
  const res = r => flash({ ok: '', far: 'Подойдите к кузнецу', ash: 'Не хватает пепла', full: 'Сумка полна', busy: 'Гнездо занято', nogem: 'Нет такого камня', few: 'Нужно три одинаковых камня', max: 'Выше некуда' }[r] || '');
  const mixLine = (it, g) => { if (it.slot !== 'weapon') { const fx = g.filter(Boolean).map(id => armorGemFx(BY_ID[id], cfg)); return fx.length ? 'Камни в броне: ' + fx.join('; ') : 'Гнёзда пусты: камень в броне даёт характеристику и защиту от стихии.'; }     // броня (2026-10-18)
    const m = weaponMix(it, g); if (!m) return 'Гнёзда пусты: вставьте камень силы.'; if (!m.b) return `Стихия удара: ${ELEMENT_NAME[m.a]}`; return `Сплав: ${MIX_NAME[mixKey(m.a, m.b)]} (${ELEMENT_NAME[m.a]} + ${ELEMENT_NAME[m.b]})${m.amp ? ' · стихия оружия усиливает' : ''}`; };
  const samePick = (where, i) => pick && pick.i === i && pick.where.slot === where.slot && pick.where.idx === where.idx;
  // что даёт камень в ударе (числа — config3d.js → stones): шанс по рангу и метка стихии
  const gemFx = G => { const S = cfg.stones, k = S.power[G.rank - 1], e = S.el[G.gem], ch = Math.round(S.chance[G.rank - 1] * 100), r1 = v => Math.round(v * 10) / 10;
    const t = { fire: () => `поджигает: ${r1(e[0] * k)} урона/с, ${e[1]} с`, ice: () => `морозит и замедляет ${r1(e * k)} с`, water: () => `мочит врага на ${r1(e * k)} с`, storm: () => `разряд ${r1(e[0] * k)} урона, перескок к соседу`, venom: () => `яд ${r1(e[0] * k)} урона/с, ${e[1]} с`, blood: () => `кровотечение ${r1(e[0] * k)} урона/с, ${e[1]} с`, earth: () => `трещина на ${r1(e * k)} с` }[G.gem];
    return `${t ? t() : ELEMENT_NAME[G.gem]} · шанс ${ch}% (тяжёлый удар — всегда)`; };
  // список камней под пустым гнездом: название, сколько есть, что даёт и каким станет сплав
  function gemPop(it, where, i, g) {
    const box = el('div', 'gempop'), gems = W.inv.bag.map((s, k) => ({ s, k, it: BY_ID[s.id] })).filter(r => r.it.cat === 'gem').sort((a, b) => a.it.gem.localeCompare(b.it.gem) || b.it.rank - a.it.rank);
    if (!gems.length) { box.append(el('div', 'emptyl', 'В сумке нет камней силы. С каких врагов они падают — в книге рецептов (R).')); return box; }
    for (const r of gems) { const b = el('button', 'gemopt'); b.type = 'button'; b.style.setProperty('--gc', ELEMENT_COLOR[r.it.gem]);
      const arm = it.slot !== 'weapon', other = arm ? null : g.find((x, j) => j !== i && x), mix = other ? MIX_NAME[mixKey(BY_ID[other].gem, r.it.gem)] : null;     // в броне — своё действие, без сплава
      b.append(el('span', 'gn', `${r.it.name} ×${r.s.n}`), el('span', 'gf', arm ? armorGemFx(r.it, cfg) : gemFx(r.it)), mix ? el('span', 'gm', `Сплав с ${BY_ID[other].name.toLowerCase()}: ${mix}. ${MIX_TEXT[mixKey(BY_ID[other].gem, r.it.gem)] || ''}`) : '');
      b.addEventListener('click', () => { res(socketGem(W, where, i, r.it.id)); pick = null; render(); onChange && onChange(); }); box.append(b); }
    return box;
  }
  function weaponRow(id, where, tag) {
    const it = BY_ID[id], g = gemsAt(W, where), r = el('div', 'srow gemrow'), info = el('div', 'sinfo');
    const nm = el('span', 'nm', it.name); nm.style.color = RARITY[it.rar].color; info.append(nm, el('span', 'up', tag), el('div', 'sub', mixLine(it, g)));
    const socks = el('div', 'socks');
    g.forEach((gem, i) => {
      const b = el('button', 'sock' + (gem ? ' full' : '')); b.type = 'button';
      if (gem) { const G = BY_ID[gem]; b.style.setProperty('--gc', ELEMENT_COLOR[G.gem]); b.textContent = `${G.name} · вынуть за ${unsocketCost(W, gem)}`; b.addEventListener('click', () => { res(unsocketGem(W, where, i, maxSlots())); pick = null; render(); onChange && onChange(); }); }
      else { b.textContent = samePick(where, i) ? 'Пустое гнездо ▴' : 'Пустое гнездо ▾'; b.addEventListener('click', () => { pick = samePick(where, i) ? null : { where, i }; render(); }); }
      socks.append(b);
    });
    info.append(socks); g.forEach((gem, i) => { if (!gem && samePick(where, i)) info.append(gemPop(it, where, i, g)); }); r.append(info); return r;
  }
  function gemsTab() {
    noteEl.textContent = 'В оружии камень даёт удару стихию, две стихии сплавляются (таблица — в книге рецептов, клавиша R). В броне камень даёт характеристику, а огонь, яд и кровь ещё защищают от горения, яда и кровотечения. Вынуть камень можно за пепел: он вернётся целым.';
    let n = 0;
    if (W.inv.eq.weapon && socketsOf(BY_ID[W.inv.eq.weapon], cfg)) { listEl.appendChild(weaponRow(W.inv.eq.weapon, { slot: 'weapon' }, 'в руке')); n++; }
    for (const sl of cfg.stones.armor.slots) if (W.inv.eq[sl] && socketsOf(BY_ID[W.inv.eq[sl]], cfg)) { listEl.appendChild(weaponRow(W.inv.eq[sl], { slot: sl }, 'надето')); n++; }     // надетая броня с гнёздами
    W.inv.bag.forEach((s, i) => { if (socketsOf(BY_ID[s.id], cfg)) { listEl.appendChild(weaponRow(s.id, { idx: i }, 'в сумке')); n++; } });
    if (!n) listEl.appendChild(el('div', 'emptyl', 'Нет вещей с гнёздами. У оружия: одно у синего и фиолетового, два у оранжевого и золотого. У брони: одно у фиолетовой, два у оранжевой и золотой.'));
    const gems = W.inv.bag.map((s, i) => ({ s, i, it: BY_ID[s.id] })).filter(r => r.it.cat === 'gem');
    const seen = new Set(), fusable = gems.filter(r => r.it.rank < 3 && !seen.has(r.it.id) && seen.add(r.it.id));
    if (fusable.length) listEl.appendChild(el('div', 'emptyl', 'Сплавить: три одинаковых камня → один рангом выше'));
    for (const r of fusable) {
      const next = BY_ID[gemId(r.it.gem, r.it.rank + 1)], cost = cfg.stones.fuse.ash[r.it.rank - 1], have = W.inv.bag.filter(s => s.id === r.it.id).reduce((a, s) => a + s.n, 0), okk = have >= cfg.stones.fuse.n && W.inv.ash >= cost;
      const row = el('div', 'srow'), info = el('div', 'sinfo'), nm = el('span', 'nm', `${r.it.name} → ${next.name}`); nm.style.color = ELEMENT_COLOR[r.it.gem]; info.append(nm);
      const m = el('div', 'mats'); m.append(el('span', have >= cfg.stones.fuse.n ? 'have' : 'lack', `${r.it.name} ${have}/${cfg.stones.fuse.n}`), el('span', W.inv.ash >= cost ? 'have' : 'lack', `пепел ${cost}`)); info.append(m);
      const b = el('button', 'buy' + (okk ? '' : ' no'), 'Сплавить'); b.type = 'button'; b.addEventListener('click', () => { res(fuseGems(W, r.it.id, maxSlots())); render(); onChange && onChange(); });
      row.append(info, b); listEl.appendChild(row);
    }
  }
  function craftRow(r) {
    const it = BY_ID[r.result.id], st = craftStatus(W, r), row = el('div', 'srow'), info = el('div', 'sinfo');
    const nm = el('span', 'nm', it.name + (r.result.n > 1 ? ' ×' + r.result.n : '')); nm.style.color = RARITY[it.rar].color; info.append(nm);
    if (st === 'tome') {
      const t = TOME_BY_ID[r.needs]; info.append(el('div', 'sub', `Нужна книга «${t.name}». ${t.hint}`));
    } else {
      info.append(el('div', 'sub', statLine(it) || r.text));
      const m = el('div', 'mats'); for (const [id, n, have] of missing(W, r)) { const c = el('button', 'mat ' + (have >= n ? 'have' : 'lack'), `${BY_ID[id].name} ${Math.min(have, n)}/${n}`); c.type = 'button'; c.dataset.item = id; c.title = 'Где взять (G)'; c.addEventListener('click', () => onSource && onSource(id)); m.append(c); } m.append(el('span', W.inv.ash >= r.ash ? 'have' : 'lack', `пепел ${r.ash}`)); info.append(m);
    }
    const b = el('button', 'buy' + (st === 'ok' ? '' : ' no'), st === 'tome' ? 'Закрыто' : 'Ковать'); b.type = 'button';
    b.addEventListener('click', () => { if (st === 'tome') return; const res = craft(W, r.id); flash(res === 'ok' ? `Готово: ${it.name}` : res === 'far' ? 'Подойдите к кузнецу' : res === 'mats' ? 'Не хватает материалов' : res === 'ash' ? 'Не хватает пепла' : res === 'full' ? 'Сумка полна' : ''); render(); onChange && onChange(); });
    row.append(info, b); return row;
  }
  function render() {
    refreshGear(W);
    for (const b of tabsEl.children) b.classList.toggle('on', b.dataset.tab === tab);
    headEl.textContent = `Кузнец · пепел ${W.inv.ash}`; listEl.textContent = '';
    if (tab === 'gems') { gemsTab(); return; }
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
    const live = liveAllies(W), max = squadMax(W);     // герои сюжета и подопечные — не отряд
    headEl.textContent = `Застава · отряд ${live.length}/${max} · пепел ${W.inv.ash}`;
    listEl.textContent = '';
    const ROLE = { tank: 'защитник', heal: 'лекарь', ranged: 'стрелок', melee: 'боец' };
    const row = (id, T) => {
      const r = el('div', 'srow'), info = el('div', 'sinfo'), mate = !!T.hero, own = mate && !hireable(W, id) && T.hero !== W.hero;
      const nm = el('span', 'nm', T.name + (mate ? ' · ' + ROLE[T.role] : '')); nm.style.color = T.tint === '#2e2e34' ? '#c8c8d8' : T.tint;
      info.append(nm, el('div', 'sub', `${T.text} Без снаряжения: здоровье ${Math.round(allyHp(W, T) * (W.cfg.squad.gear && W.cfg.squad.gear.on ? W.cfg.squad.gear.naked.hp : 1))}, урон ${Math.round(allyDmg(W, T) * (W.cfg.squad.gear && W.cfg.squad.gear.on ? W.cfg.squad.gear.naked.dmg : 1))}. Одевайте в сумке.`));
      const full = live.length >= max, b = el('button', 'buy' + (own || full || W.inv.ash < T.cost ? ' no' : ''), own ? 'В отряде' : `Нанять · ${T.cost}`); b.type = 'button';
      b.addEventListener('click', () => { const res = hireAlly(W, id); flash(res === 'ok' ? `${T.name} в отряде` : res === 'ash' ? 'Не хватает пепла' : res === 'full' ? `Отряд полон (мест: ${max}). Новые места открываются с уровнем` : res === 'taken' ? `${T.name} уже в отряде` : 'Подойдите к капитану'); render(); onChange && onChange(); });
      r.append(info, b); listEl.appendChild(r);
    };
    listEl.appendChild(el('div', 'ssec', 'Спутники'));     // этап 4: герои, которыми вы не играете; растут с вашим уровнем
    for (const [id, T] of Object.entries(cfg.squad.types)) if (T.hero && T.hero !== W.hero && !T.story) row(id, T);
    listEl.appendChild(el('div', 'ssec', 'Наёмники'));
    for (const [id, T] of Object.entries(cfg.squad.types)) if (!T.hero && !T.story) row(id, T);     // герои сюжета не нанимаются
    listEl.appendChild(el('div', 'ssec', 'Отряд'));
    if (!live.length) listEl.appendChild(el('div', 'emptyl', 'Пока никого. Бойцы идут за вами, бьют врагов и гибнут навсегда. Лечатся сами вне боя, у костра быстрее. Команды: Z — за мной, X — держать, C — бить вашу цель.'));
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
