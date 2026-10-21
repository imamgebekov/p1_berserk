// Тест домов (2026-10-21): дома крупнее и не налезают друг на друга; у больших домов второй этаж — отдельный уровень;
// лестница внутри дома, подножие свободно, сундук не стоит на лестнице; подъём и спуск через переход; наверху сундуки и нет врагов.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32 } from '../3d/src/sim.js';
import { portalNear, portalName, usePortal } from '../3d/src/levels3d.js';
import { resolve } from '../3d/src/map.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const W = createWorld(JSON.parse(JSON.stringify(CFG3)), mulberry32(3)), B = W.map.buildings, src = CFG3.map.buildings;
// крупнее и без наложений
{ const k = B.map((b, i) => b.w / src[i].w); ok(k.every(x => x >= .98 && x <= CFG3.map.bScale + .02), 'дом уменьшился или вырос больше bScale');
  ok(k.reduce((a, b) => a + b, 0) / k.length > 1.1, 'дома почти не выросли: ' + (k.reduce((a, b) => a + b, 0) / k.length).toFixed(2));
  let over = 0; for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) { const a = B[i], b = B[j]; if (a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1) over++; }
  ok(!over, `домов внахлёст: ${over}`); }
// этажи
const ups = W.map.portals.filter(q => q.stair);
ok(ups.length >= 30, `вторых этажей мало: ${ups.length}`);
for (const q of ups) {
  const b = B[q.house], r = q.st.rect, L = W.levels[q.to];
  ok(L && L.def && L.def.floor && L.map.floor, `${q.to}: нет уровня этажа`);
  ok(r.x0 >= b.ix0 - 1e-6 && r.x1 <= b.ix1 + 1e-6 && r.z0 >= b.iz0 - 1e-6 && r.z1 <= b.iz1 + 1e-6, `${q.to}: лестница вне дома`);
  ok(q.x > b.ix0 && q.x < b.ix1 && q.z > b.iz0 && q.z < b.iz1, `${q.to}: подножие вне дома`);
  const o = { x: q.x, z: q.z }; resolve(W.map, o, W.cfg.player.radius); ok(Math.hypot(o.x - q.x, o.z - q.z) < .05, `${q.to}: подножие упирается в стену или лестницу`);
  ok(!b.chests.some(c => c.x > r.x0 - .4 && c.x < r.x1 + .4 && c.z > r.z0 - .4 && c.z < r.z1 + .4), `${q.to}: сундук стоит на лестнице`);
  ok(L.map.containers.length >= 1 && L.map.portals.length === 1 && L.map.portals[0].down, `${q.to}: наверху нет сундука или спуска`);
}
// подъём и спуск
{ const q = ups[0]; Object.assign(W.player, { x: q.x, z: q.z }); step(W, 1 / 60, {});
  ok(portalNear(W) === q && portalName(W, q) === 'Подняться на второй этаж', 'у подножия нет перехода вверх');
  usePortal(W); ok(W.lvl === q.to && !W.enemies.length, 'не поднялся или наверху враги');
  for (let i = 0; i < 20; i++) step(W, 1 / 60, {});
  const d = portalNear(W); ok(d && portalName(W, d) === 'Спуститься вниз', 'наверху нет спуска у лестницы');
  usePortal(W); ok(W.lvl === 'surface' && Math.hypot(W.player.x - q.x, W.player.z - q.z) < 1, 'спустился не к подножию'); }

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.slice(0, 20).join('\n')); process.exit(1); }
console.log(`Дома и вторые этажи 3D: OK (этажей ${ups.length})`);
