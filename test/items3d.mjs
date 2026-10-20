// Тест каталога вещей 3D: размер, уникальность, качество данных, лестница силы.
import { CATALOG, BY_ID, BY_POOL, RARITY, SLOTS } from '../3d/src/data/items.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const n = CATALOG.length;
ok(n >= 300 && n <= 760, `размер каталога ${n} вне 300–760`);     // 760: трофеи новых подземелий (2026-10-20)
ok(new Set(CATALOG.map(i => i.id)).size === n, 'повторяются id');
ok(new Set(CATALOG.map(i => i.name)).size === n, 'повторяются названия: ' + CATALOG.map(i => i.name).filter((x, i, a) => a.indexOf(x) !== i).slice(0, 5).join(', '));
for (const it of CATALOG) {
  ok(it.name && /[а-яё]/i.test(it.name) && !/[a-z]{3}/i.test(it.name), 'название не по-русски: ' + it.id);
  ok(it.rar >= 0 && it.rar < RARITY.length, 'редкость ' + it.id);
  ok(it.value >= 1 && Number.isFinite(it.value), 'цена ' + it.id);
  ok(it.stack >= 1, 'стек ' + it.id);
  ok(it.pool && BY_POOL[it.pool], 'пул ' + it.id);
  if (it.slot) { ok(SLOTS.includes(it.slot), 'слот ' + it.id); ok(it.stats && Object.keys(it.stats).length, 'нет статов ' + it.id); ok(it.stack === 1, 'экипировка стопкой ' + it.id); }
  for (const [k, v] of Object.entries(it.stats || {})) ok(Number.isFinite(v), `стат ${it.id}.${k}`);
  if (it.cat === 'consumable') ok(it.use && it.text, 'расходник без эффекта ' + it.id);
  if (it.cat === 'key') ok(it.keyTier >= 1, 'ключ без уровня ' + it.id);
  ok(it.text !== undefined || it.slot, 'нет текста ' + it.id);
}
// у каждого пула есть вещи; у главных пулов — все редкости, кроме экзотики
for (const p of ['weapon', 'head', 'body', 'cloak', 'boots', 'ring', 'amulet', 'food', 'potion', 'medic', 'material', 'curio', 'coin', 'key', 'book']) ok(BY_POOL[p] && BY_POOL[p].flat().length, 'пустой пул ' + p);
for (const p of ['weapon', 'head', 'body', 'boots']) for (let r = 0; r < 5; r++) ok(BY_POOL[p][r].length, `пул ${p}: нет редкости ${r}`);
// лестница силы: оружие с ростом редкости в среднем сильнее
const avg = (pool, r, key) => { const a = BY_POOL[pool][r]; return a.length ? a.reduce((s, i) => s + (i.stats[key] || 0), 0) / a.length : 0; };
for (let r = 1; r < 5; r++) { ok(avg('weapon', r, 'dmg') > avg('weapon', r - 1, 'dmg') * .98, `оружие редкости ${r} не сильнее ${r - 1}`); ok(avg('body', r, 'armor') >= avg('body', r - 1, 'armor') * .98, `броня редкости ${r} не крепче`); }
const maxDmg = Math.max(...CATALOG.filter(i => i.slot === 'weapon').map(i => i.stats.dmg)), maxArm = CATALOG.filter(i => i.slot !== 'weapon' && i.stats && i.stats.armor).reduce((m, i) => Math.max(m, i.stats.armor), 0);
ok(maxDmg <= 40 && maxArm <= 30, `потолок статов: урон ${maxDmg}, броня ${maxArm}`);
// счётчики для отчёта
const by = {}; for (const i of CATALOG) by[i.cat] = (by[i.cat] || 0) + 1;
console.log('каталог:', n, JSON.stringify(by));
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.slice(0, 30).join('\n')); process.exit(1); }
console.log('Каталог 3D: OK');
