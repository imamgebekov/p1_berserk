// Жрец (Г3, 4.16): лекарь группы — 36 умений, вера, Исцеление лечит его и отряд рядом, Щит веры ставит оберег, который гасит
// урон и гаснет со временем, в группе сбора — роль лекаря, на витрине — булава и посох, модель — Cleric (Quaternius).
import { CFG3 } from '../3d/src/config3d.js';
import { HEROES, canWield } from '../3d/src/data/heroes3d.js';
import { ABILITIES } from '../3d/src/data/abilities3d.js';
import { BY_ID } from '../3d/src/data/items.js';
import { createWorld, step, mulberry32, hurtPlayer, refreshGear } from '../3d/src/sim.js';
import { useAbility } from '../3d/src/abilities3d.js';
import { spawnAlly } from '../3d/src/squad3d.js';
import { heroRole } from '../3d/src/party3d.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const mk = () => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.map.places = []; const W = createWorld(c, mulberry32(3), 'priest'); W.hero = 'priest'; W.lv = 30; W.inv.eq.weapon = 'w_mace_iron'; for (const a of ABILITIES.priest) W.ab[a.id] = 3; refreshGear(W); step(W, 1 / 60, {}); W.resHero = 'priest'; W.res = 1e4; return W; };
const cast = (W, id) => { W.res = 1e4; return useAbility(W, ABILITIES.priest.findIndex(a => a.id === id)); };

ok(HEROES.priest && HEROES.priest.open && canWield('priest', BY_ID.w_mace_iron) && !canWield('priest', BY_ID.w_sword_iron), 'Жрец: нет героя или не то оружие');
ok(ABILITIES.priest.length === 36, 'Жрец: умений ' + ABILITIES.priest.length);
ok(CFG3.abilities.res.priest && CFG3.abilities.res.priest.name === 'Вера', 'Жрец: нет веры');
ok(CFG3.actors.heroes.priest === 'kk_priest' && CFG3.actors.kits.kk_priest, 'Жрец: нет модели KayKit (kk_priest)');
{ const W = mk(); ok(heroRole(W) === 'heal', 'Жрец в группе — не лекарь'); }
// Исцеление: лечит себя и бойца рядом, дальнего — нет
{ const W = mk(), p = W.player, a = spawnAlly(W, 'c_vale'), far = spawnAlly(W, 'c_jay'); a.x = p.x + 3; a.z = p.z; far.x = p.x + 30; far.z = p.z;
  p.hp = p.maxhp * .4; a.hp = a.maxhp * .4; far.hp = far.maxhp * .4; const r = cast(W, 'mend');
  ok(r === 'ok' && p.hp > p.maxhp * .5 && a.hp > a.maxhp * .5 && far.hp <= far.maxhp * .41, `Исцеление: ${r}, герой ${(p.hp / p.maxhp).toFixed(2)}, рядом ${(a.hp / a.maxhp).toFixed(2)}, далеко ${(far.hp / far.maxhp).toFixed(2)}`); }
// Щит веры: оберег гасит удар, у бойца рядом — тоже; гаснет через t с
{ const W = mk(), p = W.player, a = spawnAlly(W, 'c_vale'); a.x = p.x + 3; a.z = p.z; const r = cast(W, 'sanctum');
  ok(r === 'ok' && p.ward > 0 && a.ward > 0, 'Щит веры: нет оберега'); const hp0 = p.hp, w0 = p.ward; p.inv = 0;
  hurtPlayer(W, Math.floor(w0 / 2), p.x + 1, p.z); ok(p.hp === hp0 && p.ward < w0, 'оберег не погасил удар');
  for (let i = 0; i < Math.round((CFG3.abilities.priest.sanctum.t + .5) * 60); i++) step(W, 1 / 60, {}); ok(!(p.ward > 0) && !(a.ward > 0), 'оберег не гаснет'); }
// витрина
{ const W = mk(); W.shop.t = 1e9; step(W, 1 / 60, {}); const ids = (W.shop.stock || []).map(s => s.id); ok(ids.includes('w_mace_iron') && ids.includes('w_staff_iron'), 'на витрине нет булавы и посоха: ' + ids.slice(0, 8).join(' ')); }

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Жрец 3D: OK');
