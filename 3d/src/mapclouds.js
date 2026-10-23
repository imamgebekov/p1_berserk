// Облака над картой (4.05, просьба владельца): отдельный прозрачный холст поверх карты, анимируется только он.
// За краем мира — тёмные клубы (медленно плывут и меняют форму), по всей карте — небольшие светлые облака с тенью.
// Облака — в метрах мира: двигаются вместе с картой при сдвиге и приближении. Числа — config3d.js → mapView.clouds.
import { vnoise } from './terrain3d.js';

// спрайт облака: клубы из шума с мягким краем; tone — цвет, seed — форма
function sprite(doc, seed, tone) {
  const S = 128, c = doc.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), im = x.createImageData(S, S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const u = i / S - .5, v = j / S - .5, r = Math.hypot(u * 1.15, v * 1.6) * 2, n = vnoise(i / 22, j / 22, seed) * .6 + vnoise(i / 9, j / 9, seed + 1) * .3 + vnoise(i / 4, j / 4, seed + 2) * .1;
    const a = Math.max(0, Math.min(1, (1 - r) * 1.5 + (n - .55) * 1.8)) ** 2.2, k = (j * S + i) * 4, sh = .78 + .22 * (1 - v - .2 * n);     // мягкий край; верх светлее — объём
    im.data[k] = tone[0] * sh; im.data[k + 1] = tone[1] * sh; im.data[k + 2] = tone[2] * sh; im.data[k + 3] = a * 255;
  }
  x.putImageData(im, 0, 0); return c;
}
const mul = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

export function createMapClouds(doc, cfg) {
  const C = (cfg.mapView && cfg.mapView.clouds) || {}, R = cfg.world.radius, O = cfg.world.center || { x: 0, z: 0 },     // O — центр мира (Мир 5.0): облака — вокруг него
    BW = R * ((cfg.mapView && cfg.mapView.wide) || 1), BH = R * ((cfg.mapView && cfg.mapView.tall) || 1);
  let light = null, dark = null, shadow = null; const r = mul(cfg.world.seed * 77 + 3);
  const lights = Array.from({ length: C.light || 0 }, () => ({ x: (r() * 2 - 1) * BW, z: (r() * 2 - 1) * BH, s: C.lightSize[0] + r() * (C.lightSize[1] - C.lightSize[0]), k: (r() * 4) | 0, a: .45 + r() * .3 }));
  const darks = []; for (let i = 0; darks.length < (C.dark || 0) && i < 5000; i++) { const x = (r() * 2 - 1) * BW, z = (r() * 2 - 1) * BH; if (Math.hypot(x, z) < R + 30) continue; darks.push({ x, z, s: C.darkSize[0] + r() * (C.darkSize[1] - C.darkSize[0]), k: (r() * 4) | 0, ph: r() * 6.28, sp: .6 + r() * .8 }); }
  const wrap = (v, B) => (v > B ? v - 2 * B : v < -B ? v + 2 * B : v);
  // кадр: ctx — холст облаков (размер как у карты), view — { w, h, sc, cx, cz } той же карты, t — секунды
  function draw(ctx, view, t) {
    if (!light) { light = [0, 1, 2, 3].map(k => sprite(doc, 501 + k * 7, [255, 252, 246])); shadow = [0, 1, 2, 3].map(k => sprite(doc, 501 + k * 7, [20, 16, 12])); dark = [0, 1, 2, 3].map(k => sprite(doc, 601 + k * 7, [36, 30, 34])); }
    const { w, h, sc, cx, cz } = view, X = x => w / 2 + (x + O.x - cx) * sc, Y = z => h / 2 + (z + O.z - cz) * sc, wx = C.wind[0] * t, wz = C.wind[1] * t;
    ctx.clearRect(0, 0, w, h);
    // тёмные клубы — только за краем мира (клип: прямоугольник минус круг)
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.arc(X(0), Y(0), R * sc, 0, Math.PI * 2, true); ctx.clip('evenodd');
    { const g = ctx.createRadialGradient(X(0), Y(0), R * sc, X(0), Y(0), (R + C.veil) * sc); g.addColorStop(0, 'rgba(24,18,22,0)'); g.addColorStop(1, `rgba(24,18,22,${C.veilA})`); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }     // дымка у края мира
    for (const d of darks) {
      const x = wrap(d.x + wx * .5, BW), z = wrap(d.z + wz * .5, BH), s = d.s * (1 + .08 * Math.sin(t * .2 * d.sp + d.ph)) * sc, px = X(x), py = Y(z);
      if (px + s < 0 || px - s > w || py + s < 0 || py - s > h) continue;
      ctx.globalAlpha = C.darkA * (.8 + .2 * Math.sin(t * .13 * d.sp + d.ph)); ctx.drawImage(dark[d.k], px - s, py - s * .7, s * 2, s * 1.4);
    }
    ctx.restore(); ctx.globalAlpha = 1;
    // светлые облака с тенью — по всей карте
    const off = C.shadowOff * sc;
    for (const c of lights) {
      const x = wrap(c.x + wx, BW), z = wrap(c.z + wz, BH), s = c.s * sc, px = X(x), py = Y(z);
      if (px + s + off < 0 || px - s > w || py + s + off < 0 || py - s > h) continue;
      ctx.globalAlpha = c.a * C.shadowA; ctx.drawImage(shadow[c.k], px - s + off, py - s * .6 + off, s * 2, s * 1.2);
      ctx.globalAlpha = c.a * C.lightA; ctx.drawImage(light[c.k], px - s, py - s * .6, s * 2, s * 1.2);
    }
    ctx.globalAlpha = 1;
  }
  return { draw, count: () => ({ light: lights.length, dark: darks.length }), darks, lights };
}
