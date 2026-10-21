// Тест «мира ×2» (4.04): 2400 × 2400 м; прежний мир (до world.inner) — тот же, что строит генератор на прежнем радиусе;
// внешнее кольцо — за прежним краем, у каждой зоны стан с торговцем и кузнецом, у передового стана — книжница; уровни колец
// 60–70 и 70–80; места сбора и костры есть в кольце; туман старого сохранения ложится в новую сетку на свои места.
import { CFG3 } from '../3d/src/config3d.js';
import { allZones, zoneAt, zoneLevel } from '../3d/src/zones3d.js';
import { createWorld, mulberry32 } from '../3d/src/sim.js';
import { growSeen, packSeenChunks, unpackSeenChunks, seenSize } from '../3d/src/save3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const C = CFG3, Rin = C.world.inner, R = C.world.radius;
ok(R === 2 * Rin && R === 1200, 'мир не 2400 × 2400');
// прежний мир внутри прежнего края, кольцо — за ним (совпадение с прежней сборкой проверено сравнением при переходе на 4.04)
{
  const inner = C.map.places.filter(p => !p.id.startsWith('o')), outer = C.map.places.filter(p => p.id.startsWith('o'));
  ok(inner.every(p => Math.hypot(p.x, p.z) <= Rin), 'место прежнего мира за прежним краем');
  ok(outer.length > 150 && outer.every(p => Math.hypot(p.x, p.z) - (p.r || 0) > Rin + C.worldgen.outer.gap - 1e-6), 'внешнее кольцо пустое или заходит в прежний мир');
  ok(new Set(C.map.places.map(p => p.id)).size === C.map.places.length && new Set(C.map.places.map(p => p.name)).size >= C.map.places.length - 6, 'повторы id или имён мест');
}
// зоны, уровни, станы
{
  const Z = allZones(C).filter(z => z.ring >= 0), hubs = C.map.places.filter(p => p.hub);
  ok(Z.length === 20, 'зон за ядром не 20: ' + Z.length);
  for (const z of Z) { const h = hubs.find(p => p.hub === z.id), npc = h ? C.map.buildings.filter(b => b.vil === h.id && b.npc).map(b => b.npc) : []; ok(h && npc.includes('merchant') && npc.includes('smith'), `зона ${z.id}: нет стана с торговцем и кузнецом`); }
  const fr = hubs.find(p => p.frontier); ok(fr && C.map.buildings.some(b => b.vil === fr.id && b.npc === 'scribe') && Math.hypot(fr.x, fr.z) < 800, 'нет передового стана с книжницей у прежнего края');
  const at = d => { let lo = 1e9, hi = -1e9; for (let a = 0; a < 360; a += 5) { const v = zoneLevel(C, Math.sin(a * Math.PI / 180) * d, Math.cos(a * Math.PI / 180) * d); lo = Math.min(lo, v); hi = Math.max(hi, v); } return [lo, hi]; };
  const [a1, b1] = at(Rin - 5), [a2, b2] = at(Rin + 5), [a3, b3] = at(R - 5), [a4, b4] = at(950);     // у каждой зоны своя полоса уровней (как во внутренних кольцах)
  ok(b1 <= 60.01 && a2 >= 59.99 && b2 <= 70.01 && a4 >= 69.99 && b3 <= 80.01 && a3 >= 70, `уровни колец: ${a1.toFixed(1)}–${b1.toFixed(1)} / ${a2.toFixed(1)}–${b2.toFixed(1)} / ${a4.toFixed(1)}–${b4.toFixed(1)} / ${a3.toFixed(1)}–${b3.toFixed(1)}`);
  ok(zoneAt(C, 0, 750).ring === 2 && zoneAt(C, 0, 1000).ring === 3, 'кольца 2 и 3 не на своих местах');
}
// мир: места сбора, костры, повозки в кольце
{
  const W = createWorld(JSON.parse(JSON.stringify(C)), mulberry32(1)), S = W.levels.surface.map, far = q => Math.hypot(q.x, q.z) > Rin;
  ok(S.nodes.filter(far).length >= 400 && S.nodes.filter(q => !far(q)).length === C.life.gather.n, 'места сбора: кольцо пустое или прежние сдвинулись');
  ok(S.fires.filter(far).length >= 50 && S.coaches.filter(far).length >= 10, 'в кольце мало костров или повозок');
  ok(W.seenN === seenSize(C), 'сетка тумана не по новому миру');
}
// туман старого сохранения: клетка у костра лагеря и клетка на (500, −300) — на своих местах в новой сетке
{
  const c = C.map.cell, n0 = seenSize({ ...C, world: { ...C.world, radius: Rin } }), n = seenSize(C), a0 = new Uint8Array(n0 * n0);
  const cell = (Rx, x, z) => [Math.floor((x + Rx) / c), Math.floor((z + Rx) / c)];
  for (const [x, z] of [[0, 0], [500, -300]]) { const [i, j] = cell(Rin, x, z); a0[j * n0 + i] = 1; }
  const g = growSeen(packSeenChunks(a0, n0), C), a = new Uint8Array(n * n); ok(g.n === n && unpackSeenChunks(g, a, n), 'туман старого сохранения не перенесён');
  for (const [x, z] of [[0, 0], [500, -300]]) { const [i, j] = cell(R, x, z); ok(a[j * n + i] === 1, `туман в (${x}, ${z}) не на месте`); }
  ok(a.reduce((s, v) => s + v, 0) === 2, 'лишний туман после переноса');
  ok(growSeen(g, C) === g, 'новый туман переносится повторно');
}
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Мир ×2 3D: OK');
