// Случайные свойства вещей (этап 4 плана «круче»): у снаряжения редкого и выше, поднятого с земли или из сундука, 1–3 свойства
// из набора по виду вещи (оружие, броня, украшения). Сила — от уровня вещи и случайного качества, не выше cfg.affix.max.
// Свой генератор чисел (счётчик вещей + зерно мира): бой и его случайности не сдвигаются. Числа — cfg.affix.
import { BY_ID } from './data/items.js';

const POOL = { weapon: ['dmg', 'crit', 'leech', 'spd', 'luck'], armor: ['armor', 'hp', 'regen', 'spd', 'stealth', 'luck'], jewel: ['crit', 'leech', 'hp', 'luck', 'spd', 'armor'] };
const kindOf = it => (it.slot === 'weapon' ? 'weapon' : it.slot === 'ring' || it.slot === 'amulet' ? 'jewel' : 'armor');
const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// свойства вещи id уровня il; seed — любое число (разное для разных вещей); null — свойств нет
export function rollAffixes(cfg, id, il, seed) {
  const A = cfg.affix, it = BY_ID[id]; if (!A || !A.on || !it || !it.slot) return null;
  const n = A.count[it.rar] || 0; if (!n) return null;
  const r = rng((seed ^ hashStr(id)) >>> 0), pool = POOL[kindOf(it)].slice(), out = {}, L = Math.max(1, il || 1);
  for (let i = 0; i < n && pool.length; i++) {
    const k = pool.splice(Math.floor(r() * pool.length), 1)[0], [b0, b1] = A.base[k], q = A.q[0] + (A.q[1] - A.q[0]) * r();
    const v = Math.min(A.max[k], (b0 + b1 * L) * q); out[k] = v >= 3 ? Math.round(v) : Math.max(.1, Math.round(v * 10) / 10);
  }
  return out;
}
// для мира: свойства новой вещи с земли или из сундука (счётчик W.afN — каждая вещь своя)
export const affixFor = (W, id, il) => { W.afN = (W.afN || 0) + 1; return rollAffixes(W.cfg, id, il, (W.cfg.world.seed * 7919 + W.afN * 2654435761 + Math.floor(W.t * 1000)) >>> 0); };
// строки для подсказки: «+5 крит %»
export const affixLines = (af, names) => Object.entries(af || {}).map(([k, v]) => `+${v} ${names[k] || k}`);
