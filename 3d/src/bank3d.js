// Банк (2026-11-13, как в WoW): общий склад в лагере и посёлках — вещи лежат вне сумки. Класть и брать можно рядом с жителем; смотреть — где угодно.
// Запись — та же, что в сумке (id, n, ур. вещи, свойства, камни, улучшение), ничего не теряется. Только вещи; пепел не храним.
import { BY_ID } from './data/items.js';
import { bagUsed } from './inv.js';
import { bagSlots } from './sim.js';

export const bankOf = W => W.bank || (W.bank = []);
export const bankCap = W => (W.cfg.bank && W.cfg.bank.slots) || 60;
export const bankNear = W => !!W.cfg.bank && W.cfg.bank.on && W.lvl === 'surface' && !!W.nearNpc && W.nearNpc !== 'wanderer';
const plain = s => !s.up && !s.il && !s.af && !(s.g && s.g.some(Boolean)) && !s.lock;     // простые записи можно сливать в стопку
function put(list, s, cap, stackOf) {
  const it = BY_ID[s.id]; let n = s.n;
  if (plain(s) && it.stack > 1) for (const q of list) if (q.id === s.id && plain(q) && q.n < it.stack && n > 0) { const m = Math.min(n, it.stack - q.n); q.n += m; n -= m; }
  while (n > 0) { if (list.length >= cap) return n; const m = it.stack > 1 ? Math.min(n, it.stack) : 1; list.push({ ...s, n: m }); n -= m; }
  return 0;
}
// сумка → банк: n штук записи i; 'ok' | 'far' | 'none' | 'full'
export function deposit(W, i, n) {
  if (!bankNear(W)) return 'far'; const s = W.inv.bag[i]; if (!s || !BY_ID[s.id]) return 'none';
  n = Math.max(1, Math.min(s.n, Math.floor(n || s.n))); const B = bankOf(W), left = put(B, { ...s, n }, bankCap(W)); const moved = n - left; if (!moved) return 'full';
  if (moved >= s.n) W.inv.bag.splice(i, 1); else s.n -= moved;
  return left ? 'full' : 'ok';
}
// банк → сумка: вся запись i; 'ok' | 'far' | 'none' | 'full'
export function withdraw(W, i) {
  if (!bankNear(W)) return 'far'; const B = bankOf(W), s = B[i]; if (!s) return 'none';
  const copy = { ...s }; W.inv.bag.push(copy); if (bagUsed(W.inv) > bagSlots(W)) { W.inv.bag.pop(); return 'full'; }
  B.splice(i, 1); return 'ok';
}
// из сохранения: чужое и испорченное отбрасывается
export function sanitizeBank(d, cap = 60) {
  const out = []; if (!Array.isArray(d)) return out;
  for (const s of d.slice(0, cap)) { const it = s && typeof s.id === 'string' && BY_ID[s.id]; if (!it || it.cat === 'key') continue;
    const e = { id: s.id, n: Number.isFinite(s.n) ? Math.max(1, Math.min(it.stack || 1, Math.floor(s.n))) : 1 };
    if (Number.isInteger(s.up) && s.up > 0) e.up = Math.min(5, s.up); if (Number.isFinite(s.il) && s.il > 0) e.il = Math.min(99, Math.floor(s.il)); if (s.af && typeof s.af === 'object') e.af = JSON.parse(JSON.stringify(s.af));
    if (Array.isArray(s.g)) e.g = s.g.slice(0, 4).map(x => (typeof x === 'string' && BY_ID[x] ? x : null)); if (s.lock) e.lock = true; out.push(e); }
  return out;
}
