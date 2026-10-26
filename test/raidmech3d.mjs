// Механики рейдов (план подземелий, этап 4а и 4г): у каждого босса рейда — механика на отряд: «разойдись» (метки на бойцах, взрыв
// задевает соседей), «соберись» (урон делится на всех в круге, один — получает всё), «по танку» (сильный удар только по цели босса);
// метки ходят за бойцом; боты отряда сбегаются в круг «соберись» и расходятся от меченого; финалы всех рейдов — со второй стадией.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnBoss, spawnAlly, killEnemy } from '../3d/src/sim.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const S = CFG3.bosses.sig, RAIDS = CFG3.dungeons.list.filter(d => d.inst && d.raid), RAID = ['spread', 'stack', 'buster'];
// данные
for (const d of RAIDS) { const bs = CFG3.bosses.list.filter(b => b.level === d.id), kinds = new Set();
  for (const b of bs) { const k = ((S[b.type] && S[b.type].attacks) || []).filter(a => RAID.includes(a.kind)); ok(k.length || (b.attacks || []).some(a => a.kind === 'cast'), `${d.id}/${b.type}: нет механики на отряд`); k.forEach(a => kinds.add(a.kind)); }     // «прерви» — каст, сбиваемый тяжёлым ударом
  ok(RAID.every(k => kinds.has(k)), `${d.id}: не все механики (${[...kinds]})`);
  const f = bs.find(b => b.final); ok(f && S[f.type] && S[f.type].stage2 && S[f.type].stage2.attacks.length >= 4, `${d.id}: у финала нет второй стадии`); }
// стенд: босс с одной механикой, герой и трое бойцов рядом
const mk = (atk, crowd = true) => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.map.places = []; c.bosses.list = []; c.events.on = false; c.wanderer.on = false;
  c.bosses.sig = { gatebeast: { attacks: [atk] } }; c.bosses.phaseMoves = null;
  const W = createWorld(c, mulberry32(4)), p = W.player; W.lv = 60; p.hp = p.maxhp = 1e6; p.inv = 0;
  const al = crowd ? [0, 1, 2].map(i => { const a = spawnAlly(W, 'soldier'); a.hp = a.maxhp = 1e6; a.x = p.x + (i - 1) * .8; a.z = p.z + .6; return a; }) : [];
  const e = spawnBoss(W, { type: 'gatebeast', x: p.x + 7, z: p.z, attacks: [], phases: [] }); e.alert = true; e.b.cd = 0; return { W, p, e, al }; };
const run = (W, sec, f) => { for (let i = 0; i < Math.round(sec * 60); i++) { if (f && f(i)) return true; step(W, 1 / 60, {}); } return false; };
const hold = (p, al, x, z) => () => { p.x = x; p.z = z; p.vx = p.vz = 0; };
// «соберись»: урон делится; один получает всё
{ const A = { kind: 'stack', name: 'т', wind: .3, r: 3, arm: 1, mul: 6, cd: 99, range: 99 };
  const one = mk(A, false), x0 = one.p.x, z0 = one.p.z; run(one.W, .5, hold(one.p, [], x0, z0)); const z1 = (one.W.bzones || []).find(z => z.stack); ok(z1, '«соберись»: нет метки');
  const h0 = one.p.hp; run(one.W, 2, hold(one.p, [], x0, z0)); const solo = h0 - one.p.hp;
  const grp = mk(A, true); for (const a of grp.al) { a.x = grp.p.x + .4; a.z = grp.p.z; } run(grp.W, .5, hold(grp.p, grp.al, grp.p.x, grp.p.z)); const zz = (grp.W.bzones || []).find(z => z.stack); if (zz) zz.follow = 'p';
  const h1 = grp.p.hp; run(grp.W, 2, () => { grp.p.vx = grp.p.vz = 0; }); const shared = h1 - grp.p.hp;
  ok(solo > 0 && shared > 0 && shared < solo * .6, `«соберись»: один ${solo}, в группе ${shared} — урон не делится`); }
// «разойдись»: метки ходят за бойцами; сосед в радиусе получает урон
{ const { W, p, al } = mk({ kind: 'spread', name: 'т', wind: .3, n: 4, r: 3, arm: 1.2, mul: 2, cd: 99, range: 99 }, true);
  run(W, .5); const Z = (W.bzones || []).filter(z => z.spread); ok(Z.length >= 3, '«разойдись»: меток меньше 3: ' + Z.length);
  const zp = Z.find(z => z.follow === 'p'); if (zp) { p.x += 2; run(W, .05); ok(Math.abs(zp.x - p.x) < .2, '«разойдись»: метка не идёт за героем'); } }
// боты: в круг «соберись» сбегаются, меченый «разойдись» — прочь от соседей
{ const { W, p, al } = mk({ kind: 'stack', name: 'т', wind: .3, r: 3, arm: 4, mul: 6, cd: 99, range: 99 }, true);
  for (const [i, a] of al.entries()) { a.x = p.x + 7 + i; a.z = p.z - 6; } run(W, .4, () => { p.vx = p.vz = 0; }); const z = (W.bzones || []).find(q => q.stack); if (z) { z.follow = 'p'; }
  run(W, 3, () => { p.vx = p.vz = 0; }); const inside = al.filter(a => Math.hypot(a.x - p.x, a.z - p.z) < 3).length; ok(inside >= 2, `боты не сбежались в круг «соберись»: ${inside} из 3`); }
{ const { W, p, al } = mk({ kind: 'spread', name: 'т', wind: .3, n: 1, r: 3, arm: 4, mul: 2, cd: 99, range: 99 }, true);
  run(W, .4); const z = (W.bzones || []).find(q => q.spread); if (z) { z.follow = al[1].id; z.x = al[1].x; z.z = al[1].z; }
  const near0 = Math.min(...[p, al[0], al[2]].map(o => Math.hypot(o.x - al[1].x, o.z - al[1].z))); run(W, 2.5, () => { p.vx = p.vz = 0; });
  const near1 = Math.min(...[p, al[0], al[2]].map(o => Math.hypot(o.x - al[1].x, o.z - al[1].z))); ok(near1 > near0 + 1, `меченый боец не отошёл: ${near0.toFixed(1)} → ${near1.toFixed(1)}`); }
// «по танку»: бьёт только цель
{ const { W, p, al } = mk({ kind: 'buster', name: 'т', wind: .3, r: 1.2, arm: 0, mul: 4, cd: 99, range: 99 }, true);
  for (const a of al) { a.x = p.x + .3; a.z = p.z + .3; } run(W, 2, () => (W.bzones || []).some(q => q.single)); const z = (W.bzones || []).find(q => q.single); ok(z, '«по танку»: нет метки');
  if (z) { z.follow = 'p'; const hp = al.map(a => a.hp), h0 = p.hp; run(W, 1, () => { p.vx = p.vz = 0; for (const a of al) { a.x = p.x + .3; a.z = p.z + .3; } return !W.bzones.includes(z); }); step(W, 1 / 60, {});
    ok(p.hp < h0 && al.every((a, i) => a.hp >= hp[i]), `«по танку»: задело не только цель (герой ${h0 - p.hp}, бойцы ${al.map((a, i) => hp[i] - a.hp)})`); } }
// вторая стадия финала рейда
{ const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; const W = createWorld(c, mulberry32(2)), p = W.player; W.lv = 60;
  for (const t of ['oldoak', 'drowngod', 'hand_lord']) { const def = CFG3.bosses.list.find(b => b.type === t); const e = spawnBoss(W, { ...def, x: p.x + 8, z: p.z }); killEnemy(W, e, 1); ok(!e.dead && e.stage === 2, `${t}: нет второй стадии`); killEnemy(W, e, 1); ok(e.dead, `${t}: вторая стадия не умирает`); } }

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Механики рейдов 3D: OK');
