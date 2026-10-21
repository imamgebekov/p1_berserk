// Случайные свойства вещей (этап 4 плана «круче»): у снаряжения редкого и выше, поднятого с земли или из сундука, 1–3 свойства
// из набора по виду вещи (оружие, броня, украшения). Сила — от уровня вещи и случайного качества, не выше cfg.affix.max.
// Свой генератор чисел (счётчик вещей + зерно мира): бой и его случайности не сдвигаются. Числа — cfg.affix.
import { BY_ID } from './data/items.js';

const POOL = { weapon: ['dmg', 'crit', 'leech', 'spd', 'luck', 'burnCh', 'poisonCh', 'shockCh', 'bleedCh'],     // …Ch — шанс поджечь, отравить, ударить молнией, пустить кровь (3.99)
   armor: ['armor', 'hp', 'regen', 'spd', 'stealth', 'luck'], jewel: ['crit', 'leech', 'hp', 'luck', 'spd', 'armor'] };
export const kindOf = it => (it.slot === 'weapon' ? 'weapon' : it.slot === 'ring' || it.slot === 'amulet' ? 'jewel' : 'armor');
const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// свойства вещи id уровня il; seed — любое число (разное для разных вещей); null — свойств нет.
// q — качество (3.99, просьба владельца): у любой брони и оружия базовые числа вещи × q (A.quality — разброс), одна и та же вещь выпадает разной
export function rollAffixes(cfg, id, il, seed) {
  const A = cfg.affix, it = BY_ID[id]; if (!A || !A.on || !it || !it.slot) return null;
  const r = rng((seed ^ hashStr(id)) >>> 0), pool = POOL[kindOf(it)].slice(), out = {}, L = Math.max(1, il || 1), n = A.count[it.rar] || 0;
  if (A.quality && kindOf(it) !== 'jewel') { const [q0, q1] = A.quality; out.q = Math.round((q0 + (q1 - q0) * r()) * 100) / 100; }
  if (!n && !out.q) return null;
  for (let i = 0; i < n && pool.length; i++) {
    const k = pool.splice(Math.floor(r() * pool.length), 1)[0]; out[k] = rollValue(A, k, L, r);
  }
  return Object.keys(out).length ? out : null;
}
// сила одного свойства k на уровне вещи L (r — генератор)
export function rollValue(A, k, L, r) { const [b0, b1] = A.base[k], q = A.q[0] + (A.q[1] - A.q[0]) * r(), v = Math.min(A.max[k], (b0 + b1 * Math.max(1, L)) * q); return v >= 3 ? Math.round(v) : Math.max(.1, Math.round(v * 10) / 10); }
export const poolOf = it => POOL[kindOf(it)].slice();     // какие свойства бывают у вещи
// свойства скованной вещи (4.02): как у находки, качество мастера в [qLow, qTop]; key — свойство от реагента (заменяет случайное
// или добавляется, если своих нет); ember — качество сразу qTop
export function craftAffixes(cfg, id, il, seed, { qLow = 1, qTop = 1.15, key = null, ember = false } = {}) {
  const A = cfg.affix, it = BY_ID[id]; if (!A || !A.on || !it || !it.slot) return null;
  const af = rollAffixes(cfg, id, il, seed) || {}, r = rng((seed ^ 0x5bd1e995) >>> 0);
  if (kindOf(it) !== 'jewel') af.q = ember ? qTop : Math.round((qLow + (qTop - qLow) * r()) * 100) / 100;
  if (key && POOL[kindOf(it)].includes(key) && !(key in af)) { const ks = Object.keys(af).filter(k => k !== 'q'); if (ks.length) delete af[ks[Math.floor(r() * ks.length)]]; af[key] = rollValue(A, key, Math.max(1, il || 1), r); }
  return Object.keys(af).length ? af : null;
}
// камень внутри при находке (3.99): фиолетовая — с шансом A.gems.purple, золотая — всегда; случайная стихия, ранг по редкости
export function rollGems(cfg, id, seed, sockets) {
  const A = cfg.affix, G = A && A.gems, it = BY_ID[id]; if (!G || !it || !it.slot || !sockets) return null;
  const r = rng((seed ^ hashStr(id) ^ 0x9e3779b9) >>> 0), ch = it.rar >= 5 ? 1 : it.rar === 3 || it.rar === 4 ? G.purple : 0; if (!(r() < ch)) return null;
  const el = G.els[Math.floor(r() * G.els.length)], rank = it.rar >= 5 ? G.goldRank : 1 + (r() < G.rank2 ? 1 : 0), g = Array.from({ length: sockets }, () => null); g[0] = `gem_${el}_${rank}`; return g;
}
export const gemsFor = (W, id, sockets) => { W.afN = (W.afN || 0) + 1; return rollGems(W.cfg, id, (W.cfg.world.seed * 104729 + W.afN * 2246822519 + Math.floor(W.t * 1000)) >>> 0, sockets); };
// для мира: свойства новой вещи с земли или из сундука (счётчик W.afN — каждая вещь своя)
export const affixFor = (W, id, il) => { W.afN = (W.afN || 0) + 1; return rollAffixes(W.cfg, id, il, (W.cfg.world.seed * 7919 + W.afN * 2654435761 + Math.floor(W.t * 1000)) >>> 0); };
// строки для подсказки: «+5 крит %»
export const affixLines = (af, names) => Object.entries(af || {}).filter(([k]) => k !== 'en').sort((x, y) => (y[0] === 'q') - (x[0] === 'q')).map(([k, v]) => (k === 'q' ? `Качество ${Math.round(v * 100)}%` : `${v < 0 ? '' : '+'}${v} ${names[k] || k}`));     // качество — первой строкой (порядок ключей: q кладётся первым)
export const affixCount = af => Object.keys(af || {}).filter(k => k !== 'q' && k !== 'en').length;     // свойства без качества
