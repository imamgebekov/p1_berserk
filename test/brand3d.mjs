// Клеймёный рыцарь (Г4, 4.17): двуручное железо, 36 умений, клеймо копится от ударов и боли, в группе — защитник, модель Barbarian,
// пушка бьёт и поджигает, таран двигает героя и оглушает, на витрине — двуручник и секира.
import { CFG3 } from '../3d/src/config3d.js';
import { HEROES, canWield } from '../3d/src/data/heroes3d.js';
import { ABILITIES } from '../3d/src/data/abilities3d.js';
import { BY_ID } from '../3d/src/data/items.js';
import { createWorld, step, mulberry32, spawnEnemy, refreshGear, hurtPlayer } from '../3d/src/sim.js';
import { useAbility } from '../3d/src/abilities3d.js';
import { heroRole } from '../3d/src/party3d.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const mk = () => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.map.places = []; const W = createWorld(c, mulberry32(4), 'brand'); W.hero = 'brand'; W.lv = 30; W.inv.eq.weapon = 'w_greatsword_iron'; for (const a of ABILITIES.brand) W.ab[a.id] = 3; refreshGear(W); W.player.x = 300; W.player.z = 0; W.player.face = 0; step(W, 1 / 60, {}); W.resHero = 'brand'; return W; };
const cast = (W, id) => { W.res = 1e4; return useAbility(W, ABILITIES.brand.findIndex(a => a.id === id)); };
const run = (W, s) => { for (let i = 0; i < Math.round(s * 60); i++) step(W, 1 / 60, {}); };
const foe = (W, dx, dz) => { const p = W.player, e = spawnEnemy(W, 'brute', p.x + dx, p.z + dz); e.hp = e.maxhp = 1e5; e.cd = 1e9; e.alert = false; return e; };

ok(HEROES.brand && HEROES.brand.open && canWield('brand', BY_ID.w_greatsword_iron) && !canWield('brand', BY_ID.w_bow_iron), 'Клеймёный: нет героя или не то оружие');
ok(ABILITIES.brand.length === 36, 'Клеймёный: умений ' + ABILITIES.brand.length);
ok(CFG3.abilities.res.brand && CFG3.abilities.res.brand.name === 'Клеймо', 'Клеймёный: нет клейма');
ok(CFG3.actors.heroes.brand === 'kk_barbarian' && CFG3.actors.kits.kk_barbarian, 'Клеймёный: нет модели');
{ const W = mk(); ok(heroRole(W) === 'tank', 'Клеймёный в группе — не защитник'); }
// клеймо копится от боли
{ const W = mk(); W.res = 0; W.player.inv = 0; hurtPlayer(W, 20, W.player.x + 1, W.player.z); ok(W.res > 0, 'клеймо не копится от боли'); }
// пушка: урон и горение
{ const W = mk(), e = foe(W, 0, 7); ok(cast(W, 'cannon') === 'ok', 'пушка не стреляет'); run(W, 1); ok(e.hp < e.maxhp && e.st && e.st.burn, 'пушка не попала или не подожгла'); }
// таран: герой сдвинулся, враг оглушён
{ const W = mk(), e = foe(W, 0, 5), z0 = W.player.z; ok(cast(W, 'rush') === 'ok', 'таран не пошёл'); run(W, .6); ok(W.player.z > z0 + 2 && e.hp < e.maxhp, 'таран не сдвинул героя или не ударил'); }
// витрина
{ const W = mk(); W.shop.t = 1e9; step(W, 1 / 60, {}); const ids = (W.shop.stock || []).map(s => s.id); ok(ids.includes('w_greatsword_iron') && ids.includes('w_war_axe_iron'), 'на витрине нет двуручника и секиры'); }

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Клеймёный рыцарь 3D: OK');
