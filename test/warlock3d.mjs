// Тест Морока-чернокнижника (2026-10-20): герой, оружие и броня, ресурс «Души», 8 умений, мастерство, таланты, связки.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnEnemy, refreshGear } from '../3d/src/sim.js';
import { HEROES, HERO_IDS, canWield } from '../3d/src/data/heroes3d.js';
import { ABILITIES, MASTERY_TEXT } from '../3d/src/data/abilities3d.js';
import { abilityPoints, upgradeAbility, useAbility } from '../3d/src/abilities3d.js';
import { branchesOf } from '../3d/src/data/skills3d.js';
import { combosOf } from '../3d/src/combos3d.js';
import { resNow } from '../3d/src/resource3d.js';
import { BY_ID } from '../3d/src/data/items.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const mk = (lv = 30, twist = true) => {
  const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.bosses.list = []; c.map.places = []; c.events.on = false; c.wanderer.on = false; c.ambient.on = false; c.abilities.mastery.twist = twist;
  c.abilities.res.warlock = { ...c.abilities.res.warlock, max: 1e6, start: 1e6 };
  const W = createWorld(c, mulberry32(5)); W.hero = 'warlock'; W.lv = lv; W.ap = abilityPoints(lv, c); W.inv.eq.weapon = 'w_scythe_iron'; refreshGear(W);
  for (const a of ABILITIES.warlock) while (upgradeAbility(W, a.id) === 'ok');
  Object.assign(W.player, { x: 40, z: 40, face: 0, inv: 0 }); W.player.hp = W.player.maxhp; return W;
};
const foe = (W, dx, dz) => { const e = spawnEnemy(W, 'brute', W.player.x + dx, W.player.z + dz); e.hp = e.maxhp = 1e5; e.cd = 99; e.state = 'rec'; e.t = -1e9; return e; };
const use = (W, id) => { delete W.acd[id]; return useAbility(W, ABILITIES.warlock.findIndex(a => a.id === id)); };
const run = (W, s) => { for (let i = 0; i < Math.round(s * 60); i++) step(W, 1 / 60, {}); };

// герой и данные
{
  const H = HEROES.warlock; ok(HERO_IDS.includes('warlock') && H.open && H.name === 'Морок', 'нет героя Морок');
  ok(canWield('warlock', BY_ID.w_scythe_iron) && canWield('warlock', BY_ID.w_wand_iron) && !canWield('warlock', BY_ID.w_sword_iron) && !canWield('warlock', BY_ID.a_body_plate_black), 'оружие или броня Морока');
  ok(ABILITIES.warlock.length === 30 && ABILITIES.warlock.slice(0, 8).every(a => CFG3.abilities.warlock[a.id] && MASTERY_TEXT[a.id] && [0, 1, 2].every(r => typeof a.text(CFG3.abilities.warlock[a.id], r) === 'string')), 'умения Морока не описаны');
  ok(branchesOf('warlock').length === 4 && branchesOf('warlock').slice(0, 3).every(b => b.skills.filter(s => !s.boost && !s.gen).length === 6), 'таланты Морока');
  ok(combosOf('warlock').length === 4 && combosOf('warlock').every(c => CFG3.combos[c.id]), 'связки Морока');
  ok(CFG3.abilities.res.warlock && CFG3.abilities.res.warlock.name === 'Души', 'ресурс «Души»');
}
// умения
{
  let W = mk(); const e = foe(W, 0, 4); use(W, 'hex'); ok(e.st && e.st.crack && e.st.crack.k > 1 && e.st.poison, 'порча: трещина и яд');
  W = mk(); foe(W, 0, 3); W.player.hp = W.player.maxhp * .5; use(W, 'drain'); ok(W.player.hp > W.player.maxhp * .5, 'похищение жизни не лечит');
  W = mk(); use(W, 'summon'); ok(W.allies.filter(a => a.imp).length === 1, 'бес не призван');
  W = mk(); const t = foe(W, 0, 3); use(W, 'terror'); ok(t.st && t.st.fear && t.st.slow, 'ужас: страх и замедление');
  W = mk(); const g = foe(W, 0, 5); use(W, 'grasp'); ok(g.st && g.st.root, 'хватка: корни');
  W = mk(); W.res = 0; const hp0 = W.player.hp; use(W, 'pact'); ok(W.player.hp < hp0 && resNow(W) >= CFG3.abilities.warlock.pact.gain && W.buffs.some(b => b.src === 'pact'), 'договор: плата здоровьем, души и урон');
  W = mk(); foe(W, 0, 6); const n0 = W.proj.length; use(W, 'souls'); ok(W.proj.length - n0 === 5, 'рой душ: не 5 сфер');
  W = mk(); const d = foe(W, 0, 5), hd = d.hp; use(W, 'doom'); run(W, 1); ok(d.hp === hd, 'рок ударил раньше срока'); run(W, CFG3.abilities.warlock.doom.delay); ok(d.hp < hd, 'рок не ударил');
}
// мастерство (60-й уровень)
{
  let W = mk(60); use(W, 'summon'); ok(W.allies.filter(a => a.imp).length === 2, 'мастерство: не два беса');
  W = mk(60); const hp0 = W.player.hp; use(W, 'pact'); ok(W.player.hp === hp0, 'мастерство: договор отнял здоровье');
  W = mk(60); foe(W, 0, 6); const n0 = W.proj.length; use(W, 'souls'); ok(W.proj.length - n0 === 8, 'мастерство: не восемь душ');
  W = mk(60, false); use(W, 'summon'); ok(W.allies.filter(a => a.imp).length === 1, 'без мастерства — два беса');
}
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Морок-чернокнижник 3D: OK');
