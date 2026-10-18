// Окно торговли: «Купить» (витрина) и «Продать» (сумка). Продавать можно только рядом с торговцем.
import { BY_ID, RARITY, SLOTS, SLOT_NAME, statLine } from './data/items.js';
import { betterThanWorn, nameOf, socketsOf } from './inv.js';
import { socketGem, unsocketGem, fuseGems, gemsAt, weaponMix, unsocketCost, gemId, armorGemFx } from './stones3d.js';
import { MIX_NAME, MIX_TEXT, ELEMENT_NAME, ELEMENT_COLOR, mixKey } from './elements3d.js';
import { canWield, NOT_FOR } from './data/heroes3d.js';
import { RECIPES } from './data/recipes3d.js';
import { TOME_BY_ID } from './data/tomes3d.js';
import { craft, craftStatus, missing, recipeKnown } from './craft3d.js';
import { buyItem, sellItem, sellJunk, sellPrice, buyPrice, stockPrice, shopOf, priceMulOf, refreshGear, upgradeItem, upgradeCost, hireAlly, dismissAlly, squadMax } from './sim.js';

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
  // полка редкостей (G3): рамка цвета редкости, ярлык уровня и «новинка», пока лавку не открывали
  const tierRow = (s, r) => {
    if (!s.tier) return r;
    const T = cfg.shop.rare.tiers[s.tier - 1], c = RARITY[BY_ID[s.id].rar].color, tag = el('div', 'tier', T.name + (s.tier > 1 ? ' ' + '✦'.repeat(s.tier - 1) : ''));
    tag.style.color = c; r.classList.add('tier' + s.tier); r.style.borderColor = c; r.style.setProperty('--tc', c);
    if (s.fresh) tag.append(el('span', 'fresh', 'новинка'));
    r.querySelector('.sinfo').prepend(tag); return r;
  };
  function render() {
    refreshGear(W);
    const wand = W.nearNpc === 'wanderer' && W.wanderer, sh = shopOf(W), mul = W.dif.buy * priceMulOf(W);
    headEl.textContent = wand ? `Сказочный торговец · уедет через ${Math.max(0, Math.ceil(wand.t))} с · пепел ${W.inv.ash}` : `Торговец · пепел ${W.inv.ash}`;
    for (const b of tabsEl.children) b.classList.toggle('on', b.dataset.tab === tab);
    junkBtn.hidden = tab !== 'sell';
    listEl.textContent = '';
    if (tab === 'buy') {
      sh.stock.forEach((s, i) => { const it = BY_ID[s.id], price = stockPrice(W, s); listEl.appendChild(tierRow(s, row(it, s.n, (canWield(W.hero, it) ? '' : NOT_FOR[W.hero] + ' · ') + (it.stats ? statLine(it) : it.text || ''), price, 'Купить', () => { const r = buyItem(W, i); if (r === 'closed') flash('Торговец спит до рассвета'); else if (r === 'ash') flash('Не хватает пепла'); else if (r === 'full') flash('Сумка полна'); else if (r === 'far') flash('Подойдите к торговцу'); }, W.inv.ash >= price, canWield(W.hero, it) && betterThanWorn(W.inv, it) ? '▲' : ''))); });
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
    const r = el('div', 'srow'), info = el('div', 'sinfo');
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
    const live = W.allies.filter(a => !a.dead && !a.guest), max = squadMax(W);
    headEl.textContent = `Застава · отряд ${live.length}/${max} · пепел ${W.inv.ash}`;
    listEl.textContent = '';
    listEl.appendChild(el('div', 'ssec', 'Нанять'));
    for (const [id, T] of Object.entries(cfg.squad.types)) { if (T.story) continue;     // герои сюжета не нанимаются
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
