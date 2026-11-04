// Боты-«игроки», шаг 2 (2026-11-03, владелец): поговорить с ботом рядом — купить у него вещь или позвать в отряд. Чистая логика (проверяется в Node);
// окно — в main.js. Товар бота — вещи по его уровню (свой поток W.brng), цена с наценкой; позвать можно, если есть место в отряде и такой боец-герой
// ещё не в отряде; бот уходит из мира ботов в отряд вместе со своими вещами.
import { BY_ID } from './data/items.js';
import { addItem } from './inv.js';
import { len, clamp } from './util3d.js';
import { hireable, liveAllies, squadMax, spawnAlly, allyKit, refreshAlly } from './squad3d.js';

// ближайший живой бот в радиусе разговора
export function nearBot(W) {
  const C = W.cfg.bots, T = C && C.talk, p = W.player; if (!T || !W.bots || W.lvl !== 'surface' || p.dead) return null;
  let best = null, bd = T.reach; for (const a of W.bots) { if (a.dead || a.arena) continue; const d = len(a.x - p.x, a.z - p.z); if (d < bd) { bd = d; best = a; } }
  return best;
}
let POOL = null;
const pool = () => POOL || (POOL = Object.values(BY_ID).filter(it => it.slot && it.rar >= 1 && it.rar <= 5));
// товар бота: stock вещей по уровню бота; роли — оружие и броня; в сумку игрока — как есть
export function stockOf(W, a) {
  if (a.stock) return a.stock;
  const T = W.cfg.bots.talk, top = clamp(1 + Math.floor(a.lv / 12), 1, 5), L = pool().filter(it => it.rar <= top && it.rar >= top - 1), out = [];
  for (let i = 0; i < T.stock && L.length; i++) { const it = L[Math.floor(W.brng() * L.length)]; if (!out.some(s => s.id === it.id)) out.push({ id: it.id, price: Math.max(1, Math.round(it.value * T.markup)) }); }
  return (a.stock = out);
}
export function buyFrom(W, a, i) {
  const s = stockOf(W, a)[i]; if (!s) return 'none';
  if (!nearBot(W) || nearBot(W) !== a) return 'far';
  if (W.inv.ash < s.price) return 'ash';
  const slots = W.cfg.bag.slots + ((W.gear && W.gear.bag) || 0); if (addItem(W.inv, s.id, 1, slots) > 0) return 'full';
  W.inv.ash -= s.price; a.stock.splice(i, 1); W.ev.push({ k: 'pickup', id: s.id, n: 1 }); return 'ok';
}
// цена приглашения и тип бойца-героя для бота
export const recruitCost = (W, a) => { const H = W.cfg.bots.talk.hire; return Math.round(H.base + H.perLv * a.lv); };
export const squadTypeOf = (W, a) => Object.keys(W.cfg.squad.types).find(k => W.cfg.squad.types[k].hero === a.hero && !W.cfg.squad.types[k].story) || null;
export function recruitBlock(W, a) {
  if (nearBot(W) !== a) return 'far';
  const t = squadTypeOf(W, a); if (!t || !hireable(W, t) || a.hero === W.hero) return 'own';
  if (liveAllies(W).length >= squadMax(W)) return 'full';
  if (W.inv.ash < recruitCost(W, a)) return 'ash';
  return null;
}
export function recruit(W, a) {
  const why = recruitBlock(W, a); if (why) return why;
  const type = squadTypeOf(W, a); W.inv.ash -= recruitCost(W, a);
  W.bots.splice(W.bots.indexOf(a), 1); const j = W.allies.indexOf(a); if (j >= 0) W.allies.splice(j, 1);
  const ally = spawnAlly(W, type); allyKit(ally); ally.eq = { ...ally.eq, ...a.eq }; ally.up = { ...(a.up || {}) }; ally.il = { ...(a.il || {}) }; ally.af = { ...(a.af || {}) }; ally.gem = { ...(a.gem || {}) }; refreshAlly(W, ally); ally.hp = ally.maxhp;
  ally.nick = a.name; W.ev.push({ k: 'hire', name: a.name }); return 'ok';
}
