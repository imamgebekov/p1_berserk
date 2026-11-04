// Селена, лунная воительница (Г9): ближний боец с лунной магией, 36 умений, лунный свет, в группе — боец; серпы света веером, луч по одной цели,
// звёздопад — поле, ночью сильнее; три связки; древо из трёх веток.
import { CFG3 } from '../3d/src/config3d.js';
import { HEROES, canWield } from '../3d/src/data/heroes3d.js';
import { ABILITIES } from '../3d/src/data/abilities3d.js';
import { TREES } from '../3d/src/data/skills3d.js';
import { COMBOS } from '../3d/src/combos3d.js';
import { BY_ID } from '../3d/src/data/items.js';
import { createWorld, step, mulberry32, spawnEnemy } from '../3d/src/sim.js';
import { useAbility } from '../3d/src/abilities3d.js';
import { heroRole } from '../3d/src/party3d.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const mk = () => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.map.places = []; c.map.outposts = []; c.map.citadel = null; const W = createWorld(c, mulberry32(5), 'selene'); W.hero = 'selene'; W.lv = 30; W.inv.eq.weapon = 'w_sword_iron'; W.player.inv = 1e9; W.resHero = 'selene'; W.player.face = 0; for (const a of ABILITIES.selene) W.ab[a.id] = 3; return W; };
const cast = (W, id) => { W.res = 1e4; const r = useAbility(W, ABILITIES.selene.findIndex(a => a.id === id)); if (r !== 'ok') console.log(id, r); return r; };
const run = (W, s) => { for (let i = 0; i < Math.round(s * 60); i++) step(W, 1 / 60, {}); };
const foe = (W, dx, dz) => { const p = W.player, e = spawnEnemy(W, 'brute', p.x + dx, p.z + dz); e.hp = e.maxhp = 1e5; e.cd = 1e9; e.alert = false; return e; };

ok(HEROES.selene && HEROES.selene.open && canWield('selene', BY_ID.w_sword_iron) && canWield('selene', BY_ID.w_rapier_iron) && canWield('selene', BY_ID.w_staff_iron) && !canWield('selene', BY_ID.w_bow_iron), 'Селена: нет героя или не то оружие');
ok(ABILITIES.selene.length === 36, 'Селена: умений ' + ABILITIES.selene.length);
ok(new Set(ABILITIES.selene.map(a => a.id)).size === 36, 'Селена: повтор id умений');
ok(CFG3.abilities.res.selene && CFG3.abilities.res.selene.name === 'Лунный свет', 'Селена: нет лунного света');
ok(CFG3.actors.heroes.selene === 'kk_selene' && CFG3.actors.kits.kk_selene, 'Селена: нет модели');
ok(TREES.selene && TREES.selene.length === 3, 'Селена: древо не из трёх веток');
ok(COMBOS.selene && COMBOS.selene.length === 3, 'Селена: связок не 3');
ok(CFG3.squad.types.c_selene && CFG3.squad.types.c_selene.hero === 'selene', 'Селена: нет наёмницы');
{ const W = mk(); ok(heroRole(W) === 'melee', 'Селена в группе — не боец'); }
// лунный луч: урон и слепота цели впереди
{ const W = mk(), e = foe(W, 0, 6); ok(cast(W, 'moonbeam') === 'ok', 'луч не пошёл'); run(W, .8); ok(e.hp < e.maxhp && e.st && e.st.blind, 'луч не попал или нет слепоты'); }
// серпы света: три снаряда веером
{ const W = mk(); foe(W, 0, 8); W.ev.length = 0; ok(cast(W, 'lglaive') === 'ok' && W.proj.filter(q => q.friendly).length === CFG3.abilities.selene.lglaive.n, 'серпы света не веером'); }
// лунный росчерк: удар по соседу и замедление
{ const W = mk(), e = foe(W, 0, 2); ok(cast(W, 'crescent') === 'ok' && e.hp < e.maxhp && e.st && e.st.slow, 'росчерк не попал или нет замедления'); }
// звёздопад: поле на t с, бьёт тиками; ночью сильнее
{ const A = CFG3.abilities.selene.starfall;
  const W = mk(); W.night = false; foe(W, 0, 5); ok(cast(W, 'starfall') === 'ok' && W.zones.length === 1 && W.zones[0].el === 'light', 'звёздопад не поставил поле');
  const day = W.zones[0].mul; const N = mk(); N.night = true; foe(N, 0, 5); cast(N, 'starfall');
  ok(N.zones[0].mul > day * (A.night - .01), `ночью звёздопад не сильнее (${day} → ${N.zones[0].mul})`);
  const e = foe(W, 0, 5); e.x = W.zones[0].x; e.z = W.zones[0].z; run(W, A.t - .5); ok(e.hp < e.maxhp, 'лучи не бьют врага в круге'); run(W, 1); ok(!W.zones.length, 'звёздопад не гаснет'); }
// витрина
{ const W = mk(); W.shop.t = 1e9; step(W, 1 / 60, {}); const ids = (W.shop.stock || []).map(s => s.id); ok(ids.includes('w_sword_iron') && ids.includes('w_rapier_iron'), 'на витрине нет меча и рапиры'); }

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Селена 3D: OK');
