// Школы героя (2026-10-22, решение владельца): ветка древа — школа, активна одна. Вкладывать — только в свою школу; смена —
// у костра (пока в школу ничего не вложено — где угодно); очки каждой школы свои и даются по уровню полностью; ранги
// и панель школы сохраняются; роль в группе — по школе; старое сохранение делится по веткам, ничего не пропадает.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, mulberry32, refreshGear, switchHero } from '../3d/src/sim.js';
import { canBuy, buy } from '../3d/src/tree3d.js';
import { abilityPoints } from '../3d/src/abilities3d.js';
import { switchSchool, canSwitchSchool, schoolOfAbility } from '../3d/src/school3d.js';
import { heroRole } from '../3d/src/party3d.js';
import { createSaver, loadSave } from '../3d/src/save3d.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const mk = (hero = 'thorn', lv = 20) => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; const W = createWorld(c, mulberry32(7)); W.hero = hero; W.lv = lv; W.ap = abilityPoints(lv, c); W.sp = lv - 1; W.ab = {}; W.skills = {}; W.bar = []; refreshGear(W); return W; };
const mem = () => { const o = {}; return { getItem: k => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); }, removeItem: k => { delete o[k]; }, o }; };

// новый герой — школа 0; чужая школа закрыта; пустую школу можно сменить где угодно
{ const W = mk(); ok((W.school || 0) === 0, 'новый герой не в первой школе');
  ok(canBuy(W, 'a:cry') === 'ok' && canBuy(W, 'a:charge') === 'school', 'своя школа не открыта или чужая не закрыта: ' + canBuy(W, 'a:cry') + ' ' + canBuy(W, 'a:charge'));
  ok(switchSchool(W, 1, false) === 'ok' && W.school === 1, 'пустую школу не сменить вдали от костра');
  ok(canBuy(W, 'a:charge') === 'ok' && canBuy(W, 'a:cry') === 'school', 'после смены школы не та ветка открыта');
  ok(switchSchool(W, 1, true) === 'same' && canSwitchSchool(W, 5, true) === 'none', 'смена в ту же или в несуществующую школу'); }
// вложил очки — смена только у костра; очки и ранги каждой школы свои, очки — все очки уровня
{ const W = mk(); W.school = 1;
  ok(buy(W, 'a:charge', refreshGear) === 'ok' && buy(W, 't:th_hand', refreshGear) === 'ok', 'не вложить очки в свою школу');
  W.bar = ['charge', null, null, null, null, null];
  ok(switchSchool(W, 0, false) === 'fire' && W.school === 1, 'школу с очками сменили вдали от костра');
  ok(switchSchool(W, 0, true) === 'ok' && W.school === 0 && !W.ab.charge && !W.skills.th_hand && W.ap === abilityPoints(20, CFG3) && W.sp === 19 && !W.bar.some(Boolean), 'новая школа не с полными очками или с чужими рангами');
  ok(buy(W, 'a:cry', refreshGear) === 'ok' && W.ab.cry === 1, 'в новой школе не вложить');
  ok(switchSchool(W, 1, true) === 'ok' && W.ab.charge === 1 && W.skills.th_hand === 1 && !W.ab.cry && W.bar[0] === 'charge' && W.ap === abilityPoints(20, CFG3) - 1 && W.sp === 18, 'прежняя школа не вернулась целиком');
  ok(W.sch[0] && W.sch[0].ab.cry === 1, 'отложенная школа потеряла ранги'); }
// роль в группе — по школе
{ const W = mk('thorn'); ok(heroRole(W) === 'tank', 'Торн-Страж не защитник'); W.school = 1; ok(heroRole(W) === 'melee', 'Торн-Палач не боец');
  const P = mk('priest'); P.school = 2; ok(heroRole(P) === 'ranged', 'Жрец-Тень не стрелок'); P.school = 0; ok(heroRole(P) === 'heal', 'Жрец-Свет не лекарь');
  const H = mk('hunter'); H.school = 1; ok(heroRole(H) === 'tank', 'Бесогон-Месть не защитник'); }
// сохранение: школа и отложенные школы на месте
{ const W = mk(); W.school = 1; buy(W, 'a:charge', refreshGear); switchSchool(W, 0, true); buy(W, 'a:cry', refreshGear);
  const st = mem(); createSaver(W, st).write(true); const s = loadSave(40, st);
  ok(s && s.prog.school === 0 && s.prog.ab.cry === 1 && !s.prog.ab.charge && s.prog.sch[1] && s.prog.sch[1].ab.charge === 1, 'школы не сохранились: ' + JSON.stringify(s && { school: s.prog.school, ab: s.prog.ab, sch: s.prog.sch }));
  // старое сохранение (до школ): всё в одной куче — школа там, где больше очков, остальное — в свои школы
  const key = Object.keys(st.o).find(k => /"prog"/.test(st.o[k])), old = JSON.parse(st.o[key]);
  delete old.prog.school; delete old.prog.sch; old.prog.ab = { cry: 1, charge: 3, bash: 1 }; old.prog.skills = { th_hand: 2 }; old.prog.sp = 17; old.prog.bar = ['cry', 'charge', null, null, null, null]; st.o[key] = JSON.stringify(old);
  const m = loadSave(40, st);
  ok(m && m.prog.school === schoolOfAbility('thorn', 'charge', CFG3) && m.prog.ab.charge === 3 && m.prog.ab.bash === 1 && m.prog.skills.th_hand === 2 && !m.prog.ab.cry, 'старое сохранение: школа не та или ранги не те: ' + JSON.stringify(m && m.prog.ab));
  ok(m && m.prog.sch[0] && m.prog.sch[0].ab.cry === 1 && m.prog.bar[1] === 'charge' && !m.prog.bar[0], 'старое сохранение: чужая ветка пропала или панель не очищена');
  ok(m && m.prog.ap === abilityPoints(20, CFG3) - 4 && m.prog.sp === 17, 'старое сохранение: очки не пересчитаны: ' + (m && m.prog.ap + ' ' + m.prog.sp)); }
// смена героя: у каждого героя своя школа
{ const W = mk('thorn'); W.school = 2; W.sch = { 0: { ab: { cry: 1 }, skills: {}, bar: [] } };
  ok(switchHero(W, 'vale') && (W.school || 0) === 0 && !Object.keys(W.sch || {}).length, 'новый герой унаследовал школу');
  ok(switchHero(W, 'thorn') && W.school === 2 && W.sch[0] && W.sch[0].ab.cry === 1, 'школа героя не вернулась'); }

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Школы героя 3D: OK');
