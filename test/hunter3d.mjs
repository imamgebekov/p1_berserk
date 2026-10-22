// Бесогон, охотник на демонов (Г8): два клинка, 36 умений, гнев, в группе — боец, модель Rogue; рывок проходит сквозь врага и поджигает,
// двойной прыжок (в воздухе неуязвим, второй — без перезарядки, на бегу — куда бежит), луч из глаз бьёт по линии, облик демона — сильнее и быстрее.
import { CFG3 } from '../3d/src/config3d.js';
import { HEROES, canWield, canOff } from '../3d/src/data/heroes3d.js';
import { ABILITIES } from '../3d/src/data/abilities3d.js';
import { BY_ID } from '../3d/src/data/items.js';
import { createWorld, step, mulberry32, spawnEnemy, refreshGear, hurtPlayer } from '../3d/src/sim.js';
import { useAbility } from '../3d/src/abilities3d.js';
import { heroRole } from '../3d/src/party3d.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const mk = () => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.map.places = []; const W = createWorld(c, mulberry32(5), 'hunter'); W.hero = 'hunter'; W.lv = 30; W.inv.eq.weapon = 'w_sword_iron'; for (const a of ABILITIES.hunter) W.ab[a.id] = 3; refreshGear(W); W.player.x = 300; W.player.z = 0; W.player.face = 0; step(W, 1 / 60, {}); W.resHero = 'hunter'; return W; };
const cast = (W, id) => { W.res = 1e4; return useAbility(W, ABILITIES.hunter.findIndex(a => a.id === id)); };
const run = (W, s) => { for (let i = 0; i < Math.round(s * 60); i++) step(W, 1 / 60, {}); };
const foe = (W, dx, dz) => { const p = W.player, e = spawnEnemy(W, 'brute', p.x + dx, p.z + dz); e.hp = e.maxhp = 1e5; e.cd = 1e9; e.alert = false; return e; };
const J = CFG3.abilities.hunter.djump;

ok(HEROES.hunter && HEROES.hunter.open && canWield('hunter', BY_ID.w_sword_iron) && canOff('hunter', BY_ID.w_sickle_iron) && !canWield('hunter', BY_ID.w_bow_iron), 'Бесогон: нет героя, не то оружие или нет второго клинка');
ok(ABILITIES.hunter.length === 36, 'Бесогон: умений ' + ABILITIES.hunter.length);
ok(CFG3.abilities.res.hunter && CFG3.abilities.res.hunter.name === 'Гнев', 'Бесогон: нет гнева');
ok(CFG3.actors.heroes.hunter === 'q_rogue' && CFG3.actors.kits.q_rogue, 'Бесогон: нет модели');
{ const W = mk(); ok(heroRole(W) === 'melee', 'Бесогон в группе — не боец'); }
// рывок скверны: герой сдвинулся, враг на пути ранен и горит
{ const W = mk(), e = foe(W, 0, 5), z0 = W.player.z; ok(cast(W, 'felrush') === 'ok', 'рывок не пошёл'); run(W, .5); ok(W.player.z > z0 + 2 && W.player.z > e.z && e.hp < e.maxhp && e.st && e.st.burn, 'рывок не прошёл сквозь врага, не ударил или не поджёг'); }
// удар хаоса: урон и трещина
{ const W = mk(), e = foe(W, 0, 2.2); ok(cast(W, 'chaos') === 'ok' && e.hp < e.maxhp && e.st && e.st.crack, 'удар хаоса не попал или нет трещины'); }
// двойной прыжок: в воздухе выше земли и неуязвим; второе нажатие в воздухе — второй прыжок; третье — перезарядка
{ const W = mk(), p = W.player, z0 = p.z; p.inv = 0;
  ok(cast(W, 'djump') === 'ok', 'прыжок не пошёл'); run(W, J.time / 2);
  ok(p.hopY > J.h * .5 && p.inv > 0, `в воздухе не высоко (${p.hopY}) или уязвим`);
  const hp0 = p.hp; ok(hurtPlayer(W, 50, p.x + 1, p.z) === false && p.hp === hp0, 'удар задел героя в прыжке');
  ok(cast(W, 'djump') === 'ok', 'второй прыжок в воздухе не пошёл'); run(W, J.time + .1);
  ok(p.z > z0 + J.dist * 1.5 && !(p.hopY > 0) && p.state !== 'dash', `два прыжка не унесли героя (${(p.z - z0).toFixed(1)} м) или он не приземлился`);
  ok(cast(W, 'djump') === 'cd', 'третий прыжок без перезарядки'); }
// прыжок на бегу — туда, куда бежит герой, а не куда смотрит
{ const W = mk(), p = W.player, z0 = p.z; p.face = 0; p.vx = 0; p.vz = -5; ok(cast(W, 'djump') === 'ok', 'прыжок на бегу не пошёл'); run(W, J.time + .1); ok(p.z < z0 - J.dist * .6, `прыжок на бегу ушёл не туда (${(p.z - z0).toFixed(1)} м)`); }
// огненный взор: бьёт по линии впереди несколько раз и поджигает; сзади — нет
{ const W = mk(), e = foe(W, 0, 8), back = foe(W, 0, -4); ok(cast(W, 'eyebeam') === 'ok', 'взор не пошёл');
  run(W, .35); const h1 = e.maxhp - e.hp; run(W, 1); const h2 = e.maxhp - e.hp;
  ok(h1 > 0 && h2 > h1 * 1.5 && e.st && e.st.burn && back.hp === back.maxhp, `взор не жжёт по линии (${h1} → ${h2}) или задел сзади`);
  run(W, 1); ok(!W.abuf.beam, 'взор не гаснет'); }
// облик демона: урон, скорость, вампиризм; удар и оглушение рядом; модель крупнее; через t — конец
{ const W = mk(), e = foe(W, 2, 0), M = CFG3.abilities.hunter.meta; ok(cast(W, 'meta') === 'ok', 'облик не пошёл');
  ok(['dmg', 'spd', 'leech'].every(s => W.buffs.some(b => b.src === 'morph:' + s)) && W.abuf.morph > 0 && W.abuf.morphScale > 1, 'в облике нет усилений');
  ok(e.hp < e.maxhp && e.st && e.st.stun, 'вход в облик не ударил или не оглушил');
  run(W, M.t[2] + .5); ok(!(W.abuf.morph > 0) && !W.buffs.some(b => b.src.startsWith('morph:')), 'облик не кончается'); }
// витрина
{ const W = mk(); W.shop.t = 1e9; step(W, 1 / 60, {}); const ids = (W.shop.stock || []).map(s => s.id); ok(ids.includes('w_sword_iron') && ids.includes('w_sickle_iron'), 'на витрине нет меча и серпа'); }

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Бесогон 3D: OK');
