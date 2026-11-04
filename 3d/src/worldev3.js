// Мировые события (2026-11-05, план «расширение мира в стиле WoW»): вторжение на посёлок, бродячий мини-босс, пепельный дракон над зоной.
// Живут по игровому времени, пока герой наверху; видны на карте; награда — всем, кто рядом (герой и боты). Боты идут на событие сами:
// далеко от героя они «бьются» по таймеру (прогресс), рядом — настоящий бой. Свой поток случайных чисел W.wrng: бой и боты не сдвигаются.
// Включается только в игре (W.wantBots и W.botHomes), в createWorld без ботов событий нет.
import { len, TAU, clamp } from './util3d.js';
import { mulberry32, spawnEnemy } from './sim.js';
import { onSurface, levelAt } from './levels3d.js';
import { biomeAt } from './worldgen3d.js';
import { zoneAt } from './zones3d.js';
import { makeChief } from './foes3d.js';
import { resolve, insideOf, lineBlocked } from './map.js';
import { CONTAINERS, rollLoot } from './data/loot.js';
import { CATALOG } from './data/items.js';
import { mountDrop } from './life3d.js';
import { chat, guildOf } from './mail3d.js';
import { botCredit } from './bots3d.js';

const C = W => W.cfg.worldEv;
const rnd = (W, a, b) => a + W.wrng() * (b - a);
const pickW = (W, list) => { let s = 0; for (const [, w] of list) s += w; let r = W.wrng() * s; for (const [k, w] of list) if ((r -= w) <= 0) return k; return list[0][0]; };
const GEAR = CATALOG.filter(i => i.slot && i.rar === 3 && i.pool !== 'unique' && i.pool !== 'setunique');
const alive = (W, ev) => ev.foes.map(id => W.enemies.find(e => e.id === id)).filter(e => e && !e.dead);
const placeName = (W, x, z) => { const q = zoneAt(W.cfg, x, z); return (q && q.name) || 'мир'; };
const botName = (W, a) => (a.guild ? `[${guildOf(W, a.guild).tag}] ` : '') + a.name;
const say = (W, who, text) => { try { chat(W, who, text, false, 'w'); } catch (e) { /* чат не обязателен */ } };

export const activeEvents = W => (W.wev ? W.wev.list : []);

// место: посёлок или опасное место (дома ботов), не слишком близко и не слишком далеко от героя; уровень места ближе к герою — чаще
function siteFor(W) {
  const K = C(W), p = W.player, H = (W.botHomes || []).filter(h => { const d = len(h.x - p.x, h.z - p.z); return d >= K.dist[0] && d <= K.dist[1] && !activeEvents(W).some(e => len(e.x - h.x, e.z - h.z) < 60); });
  if (!H.length) return null;
  return H[pickW(W, H.map((h, i) => [i, 1 / (1 + Math.abs(h.lv - W.lv) / 6)]))];
}
const biomeTable = (W, x, z) => W.cfg.enemies.biomes[biomeAt(W.cfg, x, z)] || W.cfg.enemies.biomes.forest;
const freeSpot = (W, x, z, r) => { for (let k = 0; k < 20; k++) { const a = rnd(W, 0, TAU), d = rnd(W, 2, r), o = { x: x + Math.sin(a) * d, z: z + Math.cos(a) * d }, q = { ...o }; resolve(W.map, q, 1); if (len(q.x - o.x, q.z - o.z) < .01 && insideOf(W.map, o.x, o.z) < 0) return o; } return { x, z }; };
function spawn(W, type, x, z, ev) { const keep = W.rng; W.rng = W.wrng; let e; try { e = spawnEnemy(W, type, x, z); } finally { W.rng = keep; } e.wev = ev.id; ev.foes.push(e.id); return e; }
// маршрут обхода зоны для бродячего: точки вокруг места, видимые друг из друга
function route(W, e, cx, cz, R, n) {
  const pts = [{ x: e.x, z: e.z }];
  for (let i = 0, t = 0; i < n && t < n * 8; t++) { const a = rnd(W, 0, TAU), d = rnd(W, R * .4, R), q = { x: cx + Math.sin(a) * d, z: cz + Math.cos(a) * d }, o = { ...q }; resolve(W.map, o, 1.2); if (len(o.x - q.x, o.z - q.z) < .01 && insideOf(W.map, q.x, q.z) < 0 && !lineBlocked(W.map, pts[pts.length - 1].x, pts[pts.length - 1].z, q.x, q.z)) { pts.push(q); i++; } }
  e.mode = 'patrol'; e.home = { x: e.x, z: e.z }; e.route = pts; e.ri = 0; e.look = e.face;
}
const START = {
  invasion(W, s, ev) {
    const K = C(W).invasion, tbl = biomeTable(W, s.x, s.z).filter(a => a[2] !== 'night'), n = Math.round(rnd(W, ...K.n)); let boss = null;
    for (let i = 0; i < n; i++) { const o = freeSpot(W, s.x, s.z, Math.max(5, s.r * 1.1)), e = spawn(W, tbl[pickW(W, tbl.map((a, j) => [j, a[1]]))][0], o.x, o.z, ev); e.alert = false; if (!boss) boss = e; }
    makeChief(W, boss, 'Предводитель вторжения', K.hpK); ev.name = 'Вторжение'; ev.need = K.need; return true;
  },
  roamer(W, s, ev) {
    const K = C(W).roamer, tbl = biomeTable(W, s.x, s.z).filter(a => a[2] !== 'night'), o = freeSpot(W, s.x, s.z, s.r), e = spawn(W, tbl[pickW(W, tbl.map((a, j) => [j, a[1]]))][0], o.x, o.z, ev);
    makeChief(W, e, K.names[Math.floor(W.wrng() * K.names.length)], K.hpK); route(W, e, s.x, s.z, K.r, K.pts); ev.name = e.chief; ev.need = K.need; ev.mountTier = 'mini'; return true;
  },
  dragon(W, s, ev) {
    const K = C(W).dragon, o = freeSpot(W, s.x, s.z, s.r), e = spawn(W, 'drake', o.x, o.z, ev); makeChief(W, e, 'Пепельный дракон', K.hpK); route(W, e, s.x, s.z, K.r, K.pts); ev.name = 'Пепельный дракон'; ev.need = 0; ev.mountTier = 'boss'; return true;
  }
};
function begin(W, kind) {
  const s = siteFor(W); if (!s) return false; const K = C(W), id = (W.wev.id = (W.wev.id || 0) + 1);
  const ev = { id, kind, x: s.x, z: s.z, lv: Math.round(levelAt(W, s.x, s.z)), t: K[kind].time, foes: [], bots: [], prog: 0, need: 0, place: placeName(W, s.x, s.z), name: '' };
  if (!START[kind](W, s, ev) || !ev.foes.length) return false;
  // боты по уровню приходят на событие: дома меняются, пока оно идёт
  const near = (W.bots || []).filter(a => !a.dead && Math.abs(a.lv - ev.lv) <= K.botLv && !a.wevId).sort((u, v) => len(u.x - s.x, u.z - s.z) - len(v.x - s.x, v.z - s.z)).slice(0, K.join);
  for (const a of near) { a.wevId = id; a.home0 = a.home; a.home = { x: s.x, z: s.z, r: Math.max(8, s.r), lv: s.lv }; a.goal = null; ev.bots.push(a.id); }
  W.wev.list.push(ev); W.ev.push({ k: 'wevStart', kind, name: ev.name, place: ev.place, x: s.x, z: s.z });
  say(W, 'Вестник', kind === 'invasion' ? `Вторжение! Враги напали на посёлок: ${ev.place}.` : kind === 'dragon' ? `Над землями «${ev.place}» кружит Пепельный дракон!` : `В землях «${ev.place}» бродит: ${ev.name}.`);
  if (near.length) say(W, botName(W, near[0]), kind === 'dragon' ? 'Кто со мной на дракона? Одному не вытянуть.' : 'Иду туда, кто со мной?');
  return true;
}
function release(W, ev) { for (const id of ev.bots) { const a = (W.bots || []).find(b => b.id === id); if (a && a.wevId === ev.id) { a.wevId = 0; if (a.home0) a.home = a.home0; a.home0 = null; a.goal = null; } } }
function reward(W, ev, x, z) {
  const K = C(W), R = K.reward[ev.kind], depth = .6, ash = Math.round(rnd(W, ...R.ash) * (1 + ev.lv / 30)); W.inv.ash += ash;
  for (const it of rollLoot(CONTAINERS[R.box], W.wrng, depth, W.gear.luck)) { const a = rnd(W, 0, TAU); W.drops.push({ id: it.id, n: it.n, x: x + Math.sin(a) * 1.6, z: z + Math.cos(a) * 1.6, t: 0, cd: 0 }); W.ev.push({ k: 'drop', x, z, id: it.id }); }
  for (let i = 0; i < (R.epic || 0); i++) { const it = GEAR[Math.floor(W.wrng() * GEAR.length)]; W.drops.push({ id: it.id, n: 1, x: x + i, z, t: 0, cd: 0, il: Math.max(1, W.lv) }); W.ev.push({ k: 'drop', x, z, id: it.id }); }
  if (ev.mountTier) mountDrop(W, { x, z }, ev.mountTier);
  return ash;
}
function finish(W, ev, ok, by, x, z) {
  const K = C(W), p = W.player, i = W.wev.list.indexOf(ev); if (i >= 0) W.wev.list.splice(i, 1);
  let ash = 0, heroIn = false; const credit = [];
  if (ok) {
    heroIn = !p.dead && len(p.x - x, p.z - z) < K.shareR; if (heroIn) ash = reward(W, ev, x, z);
    for (const a of W.bots || []) if (!a.dead && len(a.x - x, a.z - z) < K.shareR) { botCredit(W, a, K.credit); credit.push(a); }     // боты рядом тоже получают своё
  } else for (const e of alive(W, ev)) if (!e.alert || len(e.x - p.x, e.z - p.z) > 40) { const j = W.enemies.indexOf(e); if (j >= 0) W.enemies.splice(j, 1); }     // улетел или ушёл
  for (const e of W.enemies) if (e.wev === ev.id) e.wev = 0;
  release(W, ev); W.wev.t = rnd(W, ...K.every);
  W.ev.push({ k: ok ? 'wevDone' : 'wevFail', kind: ev.kind, name: ev.name, place: ev.place, by, ash, hero: heroIn, bots: credit.length });
  const who = credit.slice(0, 3).map(a => botName(W, a)).join(', ');
  say(W, 'Вестник', ok ? `${ev.name}: побеждено${by === 'bots' ? ' без героя — справились сами' : ''}${who ? '. Отличились: ' + who : ''}.` : `${ev.name}: ушло. Время вышло.`);
}
export function wevTick(W, dt) {
  const K = C(W); if (!K || !K.on || !W.botHomes || !W.botHomes.length || !onSurface(W)) return;
  if (!W.wrng) W.wrng = mulberry32((W.cfg.world.seed * 3571 + 41) | 0);
  const S = W.wev || (W.wev = { t: rnd(W, ...K.first), id: 0, list: [] }), p = W.player;
  for (let i = S.list.length - 1; i >= 0; i--) {
    const ev = S.list[i]; ev.t -= dt; const L = alive(W, ev);
    if (L.length) { const f = L[0]; if (f.mode === 'patrol') { ev.x = f.x; ev.z = f.z; } }
    if (!L.length) { finish(W, ev, true, 'hero', ev.x, ev.z); continue; }
    const heroNear = !p.dead && len(p.x - ev.x, p.z - ev.z) < K.near;
    if (!heroNear && ev.need > 0) {     // далеко от героя: боты на месте бьются по таймеру
      let n = 0; for (const id of ev.bots) { const a = W.bots.find(b => b.id === id); if (a && !a.dead && len(a.x - ev.x, a.z - ev.z) < K.botR) n++; }
      ev.prog += n * dt; if (ev.prog >= ev.need) { for (const e of L) { const j = W.enemies.indexOf(e); if (j >= 0) W.enemies.splice(j, 1); } finish(W, ev, true, 'bots', ev.x, ev.z); continue; }
    }
    if (ev.t <= 0) finish(W, ev, false, 'time', ev.x, ev.z);
  }
  if ((S.t -= dt) > 0 || S.list.length >= K.max) return;
  const kind = pickW(W, Object.entries(K.kinds).filter(([, w]) => w > 0)); if (!begin(W, kind)) S.t = K.retry; else S.t = rnd(W, ...K.every);
}
