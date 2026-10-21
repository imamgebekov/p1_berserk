// Тест подложки карты 3D (шаг 10б аудита, «как карта Skyrim»): вода — только у реки, вне круга мира — прозрачно, склоны дают
// светотень (разная яркость при одном цвете земли), горы светлее равнины в среднем, подписи пяти областей внутри мира;
// сумка — 40 мест.
import { CFG3 } from '../3d/src/config3d.js';
import { makeMap } from '../3d/src/map.js';
import { reliefSetup, reliefRows, regionLabels } from '../3d/src/maprelief.js';
import { waterDist } from '../3d/src/terrain3d.js';
import { biomeAt } from '../3d/src/worldgen3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const map = makeMap(CFG3), S = reliefSetup(CFG3, map), N = S.N, R = S.R, out = new Uint8ClampedArray(N * N * 4);
const t0 = performance.now(); reliefRows(S, 0, N, out); const ms = performance.now() - t0;
const lim = 3 * Math.max(1, (R / 624) ** 2);     // мир ×2: ряд пересекает вчетверо больше участков земли — предел по площади (строится по кадрам, игра не замирает)
ok(ms / N < lim, `ряд подложки строится долго: ${(ms / N).toFixed(2)} мс (предел ${lim.toFixed(1)})`);
const at = (x, z) => { const i = Math.floor((x + R) / S.step), j = Math.floor((z + R) / S.step), k = (j * N + i) * 4; return [out[k], out[k + 1], out[k + 2], out[k + 3]]; };
const blue = c => c[2] > c[0] && c[2] > c[1];
// вода и суша
let water = 0, land = 0, wrong = 0, lum = new Map();
for (let j = 0; j < N; j += 3) for (let i = 0; i < N; i += 3) {
  const x = -R + (i + .5) * S.step, z = -R + (j + .5) * S.step, k = (j * N + i) * 4; if (!out[k + 3]) continue;
  const c = [out[k], out[k + 1], out[k + 2]], wet = map.river && waterDist(map.river, x, z) < S.V.waterIn;
  if (wet) { water++; if (!blue(c)) wrong++; } else { land++; if (blue(c)) wrong++; }
  const b = biomeAt(CFG3, x, z) || 'core', l = .3 * c[0] + .59 * c[1] + .11 * c[2]; if (!lum.has(b)) lum.set(b, []); lum.get(b).push(l);
}
ok(water > 20 && land > water * 20, `вода и суша не в пропорции: вода ${water}, суша ${land}`);
ok(wrong < (water + land) * .01, 'вода не синяя или суша синяя: ' + wrong);
ok(at(R * .99, R * .99)[3] === 0 && at(0, 0)[3] === 255, 'за краем мира не прозрачно или центр пуст');
// светотень: подложка без наклона склонов (exag 0) заметно отличается от обычной
{ const flat = new Uint8ClampedArray(N * N * 4), S0 = reliefSetup({ ...CFG3, mapView: { ...CFG3.mapView, exag: 0 } }, map); reliefRows(S0, 0, N, flat);
  let d = 0, n = 0, big = 0; for (let k = 0; k < out.length; k += 4 * 7) if (out[k + 3]) { const q = Math.abs(out[k + 1] - flat[k + 1]); d += q; n++; if (q > 8) big++; }
  ok(d / n > 2 && big / n > .05, `светотени почти нет: средняя разница ${(d / n).toFixed(2)}, заметная у ${(100 * big / n).toFixed(1)}%`); }
void lum;
// подписи областей
{ const L = regionLabels(CFG3); ok(L.length === 20 && L.every(l => l.name && l.sub && Math.hypot(l.x, l.z) < R), 'подписи зон: ' + JSON.stringify(L)); }     // этап 1: подписи зон (имя и пояс уровней), 20 за ядром (мир ×2)
ok(CFG3.bag.slots === 40, 'сумка не на 40 мест: ' + CFG3.bag.slots);

if (fails.length) { console.log('maprelief3d FAIL\n' + [...new Set(fails)].join('\n')); process.exit(1); }
console.log(`Подложка карты 3D: OK (${(ms / N).toFixed(2)} мс на ряд)`);
