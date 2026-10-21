// Тест библиотеки зачарований (4.00): книжница в лагере, разбор в пыль, добавить / перековать свойство, качество, цены, пределы,
// сохранение счётчика, генератор боя не сдвигается, пыль не уходит с хламом.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, mulberry32, refreshGear } from '../3d/src/sim.js';
import { enchant, enchantInfo, disenchant, dustOf } from '../3d/src/enchant3d.js';
import { entryOf, serialize, deserialize, gearStats } from '../3d/src/inv.js';
import { affixCount } from '../3d/src/affix3d.js';
import { sellJunk } from '../3d/src/economy3d.js';
import { CATALOG } from '../3d/src/data/items.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const C = CFG3.enchant, DUST = C.item;
const mk = () => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.wanderer.on = false; c.events.on = false; const W = createWorld(c, mulberry32(9)); W.inv.bag.length = 0; W.inv.ash = 1e5; W.nearNpc = 'scribe'; return W; };
const rare = CATALOG.find(i => i.slot === 'weapon' && i.rar === 3 && i.pool !== 'unique'), blue = CATALOG.find(i => i.slot === 'body' && i.rar === 2 && i.pool !== 'unique');

// книжница стоит в лагере
{ const W = mk(); ok(W.map.buildings.some(b => b.npc && b.npc.kind === 'scribe'), 'нет книжницы в лагере'); }
// разбор
{
  const W = mk(); W.inv.bag.push(entryOf(rare.id, 0, null, 20, { q: 1, crit: 2 }), { ...entryOf(blue.id, 0, null, 20, null), lock: true }, entryOf(rare.id, 0, [null, 'gem_fire_1'], 20, null));
  W.nearNpc = null; ok(disenchant(W, 0) === 'far', 'разбор без книжницы'); W.nearNpc = 'scribe';
  const r = disenchant(W, 0); ok(r && r.n === C.yield[3] && dustOf(W) === C.yield[3] && W.inv.bag.length === 3, 'разбор фиолетовой: ' + JSON.stringify(r));
  ok(disenchant(W, W.inv.bag.findIndex(s => s.lock)) === 'lock', 'разобрана вещь под замком');
  ok(disenchant(W, W.inv.bag.findIndex(s => s.g)) === 'gems', 'разобрана вещь с камнем');
  const ash0 = W.inv.ash; W.nearMerchant = true; W.night = false; sellJunk(W); ok(dustOf(W) === C.yield[3], 'пыль продана с хламом');
  ok(W.inv.ash >= ash0, 'хлам');
}
// добавить, пределы, цены, генератор боя
{
  const W = mk(); W.inv.bag.push({ id: DUST, n: 99 }, entryOf(blue.id, 0, null, 20, { q: .9, armor: 3 }));
  const rng0 = W.rng(), W2 = mk(); W2.rng();
  const where = { idx: 1 }, i0 = enchantInfo(W, where), ash0 = W.inv.ash, d0 = dustOf(W);
  ok(i0.cap === Math.min(C.cap, CFG3.affix.count[2] + C.extra) && i0.canAdd, 'предел свойств синей: ' + i0.cap);
  ok(enchant(W, where, 'add') === 'ok', 'добавить свойство');
  const s = W.inv.bag.find(x => x.id === blue.id), i1 = enchantInfo(W, { idx: W.inv.bag.indexOf(s) });
  ok(affixCount(s.af) === 2 && s.af.en === 1 && s.af.armor === 3 && s.af.q === .9, 'после добавления: ' + JSON.stringify(s.af));
  ok(W.inv.ash === ash0 - i0.cost.ash && dustOf(W) === d0 - i0.cost.dust, 'цена списана неверно');
  ok(i1.cost.ash > i0.cost.ash && i1.cost.dust >= i0.cost.dust, 'второе зачарование не дороже');
  ok(enchant(W, { idx: W.inv.bag.indexOf(s) }, 'add') === 'max', 'добавлено сверх предела');
  ok(W.rng() === W2.rng(), 'зачарование сдвинуло генератор боя');
  // перековка
  const keys0 = Object.keys(s.af).filter(k => k !== 'q' && k !== 'en'), k0 = keys0.find(k => k !== 'armor');
  ok(enchant(W, { idx: W.inv.bag.indexOf(s) }, 'reroll', k0) === 'ok' && !(k0 in s.af) && affixCount(s.af) === 2 && s.af.armor === 3 && s.af.en === 2, 'перековка: ' + JSON.stringify(s.af));
  ok(enchant(W, { idx: W.inv.bag.indexOf(s) }, 'reroll', 'nope') === 'none', 'перековка несуществующего свойства');
  // качество не падает
  let qs = [s.af.q]; for (let i = 0; i < 6; i++) { W.inv.ash = 1e5; enchant(W, { idx: W.inv.bag.indexOf(s) }, 'quality'); qs.push(s.af.q); }
  ok(qs.every((q, i) => !i || q >= qs[i - 1]) && qs[qs.length - 1] > .9 && qs[qs.length - 1] <= CFG3.affix.quality[1], 'качество упало или вне разброса: ' + qs);
  // нехватка
  W.inv.ash = 0; ok(enchant(W, { idx: W.inv.bag.indexOf(s) }, 'reroll', 'armor') === 'ash', 'без пепла');
  W.inv.ash = 1e5; W.inv.bag = W.inv.bag.filter(x => x.id !== DUST); ok(enchant(W, { idx: 0 }, 'reroll', 'armor') === 'dust', 'без пыли');
  W.nearNpc = 'smith'; ok(enchant(W, { idx: 0 }, 'quality') === 'far', 'зачарование без книжницы');
  // сохранение
  const d = deserialize(JSON.parse(JSON.stringify(serialize(W.inv))), 30); ok(d.bag[0].af && d.bag[0].af.en === s.af.en && d.bag[0].af.q === s.af.q, 'счётчик или качество потерялись: ' + JSON.stringify(d.bag[0].af));
}
// надетая вещь: зачарование сразу в силе героя
{
  const W = mk(); W.inv.bag.push({ id: DUST, n: 99 }); W.inv.eq.weapon = rare.id; W.inv.il.weapon = 30; W.inv.af.weapon = { q: .85 }; refreshGear(W);
  const g0 = gearStats(W.inv).dmg; let t = 0; while (W.inv.af.weapon.q < 1.1 && t++ < 40) enchant(W, { slot: 'weapon' }, 'quality');
  ok(gearStats(W.inv).dmg > g0, `качество надетого не подняло урон: ${g0} → ${gearStats(W.inv).dmg}`);
  ok(enchant(W, { slot: 'weapon' }, 'add') === 'ok' && affixCount(W.inv.af.weapon) === 1, 'свойство надетой вещи');
}
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Библиотека зачарований 3D: OK');
