// Уровни до 60 (этап 0, 2026-10-19): уровень места из глубины (ядро 1–20, край мира 60); враги за ядром крепче по уровню;
// опыт растёт; уровень вещи масштабирует урон, броню и здоровье (родной уровень — как в каталоге), ездит с вещью и сохраняется;
// снаряжение с врагов — уровня места, у торговца и кузнеца — уровня героя; потолок — 60-й уровень.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, mulberry32, spawnEnemy, killEnemy, step, refreshGear, buyItem } from '../3d/src/sim.js';
import { levelOfDepth, pointAtDepth, levelAt } from '../3d/src/levels3d.js';
import { gainXp, paceXp, greyMul, xpNeed, rankNeed } from '../3d/src/progress3d.js';
import { QUESTS } from '../3d/src/data/quests3d.js';
import { ACT1, ACT2, ACT3, ACT4 } from '../3d/src/data/story3d.js';
import { BY_ID } from '../3d/src/data/items.js';
import { createInv, equipAt, unequip, serialize, deserialize, gearStats, ilMul, nomIl, scoreUp } from '../3d/src/inv.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const L = CFG3.level;
ok(L.max === 70 && Math.round(levelOfDepth(CFG3, 0)) === 1 && Math.round(levelOfDepth(CFG3, 1)) === L.core && Math.round(levelOfDepth(CFG3, 2)) === L.edge, 'уровни места не 1 / core / edge');
const mk = () => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.map.places = []; c.bosses.list = []; c.events.on = false; c.wanderer.on = false; const W = createWorld(c, mulberry32(5)); W.player.hp = W.player.maxhp = 1e6; return W; };
// враги: в ядре — как прежде, за ядром — крепче на grow за уровень
{ const W = mk(), E = CFG3.enemies, at = d => pointAtDepth(W.cfg, d, .3), a = at(.5), b = at(1.5);
  const e1 = spawnEnemy(W, 'brute', a.x, a.z), e2 = spawnEnemy(W, 'brute', b.x, b.z);
  const l2 = levelAt(W, b.x, b.z);     // этап 1: за ядром — уровень зоны
  ok(e1.lvl === Math.round(levelOfDepth(CFG3, .5)) && e2.lvl === Math.round(l2) && l2 > 30, `уровень врага: ${e1.lvl}, ${e2.lvl}`);
  ok(Math.abs(e1.maxhp - Math.round(E.brute.hp * (1 + E.depthHp * .5) * W.dif.hp)) <= 1, 'в ядре здоровье врага изменилось');
  ok(Math.abs(e2.maxhp - Math.round(E.brute.hp * (1 + E.depthHp) * (1 + (l2 - L.core) * L.grow) * W.dif.hp)) <= 1, 'за ядром здоровье не растёт по уровню'); }
// опыт и потолок
{ const W = mk(); for (let i = 0; i < 4000 && W.lv < L.max; i++) gainXp(W, 1e5); ok(W.lv === L.max && W.xp === 0, `потолок не ${L.max}-й уровень`); }     // 4.06: предел 70
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

// темп (этап 3 «круче»): 60-й уровень — к концу Акта IV. Модель прохождения: сцены по порядку, разовые задания поровну между
// ними, 10/25/40 убийств врагов уровня сцены на сцену (по 3,5% нужного опыта, «серые» — меньше). Уровень к концу акта — в коридоре.
{ const A = [ACT1, ACT2, ACT3, ACT4].flat(), Q = QUESTS.filter(q => !q.repeat), L = CFG3.level;
  const play = (kills, cfg = CFG3) => { const W = { cfg, lv: 1, story: { i: 0 } }; let xp = 0, qi = 0; const ends = {};
    const gain = n => { if (W.lv >= L.max) return; xp += n; while (W.lv < L.max && xp >= xpNeed(W.lv, cfg)) { xp -= xpNeed(W.lv, cfg); W.lv++; } };
    A.forEach((c, i) => { W.story.i = i; while (qi < Math.round((i + 1) * Q.length / A.length)) gain(paceXp(W, (Q[qi++].reward || {}).xp || 0, 'quest'));
      for (let k = 0; k < kills; k++) gain(Math.round(.035 * xpNeed(c.lv, cfg) * greyMul(W, c.lv)));
      gain(paceXp(W, (c.reward || {}).xp || 0, 'scene')); ends[c.act] = W.lv; });
    return ends; };
  for (const k of [10, 25, 40]) { const e = play(k); console.log(`темп (${k} убийств на сцену): к концу актов уровни ${[1, 2, 3, 4].map(a => e[a]).join(' / ')}`);
    ok(e[1] >= 16 && e[1] <= 26 && e[2] >= 32 && e[2] <= 42 && e[3] >= 43 && e[3] <= 52 && e[4] >= 58 && e[4] <= 64, `темп при ${k} убийствах: ${JSON.stringify(e)}`); }     // 4.06: сюжет кончается около 60, 61–70 — пояса мира ×2
  const old = play(25, { ...CFG3, level: { ...L, pace: { ...L.pace, on: false } } }); ok(old[2] >= 60, 'выключено — темп не как раньше (60 к Акту II): ' + JSON.stringify(old));
  const W = { cfg: CFG3, lv: 40, story: { i: A.findIndex(c => c.lv >= 40) } }; ok(paceXp(W, 9000, 'quest') <= Math.round(L.pace.fq * xpNeed(40, CFG3)) && paceXp(W, 30, 'quest') === 30, 'потолок награды за задание не работает');
  const ahead = { ...W, lv: 40, story: { i: A.findIndex(c => c.lv >= 30) } }; ok(paceXp(ahead, 9000, 'quest') < paceXp(W, 9000, 'quest') * .5, 'обогнал сюжет — награда не меньше');
  ok(greyMul(W, 40) === 1 && greyMul(W, 39) === 1 && greyMul(W, 38) < 1 && greyMul(W, 10) === L.pace.min, '«серые» враги: ' + [40, 39, 38, 10].map(x => greyMul(W, x).toFixed(2))); }
// пепельные ранги (этап 3 «круче»): опыт на 60-м — в ранги до cap; ранг даёт урон и здоровье; ранг сохраняется
{ const W = createWorld(JSON.parse(JSON.stringify(CFG3)), mulberry32(3)), R = CFG3.level.ranks; W.lv = CFG3.level.max; refreshGear(W); const hp0 = W.player.maxhp, d0 = W.gear.dmg;
  gainXp(W, rankNeed(CFG3) * 2 + 5); ok(W.prank === 2 && W.ev.filter(v => v.k === 'prank').length === 2, 'нет пепельных рангов: ' + W.prank);
  ok(Math.abs(W.player.maxhp - hp0 * (1 + 2 * R.per)) < .01 && W.gear.dmg > d0, `ранги не дают силы: здоровье ${hp0}→${W.player.maxhp}, урон ${d0}→${W.gear.dmg}`);
  gainXp(W, rankNeed(CFG3) * (R.cap + 10)); ok(W.prank === R.cap, 'ранг выше предела: ' + W.prank);
  const { createSaver, loadSave } = await import('../3d/src/save3d.js'), st = { o: {}, getItem(k) { return this.o[k] ?? null; }, setItem(k, v) { this.o[k] = v; }, removeItem(k) { delete this.o[k]; } };
  createSaver(W, st).write(true); const back = loadSave(['thorn'], st); ok(back && back.prog.prank === R.cap, 'пепельный ранг не сохранился'); }
if (fails.length) { console.error('Уровни до 60: ПРОВАЛ\n- ' + fails.join('\n- ')); process.exit(1); }
console.log('Уровни до 60 3D: OK');
