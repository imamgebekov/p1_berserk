// Эффекты стихий (шаг V1): чистые рецепты без графики (проверяются в Node). Рендер берёт отсюда, сколько и каких частиц выпустить
// у горящего, замёрзшего, отравленного, кровоточащего, и ломаную молнии. Только вид: симуляция и бой не меняются.
// Частица: dx, dy, dz — смещение от точки (у ног цели, dy — высота), vx, vy, vz — скорость, color, life, g — тяжесть (минус — всплывает),
// s — размер, add — светится (аддитивно).

const pick = (rng, a) => a[(rng() * a.length) | 0];
// частиц в секунду у статуса (на единицу размера цели)
export const RATE = { burn: 15, freeze: 4, poison: 5, bleed: 3, shock: 5 };     // вдвое тише (шаг 4 «Минус»)
// одна частица статуса kind; h — высота цели, м
export function statusPart(kind, rng, h = 1.6) {
  const a = rng() * Math.PI * 2, r = .25 + rng() * .3, ox = Math.cos(a) * r, oz = Math.sin(a) * r;
  if (kind === 'burn') {
    const smoke = rng() < .22;                                                // язык пламени снизу вверх, сверху — дым
    return smoke ? { dx: ox * .6, dy: h * (.7 + rng() * .3), dz: oz * .6, vx: (rng() - .5) * .4, vy: 1 + rng() * .8, vz: (rng() - .5) * .4, color: pick(rng, ['#3a302a', '#4a403a', '#2a2420']), life: .8 + rng() * .5, g: -1.2, s: .16 + rng() * .12, add: false }
      : { dx: ox, dy: h * (.1 + rng() * .6), dz: oz, vx: (rng() - .5) * .6, vy: 1.6 + rng() * 1.6, vz: (rng() - .5) * .6, color: pick(rng, ['#ffe27a', '#ffb040', '#ff8a30', '#e04a10']), life: .35 + rng() * .35, g: -2.5, s: .1 + rng() * .1, add: true };
  }
  if (kind === 'freeze') return { dx: ox * 1.2, dy: h * (.2 + rng() * .8), dz: oz * 1.2, vx: 0, vy: .25 + rng() * .3, vz: 0, color: pick(rng, ['#e8f8ff', '#bfe8ff', '#9fdcff']), life: .6 + rng() * .5, g: -.3, s: .05 + rng() * .05, add: true };
  if (kind === 'poison') return { dx: ox, dy: h * (.3 + rng() * .5), dz: oz, vx: (rng() - .5) * .2, vy: .6 + rng() * .5, vz: (rng() - .5) * .2, color: pick(rng, ['#7ad060', '#a8f070', '#4a9a3a']), life: .7 + rng() * .4, g: -.6, s: .07 + rng() * .07, add: false };
  if (kind === 'bleed') return { dx: ox * .5, dy: h * (.4 + rng() * .4), dz: oz * .5, vx: (rng() - .5) * .8, vy: .3 + rng() * .6, vz: (rng() - .5) * .8, color: pick(rng, ['#a01818', '#d03030', '#701010']), life: .5 + rng() * .3, g: 12, s: .06 + rng() * .05, add: false };
  return { dx: ox, dy: h * (.2 + rng() * .8), dz: oz, vx: (rng() - .5) * 3, vy: rng() * 2, vz: (rng() - .5) * 3, color: pick(rng, ['#fff6c0', '#ffe27a']), life: .12 + rng() * .1, g: 0, s: .05, add: true };     // shock: искры
}
// сколько частиц выпустить за dt при накопителе acc: { n, acc }
export function emitCount(acc, rate, dt) { const v = acc + rate * dt, n = Math.floor(v); return { n, acc: v - n }; }

// молния от a до b: ломаная из segs отрезков, отклонение до jitter м поперёк (к концам — меньше), ветки от средних узлов
export function lightning(a, b, rng, segs = 8, jitter = .55, branches = 2) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L, main = [];
  for (let i = 0; i <= segs; i++) {
    const k = i / segs, w = Math.sin(k * Math.PI) * jitter * (i === 0 || i === segs ? 0 : 1), off = (rng() * 2 - 1) * w, up = (rng() * 2 - 1) * w * .5;
    main.push({ x: a.x + dx * k + nx * off, y: a.y + dy * k + up, z: a.z + dz * k + nz * off });
  }
  const out = [];
  for (let j = 0; j < branches; j++) {
    const i0 = 1 + ((rng() * (segs - 2)) | 0), s = main[i0], ang = Math.atan2(dx, dz) + (rng() < .5 ? 1 : -1) * (.5 + rng() * .6), len = L * (.2 + rng() * .2), br = [s];
    for (let i = 1; i <= 3; i++) br.push({ x: s.x + Math.sin(ang) * len * i / 3 + (rng() - .5) * .3, y: s.y - .2 * i, z: s.z + Math.cos(ang) * len * i / 3 + (rng() - .5) * .3 });
    out.push(br);
  }
  return { main, branches: out };
}

// звёзды оглушения: положение звезды i из n в момент t на кругу радиуса r над головой
export const stunStar = (i, n, t, r = .45) => { const a = t * 4 + i / n * Math.PI * 2; return { x: Math.cos(a) * r, y: Math.sin(t * 6 + i) * .06, z: Math.sin(a) * r }; };
