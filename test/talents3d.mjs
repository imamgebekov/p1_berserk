// Таланты (этап 2, 2026-10-19): у каждого героя 3 специализации по 6 талантов + общая ветка «Скиталец»; талант открывается по очкам
// в ветке; чужие таланты недоступны; таланты дают характеристики, усиливают умения (сила, перезарядка, цена), дают особые эффекты
// и ресурс; старое сохранение с прежними навыками возвращает очки.
import { CFG3 } from '../3d/src/config3d.js';
import { TREES, branchesOf, SKILLS, TIER_STEP, canRank, talentMods, withTalents, sanitizeSkills } from '../3d/src/data/skills3d.js';
import { HEROES } from '../3d/src/data/heroes3d.js';
import { ABILITIES } from '../3d/src/data/abilities3d.js';
import { createWorld, mulberry32, refreshGear, spawnEnemy, step } from '../3d/src/sim.js';
import { spendSkill } from '../3d/src/progress3d.js';
import { useAbility, upgradeAbility, abilityPoints } from '../3d/src/abilities3d.js';
import { resOf } from '../3d/src/resource3d.js';
import { createSaver, loadSave } from '../3d/src/save3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
for (const h of Object.keys(HEROES)) {
  const bs = TREES[h]; ok(bs && bs.length === 3 && bs.every(b => b.skills.filter(s => !s.boost && !s.gen && !s.high).length === 6 && b.skills.length >= 17 && b.name && b.role), `${h}: не 3 специализации по 6 своих талантов (+ усилители и характеристики древа)`);
  ok(branchesOf(h).length === 4 && branchesOf(h)[3].common, `${h}: нет общей ветки`);
  for (const b of bs) for (const s of b.skills) { if (!s.ab) continue; const d = ABILITIES[h].find(a => a.id === s.ab.id), A = CFG3.abilities[h][s.ab.id] || (d && d.kind && { ...CFG3.abilities.gen[d.kind], ...d.p, sd: 1, dps: 1 });     // новое умение древа: числа вида
    ok(A && ABILITIES[h].some(a => a.id === s.ab.id) && Object.keys(s.ab.k).every(k => k in A), `${s.id}: умение ${s.ab.id} или его ключи не найдены`); }
}
ok(Object.keys(SKILLS).length === Object.keys(HEROES).length * (18 + 28 + 12 + 12) + 6, 'талантов не ' + (Object.keys(HEROES).length * 70 + 6));     // 18 своих, 28 усилителей новых умений, 12 характеристик, 12 рядов 9–10 (4.06)
ok(canRank({}, 'ir_heat', 5, 'thorn') === 'none' && canRank({}, 'th_hand', 5, 'thorn') === 'ok' && canRank({}, 'th_roar', 5, 'thorn') === 'locked' && canRank({ th_hand: TIER_STEP }, 'th_roar', 5, 'thorn') === 'ok', 'доступ к талантам по герою и ярусу');
ok(canRank({}, 'pockets', 5, 'irga') === 'locked' && canRank({ step: 3 }, 'pockets', 5, 'irga') === 'ok', 'общая ветка у Ирги');
// в бою
const mk = hero => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.map.places = []; c.bosses.list = []; c.events.on = false; c.wanderer.on = false; c.ambient.on = false;
  const W = createWorld(c, mulberry32(9)); W.hero = hero; W.lv = 40; W.sp = 39; W.ap = abilityPoints(40, c); W.inv.eq.weapon = hero === 'thorn' ? 'w_sword_iron' : 'w_staff_iron'; refreshGear(W); Object.assign(W.player, { x: 40, z: 40, face: 0 }); return W; };
{ const W = mk('thorn'), hp0 = W.player.maxhp; for (let i = 0; i < 5; i++) spendSkill(W, 'th_temper'); refreshGear(W); ok(W.player.maxhp === hp0 + 60 && W.sp === 34, 'Закалка не дала здоровья или не списала очки');
  for (let i = 0; i < 5; i++) spendSkill(W, 'th_skin'); spendSkill(W, 'th_stand'); ok(!W.skills.th_stand, 'последний ярус открылся раньше 15 очков');
  for (let i = 0; i < 5; i++) spendSkill(W, 'th_iron'); for (let i = 0; i < 3; i++) spendSkill(W, 'th_thorns'); spendSkill(W, 'th_stand'); refreshGear(W);
  ok(W.skills.th_stand === 1 && W.setFx.lastStand === .2 && Math.abs(W.setFx.thorns - .3) < 1e-9, 'особые эффекты талантов не дошли: ' + JSON.stringify(W.setFx));
  const A = CFG3.abilities.thorn.iron, T = withTalents(A, W.talAb.iron); ok(Math.abs(T.cd[0] - A.cd[0] * (1 - .32)) < 1e-9 && T.t[0] > A.t[0], 'Несгибаемый не усилил Несокрушимость');
  upgradeAbility(W, 'iron'); resOf(W); useAbility(W, -1); W.resHero = W.hero; W.res = 999; const i = ABILITIES.thorn.findIndex(a => a.id === 'iron'); ok(useAbility(W, i) === 'ok' && Math.abs(W.acd.iron - T.cd[0]) < 1e-9, 'перезарядка умения без таланта: ' + W.acd.iron); }
{ const W = mk('irga'), r0 = resOf(W).regen; for (let i = 0; i < 5; i++) spendSkill(W, 'ir_heat'); for (let i = 0; i < 4; i++) spendSkill(W, 'ir_ball'); for (let i = 0; i < 3; i++) spendSkill(W, 'ir_meteor'); for (let i = 0; i < 3; i++) spendSkill(W, 'ir_ignite'); for (let i = 0; i < 3; i++) spendSkill(W, 'ir_flow');
  refreshGear(W); ok(resOf(W).regen === r0 + 3 && W.setFx.ignite > .4, 'Поток силы или Искра не сработали'); }
// сохранение: прежние навыки (их больше нет) → очки возвращаются; чужие таланты отбрасываются
{ const st = new Map(), S = { getItem: k => st.get(k) ?? null, setItem: (k, v) => st.set(k, v), removeItem: k => st.delete(k) }, W = mk('thorn');
  W.lv = 12; W.skills = { hand: 3, temper: 2, th_hand: 2, ir_heat: 1 }; W.sp = 3; createSaver(W, S).write(true);
  const sv = loadSave(40, S); ok(sv && sv.prog.skills.th_hand === 2 && !sv.prog.skills.hand && !sv.prog.skills.ir_heat && sv.prog.sp === 9, 'перенос навыков: ' + JSON.stringify(sv && sv.prog)); }
ok(JSON.stringify(sanitizeSkills({ th_hand: 9, vl_hand: 1 }, 'thorn')) === '{"th_hand":5}', 'очистка талантов по герою');

if (fails.length) { console.error('Таланты 3D: ПРОВАЛ\n- ' + fails.join('\n- ')); process.exit(1); }
console.log('Таланты 3D: OK (' + Object.keys(TREES).map(h => TREES[h].map(b => b.name).join('/')).join(', ') + ')');
