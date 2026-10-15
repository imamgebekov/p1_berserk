// Тест второй руки 3D (шаг B2b): щиты в каталоге и добыче, щит — только Торну, второй клинок — только Вейлу;
// щит снимает урон и отброс спереди (не сзади и не во время удара), второй клинок добавляет урон и чередует руки;
// сохранение второй руки и проверка при загрузке (чужое — в сумку).
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnEnemy, refreshGear, hurtPlayer } from '../3d/src/sim.js';
import { CATALOG, BY_ID, SLOTS } from '../3d/src/data/items.js';
import { CONTAINERS, SHOP } from '../3d/src/data/loot.js';
import { equipAt, equipOff, addItem, serialize, deserialize } from '../3d/src/inv.js';
import { canWield, canOff } from '../3d/src/data/heroes3d.js';
import { templateOf } from '../3d/src/itemicons.js';
import { createSaver, loadSave } from '../3d/src/save3d.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const clone = () => JSON.parse(JSON.stringify(CFG3));
const mk = (hero, eq = {}, seed = 1) => {
  const c = clone(); c.enemies.count = 0; c.bosses.list = []; c.map.places = []; c.events.on = false; c.wanderer.on = false; c.ambient.on = false;
  const W = createWorld(c, mulberry32(seed)); W.hero = hero; Object.assign(W.inv.eq, eq); refreshGear(W);
  Object.assign(W.player, { x: 40, z: 40, face: 0 }); W.player.hp = W.player.maxhp; return W;
};
const mem = () => { const o = {}; return { getItem: k => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); }, removeItem: k => { delete o[k]; }, o }; };
const SH = 's_tower_iron', BU = 's_buckler_iron';

// ---------- 1. каталог и правила ----------
{
  const S = CATALOG.filter(i => i.slot === 'offhand');
  ok(SLOTS.includes('offhand') && S.length === 8 && S.every(i => i.kind === 'shield' && i.pool === 'shield' && i.stats.block > 0 && templateOf(i) === 'offhand'), `щитов ${S.length}`);
  const has = d => d.pools.some(p => p[0] === 'shield' && p[1] > 0);
  ok(has(CONTAINERS.armorstand) && has(CONTAINERS.ironchest) && has(SHOP), 'щиты не выпадают или не продаются');
  ok(canWield('thorn', BY_ID[SH]) && !canWield('vale', BY_ID[SH]) && !canWield('jay', BY_ID[SH]), 'щит не только Торну');
  ok(canOff('vale', BY_ID.w_rapier_iron) && !canOff('thorn', BY_ID.w_sword_iron) && !canOff('vale', BY_ID.w_axe_iron) && !canOff('jay', BY_ID.w_dagger_iron), 'второй клинок не только Вейлу и не только лёгкий');
  const T = mk('thorn'); addItem(T.inv, SH, 1, 30); ok(equipAt(T.inv, 0, 'thorn') && T.inv.eq.offhand === SH, 'Торн не надел щит');
  const V = mk('vale'); addItem(V.inv, SH, 1, 30); ok(!equipAt(V.inv, 0, 'vale') && !V.inv.eq.offhand, 'Вейл надел щит');
  addItem(V.inv, 'w_dagger_iron', 1, 30); const di = V.inv.bag.findIndex(s => s.id === 'w_dagger_iron');
  ok(equipOff(V.inv, di, 'vale') && V.inv.eq.offhand === 'w_dagger_iron' && !V.inv.eq.weapon, 'Вейл не взял кинжал во вторую руку');
  const T2 = mk('thorn'); addItem(T2.inv, 'w_sword_iron', 1, 30); ok(!equipOff(T2.inv, 0, 'thorn'), 'Торн взял меч во вторую руку');
}
// ---------- 2. характеристики ----------
{
  const T = mk('thorn', { offhand: SH }); ok(T.gear.block === BY_ID[SH].stats.block && T.gear.armor === BY_ID[SH].stats.armor, 'щит не дал блок или броню');
  const V0 = mk('vale', { weapon: 'w_rapier_iron' }), V = mk('vale', { weapon: 'w_rapier_iron', offhand: 'w_dagger_iron' });
  ok(V.gear.dmg === V0.gear.dmg, 'второй клинок попал в сумму урона экипировки');
}
// ---------- 3. блок щитом ----------
{
  const hit = (W, fromAng, state) => { const p = W.player; p.hp = p.maxhp; p.inv = 0; p.vx = p.vz = 0; p.state = state || 'idle'; W.ev.length = 0; hurtPlayer(W, 40, p.x + Math.sin(fromAng) * 2, p.z + Math.cos(fromAng) * 2); return { dmg: p.maxhp - p.hp, v: Math.hypot(p.vx, p.vz), ev: W.ev.some(v => v.k === 'block' && v.hero) }; };
  const W = mk('thorn', { offhand: SH }), front = hit(W, 0), back = hit(W, Math.PI), side = hit(W, Math.PI * .3), busy = hit(W, 0, 'atk');
  const exp = Math.round(back.dmg * (1 - BY_ID[SH].stats.block / 100));
  ok(front.ev && Math.abs(front.dmg - exp) <= 1, `спереди урон ${front.dmg}, ждали ~${exp} (сзади ${back.dmg})`);
  ok(!back.ev && back.dmg > front.dmg && side.ev, 'щит закрывает спину или не закрывает бок в пределах дуги');
  ok(front.v < back.v * .6, 'блок не уменьшил отброс');
  ok(!busy.ev && busy.dmg === back.dmg, 'щит закрывает во время удара');
  const N = mk('thorn'), none = hit(N, 0); ok(!none.ev, 'без щита есть блок');
}
// ---------- 4. второй клинок ----------
{
  const dealt = (eq, seed) => { const W = mk('vale', eq, seed); const e = spawnEnemy(W, 'brute', 40, 41.4); e.hp = e.maxhp = 1e5; e.cd = 99; const hands = [];
    for (let i = 0; i < 60 * 6; i++) { e.x = 40; e.z = 41.4; e.vx = e.vz = 0; e.state = 'rec'; e.t = -1e9; const was = W.player.state; step(W, 1 / 60, { attackPress: i % 20 === 0 }); if (was !== 'atk' && W.player.state === 'atk') hands.push(W.player.hand); }
    return { d: e.maxhp - e.hp, hands, swing: W.player.swingMul }; };
  let one = 0, two = 0, hands = [], sw1 = 0, sw2 = 0;
  for (let s = 0; s < 3; s++) { const a = dealt({ weapon: 'w_rapier_iron' }, 5 + s), b = dealt({ weapon: 'w_rapier_iron', offhand: 'w_dagger_iron' }, 5 + s); one += a.d; two += b.d; hands = hands.concat(b.hands); sw1 = a.swing; sw2 = b.swing; }
  ok(two > one * 1.12, `второй клинок не добавил урона: ${one} → ${two}`);
  ok(hands.includes(0) && hands.includes(1), 'руки не чередуются: ' + hands.join(''));
  ok(sw2 < sw1, 'с двумя клинками удары не быстрее');
}
// ---------- 5. сохранение и проверка при загрузке ----------
{
  const T = mk('thorn', { weapon: 'w_sword_iron', offhand: SH }), st = mem(); createSaver(T, st).write(true);
  const s = loadSave(30, st); ok(s && s.inv.eq.offhand === SH, 'щит не сохранился');
  const V = mk('vale', { weapon: 'w_rapier_iron', offhand: 'w_dagger_iron' }), st2 = mem(); createSaver(V, st2).write(true);
  const s2 = loadSave(30, st2); ok(s2 && s2.inv.eq.offhand === 'w_dagger_iron', 'второй клинок не сохранился');
  const d = JSON.parse(st2.o['berserk3d.save']); d.hero = 'thorn'; d.inv.eq.weapon = null; st2.setItem('berserk3d.save', JSON.stringify(d));
  const s3 = loadSave(30, st2); ok(s3 && !s3.inv.eq.offhand && s3.inv.bag.some(b => b.id === 'w_dagger_iron'), 'клинок во второй руке Торна не ушёл в сумку');
  const inv = deserialize({ ...serialize(T.inv), eq: { offhand: SH } }, 30, 'vale'); ok(!inv.eq.offhand && inv.bag.some(b => b.id === SH), 'щит у Вейла не ушёл в сумку');
  const inv2 = deserialize({ eq: { offhand: BU } }, 30); ok(inv2.eq.offhand === BU, 'старое сохранение без героя потеряло щит');
}

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Вторая рука 3D: OK');
