// Лагеря врагов (план «живой мир», этап 4, владелец 2026-10-28): врагов много, но они стоят группами и не нападают все разом.
// Проверяем: группы у шатров далеко друг от друга, вожак с охраной в середине; тревога поднимает только свою группу;
// рог вожака зовёт ещё одну группу, не весь лагерь; за разгром — добыча у костра и событие, лагерь заселится нескоро.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, killEnemy } from '../3d/src/sim.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const GC = CFG3.enemies.garrison.camp, M = CFG3.map;
const mk = f => { const W = createWorld(CFG3, mulberry32(5)); W.player.maxhp = W.player.hp = 1e9; W.player.x = f.x; W.player.z = f.z + f.H + 20; for (let i = 0; i < 30; i++) step(W, 1 / 30, {}); return W; };
const groups = (W, f) => { const g = {}; for (const e of W.enemies) if (e.garr === f.id && !e.dead) (g[e.grp] || (g[e.grp] = [])).push(e); return g; };
const mid = a => ({ x: a.reduce((s, e) => s + e.x, 0) / a.length, z: a.reduce((s, e) => s + e.z, 0) / a.length });
const near = (W, x, z) => { W.player.x = x; W.player.z = z; for (let i = 0; i < 30; i++) step(W, 1 / 30, {}); };
let total = 0, gmin = 99;
for (const f of M.forts.slice(0, 3)) {
  const W = mk(f), G = groups(W, f), keys = Object.keys(G), tag = f.id;
  ok(keys.length >= GC.groups[0] && keys.length <= GC.groups[1], `${tag}: групп ${keys.length}`);
  const chief = W.enemies.filter(e => e.garr === f.id && e.chief); ok(chief.length === 1 && chief[0].grp.endsWith(':0'), `${tag}: вожак не в своей группе`);
  ok(G[f.id + ':0'] && G[f.id + ':0'].length === 1 + GC.guards, `${tag}: у вожака охраны ${G[f.id + ':0'] ? G[f.id + ':0'].length - 1 : 0}`);
  for (const k of keys) if (!k.endsWith(':0')) ok(G[k].length >= GC.size[0] && G[k].length <= GC.size[1], `${tag}: в группе ${k} ${G[k].length}`);
  const C = keys.map(k => mid(G[k]));
  for (let i = 0; i < C.length; i++) for (let j = i + 1; j < C.length; j++) { const d = Math.hypot(C[i].x - C[j].x, C[i].z - C[j].z); gmin = Math.min(gmin, d); ok(d > 9, `${tag}: группы ${i} и ${j} рядом (${d.toFixed(1)} м)`); }
  total += Object.values(G).reduce((s, a) => s + a.length, 0);
  // тревога в обычной группе: встаёт вся группа, остальные стоят
  { const k = keys.find(q => !q.endsWith(':0')), c = mid(G[k]), dx = c.x - f.x, dz = c.z - f.z, L = Math.hypot(dx, dz); near(W, c.x + dx / L * 3, c.z + dz / L * 3); G[k][0].alert = true;
    for (let i = 0; i < 15; i++) step(W, 1 / 30, {});
    ok(G[k].every(e => e.alert), `${tag}: группа не встала целиком`);
    const other = keys.filter(q => q !== k && G[q].some(e => e.alert)); ok(!other.length, `${tag}: встали и чужие группы: ${other.join(', ')}`); }
  // рог вожака: встаёт ещё одна группа, не весь лагерь
  { const W2 = mk(f), G2 = groups(W2, f), K2 = Object.keys(G2), ch = G2[f.id + ':0'];
    near(W2, f.x, f.z + 3); ch[0].alert = true; let horn = false;
    for (let i = 0; i < 15; i++) { step(W2, 1 / 30, {}); if (W2.ev.some(v => v.k === 'horn')) horn = true; }
    const up = K2.filter(q => G2[q].some(e => e.alert));
    ok(horn && up.length === 2, `${tag}: после рога встало групп ${up.length} (рог ${horn})`); }
  // разгром: все убиты — добыча у костра, событие, лагерь заселится нескоро
  { const W3 = mk(f), all = W3.enemies.filter(e => e.garr === f.id && !e.dead), d0 = W3.drops.length; let done = false;
    for (const e of all) { killEnemy(W3, e, 1); if (W3.ev.some(v => v.k === 'campDone')) done = true; }
    const loot = W3.drops.slice(d0).filter(q => !q.corpse && Math.hypot(q.x - f.x, q.z - f.z) < 6);
    ok(done && loot.length >= 1, `${tag}: за разгром нет награды (событие ${done}, вещей ${loot.length})`);
    ok(W3.garr[f.id] >= W3.t + GC.respawn - 1, `${tag}: лагерь заселится слишком скоро`); }
}
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log(`Лагеря врагов 3D: OK (врагов в 3 лагерях ${total}, ближние группы в ${gmin.toFixed(1)} м)`);
