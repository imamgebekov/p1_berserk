// Движок сюжета (этап 3, 2026-10-19): сцены Акта I по порядку. Состояние — W.story { i, st, n, t, won, wave, foes, allies }:
// st — 'wait' (ждёт разговора с тем, кто начинает), 'goal' (идёт цель), 'outro' (ждёт разговора в конце), 'end' (акт пройден).
// Разговор показывает интерфейс: storyTalk(W, kind) отдаёт реплики, storyTalked(W) — разговор окончен. Чистая логика (Node-тесты).
import { ACT1, SPEAKERS } from './data/story3d.js';
import { spawnEnemy, killEnemy } from './sim.js';
import { spawnAlly } from './squad3d.js';
import { resolve } from './map.js';
import { addItem, entryOf, roomFor, nomIl } from './inv.js';
import { BY_ID } from './data/items.js';
import { gainXp } from './progress3d.js';
import { len } from './util3d.js';

export const ACT = ACT1;
const sc = W => ACT[W.story.i] || null;
export const storyFresh = () => ({ i: 0, st: 'wait', n: 0, t: 0, won: false, wave: 0, foes: [], allies: [] });
const mul = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const srng = W => W.srng || (W.srng = mul((W.cfg.world.seed || 1) * 4421 + 7));     // свой генератор: бой и добыча не сдвигаются

// ---- места ----
const surfMap = W => (W.levels ? W.levels.surface.map : W.map);
function spotOf(W, at) {
  const M = W.cfg.map, camp = W.cfg.camp || { x: 0, z: 0, r: 30 };
  if (at === 'gate') return { x: camp.x, z: camp.z + camp.r + 9 };
  if (at === 'band') return { x: camp.x - 13, z: camp.z - 7 };
  const hub = (M.places || []).find(p => p.hub === 'olkh') || { x: 130, z: 150 };
  if (at === 'hubolkh') return { x: hub.x, z: hub.z };
  if (at === 'ford') { const d = Math.hypot(hub.x - camp.x, hub.z - camp.z) || 1, k = Math.min(1, W.cfg.story.fordAt / d); return { x: camp.x + (hub.x - camp.x) * k, z: camp.z + (hub.z - camp.z) * k }; }
  const p = (M.places || []).find(q => q.id === at); return p ? { x: p.x, z: p.z } : { x: camp.x, z: camp.z };
}
const place = (W, at, off) => { const s = spotOf(W, at), o = { x: s.x + (off ? off[0] : 0), z: s.z + (off ? off[1] : 0) }; try { resolve(surfMap(W), o, .5); } catch (e) { /* без карты — как есть */ } return o; };

// ---- кто стоит в мире: [{ kind, name, tint, x, z, mark: '!' | '?' | null }] ----
export function storyActors(W) {
  const S = W.story, c = S && sc(W); if (!c || S.st === 'end' || W.lvl !== 'surface') return [];
  const duel = S.st === 'goal' && c.goal.type === 'duel', esc = S.st === 'goal' && c.goal.type === 'escort';
  const out = [];
  for (const [kind, at, off] of c.actors) {
    if ((duel && kind === c.goal.foe) || (esc && kind === c.goal.who) || (S.allies.length && (c.goal.party || []).includes(kind))) continue;     // в бою и в проводах — не стоят на месте
    const q = place(W, at, off), mark = S.st === 'wait' && c.giver === kind ? '!' : S.st === 'outro' && (c.outroAt || c.giver) === kind ? '?' : null;
    out.push({ kind, name: SPEAKERS[kind].name, tint: SPEAKERS[kind].tint, x: q.x, z: q.z, mark });
  }
  return out;
}
// с кем можно говорить по сюжету (иначе — обычное окно жителя)
export function storyTalkable(W, kind) {
  const S = W.story, c = S && sc(W); if (!c) return false;
  return (S.st === 'wait' && c.giver === kind) || (S.st === 'outro' && (c.outroAt || c.giver) === kind);
}
// реплики разговора: { lines, part: 'intro' | 'outro' } или null
export function storyTalk(W, kind) {
  const S = W.story, c = S && sc(W); if (!c) return null;
  if (S.st === 'wait' && (c.auto || c.giver === kind)) return { lines: c.intro, part: 'intro', scene: c.name };
  if (S.st === 'outro' && (c.outroAt || c.giver) === kind) return { lines: S.won && c.outroWin ? c.outroWin : c.outro, part: 'outro', scene: c.name };
  return null;
}
// разговор окончен: intro → цель; outro → награда и следующая сцена
export function storyTalked(W, part) {
  const S = W.story; if (!S) return;
  if (part === 'intro' && S.st === 'wait') startGoal(W);
  else if (part === 'outro' && S.st === 'outro') finish(W);
}
// сцена, которая начинается сама (пролог), ждёт показа: интерфейс спрашивает и показывает
export const storyAutoPending = W => { const S = W.story, c = S && sc(W); return !!(c && S.st === 'wait' && c.auto && !S.autoShown); };

function startGoal(W) {
  const S = W.story, c = sc(W), G = c.goal, rng = srng(W); S.st = 'goal'; S.n = 0; S.t = 0; S.wave = 0; S.won = false; S.foes = []; S.allies = [];
  const at = G.at ? place(W, G.at) : null;
  for (const [type, n] of G.spawn || []) for (let k = 0; k < n; k++) { const a = rng() * 6.283, d = (G.r || 12) * (.3 + rng() * .4); const e = spawnEnemy(W, type, at.x + Math.sin(a) * d, at.z + Math.cos(a) * d); e.alert = true; e.storyFoe = true; S.foes.push(e.id); }
  for (const kind of G.party || []) S.allies.push(storyAlly(W, kind).id);
  if (G.type === 'duel') { const ac = c.actors.find(x => x[0] === G.foe), q = ac ? place(W, ac[1], ac[2]) : place(W, G.at), e = spawnEnemy(W, G.foe, q.x, q.z);     // там, где стоял (не в доме)
    e.duel = true; e.alert = true; e.storyFoe = true; S.foes.push(e.id); W.duelOn = true; }
  if (G.type === 'escort') S.allies.push(storyAlly(W, G.who).id);
  W.ev.push({ k: 'storyGoal', name: c.name, text: c.goalText });
  if (G.type === 'none') toOutro(W);
}
function storyAlly(W, kind) { const a = spawnAlly(W, kind); a.story = true; a.name = SPEAKERS[kind].name; return a; }
function clearScene(W) {
  const S = W.story;
  for (const id of S.foes) { const e = W.enemies.find(q => q.id === id); if (e && !e.dead) { e.dead = true; e.deadT = 9; e.noLoot = true; } }
  W.allies = W.allies.filter(a => !(a.story && S.allies.includes(a.id))); S.foes = []; S.allies = []; W.duelOn = false;
}
function toOutro(W) { const c = sc(W); clearScene(W); if (c.outro && c.outro.length) W.story.st = 'outro'; else finish(W); }
function finish(W) {
  const S = W.story, c = sc(W), R = c.reward || {};
  if (R.xp) gainXp(W, R.xp);
  if (R.ash) W.inv.ash += R.ash;
  for (const [id, n] of R.items || []) { const it = BY_ID[id]; if (!it) continue; const mx = W.cfg.bag.slots + ((W.gear && W.gear.bag) || 0);
    if (it.slot && roomFor(W.inv, id, mx)) W.inv.bag.push(entryOf(id, 0, null, Math.max(nomIl(it), W.lv))); else if (addItem(W.inv, id, n, mx) > 0) W.drops.push({ id, n, x: W.player.x + 1, z: W.player.z, t: 0, cd: 0 });
    W.known.items[id] = 1; }
  clearScene(W);
  W.ev.push({ k: 'storyDone', name: c.name, end: !!c.end });
  S.i++; S.st = S.i >= ACT.length ? 'end' : 'wait'; S.n = 0; S.won = false; S.autoShown = false;
}
// бой-события из симуляции
export function storyKill(W, e) {
  const S = W.story, c = S && sc(W); if (!c || S.st !== 'goal' || c.goal.type !== 'kill') return;
  const G = c.goal, at = place(W, G.at); if (G.enemy && e.type !== G.enemy) return; if (len(e.x - at.x, e.z - at.z) > G.r) return;
  S.n++; if (S.n >= G.n) toOutro(W);
}
export function storyBoss(W, type) { const S = W.story, c = S && sc(W); if (c && S.st === 'goal' && c.goal.type === 'boss' && c.goal.boss === type) toOutro(W); }
// поединок: герой не гибнет — бой кончается на доле здоровья
export function duelGuard(W, dmg) { const p = W.player; return W.duelOn && p.hp - dmg < 1 ? Math.max(0, p.hp - 1) : dmg; }

// раз в шаг
export function storyTick(W, dt) {
  const S = W.story, c = S && sc(W); if (!c || S.st !== 'goal') return;
  const G = c.goal, p = W.player;
  if (G.type === 'spark') { if (!W.spark || W.spark.done) toOutro(W); return; }
  if (G.type === 'quests') { const n = G.list.filter(id => W.quests[id] && W.quests[id].s === 'done').length; S.n = n; if (n >= G.n) toOutro(W); return; }
  if (G.type === 'duel') { const e = W.enemies.find(q => q.duel && !q.dead);
    if (!e) { S.won = true; toOutro(W); return; }
    if (e.hp <= e.maxhp * G.yieldFoe) { S.won = true; toOutro(W); return; }
    if (p.hp <= p.maxhp * G.yieldHero) { S.won = false; p.hp = Math.max(p.hp, p.maxhp * G.yieldHero); toOutro(W); }
    return; }
  if (G.type === 'defend') {
    if (p.dead) { clearScene(W); S.st = 'wait'; W.ev.push({ k: 'storyFail', name: c.name }); return; }
    S.t += dt; const at = place(W, G.at), every = G.t / G.waves, rng = srng(W);
    while (S.wave < G.waves && S.t >= S.wave * every) { S.wave++; for (let k = 0; k < G.n; k++) { let t = G.types[0][0], w = rng() * G.types.reduce((a, q) => a + q[1], 0); for (const [tt, ww] of G.types) { w -= ww; if (w <= 0) { t = tt; break; } }
      const a = rng() * 6.283, d = 14 + rng() * 5, e = spawnEnemy(W, t, at.x + Math.sin(a) * d, at.z + Math.cos(a) * d); e.alert = true; e.storyFoe = true; S.foes.push(e.id); } W.ev.push({ k: 'storyWave', n: S.wave, of: G.waves }); }
    if (S.t >= G.t) toOutro(W);
    return; }
  if (G.type === 'escort') { const a = W.allies.find(q => q.story && S.allies.includes(q.id)), to = place(W, G.to); if (a && len(a.x - to.x, a.z - to.z) < G.r && len(p.x - to.x, p.z - to.z) < G.r + 4) toOutro(W); }
}
// строка цели и точка на карте
export function storyGoal(W) {
  const S = W.story, c = S && sc(W); if (!c || S.st === 'end') return null;
  const lv = W.lv < c.lv ? ` (рек. ур. ${c.lv})` : '', head = `Акт I · ${c.name}: `;
  const who = k => SPEAKERS[k].name.split(',')[0];
  if (S.st === 'wait') { if (c.auto) return { text: head + 'начало', at: null }; const a = storyActors(W).find(q => q.kind === c.giver); return { text: head + `поговорите: ${who(c.giver)}` + lv, at: a ? { x: a.x, z: a.z } : null }; }
  if (S.st === 'outro') { const k = c.outroAt || c.giver, a = storyActors(W).find(q => q.kind === k); return { text: head + `вернитесь: ${who(k)}`, at: a ? { x: a.x, z: a.z } : null }; }
  const G = c.goal, at = G.at ? place(W, G.at) : G.to ? place(W, G.to) : G.boss ? (() => { const d = W.cfg.bosses.list.find(b => b.type === G.boss); return d ? { x: d.x, z: d.z } : null; })() : null;
  const prog = G.type === 'kill' ? ` — ${S.n}/${G.n}` : G.type === 'quests' ? ` — ${S.n}/${G.n}` : G.type === 'defend' ? ` — ${Math.max(0, Math.ceil(G.t - S.t))} с, волна ${S.wave}/${G.waves}` : '';
  return { text: head + c.goalText + prog + lv, at };
}
// индекс сцены по id (для заданий, открывающихся по сюжету)
export const sceneIndex = id => ACT.findIndex(c => c.id === id);

// ---- сохранение: бой в разгаре (поединок, оборона, проводы, бой с отрядом) не сохраняется — сцена снова ждёт разговора ----
export const serializeStory = S => (S ? { i: S.i, st: S.st === 'goal' && ['kill', 'quests', 'boss', 'spark'].includes((ACT[S.i] || {}).goal?.type) && !(ACT[S.i].goal.party) ? 'goal' : S.st === 'goal' ? 'wait' : S.st, n: S.n | 0 } : null);
export function sanitizeStory(d) {
  const S = storyFresh(); if (!d || typeof d !== 'object') return S;
  S.i = Number.isInteger(d.i) && d.i >= 0 ? Math.min(ACT.length, d.i) : 0;
  S.st = S.i >= ACT.length ? 'end' : ['wait', 'goal', 'outro'].includes(d.st) ? d.st : 'wait'; S.n = Number.isFinite(d.n) && d.n > 0 ? Math.floor(d.n) : 0;
  if (S.st === 'goal' && ACT[S.i].goal.spawn) S.st = 'wait';     // бой со своими врагами — заново с разговора
  return S;
}
