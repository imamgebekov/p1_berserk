// Жизнь мира (этап 6): точки сбора по миру и по биомам, сбор и рост заново, ремёсла (навык, предел, цвет рецепта, где можно),
// конь (быстрее, спешивание от удара, урона, подземелья), повозки между лагерем и узлами (цена, открытие), слава у четырёх сторон
// (за что растёт, ступени, скидка, награды), сохранение.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnEnemy, killEnemy } from '../3d/src/sim.js';
import { travel } from '../3d/src/levels3d.js';
import { nodeNear, gather, profCap, recipeColor, tradeUp, mountToggle, coachNear, discoverCoaches, fly, flightCost, addRep, tierOf, repOf, repEvents, rewardStatus, takeReward, serializeLife, sanitizeLife, priceRep } from '../3d/src/life3d.js';
import { craft, craftStatus } from '../3d/src/craft3d.js';
import { priceMulOf } from '../3d/src/economy3d.js';
import { RECIPE_BY_ID } from '../3d/src/data/recipes3d.js';
import { zoneAt } from '../3d/src/zones3d.js';
import { biomeAt } from '../3d/src/worldgen3d.js';
import { countOf } from '../3d/src/inv.js';
import { waterDist } from '../3d/src/terrain3d.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const mk = (seed = 1, f) => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.events.on = false; c.wanderer.on = false; c.bosses.list = []; if (f) f(c); const W = createWorld(c, mulberry32(seed)); W.player.inv = 1e9; return W; };
const run = (W, sec, inp = {}) => { for (let i = 0; i < Math.round(sec * 60); i++) step(W, 1 / 60, inp); };
const L = CFG3.life;

// ---------- 1. точки сбора ----------
{ const W = mk(), N = W.map.nodes, C = W.map.camp;
  { const want = CFG3.world.center ? L.gather.core + L.gather.nOuter : L.gather.n + (CFG3.world.inner ? L.gather.nOuter || 0 : 0); ok(N.length >= want * .97 && N.length <= want, 'точек сбора не ' + want + ': ' + N.length); }     // Мир 5.0: ядро — своя квота, остальное — по кругу мира
  ok(N.filter(n => Math.hypot(n.x, n.z) < CFG3.worldgen.coreR).length >= L.gather.core * .9, 'в ядре мало точек');     // 2026-10-23: проверка раньше стояла за комментарием посреди строки и не работала
  ok(N.every(n => Math.hypot(n.x - C.x, n.z - C.z) > C.r + 3), 'точка в лагере'); ok(N.every(n => !W.map.solids.some(s => Math.hypot(s.x - n.x, s.z - n.z) < s.r + 1)), 'точка в препятствии');
  ok(!W.map.river || N.every(n => waterDist(W.map.river, n.x, n.z) > 2), 'точка в воде');
  const mtn = N.filter(n => biomeAt(CFG3, n.x, n.z) === 'mountains'); ok(mtn.length > 5 && mtn.filter(n => n.kind === 'ore').length / mtn.length > .6, 'в горах не руда');
  const sw = N.filter(n => biomeAt(CFG3, n.x, n.z) === 'swamp'); ok(sw.length > 5 && !sw.some(n => n.kind === 'ore'), 'в болоте руда');
  ok(N.every(n => n.tier === 0) === false && N.filter(n => Math.hypot(n.x, n.z) < 80).every(n => n.tier === 0), 'ступень точки не по уровню места'); }
// ---------- 2. сбор ----------
{ const W = mk(2), n = W.map.nodes.find(q => q.kind === 'ore' && q.tier === 0) || W.map.nodes[0]; W.player.x = n.x + 1; W.player.z = n.z; step(W, 1 / 60, {});
  ok(nodeNear(W) && nodeNear(W).id === n.id, 'точка рядом не найдена'); const ore0 = countOf(W.inv, 'm_ore');
  ok(gather(W) === 'ok' && countOf(W.inv, 'm_ore') >= ore0 + 2, 'сбор руды не дал руды'); ok(!nodeNear(W) && gather(W, n.id) === 'none', 'собранная точка снова доступна');
  W.t += L.gather.respawn + 1; ok(nodeNear(W) && nodeNear(W).id === n.id, 'точка не выросла заново');
  const e = spawnEnemy(W, 'brute', W.player.x + 3, W.player.z); e.alert = true; ok(gather(W) === 'danger', 'собирать рядом с врагом можно'); e.dead = true;
  W.inv.bag = Array.from({ length: CFG3.bag.slots }, () => ({ id: 'w_sword_rust', n: 1 })); ok(gather(W) === 'full' && nodeNear(W), 'полная сумка: точка истрачена зря'); }
// ---------- 3. ремёсла ----------
{ const W = mk(3); W.lv = 1; ok(profCap(W) === L.trades.base + L.trades.perLv, 'предел ремесла по уровню'); W.lv = 60; ok(profCap(W) === L.trades.max, 'предел не упирается в max');
  const steel = RECIPE_BY_ID.steel, heal1 = RECIPE_BY_ID.alch_heal1, heal2 = RECIPE_BY_ID.alch_heal2;
  ok(recipeColor(W, steel) === 'red', 'рецепт выше навыка не красный'); W.known.tomes.smelting = 1; ok(craftStatus(W, steel) === 'skill', 'кузнечный рецепт выше навыка доступен');
  W.inv.bag = [{ id: 'm_grave_moss', n: 40 }, { id: 'm_ash_salt', n: 5 }]; W.inv.ash = 1000; W.player.x = 60; W.player.z = 60; step(W, 1 / 60, {});
  ok(craftStatus(W, heal1) === 'ok', 'алхимия вдали от кузнеца недоступна'); const e = spawnEnemy(W, 'brute', 64, 60); e.alert = true; ok(craftStatus(W, heal1) === 'danger', 'алхимия рядом с врагом доступна'); e.dead = true; step(W, 1 / 60, {});
  let n = 0; while (W.life.prof.alch < 10 && n < 40 && craft(W, 'alch_heal1') === 'ok') n++;
  ok(W.life.prof.alch === 10 && n === 10, 'оранжевый рецепт растит навык не наверняка: ' + n + ' → ' + W.life.prof.alch);
  W.life.prof.alch = 35; ok(recipeColor(W, heal1) === 'grey' && tradeUp(W, heal1) === 0, 'серый рецепт растит навык'); ok(recipeColor(W, heal2) === 'orange', 'цвет рецепта');
  W.lv = 1; W.life.prof.alch = profCap(W); ok(tradeUp(W, heal1) === 0 && tradeUp(W, RECIPE_BY_ID.alch_skin) === 0, 'навык выше предела');
  W.lv = 30; W.life.prof.smith = 0; ok(craftStatus(W, RECIPE_BY_ID.ingot) === 'far', 'ковка не у кузнеца');
  // сколько слитков, чтобы кузнечное дошло до 25 (ступень стали + 15)
  const W2 = mk(4); W2.lv = 30; const b = W2.map.buildings.find(q => q.npc && q.npc.kind === 'smith'); W2.player.x = b.npc.x + 1; W2.player.z = b.npc.z; step(W2, 1 / 60, {}); W2.inv.bag = [{ id: 'm_ore', n: 999 }, { id: 'm_coal', n: 999 }]; W2.inv.ash = 1e6;
  let k = 0; while (W2.life.prof.smith < 25 && k < 200) { if (craft(W2, 'ingot') !== 'ok') break; W2.inv.bag = W2.inv.bag.filter(s => s.id !== 'm_ingot'); k++; }
  ok(W2.life.prof.smith === 25 && k >= 25 && k <= 60, `кузнечное 0→25 за ${k} слитков (ждём 25–60)`); }
// ---------- 4. конь ----------
{ const W = mk(5); W.player.x = 50; W.player.z = 50; ok(mountToggle(W) === 'none', 'без коня сели'); W.life.mount.owned = true;
  const go = on => { const W2 = mk(5); W2.player.x = 50; W2.player.z = 50; W2.life.mount.owned = true; if (on) mountToggle(W2); const x0 = W2.player.x; run(W2, 2, { mx: 1, mz: 0 }); return W2.player.x - x0; };
  const d0 = go(false), d1 = go(true); ok(d1 > d0 * 1.4, `верхом не быстрее: ${d0.toFixed(1)} → ${d1.toFixed(1)}`);
  ok(mountToggle(W) === 'on' && W.life.mount.on, 'не сели'); run(W, .1, { attackPress: true }); ok(!W.life.mount.on, 'удар не спешил');
  mountToggle(W); W.player.inv = 0; const e = spawnEnemy(W, 'imp', W.player.x + 30, W.player.z); e.alert = false; W.life.mount.on = true; e.x = W.player.x + 1; e.state = 'wind'; e.t = CFG3.enemies.imp.wind - .01; e.alert = true; run(W, .2); ok(!W.life.mount.on, 'урон не спешил'); e.dead = true;
  W.player.inv = 1e9; const e2 = spawnEnemy(W, 'brute', W.player.x + 5, W.player.z); e2.alert = true; ok(mountToggle(W) === 'danger', 'сели рядом с врагом'); e2.dead = true;
  const d = CFG3.dungeons.list[0]; travel(W, d.id, d.entry.x, d.entry.z); ok(mountToggle(W) === 'place', 'верхом в подземелье'); }
// ---------- 5. повозки ----------
{ const W = mk(6), Cs = W.map.coaches, camp = Cs.find(c => c.id === 'camp'), hubs = CFG3.map.places.filter(p => p.hub);
  ok(camp && Math.hypot(camp.x - W.map.camp.x, camp.z - W.map.camp.z) < W.map.camp.r - 2, 'нет повозки в лагере'); ok(hubs.length >= 5 && hubs.every(h => Cs.some(c => c.id === h.id)), 'не у всех узлов есть повозка');
  const far = Cs.find(c => c.id !== 'camp'); W.player.x = camp.x + 1; W.player.z = camp.z; step(W, 1 / 60, {}); W.inv.ash = 5;
  ok(coachNear(W) && coachNear(W).id === 'camp', 'повозка рядом не найдена'); ok(fly(W, far.id) === 'unknown', 'полетели в неоткрытый узел');
  W.life.coaches[far.id] = 1; ok(fly(W, far.id) === 'ash', 'полетели без пепла'); const cost = flightCost(W, camp, far); W.inv.ash = cost + 3;
  ok(fly(W, far.id) === 'ok' && W.inv.ash === 3 && Math.hypot(W.player.x - far.x, W.player.z - far.z) < 3, 'перелёт не перенёс или взял не ту цену');
  const W2 = mk(7), h = W2.map.coaches.find(c => c.id !== 'camp'); W2.player.x = h.x + 5; W2.player.z = h.z; discoverCoaches(W2); ok(W2.life.coaches[h.id], 'повозка не открылась вблизи'); }
// ---------- 6. слава ----------
{ const W = mk(8), R = L.rep;
  W.ev.push({ k: 'questdone', giver: 'captain' }, { k: 'storyDone' }); repEvents(W, 0); ok(repOf(W, 'zastava') === R.quest && repOf(W, 'band') === R.scene, 'слава за задание и сцену');
  W.ev.length = 0; const e = spawnEnemy(W, 'imp', 10, -40); killEnemy(W, e, 1); repEvents(W, 0); ok(repOf(W, 'zastava') === R.quest + R.kill, 'слава за убийство в ядре');
  const ring = W.map.nodes.find(n => zoneAt(CFG3, n.x, n.z).ring === 0); W.ev.length = 0; const e2 = spawnEnemy(W, 'imp', ring.x, ring.z); killEnemy(W, e2, 1); repEvents(W, 0); ok(repOf(W, 'olkh') === R.kill, 'слава за убийство за ядром');
  W.ev.length = 0; addRep(W, 'brod', R.tiers[1][0]); ok(tierOf(W, 'brod') === 1 && W.ev.some(v => v.k === 'repTier'), 'ступень не сменилась'); addRep(W, 'brod', R.tiers[2][0]); ok(Math.abs(priceRep(W) - (1 - 2 * R.brodDiscount)) < 1e-9 && Math.abs(priceMulOf(W) - priceRep(W)) < 1e-9, 'скидка Брода');
  const im = R.rewards.findIndex(r => r.mount); ok(rewardStatus(W, im) === 'tier', 'конь без славы'); addRep(W, 'zastava', 1000); ok(rewardStatus(W, im) === 'far', 'награда не у торговца');
  const b = W.map.buildings.find(q => q.npc && q.npc.kind === 'captain'); W.player.x = b.npc.x + 1; W.player.z = b.npc.z; step(W, 1 / 60, {}); W.inv.ash = 0; ok(rewardStatus(W, im) === 'ash', 'награда без пепла');
  W.inv.ash = 1e4; ok(takeReward(W, im) === 'ok' && W.life.mount.owned && rewardStatus(W, im) === 'have', 'конь за славу не выдан');
  const it = R.rewards.findIndex(r => r.item === 'tome_medic'); W.known.tomes.medic = 1; ok(rewardStatus(W, it) === 'have', 'известная книга — снова в наградах');
  // подземелье: босс → своей стороне
  const W2 = mk(9); travel(W2, 'inst_olkh', 0, 0); W2.ev.push({ k: 'bossdead', x: 0, z: 0 }); repEvents(W2, W2.ev.length - 1); ok(repOf(W2, 'olkh') === R.dungeon, 'слава за босса подземелья'); }
// ---------- 7. сохранение ----------
{ const W = mk(10); W.life.prof.smith = 42; W.life.rep.band = 900; W.life.mount.owned = true; W.life.coaches.v1 = 1;
  const back = sanitizeLife(JSON.parse(JSON.stringify(serializeLife(W))), CFG3); ok(back.prof.smith === 42 && back.rep.band === 900 && back.mount.owned && back.coaches.v1 && back.coaches.camp, 'жизнь мира не сохранилась');
  const bad = sanitizeLife({ prof: { smith: 1e9, alch: -5, leather: 'x' }, rep: { brod: NaN, nope: 5 }, mount: 'yes', coaches: [5, 'camp'] }, CFG3);
  ok(bad.prof.smith === L.trades.max && bad.prof.alch === 0 && bad.prof.leather === 0 && !bad.rep.brod && !bad.rep.nope && !bad.mount.owned, 'мусор в сохранении жизни мира'); }

if (fails.length) { console.log('ПРОВАЛ:\n' + [...new Set(fails)].join('\n')); process.exit(1); }
console.log(`Жизнь мира 3D: OK (точек сбора ${L.gather.n}, повозок ${createWorld(JSON.parse(JSON.stringify(CFG3)), mulberry32(1)).map.coaches.length})`);
