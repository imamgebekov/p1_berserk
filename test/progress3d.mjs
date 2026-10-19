// Тест прокачки 3D: опыт, уровни, древо навыков (ограничения, эффекты, сброс), защита сохранения.
import { CFG3 } from '../3d/src/config3d.js';
import { BRANCHES, SKILLS, TIER_STEP, canRank, skillStats, spentIn, sanitizeSkills, MAX_RANKS } from '../3d/src/data/skills3d.js';
import { createWorld, step, mulberry32, spawnEnemy, gainXp, xpNeed, spendSkill, respec, respecCost, sellPrice, refreshGear } from '../3d/src/sim.js';
import { loadSave, createSaver } from '../3d/src/save3d.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const mk = (seed = 1) => { const cfg = JSON.parse(JSON.stringify(CFG3)); cfg.enemies.count = 0; return createWorld(cfg, mulberry32(seed)); };

// данные
ok(BRANCHES.length === 4 && BRANCHES.every(b => b.skills.length >= 6), 'у героя четыре ветки талантов (3 специализации и общая), в каждой не меньше шести');     // этап 2: таланты
for (const s of Object.values(SKILLS)) { ok(s.max >= 1 && s.text && s.name, 'талант ' + s.id); ok(s.stats || s.ab || s.fx || s.res, 'нет эффекта ' + s.id); }
// очков хватает на много, но не на всё
ok(MAX_RANKS > CFG3.level.max - 1, `рангов (${MAX_RANKS}) меньше очков уровней (${CFG3.level.max - 1}): нечего выбирать после макс. уровня — должно быть больше`);
ok(MAX_RANKS > (CFG3.level.max - 1), 'не все навыки можно взять');
// кривая опыта
{ let prev = 0; for (let lv = 1; lv < CFG3.level.max; lv++) { const n = xpNeed(lv, CFG3); ok(n > prev, 'кривая опыта не растёт на ' + lv); prev = n; } }
// уровень: опыт → очки → здоровье
{ const W = mk(); const need = xpNeed(1, W.cfg); gainXp(W, need - 1); ok(W.lv === 1 && W.sp === 0, 'уровень раньше времени'); gainXp(W, 1); ok(W.lv === 2 && W.sp === 1 && W.xp === 0, 'уровень не взят');
  refreshGear(W); ok(Math.abs(W.player.maxhp - (W.cfg.player.hp * W.cfg.heroes[W.hero].hp + W.cfg.level.hpPer)) < 1e-9, 'здоровье за уровень');     // множитель героя (Торн ×1,15)
  gainXp(W, xpNeed(2, W.cfg) + xpNeed(3, W.cfg) + 5); ok(W.lv === 4 && W.sp === 3 && W.xp === 5, `несколько уровней разом: ${W.lv}/${W.sp}/${W.xp}`);
  W.lv = W.cfg.level.max; W.xp = 0; W.sp = 0; gainXp(W, 1e6); ok(W.lv === W.cfg.level.max && W.sp === 0 && W.xp === 0, 'выше максимума'); }
// опыт за убийство растёт с глубиной
{ const xp = (x, z) => { const W = mk(2); const e = spawnEnemy(W, 'imp', x, z); e.hp = 1; W.player.x = x + 1; W.player.z = z; W.player.face = -Math.PI / 2; step(W, 1 / 60, {}); for (let i = 0; i < 40; i++) step(W, 1 / 60, { attack: true }); const lvlXp = W.xp; return W.kills ? lvlXp + (W.lv - 1) * 1000 : -1; };
  const near = xp(3, 3), far = xp(-60, 0); ok(near > 0 && far > near, `опыт у границы не больше: ${near} vs ${far}`); }
// ограничения древа
{ const sk = {}; ok(canRank(sk, 'th_hand', 1) === 'ok' && canRank(sk, 'th_hand', 0) === 'sp', 'первый навык'); ok(canRank(sk, 'th_roar', 5) === 'locked', 'второй ярус закрыт без очков');
  sk.th_hand = 3; ok(canRank(sk, 'th_roar', 5) === 'ok', 'второй ярус не открылся'); sk.th_hand = 5; ok(canRank(sk, 'th_hand', 5) === 'max', 'предел ранга'); ok(canRank(sk, 'нет', 5) === 'none', 'неизвестный навык');
  ok(canRank({ th_hand: 5, th_roar: 1 }, 'th_bloodrush', 9) === 'locked' && canRank({ th_hand: 5, th_roar: 4, th_bash: 2 }, 'th_bloodrush', 9) === 'locked', 'пятый ярус требует 4×шаг'); ok(canRank({ th_hand: 5, th_roar: 4, th_bash: 3 }, 'th_charge', 9) === 'ok', 'четвёртый ярус'); }
// вложение и эффекты
{ const W = mk(3); W.sp = 50; W.lv = 20;
  ok(spendSkill(W, 'th_roar') === 'locked' && W.sp === 50, 'вложено в закрытый навык');
  for (let i = 0; i < 5; i++) ok(spendSkill(W, 'th_hand') === 'ok', 'вложение hand'); ok(W.skills.th_hand === 5 && W.sp === 45, 'очки списаны');
  refreshGear(W); const d0 = (W.lv - 1) * W.cfg.level.dmgPer; ok(Math.abs(W.gear.dmg - (10 + d0)) < 1e-9, 'урон от навыка: ' + W.gear.dmg);
  for (const id of ['th_roar', 'th_roar', 'th_bash', 'th_bash', 'th_bash']) spendSkill(W, id);
  for (const id of ['th_charge', 'th_bloodrush']) { for (let i = 0; i < 3; i++) spendSkill(W, id); }
  refreshGear(W); ok(W.gear.crit >= 6 && W.talAb.bash && W.talAb.charge && W.talAb.blood, 'эффекты Палача: ' + JSON.stringify([W.gear.crit, W.talAb]));
}
{ const W = mk(5); W.lv = 30; W.skills = { th_skin: 5, th_temper: 5 }; refreshGear(W); ok(W.gear.armor === 15 && Math.abs(W.player.maxhp - (100 * CFG3.heroes[W.hero].hp + 60 + 29 * CFG3.level.hpPer)) < 1e-9, 'стойкость: ' + JSON.stringify([W.gear.armor, W.player.maxhp]));
  W.skills = { th_skin: 5, th_temper: 5, jy_breath: 4 }; W.player.hp = 50; W.player.calm = 99; refreshGear(W); const h = W.player.hp; for (let i = 0; i < 120; i++) step(W, 1 / 60, {}); ok(W.player.hp - h > 3.5, 'регенерация не работает: ' + (W.player.hp - h));
  W.skills = { th_skin: 5, th_temper: 5, jy_breath: 4, jy_tumble: 4 }; refreshGear(W); step(W, 1 / 60, { mx: 1, roll: true }); ok(Math.abs(W.player.rollCd - (W.cfg.player.rollCooldown - .32)) < .02, 'перекат не быстрее: ' + W.player.rollCd); }
{ const W = mk(6); W.skills = { step: 5, nose: 5, eye: 3, sneak: 3, haggle: 3 }; W.lv = 30; refreshGear(W); ok(W.gear.spd === 10 && W.gear.luck === 20 && Math.abs(W.gear.reach - .6) < 1e-9 && W.gear.stealth === 18 && W.gear.trade === 15, 'ветка скитальца: ' + JSON.stringify(W.gear));
  const it = { value: 100 }; ok(sellPrice(it, W.cfg, 0, W.gear.trade) > sellPrice(it, W.cfg, 0, 0), 'торговая жилка не поднимает цену');
  // тишина: враг не слышит стоящего героя на прежней дальности
  const hear = (sk, dist) => { const Wx = mk(7); Wx.skills = sk; Wx.player.x = 60; Wx.player.z = 0; Wx.player.inv = 1e9; const e = spawnEnemy(Wx, 'imp', 60, dist); e.cd = 99; for (let i = 0; i < 5; i++) step(Wx, 1 / 60, { mx: 1 }); return e.alert; };
  const run = CFG3.enemies.hear.run; ok(hear({}, run - 1) && !hear({ sneak: 4 }, run - 1), 'тихий шаг не уменьшает дальность слуха'); }
// сброс
{ const W = mk(8); W.lv = 10; W.sp = 0; W.skills = { th_hand: 3, th_skin: 2 }; W.inv.ash = respecCost(W) - 1; ok(respec(W) === 'ash' && W.skills.th_hand === 3, 'сброс без пепла'); W.inv.ash = respecCost(W) + 7; ok(respec(W) === 'ok' && W.sp === 5 && !Object.keys(W.skills).length && W.inv.ash === 7, 'сброс: очки не вернулись'); ok(respec(W) === 'none', 'сброс пустого древа'); }
// сохранение: прогресс переживает запись, чужое и мусор отбрасываются
{ const mem = {}, st = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; }, removeItem: k => { delete mem[k]; } };
  const W = mk(9); W.lv = 7; W.xp = 33; W.sp = 2; W.skills = { th_hand: 3, th_skin: 1 }; createSaver(W, st).write(true);
  const d = loadSave(30, st); ok(d && d.prog.lv === 7 && d.prog.xp === 33 && d.prog.sp === 2 && d.prog.skills.th_hand === 3, 'прогресс не сохранился: ' + JSON.stringify(d && d.prog));
  // накрутка очков: больше, чем даёт уровень → сброс распределения
  mem['berserk3d.save'] = JSON.stringify({ v: 1, inv: {}, kills: 0, prog: { lv: 3, xp: 0, sp: 50, skills: { hand: 5, thirst: 4, nope: 9 } } });
  const c = loadSave(30, st); ok(c.prog.sp === 2 && !Object.keys(c.prog.skills).length, 'накрутка очков не отброшена: ' + JSON.stringify(c.prog));
  mem['berserk3d.save'] = JSON.stringify({ v: 1, inv: {}, kills: 0 }); const o = loadSave(30, st); ok(o.prog.lv === 1 && o.prog.sp === 0, 'старое сохранение без прогресса');
  mem['berserk3d.save'] = JSON.stringify({ v: 1, inv: {}, prog: { lv: 'x', xp: -5, sp: NaN, skills: [] } }); const g = loadSave(30, st); ok(g.prog.lv === 1 && g.prog.xp === 0 && g.prog.sp === 0, 'мусор в прогрессе'); }
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Прокачка 3D: OK');
