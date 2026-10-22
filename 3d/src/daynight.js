// Время суток: чистые функции от W.t (секунды игры). Рендер и симуляция читают одно и то же число «света» 0..1.
export const clamp01 = x => Math.min(1, Math.max(0, x));
export const phaseOf = (t, D) => (((t / D.len) + D.start) % 1 + 1) % 1;      // 0..1 за сутки; 0.3 — полдень
// свет: широкий день и широкая ночь, плавные рассвет и закат
export const lightOf = (t, D) => clamp01(.5 + D.contrast * Math.cos(2 * Math.PI * (phaseOf(t, D) - .3)));
export const isNight = (t, D) => lightOf(t, D) < D.nightBelow;
export const clockText = (t, D) => { const m = Math.floor(phaseOf(t, D) * 24 * 60 + 6 * 60) % (24 * 60); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
// смешивание двух #rrggbb
export function mix(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), c = s => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return '#' + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1);
}
// набор красок и яркостей неба на данный свет (0 — ночь, 1 — день)
export function skyAt(L, S) {
  const g = k => S.night[k] !== undefined && typeof S.night[k] === 'number' ? S.night[k] + (S.day[k] - S.night[k]) * L : mix(S.night[k], S.day[k], L);
  const o = { fog: g('fog'), hemiSky: g('hemiSky'), hemiGround: g('hemiGround'), hemiI: g('hemiI'), sun: g('sun'), sunI: g('sunI'), dome: g('dome') }, T = S.dusk;
  if (T) { const k = (T.k ?? 1) * Math.max(0, 1 - Math.abs(2 * L - 1) / (T.w || 1)); for (const key of Object.keys(o)) if (typeof T[key] === 'string') o[key] = mix(o[key], T[key], k); }     // 4.18г: рассвет и закат — розово-оранжевые, сильнее всего на середине перехода
  return o;
}
