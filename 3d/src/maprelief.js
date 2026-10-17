// Подложка карты с рельефом (шаг 10б аудита, «как карта Skyrim»): цвет земли как в игре (оттенок биома), светотень склонов
// по высотам, выше — светлее, вода реки, камень обрывов. Строится один раз на мир кусками (по рядам), чтобы не было рывка.
// reliefRows — чистая функция (проверяется в Node), makeRelief — холст для браузера.
import { buildHeights, heightAt, waterDist } from './terrain3d.js';
import { biomeTint, biomeAt, BIOMES } from './worldgen3d.js';
import { inCliff } from './cliffs3d.js';

const lin = h => [1, 3, 5].map(i => { const c = parseInt(h.slice(i, i + 2), 16) / 255; return c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); });
const srgb = v => { v = Math.max(0, Math.min(1, v)); return Math.round((v <= .0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - .055) * 255); };

// окружение подложки: высоты, цвета (линейные), шаг сетки
export function reliefSetup(cfg, map) {
  const V = cfg.mapView, R = cfg.world.radius, N = V.n;
  const g = cfg.look.ground, base = lin(g[0]).map((v, i) => v * .7 + lin(g[1])[i] * .3);     // средний цвет травы (как текстура земли)
  return { V, R, N, step: 2 * R / N, hf: buildHeights(cfg, map), map, cfg, base, water: lin(V.water), rock: lin(V.rock), L: (() => { const l = V.light, n = Math.hypot(...l); return l.map(v => v / n); })() };
}
// ряды j0..j1-1 в RGBA (out — Uint8ClampedArray на весь холст N×N); вне круга мира — прозрачно
export function reliefRows(S, j0, j1, out) {
  const { V, R, N, step, hf, map, base, water, rock, L } = S, H = (x, z) => heightAt(hf, x, z, false);
  for (let j = j0; j < j1; j++) for (let i = 0; i < N; i++) {
    const x = -R + (i + .5) * step, z = -R + (j + .5) * step, k = (j * N + i) * 4;
    if (Math.hypot(x, z) > R) { out[k + 3] = 0; continue; }
    const h = H(x, z), hx = H(x + step, z), hz = H(x, z + step);
    let c;
    if (map.river && waterDist(map.river, x, z) < V.waterIn) c = water.slice();
    else {
      const t = biomeTint(S.cfg, x, z); c = base.map((v, q) => v * t[q]);
      if (map.plateaus && map.plateaus.length && inCliff(map.plateaus, x, z, .9)) c = rock.slice();
    }
    // светотень: нормаль по разнице высот (с преувеличением), свет с северо-запада; выше — светлее
    const nx = -(hx - h) / step * V.exag, nz = -(hz - h) / step * V.exag, nl = Math.hypot(nx, 1, nz);
    const sh = Math.max(0, (nx * L[0] + L[1] + nz * L[2]) / nl), k2 = V.shade[0] + V.shade[1] * sh + Math.max(-.2, Math.min(.35, h * V.lift));
    const m = (c[0] + c[1] + c[2]) / 3, B = V.bright * k2;     // карта светлее и спокойнее земли в игре (раскрашенный лист)
    out[k] = srgb((c[0] + (m - c[0]) * V.desat) * B); out[k + 1] = srgb((c[1] + (m - c[1]) * V.desat) * B); out[k + 2] = srgb((c[2] + (m - c[2]) * V.desat) * B); out[k + 3] = 255;
  }
}
// подписи областей: середина сектора биома на среднем радиусе пояса (по пробам)
export function regionLabels(cfg) {
  const G = cfg.worldgen; if (!G || !G.on) return [];
  const r = (G.coreR + G.belt + cfg.world.radius) / 2, acc = {};
  for (let a = 0; a < 360; a += 2) { const t = a * Math.PI / 180, x = Math.sin(t) * r, z = Math.cos(t) * r, b = biomeAt(cfg, x, z); if (!b) continue; (acc[b] = acc[b] || { sx: 0, sz: 0, n: 0 }); acc[b].sx += Math.sin(t); acc[b].sz += Math.cos(t); acc[b].n++; }
  return BIOMES.filter(b => acc[b]).map(b => { const A = acc[b], l = Math.hypot(A.sx, A.sz) || 1; return { b, name: cfg.mapView.regions[b], x: A.sx / l * r, z: A.sz / l * r }; });
}

// холст подложки: строится по рядам за budget мс за вызов step(); done — готово
export function makeRelief(doc, cfg, map) {
  const S = reliefSetup(cfg, map), cv = doc.createElement('canvas'); cv.width = cv.height = S.N;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(S.N, S.N); let row = 0;
  const R = { canvas: cv, R: S.R, done: false, labels: regionLabels(cfg),
    step(budget = S.V.budget) {
      if (R.done) return false; const t0 = performance.now(), r0 = row;
      while (row < S.N && performance.now() - t0 < budget) { const r1 = Math.min(S.N, row + 4); reliefRows(S, row, r1, img.data); row = r1; }
      ctx.putImageData(img, 0, 0, 0, r0, S.N, row - r0); if (row >= S.N) R.done = true; return true;
    } };
  return R;
}
