// Обстановка домов по типам зданий (только вид; низкая, не мешает ходить). Координаты локальные: u вдоль дальней стены, v вглубь.
import { pushBox } from './models.js';
import { interiorPos, roomSize } from './map.js';

export function furnish(b, floorL, glowL, rnd) {
  const { depth, along, vert } = roomSize(b);
  // коробка в локальных координатах: a — размер вдоль стены, d — в глубину
  const F = (u, v, a, h, d, color, y = 0, glow = false) => { const p = interiorPos(b, u, v); pushBox(glow ? glowL : floorL, vert ? d : a, h, vert ? a : d, p.x, y + h / 2, p.z, 0, 0, 0, color); };
  const kind = b.kind;
  const wood = '#4a3524', dwood = '#2a1c12', iron = '#4a4640', cloth = '#8a1018';
  const barrel = (u, v) => { F(u, v, .7, .9, .7, '#5a3d26'); F(u, v, .76, .07, .76, '#2a2220', .2); F(u, v, .76, .07, .76, '#2a2220', .66); };
  const crate = (u, v, s = .8) => F(u, v, s, s * .85, s, '#6b4a2c');
  const bed = (u, v, a = 1.9) => { F(u, v, a, .35, .95, '#4a3a30'); F(u, v - .55 * 0, a * .3, .15, .8, '#a89a82', .35); };
  const table = (u, v, a = 1.3, d = .8) => { F(u, v, a, .08, d, wood, .66); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) F(u + x * (a / 2 - .1), v + z * (d / 2 - .1), .1, .66, .1, dwood); };
  const bench = (u, v, a = 1.6) => { F(u, v, a, .08, .35, wood, .38); F(u, v - .1, a, .38, .08, dwood); };
  const candle = (u, v, y = 0) => { F(u, v, .1, .22, .1, '#d8d0b8', y); F(u, v, .08, .1, .08, '#ffb040', y + .22, true); };
  const shelf = (u, v, a = 1.8) => { F(u, v, a, 1.7, .4, wood); const cols = ['#6a2a2a', '#2a3a5a', '#5a4a2a', '#3a5a3a', '#4a2a4a']; for (let r = 0; r < 3; r++) for (let i = 0; i < Math.floor(a / .22); i++) F(u - a / 2 + .2 + i * .22, v + .26, .14, .3, .2, cols[(r * 5 + i) % 5], .35 + r * .5); };

  if (kind === 'house') {
    const k = (rnd() * 3) | 0;
    if (k === 0) { table(0, 1.0); F(.2, 1.0, .3, .3, .3, '#8a7a62', .74); bench(-.2, 1.9, 1.1); }
    else if (k === 1) { bed(0, 1.0); F(0, .3, 1.9, .3, .1, dwood, .35); F(2.0, .6, .8, .5, .6, wood); }
    else { crate(0, .8, .9); crate(1.0, 1.1, .7); barrel(-1.0, .6); }
    if (rnd() < .6) candle(along / 2 - 2.0, .5, .66);
  } else if (kind === 'shop') {
    shelf(-1.4, .25); shelf(1.0, .25);
    F(0, depth * .55, along - 2.6, .95, .6, wood); F(0, depth * .55, along - 2.4, .08, .8, '#5a4028', .95);
    for (let i = 0; i < 4; i++) { F(-1.8 + i * 1.1, depth * .55 + .05, .35, .25, .3, ['#a89a82', '#c8a24a', '#6a2a2a', '#3a5a3a'][i], 1.03); }
    barrel(-along / 2 + 2.1, depth - .6);
  } else if (kind === 'smithy') {
    F(along / 2 - 2.6, .9, 1.9, 1.2, 1.1, '#3a3633'); F(along / 2 - 2.6, .9, 1.2, .08, .7, '#ff6a20', 1.2, true); F(along / 2 - 2.6, .45, .5, 2.2, .5, '#3a3633');
    F(-1.4, depth * .5, .7, .5, .45, '#2a2824'); F(-1.4, depth * .5, .9, .1, .6, '#4a4640', .5); F(-1.4, depth * .5 + .5, .2, .24, .24, '#6a6258', .55);
    barrel(-along / 2 + 2.0, .7); table(.2, depth - 1.0, 1.4, .7); F(.2, depth - 1.0, .9, .1, .12, '#a8a294', .74);
  } else if (kind === 'tavern') {
    F(0, .7, along - 3.6, 1.0, .7, wood); F(0, .7, along - 3.4, .08, .9, '#5a4028', 1.0);
    for (let i = 0; i < 3; i++) { barrel(-along / 2 + 2.0 + i * .95, .55); }
    for (const [u, v] of [[-1.6, 3.4], [1.8, 3.4], [-1.6, 5.6], [1.8, 5.6]]) { table(u, v, 1.5, .9); bench(u, v - .75, 1.5); bench(u, v + .75, 1.5); candle(u, v, .74); }
    bed(along / 2 - 1.3, depth - 1.1); bed(-along / 2 + 1.3, depth - 1.1);                // кровати для сна (G4)
  } else if (kind === 'chapel') {
    F(0, .5, 2.4, .9, .8, '#4a4640'); F(0, .5, 2.6, .12, 1.0, '#5a564e', .9); F(0, .35, 1.4, .06, .5, cloth, .96); F(0, .15, .14, 1.2, .1, '#c8a24a', 1.1);
    candle(-1.0, .5, 1.02); candle(1.0, .5, 1.02);
    for (let i = 0; i < 3; i++) { bench(-1.5, 3 + i * 1.9, 1.9); bench(1.5, 3 + i * 1.9, 1.9); }
  } else if (kind === 'barracks') {
    for (let i = 0; i < 4; i++) bed(-along / 2 + 1.7 + i * 2.6, .8, 1.8);
    table(0, depth - 1.8, 2.0, .9); bench(0, depth - 1.0, 2.0); F(0, depth - 1.8, .5, .2, .12, '#a8a294', .74);
  } else if (kind === 'warehouse') {
    for (let i = 0; i < 5; i++) { crate(-along / 2 + 1.8 + i * 1.8, .8, .9); if (i % 2 === 0) crate(-along / 2 + 1.8 + i * 1.8, .8, .8), F(-along / 2 + 1.8 + i * 1.8, .8, .7, .6, .7, '#7a5a38', .68); }
    barrel(-along / 2 + 1.6, depth - 1.8); barrel(-along / 2 + 2.4, depth - 1.4); crate(1.0, depth - 1.5, 1.0);
  } else if (kind === 'hut') {
    bed(0, .8, 1.7); F(0, depth - 1.4, .9, .25, .9, '#2a2420'); F(0, depth - 1.4, .5, .06, .5, '#ff6a20', .25, true);
  // новые здания (план «живой мир», этап 3, 2026-10-28)
  } else if (kind === 'ruin') {     // руины: обломки, опрокинутый стол, кости
    F(-along / 2 + 1.2, .9, 1.4, .45, 1.1, '#5a564e'); F(along / 2 - 1.3, depth * .65, 1.7, .6, 1.2, '#4e4a44'); F(.4, depth * .45, 1.3, .08, .8, wood, .25); F(-.2, depth * .45, .1, .5, .1, dwood);
    F(.9, depth - .9, .6, .1, .14, '#cfc6b0'); F(1.1, depth - .8, .26, .24, .26, '#d8cfb8'); crate(-.8, depth - .7, .6);
  } else if (kind === 'watch') {     // сторожевая башня: стойка с копьями, ящики, бочка
    F(0, .3, 1.6, 1.4, .3, dwood); for (const u of [-.55, -.2, .15, .5]) F(u, .38, .06, 1.8, .06, iron); crate(along / 2 - .9, depth - .7, .7); barrel(-along / 2 + .9, depth - .6); candle(0, depth - .6, 0);
  } else if (kind === 'barn') {     // сарай: сено, телега, вилы
    F(-along / 2 + 1.3, depth * .65, 1.8, 1.1, 1.4, '#c8a85a'); F(-along / 2 + 1.3, depth * .65, 1.5, .5, 1.1, '#d8b86a', 1.1); F(along / 2 - 1.6, depth * .5, 1.5, .55, 1.0, wood, .25);
    for (const z of [-.4, .4]) F(along / 2 - 1.6 + z * 2, depth * .5 + .55, .1, .5, .5, dwood); F(-along / 2 + .5, .25, .08, 1.5, .08, dwood); barrel(.3, depth - .6);
  } else if (kind === 'crypt_s') {     // склеп: два гроба, свечи, кости
    for (const u of [-.75, .75]) { F(u, depth * .55, .8, .55, 1.9, '#3a2a1e'); F(u, depth * .55, .86, .06, 1.96, '#2a1c12', .55); }
    candle(-along / 2 + .5, depth - .5); candle(along / 2 - .5, depth - .5); F(0, depth - .5, .5, .1, .14, '#cfc6b0'); F(.2, depth - .4, .26, .24, .26, '#d8cfb8');
  }
}
