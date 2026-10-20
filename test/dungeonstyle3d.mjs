// Облик подземелий (3.79): залы крупнее, формы (круг, восьмигранник, колонны, провал), наполненность, боссы мощнее.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32 } from '../3d/src/sim.js';
import { makeLevelMap, roomFree, resolve } from '../3d/src/map.js';
import { travel } from '../3d/src/levels3d.js';
import { styleDef, shapeFree } from '../3d/src/dungeonstyle3d.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const S = CFG3.dungeons.style, L = CFG3.dungeons.list;
// 1. формы есть всех видов, у каждого подземелья с большими залами — хотя бы одна
const all = L.flatMap(d => d.rooms.filter(r => r.shape).map(r => r.shape));
for (const k of ['round', 'oct', 'pillars', 'pit']) ok(all.includes(k), 'нет формы ' + k);
for (const f of ['empty', 'normal', 'full']) ok(L.some(d => d.rooms.some(r => r.fill === f)), 'нет наполненности ' + f);
ok(L.every(d => d.styled), 'не все подземелья оформлены');
// 2. масштаб: зал входа Катакомб 10×8 → 13×10.4; повторный styleDef ничего не меняет
{ const d = L.find(q => q.id === 'inst_brod'), h = d.rooms.find(r => r.id === 'hall'); ok(Math.abs(h.w - 10 * S.scale) < 1e-9 && Math.abs(h.d - 8 * S.scale) < 1e-9, 'зал не в масштабе');
  const w0 = h.w; styleDef(CFG3, d); ok(h.w === w0, 'масштаб применён дважды'); }
// 3. в каждом зале с формой: центр свободен, точки внутри круга свободны, углы — в стене
for (const d of L) { const M = makeLevelMap(CFG3, d);
  for (const r of M.rooms.filter(q => q.shape)) {
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2, o = { x: cx, z: cz }; resolve(M, o, .5);
    ok(Math.hypot(o.x - cx, o.z - cz) < 1e-6 && roomFree(r, cx, cz, .5), `${d.id}/${r.id}: центр занят`);
    if (r.shape === 'round' || r.shape === 'oct') { const c = { x: r.x0 + .3, z: r.z0 + .3 }; resolve(M, c, .4); ok(Math.hypot(c.x - r.x0 - .3, c.z - r.z0 - .3) > .5, `${d.id}/${r.id}: угол ${r.shape} проходим`); }
    if (r.shape === 'pit') ok(M.pits.length >= 4, `${d.id}/${r.id}: нет провалов`);
    if (r.shape === 'pillars') ok(M.pillars.length >= 6, `${d.id}/${r.id}: нет колонн`);
  }
  for (const c of M.containers) { const ri = M.rooms.findIndex(r => c.x >= r.x0 && c.x <= r.x1 && c.z >= r.z0 && c.z <= r.z1); ok(ri >= 0 && roomFree(M.rooms[ri], c.x, c.z, .3), `${d.id}: сундук ${c.kind} в стене формы`); }
}
// 4. враги появляются внутри формы; боссы подземелий крепче, отключение — прежняя сила
{ const mk = f => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.events.on = false; c.wanderer.on = false; if (f) f(c); return createWorld(c, mulberry32(3)); };
  const W = mk();
  for (const d of L.filter(q => q.inst)) { travel(W, d.id, d.entry.x, d.entry.z); step(W, 1 / 60, {});
    for (const e of W.enemies.filter(q => !q.boss)) { const r = W.map.rooms.find(q => e.x >= q.x0 && e.x <= q.x1 && e.z >= q.z0 && e.z <= q.z1); ok(!r || roomFree(r, e.x, e.z, 0), `${d.id}: враг в стене формы (${e.x.toFixed(1)}, ${e.z.toFixed(1)})`); } }
  const W0 = mk(c => { c.dungeons.might.on = false; });
  const fin = W.cfg.bosses.list.find(b => b.inst && b.final), mini = W.cfg.bosses.list.find(b => b.inst && !b.final);
  for (const [b, k] of [[fin, CFG3.dungeons.might.boss.hp], [mini, CFG3.dungeons.might.mini.hp]]) {
    travel(W, b.level, b.x, b.z + 3); travel(W0, b.level, b.x, b.z + 3);
    const a = W.enemies.find(e => e.boss && e.type === b.type), z = W0.enemies.find(e => e.boss && e.type === b.type);
    ok(a && z && Math.abs(a.maxhp / z.maxhp - k) < .02, `${b.type}: здоровье ×${a && z ? (a.maxhp / z.maxhp).toFixed(2) : '?'}, нужно ×${k}`);
  }
  ok(CFG3.dungeons.might.boss.hp > 1 && CFG3.dungeons.might.mini.hp > 1, 'боссы подземелий не мощнее'); }
// 5. форма: точка за краем эллипса — не свободна
ok(!shapeFree({ x: 0, z: 0, w: 10, d: 10, shape: 'round' }, 4.6, 4.6) && shapeFree({ x: 0, z: 0, w: 10, d: 10, shape: 'round' }, 3, 3), 'проверка круга');
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.slice(0, 30).join('\n')); process.exit(1); }
console.log('Облик подземелий 3D: OK');
