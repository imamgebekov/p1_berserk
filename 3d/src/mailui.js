// Окно почты и гильдии (2026-11-05): вкладки «Письма» и «Гильдия». Логика — mail3d.js; здесь только разметка.
import { BY_ID } from './data/items.js';
import * as M from './mail3d.js';
import { arenaOf, leaderboard, placeOf } from './arena3d.js';

export function createMail(doc, W, cfg, { onOpen, onClose, onChange } = {}) {
  const $ = id => doc.getElementById(id), root = $('mail'), bodyEl = $('mailBody'), tabsEl = $('mailTabs'), flashEl = $('mailFlash'), subEl = $('mailSub');
  const el = (tag, cls, txt) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  let tab = 'letters', sel = null, flashT = 0, lastKey = '';
  const MSG = { place: 'Вложения — только наверху', danger: 'Рядом враги', full: 'Сумка полна', empty: 'Вложений нет', att: 'Сначала заберите вложение', none: 'Письма нет' };
  const flash = (t, good) => { flashEl.textContent = t; flashEl.className = good ? 'good' : ''; clearTimeout(flashT); flashT = setTimeout(() => { flashEl.textContent = ''; }, 2600); };
  const when = t => { const d = Math.floor(t / cfg.daynight.len), h = Math.floor((t % cfg.daynight.len) / cfg.daynight.len * 24); return `день ${d + 1}, ${String(h).padStart(2, '0')}:00`; };
  for (const [id, label] of [['letters', 'Письма'], ['guild', 'Гильдия'], ['world', 'Общий чат'], ['arena', 'Арена']]) { const b = el('button', 'tab', label); b.type = 'button'; b.dataset.tab = id; b.addEventListener('click', () => { tab = id; render(true); }); tabsEl.append(b); }

  function lettersView() {
    const box = M.mailOf(W).box; if (!box.length) { bodyEl.append(el('div', 'mempty', 'Писем нет.')); return; }
    const list = el('div', 'mlist');
    for (const l of box) {
      const row = el('div', 'mrow' + (l.read ? '' : ' unread') + (sel === l.id ? ' open' : '')), head = el('button', 'mhead'); head.type = 'button';
      head.append(el('b', null, l.subj || '(без темы)'), el('span', null, l.from + (M.hasAtt(l) ? ' · вложение' : '') + ' · ' + when(l.t)));
      head.addEventListener('click', () => { sel = sel === l.id ? null : l.id; M.readLetter(W, l.id); onChange && onChange(); render(true); }); row.append(head);
      if (sel === l.id) {
        const d = el('div', 'mdet'); d.append(el('div', 'mtext', l.text));
        if (M.hasAtt(l)) { const a = el('div', 'matt'); const parts = []; if (l.ash) parts.push(`${l.ash} пепла`); for (const e of l.items) parts.push(BY_ID[e.id].name + (e.n > 1 ? ' ×' + e.n : '')); a.textContent = 'Вложение: ' + parts.join(', '); d.append(a); }
        const acts = el('div', 'macts');
        if (M.hasAtt(l)) { const b = el('button', 'mbtn', 'Забрать'); b.type = 'button'; b.addEventListener('click', () => { const r = M.take(W, l.id); if (r === 'ok' || r === 'part') flash('Забрано', true); else flash(MSG[r] || 'Нельзя'); onChange && onChange(); render(true); }); acts.append(b); }
        if (l.act === 'guild' && l.gid && !M.inGuild(W)) { const b = el('button', 'mbtn', 'Вступить в гильдию'); b.type = 'button'; b.addEventListener('click', () => { const r = M.joinGuild(W, l.gid); if (r !== 'ok') { flash(r === 'have' ? 'Вы уже в гильдии' : 'Гильдия недоступна'); render(true); return; } l.act = null; flash('Вы в гильдии', true); onChange && onChange(); tab = 'guild'; render(true); }); acts.append(b); }
        const x = el('button', 'mbtn ghost', 'Удалить'); x.type = 'button'; x.addEventListener('click', () => { const r = M.remove(W, l.id); if (r !== 'ok') flash(MSG[r] || 'Нельзя'); else { sel = null; onChange && onChange(); } render(true); }); acts.append(x);
        d.append(acts); row.append(d);
      }
      list.append(row);
    }
    bodyEl.append(list);
  }
  const rank = into => {
    const t = el('div', 'grank');
    M.guildStats(W).forEach((g, i) => { const r = el('div', 'grow' + (g.me ? ' me' : '')); r.append(el('span', 'gn', `${i + 1}. [${g.tag}] ${g.name}`), el('span', 'gs', `${g.online}/${g.members} · ур. ${g.lv} · убито ${g.kills}`));
      if (!M.inGuild(W) && g.members) { const b = el('button', 'mbtn', 'Вступить'); b.type = 'button'; b.addEventListener('click', () => { const x = M.joinGuild(W, g.id); if (x === 'ok') flash('Вы в гильдии «' + g.name + '»', true); onChange && onChange(); render(true); }); r.append(b); } t.append(r); });
    into.append(t);
  };
  const logView = (log, hint) => {
    const el0 = el('div', 'glog'); if (!log.length) el0.append(el('div', 'gline', hint)); for (const x of log) { const r = el('div', 'gline' + (x.me ? ' me' : '')); r.append(el('b', null, x.who + ': '), doc.createTextNode(x.text)); el0.append(r); } bodyEl.append(el0); el0.scrollTop = el0.scrollHeight;
  };
  function guildView() {
    const g = M.mailOf(W).g, my = M.myGuild(W);
    if (!my) { bodyEl.append(el('div', 'gname', 'Гильдии'), el('div', 'mtext', 'Выберите гильдию: в каждой свои люди, общий чат и подарок за вступление. Выйти можно в любой момент.')); rank(bodyEl); return; }
    bodyEl.append(el('div', 'gname', `[${my.tag}] ${my.name}`));
    const mem = M.membersOf(W, my.id); bodyEl.append(el('div', 'gsub', `В сети: ${mem.filter(a => !a.dead).length} из ${mem.length}`));
    logView(g.log, 'Пока тихо.');
    const q = el('div', 'gquick'); cfg.mail.guild.quick.forEach((t, i) => { const b = el('button', 'mbtn', t); b.type = 'button'; b.addEventListener('click', () => { M.say(W, i); onChange && onChange(); render(true); }); q.append(b); }); bodyEl.append(q);
    rank(bodyEl);
    const out = el('button', 'mbtn ghost', 'Выйти из гильдии'); out.type = 'button'; out.addEventListener('click', () => { M.leaveGuild(W); onChange && onChange(); render(true); }); bodyEl.append(out);
  }
  function worldView() { bodyEl.append(el('div', 'gname', 'Общий чат'), el('div', 'gsub', 'Слышно, что пишут игроки других гильдий и одиночки.')); logView(M.mailOf(W).world, 'Пока тихо.'); }
  function arenaView() {
    const S = arenaOf(W); bodyEl.append(el('div', 'gname', 'Арена'), el('div', 'gsub', `Рейтинг ${S.rating} · место ${placeOf(W)} · побед ${S.wins}, поражений ${S.losses} · серия ${S.streak} · лучший ${S.best}`));
    bodyEl.append(el('div', 'mtext', 'Вызов — у любого бота: «Поговорить» → «Дуэль». Ставка пеплом, при победе вернётся вдвое и с призом.'));
    const t = el('div', 'grank'); for (const r of leaderboard(W, 12)) { const row = el('div', 'grow' + (r.me ? ' me' : '')); row.append(el('span', 'gn', `${r.place}. ${r.name.replace(/_/g, ' ')}`), el('span', 'gs', `${r.rating} · ур. ${r.lv}`)); t.append(row); } bodyEl.append(t);
  }
  function render(force) {
    const Mb = M.mailOf(W), key = tab + '|' + arenaOf(W).rating + '|' + sel + '|' + Mb.box.length + '|' + Mb.g.log.length + '|' + Mb.world.length + '|' + Mb.g.in + '|' + M.unread(W);
    if (!force && key === lastKey) return; lastKey = key;
    subEl.textContent = M.unread(W) ? `Новых: ${M.unread(W)}` : ''; for (const b of tabsEl.children) b.classList.toggle('on', b.dataset.tab === tab);
    const keep = bodyEl.querySelector('.mlist') ? bodyEl.scrollTop : 0; bodyEl.textContent = ''; if (tab === 'letters') lettersView(); else if (tab === 'guild') guildView(); else if (tab === 'arena') arenaView(); else worldView(); bodyEl.scrollTop = keep;
  }
  const open = t => { if (t) tab = t; root.hidden = false; render(true); onOpen && onOpen(); };
  const close = () => { if (root.hidden) return; root.hidden = true; onClose && onClose(); };
  $('mailClose').addEventListener('click', close);
  root.addEventListener('click', e => { if (e.target === root) close(); });
  return { open, close, render, get isOpen() { return !root.hidden; } };
}
