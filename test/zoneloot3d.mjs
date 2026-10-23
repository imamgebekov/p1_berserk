// Вещи земель (2026-10-23): у каждой из 21 земли свой набор из 13 вещей (4 брони, перстень, оберег, 7 видов оружия — у каждого героя
// есть своё оружие в наборе); выпадают только в своей земле и только на поверхности; шанс — cfg.zoneLoot; общий W.rng не тратится.
import { CFG3 } from '../3d/src/config3d.js';
import { CATALOG, BY_ID } from '../3d/src/data/items.js';
import { HEROES, canWield } from '../3d/src/data/heroes3d.js';
import { createWorld, mulberry32, spawnEnemy, zoneDrop } from '../3d/src/sim.js';
import { zoneAt } from '../3d/src/zones3d.js';
import { travel } from '../3d/src/levels3d.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const Z = CFG3.zones, zones = [Z.core.id, ...Z.rings.flatMap(r => Object.values(r).map(z => z.id))];
const zi = CATALOG.filter(i => i.zone);
ok(zones.length === 21, 'земель не 21: ' + zones.length);
for (const id of zones) {
  const set = zi.filter(i => i.zone === id); ok(set.length === 13, `у земли ${id} вещей ${set.length}`);
  for (const h of Object.keys(HEROES)) ok(set.some(i => i.cat === 'weapon' && canWield(h, i)), `у героя ${h} нет оружия в наборе ${id}`);
  ok(['head', 'body', 'cloak', 'boots', 'ring', 'amulet'].every(sl => set.some(i => i.slot === sl)), `в наборе ${id} не все места`);
}
ok(new Set(CATALOG.map(i => i.id)).size === CATALOG.length && new Set(CATALOG.map(i => i.name)).size === CATALOG.length, 'повтор id или имени в каталоге');
ok(zi.every(i => i.pool === 'zone' && i.stats && i.text && BY_ID[i.id] === i), 'вещь земли без пула, свойств или текста');
const rarOf = id => BY_ID[`z_${id}_head`].rar; ok(rarOf('brod') < rarOf('olkh') && rarOf('olkh') <= rarOf('heart') && rarOf('heart') < rarOf('scorched'), 'редкость не растёт к краю мира');

// выпадение: только своя земля, шанс около cfg.zoneLoot, W.rng не трогается, в подземелье — нет
const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.map.places = []; c.events.on = false; c.wanderer.on = false;
const W = createWorld(c, mulberry32(5));
let pt = null; for (let r = 300; r < 1100 && !pt; r += 7) for (let a = 0; a < 6.28 && !pt; a += .2) { const x = Math.sin(a) * r, z = Math.cos(a) * r, q = zoneAt(c, x, z); if (q && q.id === 'olkh') pt = { x, z }; }
ok(pt, 'не нашли Ольховый лес');
if (pt) {
  let n = 0, own = true, el = 0, calls = 0; const rng0 = W.rng;
  for (let k = 0; k < 4000; k++) { const e = spawnEnemy(W, 'imp', pt.x, pt.z); W.t += .37; W.rng = () => { calls++; return rng0(); }; const id = zoneDrop(W, e); W.rng = rng0; if (id) { n++; if (BY_ID[id].zone !== 'olkh') own = false; } e.dead = true; }
  for (let k = 0; k < 600; k++) { const e = spawnEnemy(W, 'imp', pt.x, pt.z); e.elite = 'swift'; W.t += .37; if (zoneDrop(W, e)) el++; e.dead = true; }
  const p = n / 4000, pe = el / 600; ok(own, 'выпала вещь чужой земли'); ok(p > c.zoneLoot.mob * .5 && p < c.zoneLoot.mob * 1.6, `шанс с обычного ${p.toFixed(4)} при ${c.zoneLoot.mob}`);
  ok(pe > c.zoneLoot.elite * .6 && pe < c.zoneLoot.elite * 1.4, `шанс с элиты ${pe.toFixed(3)} при ${c.zoneLoot.elite}`);
  ok(!calls, 'выпадение тратит общий W.rng: ' + calls);
  const dun = c.dungeons.list.find(d => !d.raid), L = W.levels[dun.id], rm = L.map.rooms[0]; travel(W, dun.id, (rm.x0 + rm.x1) / 2, (rm.z0 + rm.z1) / 2);
  let d = 0; for (let k = 0; k < 500; k++) { const e = spawnEnemy(W, 'imp', W.player.x, W.player.z); e.boss = true; W.t += .37; if (zoneDrop(W, e)) d++; e.dead = true; } ok(!d, 'вещь земли выпала в подземелье');
}
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log(`Вещи земель 3D: OK (${zi.length} вещей, каталог ${CATALOG.length})`);
