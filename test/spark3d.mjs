// Тест «Первой искры» и первых минут 3D (шаг 12 аудита): цепочка торговец → враги за оградой → сбор (4.01) → костёр → очко навыка,
// убийства в лагере не считаются, награда один раз; строка цели не пустая и у шагов есть точка; после цепочки цель —
// ближайший неоткрытый костёр; ветерану цепочка не нужна; мусор в сохранении не ломает; Торн и Вейл не с кулаками;
// у лагеря в начале стайки «молодые» (здоровье ×0,5), с 3-го уровня — обычные.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32 } from '../3d/src/sim.js';
import { SPARK, sparkFresh, sparkEvent, sparkTick, goalOf, sanitizeSpark } from '../3d/src/spark3d.js';
import { HEROES } from '../3d/src/data/heroes3d.js';
import { BY_ID } from '../3d/src/data/items.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const mk = (seed = 1, tweak) => { const c = JSON.parse(JSON.stringify(CFG3)); c.events.on = false; c.wanderer.on = false; c.bosses.list = []; if (tweak) tweak(c); return createWorld(c, mulberry32(seed)); };

// ---------- цепочка ----------
{ const W = mk(); W.spark = sparkFresh(W); ok(!W.spark.done && W.spark.i === 0, 'новая игра без цепочки');
  let g = goalOf(W); ok(/торговцу/.test(g.text) && g.at && Number.isFinite(g.at.x), 'шаг 1 без текста или точки: ' + JSON.stringify(g));
  ok(sparkTick(W) === null, 'шаг засчитан без дела');
  W.nearNpc = 'merchant'; ok(sparkTick(W) === 'step' && W.spark.i === 1, 'торговец не засчитан'); W.nearNpc = null;
  g = goalOf(W); ok(/0\/3/.test(g.text) && g.at, 'шаг «враги» без счётчика или точки: ' + g.text);
  sparkEvent(W, { k: 'die', x: 0, z: 0 }); ok(W.spark.kills === 0, 'убийство в лагере засчитано');
  for (let i = 0; i < 3; i++) sparkEvent(W, { k: 'die', x: 200, z: 40 }); ok(sparkTick(W) === 'step' && W.spark.i === 2, 'три врага за оградой не засчитаны');
  g = goalOf(W); ok(/соберите/.test(g.text) && g.at && Number.isFinite(g.at.x), 'шаг «сбор» без текста или точки: ' + JSON.stringify(g));     // 4.01
  ok(sparkTick(W) === null, 'сбор засчитан без дела'); sparkEvent(W, { k: 'gather' }); ok(sparkTick(W) === 'step' && W.spark.i === 3, 'сбор не засчитан');
  W.player.x = 30; W.player.z = 30; ok(sparkTick(W) === null && /костру/.test(goalOf(W).text), 'костёр засчитан издалека');
  W.player.x = 1; W.player.z = 1; ok(sparkTick(W) === 'step' && W.spark.i === 4, 'костёр не засчитан');
  W.sp = 0; ok(/опыт/.test(goalOf(W).text), 'без очков — не про опыт'); W.sp = 1; ok(/навыки/.test(goalOf(W).text), 'с очком — не про навыки');
  const ash0 = W.inv.ash; W.skills = { might: 1 }; ok(sparkTick(W) === 'done' && W.spark.done && W.inv.ash === ash0 + CFG3.spark.ash, 'награда за цепочку');
  ok(sparkTick(W) === null && W.inv.ash === ash0 + CFG3.spark.ash, 'награда выдана дважды');
  g = goalOf(W); ok(/костёр/.test(g.text) && g.at, 'после цепочки цель не костёр: ' + g.text); }
// ---------- ветеран, мусор ----------
{ const W = mk(); W.lv = 5; ok(sparkFresh(W).done, 'ветерану показана цепочка');
  const s = sanitizeSpark({ i: 99, kills: -5, trader: 'да' }, W); ok(s.i === SPARK.length - 1 && s.kills === 0 && s.trader === true, 'мусор не почищен: ' + JSON.stringify(s));
  ok(!sanitizeSpark(null, mk()).done, 'пустое состояние — не новая цепочка'); }
// ---------- стартовое оружие ----------
for (const h of ['thorn', 'vale', 'jay']) { const H = HEROES[h], it = H.start && BY_ID[H.start]; ok(it && it.slot === 'weapon' && H.kinds.includes(it.kind), `${h}: стартового оружия нет или чужое`); }
// ---------- «молодые» стайки ----------
{ const F = CFG3.enemies.roam.firstPack, count = lv => { const W = mk(3); W.lv = lv; W.player.inv = 1e9; let young = 0, all = 0; const seen = new Set();
    for (let i = 0; i < 60 * 12; i++) { step(W, 1 / 60, {}); for (const e of W.enemies) if (!seen.has(e.id)) { seen.add(e.id); if (!e.pack) continue; all++; if (e.young) young++; } }
    return { young, all, ok: W.enemies.filter(e => e.young).every(e => Math.hypot(e.x, e.z) < F.r + 30) }; };
  const a = count(1), b = count(F.lv); ok(a.all > 0 && a.young === a.all && a.ok, 'в начале стайки у лагеря не молодые: ' + JSON.stringify(a));
  ok(b.young === 0 && b.all > 0, `с ${F.lv}-го уровня остались молодые: ` + JSON.stringify(b));
  const W1 = mk(5); W1.lv = 1; const W3 = mk(5); W3.lv = F.lv; let h1 = 0, h3 = 0;
  for (let i = 0; i < 60 * 12 && (!h1 || !h3); i++) { step(W1, 1 / 60, {}); step(W3, 1 / 60, {}); const e1 = W1.enemies.find(e => e.pack && e.type === 'imp'), e3 = W3.enemies.find(e => e.pack && e.type === 'imp'); if (e1 && !h1) h1 = e1.maxhp; if (e3 && !h3) h3 = e3.maxhp; }
  ok(h1 && h3 && Math.abs(h1 / h3 - F.hp) < .08, `здоровье молодого беса не ×${F.hp}: ${h1} против ${h3}`); }

if (fails.length) { console.log('spark3d FAIL\n' + [...new Set(fails)].join('\n')); process.exit(1); }
console.log('Первые минуты 3D: OK');
