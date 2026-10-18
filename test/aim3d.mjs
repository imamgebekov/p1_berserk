// Прицел курсором (2026-10-18): на компьютере удар, выстрел и умения идут в сторону мыши (W.aimPt — точка земли под курсором).
// Удар подхватывает врага только в конусе у курсора; без курсора (телефон, боты баланса) — ближайший враг, как раньше;
// умение по площади ставится в точку курсора, не дальше своей дальности.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, spawnEnemy, refreshGear, mulberry32 } from '../3d/src/sim.js';
import { useAbility, upgradeAbility, abilityPoints } from '../3d/src/abilities3d.js';
import { ABILITIES } from '../3d/src/data/abilities3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const mk = (hero, weapon) => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.bosses.list = []; c.map.places = []; c.events.on = false; c.wanderer.on = false; c.ambient.on = false;
  const W = createWorld(c, mulberry32(7)); W.hero = hero; W.lv = 30; W.ap = abilityPoints(30, c); W.inv.eq.weapon = weapon; refreshGear(W);
  Object.assign(W.player, { x: 40, z: 40, face: 0, inv: 0 }); W.player.hp = W.player.maxhp = 1e6; return W; };
const foe = (W, dx, dz) => { const e = spawnEnemy(W, 'brute', 40 + dx, 40 + dz); e.hp = e.maxhp = 1e5; e.cd = 99; e.speed = 0; return e; };
const swing = (W, aimPt) => { for (let i = 0; i < 40; i++) step(W, 1 / 60, { attack: i < 3, attackPress: i === 0, aimPt }); };
// 1. ближний бой: впереди близкий враг, справа — дальше; курсор вправо — бьёт правого
{ const W = mk('thorn', 'w_sword_iron'), a = foe(W, 0, 1.6), b = foe(W, 2.2, 0);
  swing(W, { x: 46, z: 40 }); ok(b.hp < b.maxhp && a.hp === a.maxhp, `удар не пошёл к курсору: передний ${a.hp}, правый ${b.hp}`); }
// 2. без курсора — к ближайшему (как раньше)
{ const W = mk('thorn', 'w_sword_iron'), a = foe(W, 0, 1.6), b = foe(W, 2.2, 0);
  swing(W, null); ok(a.hp < a.maxhp && b.hp === b.maxhp, 'без курсора удар не к ближайшему'); }
// 3. лук: курсор влево, враг впереди — стрела уходит влево (враг цел)
{ const W = mk('jay', 'w_bow_rust'), a = foe(W, 0, 6);
  for (let i = 0; i < 120; i++) step(W, 1 / 60, { attack: i < 2, attackPress: i === 0, aimPt: { x: 30, z: 40 } });
  ok(a.hp === a.maxhp && Math.abs(W.player.face + Math.PI / 2) < .2, 'стрела ушла не к курсору: лицо ' + W.player.face.toFixed(2)); }
// 4. метеор Ирги — в точку курсора, не дальше дальности
{ const W = mk('irga', 'w_staff_rust'), A = CFG3.abilities.irga.meteor; upgradeAbility(W, 'meteor'); W.res = 999;
  const slot = ABILITIES.irga.findIndex(a => a.id === 'meteor');
  W.aimPt = { x: 45, z: 43 }; useAbility(W, slot); const m = W.meteors && W.meteors[0];
  ok(m && Math.abs(m.x - 45) < .01 && Math.abs(m.z - 43) < .01, 'метеор не в точку курсора: ' + JSON.stringify(m));
  W.meteors = []; W.acd = {}; W.res = 999; W.aimPt = { x: 140, z: 40 }; useAbility(W, slot); const m2 = W.meteors[0];
  ok(m2 && Math.abs(Math.hypot(m2.x - 40, m2.z - 40) - A.range) < .01, 'метеор дальше своей дальности'); }

if (fails.length) { console.error('Прицел курсором 3D: ПРОВАЛ\n- ' + fails.join('\n- ')); process.exit(1); }
console.log('Прицел курсором 3D: OK');
