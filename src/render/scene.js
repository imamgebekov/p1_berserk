// Небо, солнце/луна, силуэты, земля, костёр.
import { CFG } from '../config.js';
import { W, V } from '../state.js';
import { clamp, mixA, rgb, hash } from '../util.js';
import { R, disc, line } from './gfx.js';

const SKY0 = { top: [23, 17, 15], hor: [78, 58, 46] };
const SKY1 = { top: [4, 2, 3], hor: [62, 10, 12] };

export function drawSky() {
  const { LW, G } = V, camX = W.camX, ecl = W.ecl;
  const top = mixA(SKY0.top, SKY1.top, ecl), hor = mixA(SKY0.hor, SKY1.hor, ecl);
  const N = 9, h = Math.ceil(G / N);
  for (let i = 0; i < N; i++) R(0, i * h, LW, h + 1, rgb(mixA(top, hor, Math.pow(i / (N - 1), 1.3))));

  // солнце и луна, закрывающая его
  const cx = Math.round(LW * .66 - camX * .03), cy = G - 82, r = 22;
  const cover = W.boss ? 1 : 1 - clamp(W.timer / W.maxT, 0, 1);
  const pale = rgb(mixA([210, 196, 160], [140, 120, 100], ecl));
  disc(cx, cy, r + 5, rgb(mixA(top, hor, .55)));
  disc(cx, cy, r, pale);
  const off = Math.round((1 - cover) * (r * 2 + 3));
  if (cover < .985) {
    disc(cx + off, cy, r, rgb(mixA(top, hor, .25)));
  } else {
    disc(cx, cy, r + 2, rgb([196, 22, 28].map((v, i) => v * ecl + [90, 80, 70][i] * (1 - ecl))));
    disc(cx, cy, r - 1, '#050203');
  }
  if (ecl > .3) disc(cx, cy, r + 8, `rgba(196,22,28,${.07 * ecl})`);

  // дальние холмы
  const hillC = rgb(mixA([34, 25, 22], [18, 6, 8], ecl));
  for (let x = 0; x < LW; x++) {
    const wx = x + camX * .15;
    const hh = 16 + 10 * Math.sin(wx * .045) + 6 * Math.sin(wx * .13 + 1.3);
    R(x, G - hh, 1, hh, hillC);
  }
  // шпили вдали
  const spC = rgb(mixA([26, 19, 17], [12, 4, 6], ecl));
  for (let k = Math.floor(camX * .25 / 170) - 1; k < Math.floor((camX * .25 + LW) / 170) + 1; k++) {
    if (hash(k + 3) < .55) {
      const bx = Math.round(k * 170 + hash(k) * 100 - camX * .25), hh = 34 + hash(k + 9) * 26;
      R(bx, G - hh, 6, hh, spC); R(bx + 1, G - hh - 4, 4, 4, spC); R(bx + 2, G - hh - 9, 2, 5, spC);
    }
  }
  // мёртвые деревья
  const trC = rgb(mixA([16, 12, 11], [8, 3, 4], ecl));
  for (let k = Math.floor(camX * .5 / 70) - 1; k < Math.floor((camX * .5 + LW) / 70) + 1; k++) {
    if (hash(k * 1.7) < .5) {
      const bx = Math.round(k * 70 + hash(k) * 40 - camX * .5), hh = 20 + hash(k + 5) * 18;
      R(bx, G - hh, 2, hh, trC);
      line(bx + 1, G - hh + 6, bx + 8, G - hh - 2, trC); line(bx, G - hh + 10, bx - 7, G - hh + 2, trC);
      line(bx + 1, G - hh + 2, bx + 4, G - hh - 6, trC);
    }
  }
}

export function drawGround() {
  const { LW, LH, G } = V;
  R(0, G, LW, LH - G, '#17110f');
  R(0, G, LW, 1, '#5a4a3d');
  const cx = Math.floor(W.camX);
  for (let y = G + 2; y < LH; y += 2)
    for (let x = 0; x < LW; x++)
      if (((x + cx) + y * 3) % 7 === 0) R(x, y, 1, 1, '#2a201b');
}

export function drawProps() {
  const { LW, G } = V, camX = W.camX, T = W.T;
  // виселица
  let x = Math.round(70 - camX);
  if (x > -20 && x < LW + 20) {
    R(x, G - 38, 3, 38, '#0e0a09'); R(x, G - 38, 20, 3, '#0e0a09'); line(x + 3, G - 30, x + 8, G - 36, '#0e0a09');
    R(x + 15, G - 35, 1, 9, '#2a201b'); R(x + 14, G - 27, 3, 2, '#2a201b');
  }
  // костёр
  x = Math.round(CFG.world.fire - camX);
  if (x > -30 && x < LW + 30) {
    const f = Math.floor(T * 9);
    disc(x, G - 6, 34, 'rgba(224,96,42,.05)'); disc(x, G - 6, 22, 'rgba(224,96,42,.07)'); disc(x, G - 6, 12, 'rgba(240,140,60,.09)');
    line(x - 7, G - 1, x + 6, G - 5, '#3a2616', 2); line(x + 7, G - 1, x - 6, G - 5, '#4a3220', 2);
    const h1 = 8 + (f % 3), h2 = 5 + ((f + 1) % 3);
    R(x - 3, G - 5 - h1, 6, h1, '#a83a12'); R(x - 2, G - 5 - h1 - 3, 3, 4, '#e0602a');
    R(x - 1, G - 5 - h2, 3, h2, '#f08a3a'); R(x, G - 5 - h2 - 2, 1, 2, '#ffd27a');
  }
  // знак границы
  x = Math.round(CFG.world.town - camX);
  if (x > -10 && x < LW + 10) { R(x, G - 18, 2, 18, '#0e0a09'); R(x - 6, G - 18, 14, 5, '#1a1311'); R(x - 5, G - 17, 12, 1, '#3a2d26'); }
}
