// Город: торговец (покупка / продажа) и кузнец (улучшение оружия). Игра на паузе, пока панель открыта.
import { CFG } from '../config.js';
import { P, W, keys } from '../state.js';
import { SLOT_NAMES } from '../data/items.js';
import { defOf, sellFromBag, sellValue, itemName, bagFull } from '../inventory.js';
import { stock, buy, buyPrice, sellJunk, junkCount } from '../shop.js';
import { upgradables, upgradeCost, upgradeChance, tryUpgrade, dmgNowNext, maxed } from '../smith.js';
import { nearNpc } from '../town.js';
import * as Q from '../quests.js';
import { grantReward } from '../rewards.js';
import { sfx } from '../audio.js';
import { h as H, makeCell, createConfirmer, renderItemCard } from './common.js';

const LINES = {
  merchant: ['Пепел — единственная монета, которой ещё верят.', 'Берёшь — бери. Торг тут не в чести.', 'После каждого Предвестника у меня свежий товар.', 'Лишнее — продай. Ржавчина не кормит.'],
  keeper: ['Огонь горит, пока кто-то держит тропу.', 'Дела есть всегда. Выбирай.', 'Принеси, что просили, — получишь своё.', 'Не лезь на Предвестника один.'],
  smith: ['Сталь помнит, как её били. Бей ещё.', 'Чем выше, тем капризнее металл.', 'Не вини огонь. Вини руку.', 'Принеси пепла — получишь острее.']
};

export function createTownUI(doc, onClose) {
  const $ = id => doc.getElementById(id);
  const root = $('town'), list = $('tList'), grid = $('tGrid'), sheet = $('tCardWrap'), card = $('tCard'), foot = $('tFoot'), say = $('tSay'), tabs = $('tTabs');
  const h = (tag, cls, text) => H(doc, tag, cls, text);
  let kind = null, tab = 'buy', sel = null, open_ = false, lineN = 0;
  const confirmer = createConfirmer(() => renderCard());

  const setSay = t => { say.textContent = t; };
  const randomLine = () => { const L = LINES[kind]; return L[(lineN++) % L.length]; };

  function renderTabs() {
    tabs.textContent = '';
    if (kind !== 'merchant') { tabs.hidden = true; return; }
    tabs.hidden = false;
    for (const [id, name] of [['buy', 'Купить'], ['sell', 'Продать']]) {
      const b = h('button', 'tab' + (tab === id ? ' on' : ''), name); b.type = 'button';
      b.addEventListener('click', () => { tab = id; sel = null; confirmer.clear(); render(); });
      tabs.appendChild(b);
    }
  }

  function questBlock(q, state) {
    const s = Q.stateOf(q.id), box = h('div', 'quest ' + state);
    box.appendChild(h('div', 'qt', q.title));
    box.appendChild(h('div', 'qx', q.text));
    box.appendChild(h('div', 'qr', 'Награда: ' + Q.rewardText(q.reward)));
    if (state === 'active') {
      const bar = h('div', 'qbar'), i = h('i'); i.style.transform = 'scaleX(' + Math.min(1, s.n / q.goal) + ')'; bar.appendChild(i); box.appendChild(bar);
      box.appendChild(h('div', 'qn', `Выполнено: ${s.n} из ${q.goal}`));
    } else {
      const b = h('button', 'cbtn ' + (state === 'done' ? 'main' : ''), state === 'done' ? 'Сдать' : 'Взять задание'); b.type = 'button';
      if (state === 'avail' && Q.activeCount() >= CFG.quests.maxActive) { b.disabled = true; b.textContent = `Лимит заданий (${CFG.quests.maxActive})`; }
      b.addEventListener('click', () => {
        if (state === 'done') { const t = Q.claim(q.id, grantReward); if (t) { setSay('Держи: ' + t + '.'); sfx.loot('rare'); } }
        else { const r = Q.accept(q.id); setSay(r === 'ok' ? 'Дело твоё. Вернись, когда закончишь.' : r === 'full' ? 'Руки заняты. Сначала закончи начатое.' : ''); }
        render();
      });
      box.appendChild(b);
    }
    return box;
  }

  function renderQuests() {
    list.textContent = '';
    const ready = Q.readyToClaim(), active = Q.activeList(), avail = Q.available();
    if (ready.length) { list.appendChild(h('div', 'qhead', 'Готово к сдаче')); ready.forEach(q => list.appendChild(questBlock(q, 'done'))); }
    if (active.length) { list.appendChild(h('div', 'qhead', `В работе (${active.length}/${CFG.quests.maxActive})`)); active.forEach(q => list.appendChild(questBlock(q, 'active'))); }
    if (avail.length) { list.appendChild(h('div', 'qhead', 'Доступно')); avail.forEach(q => list.appendChild(questBlock(q, 'avail'))); }
    if (!ready.length && !active.length && !avail.length) list.appendChild(h('div', 'tnote', 'Все задания выполнены. Хранитель молча смотрит в огонь.'));
  }

  function render() {
    const isKeeper = kind === 'keeper';
    $('tTitle').textContent = kind === 'merchant' ? 'Торговец' : isKeeper ? 'Хранитель костра' : 'Кузнец';
    $('tAsh').textContent = 'Пепел: ' + P.ash;
    list.hidden = !isKeeper; grid.hidden = isKeeper; foot.hidden = isKeeper;
    if (isKeeper) { tabs.hidden = true; sheet.hidden = true; foot.textContent = ''; renderQuests(); return; }
    renderTabs();
    grid.textContent = ''; foot.textContent = '';
    grid.className = kind === 'merchant' && tab === 'buy' ? 'g4' : 'g5';
    if (kind === 'merchant' && tab === 'buy') {
      const items = stock();
      items.forEach((e, i) => grid.appendChild(makeCell(doc, e.item, { key: 'b' + i, price: e.cost, priceBad: P.ash < e.cost, sel: sel && sel.i === i })));
      if (!items.length) foot.appendChild(h('div', 'tnote', 'Товар раскуплен. Новый появится после Предвестника.'));
      else foot.appendChild(h('div', 'tnote', 'Новый товар — после каждого Предвестника. Клеймёное здесь не продаётся: его добывают в бою.'));
    } else if (kind === 'merchant') {
      for (let i = 0; i < CFG.items.bagSize; i++) {
        const it = P.bag[i] || null;
        grid.appendChild(makeCell(doc, it, { key: 'b' + i, price: it ? sellValue(it) : null, sel: sel && sel.i === i }));
      }
      const n = junkCount();
      const j = h('button', 'cbtn junk', n ? `Продать весь хлам (${n})` : 'Хлама нет'); j.type = 'button'; j.disabled = !n;
      j.addEventListener('click', () => {
        if (!confirmer.is('junk')) { confirmer.arm('junk'); render(); return; }
        confirmer.clear(); const r = sellJunk(); setSay(`Продано ${r.n} шт. за ${r.ash} пепла.`); sfx.loot(); sel = null; render();
      });
      if (confirmer.is('junk')) { j.textContent = 'Точно?'; j.classList.add('warn'); }
      foot.appendChild(j);
    } else {
      const list = upgradables();
      list.forEach((u, i) => grid.appendChild(makeCell(doc, u.it, { key: 'u' + i, mark: u.src === 'eq' ? 'надето' : '', sel: sel && sel.i === i })));
      if (!list.length) foot.appendChild(h('div', 'tnote', 'Нет оружия для улучшения. Наденьте или возьмите в сумку клинок.'));
      else foot.appendChild(h('div', 'tnote', `Улучшение до +${CFG.smith.maxLevel}. С +${CFG.smith.breakFrom} неудача ещё и снижает уровень. Оружие не ломается.`));
    }
    renderCard();
  }

  function renderCard() {
    if (!sel) { sheet.hidden = true; card.textContent = ''; return; }
    if (kind === 'merchant' && tab === 'buy') {
      const e = stock()[sel.i];
      if (!e) { sel = null; sheet.hidden = true; return; }
      const d = defOf(e.item), can = P.ash >= e.cost && !bagFull();
      renderItemCard(doc, card, e.item, {
        worn: P.eq[d.slot], confirmer, rerender: renderCard,
        lines: [P.ash < e.cost ? `Не хватает пепла: нужно ещё ${e.cost - P.ash}` : bagFull() ? 'Сумка полна' : (P.eq[d.slot] ? 'Сравнение с надетым: ' + itemName(P.eq[d.slot]) : 'В этом слоте ничего не надето')],
        buttons: [
          { label: 'Купить за ' + e.cost, cls: 'main', disabled: !can, confirmKey: d.rarity === 'cursed' ? 'b' + e.item.uid : null, onClick: () => {
            const r = buy(sel.i); sel = null;
            setSay(r === 'ok' ? 'Забирай: ' + itemName(e.item) + '.' : r === 'ash' ? 'Пепла не хватает.' : r === 'bag' ? 'Сумка полна.' : '');
            if (r === 'ok') sfx.loot(d.rarity); render(); } },
          { label: 'Закрыть', cls: 'close', onClick: () => { sel = null; render(); } }
        ]
      });
    } else if (kind === 'merchant') {
      const it = P.bag[sel.i];
      if (!it) { sel = null; sheet.hidden = true; return; }
      const d = defOf(it), rare = d.rarity !== 'common';
      renderItemCard(doc, card, it, {
        worn: P.eq[d.slot], confirmer, rerender: renderCard,
        lines: ['Торговец даёт ' + sellValue(it) + ' пепла'],
        buttons: [
          { label: 'Продать +' + sellValue(it), cls: 'main', confirmKey: rare ? 's' + it.uid : null, onClick: () => { const v = sellFromBag(sel.i); sel = null; setSay('Беру за ' + v + '.'); render(); } },
          { label: 'Закрыть', cls: 'close', onClick: () => { sel = null; render(); } }
        ]
      });
    } else {
      const u = upgradables()[sel.i];
      if (!u) { sel = null; sheet.hidden = true; return; }
      const it = u.it, d = defOf(it), isMax = maxed(it);
      const { now, next } = dmgNowNext(it), cost = upgradeCost(it), chance = upgradeChance(it);
      const rows = [{ k: 'dmg', now, text: isMax ? '+' + now : `+${now} → +${next}`, diff: null }];
      const dd = isMax ? [] : [`Цена: ${cost} пепла · шанс успеха ${Math.round(chance * 100)}%`,
        (it.up || 0) >= CFG.smith.breakFrom ? 'При неудаче пепел сгорает, а уровень может упасть.' : chance < 1 ? 'При неудаче пепел сгорает.' : 'Успех гарантирован.'];
      renderItemCard(doc, card, it, {
        sub: u.src === 'eq' ? 'надето' : '', rows, confirmer, rerender: renderCard,
        lines: isMax ? ['Предельный уровень улучшения.'] : dd,
        buttons: [
          { label: isMax ? 'Предел' : 'Улучшить за ' + cost, cls: 'main', disabled: isMax || P.ash < cost, onClick: () => {
            const r = tryUpgrade(it);
            if (r.r === 'success') { setSay(`Удалось! ${itemName(it)}.`); sfx.anvil(true); }
            else if (r.r === 'fail') { setSay('Не вышло. Пепел сгорел.'); sfx.anvil(false); }
            else if (r.r === 'down') { setSay(`Сталь треснула: уровень упал до +${r.up}.`); sfx.anvil(false); }
            else if (r.r === 'ash') setSay('Не хватает пепла.');
            render(); } },
          { label: 'Закрыть', cls: 'close', onClick: () => { sel = null; render(); } }
        ]
      });
      if (P.ash < cost && !isMax) card.appendChild(h('div', 'cvs', `Не хватает пепла: нужно ещё ${cost - P.ash}`));
    }
    sheet.hidden = false;
  }

  grid.addEventListener('click', e => {
    const b = e.target.closest('.cell'); if (!b) return;
    const i = Number(b.dataset.key.slice(1));
    confirmer.clear();
    const has = kind === 'merchant' && tab === 'buy' ? !!stock()[i] : kind === 'merchant' ? !!P.bag[i] : !!upgradables()[i];
    sel = has ? { i } : null; render();
  });
  sheet.addEventListener('click', e => { if (e.target === sheet) { confirmer.clear(); sel = null; render(); } });

  function openFor(npc) {
    if (!npc || !W.started || P.dead) return;
    if (W.paused && !open_) return;
    if (open_) close();
    kind = npc.id; tab = 'buy'; sel = null; open_ = true; W.paused = true; lineN = (Math.random() * 4) | 0;
    keys.l = keys.r = keys.atk = keys.jump = false;
    setSay(randomLine());
    root.hidden = false; render();
  }
  function close() {
    if (!open_) return;
    open_ = false; W.paused = false; sel = null; confirmer.clear(); root.hidden = true; sheet.hidden = true;
    onClose && onClose();
  }
  $('tClose').addEventListener('click', close);
  $('talk').addEventListener('click', () => openFor(nearNpc()));
  doc.defaultView.addEventListener('keydown', e => { if (e.key === 'e' || e.key === 'E') { if (open_) close(); else openFor(nearNpc()); } if (e.key === 'Escape') close(); });

  return { openFor, close, render, isOpen: () => open_, kind: () => kind, tab: () => tab };
}
