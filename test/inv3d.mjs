// Тест добычи и сумки 3D.
import { CATALOG, BY_ID, RARITY } from '../3d/src/data/items.js';
import { CONTAINERS, DROPS, rollLoot, rollDrop, rarityWeights } from '../3d/src/data/loot.js';
import { createInv, addItem, removeAt, equipAt, unequip, gearStats, countOf, serialize, deserialize, betterThanWorn } from '../3d/src/inv.js';
import { mulberry32 } from '../3d/src/sim.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };

// таблицы добычи ссылаются на существующие пулы; виды контейнеров не пусты
for (const [k, d] of Object.entries({ ...CONTAINERS, ...DROPS })) {
  const rng = mulberry32(k.length * 17);
  for (let i = 0; i < 300; i++) { const r = rollLoot(d, rng, rng(), 0); ok(r.length > 0 || d.pools.every(p => !p[1]), `пустая добыча: ${k}`); for (const x of r) { ok(BY_ID[x.id], `${k}: неизвестная вещь ${x.id}`); ok(x.n >= 1 && x.n <= BY_ID[x.id].stack, `${k}: количество ${x.n} у ${x.id}`); } }
}
ok(Object.keys(CONTAINERS).length >= 15, 'видов контейнеров мало');
// редкость растёт с глубиной, качеством и удачей
const meanRar = (def, depth, luck, extra = 0) => { const rng = mulberry32(5); let s = 0, n = 0; for (let i = 0; i < 3000; i++) for (const x of rollLoot(def, rng, depth, luck, extra)) { s += BY_ID[x.id].rar; n++; } return s / n; };
const base = meanRar(CONTAINERS.chest, 0, 0);
ok(meanRar(CONTAINERS.chest, 1, 0) > base + .25, 'глубина не улучшает добычу'); ok(meanRar(CONTAINERS.chest, 0, 30) > base + .1, 'удача не улучшает добычу');
ok(meanRar(CONTAINERS.ironchest, 0, 0) > base, 'окованный сундук не лучше деревянного');
// запертый сундук: всегда хотя бы одна вещь редкости ≥ 2 (кроме случаев, когда пул пуст)
{ const rng = mulberry32(11); let bad = 0; for (let i = 0; i < 500; i++) { const r = rollLoot(CONTAINERS.locked, rng, .2, 0); if (!r.some(x => BY_ID[x.id].rar >= 2)) bad++; } ok(bad === 0, `запертый сундук без ценного: ${bad}/500`); }
// разнообразие: за 4000 бросков выпадает большая часть каталога
{ const rng = mulberry32(21), seen = new Set(); for (let i = 0; i < 4000; i++) { const keys = Object.keys(CONTAINERS); for (const x of rollLoot(CONTAINERS[keys[i % keys.length]], rng, rng(), 0)) seen.add(x.id); } ok(seen.size > CATALOG.length * .6, `выпала лишь часть каталога: ${seen.size}/${CATALOG.length}`); console.log('выпало разных вещей:', seen.size, 'из', CATALOG.length); }
// монстры: шанс выпадения
{ const rng = mulberry32(3); let imp = 0, br = 0; for (let i = 0; i < 2000; i++) { if (rollDrop('imp', rng).length) imp++; if (rollDrop('brute', rng).length) br++; } ok(imp > 700 && imp < 1100, 'шанс бесов ' + imp); ok(br > 1550, 'шанс рогачей ' + br); }
ok(rarityWeights(0, 0, 0)[0] > rarityWeights(0, 0, 0)[4] * 20, 'в обычной добыче должно быть много обычного');

// сумка
{
  const inv = createInv(), M = 4;
  ok(addItem(inv, 'f_rye', 25, M) === 0 && countOf(inv, 'f_rye') === 25 && inv.bag.length === 3, 'стеки по 10');
  ok(addItem(inv, 'w_sword_iron', 1, M) === 0 && addItem(inv, 'w_axe_iron', 1, M) === 1, 'сумка переполняется, остаток возвращается');
  removeAt(inv, 0, 10); ok(countOf(inv, 'f_rye') === 15, 'удаление части стека'); removeAt(inv, 0, 99); ok(countOf(inv, 'f_rye') === 5, 'удаление стека');
  const w = inv.bag.findIndex(s => s.id === 'w_sword_iron'); ok(equipAt(inv, w) && inv.eq.weapon === 'w_sword_iron', 'надеть'); 
  addItem(inv, 'w_sword_steel', 1, M); ok(betterThanWorn(inv, BY_ID.w_sword_steel) && !betterThanWorn(inv, BY_ID.w_sword_rust), 'сравнение ▲');
  const s = inv.bag.findIndex(x => x.id === 'w_sword_steel'); equipAt(inv, s); ok(inv.eq.weapon === 'w_sword_steel' && countOf(inv, 'w_sword_iron') === 1, 'замена возвращает старое в сумку');
  ok(!equipAt(inv, inv.bag.findIndex(x => x.id === 'f_rye')), 'еда не надевается');
  ok(unequip(inv, 'weapon', M) && inv.eq.weapon === null && countOf(inv, 'w_sword_steel') === 1, 'снять');
  inv.bag = []; for (let i = 0; i < M; i++) inv.bag.push({ id: 'f_rye', n: 1 }); inv.eq.head = 'a_head_helm_iron'; ok(!unequip(inv, 'head', M), 'снять в полную сумку нельзя');
  const g = (() => { const i = createInv(); i.eq.weapon = 'w_sword_steel'; i.eq.body = 'a_body_mail_mail'; i.eq.ring = 'r_ring_might'; return gearStats(i, [{ stat: 'dmg', amt: 10, t: 5 }]); })();
  ok(g.dmg === BY_ID.w_sword_steel.stats.dmg + 3 + 10 && g.armor === BY_ID.a_body_mail_mail.stats.armor, 'суммирование статов и баффов ' + JSON.stringify(g));
  ok(gearStats(createInv()).swing === 1, 'без экипировки swing=1');
  // сохранение: мусор отбрасывается
  const d = deserialize({ bag: [{ id: 'f_rye', n: 3 }, { id: 'нет_такого', n: 1 }, { id: 'f_rye', n: -5 }, null, { id: 'w_sword_iron', n: 99 }], eq: { weapon: 'w_axe_iron', head: 'w_axe_iron', ring: 'нет' }, ash: 12.7 }, 30);
  ok(d.bag.length === 2 && d.bag[1].n === 1 && d.eq.weapon === 'w_axe_iron' && d.eq.head === null && d.ash === 12, 'очистка сохранения ' + JSON.stringify(d));
  ok(JSON.stringify(deserialize(serialize(d), 30)) === JSON.stringify(d), 'круг сохранения'); ok(deserialize(null, 30).bag.length === 0 && deserialize('x', 30).ash === 0, 'пустое сохранение');
}
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.slice(0, 25).join('\n')); process.exit(1); }
console.log('Добыча и сумка 3D: OK');
