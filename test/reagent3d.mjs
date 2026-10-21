// Тест ремесла 2.0 (4.02): скованное снаряжение — качество мастера и свойства как у находки, реагент задаёт свойство, уголёк — качество
// на предел; найденная вещь с качеством годится в основу рецепта; в библиотеке реагент вписывает свойство, осколок — до предела;
// сырьё в добыче: чем реже, тем меньше падает; реагенты не продаются с хламом; цепочки короче.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32 } from '../3d/src/sim.js';
import { craft, reagentsFor, masterQ } from '../3d/src/craft3d.js';
import { enchant } from '../3d/src/enchant3d.js';
import { affixCount } from '../3d/src/affix3d.js';
import { sellJunk } from '../3d/src/economy3d.js';
import { RECIPE_BY_ID } from '../3d/src/data/recipes3d.js';
import { CONTAINERS, rollLoot } from '../3d/src/data/loot.js';
import { BY_ID } from '../3d/src/data/items.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const C = CFG3.craft;
const mk = (seed = 1) => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.events.on = false; c.wanderer.on = false; const W = createWorld(c, mulberry32(seed)); W.life.prof = { smith: 150, alch: 150, leather: 150 }; W.inv.bag.length = 0; W.inv.ash = 1e5; W.known.tomes.fine = 1; W.known.tomes.smelting = 1; return W; };
const atSmith = W => { const b = W.map.buildings.find(x => x.npc && x.npc.kind === 'smith'); W.player.x = b.npc.x + 1; W.player.z = b.npc.z; W.player.inv = 1e9; step(W, 1 / 60, {}); };
const give = (W, id, n = 1, extra) => W.inv.bag.push({ id, n, ...(extra || {}) });
const kit = W => { give(W, 'w_sword_iron', 1, { il: 10, af: { q: .9, crit: 2 } }); give(W, 'm_tempered_sinew', 1); give(W, 'm_ingot', 1); };     // основа — находка с качеством

// цепочки короче
ok(RECIPE_BY_ID.ingot.mats.find(([m]) => m === 'm_ore')[1] === 2 && RECIPE_BY_ID.steel.mats.find(([m]) => m === 'm_ingot')[1] === 1, 'цепочка плавки не короче');
// найденная вещь с качеством годится в основу; скованное — качество мастера и свойства
{
  const W = mk(); atSmith(W); kit(W); const r = craft(W, 'w_sword_tempered');
  const s = W.inv.bag.find(x => x.id === 'w_sword_tempered'), [q0, q1] = masterQ(W, RECIPE_BY_ID.w_sword_tempered);
  ok(r === 'ok' && s, 'находка с качеством не пошла в основу: ' + r);
  ok(s && s.af && s.af.q >= q0 && s.af.q <= q1 && affixCount(s.af) === (CFG3.affix.count[BY_ID.w_sword_tempered.rar] || 0), 'скованное без качества мастера или свойств: ' + JSON.stringify(s && s.af));
  W.life.prof.smith = 0; ok(masterQ(W, RECIPE_BY_ID.w_sword_tempered)[0] < q0 && masterQ(W, RECIPE_BY_ID.w_sword_tempered)[0] === C.q[0], 'навык не поднимает качество мастера');
}
// реагент задаёт свойство; без реагента — ошибка, ничего не списано
{
  const W = mk(2); atSmith(W); kit(W); const n = C.reagN[BY_ID.w_sword_tempered.rar];
  ok(craft(W, 'w_sword_tempered', 'm_sulfur') === 'reag' && W.inv.bag.length === 3, 'ковка без реагента списала');
  give(W, 'm_sulfur', n); ok(reagentsFor(W, BY_ID.w_sword_tempered).some(x => x.id === 'm_sulfur' && x.key === 'burnCh' && x.have === n), 'сера не реагент поджога');
  ok(craft(W, 'w_sword_tempered', 'm_sulfur') === 'ok', 'ковка с реагентом'); const s = W.inv.bag.find(x => x.id === 'w_sword_tempered');
  ok(s && s.af.burnCh > 0 && !W.inv.bag.some(x => x.id === 'm_sulfur'), 'реагент не задал свойство или не списан: ' + JSON.stringify(s && s.af));
  kit(W); give(W, C.ember, 1); ok(craft(W, 'w_sword_tempered', C.ember) === 'ok' && W.inv.bag.filter(x => x.id === 'w_sword_tempered').some(x => x.af.q === C.q[2]), 'уголёк не поднял качество на предел');
  ok(craft(W, 'w_sword_tempered', 'm_web_nope') !== 'ok', 'чужой реагент');
}
// библиотека: реагент вписывает свойство, уголёк — качество, осколок — до предела
{
  const W = mk(3); W.nearNpc = 'scribe'; give(W, 'm_arcane_dust', 50); give(W, 'w_sword_steel', 1, { il: 20, af: { q: .9 } }); give(W, 'm_web', 3); give(W, C.ember, 1); give(W, C.shard, 1);
  const idx = () => W.inv.bag.findIndex(x => x.id === 'w_sword_steel'), af = () => W.inv.bag[idx()].af;
  ok(enchant(W, { idx: idx() }, 'add', null, 'm_web') === 'ok' && af().poisonCh > 0, 'паутина не вписала яд: ' + JSON.stringify(af()));
  ok(enchant(W, { idx: idx() }, 'quality', null, C.ember) === 'ok' && af().q === CFG3.affix.quality[1], 'уголёк в библиотеке');
  ok(enchant(W, { idx: idx() }, 'max', 'poisonCh') === 'ok' && af().poisonCh === CFG3.affix.max.poisonCh && !W.inv.bag.some(x => x.id === C.shard), 'осколок не довёл до предела');
  ok(enchant(W, { idx: idx() }, 'max', 'poisonCh') === 'max', 'второй раз до предела');
  ok(enchant(W, { idx: idx() }, 'add', null, 'm_sulfur') === 'reag', 'реагент, которого нет в сумке');
}
// сырьё: чем реже, тем меньше падает (по всем сундукам мира, уровень 40)
{
  const rng = mulberry32(5), got = [0, 0, 0, 0, 0], cnt = [0, 0, 0, 0, 0];
  for (const it of Object.values(BY_ID)) if (it.pool === 'material') cnt[it.rar]++;
  for (let i = 0; i < 20000; i++) for (const x of rollLoot(CONTAINERS.crate, rng, 1, 0, 0, 1, { lvl: 40, L: CFG3.loot })) { const it = BY_ID[x.id]; if (it.pool === 'material') got[it.rar]++; }
  const per = got.map((g, r) => (cnt[r] ? g / cnt[r] : 0)); ok(per[0] > per[1] && per[1] > per[2] && per[2] > per[4], 'редкость сырья перевёрнута: ' + per.map(x => x.toFixed(1)).join(' / '));
}
// реагенты не уходят с хламом
{
  const W = mk(4); W.nearMerchant = true; W.night = false; give(W, 'm_imp_fang', 3); give(W, 'm_ore', 2); sellJunk(W);
  ok(W.inv.bag.some(x => x.id === 'm_imp_fang') && !W.inv.bag.some(x => x.id === 'm_ore'), 'реагент продан как хлам');
}
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Ремесло и реагенты 3D: OK');
