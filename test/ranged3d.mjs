// Тест стрельбы 3D (шаг B2a): луки и арбалеты в каталоге и добыче (свой пул), стрела героя бьёт врага и не задевает героя и отряд,
// гаснет по дальности и о стену, наводка в конусе, заряд — дальше и сильнее, арбалет пробивает насквозь, стрелок не делает выпада.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnEnemy, spawnAlly, refreshGear } from '../3d/src/sim.js';
import { CATALOG, BY_ID, KIND_NAME } from '../3d/src/data/items.js';
import { TRAITS } from '../3d/src/data/weapons3d.js';
import { CONTAINERS, DROPS, SHOP } from '../3d/src/data/loot.js';
import { templateOf } from '../3d/src/itemicons.js';
import { familyOf } from '../3d/src/anim3d.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const clone = () => JSON.parse(JSON.stringify(CFG3));
const mk = (weapon = 'w_bow_iron', seed = 1) => {
  const c = clone(); c.enemies.count = 0; c.bosses.list = []; c.map.places = []; c.events.on = false; c.wanderer.on = false; c.ambient.on = false;
  const W = createWorld(c, mulberry32(seed)); W.hero = 'jay'; W.inv.eq.weapon = weapon; refreshGear(W);
  Object.assign(W.player, { x: 40, z: 40, face: 0, inv: 1e9 }); return W;
};
const foe = (W, dx, dz, type = 'brute') => { const e = spawnEnemy(W, type, W.player.x + dx, W.player.z + dz); e.cd = 99; e.hp = e.maxhp = 1e4; e.alert = false; e.speed0 = 0; return e; };
const run = (W, sec, input = {}) => { for (let i = 0; i < Math.round(sec * 60); i++) { for (const e of W.enemies) { e.vx = e.vz = 0; } step(W, 1 / 60, typeof input === 'function' ? input(i) : input); } };
const freeze = W => { for (const e of W.enemies) { e.state = 'rec'; e.t = -1e9; } };     // враги стоят на месте
const shot = (W, sec = 1.2) => { freeze(W); step(W, 1 / 60, { attackPress: true }); for (let i = 0; i < sec * 60; i++) { freeze(W); step(W, 1 / 60, {}); } };

// ---------- 1. каталог, добыча, вид ----------
{
  const R = CATALOG.filter(i => i.pool === 'ranged');
  ok(R.length === 21 && R.every(i => i.slot === 'weapon' && TRAITS[i.kind].ranged && KIND_NAME[i.kind] && i.text), `луков и арбалетов ${R.length}`);
  ok(R.every(i => ['bow', 'crossbow'].includes(templateOf(i)) && familyOf(i.kind) === 'bow'), 'у лука не тот значок или поза');
  ok(!CATALOG.some(i => i.pool === 'weapon' && TRAITS[i.kind] && TRAITS[i.kind].ranged), 'лук в пуле ближнего оружия');
  const has = d => d.pools.some(p => p[0] === 'ranged' && p[1] > 0);
  ok(has(CONTAINERS.chest) && has(CONTAINERS.ironchest) && has(SHOP) && has(DROPS.archer), 'луки не выпадают из сундуков, лучников и не продаются');
  ok(CATALOG.length <= 700, 'каталог больше 700');
}
// ---------- 2. стрела бьёт врага, не задевает героя и бойца на пути ----------
{
  const W = mk(); const e = foe(W, 0, 8), a = spawnAlly(W, Object.keys(CFG3.squad.types)[0]); a.x = W.player.x; a.z = W.player.z + 4;
  const hp0 = W.player.hp, ah = a.hp; shot(W);
  ok(e.hp < e.maxhp, 'стрела не попала во врага в 8 м');
  ok(W.player.hp === hp0 && a.hp === ah, 'стрела задела героя или бойца');
  ok(Math.abs(W.player.z - 40) < .01, 'стрелок сделал выпад вперёд');
  ok(!W.proj.length, 'стрела не погасла после попадания');
}
// ---------- 3. дальность и стена ----------
{
  const W = mk(); const e = foe(W, 0, TRAITS.bow.range + 4); shot(W, 1.5);
  ok(e.hp === e.maxhp && !W.proj.length, 'стрела долетела дальше дальности лука');
  const c = clone(); c.enemies.count = 0; c.bosses.list = []; c.events.on = false; c.wanderer.on = false; c.ambient.on = false;
  const W2 = createWorld(c, mulberry32(4)); W2.hero = 'jay'; W2.inv.eq.weapon = 'w_bow_iron'; refreshGear(W2);
  const b = W2.map.buildings.find(x => x.kind === 'tavern'); Object.assign(W2.player, { x: b.x, z: b.z1 + 3, face: Math.PI, inv: 1e9 });
  const e2 = spawnEnemy(W2, 'brute', b.x, b.z0 - 3); e2.hp = e2.maxhp = 1e4; e2.cd = 99;
  shot(W2, 1.5); ok(e2.hp === e2.maxhp, 'стрела прошла сквозь дом');
}
// ---------- 4. наводка: лук доворачивает на ближайшего видимого врага в пределах дальности в любую сторону (после переката — не за спину);
// за домом и дальше дальности — нет ----------
{
  const W = mk(); const a = 20 * Math.PI / 180, e = foe(W, Math.sin(a) * 9, Math.cos(a) * 9); shot(W);
  ok(e.hp < e.maxhp, 'наводка не довернула на врага в 20°');
  const W2 = mk(); const e2 = foe(W2, 0, -9); shot(W2);
  ok(e2.hp < e2.maxhp, 'лук выстрелил мимо врага за спиной в пределах дальности');
  const W3 = mk(); const e3 = foe(W3, 0, -(TRAITS.bow.range + 3)); shot(W3, 1.5);
  ok(e3.hp === e3.maxhp, 'лук довернул на врага дальше дальности');
}
// ---------- 5. заряд: дальше и сильнее ----------
{
  const H = CFG3.player.heavy, far = TRAITS.bow.range + 3;
  const W = mk(); const e = foe(W, 0, far); freeze(W);
  run(W, H.hold + H.full + .1, i => { freeze(W); return { attack: true, attackPress: i === 0 }; }); run(W, 1.6, () => { freeze(W); return {}; });
  ok(e.hp < e.maxhp, 'заряженная стрела не долетела дальше обычной');
  // урон стрел по флагу заряда (зажатая кнопка сначала даёт обычный выстрел, потом заряженный)
  const arrows = { 0: [], 1: [] };
  for (let s = 0; s < 6; s++) { const V = mk('w_bow_iron', 10 + s); foe(V, 0, 6); const seen = new Set();
    run(V, H.hold + H.full + .1 + 1, i => { freeze(V); for (const q of V.proj) if (q.friendly && !seen.has(q)) { seen.add(q); arrows[q.hk > 0 ? 1 : 0].push(q.dmg); } return { attack: i < (H.hold + H.full + .1) * 60, attackPress: i === 0 }; }); }
  const avg = a => a.reduce((x, y) => x + y, 0) / (a.length || 1), n = avg(arrows[0]), c = avg(arrows[1]);
  ok(arrows[1].length >= 5 && c > n * 1.8, `заряд не сильнее: обычная ${n.toFixed(1)}, заряженная ${c.toFixed(1)} (${arrows[1].length})`);
}
// ---------- 6. арбалет пробивает одного врага насквозь, лук — нет ----------
{
  const W = mk('w_crossbow_iron'); const e1 = foe(W, 0, 5), e2 = foe(W, 0, 9); shot(W);
  ok(e1.hp < e1.maxhp && e2.hp < e2.maxhp, 'болт не пробил первого врага');
  const W2 = mk('w_bow_iron'); const f1 = foe(W2, 0, 5), f2 = foe(W2, 0, 9); shot(W2);
  ok(f1.hp < f1.maxhp && f2.hp === f2.maxhp, 'стрела лука пробила врага');
}
// ---------- 7. ближнее оружие по-прежнему бьёт без стрел ----------
{
  const W = mk('w_sword_iron'); W.hero = 'thorn'; const e = foe(W, 0, 1.6); shot(W, .8);
  ok(e.hp < e.maxhp && !W.proj.some(q => q.friendly), 'меч выпустил стрелу или не ударил');
}

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Стрельба 3D: OK');
