// Камни силы (2026-10-18): выпадение, гнёзда в оружии, кузнец (вставить, вынуть за пепел, сплавить 3 → 1).
// Выпадение не берёт числа из W.rng — счёт боя с базой не сбивается. Числа — config3d.js → stones.
// Чистые функции (проверяются в Node). Место вещи where: { slot: 'weapon' } — надето, { idx } — в сумке.
import { BY_ID } from './data/items.js';
import { addItem, removeAt, countOf, socketsOf, hasGems } from './inv.js';
import { ELEMENTS } from './elements3d.js';

export const gemId = (el, rank) => `gem_${el}_${rank}`;
export const isGem = id => !!(BY_ID[id] && BY_ID[id].cat === 'gem');
// свой генератор: дробь из номера врага и счётчика убийств (одинаково при каждом запуске, не трогает W.rng)
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// какой камень падает с врага (или null): сердце с босса всегда; элита — камень с шансом elite; иначе осколок с шансом drop
export function gemDropOf(W, e) {
  const S = W.cfg.stones; if (!S) return null;
  if (e.boss) { const el = S.hearts[e.type]; return el ? gemId(el, 3) : null; }
  const el = (W.rain || 0) >= .5 && S.rain ? S.rain : S.of[e.type]; if (!el) return null;
  const r = hash(e.id, W.kills);
  if (e.elite) return r < S.elite ? gemId(el, 2) : null;
  return r < S.drop + S.danger * (e.danger || 0) ? gemId(el, 1) : null;
}

// посох или жезл с врага (или null): шанс выше, когда играет Ирга; материал — по опасности места и элите (свой генератор)
const MAGIC_MATS = ['rust', 'iron', 'tempered', 'bone', 'steel', 'black', 'blood'];
export function magicDropOf(W, e, depth = 0) {
  const S = W.cfg.stones; if (!S || !S.magic || e.boss) return null;
  const r = hash(e.id * 7 + 3, W.kills), ch = e.elite ? S.magicElite : S.magic[W.hero === 'irga' ? 0 : 1];
  if (r >= ch) return null;
  const q = hash(e.id * 13 + 5, W.kills * 3 + 1), d = Math.max(0, Math.min(1, depth));
  const mi = Math.min(6, Math.floor(d * 4 + q * 2.5) + (e.elite ? 2 : 0));
  return `w_${q < .5 ? 'staff' : 'wand'}_${MAGIC_MATS[mi]}`;
}
// камни в месте where: массив по числу гнёзд (null — пусто)
export function gemsAt(W, where) {
  const inv = W.inv, id = where.slot ? inv.eq[where.slot] : inv.bag[where.idx] && inv.bag[where.idx].id, it = id && BY_ID[id], n = socketsOf(it, W.cfg);
  const g = (where.slot ? inv.gem[where.slot] : inv.bag[where.idx].g) || [];
  return Array.from({ length: n }, (_, i) => g[i] || null);
}
const store = (W, where, g) => {
  const ok = hasGems(g);
  if (where.slot) { if (ok) W.inv.gem[where.slot] = g; else delete W.inv.gem[where.slot]; }
  else { const e = W.inv.bag[where.idx]; if (ok) e.g = g; else delete e.g; }
};
// индекс записи сумки после удаления камня (сумка могла сдвинуться)
const reIdx = (W, where, entry) => (where.slot ? where : { idx: W.inv.bag.indexOf(entry) });

// вставить камень gem в гнездо i; 'ok' | 'far' | 'none' | 'busy' (гнездо занято) | 'nogem'
export function socketGem(W, where, i, gem) {
  if (W.nearNpc !== 'smith') return 'far';
  if (!isGem(gem)) return 'nogem';
  const g = gemsAt(W, where); if (i < 0 || i >= g.length) return 'none'; if (g[i]) return 'busy';
  const gi = W.inv.bag.findIndex(s => s.id === gem); if (gi < 0) return 'nogem';
  const entry = where.slot ? null : W.inv.bag[where.idx];
  removeAt(W.inv, gi, 1); const w = reIdx(W, where, entry);
  g[i] = gem; store(W, w, g); W.ev.push({ k: 'socket', id: gem, x: W.player.x, z: W.player.z }); return 'ok';
}
// вынуть камень из гнезда i за пепел; камень — в сумку целым. 'ok' | 'far' | 'none' | 'ash' | 'full'
export function unsocketGem(W, where, i, maxSlots) {
  if (W.nearNpc !== 'smith') return 'far';
  const g = gemsAt(W, where), gem = g[i]; if (!gem) return 'none';
  const cost = unsocketCost(W, gem); if (W.inv.ash < cost) return 'ash';
  const entry = where.slot ? null : W.inv.bag[where.idx];
  if (addItem(W.inv, gem, 1, maxSlots) > 0) return 'full';
  W.inv.ash -= cost; g[i] = null; store(W, reIdx(W, where, entry), g); W.ev.push({ k: 'unsocket', n: 1 }); return 'ok';
}
export const unsocketCost = (W, gem) => W.cfg.stones.unsocket[(BY_ID[gem].rank || 1) - 1];
// сплавить fuse.n одинаковых камней в один рангом выше. 'ok' | 'far' | 'max' | 'few' | 'ash' | 'full'
export function fuseGems(W, gem, maxSlots) {
  if (W.nearNpc !== 'smith') return 'far';
  const it = BY_ID[gem]; if (!it || it.cat !== 'gem') return 'few'; if (it.rank >= 3) return 'max';
  const F = W.cfg.stones.fuse, cost = F.ash[it.rank - 1];
  if (countOf(W.inv, gem) < F.n) return 'few'; if (W.inv.ash < cost) return 'ash';
  const tmp = { bag: JSON.parse(JSON.stringify(W.inv.bag)) };
  let n = F.n; for (let i = tmp.bag.length - 1; i >= 0 && n > 0; i--) if (tmp.bag[i].id === gem) { const t = Math.min(n, tmp.bag[i].n); removeAt(tmp, i, t); n -= t; }
  if (addItem(tmp, gemId(it.gem, it.rank + 1), 1, maxSlots) > 0) return 'full';
  W.inv.bag = tmp.bag; W.inv.ash -= cost; W.ev.push({ k: 'fuse', id: gemId(it.gem, it.rank + 1), x: W.player.x, z: W.player.z }); return 'ok';
}

// стихия оружия по его свойствам (огонь, холод, яд, гроза) или null
const PERK_EL = { fire: 'fire', frost: 'ice', venom: 'venom', storm: 'storm' };
export const weaponElement = it => { for (const p of (it && it.perks) || []) if (PERK_EL[p]) return PERK_EL[p]; return null; };
// сплав оружия: стихии [a, b] и ранг силы; одна стихия — b === null. Правила таблицы: стихия вещи + камень; у двух камней —
// сплав камней, а стихия вещи усиливает (amp). Без камней — null (оружие бьёт как раньше)
// камни в надетой броне: прибавка к характеристикам и ослабление статусов на герое { stats, res }
export function armorGems(inv, cfg) {
  const A = cfg.stones && cfg.stones.armor, stats = {}, res = {}; if (!A) return { stats, res };
  for (const slot of A.slots) for (const id of (inv.gem && inv.gem[slot]) || []) { const G = id && BY_ID[id]; if (!G) continue;
    const [k, v] = A.stat[G.gem]; stats[k] = (stats[k] || 0) + v[G.rank - 1];
    const st = A.resist[G.gem]; if (st) res[st] = Math.min(A.resMax, (res[st] || 0) + A.res[G.rank - 1]); }
  return { stats, res };
}
const STAT_WORD = { dmg: 'урона', armor: 'брони', regen: 'здоровья в секунду', spd: '% скорости', crit: '% крита', leech: '% вампиризма', hp: 'здоровья' }, RES_WORD = { burn: 'горение', poison: 'яд', bleed: 'кровотечение' };
// что даёт камень в броне: «+4 урона, горение на вас слабее на 40%»
export function armorGemFx(G, cfg) { const A = cfg.stones.armor, [k, v] = A.stat[G.gem], st = A.resist[G.gem];
  return `+${v[G.rank - 1]} ${STAT_WORD[k]}` + (st ? `, ${RES_WORD[st]} на вас слабее на ${Math.round(A.res[G.rank - 1] * 100)}%` : ''); }
export function weaponMix(it, gems) {
  const g = (gems || []).filter(Boolean); if (!g.length) return null;
  const own = weaponElement(it), els = g.map(id => BY_ID[id].gem), rank = Math.max(...g.map(id => BY_ID[id].rank));
  if (g.length >= 2) return { a: els[0], b: els[1], rank, amp: !!own && (own === els[0] || own === els[1]) };
  if (own) return { a: own, b: els[0], rank, amp: false };
  return { a: els[0], b: null, rank, amp: false };
}
export const ELEMENT_LIST = ELEMENTS;
// откуда камень (книга рецептов): враги, элита, боссы, дождь, кузнец
export function gemSources(cfg, id) {
  const it = BY_ID[id], S = cfg.stones, name = t => (cfg.enemies[t] && cfg.enemies[t].name) || t;
  const foes = Object.keys(S.of).filter(t => S.of[t] === it.gem).map(name), out = [];
  if (it.rank === 1) { if (foes.length) out.push('С врагов: ' + foes.join(', ')); if (S.rain === it.gem) out.push('В дождь — с любого врага'); }
  if (it.rank === 2) { if (foes.length) out.push('С элиты: ' + foes.join(', ')); if (S.rain === it.gem) out.push('В дождь — с любой элиты'); out.push('Кузнец: три осколка → камень'); }
  if (it.rank === 3) { const b = Object.keys(S.hearts).filter(t => S.hearts[t] === it.gem).map(name); if (b.length) out.push('С боссов: ' + b.join(', ')); out.push('Кузнец: три камня → сердце'); }
  return out;
}
