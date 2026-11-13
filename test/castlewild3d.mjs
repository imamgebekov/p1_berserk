// Велесград (castle_waste) — открытые миры: три этажа подряд, лестницы вниз и вверх, вход этажа у лестницы, главный босс на последнем, этаж строится один раз, одно зерно — один мир
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, mulberry32 } from '../3d/src/sim.js';
import { regenLevel, travel } from '../3d/src/levels3d.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const mk = () => createWorld(JSON.parse(JSON.stringify(CFG3)), mulberry32(2));
const W = mk(), ids = ['castle_waste_1', 'castle_waste_2', 'castle_waste_3'];
for (const id of ids) ok(W.levels[id] && W.levels[id].def.castle === 'castle_waste', 'нет этажа ' + id);
for (const [i, id] of ids.entries()) {
  const r = regenLevel(W, id), L = W.levels[id], m = L.map; ok(r === true && m.wild, `${id}: не стал открытым миром`); if (!m.wild) continue;
  const up = m.portals.find(q => q.up), down = m.portals.find(q => !q.up);
  ok(up && up.to === (i ? ids[i - 1] : 'surface'), `${id}: выход вверх ведёт не туда: ${up && up.to}`);
  if (i < 2) { ok(down && down.to === ids[i + 1], `${id}: нет лестницы вниз`); ok(down && Math.hypot(down.x - L.def.entry.x, down.z - L.def.entry.z) > 25, `${id}: лестница вниз у входа`); } else ok(!down, 'лестница вниз на последнем этаже');
  ok(regenLevel(W, id) === false, `${id}: перестроился второй раз`);
  ok(m.wild.zones.length >= 2, `${id}: зон ${m.wild.zones.length}`);
}
// связь этажей: вход следующего — у лестницы предыдущего (в портале)
for (let i = 0; i < 2; i++) { const d = W.levels[ids[i]].map.portals.find(q => !q.up), e = W.levels[ids[i + 1]].def.entry, b = W.levels[ids[i + 1]].def.back; ok(d && Math.hypot(d.tx - e.x, d.tz - e.z) < .01, `${ids[i]}: лестница ведёт не ко входу следующего`); ok(b && Math.hypot(b.x - d.x, b.z - d.z) < 2.5, `${ids[i + 1]}: выход вверх не у лестницы`); }
// главный босс — на последнем этаже, в зоне
{ const L3 = W.levels[ids[2]], B = W.cfg.bosses.list.filter(b => b.level === ids[2]); ok(B.length === 1 && B[0].final, 'нет главного босса'); ok(B[0] && L3.map.wild.zones.length >= 3, 'зон на последнем этаже мало'); }
// одно зерно — один мир
{ const W2 = mk(); regenLevel(W2, ids[0]); const a = W.levels[ids[0]].map.wild.zones.map(z => [z.x, z.z, z.r].join()).join(';'), b = W2.levels[ids[0]].map.wild.zones.map(z => [z.x, z.z, z.r].join()).join(';'); ok(a === b, 'замок строится по-разному при одном зерне'); }
// ходьба по порталу: travel на этаж уже построенного замка — в точку портала, не в новый вход
{ const L2 = W.levels[ids[1]], up = L2.map.portals.find(q => q.up); travel(W, ids[1], up.tx, up.tz); ok(W.lvl === ids[1], 'не перешли на второй этаж'); }
if (fails.length) { console.log('ПРОВАЛ:'); for (const f of fails) console.log(f); process.exit(1); }
console.log('Велесград открытым миром: OK');
