// Вражеские лагеря и павшие города (2026-10-18): лагеря размером с наш — частокол с воротами, гарнизон с вожаком (мини-босс);
// города — каменные стены с воротами на четыре стороны, дома, капитаны стражи, свой босс (встаёт при подходе героя), золото в добыче;
// посёлки крупнее. Прежний мир не сдвинулся: боссы ядра на месте, при создании мира боссы городов не появляются.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32 } from '../3d/src/sim.js';
import { makeMap } from '../3d/src/map.js';
import { BOSS_DROPS } from '../3d/src/data/loot.js';
import { BY_ID } from '../3d/src/data/items.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const M = CFG3.map, F = CFG3.worldgen.forts, CI = CFG3.worldgen.cities;
const fo = M.forts.filter(q => q.id.startsWith('o'));     // мир ×2 (4.04): лагеря внешнего кольца — сверх прежних
ok((CFG3.world.center ? M.forts.length >= F.n * .8 : M.forts.length - fo.length === F.n && fo.length >= F.n) && M.cities.length === CI.n, `лагерей ${M.forts.length} (кольцо ${fo.length}), городов ${M.cities.length}`);
const map = makeMap(JSON.parse(JSON.stringify(CFG3)));
const inBlock = (x, z) => map.blocks.some(w => x > w.x0 && x < w.x1 && z > w.z0 && z < w.z1);
const SIDE = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] };
for (const c of [...M.forts, ...M.cities]) {
  const pl = M.places.find(p => p.id === c.id); ok(pl && pl.type === 'danger' && (pl.fort || pl.city), c.id + ': нет опасного места');
  for (const [side, [sx, sz]] of Object.entries(SIDE)) { const gx = c.x + sx * c.H, gz = c.z + sz * c.H, gate = (c.gates || Object.keys(SIDE)).includes(side);
    ok(gate ? !inBlock(gx, gz) : inBlock(gx, gz), `${c.id}: ${side} — ${gate ? 'ворота закрыты' : 'стены нет'}`); }
  ok(!map.buildings.some(b => Math.abs(b.x0 + (b.x1 - b.x0) / 2 - c.x) < c.H + 4 && Math.abs(b.z0 + (b.z1 - b.z0) / 2 - c.z) < c.H + 4) || !!c.gate && M.cities.includes(c), c.id + ': дом в лагере врагов');
}
for (const c of M.cities) { const n = M.buildings.filter(b => b.city === c.id).length; ok(n >= CI.houses - 2, `${c.id}: домов ${n}`); }
ok(CFG3.bosses.list.filter(b => b.city).length === CI.n && ['ashking', 'bonetyrant'].every(t => CFG3.enemies[t] && CFG3.enemies[t].boss && BOSS_DROPS[t] && BY_ID[BOSS_DROPS[t].trophy] && BOSS_DROPS[t].gold > 0), 'боссы городов не описаны');
ok(['devourer', 'lord', 'chief'].every(t => CFG3.bosses.list.some(b => b.type === t && !b.city)), 'боссы ядра пропали');
// мир: боссы городов при создании не появляются (поток случайных чисел боя прежний), встают при подходе
const mk = () => { const W = createWorld(CFG3, mulberry32(3)); W.player.maxhp = W.player.hp = 1e9; return W; };
{ const W = mk(); ok(!W.enemies.some(e => e.boss && ['ashking', 'bonetyrant'].includes(e.type)), 'босс города появился при создании мира');
  const c = M.cities[0], def = CFG3.bosses.list.find(b => b.city === c.id); W.player.x = c.x; W.player.z = c.z + c.H + 16;
  for (let i = 0; i < 60; i++) step(W, 1 / 30, {}); ok(W.enemies.some(e => e.boss && e.type === def.type), 'босс города не встал при подходе');
  const g = W.enemies.filter(e => e.garr === c.id && !e.dead), ch = g.filter(e => e.chief);
  ok(g.length === CFG3.enemies.garrison.n.city && ch.length === CFG3.enemies.garrison.chief.city[0] && ch.every(e => e.elite), `город: гарнизон ${g.length}, капитанов ${ch.length}`); }
// лагерь: гарнизон группами (этап 4 «живого мира»), один вожак — элита и крепче обычной элиты; в ворота можно войти
{ const W = mk(), f = M.forts[0]; W.player.x = f.x; W.player.z = f.z + f.H + 20;
  for (let i = 0; i < 30; i++) step(W, 1 / 30, {});
  const g = W.enemies.filter(e => e.garr === f.id && !e.dead), ch = g.filter(e => e.chief);
  const GC = CFG3.enemies.garrison.camp, nMin = 1 + GC.guards + (GC.groups[0] - 1) * GC.size[0], nMax = 1 + GC.guards + (GC.groups[1] - 1) * GC.size[1];
  ok(g.length >= nMin && g.length <= nMax && ch.length === 1 && ch[0].elite && ch[0].scaleMul > CFG3.elite.scale, `лагерь: гарнизон ${g.length}, вожаков ${ch.length}`); }
{ const W = mk(), f = M.forts[0], side = f.gates[0], [sx, sz] = SIDE[side]; W.enemies.length = 0; W.cfg.enemies.garrison = null;
  W.player.x = f.x + sx * (f.H + 4); W.player.z = f.z + sz * (f.H + 4);
  for (let i = 0; i < 150; i++) step(W, 1 / 30, { mx: -sx, mz: -sz });
  ok(Math.abs(W.player.x - f.x) < f.H - 1 && Math.abs(W.player.z - f.z) < f.H - 1, `в ворота лагеря не пройти: ${(W.player.x - f.x).toFixed(1)}, ${(W.player.z - f.z).toFixed(1)}`); }
// посёлки крупнее
{ const v = M.places.filter(p => p.type === 'hamlet' && p.gen), n = v.map(p => M.buildings.filter(b => b.vil === p.id).length); ok(n.reduce((a, b) => a + b, 0) / n.length >= 4, 'в посёлках мало домов: ' + n.join(',')); }

if (fails.length) { console.error('Лагеря и города 3D: ПРОВАЛ\n- ' + fails.join('\n- ')); process.exit(1); }
console.log(`Лагеря и города 3D: OK (лагерей ${M.forts.length}, городов ${M.cities.length})`);
