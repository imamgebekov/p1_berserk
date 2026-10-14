// Настройки игрока. Хранятся отдельно от прогресса (переживают «Сбросить прогресс»).
import { env } from './env.js';
import { setMuted, setVolume } from './audio.js';

const KEY = 'berserk.settings';
export const DEFAULTS = { volume: .8, muted: false, lefty: false, reduce: 'auto' };   // reduce: 'auto' | 'on'

export const S = { ...DEFAULTS };

function storage() {
  try { const s = globalThis.localStorage; s.setItem('__t', '1'); s.removeItem('__t'); return s; } catch (e) { return null; }
}

// Очистка: любые странные значения приводятся к допустимым
export function sanitize(d) {
  const o = { ...DEFAULTS };
  if (d && typeof d === 'object') {
    if (Number.isFinite(+d.volume) && d.volume !== null && d.volume !== '') o.volume = Math.min(1, Math.max(0, +d.volume));
    o.muted = !!d.muted; o.lefty = !!d.lefty;
    o.reduce = d.reduce === 'on' ? 'on' : 'auto';
  }
  return o;
}

let store = null, osReduce = false, onApply = [];

// doc — для класса левши; mqReduce — системная настройка prefers-reduced-motion
export function applySettings(doc) {
  setMuted(S.muted); setVolume(S.volume);
  env.reduce = osReduce || S.reduce === 'on';
  if (doc) { doc.body.classList.toggle('lefty', S.lefty); doc.body.classList.toggle('reduce', env.reduce); }
  for (const f of onApply) f(S);
}

export function loadSettings(doc, st = storage(), osReduceMotion = false) {
  store = st; osReduce = osReduceMotion;
  let raw = null;
  try { raw = store && store.getItem(KEY); } catch (e) { raw = null; }
  let parsed = null;
  try { parsed = raw ? JSON.parse(raw) : null; } catch (e) { parsed = null; }
  Object.assign(S, sanitize(parsed));
  applySettings(doc);
  return S;
}

export function saveSettings() {
  try { store && store.setItem(KEY, JSON.stringify(S)); return true; } catch (e) { return false; }
}

export function setSetting(doc, key, value) {
  S[key] = value; applySettings(doc); saveSettings();
}
export function setOsReduce(doc, v) { osReduce = v; applySettings(doc); }
export function onSettings(fn) { onApply.push(fn); }
