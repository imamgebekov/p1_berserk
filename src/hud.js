// HUD: сверяет DOM с состоянием игры. Пишет в DOM только при изменении значения
// (на iOS лишние записи каждый кадр заметно съедают время). Полосы — через transform.
import { CFG } from './config.js';
import { P, W } from './state.js';
import { clamp } from './util.js';
import { nearNpc } from './town.js';

export function createHud(doc) {
  const $ = id => doc.getElementById(id);
  const el = {
    hp: $('hpf'), rg: $('rgf'), rgbar: $('rgbar'), lv: $('lv'), ash: $('ash'), kills: $('kills'), onl: $('onl'),
    boss: $('boss'), bh: $('bhf'), tm: $('timer'), brand: $('bbrand'), dead: $('dead'), chat: $('chat'), badge: $('bagBadge'), talk: $('talk')
  };
  const last = {};
  const text = (k, node, v) => { if (last[k] !== v) { last[k] = v; node.textContent = v; } };
  const bar = (k, node, frac) => {
    const v = Math.round(clamp(frac, 0, 1) * 200) / 200;
    if (last[k] !== v) { last[k] = v; node.style.transform = 'scaleX(' + v + ')'; }
  };
  const flag = (k, node, cls, on) => { if (last[k] !== on) { last[k] = on; node.classList.toggle(cls, on); } };
  const hide = (k, node, hidden) => { if (last[k] !== hidden) { last[k] = hidden; node.hidden = hidden; } };

  const chatNodes = new Map();   // id → { node, old }

  function syncChat() {
    const ids = new Set();
    for (const m of W.chatLog) {
      ids.add(m.id);
      if (!chatNodes.has(m.id)) {
        const d = doc.createElement('div');
        d.className = m.kind;
        if (m.kind === 'sys') d.textContent = m.text;
        else if (m.kind === 'loot') { d.textContent = m.text; d.style.color = m.col; }
        else {
          const s = doc.createElement('span'); s.style.color = m.col; s.textContent = m.name + ': ';
          d.appendChild(s); d.appendChild(doc.createTextNode(m.text));
        }
        el.chat.appendChild(d);
        chatNodes.set(m.id, { node: d, old: false });
      }
      const rec = chatNodes.get(m.id), age = W.T - m.born;
      if (!rec.old && age > CFG.chat.fadeAfter) { rec.old = true; rec.node.classList.add('old'); }
      if (age > CFG.chat.removeAfter) ids.delete(m.id);
    }
    for (const [id, rec] of chatNodes) if (!ids.has(id)) { rec.node.remove(); chatNodes.delete(id); }
  }

  function update() {
    bar('hp', el.hp, P.hp / P.maxhp);
    bar('rg', el.rg, P.rage / CFG.rage.max);
    const full = P.rage >= CFG.rage.max && P.rageOn <= 0;
    flag('full', el.rgbar, 'full', full); flag('ready', el.brand, 'ready', full);
    text('lv', el.lv, String(P.lv)); text('ash', el.ash, String(P.ash)); text('kills', el.kills, String(P.kills));
    text('onl', el.onl, String(W.online));
    text('badge', el.badge, String(P.newItems)); hide('badge', el.badge, P.newItems <= 0);
    const npc = !P.dead && !W.paused ? nearNpc() : null;
    hide('talk', el.talk, !npc); if (npc) text('talkt', el.talk, npc.name);
    hide('boss', el.boss, !W.boss);
    hide('dead', el.dead, !P.dead);
    if (W.boss) { bar('bh', el.bh, W.boss.hp / W.boss.maxhp); text('tm', el.tm, ''); }
    else {
      const t = Math.max(0, Math.ceil(W.timer));
      text('tm', el.tm, 'Затмение через ' + Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'));
    }
    syncChat();
  }

  return { update };
}
