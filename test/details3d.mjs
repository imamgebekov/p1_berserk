// Детали мира (T5): только вид — карта боя не меняется; детали стабильны от зерна, не стоят на тропах, в домах и в воде;
// у домов, опасных мест и в подземельях они есть; каждый вид умеет рисовать декор.
import { readFileSync } from 'node:fs';
import { CFG3 } from '../3d/src/config3d.js';
import { makeMap, makeLevelMap } from '../3d/src/map.js';
import { surfaceDetails, dungeonDetails } from '../3d/src/details3d.js';
import { pathSegs, distSeg } from '../3d/src/world3d.js';
import { waterDist } from '../3d/src/terrain3d.js';

const fail = []; const ok = (c, m) => { if (!c) fail.push(m); };
const map = makeMap(CFG3), snap = JSON.stringify({ s: map.solids, b: map.blocks, d: map.decor, c: map.containers });
const A = surfaceDetails(map, CFG3), B = surfaceDetails(map, CFG3);
ok(JSON.stringify(A) === JSON.stringify(B), 'детали стабильны от зерна');
ok(JSON.stringify({ s: map.solids, b: map.blocks, d: map.decor, c: map.containers }) === snap, 'карта боя не тронута (препятствия, стены, декор, сундуки)');
ok(JSON.stringify(makeMap(CFG3).solids) === JSON.stringify(map.solids), 'новая карта — те же препятствия');
const segs = pathSegs(map), on = t => A.filter(d => d.t === t).length;
ok(A.length > map.buildings.length, `деталей у домов достаточно: ${A.length} на ${map.buildings.length} домов`);
for (const t of ['sign', 'rug', 'rusty_sword', 'skulls', 'wreck', 'banner']) ok(on(t) > 0, `есть детали вида ${t}`);
const onRoad = A.filter(d => d.t !== 'sign' && d.t !== 'rug' && d.t !== 'arch_k' && segs.some(([a, b]) => distSeg(d.x, d.z, a, b) < CFG3.details.road - .01));     // арка на въезде в село — поперёк дороги по замыслу (2026-10-28)
ok(!onRoad.length, `на тропе: ${onRoad.length}`);
const inHouse = A.filter(d => d.t !== 'rug' && map.buildings.some(b => d.x > b.x0 && d.x < b.x1 && d.z > b.z0 && d.z < b.z1));
ok(!inHouse.length, `внутри домов: ${inHouse.length}`);
ok(!A.some(d => map.river && waterDist(map.river, d.x, d.z) < 1.5), 'в воде деталей нет');
const lv = CFG3.dungeons.list ? CFG3.dungeons.list[0] : null;
let dn = [];
if (lv && makeLevelMap) { const L = makeLevelMap(CFG3, lv); dn = dungeonDetails(L, CFG3, 1); ok(dn.length > 0 && dn.some(d => d.t === 'candles') && dn.some(d => d.t === 'chain' || d.t === 'grate'), `подземелье ${lv.id}: свечи и цепи или решётки (${dn.length})`); }
else ok(false, 'нет подземелья для проверки');
const src = readFileSync(new URL('../3d/src/decor.js', import.meta.url), 'utf8');
for (const t of new Set([...A, ...dn].map(d => d.t))) ok(src.includes(`case '${t}'`), `декор рисует вид ${t}`);
ok(surfaceDetails(map, { ...CFG3, details: { ...CFG3.details, on: false } }).length === 0, 'выключено — деталей нет');

if (fail.length) { console.log('ПРОВАЛ:\n' + fail.join('\n')); process.exit(1); }
console.log(`Детали мира 3D: OK (на поверхности ${A.length}, в подземелье ${dn.length})`);
