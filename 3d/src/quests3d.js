// Задания: выдача, прогресс по событиям мира, сдача и награды. Чистая логика (Node-тесты).
import { QUESTS, QUEST_BY_ID } from './data/quests3d.js';
import { ACT_ALL } from './data/story3d.js';
import { BY_ID } from './data/items.js';
import { addItem, removeAt, countOf } from './inv.js';
import { spawnEnemy } from './sim.js';
import { storySpot } from './story3d.js';
import { len } from './util3d.js';
import { insideOf, insideCamp } from './map.js';

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
  if (q.type === 'track') return !!st.ok;
  return !!st.ok;
}
export const progressOf = (W, q) => { const st = stateOf(W, q.id); if (!st || st.s !== 'active') return null; return q.type === 'bring' ? [Math.min(q.n, countOf(W.inv, q.item)), q.n] : (q.type === 'kill' || q.type === 'open' || q.type === 'track') ? [Math.min(q.n, st.n), q.n] : q.type === 'defend' ? [st.ok ? q.waves.length : Math.max(0, (st.wave || 0) - 1), q.waves.length] : [st.ok ? 1 : 0, 1]; };
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
    else if ((q.type === 'hunt' || q.type === 'track') && type === 'kill' && st.foes && d.id === st.foes[0]) { st.ok = true; hit = true; }     // убит зверь задания (этап 5 «круче»)
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
  if (r.xp) W.fx.xp(r.xp, 'quest');
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
  for (const q of QUESTS) { const st = stateOf(W, q.id); if (st && st.s === 'active') return lineOf(W, q); }
  return '';
}

// ---- новые виды заданий (этап 5 «круче»): охота, «выследи», оборона; срок у задания (limit, с) ----
// Состояние сверх сохраняемого (foes, wave, gap, on) живёт только в памяти: после загрузки зверь и волны появятся заново.
const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const qrng = (W, id, k) => { let a = (hashStr(id) ^ ((W.cfg.world.seed || 1) * 7919 + k * 101)) >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
export const questSpot = (W, q) => storySpot(W, q.at, q.off);
// следы «выследи»: цепочка точек от места задания; одинаковы при каждой загрузке (своё зерно)
export function trackPts(W, q) {
  const T = W.cfg.quests.track, r = qrng(W, q.id, 1), out = [questSpot(W, q)], M = W.levels ? W.levels.surface.map : W.map, c = M.camp;
  let a = (c ? Math.atan2(out[0].x - c.x, out[0].z - c.z) : 0) + (r() - .5);     // следы уводят прочь от лагеря
  for (let i = 1; i < q.n; i++) {
    const d = T.step[0] + r() * (T.step[1] - T.step[0]), o = out[i - 1]; a += (r() - .5) * 1.2; let b = null;
    for (let k = 0; k < 9 && !b; k++) { const ak = a + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * .45, t = storySpot(W, 'xy', null, o.x + Math.sin(ak) * d, o.z + Math.cos(ak) * d); if (insideOf(M, t.x, t.z) < 0 && !(c && insideCamp(c, t.x, t.z, -8))) b = t; }     // не в доме и не у частокола
    out.push(b || storySpot(W, 'xy', null, o.x + Math.sin(a) * d, o.z + Math.cos(a) * d));
  }
  return out;
}
const alive = (W, id) => W.enemies.find(e => e.id === id && !e.dead) || null;
// зверь задания: сильнее обычного, с именем, встревожен; стая рядом. Свой генератор: бой не сдвигается
function spawnBeast(W, q, st, x, z) {
  const H = W.cfg.quests.hunt, keep = W.rng; W.rng = qrng(W, q.id, 2 + (W.qspawn = (W.qspawn || 0) + 1)); st.foes = [];
  try {
    const e = spawnEnemy(W, q.enemy, x, z); e.alert = true; e.qid = q.id; e.hp = e.maxhp = Math.round(e.maxhp * H.hp); e.dmgMul *= H.dmg; e.scaleMul = (e.scaleMul || 1) * H.scale;
    if (!e.elite) { e.elite = true; e.affName = 'Вожак'; e.affColor = '#ffd27a'; } e.chief = q.beast; st.foes.push(e.id);
    for (let i = 0; i < (q.pack || 0); i++) { const a = i * 2.4 + 1, m = spawnEnemy(W, q.packType || q.enemy, x + Math.sin(a) * 3, z + Math.cos(a) * 3); m.alert = true; m.qid = q.id; st.foes.push(m.id); }
  } finally { W.rng = keep; }
  W.ev.push({ k: 'questbeast', name: q.beast, x, z });
}
export function failQuest(W, q, why) { delete W.quests[q.id]; for (const e of W.enemies) if (e.qid === q.id) e.qid = null; W.ev.push({ k: 'questfail', name: q.name, why }); }
const ready = (W, q) => W.ev.push({ k: 'questready', name: q.name });
const TICK = {
  hunt(W, q, st, p) {
    if (st.foes && st.foes.length) { if (!alive(W, st.foes[0])) st.foes = null; return; }     // ушёл из мира (подземелье, выгрузка) — появится снова
    const s = questSpot(W, q); if (len(p.x - s.x, p.z - s.z) < W.cfg.quests.wake) spawnBeast(W, q, st, s.x, s.z);
  },
  track(W, q, st, p) {
    if (st.foes && st.foes.length) { if (!alive(W, st.foes[0])) st.foes = null; return; }
    const pts = trackPts(W, q), k = Math.min(st.n, pts.length - 1), t = pts[k];
    if (len(p.x - t.x, p.z - t.z) > W.cfg.quests.track.r) return;
    if (st.n < q.n - 1) { st.n++; W.ev.push({ k: 'questtrack', name: q.name, i: st.n, n: q.n }); return; }
    st.n = q.n; const a = Math.atan2(t.x - pts[Math.max(0, k - 1)].x, t.z - pts[Math.max(0, k - 1)].z), b = storySpot(W, 'xy', null, t.x + Math.sin(a) * 9, t.z + Math.cos(a) * 9);
    spawnBeast(W, q, st, b.x, b.z);
  },
  defend(W, q, st, p, dt) {
    const D = W.cfg.quests.defend, s = questSpot(W, q), d = len(p.x - s.x, p.z - s.z);
    if (!st.on) { if (d < D.r) { st.on = true; st.wave = 0; st.gap = 1; st.foes = []; W.ev.push({ k: 'questdefend', name: q.name, x: s.x, z: s.z }); } return; }
    if (d > D.leave) { st.on = false; for (const e of W.enemies) if (e.qid === q.id) e.qid = null; W.ev.push({ k: 'questleft', name: q.name }); return; }     // ушёл с поста — оборона сначала
    st.foes = st.foes.filter(id => alive(W, id)); if (st.foes.length) return;
    if (st.wave >= q.waves.length) { st.ok = true; ready(W, q); return; }
    if ((st.gap -= dt) > 0) return;
    const [type, n] = q.waves[st.wave], r = qrng(W, q.id, 50 + st.wave), keep = W.rng; W.rng = r;
    try { for (let i = 0; i < n; i++) { const a = r() * 6.283, rr = D.ring[0] + r() * (D.ring[1] - D.ring[0]), o = storySpot(W, 'xy', null, s.x + Math.sin(a) * rr, s.z + Math.cos(a) * rr), e = spawnEnemy(W, type, o.x, o.z); e.alert = true; e.qid = q.id; st.foes.push(e.id); } } finally { W.rng = keep; }
    st.wave++; st.gap = D.gap; W.ev.push({ k: 'questwave', name: q.name, i: st.wave, n: q.waves.length });
  }
};
export function questTick(W, dt) {
  const p = W.player; if (p.dead) return;
  for (const q of QUESTS) {
    const st = stateOf(W, q.id); if (!st || st.s !== 'active') continue;
    if (q.limit && !isReady(W, q, st) && (st.t = (st.t || 0) + dt) >= q.limit) { failQuest(W, q, 'time'); continue; }     // срок: st.t — сколько прошло
    if (W.lvl === 'surface' && TICK[q.type] && !st.ok) TICK[q.type](W, q, st, p, dt);
  }
}
// куда идти по заданию: готово — к выдавшему; место, логово босса, зверь, след, пост; «убей» — ближайший враг нужного вида
export function giverAt(W, kind, actors = []) {
  const M = W.levels ? W.levels.surface.map : W.map, b = M.buildings.find(q => q.npc && q.npc.kind === kind); if (b) return { x: b.npc.x, z: b.npc.z };
  const a = actors.find(q => q.kind === kind); return a ? { x: a.x, z: a.z } : null;
}
export function questTarget(W, q, actors = []) {
  const st = stateOf(W, q.id); if (!st || st.s !== 'active') return null;
  if (questState(W, q) === 'ready') return giverAt(W, q.giver, actors);
  const beast = st.foes && st.foes.length && alive(W, st.foes[0]);
  if (beast && (q.type === 'hunt' || q.type === 'track')) return { x: beast.x, z: beast.z };
  if (q.type === 'hunt' || q.type === 'defend') return questSpot(W, q);
  if (q.type === 'track') { const pts = trackPts(W, q); return pts[Math.min(st.n, pts.length - 1)]; }
  if (q.type === 'visit') { const pl = (W.cfg.map.places || []).find(x => x.id === q.place); return pl ? { x: pl.x, z: pl.z } : null; }
  if (q.type === 'boss') { const d = W.cfg.bosses.list.find(b => b.type === q.boss), dn = d && d.level && W.cfg.dungeons.list.find(x => x.id === d.level); return dn && dn.at ? { x: dn.at.x, z: dn.at.z } : d && Number.isFinite(d.x) ? { x: d.x, z: d.z } : null; }
  if (q.type === 'kill' && W.lvl === 'surface') { let best = null, bd = W.questFocus === q.id ? Infinity : W.cfg.quests.seek; for (const e of W.enemies) { if (e.dead || e.type !== q.enemy) continue; const d = len(e.x - W.player.x, e.z - W.player.z); if (d < bd) { bd = d; best = e; } } return best ? { x: best.x, z: best.z } : null; }     // выбранное задание («Вести») — ближайший враг этого вида где угодно
  return null;
}
const activeList = W => { const a = QUESTS.filter(q => { const st = stateOf(W, q.id); return st && st.s === 'active'; }); return a.filter(q => questState(W, q) === 'ready').concat(a.filter(q => questState(W, q) !== 'ready')); };
// метки на карте: [{ x, z, ready, name }] — все взятые задания с целью
export const questMarks = (W, actors = []) => activeList(W).map(q => { const t = questTarget(W, q, actors); return t ? { id: q.id, x: t.x, z: t.z, ready: questState(W, q) === 'ready', name: q.name } : null; }).filter(Boolean);
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function lineOf(W, q) {
  const st = stateOf(W, q.id), p = progressOf(W, q), rd = questState(W, q) === 'ready';
  const tail = rd ? 'сдать' : q.type === 'hunt' ? (st.foes && st.foes.length ? `убейте: ${q.beast}` : 'найдите логово') : q.type === 'track' ? (st.foes && st.foes.length ? `убейте: ${q.beast}` : `следы ${Math.min(st.n + 1, q.n)}/${q.n}`)
    : q.type === 'defend' ? (st.on ? `волна ${Math.max(1, st.wave || 0)}/${q.waves.length}` : 'встаньте на пост') : p && p[1] > 1 ? `${p[0]}/${p[1]}` : 'в пути';
  return `${q.name}: ${tail}${q.limit && !rd ? ` · ${mmss(Math.max(0, q.limit - (st.t || 0)))}` : ''}`;
}
// строки для трекера: до n взятых заданий, сначала готовые к сдаче
export const trackerLines = (W, n = 3) => activeList(W).slice(0, n).map(q => lineOf(W, q));

// ---- сохранение ----
export const serializeQuests = Q => { const o = {}; for (const [id, s] of Object.entries(Q)) o[id] = { s: s.s, n: s.n | 0, ok: !!s.ok, t: Math.round(s.t || 0) }; return o; };
export function sanitizeQuests(d) {
  const out = {}; if (!d || typeof d !== 'object') return out;
  for (const [id, s] of Object.entries(d)) { const q = QUEST_BY_ID[id]; if (!q || !s || typeof s !== 'object') continue; if (s.s !== 'active' && s.s !== 'done') continue; out[id] = { s: s.s, n: Number.isFinite(s.n) ? Math.max(0, Math.min(q.n || 1, Math.floor(s.n))) : 0, ok: s.ok === true, t: Number.isFinite(s.t) ? s.t : 0 }; }
  return out;
}
