// Малые миры (2026-10-27): пробное подземелье — свободный мир под открытым небом ~1/14 большого, зоны по боссам, ворота за боссом.
// Все зоны и карманы достижимы по порядку (трещина — ударом, ключ — из сундука, ворота — после босса); вход, боссы, сундуки, костёр,
// события, рычаги и враги — на земле; ворота открываются, когда босс убит; карта открыта; герой не выходит за край; без метки — прежнее.
import { CFG3 } from '../3d/src/config3d.js';
import { resolve, keepIn } from '../3d/src/map.js';
import { wildSdfAt, navArea, navStep } from '../3d/src/wilds3d.js';
import { createWorld, step, mulberry32, killEnemy } from '../3d/src/sim.js';
import { travel } from '../3d/src/levels3d.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const X = CFG3.dungeons.wild, id = X.only[0];
const mk = on => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.events.on = false; c.wanderer.on = false; c.dungeons.wild.on = on; return createWorld(c, mulberry32(11)); };
const stats = [];
for (let k = 0; k < 4; k++) {
  const W = mk(true), d = W.cfg.dungeons.list.find(q => q.id === id); W.genN = k * 5;
  travel(W, id, d.entry.x, d.entry.z); step(W, 1 / 60, {});
  const L = W.levels[id], M = L.map, def = L.def, tag = `${id}#${k}`, R = W.cfg.player.radius;
  ok(!!M.sdf && !M.rooms.length, tag + ': не свободный мир');
  ok(L.seen.every(v => v === 1), tag + ': карта не открыта');
  // достижимость по порядку: трещина — сразу, ключ — из сундука в достижимой области, ворота — когда босс в достижимой области
  const A = M.nav.areas, Lk = M.nav.links, bosses = W.enemies.filter(e => e.boss), seen = new Set([navArea(M, def.entry.x, def.entry.z)]);
  for (let grew = true; grew;) { grew = false;
    for (const l of Lk) { const dd = l.door >= 0 ? M.doors[l.door] : null, can = !dd || dd.crack || (dd.gate ? bosses.some(b => b.type === dd.gate && seen.has(navArea(M, b.x, b.z))) : M.containers.some(c => c.key === dd.lock && seen.has(navArea(M, c.x, c.z))));
      if (!can) continue; for (const [a, b] of [[l.a, l.b], [l.b, l.a]]) if (seen.has(a) && !seen.has(b)) { seen.add(b); grew = true; } } }
  ok(seen.size === A.length, `${tag}: достижимо ${seen.size} из ${A.length} областей`);
  const nb = W.cfg.bosses.list.filter(b => b.level === id).length, gates = M.doors.filter(q => q.gate);
  ok(bosses.length === nb, `${tag}: боссов ${bosses.length} из ${nb}`);
  ok(gates.length === nb - 1, `${tag}: ворот ${gates.length}, ждём ${nb - 1}`);
  const pts = [['вход', def.entry], ['костёр', def.fire], ...M.containers.map(c => ['сундук ' + c.kind, c]), ...M.events.map(e => ['событие ' + e.kind, e]), ...M.traps.map(q => ['рычаг', q.lever]), ...bosses.map(b => ['босс ' + b.type, b])].filter(p => p[1]);
  const bad = pts.filter(([n, p]) => wildSdfAt(M, p.x, p.z) < R || (!n.startsWith('событие') && M.solids.some(s => Math.hypot(s.x - p.x, s.z - p.z) < s.r + .3))); ok(!bad.length, `${tag}: не на земле или в препятствии: ${bad.map(b => b[0]).join(', ')}`);     // в центре испытания — алтарь
  const foes = W.enemies.filter(e => !e.boss && !e.dead), out = foes.filter(e => wildSdfAt(M, e.x, e.z) < 0); ok(!out.length, `${tag}: враги за краем (${out.length})`);
  ok(foes.length >= 30 && foes.length <= 160, `${tag}: врагов ${foes.length}, ждём 30–160`);
  // ворота: первый босс убит — его ворота отперты; путь врага через проход есть
  const g0 = gates[0], b0 = bosses.find(b => b.type === g0.gate); killEnemy(W, b0, 1); if (!b0.dead) killEnemy(W, b0, 1); step(W, 1 / 60, {});
  ok(!g0.locked, `${tag}: ворота за ${b0.type} не открылись`);
  const lnk = Lk.find(l => l.door === M.doors.indexOf(g0)), from = A[lnk.a], to = A[lnk.b], wp = navStep(M, from.x, from.z, to.x, to.z);
  ok(!!wp, `${tag}: нет пути через открытые ворота`);
  // за край не выйти
  const p = W.player; p.x = def.entry.x; p.z = def.entry.z; for (let i = 0; i < 200; i++) { p.x -= .3; resolve(M, p, R); keepIn(M, p, 0); } ok(wildSdfAt(M, p.x, p.z) > 0, tag + ': герой вышел за край мира');
  const B = M.bounds, area = (B.x1 - B.x0) * (B.z1 - B.z0), want = Math.PI * W.cfg.world.radius ** 2 / 14;
  stats.push(`${Math.round(B.x1 - B.x0)}×${Math.round(B.z1 - B.z0)} м (${(area / want).toFixed(2)} от 1/14), зон ${M.wild.zones.length}, карманов ${M.wild.pockets.length}, врагов ${foes.length}, ворот ${gates.length}, ловушек ${M.traps.length}, препятствий ${M.solids.length}`);
  ok(area > want * .45 && area < want * 1.8, `${tag}: размер ${(area / want).toFixed(2)} от 1/14 мира`);
}
{ const W = mk(false), d = W.cfg.dungeons.list.find(q => q.id === id); travel(W, id, d.entry.x, d.entry.z); ok(!W.levels[id].map.wild, 'без метки подземелье стало миром'); }
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Малые миры 3D: OK (' + stats.join('; ') + ')');
