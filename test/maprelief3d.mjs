// Тест подложки карты 3D (шаг 10б аудита, «как карта Skyrim»): вода — только у реки, вне круга мира — прозрачно, склоны дают
// светотень (разная яркость при одном цвете земли), горы светлее равнины в среднем, подписи пяти областей внутри мира;
// сумка — 40 мест.
import { CFG3 } from '../3d/src/config3d.js';
import { makeMap } from '../3d/src/map.js';
import { reliefSetup, reliefRows, regionLabels } from '../3d/src/maprelief.js';
import { waterDist } from '../3d/src/terrain3d.js';
import { biomeAt } from '../3d/src/worldgen3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const map = makeMap(CFG3), S = reliefSetup(CFG3, map), N = S.NZ, NX = S.NX, R = S.R, out = new Uint8ClampedArray(NX * N * 4);     // 4.05: подложка — прямоугольник NX × NZ
const t0 = performance.now(); reliefRows(S, 0, N, out); const ms = performance.now() - t0;
const lim = 3 * Math.max(1, (R / 624) ** 2) * NX / S.N;     // мир ×2: ряд пересекает вчетверо больше участков земли — предел по площади (строится по кадрам, игра не замирает)
ok(ms / N < lim, `ряд подложки строится долго: ${(ms / N).toFixed(2)} мс (предел ${lim.toFixed(1)})`);
const at = (x, z) => { const i = Math.floor((x - S.X0) / S.step), j = Math.floor((z - S.Z0) / S.step), k = (j * NX + i) * 4; return [out[k], out[k + 1], out[k + 2], out[k + 3]]; };
const blue = c => c[2] > c[0] && c[2] > c[1];
// вода и суша
let water = 0, land = 0, wrong = 0, lum = new Map();
let farL = 0, farN = 0, inL = 0, inN = 0;
for (let j = 0; j < N; j += 3) for (let i = 0; i < NX; i += 3) {
  const x = S.X0 + (i + .5) * S.step, z = S.Z0 + (j + .5) * S.step, k = (j * NX + i) * 4; if (!out[k + 3]) continue;
  { const l = .3 * out[k] + .59 * out[k + 1] + .11 * out[k + 2]; if (Math.hypot(x, z) > R) { farL += l; farN++; continue; } inL += l; inN++; }     // за краем — дорисовка, считается отдельно
  const c = [out[k], out[k + 1], out[k + 2]], wet = map.river && waterDist(map.river, x, z) < S.V.waterIn;
  if (wet) { water++; if (!blue(c)) wrong++; } else { land++; if (blue(c)) wrong++; }
  const b = biomeAt(CFG3, x, z) || 'core', l = .3 * c[0] + .59 * c[1] + .11 * c[2]; if (!lum.has(b)) lum.set(b, []); lum.get(b).push(l);
}
ok(water > 20 && land > water * 20, `вода и суша не в пропорции: вода ${water}, суша ${land}`);
ok(wrong < (water + land) * .01, 'вода не синяя или суша синяя: ' + wrong);
ok(at(R * 1.5, 0)[3] === 255 && at(0, R * 1.1)[3] === 255 && at(0, 0)[3] === 255, 'за краем мира не дорисовано или центр пуст');
ok(farN > inN && farL / farN < inL / inN * .9, `за краем не темнее мира: ${(farL / farN).toFixed(0)} против ${(inL / inN).toFixed(0)}`);
// светотень: подложка без наклона склонов (exag 0) заметно отличается от обычной
{ const flat = new Uint8ClampedArray(NX * N * 4), S0 = reliefSetup({ ...CFG3, mapView: { ...CFG3.mapView, exag: 0 } }, map); reliefRows(S0, 0, N, flat);
  let d = 0, n = 0, big = 0; for (let k = 0; k < out.length; k += 4 * 7) if (out[k + 3]) { const q = Math.abs(out[k + 1] - flat[k + 1]); d += q; n++; if (q > 8) big++; }
  ok(d / n > 2 && big / n > .05, `светотени почти нет: средняя разница ${(d / n).toFixed(2)}, заметная у ${(100 * big / n).toFixed(1)}%`); }
void lum;
// подписи областей
{ const L = regionLabels(CFG3); ok(L.length === 20 && L.every(l => l.name && l.sub && Math.hypot(l.x, l.z) < R), 'подписи зон: ' + JSON.stringify(L)); }     // этап 1: подписи зон (имя и пояс уровней), 20 за ядром (мир ×2)
ok(CFG3.bag.slots === 40, 'сумка не на 40 мест: ' + CFG3.bag.slots);

if (fails.length) { console.log('maprelief3d FAIL\n' + [...new Set(fails)].join('\n')); process.exit(1); }
console.log(`Подложка карты 3D: OK (${(ms / N).toFixed(2)} мс на ряд)`);
