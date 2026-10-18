// Крафт и знания: рецепты, чтение книг, записи бестиария и атласа, обратный индекс источников. Логика без графики (Node-тесты).
import { BY_ID } from './data/items.js';
import { RECIPES, RECIPE_BY_ID } from './data/recipes3d.js';
import { TOMES, TOME_BY_ID } from './data/tomes3d.js';
import { CONTAINERS, DROPS, SHOP, SHOP_STAPLES, BOSS_DROPS, BOSS_LOOT } from './data/loot.js';
import { addItem, removeAt, countOf, isPlain } from './inv.js';

export const newKnown = () => ({ tomes: {}, bestiary: {}, places: {}, kinds: {}, items: {} });
export const recipeKnown = (K, r) => !r.needs || !!K.tomes[r.needs];

// количество вещи в сумке; улучшенное оружие и броня в материалы не идут
const plainCount = (inv, id) => (BY_ID[id].slot ? inv.bag.reduce((c, s) => c + (s.id === id && isPlain(s) ? s.n : 0), 0) : countOf(inv, id));
function take(inv, id, n) {
  for (let i = inv.bag.length - 1; i >= 0 && n > 0; i--) { const s = inv.bag[i]; if (s.id !== id || (BY_ID[id].slot && !isPlain(s))) continue; const t = Math.min(n, s.n); removeAt(inv, i, t); n -= t; }
}

// 'ok' | 'tome' (нет книги) | 'far' (не у кузнеца) | 'mats' | 'ash'
export function craftStatus(W, r) {
  if (!recipeKnown(W.known, r)) return 'tome';
  if (W.nearNpc !== 'smith') return 'far';
  if (r.mats.some(([id, n]) => plainCount(W.inv, id) < n)) return 'mats';
  if (W.inv.ash < r.ash) return 'ash';
  return 'ok';
}
export const missing = (W, r) => r.mats.map(([id, n]) => [id, n, plainCount(W.inv, id)]);

// скрафтить; возвращает статус, 'full' (нет места) или 'ok'. Ничего не списывается, пока всё не получится
export function craft(W, id) {
  const r = RECIPE_BY_ID[id]; if (!r) return 'none';
  const st = craftStatus(W, r); if (st !== 'ok') return st;
  const tmp = { bag: JSON.parse(JSON.stringify(W.inv.bag)), eq: W.inv.eq, up: W.inv.up, ash: 0 };
  for (const [mid, n] of r.mats) take(tmp, mid, n);
  if (addItem(tmp, r.result.id, r.result.n, W.cfg.bag.slots + ((W.gear && W.gear.bag) || 0)) > 0) return 'full';
  W.inv.bag = tmp.bag; W.inv.ash -= r.ash; W.known.items[r.result.id] = 1;
  W.ev.push({ k: 'craft', id: r.result.id, n: r.result.n }); W.fx.quest('craft', { item: r.result.id }); return 'ok';
}

// прочитать книгу из сумки: открывает рецепты, записи бестиария и атласа; книга тратится
export function readTome(W, idx) {
  const s = W.inv.bag[idx], it = s && BY_ID[s.id]; if (!it || it.cat !== 'tome') return 'none';
  const t = TOME_BY_ID[it.tome], K = W.known;
  if (K.tomes[t.id]) return 'known';
  K.tomes[t.id] = 1; const T = t.teaches || {};
  for (const e of T.bestiary || []) K.bestiary[e] = 2;
  for (const id of T.places || []) { K.places[id] = 1; const pl = W.cfg.map.places.find(p => p.id === id); if (pl) W.fx.reveal(pl.x, pl.z, pl.r); }
  for (const k of T.kinds || []) K.kinds[k] = 1;
  removeAt(W.inv, idx, 1);
  W.fx.quest('tome', { tome: t.id });
  W.ev.push({ k: 'tome', name: t.name, recipes: RECIPES.filter(r => r.needs === t.id).length });
  return 'ok';
}

// ---- источники предмета ----
export const POOL_NAME = { food: 'еда', potion: 'зелья', medic: 'лекарства', material: 'материалы', monstermat: 'трофеи монстров', coin: 'монеты', curio: 'безделушки', book: 'записки', key: 'ключи', tome: 'книги', weapon: 'оружие', ranged: 'луки и арбалеты', shield: 'щиты', head: 'шлемы', body: 'броня', cloak: 'плащи', boots: 'обувь', ring: 'кольца', amulet: 'амулеты' };
export function sourcesOf(id) {
  const it = BY_ID[id], out = { containers: [], drops: [], bosses: [], shop: false, fairy: it.pool === 'gold' || it.pool === 'fairy', craft: [], uses: [] };
  for (const [k, d] of Object.entries(CONTAINERS)) if (d.pools.some(p => p[1] > 0 && p[0] === it.pool)) out.containers.push(k);
  for (const [t, d] of Object.entries(DROPS)) if (it.pool === 'magic' || d.pools.some(p => p[1] > 0 && p[0] === it.pool)) out.drops.push(t);     // посохи и жезлы — свой бросок с любого врага (stones3d → magicDropOf)
  for (const [t, b] of Object.entries(BOSS_DROPS)) if (b.trophy === id || b.tomes.some(x => 'tome_' + x === id) || id === 'key_black' || BOSS_LOOT.pools.some(p => p[0] === it.pool)) out.bosses.push(t);
  out.shop = SHOP.pools.some(p => p[1] > 0 && p[0] === it.pool) || SHOP_STAPLES.some(([sid]) => sid === id);
  for (const r of RECIPES) { if (r.result.id === id) out.craft.push(r.id); if (r.mats.some(([m]) => m === id)) out.uses.push(r.id); }
  return out;
}

// ---- записи бестиария ----
const ZONE_PLACE = { graveyard: 'pogost', farm: 'polya', ruins: 'ruiny', camp: 'lager' }, ZONE_NAME = { bandits: 'стоянки разбойников', barrow: 'курганы' };     // у мест большого мира (G2) — общее имя
export function bestiaryEntry(type, cfg) {
  const C = cfg.enemies[type]; if (!C) return null;
  const names = z => { const p = cfg.map.places.find(q => q.id === ZONE_PLACE[z]); return p ? p.name : ZONE_NAME[z] || z; };
  const where = Object.entries(cfg.enemies.regions || {}).filter(([, t]) => t.some(x => x[0] === type)).map(([z]) => names(z));
  const lair = (cfg.bosses.list.find(b => b.type === type) || null);
  if (lair) { const pl = cfg.map.places.filter(p => Math.hypot(p.x - lair.x, p.z - lair.z) < p.r).sort((a, b) => a.r - b.r)[0]; where.push(pl ? pl.name : 'глушь'); }
  else if (!where.length || ['imp', 'brute'].includes(type)) where.unshift('везде');
  const on = C.on ? { poison: 'яд', bleed: 'кровотечение', burn: 'горение' }[C.on[0]] : null;
  const loot = C.boss ? ['трофей', 'книги', 'добыча босса'] : (DROPS[type] ? [...new Set(DROPS[type].pools.filter(p => p[1] > 0).map(p => POOL_NAME[p[0]] || p[0]))] : []);
  return { name: C.name || { imp: 'Бес', brute: 'Рогач', hound: 'Гончая', ghoul: 'Упырь' }[type], where, hp: C.hp, dmg: C.damage, speed: C.speed, on, immune: (C.immune || []).map(x => ({ stun: 'оглушение', freeze: 'заморозку' }[x])), loot, boss: !!C.boss, xp: C.xp, wind: C.wind };
}

// ---- сохранение ----
export function serializeKnown(K) { const l = o => Object.keys(o).filter(k => o[k]); return { tomes: l(K.tomes), bestiary: { ...K.bestiary }, places: l(K.places), kinds: l(K.kinds), items: l(K.items) }; }
export function sanitizeKnown(d, cfg) {
  const K = newKnown(); if (!d || typeof d !== 'object') return K;
  const arr = a => (Array.isArray(a) ? a.slice(0, 800) : []);
  for (const t of arr(d.tomes)) if (TOME_BY_ID[t]) K.tomes[t] = 1;
  for (const [t, v] of Object.entries(d.bestiary && typeof d.bestiary === 'object' ? d.bestiary : {})) if (cfg.enemies[t] && (v === 1 || v === 2)) K.bestiary[t] = v;
  for (const p of arr(d.places)) if (cfg.map.places.some(x => x.id === p)) K.places[p] = 1;
  for (const k of arr(d.kinds)) if (CONTAINERS[k]) K.kinds[k] = 1;
  for (const i of arr(d.items)) if (BY_ID[i]) K.items[i] = 1;
  return K;
}
