// Записи звуков (2026-10-25, просьба владельца): петли природы и разовые звуки из 3d/sfx (CC0, авторы — 3d/ART-CREDITS.md).
// Грузятся после первого жеста игрока, игра их не ждёт; пока файла нет — звучит прежний синтез. Только браузер.
let URLS = {}; try { URLS = import.meta.glob('../sfx/*.mp3', { query: '?url', import: 'default', eager: true }); } catch (e) { /* Node-тесты: без записей */ }
const bufs = {};
let loading = null;
const nameOf = k => k.slice(k.lastIndexOf('/') + 1, -4);     // '../sfx/step_grass_0.mp3' → 'step_grass_0'
export const sampleNames = () => Object.keys(URLS).map(nameOf);
export function loadSamples(ac, done) {
  if (loading || !ac) return loading;
  loading = Promise.all(Object.entries(URLS).map(async ([k, u]) => {
    try { const r = await fetch(u); bufs[nameOf(k)] = await ac.decodeAudioData(await r.arrayBuffer()); } catch (e) { /* без этой записи — синтез */ }
  })).then(() => { if (done) done(); });
  return loading;
}
export const sampleBuf = n => bufs[n] || null;
// случайный вариант: 'cloth' → cloth_0 … cloth_N; точное имя — сам файл
export function pickSample(base, rnd = Math.random) {
  if (bufs[base]) return bufs[base];
  const vs = []; for (let i = 0; bufs[base + '_' + i]; i++) vs.push(bufs[base + '_' + i]);
  return vs.length ? vs[(rnd() * vs.length) | 0] : null;
}
export const loadedCount = () => Object.keys(bufs).length;
