// Движок сюжета (этап 3, 2026-10-19; акты подряд — этап 7): сцены всех актов по порядку. Состояние — W.story { i, st, n, t, won, wave, foes, allies }:
// st — 'wait' (ждёт разговора с тем, кто начинает), 'goal' (идёт цель), 'outro' (ждёт разговора в конце), 'end' (акт пройден).
// Разговор показывает интерфейс: storyTalk(W, kind) отдаёт реплики, storyTalked(W) — разговор окончен. Чистая логика (Node-тесты).
import { ACT_ALL, ACTS, SPEAKERS, END_ACTORS } from './data/story3d.js';
import { spawnEnemy, killEnemy, spawnBoss } from './sim.js';
import { spawnAlly } from './squad3d.js';
import { resolve } from './map.js';
import { addItem, entryOf, roomFor, nomIl, countOf, removeAt } from './inv.js';
import { BY_ID } from './data/items.js';
import { gainXp } from './progress3d.js';
import { len } from './util3d.js';

export const ACT = ACT_ALL;
const ROMAN = ['', 'I', 'II', 'III', 'IV'];
const sc = W => ACT[W.story.i] || null;
export const storyFresh = () => ({ i: 0, st: 'wait', n: 0, t: 0, won: false, wave: 0, foes: [], allies: [], met: [] });
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
  if (at.startsWith('hub:')) { const h = (M.places || []).find(p => p.hub === at.slice(4)); if (h) return { x: h.x, z: h.z }; }     // город-узел зоны (этап 7)
  if (at.startsWith('inst:')) { const d = (W.cfg.dungeons.list || []).find(q => q.id === at.slice(5)); if (d && d.at) return { x: d.at.x, z: d.at.z }; }     // вход в подземелье
  if (at === 'ford') { const d = Math.hypot(hub.x - camp.x, hub.z - camp.z) || 1, k = Math.min(1, W.cfg.story.fordAt / d); return { x: camp.x + (hub.x - camp.x) * k, z: camp.z + (hub.z - camp.z) * k }; }
  const p = (M.places || []).find(q => q.id === at); return p ? { x: p.x, z: p.z } : { x: camp.x, z: camp.z };
}
const place = (W, at, off) => { const s = spotOf(W, at), o = { x: s.x + (off ? off[0] : 0), z: s.z + (off ? off[1] : 0) }; try { resolve(surfMap(W), o, .5); } catch (e) { /* без карты — как есть */ } return o; };

// ---- кто стоит в мире: [{ kind, name, tint, x, z, mark: '!' | '?' | null }] ----
export function storyActors(W) {
  const S = W.story; if (S && S.st === 'end' && W.lvl === 'surface') return END_ACTORS.map(([kind, at, off]) => { const q = place(W, at, off); return { kind, name: SPEAKERS[kind].name, tint: SPEAKERS[kind].tint, x: q.x, z: q.z, mark: null }; });     // после финала (этап 8)
  const c = S && sc(W); if (!c || S.st === 'end' || W.lvl !== 'surface') return [];
  const duel = S.st === 'goal' && c.goal.type === 'duel', esc = S.st === 'goal' && c.goal.type === 'escort';
  const out = [];
  for (const [kind, at, off] of c.actors) {
    if ((duel && (kind === c.goal.foe || kind === c.goal.actor)) || (esc && kind === c.goal.who) || (S.allies.length && (c.goal.party || []).includes(kind))) continue;     // в бою и в проводах — не стоят на месте
    const q = place(W, at, off), mark = S.st === 'wait' && c.giver === kind ? '!' : S.st === 'outro' && (c.outroAt || c.giver) === kind ? '?' : talkOpen(S, c, kind) ? '?' : null;
    out.push({ kind, name: SPEAKERS[kind].name, tint: SPEAKERS[kind].tint, x: q.x, z: q.z, mark });
  }
  return out;
}
// расспросы (этап 7): с кем ещё надо поговорить в цели 'talk'
const talkOpen = (S, c, kind) => S.st === 'goal' && c.goal.type === 'talk' && c.goal.talk.includes(kind) && !(S.met || []).includes(kind);
// с кем можно говорить по сюжету (иначе — обычное окно жителя)
export function storyTalkable(W, kind) {
  const S = W.story, c = S && sc(W); if (!c) return false;
  return (S.st === 'wait' && c.giver === kind) || (S.st === 'outro' && (c.outroAt || c.giver) === kind) || talkOpen(S, c, kind);
}
// реплики разговора: { lines, part: 'intro' | 'outro' } или null
export function storyTalk(W, kind) {
  const S = W.story, c = S && sc(W); if (!c) return null;
  if (S.st === 'wait' && (c.auto || c.giver === kind)) return { lines: c.intro, part: 'intro', scene: c.name, act: c.act || 1 };
  if (S.st === 'outro' && (c.outroAt || c.giver) === kind) return { lines: S.won && c.outroWin ? c.outroWin : c.outro, part: 'outro', scene: c.name, act: c.act || 1 };
  if (talkOpen(S, c, kind)) return { lines: c.talks[kind], part: 'talk:' + kind, scene: c.name, act: c.act || 1 };
  return null;
}
// разговор окончен: intro → цель; outro → награда и следующая сцена
export function storyTalked(W, part) {
  const S = W.story; if (!S) return;
  if (part === 'intro' && S.st === 'wait') startGoal(W);
  else if (part === 'outro' && S.st === 'outro') finish(W);
  else if (typeof part === 'string' && part.startsWith('talk:') && S.st === 'goal') { const c = sc(W), k = part.slice(5); if (talkOpen(S, c, k)) { S.met.push(k); S.n = S.met.length; if (S.n >= c.goal.talk.length) toOutro(W); } }
}
// сцена, которая начинается сама (пролог), ждёт показа: интерфейс спрашивает и показывает
export const storyAutoPending = W => { const S = W.story, c = S && sc(W); return !!(c && S.st === 'wait' && c.auto && !S.autoShown); };

function startGoal(W) {
  const S = W.story, c = sc(W), G = c.goal, rng = srng(W); S.st = 'goal'; S.n = 0; S.t = 0; S.wave = 0; S.won = false; S.foes = []; S.allies = []; S.met = []; S.banners = 0;
  const at = G.at ? place(W, G.at, G.off) : null;
  for (const [type, n] of G.spawn || []) for (let k = 0; k < n; k++) { const a = rng() * 6.283, d = (G.r || 12) * (.3 + rng() * .4); const e = spawnEnemy(W, type, at.x + Math.sin(a) * d, at.z + Math.cos(a) * d); e.alert = true; e.storyFoe = true; S.foes.push(e.id); }
  for (const kind of G.party || []) S.allies.push(storyAlly(W, kind).id);
  if (G.type === 'duel') { const ac = c.actors.find(x => x[0] === (G.actor || G.foe)), q = ac ? place(W, ac[1], ac[2]) : place(W, G.at, G.off), e = spawnEnemy(W, G.foe, q.x, q.z);     // там, где стоял (не в доме)
    e.duel = true; e.alert = true; e.storyFoe = true; S.foes.push(e.id); W.duelOn = true; }
  if (G.type === 'escort') S.allies.push(storyAlly(W, G.who).id);
  for (const [kind, n] of G.army || []) for (let k = 0; k < n; k++) S.allies.push(storyAlly(W, kind).id);     // битва строем: королевское войско
  if (G.type === 'siege') { const a = storyAlly(W, G.who); a.guest = true; a.cart = true; a.ram = true; const st = place(W, G.from, G.fromOff); a.x = st.x; a.z = st.z; S.allies.push(a.id); }     // таран идёт сам
  if (G.spawnBoss) { const q = place(W, G.at, G.off), e = spawnBoss(W, { type: G.boss, x: q.x, z: q.z, ...G.spawnBoss }); e.alert = true; e.storyFoe = true; S.foes.push(e.id); }     // босс сцены (этап 7: Гарм)
  if (G.type === 'hunt') for (const H of G.hunt) { const q = place(W, G.at, H.off), e = spawnBoss(W, { x: q.x, z: q.z, ...H }); e.alert = false; e.storyFoe = true; S.foes.push(e.id); }     // охота (Акт IV): несколько боссов сцены по местам
  if (G.type === 'sneak') {     // скрытность: герой у начала пути, сторожа вдоль него смотрят поперёк, видят узким конусом
    const a = place(W, G.from, G.fromOff), b = place(W, G.to, G.toOff), dx = b.x - a.x, dz = b.z - a.z, L = len(dx, dz) || 1, nx = -dz / L, nz = dx / L;
    Object.assign(W.player, { x: a.x, z: a.z, vx: 0, vz: 0 });
    for (let k = 0; k < G.guards; k++) { const t = (k + 1) / (G.guards + 1), sd = (k % 2 ? 1 : -1) * G.side, e = spawnEnemy(W, G.guard, a.x + dx * t + nx * sd, a.z + dz * t + nz * sd, 'guard');
      e.look = e.face = Math.atan2(-nx * Math.sign(sd), -nz * Math.sign(sd)); e.sight = { r: G.sightR, angle: G.angle }; e.storyFoe = true; S.foes.push(e.id); } }
  if (G.type === 'eclipse') { W.storyDark = true; W.duelOn = true; }     // Затмение: небо чернеет, герой не гибнет — сцену не выиграть, только выстоять
  if (G.type === 'escape') { const q = place(W, G.at, G.off), e = spawnEnemy(W, G.foe, q.x, q.z); e.alert = true; e.storyFoe = true; e.noLoot = true; e.escapee = true; S.foes.push(e.id); }
  W.ev.push({ k: 'storyGoal', name: c.name, text: c.goalText });
  if (G.type === 'none') toOutro(W);
}
function storyAlly(W, kind) { const a = spawnAlly(W, kind); a.story = true; a.name = (SPEAKERS[kind] || W.cfg.squad.types[kind]).name; return a; }
const fail = (W, c) => { clearScene(W); W.story.st = 'wait'; W.ev.push({ k: 'storyFail', name: c.name, text: c.failText || 'Не вышло. Поговорите снова, чтобы повторить' }); };
// волна врагов вокруг точки: n штук по весам types; banner — в волну встаёт знаменосец (битва строем)
function wave(W, at, G, rng, banner) {
  for (let k = 0; k < G.n; k++) { let t = G.types[0][0], w = rng() * G.types.reduce((a, q) => a + q[1], 0); for (const [tt, ww] of G.types) { w -= ww; if (w <= 0) { t = tt; break; } }
    const a = rng() * 6.283, d = (G.spread || 14) + rng() * 5, e = spawnEnemy(W, k === 0 && banner ? banner : t, at.x + Math.sin(a) * d, at.z + Math.cos(a) * d); e.alert = true; e.storyFoe = true; W.story.foes.push(e.id); }
}
function clearScene(W) {
  const S = W.story; W.storyDark = false;
  for (const id of S.foes) { const e = W.enemies.find(q => q.id === id); if (e && !e.dead) { e.dead = true; e.deadT = 9; e.noLoot = true; } }
  W.allies = W.allies.filter(a => !(a.story && S.allies.includes(a.id))); S.foes = []; S.allies = []; W.duelOn = false;
}
function toOutro(W) { const c = sc(W); clearScene(W); if (c.outro && c.outro.length) W.story.st = 'outro'; else finish(W); }
function finish(W) {
  const S = W.story, c = sc(W), R = c.reward || {};
  if (c.goal.type === 'bring') for (const [id, n] of c.goal.items) { let left = n; for (let i = W.inv.bag.length - 1; i >= 0 && left > 0; i--) { const sl = W.inv.bag[i]; if (sl.id !== id) continue; const t = Math.min(left, sl.n); removeAt(W.inv, i, t); left -= t; } }     // Гедеон берёт материалы
  const items = [...(R.items || []), ...(R.heroItems && R.heroItems[W.hero] ? [[R.heroItems[W.hero], 1]] : [])];     // своё оружие герою (Акт IV)
  if (R.xp) gainXp(W, R.xp);
  if (R.ash) W.inv.ash += R.ash;
  for (const [id, n] of items) { const it = BY_ID[id]; if (!it) continue; const mx = W.cfg.bag.slots + ((W.gear && W.gear.bag) || 0);
    if (it.slot && roomFor(W.inv, id, mx)) W.inv.bag.push(entryOf(id, 0, null, Math.max(nomIl(it), W.lv))); else if (addItem(W.inv, id, n, mx) > 0) W.drops.push({ id, n, x: W.player.x + 1, z: W.player.z, t: 0, cd: 0 });
    W.known.items[id] = 1; }
  clearScene(W);
  W.ev.push({ k: 'storyDone', name: c.name, end: !!c.end, act: c.act });
  if (c.end) W.ev.push({ k: 'actDone', act: c.act, name: (ACTS.find(a => a.n === c.act) || {}).name });
  S.i++; S.st = S.i >= ACT.length ? 'end' : 'wait'; S.n = 0; S.won = false; S.autoShown = false;
}
// бой-события из симуляции
export function storyKill(W, e) {
  const S = W.story, c = S && sc(W); if (!c || S.st !== 'goal') return;
  if (c.goal.type === 'battle') { if (e.type === c.goal.banner && S.foes.includes(e.id)) { S.n++; if (S.n >= c.goal.need) toOutro(W); } return; }     // битва строем: знаменосцы
  if (c.goal.type !== 'kill') return;
  const G = c.goal, at = place(W, G.at, G.off); if (G.enemy && e.type !== G.enemy) return; if (len(e.x - at.x, e.z - at.z) > G.r) return;
  S.n++; if (S.n >= G.n) toOutro(W);
}
export function storyBoss(W, type) {
  const S = W.story, c = S && sc(W); if (!c || S.st !== 'goal') return;
  if (c.goal.type === 'boss' && c.goal.boss === type) toOutro(W);
  if (c.goal.type === 'hunt' && c.goal.hunt.some(h => h.type === type)) { S.n++; if (S.n >= c.goal.hunt.length) toOutro(W); }
}
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
    if (p.hp <= p.maxhp * G.yieldHero) { S.won = false; p.hp = Math.max(p.hp, p.maxhp * G.yieldHero); if (G.mustWin) fail(W, c); else toOutro(W); }     // mustWin — проигрыш: снова с разговора
    return; }
  if (G.type === 'battle') {     // битва строем (этап 7): волны каждые every с, в каждой — знаменосец; убить need знаменосцев; гибель — заново
    if (p.dead) { fail(W, c); return; }
    S.t += dt; const at = place(W, G.at, G.off), rng = srng(W);
    const alive = W.enemies.filter(e => !e.dead && S.foes.includes(e.id)).length;
    if (S.t >= S.wave * G.every && alive < (G.cap || 18)) { S.wave++; const b = S.banners < G.need + 1; wave(W, at, G, rng, b ? G.banner : null); if (b) S.banners++; }     // не больше cap врагов разом
    return; }
  if (G.type === 'siege') {     // осада: таран сам ползёт к воротам, враги идут волнами; таран разбит или герой пал — заново
    const a = W.allies.find(q => q.ram && S.allies.includes(q.id)), to = place(W, G.to, G.toOff);
    if (p.dead || !a || a.hp <= 1) { fail(W, c); return; }
    S.t += dt; const rng = srng(W), dx = to.x - a.x, dz = to.z - a.z, d = len(dx, dz);
    if (d < G.r) { toOutro(W); return; }
    if (!W.enemies.some(e => !e.dead && e.alert && len(e.x - a.x, e.z - a.z) < 3)) { a.x += dx / d * G.speed * dt; a.z += dz / d * G.speed * dt; a.face = Math.atan2(dx, dz); a.moving = true; } else a.moving = false;     // враги у тарана — стоит
    if (S.t >= S.wave * G.every && W.enemies.filter(e => !e.dead && S.foes.includes(e.id)).length < (G.cap || 14)) { S.wave++; wave(W, a, G, rng, null); }
    return; }
  if (G.type === 'bring') { S.n = G.items.filter(([id, n]) => countOf(W.inv, id) >= n).length; if (S.n >= G.items.length) toOutro(W); return; }     // принести (Гедеон): всё в сумке — к разговору
  if (G.type === 'sneak') {     // заметили — заново; дошёл — дальше
    if (p.dead || W.enemies.some(e => e.alert && !e.dead && S.foes.includes(e.id))) { fail(W, c); return; }
    const b = place(W, G.to, G.toOff); if (len(p.x - b.x, p.z - b.z) < G.r) toOutro(W);
    return; }
  if (G.type === 'eclipse') {     // выстоять t секунд против волн; товарищи уходят во тьму по сюжету (falls: [секунда, кто])
    S.t += dt; const at = place(W, G.at, G.off), rng = srng(W);
    if (S.t >= S.wave * G.every && W.enemies.filter(e => !e.dead && S.foes.includes(e.id)).length < (G.cap || 16)) { S.wave++; wave(W, at, G, rng, null); }
    for (const [t0, kind] of G.falls || []) { const a = S.t >= t0 && W.allies.find(q => q.type === kind && q.story && S.allies.includes(q.id));
      if (a) { W.allies.splice(W.allies.indexOf(a), 1); W.ev.push({ k: 'storyFall', name: (SPEAKERS[kind] || {}).name || kind, x: a.x, z: a.z }); } }
    if (S.t >= G.t) toOutro(W);
    return; }
  if (G.type === 'escape') {     // враг уходит, когда ранен до yieldFoe; герой пал — заново
    if (p.dead) { fail(W, c); return; }
    const e = W.enemies.find(q => q.escapee && !q.dead && S.foes.includes(q.id));
    if (e && e.hp <= e.maxhp * G.yieldFoe) { e.dead = true; e.deadT = 9; e.noLoot = true; W.ev.push({ k: 'storyEscape', name: W.cfg.enemies[e.type].name, x: e.x, z: e.z }); toOutro(W); }
    else if (!e) toOutro(W);
    return; }
  if (G.type === 'defend') {
    if (p.dead) { fail(W, c); return; }
    S.t += dt; const at = place(W, G.at, G.off), every = G.t / G.waves, rng = srng(W);
    while (S.wave < G.waves && S.t >= S.wave * every) { S.wave++; for (let k = 0; k < G.n; k++) { let t = G.types[0][0], w = rng() * G.types.reduce((a, q) => a + q[1], 0); for (const [tt, ww] of G.types) { w -= ww; if (w <= 0) { t = tt; break; } }
      const a = rng() * 6.283, d = 14 + rng() * 5, e = spawnEnemy(W, t, at.x + Math.sin(a) * d, at.z + Math.cos(a) * d); e.alert = true; e.storyFoe = true; S.foes.push(e.id); } W.ev.push({ k: 'storyWave', n: S.wave, of: G.waves }); }
    if (S.t >= G.t) toOutro(W);
    return; }
  if (G.type === 'escort') { const a = W.allies.find(q => q.story && S.allies.includes(q.id)), to = place(W, G.to, G.toOff); if (a && len(a.x - to.x, a.z - to.z) < G.r && len(p.x - to.x, p.z - to.z) < G.r + 4) toOutro(W); }
}
// строка цели и точка на карте
export function storyGoal(W) {
  const S = W.story, c = S && sc(W); if (!c || S.st === 'end') return null;
  const lv = W.lv < c.lv ? ` (рек. ур. ${c.lv})` : '', head = `Акт ${ROMAN[c.act] || c.act} · ${c.name}: `;
  const who = k => SPEAKERS[k].name.split(',')[0];
  if (S.st === 'wait') { if (c.auto) return { text: head + 'начало', at: null }; const a = storyActors(W).find(q => q.kind === c.giver); return { text: head + `поговорите: ${who(c.giver)}` + lv, at: a ? { x: a.x, z: a.z } : null }; }
  if (S.st === 'outro') { const k = c.outroAt || c.giver, a = storyActors(W).find(q => q.kind === k); return { text: head + `вернитесь: ${who(k)}`, at: a ? { x: a.x, z: a.z } : null }; }
  const G = c.goal;
  if (G.type === 'talk') { const nx = G.talk.find(k => !(S.met || []).includes(k)), a = nx && storyActors(W).find(q => q.kind === nx); return { text: head + c.goalText + ` — ${S.met.length}/${G.talk.length}`, at: a ? { x: a.x, z: a.z } : null }; }
  if (G.type === 'sneak') { const b = place(W, G.to, G.toOff); return { text: head + c.goalText + ` — ${Math.round(len(W.player.x - b.x, W.player.z - b.z))} м`, at: b }; }
  if (G.type === 'eclipse') return { text: head + c.goalText + ` — ${Math.max(0, Math.ceil(G.t - S.t))} с`, at: place(W, G.at, G.off) };
  if (G.type === 'siege') { const a = W.allies.find(q => q.ram), to = place(W, G.to, G.toOff); return { text: head + c.goalText + (a ? ` — ${Math.round(len(a.x - to.x, a.z - to.z))} м до ворот` : ''), at: to }; }
  const at = G.at ? place(W, G.at, G.off) : G.to ? place(W, G.to, G.toOff) : G.boss ? (() => { const d = W.cfg.bosses.list.find(b => b.type === G.boss), dn = d && d.level && W.cfg.dungeons.list.find(q => q.id === d.level); return dn && dn.at ? { x: dn.at.x, z: dn.at.z } : d && !d.level ? { x: d.x, z: d.z } : null; })() : null;     // босс в подземелье — метка на входе
  const prog = G.type === 'hunt' ? ` — ${S.n}/${G.hunt.length}` : G.type === 'bring' ? ` — ${S.n}/${G.items.length}` : G.type === 'battle' ? ` — знаменосцы ${S.n}/${G.need}` : G.type === 'kill' ? ` — ${S.n}/${G.n}` : G.type === 'quests' ? ` — ${S.n}/${G.n}` : G.type === 'defend' ? ` — ${Math.max(0, Math.ceil(G.t - S.t))} с, волна ${S.wave}/${G.waves}` : '';
  return { text: head + c.goalText + prog + lv, at };
}
// клеймо (этап 7, после Затмения): ночью наверху к герою приходят тени клейма; в безопасных местах — нет
export const brandOn = W => !!(W.story && sceneIndex('a3_eclipse') >= 0 && W.story.i > sceneIndex('a3_eclipse'));
export function brandTick(W, dt, safe) {
  const B = W.cfg.brand; if (!B || !brandOn(W) || !W.night || W.lvl !== 'surface' || W.player.dead || safe) return;
  if ((W.brandT = (W.brandT ?? B.first) - dt) > 0) return; W.brandT = B.every;
  if (W.enemies.filter(e => !e.dead && e.type === B.type).length >= B.max) return;
  const rng = srng(W), p = W.player, n = B.n[0] + Math.floor(rng() * (B.n[1] - B.n[0] + 1));
  for (let k = 0; k < n; k++) { const a = rng() * 6.283, d = B.r[0] + rng() * (B.r[1] - B.r[0]), q = { x: p.x + Math.sin(a) * d, z: p.z + Math.cos(a) * d }; try { resolve(W.map, q, 1); } catch (e) { /* без карты */ } const e = spawnEnemy(W, B.type, q.x, q.z); e.alert = true; }
  W.ev.push({ k: 'brand', n });
}
// индекс сцены по id (для заданий, открывающихся по сюжету)
export const sceneIndex = id => ACT.findIndex(c => c.id === id);

// ---- сохранение: бой в разгаре (поединок, оборона, проводы, бой с отрядом) не сохраняется — сцена снова ждёт разговора ----
export const serializeStory = S => (S ? { i: S.i, st: S.st === 'goal' && ['kill', 'quests', 'boss', 'spark', 'bring'].includes((ACT[S.i] || {}).goal?.type) && !(ACT[S.i].goal.party) && !(ACT[S.i].goal.spawnBoss) ? 'goal' : S.st === 'goal' ? 'wait' : S.st, n: S.n | 0 } : null);
export function sanitizeStory(d) {
  const S = storyFresh(); if (!d || typeof d !== 'object') return S;
  S.i = Number.isInteger(d.i) && d.i >= 0 ? Math.min(ACT.length, d.i) : 0;
  S.st = S.i >= ACT.length ? 'end' : ['wait', 'goal', 'outro'].includes(d.st) ? d.st : 'wait'; S.n = Number.isFinite(d.n) && d.n > 0 ? Math.floor(d.n) : 0;
  if (S.st === 'goal' && ACT[S.i].goal.spawn) S.st = 'wait';     // бой со своими врагами — заново с разговора
  return S;
}
