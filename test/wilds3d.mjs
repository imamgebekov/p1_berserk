// Малые миры (2026-10-27): пробное подземелье — мир под открытым небом ~1/14 большого. Все поляны и тропы связаны, залы не перекрываются,
// ключи достижимы, тропы виляют, у края полян — валуны и деревья, но не на входе, боссах и сундуках; враги и боссы — на полянах;
// герой не выходит за край; без метки подземелье прежнее.
import { CFG3 } from '../3d/src/config3d.js';
import { roomAt, solveLocks, resolve, keepIn } from '../3d/src/map.js';
import { createWorld, step, mulberry32 } from '../3d/src/sim.js';
import { travel } from '../3d/src/levels3d.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const X = CFG3.dungeons.wild, id = X.only[0];
const mk = on => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.events.on = false; c.wanderer.on = false; c.dungeons.wild.on = on; return createWorld(c, mulberry32(11)); };
const stats = [];
for (let k = 0; k < 3; k++) {
  const W = mk(true), d = W.cfg.dungeons.list.find(q => q.id === id); W.genN = k * 5;
  travel(W, id, d.entry.x, d.entry.z); step(W, 1 / 60, {});
  const L = W.levels[id], M = L.map, def = L.def, tag = `${id}#${k}`;
  ok(!!M.wild, tag + ': не мир (map.wild нет)');
  const seen = new Set([0]), q = [0]; while (q.length) { const r = q.shift(); for (const li of M.adj[r]) { const l = M.links[li], o = l.a === r ? l.b : l.a; if (!seen.has(o)) { seen.add(o); q.push(o); } } }
  ok(seen.size === M.rooms.length, `${tag}: связано ${seen.size} из ${M.rooms.length}`);
  let over = 0; for (let a = 0; a < M.rooms.length; a++) for (let b = a + 1; b < M.rooms.length; b++) { const A = M.rooms[a], B = M.rooms[b]; if (Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0) > .01 && Math.min(A.z1, B.z1) - Math.max(A.z0, B.z0) > .01) over++; }
  ok(!over, `${tag}: перекрытий ${over}`);
  const S = solveLocks(M, def.entry.x, def.entry.z, ['crack']); ok(S.all, `${tag}: не всё достижимо с ключами (${S.rooms} из ${M.rooms.length})`);     // трещина открывается ударом
  const bends = M.rooms.filter(r => /_\d+$/.test(r.id)).length; ok(bends >= 10, `${tag}: тропы не виляют (колен ${bends})`);
  const edges = def.props.filter(p => p.t === 'w_tree' || p.t === 'w_rock'); ok(edges.length >= 100, `${tag}: у края полян мало валунов и деревьев (${edges.length})`);
  const busy = [def.entry, def.fire, ...def.chests, ...W.enemies.filter(e => e.boss)].filter(Boolean);
  const hit = busy.filter(b => edges.some(p => Math.hypot(p.x - b.x, p.z - b.z) < p.r + .5)); ok(!hit.length, `${tag}: валун на входе, боссе или сундуке (${hit.length})`);
  const foes = W.enemies.filter(e => !e.dead), out = foes.filter(e => roomAt(M, e.x, e.z) < 0); ok(!out.length, `${tag}: враги вне полян (${out.length})`);
  ok(foes.length >= 30 && foes.length <= 160, `${tag}: врагов ${foes.length}, ждём 30–160`);
  ok(W.enemies.filter(e => e.boss).length === W.cfg.bosses.list.filter(b => b.level === id).length, tag + ': не все боссы на месте');
  const B = M.bounds, area = (B.x1 - B.x0) * (B.z1 - B.z0), want = Math.PI * W.cfg.world.radius ** 2 / 14; stats.push(`${Math.round(B.x1 - B.x0)}×${Math.round(B.z1 - B.z0)} м (${(area / want).toFixed(2)} от 1/14), полян ${M.rooms.filter(r => !r.corridor).length}, врагов ${foes.length}, ворот ${M.doors.filter(x => !x.crack).length}, ловушек ${M.traps.length}`);
  ok(area > want * .5 && area < want * 1.6, `${tag}: размер ${(area / want).toFixed(2)} от 1/14 мира`);
  // за край не выйти: герой у стены, толкаем наружу
  const p = W.player, r0 = M.rooms[0]; p.x = r0.x0 + .3; p.z = (r0.z0 + r0.z1) / 2; for (let i = 0; i < 30; i++) { p.x -= .3; resolve(M, p, W.cfg.player.radius); keepIn(M, p, 0); } ok(roomAt(M, p.x, p.z) >= 0, tag + ': герой вышел за край мира');
}
// без метки — прежнее подземелье
{ const W = mk(false), d = W.cfg.dungeons.list.find(q => q.id === id); travel(W, id, d.entry.x, d.entry.z); ok(!W.levels[id].map.wild, 'без метки подземелье стало миром'); }
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Малые миры 3D: OK (' + stats.join('; ') + ')');
