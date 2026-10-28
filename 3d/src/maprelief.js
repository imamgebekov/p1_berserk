// Подложка карты с рельефом (шаг 10б аудита, «как карта Skyrim»): цвет земли как в игре (оттенок биома), светотень склонов
// по высотам, выше — светлее, вода реки, камень обрывов. Строится один раз на мир кусками (по рядам), чтобы не было рывка.
// reliefRows — чистая функция (проверяется в Node), makeRelief — холст для браузера.
import { buildHeights, reliefHeight, waterDist, streamDist, vnoise } from './terrain3d.js';
import { biomeTint, biomeAt, BIOMES } from './worldgen3d.js';
import { zoneAt } from './zones3d.js';
import { inCliff } from './cliffs3d.js';
import { puddleOn, puddleRange, allZones } from './zones3d.js';     // Мир 5.0

const lin = h => [1, 3, 5].map(i => { const c = parseInt(h.slice(i, i + 2), 16) / 255; return c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); });
const srgb = v => { v = Math.max(0, Math.min(1, v)); return Math.round((v <= .0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - .055) * 255); };

// окружение подложки: высоты, цвета (линейные), шаг сетки
export function reliefSetup(cfg, map) {
  const V = cfg.mapView, R = cfg.world.radius, N = V.n;
  const g = cfg.look.ground, base = lin(g[0]).map((v, i) => v * .7 + lin(g[1])[i] * .3);     // средний цвет травы (как текстура земли)
  const step = 2 * R / N, RW = R * (V.wide || 1), RH = R * (V.tall || 1), NX = Math.round(2 * RW / step), NZ = Math.round(2 * RH / step);     // 4.05: подложка — прямоугольник шире круга мира
  return { V, R, N, NX, NZ, CX: (cfg.world.center || { x: 0 }).x, CZ: (cfg.world.center || { z: 0 }).z, X0: (cfg.world.center || { x: 0 }).x - NX * step / 2, Z0: (cfg.world.center || { z: 0 }).z - NZ * step / 2, step,     // подложка — вокруг центра мира (Мир 5.0)
    hf: buildHeights(cfg, map), sand: lin(cfg.look.sand), map, cfg, base, water: lin(V.water), rock: lin(V.rock), L: (() => { const l = V.light, n = Math.hypot(...l); return l.map(v => v / n); })() };
}
// ряды j0..j1-1 в RGBA (out — Uint8ClampedArray на весь холст N×N); вне круга мира — прозрачно
export function reliefRows(S, j0, j1, out) {
  const { V, R, NX, step, X0, Z0, hf, map, base, water, rock, L } = S, H = (x, z) => reliefHeight(hf, x, z);     // 4.05: облегчённая высота
  for (let j = j0; j < j1; j++) for (let i = 0; i < NX; i++) {
    const x = X0 + (i + .5) * step, z = Z0 + (j + .5) * step, k = (j * NX + i) * 4;
    if (Math.hypot(x - S.CX, z - S.CZ) > R) { farPixel(S, x, z, out, k); continue; }
    const h = H(x, z), hx = H(x + step, z), hz = H(x, z + step);
    let c;
    if (map.river && (waterDist(map.river, x, z) < V.waterIn || streamDist(map.river, x, z) < .4)) c = water.slice();     // и ручьи
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
// за краем мира (4.05): дорисовка без высот — шум с тенью; на побережье — море с отмелью, в горах — скалы и снег, на болоте — бочаги.
// Темнее мира (V.far) — сверху ещё тёмные облака (mapclouds.js). Пройти туда нельзя: граница — круг
const fbm = (x, z) => (vnoise(x / 230, z / 230, 911) * .55 + vnoise(x / 90, z / 90, 912) * .3 + vnoise(x / 35, z / 35, 913) * .15);
function farPixel(S, x, z, out, k) {
  const { V, R, step, base, water, rock, sand, L } = S, n = fbm(x, z), hx = fbm(x + step, z), hz = fbm(x, z + step), d = Math.hypot(x - S.CX, z - S.CZ), ex0 = S.CX + (x - S.CX) * (R - 2) / d, ez0 = S.CZ + (z - S.CZ) * (R - 2) / d, bio = biomeAt(S.cfg, ex0, ez0) || 'forest', e = Math.min(1, (d - R) / 260);     // биом — у края по тому же лучу: без полос от волны границы
  let c, hh = n;
  if (bio === 'coast' && n < .56) { c = water.map(v => v * (1 - .35 * e)); hh = .3; }
  else if (bio === 'coast' && n < .6) c = sand.slice();
  else if (bio === 'mountains' || (bio === 'waste' && n > .64)) { c = n > .7 ? [.62, .6, .57] : rock.map((v, q) => v * .7 + base[q] * .3); hh = n * 1.8; }
  else if (bio === 'swamp' && n < .34) { c = water.map(v => v * .7); hh = .3; }
  else { const t = biomeTint(S.cfg, ex0, ez0); c = base.map((v, q) => v * t[q] * (bio === 'forest' ? .8 : 1)); }
  const ex = V.exag * 18, nx = -(hx - n) / step * ex, nz = -(hz - n) / step * ex, nl = Math.hypot(nx, 1, nz), sh = Math.max(0, (nx * L[0] + L[1] + nz * L[2]) / nl);
  const m = (c[0] + c[1] + c[2]) / 3, B = V.bright * (V.shade[0] + V.shade[1] * sh + (hh - .5) * .2) * (V.far || .7) * (1 - .25 * e);
  out[k] = srgb((c[0] + (m - c[0]) * V.desat) * B); out[k + 1] = srgb((c[1] + (m - c[1]) * V.desat) * B); out[k + 2] = srgb((c[2] + (m - c[2]) * V.desat) * B); out[k + 3] = 255;
}
// подписи областей: середина сектора биома на среднем радиусе пояса (по пробам)
export function regionLabels(cfg) {
  const G = cfg.worldgen; if (!G || !G.on) return [];
  if (puddleOn(cfg)) return allZones(cfg).filter(z => z.ring >= 0).map(z => { const P = puddleRange(cfg, z.id); return P && { b: z.id, name: z.name, sub: `ур. ${P.lv[0]}–${P.lv[1]}`, x: P.x, z: P.z }; }).filter(Boolean);     // Мир 5.0: подпись — в середине лужи
  if (cfg.zones) {     // зоны по уровням (этап 1): имя и пояс уровней — в середине сектора кольца
    const Z = cfg.zones, B = [G.coreR + G.belt, Z.split, ...(Z.splits || []).filter(v => v < cfg.world.radius), cfg.world.radius], rings = B.slice(0, -1).map((v, i) => [(v + B[i + 1]) / 2, i]), out = [];     // кольца (мир ×2: четыре)
    for (const [r, ring] of rings) { const acc = {};
      for (let a = 0; a < 360; a += 2) { const t = a * Math.PI / 180, x = Math.sin(t) * r, z = Math.cos(t) * r, q = zoneAt(cfg, x, z); if (!q || q.ring !== ring) continue; const A = acc[q.id] = acc[q.id] || { q, sx: 0, sz: 0 }; A.sx += Math.sin(t); A.sz += Math.cos(t); }
      for (const A of Object.values(acc)) { const l = Math.hypot(A.sx, A.sz) || 1; out.push({ b: A.q.id, name: A.q.name, sub: `ур. ${A.q.lv[0]}–${A.q.lv[1]}`, x: A.sx / l * r, z: A.sz / l * r }); } }
    return out;
  }
  const r = (G.coreR + G.belt + cfg.world.radius) / 2, acc = {};
  for (let a = 0; a < 360; a += 2) { const t = a * Math.PI / 180, x = Math.sin(t) * r, z = Math.cos(t) * r, b = biomeAt(cfg, x, z); if (!b) continue; (acc[b] = acc[b] || { sx: 0, sz: 0, n: 0 }); acc[b].sx += Math.sin(t); acc[b].sz += Math.cos(t); acc[b].n++; }
  return BIOMES.filter(b => acc[b]).map(b => { const A = acc[b], l = Math.hypot(A.sx, A.sz) || 1; return { b, name: cfg.mapView.regions[b], x: A.sx / l * r, z: A.sz / l * r }; });
}

// холст подложки: строится по рядам за budget мс за вызов step(); done — готово
export function makeRelief(doc, cfg, map) {
  const S = reliefSetup(cfg, map), cv = doc.createElement('canvas'); cv.width = S.NX; cv.height = S.NZ;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(S.NX, S.NZ); let row = 0;
  const R = { canvas: cv, R: S.R, X0: S.X0, Z0: S.Z0, W: S.NX * S.step, H: S.NZ * S.step, done: false, labels: regionLabels(cfg),
    step(budget = S.V.budget) {
      if (R.done) return false; const t0 = performance.now(), r0 = row;
      while (row < S.NZ && performance.now() - t0 < budget) { const r1 = Math.min(S.NZ, row + 1); reliefRows(S, row, r1, img.data); row = r1; }
      ctx.putImageData(img, 0, 0, 0, r0, S.NX, row - r0); if (row >= S.NZ) R.done = true; return true;
    } };
  return R;
}
