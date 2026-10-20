// Тест древа умений (2026-10-20): у каждого героя 96 узлов — три ветки по 32: 10 активных (ветка начинается с них), 22 пассивных;
// все 30 умений, мастерства прежних 8, все таланты; места в сетке не пересекаются; мастерство ниже своего умения; правила: ряд за очки в ветке, уровень, очки, умение 3-го ранга;
// значки есть у всех узлов; старое сохранение — сброс умений и талантов с возвратом очков; новое — без сброса.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, mulberry32, refreshGear } from '../3d/src/sim.js';
import { HEROES } from '../3d/src/data/heroes3d.js';
import { ABILITIES } from '../3d/src/data/abilities3d.js';
import { branchesOf } from '../3d/src/data/skills3d.js';
import { abilityPoints } from '../3d/src/abilities3d.js';
import { treeOf, nodeCount, canBuy, buy, rankOf, ROWS, COLS, ROW_STEP } from '../3d/src/tree3d.js';
import { GI } from '../3d/src/data/gicons.js';
import { createSaver, loadSave } from '../3d/src/save3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
for (const h of Object.keys(HEROES)) {
  const T = treeOf(h), nodes = T.flatMap(b => b.nodes), keys = new Set(nodes.map(n => n.key));
  ok(T.length === 3 && nodeCount(h) === 96 && keys.size === 96, `${h}: веток ${T.length}, узлов ${nodeCount(h)}`);
  for (const a of ABILITIES[h]) ok(keys.has('a:' + a.id) && (a.kind || keys.has('m:' + a.id)), `${h}: нет умения или мастерства ${a.id}`);
  for (const b of branchesOf(h)) for (const s of b.skills) ok(keys.has('t:' + s.id), `${h}: нет таланта ${s.id}`);
  for (const b of T) { const at = new Set(); for (const n of b.nodes) { const p = n.row + ':' + n.col; ok(!at.has(p) && n.row >= 1 && n.row <= ROWS && n.col >= 0 && n.col < COLS, `${h}/${b.name}: место ${p} занято или вне сетки`); at.add(p);
    if (n.req) { const q = b.nodes.find(x => x.key === n.req); ok(q && q.row < n.row, `${h}: мастерство ${n.id} не ниже своего умения`); }
    ok(GI[n.icon], `${h}: нет значка ${n.icon}`); }
    ok(b.nodes.length === 32 && b.nodes.filter(n => n.kind === 'active').length === 10, `${h}/${b.name}: не 32 узла с 10 активными`);
    ok(b.nodes.filter(n => n.row === 1).sort((u, v) => u.col - v.col)[0].kind === 'active', `${h}/${b.name}: ветка начинается не с активного`); }
}
// правила покупки
const mk = lv => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; const W = createWorld(c, mulberry32(2)); W.hero = 'thorn'; W.lv = lv; W.ap = abilityPoints(lv, c); W.sp = lv - 1; W.ab = {}; W.skills = {}; refreshGear(W); return W; };
{
  const W = mk(3); ok(canBuy(W, 'a:charge') === 'ok', 'первое умение — сразу, без очков в ветке: ' + canBuy(W, 'a:charge'));     // 3.85: на старте нет очков талантов
  ok(canBuy(W, 'a:bash') === 'row', 'умение третьего ряда без очков в ветке: ' + canBuy(W, 'a:bash'));
  ok(buy(W, 't:th_hand', refreshGear) === 'ok' && buy(W, 't:th_hand', refreshGear) === 'ok' && W.sp === 0, 'талант первого ряда');
  ok(buy(W, 'a:charge', refreshGear) === 'ok' && W.ab.charge === 1 && W.ap === 0, 'рывок');
  ok(canBuy(W, 'a:charge') === 'points' || canBuy(W, 'a:charge') === 'level', 'второй ранг без очков');
  const W2 = mk(60); for (let i = 0; i < 9; i++) buy(W2, 't:th_hand', refreshGear), buy(W2, 't:th_roar', refreshGear), buy(W2, 't:th_slayer_s0', refreshGear), buy(W2, 't:nose', refreshGear);     // мастерство — в 8-м ряду: нужно 12 очков в ветке
  ok(canBuy(W2, 'm:charge') === 'req', 'мастерство без умения 3-го ранга');
  for (let i = 0; i < 3; i++) buy(W2, 'a:charge', refreshGear); ok(rankOf(W2, treeOf('thorn')[1].nodes.find(n => n.key === 'a:charge')) === 3, 'рывок до 3-го ранга');
  ok(buy(W2, 'm:charge', refreshGear) === 'ok' && W2.ab.charge === 4, 'мастерство рывка');
  const W3 = mk(10); for (let i = 0; i < 9; i++) buy(W3, 't:th_hand', refreshGear); buy(W3, 't:th_roar', refreshGear); buy(W3, 't:nose', refreshGear); for (let i = 0; i < 3; i++) buy(W3, 'a:charge', refreshGear);
  ok((W3.ab.charge || 0) < 3, 'третий ранг рывка раньше своего уровня');
  ok(ROW_STEP === 2, 'шаг ряда');
}
// сохранения: старое — сброс с возвратом, новое — без сброса
{
  const mem = () => { const o = {}; return { getItem: k => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); }, removeItem: k => { delete o[k]; }, o }; };
  const W = mk(20); buy(W, 't:th_hand', refreshGear); buy(W, 't:th_hand', refreshGear); buy(W, 'a:charge', refreshGear);
  const st = mem(); createSaver(W, st).write(true); const key = Object.keys(st.o).find(k => /"prog"/.test(st.o[k]));
  const now = loadSave(40, st); ok(now && now.prog.ab.charge === 1 && now.prog.skills.th_hand === 2 && !now.prog.treeReset, 'новое сохранение сбросилось');
  const old = JSON.parse(st.o[key]); delete old.tree; st.o[key] = JSON.stringify(old);
  const was = loadSave(40, st); ok(was && !Object.keys(was.prog.ab).length && !Object.keys(was.prog.skills).length && was.prog.sp === 19 && was.prog.ap === abilityPoints(20, CFG3) && was.prog.treeReset, 'старое сохранение: сброс с возвратом ' + JSON.stringify(was && { ab: was.prog.ab, sp: was.prog.sp, ap: was.prog.ap }));
}
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.slice(0, 30).join('\n')); process.exit(1); }
console.log('Древо умений 3D: OK (5 героев × 96 узлов)');
