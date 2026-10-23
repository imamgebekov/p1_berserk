// Окно хранительницы печатей (2026-10-23): 8 даров Затмения за печати. У героя один дар; новый вытесняет прежний без возврата —
// поэтому замена спрашивает второе нажатие. Логика — relic3d.js, числа — cfg.relic.
import { buyPerk, perkOf } from './relic3d.js';
import { refreshGear } from './sim.js';

export function createRelic(doc, W, cfg, { onOpen, onClose, onChange } = {}) {
  const $ = id => doc.getElementById(id);
  const root = $('relic'), listEl = $('relicList'), headEl = $('relicHead'), flashEl = $('relicFlash'), noteEl = $('relicNote');
  let flashT = 0, armed = null;
  const C = cfg.relic;
  const el = (tag, cls, txt) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const flash = t => { flashEl.textContent = t; clearTimeout(flashT); flashT = setTimeout(() => { flashEl.textContent = ''; }, 2400); };
  const MSG = { far: 'Подойдите к хранительнице', lv: `Дары даются с ${C.minLv}-го уровня`, seals: 'Не хватает печатей', have: 'Этот дар уже ваш' };
  function row(id) {
    const K = C.perks[id], mine = W.inv.perk === id, r = el('div', 'srow' + (mine ? ' mine' : ''));
    const info = el('div', 'sinfo'), nm = el('span', 'nm', K.name); info.append(nm);
    if (mine) info.append(el('span', 'up', perkOf(W) ? 'ваш дар' : `ваш дар · спит до ${C.minLv}-го`));
    info.append(el('div', 'sub', K.text));
    const seals = W.inv.seals || 0, can = !mine && W.lv >= C.minLv && seals >= C.price, swap = !!W.inv.perk && !mine;
    const b = el('button', 'buy' + (can ? '' : ' no'), mine ? 'Ваш' : swap ? (armed === id ? `Заменить? прежний пропадёт` : `Заменить · ${C.price}`) : `Взять · ${C.price}`); b.type = 'button';
    b.addEventListener('click', () => {
      if (mine) return;
      if (swap && can && armed !== id) { armed = id; render(); return; }     // замена — вторым нажатием: прежний дар не вернуть
      const res = buyPerk(W, id); armed = null;
      if (res === 'ok') flash(`Дар «${K.name}» ваш`); else flash(MSG[res] || '');
      refreshGear(W); render(); onChange && onChange();
    });
    r.append(info, b); return r;
  }
  function render() {
    const seals = W.inv.seals || 0, cur = W.inv.perk && C.perks[W.inv.perk];
    headEl.textContent = `Дары Затмения · печатей ${seals}`;
    noteEl.textContent = `Печати падают с боссов: подземелье — ${C.drop.dungeon}, рейд — ${C.drop.raid}. Дар стоит ${C.price} печатей, даётся с ${C.minLv}-го уровня. У героя один дар — свой у каждого героя. Новый дар вытесняет прежний навсегда.` + (cur ? ` Сейчас: «${cur.name}».` : '') + (W.lv < C.minLv ? ` Вам рано: уровень ${W.lv}.` : '');
    listEl.textContent = '';
    for (const id of Object.keys(C.perks)) listEl.appendChild(row(id));
  }
  const open = () => { armed = null; render(); root.hidden = false; onOpen && onOpen(); };
  const close = () => { root.hidden = true; onClose && onClose(); };
  $('relicClose').addEventListener('click', close);
  return { open, close, render, isOpen: () => !root.hidden };
}
