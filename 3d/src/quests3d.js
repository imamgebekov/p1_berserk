// Задания: выдача, прогресс по событиям мира, сдача и награды. Чистая логика (Node-тесты).
import { QUESTS, QUEST_BY_ID } from './data/quests3d.js';
import { ACT_ALL } from './data/story3d.js';
import { BY_ID } from './data/items.js';
import { addItem, removeAt, countOf } from './inv.js';

export const MAX_ACTIVE = 8;
const stateOf = (W, id) => W.quests[id] || null;

// состояние задания для игрока: 'done' | 'cooldown' | 'ready' | 'active' | 'locked' | 'available'
export function questState(W, q) {
  const st = stateOf(W, q.id);
  if (st && st.s === 'done') {
    if (q.repeat && W.t - st.t >= q.repeat) return 'available';
    return q.repeat ? 'cooldown' : 'done';
  }
  if (st && st.s === 'active') return isReady(W, q, st) ? 'ready' : 'active';
  if (q.after && !(stateOf(W, q.after) && stateOf(W, q.after).s === 'done')) return 'locked';
  if (q.story && W.story && W.story.i <= ACT_ALL.findIndex(c => c.id === q.story)) return 'locked';     // задания отряда — по сюжету (этап 3)
  return 'available';
}
function isReady(W, q, st) {
  if (q.type === 'bring') return countOf(W.inv, q.item) >= q.n;
  if (q.type === 'kill' || q.type === 'open') return st.n >= q.n;
  return !!st.ok;
}
export const progressOf = (W, q) => { const st = stateOf(W, q.id); if (!st || st.s !== 'active') return null; return q.type === 'bring' ? [Math.min(q.n, countOf(W.inv, q.item)), q.n] : (q.type === 'kill' || q.type === 'open') ? [Math.min(q.n, st.n), q.n] : [st.ok ? 1 : 0, 1]; };
export const activeCount = W => Object.values(W.quests).filter(s => s.s === 'active').length;
export const questsOf = (W, giver) => QUESTS.filter(q => q.giver === giver);

export function acceptQuest(W, id) {
  const q = QUEST_BY_ID[id]; if (!q) return 'none';
  if (W.nearNpc !== q.giver) return 'far';
  const s = questState(W, q); if (s !== 'available') return s;
  if (activeCount(W) >= MAX_ACTIVE) return 'full';
  W.quests[id] = { s: 'active', n: 0, ok: false, t: 0 };
  // «разовые» цели считаются сразу, если условие уже выполнено до принятия (книга прочитана, место посещено)
  const st = W.quests[id];
  if (q.type === 'tome' && W.known.tomes[q.tome]) st.ok = true;
  if (q.type === 'visit' && W.known.places[q.place]) st.ok = true;
  W.ev.push({ k: 'questaccept', name: q.name });
  return 'ok';
}

// событие мира: kill {enemy}, boss {boss}, visit {place}, craft {item}, tome {tome}, open {kind}, hire {}
export function questEvent(W, type, d = {}) {
  for (const q of QUESTS) {
    const st = stateOf(W, q.id); if (!st || st.s !== 'active' || st.ok) continue;
    let hit = false;
    if (q.type === 'kill' && type === 'kill' && d.enemy === q.enemy && st.n < q.n) { st.n++; hit = true; }
    else if (q.type === 'open' && type === 'open' && (!q.kind || q.kind === d.kind) && st.n < q.n) { st.n++; hit = true; }
    else if (q.type === 'boss' && type === 'boss' && d.boss === q.boss) { st.ok = true; hit = true; }
    else if (q.type === 'visit' && type === 'visit' && d.place === q.place) { st.ok = true; hit = true; }
    else if (q.type === 'craft' && type === 'craft' && d.item === q.item) { st.ok = true; hit = true; }
    else if (q.type === 'tome' && type === 'tome' && d.tome === q.tome) { st.ok = true; hit = true; }
    else if (q.type === 'hire' && type === 'hire') { st.ok = true; hit = true; }
    if (hit && isReady(W, q, st)) W.ev.push({ k: 'questready', name: q.name });
  }
}

// сдать: расходует предметы (для «принести»), выдаёт награду, лишнее кладёт на землю
export function claimQuest(W, id) {
  const q = QUEST_BY_ID[id]; if (!q) return 'none';
  if (W.nearNpc !== q.giver) return 'far';
  if (questState(W, q) !== 'ready') return 'notready';
  if (q.type === 'bring') { let left = q.n; for (let i = W.inv.bag.length - 1; i >= 0 && left > 0; i--) { const s = W.inv.bag[i]; if (s.id !== q.item) continue; const t = Math.min(left, s.n); removeAt(W.inv, i, t); left -= t; } }
  const r = q.reward;
  if (r.ash) W.inv.ash += r.ash;
  if (r.xp) W.fx.xp(r.xp);
  for (const [iid, n] of r.items || []) { const left = addItem(W.inv, iid, n, W.cfg.bag.slots + ((W.gear && W.gear.bag) || 0)); W.known.items[iid] = 1; if (left > 0) W.drops.push({ id: iid, n: left, x: W.player.x + 1, z: W.player.z, t: 0, cd: 0 }); }
  W.quests[id] = { s: 'done', n: 0, ok: false, t: W.t };
  W.ev.push({ k: 'questdone', name: q.name, ash: r.ash || 0, giver: q.giver });     // giver — для репутации (этап 6)
  return 'ok';
}
export function abandonQuest(W, id) { const st = stateOf(W, id); if (!st || st.s !== 'active') return false; delete W.quests[id]; return true; }

// метка над NPC: 'ready' (есть что сдать), 'available' (есть что взять) или null
export function questMark(W, giver) {
  let mark = null;
  for (const q of questsOf(W, giver)) { const s = questState(W, q); if (s === 'ready') return 'ready'; if (s === 'available') mark = 'available'; }
  return mark;
}
// строка для трекера: первое активное задание и его прогресс
export function trackerLine(W) {
  for (const q of QUESTS) { const st = stateOf(W, q.id); if (st && st.s === 'active') { const p = progressOf(W, q); const isReadyNow = questState(W, q) === 'ready'; return `${q.name}: ${isReadyNow ? 'сдать' : p && p[1] > 1 ? `${p[0]}/${p[1]}` : 'в пути'}`; } }
  return '';
}

// ---- сохранение ----
export const serializeQuests = Q => { const o = {}; for (const [id, s] of Object.entries(Q)) o[id] = { s: s.s, n: s.n | 0, ok: !!s.ok, t: Math.round(s.t || 0) }; return o; };
export function sanitizeQuests(d) {
  const out = {}; if (!d || typeof d !== 'object') return out;
  for (const [id, s] of Object.entries(d)) { const q = QUEST_BY_ID[id]; if (!q || !s || typeof s !== 'object') continue; if (s.s !== 'active' && s.s !== 'done') continue; out[id] = { s: s.s, n: Number.isFinite(s.n) ? Math.max(0, Math.min(q.n || 1, Math.floor(s.n))) : 0, ok: s.ok === true, t: Number.isFinite(s.t) ? s.t : 0 }; }
  return out;
}
