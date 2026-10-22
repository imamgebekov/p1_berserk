// Погода (F3): чистая логика без графики (проверяется в Node). По зерну мира строится расписание: ясно, облачно, дождь —
// куски случайной длины по весам; переходы плавные (ramp с). Расписание повторяется по кругу. Игра начинается с ясной погоды.
// effectsOf — что погода делает с миром: туман, свет облаков, мокрая земля, птицы, шум дождя. Дождь в бою (шаг R) — в sim.js и status3d.js (rainK).
import { mulberry32 } from './sim.js';

const KINDS = ['clear', 'cloudy', 'rain', 'fog'];
const LEVEL = { clear: { cloud: 0, rain: 0, mist: 0 }, cloudy: { cloud: .7, rain: 0, mist: 0 }, rain: { cloud: 1, rain: 1, mist: 0 }, fog: { cloud: .35, rain: 0, mist: 1 } };     // 4.18г: туман
export function makeWeather(seed, C, n = 40) {
  const r = mulberry32(seed * 7717 + 29), segs = []; let t = 0, prev = null;
  const pick = () => { const tot = KINDS.reduce((s, k) => s + C.kinds[k][0], 0); let x = r() * tot; for (const k of KINDS) { x -= C.kinds[k][0]; if (x <= 0) return k; } return 'clear'; };
  for (let i = 0; i < n; i++) {
    let k = i === 0 ? 'clear' : pick(); if (k === prev) k = pick();                  // подряд одно и то же — реже
    const [, a, b] = C.kinds[k], d = a + r() * (b - a); segs.push({ t0: t, t1: t + d, kind: k }); t += d; prev = k;
  }
  return { segs, total: t };
}
const smooth = x => x * x * (3 - 2 * x);
// погода в момент t: kind — текущий кусок, cloud/rain 0..1 с плавным переходом к соседу на краях куска
export function weatherAt(S, t, C) {
  const tt = ((t % S.total) + S.total) % S.total; let i = S.segs.findIndex(s => tt < s.t1); if (i < 0) i = S.segs.length - 1;
  const s = S.segs[i], L = LEVEL[s.kind], h = C.ramp / 2;
  const mixWith = (o, k) => ({ cloud: L.cloud + (LEVEL[o.kind].cloud - L.cloud) * k, rain: L.rain + (LEVEL[o.kind].rain - L.rain) * k, mist: L.mist + (LEVEL[o.kind].mist - L.mist) * k });
  let v = { cloud: L.cloud, rain: L.rain, mist: L.mist };
  if (tt > s.t1 - h) v = mixWith(S.segs[(i + 1) % S.segs.length], smooth(.5 * (tt - (s.t1 - h)) / h));
  else if (tt < s.t0 + h && (i > 0 || t >= S.total)) v = mixWith(S.segs[(i - 1 + S.segs.length) % S.segs.length], smooth(.5 - .5 * (tt - s.t0) / h));
  return { kind: s.kind, ...v };
}
// что погода делает с миром (on — включена ли)
export function effectsOf(w, C) {
  const r = w ? w.rain : 0, c = w ? w.cloud : 0, m = w ? w.mist || 0 : 0;
  return { fog: 1 + C.fog * r + .25 * c + (C.mist || 0) * m, light: 1 - .8 * c, wet: 1 - (1 - C.wet) * r, birds: 1 - r, rain: r, drops: Math.round(C.drops * r) };
}
