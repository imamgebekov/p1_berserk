// Тест добычи по сложности края (просьба владельца 2026-10-20): сундук в лёгком краю — простое и редко хорошее, в сложном —
// хорошее; золото только в сундуках сложных краёв (2–3%); с врагов добычи меньше и не больше одной вещи; loot.on: false — как раньше.
import { CFG3 } from '../3d/src/config3d.js';
import { rollLoot, rollDrop, CONTAINERS, chestGold } from '../3d/src/data/loot.js';
import { BY_ID } from '../3d/src/data/items.js';
import { createWorld, mulberry32 } from '../3d/src/sim.js';
import { levelAt } from '../3d/src/levels3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const good = lvl => { const r = mulberry32(lvl * 13 + 1); let g = 0, n = 0; for (let i = 0; i < 3000; i++) for (const it of rollLoot(CONTAINERS.chest, r, 1, 0, 0, 1, { lvl, L: CFG3.loot })) { const I = BY_ID[it.id]; if (!I.slot) continue; n++; if (I.rar >= 3) g++; } return g / n; };
const g3 = good(3), g30 = good(30), g58 = good(58);
ok(g3 < .1 && g58 > .3 && g3 < g30 && g30 < g58, `великое и выше: ур.3 ${(g3 * 100).toFixed(1)}%, ур.30 ${(g30 * 100).toFixed(1)}%, ур.58 ${(g58 * 100).toFixed(1)}%`);
{ const r = mulberry32(5); let n = 0, kills = 0; for (let i = 0; i < 4000; i++) { const a = rollDrop('brute', r, .5, 0, .25, { lvl: 20, L: CFG3.loot }, CFG3.drops); n += a.length; ok(a.length <= CFG3.drops.slots, 'с врага больше одной вещи'); kills++; }
  ok(n / kills < .6, `с рогача ${(n / kills).toFixed(2)} вещи на убийство`); }
// золото в сундуках: только в краях от 30-го уровня, в сложных — около 2–3%
{ const W = createWorld(CFG3, mulberry32(1)), K = CFG3.loot.goldKinds; let hard = 0, hardGold = 0, easyGold = 0;
  for (const c of W.levels.surface.map.containers) { if (!K.includes(c.kind) || !c.items) continue; const lv = levelAt(W, c.x, c.z), gold = c.items.some(it => BY_ID[it.id].pool === 'gold');
    if (lv >= 45) { hard++; if (gold) hardGold++; } else if (lv < 30 && gold) easyGold++; }
  ok(easyGold === 0, `золото в лёгком краю: ${easyGold}`); ok(hard > 40, `сундуков в сложных краях мало: ${hard}`);
  console.log(`сундуков в краях 45+: ${hard}, с золотом ${hardGold} (${(hardGold / hard * 100).toFixed(1)}%)`); ok(hardGold / hard < .08, 'золота слишком много'); }
// бросок золота: по уровням края — 0 / 1% / 2% / 3%, только сундуки нужных видов
for (const [lv, want] of [[20, 0], [35, .01], [42, .02], [55, .03]]) { let n = 0; for (let i = 0; i < 20000; i++) if (chestGold(CFG3.loot, 'ironchest', lv, i * 37 + 11, i % 97)) n++; ok(Math.abs(n / 20000 - want) < .006, `золото на ур.${lv}: ${(n / 200).toFixed(2)}% (ждём ${want * 100}%)`); }
ok(!chestGold(CFG3.loot, 'crate', 58, 1, 1) && [...Array(5000).keys()].every(i => !chestGold(CFG3.loot, 'barrel', 58, i, 3)), 'золото в ящике или бочке');
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log(`Добыча по сложности 3D: OK (великое+ ур.3 ${(g3 * 100).toFixed(1)}% → ур.58 ${(g58 * 100).toFixed(1)}%)`);
