// Виды контейнеров и таблицы добычи. Всё в данных: хотите новый вид — добавьте строку в CONTAINERS.
// pools: [пул вещей, вес]. q — качество (сдвигает редкость вверх), slots — сколько «выпадений», reach — радиус касания.
import { BY_POOL } from './items.js';

export const CONTAINERS = {
  crate:      { name: 'Ящик', q: 0, slots: [1, 2], pools: [['food', 3], ['material', 3], ['curio', 2], ['coin', 2], ['medic', 1]] },
  barrel:     { name: 'Бочка', q: 0, slots: [1, 2], pools: [['food', 4], ['potion', 1], ['material', 2], ['coin', 1]] },
  sack:       { name: 'Мешок', q: 0, slots: [1, 2], pools: [['food', 2], ['material', 2], ['curio', 2], ['coin', 2], ['cloak', 1]] },
  chest:      { name: 'Деревянный сундук', q: 1, slots: [2, 3], pools: [['weapon', 1], ['ranged', .6], ['body', 1], ['head', 1], ['food', 1], ['potion', 1], ['ring', 1], ['curio', 2], ['coin', 2], ['key', 1], ['tome', .4]] },
  ironchest:  { name: 'Окованный сундук', q: 2, slots: [2, 4], pools: [['weapon', 2], ['ranged', 1], ['body', 1], ['shield', .6], ['head', 1], ['boots', 1], ['ring', 1], ['amulet', 1], ['potion', 2], ['coin', 2], ['key', 1], ['tome', .5]] },
  locked:     { name: 'Запертый сундук', q: 3, slots: [3, 5], locked: true, minRar: 2, pools: [['weapon', 3], ['ranged', 1], ['body', 2], ['shield', .8], ['head', 2], ['boots', 1], ['cloak', 1], ['ring', 2], ['amulet', 2], ['potion', 2], ['coin', 1], ['tome', 1.2]] },
  coffer:     { name: 'Шкатулка', q: 2, slots: [1, 2], reach: 1.1, pools: [['ring', 3], ['amulet', 2], ['curio', 3], ['coin', 3]] },
  wardrobe:   { name: 'Шкаф', q: 1, slots: [1, 3], pools: [['head', 2], ['cloak', 3], ['body', 2], ['boots', 2], ['curio', 1]] },
  rack:       { name: 'Оружейная стойка', q: 1, slots: [1, 2], pools: [['weapon', 1], ['ranged', .7]] },
  armorstand: { name: 'Стойка с бронёй', q: 1, slots: [1, 2], pools: [['head', 2], ['body', 2], ['shield', 1], ['boots', 1], ['cloak', 1]] },
  medchest:   { name: 'Лекарский ящик', q: 1, slots: [2, 3], pools: [['medic', 4], ['potion', 3], ['food', 1], ['material', 1]] },
  smithchest: { name: 'Ящик кузнеца', q: 1, slots: [2, 3], pools: [['material', 4], ['weapon', 1], ['coin', 1], ['tome', .8]] },
  shelf:      { name: 'Книжная полка', q: 1, slots: [1, 2], pools: [['book', 5], ['tome', 1.5], ['curio', 1], ['potion', 1]] },
  corpse:     { name: 'Мёртвый путник', q: 1, slots: [1, 3], reach: 1.2, pools: [['weapon', 1], ['ranged', .4], ['body', 1], ['food', 2], ['coin', 2], ['curio', 1], ['key', 1], ['medic', 1], ['tome', .3]] },
  grave:      { name: 'Могила', q: 2, slots: [1, 2], reach: 1.2, pools: [['curio', 3], ['ring', 1], ['amulet', 1], ['coin', 2], ['material', 1]] },
  altar:      { name: 'Алтарь подношений', q: 3, slots: [1, 2], reach: 1.4, pools: [['amulet', 3], ['ring', 2], ['curio', 2], ['potion', 1], ['tome', .8]] },
  cache:      { name: 'Тайник', q: 2, slots: [2, 3], reach: 1.2, pools: [['weapon', 1], ['ranged', .5], ['body', 1], ['ring', 1], ['amulet', 1], ['potion', 2], ['coin', 2], ['key', 1], ['tome', .6]] },
  wagon:      { name: 'Телега', q: 1, slots: [2, 4], reach: 1.8, pools: [['food', 2], ['material', 3], ['coin', 2], ['weapon', 1], ['sack', 0]] }
};
// витрина торговца
export const SHOP = { name: 'Витрина', q: .8, slots: [11, 13], pools: [['weapon', 2], ['ranged', 1], ['body', 1], ['shield', .8], ['head', 1], ['boots', 1], ['cloak', 1], ['ring', 1], ['amulet', 1], ['potion', 3], ['medic', 2], ['food', 2], ['material', 1], ['key', 1], ['tome', 1]] };
export const SHOP_STAPLES = [['p_heal1', 3], ['h_rag_bandage', 5], ['f_rye', 6], ['key_rust', 2]];
// трофеи и книги боссов: trophy — материал, n — сколько (минимум и шанс лишнего), tomes — книги по порядку (выпадает первая неизвестная)
export const BOSS_DROPS = {
  devourer: { trophy: 'm_devourer_heart', n: [2, .5], tomes: ['set_pogost', 'blades_pogost'] },
  lord: { trophy: 'm_eclipse_cloak', n: [2, .5], tomes: ['set_eclipse', 'blades_eclipse'] },
  chief: { trophy: 'm_chief_fang', n: [2, .5], tomes: ['set_rust', 'blades_rust'] }
};
// добыча боссов (кроме гарантированного уникального клинка)
export const BOSS_LOOT = { name: 'Добыча босса', q: 3, slots: [3, 3], pools: [['weapon', 1], ['body', 1], ['head', 1], ['boots', 1], ['ring', 2], ['amulet', 2], ['potion', 2], ['key', 1]] };
// выпадение с монстров
export const DROPS = {
  imp:   { chance: .45, slots: [1, 1], q: 0, pools: [['material', 4], ['coin', 3], ['food', 2], ['curio', 1], ['medic', 1]] },
  hound: { chance: .4, slots: [1, 1], q: 0, pools: [['material', 3], ['monstermat', 3], ['food', 2], ['coin', 1]] },
  ghoul: { chance: .7, slots: [1, 2], q: 1, pools: [['curio', 3], ['coin', 2], ['material', 2], ['monstermat', 3], ['ring', 1], ['amulet', 1], ['medic', 1]] },
  archer: { chance: .6, slots: [1, 2], q: 1, pools: [['material', 3], ['coin', 2], ['food', 2], ['weapon', 1], ['ranged', 1.2], ['medic', 1], ['monstermat', 1]] },
  witch: { chance: .75, slots: [1, 2], q: 2, pools: [['curio', 3], ['coin', 2], ['amulet', 1], ['ring', 1], ['medic', 2], ['monstermat', 2], ['material', 1]] },
  shield: { chance: .8, slots: [1, 2], q: 1, pools: [['material', 3], ['body', 2], ['head', 1], ['coin', 2], ['weapon', 1], ['key', 1]] },
  bomber: { chance: .5, slots: [1, 1], q: 0, pools: [['material', 3], ['monstermat', 2], ['potion', 1], ['coin', 2]] },
  lunger: { chance: .65, slots: [1, 2], q: 1, pools: [['weapon', 2], ['monstermat', 3], ['curio', 2], ['coin', 1], ['medic', 1]] },
  shade: { chance: .7, slots: [1, 2], q: 2, pools: [['curio', 3], ['ring', 1], ['amulet', 2], ['monstermat', 2], ['coin', 1]] },
  brute: { chance: .85, slots: [1, 2], q: 1, pools: [['material', 3], ['monstermat', 2], ['coin', 2], ['weapon', 1], ['body', 1], ['potion', 1], ['key', 1], ['ring', 1]] }
};

// базовые веса редкости: сдвиг растёт с качеством, глубиной (дальше от костра) и удачей
const BASE = [58, 27, 10, 4, 1];
export function rarityWeights(q, depth, luck) {
  const shift = q * .45 + depth * .7 + luck * .03;
  return BASE.map((w, r) => w * Math.exp(shift * r));
}
const pickW = (arr, rng, wf = x => x[1]) => { let t = 0; for (const a of arr) t += wf(a); let r = rng() * t; for (const a of arr) { r -= wf(a); if (r <= 0) return a; } return arr[arr.length - 1]; };

// одна вещь из пула по редкости (если такой редкости нет — ближайшая ниже, потом выше)
export function pickItem(pool, rar, rng) {
  const tiers = BY_POOL[pool]; if (!tiers) return null;
  for (let d = 0; d < 5; d++) for (const r of [rar - d, rar + d]) if (r >= 0 && r < 5 && tiers[r].length) return tiers[r][(rng() * tiers[r].length) | 0];
  return null;
}

// бросок добычи: [{id, n}]
export function rollLoot(def, rng, depth = 0, luck = 0, extraQ = 0) {
  const [a, b] = def.slots, slots = a + ((rng() * (b - a + 1)) | 0), out = [], w = rarityWeights(def.q + extraQ, depth, luck);
  for (let i = 0; i < slots; i++) {
    const pool = pickW(def.pools.filter(p => p[1] > 0 && BY_POOL[p[0]]), rng)[0];
    let rar = pickW(w.map((x, r) => [r, x]), rng)[0];
    if (def.minRar && i === 0) rar = Math.max(rar, def.minRar);
    const it = pickItem(pool, rar, rng); if (!it) continue;
    const n = it.stack > 1 ? 1 + ((rng() * Math.min(it.stack, it.cat === 'curio' && it.pool === 'coin' ? 6 : 3)) | 0) : 1;
    const ex = out.find(o => o.id === it.id);
    if (ex) ex.n = Math.min(it.stack, ex.n + n); else out.push({ id: it.id, n });
  }
  return out;
}
export function rollDrop(kind, rng, depth = 0, luck = 0) {
  const d = DROPS[kind]; if (!d || rng() > d.chance) return [];
  return rollLoot(d, rng, depth, luck);
}
