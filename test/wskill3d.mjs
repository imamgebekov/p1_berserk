// Тест умений оружия (2026-10-18): у клеймёного и золотого оружия — умение по типу (6 штук), клавиша F (ввод ability 6),
// общая перезарядка; стихия оружия кладётся наверняка; золотое сильнее и даёт «Солнце»; чужое оружие — без умения.
import { CFG3 } from '../3d/src/config3d.js';
import { CATALOG, BY_ID } from '../3d/src/data/items.js';
import { createWorld, step, spawnEnemy, refreshGear, switchHero } from '../3d/src/sim.js';
import { skillOfItem, weaponSkillOf, useWeaponSkill, WSKILL } from '../3d/src/weaponskill3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const S = CFG3.wskill;
function mk(weapon, hero = 'thorn', gems) {
  const cfg = JSON.parse(JSON.stringify(CFG3)); cfg.enemies.count = 0; cfg.map.places = []; cfg.weather.force = 'clear'; cfg.enemies.roam.on = false;
  const W = createWorld(cfg, () => .5); W.hero = hero; W.player.x = 300; W.player.z = 0; W.player.face = 0; W.player.inv = 1e9;
  W.inv.eq.weapon = weapon; if (gems) W.inv.gem.weapon = gems; refreshGear(W); step(W, 1 / 60, {}); return W;
}
const foe = (W, dx, dz, hp = 1e5) => { const p = W.player, e = spawnEnemy(W, 'brute', p.x + dx, p.z + dz); e.hp = e.maxhp = hp; e.cd = 1e9; e.alert = false; return e; };
const run = (W, sec, inp = {}) => { for (let i = 0; i < Math.round(sec * 60); i++) step(W, 1 / 60, inp); };
const hurt = e => e.maxhp - e.hp;

// ---------- 1. у какого оружия есть умение ----------
{ const w = CATALOG.filter(i => i.slot === 'weapon');
  const top = w.filter(i => i.rar >= S.minRar); ok(top.length === 44 && top.every(i => skillOfItem(i, CFG3)), `не у всего клеймёного и золотого оружия есть умение: ${top.filter(i => !skillOfItem(i, CFG3)).map(i => i.id)}`);
  ok(w.filter(i => i.rar < S.minRar).every(i => !skillOfItem(i, CFG3)), 'умение у оружия ниже клеймёного');
  ok(new Set(top.map(i => skillOfItem(i, CFG3).id)).size === 7 && Object.keys(WSKILL).length === 7, 'умений по типам не 7');
  ok(top.filter(i => i.rar === 5).every(i => skillOfItem(i, CFG3).gold), 'золотое не отмечено');
  ok(!weaponSkillOf(mk('w_bow_blood', 'thorn')) && weaponSkillOf(mk('w_bow_blood', 'jay')), 'чужое оружие даёт умение'); }

// ---------- 2. каждое умение бьёт, перезарядка общая ----------
const CASES = [['cleave', 'w_sword_blood', 'thorn', [[0, 1.8], [1.8, 0], [-1.8, 0]]], ['lunge', 'w_spear_blood', 'thorn', [[0, 2.5], [0, 4.5]]], ['shatter', 'w_hammer_blood', 'thorn', [[0, 2], [2.5, 0], [-2.5, 0]]],
  ['reap', 'w_greatsword_blood', 'thorn', [[0, 2], [1.5, 2], [-1.5, 2]]], ['tempest', 'w_flail_blood', 'thorn', [[0, 2], [2, 0]]], ['elemshot', 'w_longbow_blood', 'jay', [[0, 4], [0, 7], [1.5, 7]]], ['orb', 'w_staff_blood', 'irga', [[0, 4], [1.2, 6], [-1.2, 7]]]];
for (const [id, wid, hero, spots] of CASES) {
  const W = mk(wid, hero), es = spots.map(([x, z]) => foe(W, x, z));
  ok(weaponSkillOf(W) && weaponSkillOf(W).id === id, `${wid}: не то умение`);
  W.ev.length = 0; step(W, 1 / 60, { ability: 6 }); const ev = W.ev.find(v => v.k === 'wskill');
  run(W, 3);
  ok(ev && ev.id === id, `${id}: F не запустило умение`);
  ok(es.every(e => hurt(e) > 0), `${id}: не все враги задеты: ${es.map(hurt)}`);
  ok(Math.abs(W.wcd - (S.cd - 3 - 1 / 60)) < .1 && useWeaponSkill(W) === 'cd', `${id}: перезарядка не идёт: ${W.wcd}`);
}
{ const W = mk('w_spear_blood'); foe(W, 0, 2.5); const z0 = W.player.z; useWeaponSkill(W); run(W, .5); ok(W.player.z - z0 > S.lunge.dist * .7, 'выпад не несёт героя вперёд: ' + (W.player.z - z0).toFixed(1)); }
{ const W = mk('w_flail_blood'), e = foe(W, 0, 2); useWeaponSkill(W); run(W, .3); const h1 = hurt(e); run(W, 1.5); ok(hurt(e) > h1 * 2, '«Цепная буря» бьёт один раз'); }
{ const W = mk('w_sword_blood'); ok(useWeaponSkill(W) === 'target' && !W.wcd, 'без врагов умение тратит перезарядку'); }
{ const W = mk('w_sword_blood'); foe(W, 0, 1.8); useWeaponSkill(W); W.inv.eq.weapon = 'w_axe_blood'; refreshGear(W); ok(useWeaponSkill(W) === 'cd', 'смена оружия сбрасывает перезарядку'); }
{ const W = mk('w_sword_steel'); foe(W, 0, 1.8); ok(useWeaponSkill(W) === 'none', 'у редкого оружия есть умение'); }

// ---------- 3. стихия наверняка ----------
{ const W = mk('w_sword_blood', 'thorn', ['gem_fire_1', null]), e = foe(W, 0, 1.8); W.rng = () => .99; useWeaponSkill(W); ok(e.st && e.st.burn, 'умение с камнем огня не поджигает наверняка'); }
{ const W = mk('w_sword_blood', 'thorn', ['gem_water_1', 'gem_storm_1']), e = foe(W, 0, 1.8), o = foe(W, 3.5, 3.5); o.st = { wet: { t: 9 } }; W.rng = () => .99; W.ev.length = 0; useWeaponSkill(W);
  ok(W.ev.some(v => v.k === 'react' && v.name === 'Грозовой поток') && hurt(o) > 0, 'умение не даёт «Грозовой поток» мокрым'); }
{ const W = mk('w_sword_blood'), e = foe(W, 0, 1.8); W.rng = () => .99; useWeaponSkill(W); ok(!e.st || (!e.st.burn && !e.st.freeze && !e.st.poison), 'умение без стихии кладёт стихию'); }

// ---------- 4. золотое: сильнее и «Солнце» ----------
{ const base = mk('w_greatsword_blood'), gold = mk('g_sundar'), a = foe(base, 0, 2), b = foe(gold, 0, 2); base.rng = gold.rng = () => .5; gold.ev.length = 0;
  const sun = gold.wp.pm; gold.wp.pm = { ...sun, sun: null }; useWeaponSkill(base); useWeaponSkill(gold); gold.wp.pm = sun;     // сила — без вспышки
  const per = (W, id) => (CFG3.player.attackDamage + W.gear.dmg) * S.reap.mul;
  ok(hurt(b) / per(gold) > hurt(a) / per(base) * 1.2, `золотое не сильнее: ${hurt(b)} против ${hurt(a)}`);
  const g2 = mk('g_sundar'); foe(g2, 0, 2); g2.ev.length = 0; useWeaponSkill(g2); ok(g2.ev.some(v => v.k === 'sun'), 'золотое умение без «Солнца»'); }

// ---------- 5. смена героя ----------
{ const W = mk('w_flail_blood'); foe(W, 0, 2); useWeaponSkill(W); ok(W.wsk, 'буря не началась'); switchHero(W, 'vale'); ok(!W.wsk, 'буря осталась после смены героя'); }

if (fails.length) { console.error('Умения оружия 3D: ПРОВАЛ\n- ' + fails.join('\n- ')); process.exit(1); }
console.log('Умения оружия 3D: OK');
