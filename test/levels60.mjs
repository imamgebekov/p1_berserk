// Уровни до 60 (этап 0, 2026-10-19): уровень места из глубины (ядро 1–20, край мира 60); враги за ядром крепче по уровню;
// опыт растёт; уровень вещи масштабирует урон, броню и здоровье (родной уровень — как в каталоге), ездит с вещью и сохраняется;
// снаряжение с врагов — уровня места, у торговца и кузнеца — уровня героя; потолок — 60-й уровень.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, mulberry32, spawnEnemy, killEnemy, step, refreshGear, buyItem } from '../3d/src/sim.js';
import { levelOfDepth, pointAtDepth, levelAt } from '../3d/src/levels3d.js';
import { gainXp } from '../3d/src/progress3d.js';
import { BY_ID } from '../3d/src/data/items.js';
import { createInv, equipAt, unequip, serialize, deserialize, gearStats, ilMul, nomIl, scoreUp } from '../3d/src/inv.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const L = CFG3.level;
ok(L.max === 60 && Math.round(levelOfDepth(CFG3, 0)) === 1 && Math.round(levelOfDepth(CFG3, 1)) === L.core && Math.round(levelOfDepth(CFG3, 2)) === L.edge, 'уровни места не 1 / core / edge');
const mk = () => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.map.places = []; c.bosses.list = []; c.events.on = false; c.wanderer.on = false; const W = createWorld(c, mulberry32(5)); W.player.hp = W.player.maxhp = 1e6; return W; };
// враги: в ядре — как прежде, за ядром — крепче на grow за уровень
{ const W = mk(), E = CFG3.enemies, at = d => pointAtDepth(W.cfg, d, .3), a = at(.5), b = at(1.5);
  const e1 = spawnEnemy(W, 'brute', a.x, a.z), e2 = spawnEnemy(W, 'brute', b.x, b.z);
  const l2 = levelAt(W, b.x, b.z);     // этап 1: за ядром — уровень зоны
  ok(e1.lvl === Math.round(levelOfDepth(CFG3, .5)) && e2.lvl === Math.round(l2) && l2 > 30, `уровень врага: ${e1.lvl}, ${e2.lvl}`);
  ok(Math.abs(e1.maxhp - Math.round(E.brute.hp * (1 + E.depthHp * .5) * W.dif.hp)) <= 1, 'в ядре здоровье врага изменилось');
  ok(Math.abs(e2.maxhp - Math.round(E.brute.hp * (1 + E.depthHp) * (1 + (l2 - L.core) * L.grow) * W.dif.hp)) <= 1, 'за ядром здоровье не растёт по уровню'); }
// опыт и потолок
{ const W = mk(); for (let i = 0; i < 3000 && W.lv < 60; i++) gainXp(W, 1e5); ok(W.lv === 60 && W.xp === 0, 'потолок не 60-й уровень'); }
// уровень вещи
{ const sw = BY_ID.w_sword_black, ir = BY_ID.w_sword_iron;
  ok(ilMul(sw, nomIl(sw)) === 1 && ilMul(sw, 0) === 1 && ilMul(sw, 50) > 1.3 && ilMul(sw, 5) < 1, 'множитель уровня вещи');
  ok(scoreUp(sw, 0, .1, 40) > scoreUp(ir, 0, .1, 40), 'на одном уровне чёрный меч не сильнее железного');
  const inv = createInv(); inv.bag.push({ id: sw.id, n: 1, il: 45 }); equipAt(inv, 0); ok(inv.il.weapon === 45, 'уровень не перешёл в надетое');
  const g45 = gearStats(inv).dmg; delete inv.il.weapon; const g0 = gearStats(inv).dmg; inv.il.weapon = 45; ok(g45 > g0 && g0 === sw.stats.dmg, `урон от уровня вещи: ${g0} → ${g45}`);
  const back = deserialize(JSON.parse(JSON.stringify(serialize(inv))), 40, 'thorn', CFG3); ok(back.il.weapon === 45, 'сохранение потеряло уровень надетой вещи');
  unequip(inv, 'weapon', 40); ok(inv.bag[0].il === 45, 'снятая вещь потеряла уровень');
  const b2 = deserialize(JSON.parse(JSON.stringify(serialize(inv))), 40, 'thorn', CFG3); ok(b2.bag[0].il === 45, 'сохранение потеряло уровень вещи в сумке'); }
// добыча за ядром — уровня места; у торговца — уровня героя
{ const W = mk(), b = pointAtDepth(W.cfg, 1.5, .7); W.player.x = b.x; W.player.z = b.z; let got = null;
  for (let k = 0; k < 400 && !got; k++) { const e = spawnEnemy(W, 'archer', b.x + 3, b.z); killEnemy(W, e); got = W.drops.find(q => BY_ID[q.id].slot); }
  const lb = Math.round(levelAt(W, b.x + 3, b.z)); ok(got && got.il >= lb && got.il <= lb + L.il.drop, 'снаряжение с врага не уровня места: ' + (got && got.il) + ' при ' + lb);
  const W2 = mk(); W2.lv = 33; W2.nearMerchant = true; W2.inv.ash = 1e6; const i = W2.shop.stock.findIndex(s => BY_ID[s.id].slot && BY_ID[s.id].stats);
  ok(i >= 0 && buyItem(W2, i) === 'ok' && W2.inv.bag.some(s => BY_ID[s.id].slot && s.il === Math.max(33, nomIl(BY_ID[s.id]))), 'у торговца вещь не уровня героя'); }

if (fails.length) { console.error('Уровни до 60: ПРОВАЛ\n- ' + fails.join('\n- ')); process.exit(1); }
console.log('Уровни до 60 3D: OK');
