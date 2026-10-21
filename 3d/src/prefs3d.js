// Личные настройки игрока (телефон): левша, размер кнопок, вибрация, счётчик кадров, показанные подсказки. Отдельно от сохранения игры.
const KEY = 'berserk3d.prefs';
export const UI_SCALES = [['S', .85], ['M', 1], ['L', 1.2]];
export const DEFAULT_PREFS = () => ({ lefty: false, ui: 1, vibrate: true, fps: false, hints: true, ascii: false, retro: false, quality: 'auto', eco: null, seen: {} });     // eco — экономия заряда: null — по устройству (телефон — вкл)     // quality — пресет качества (шаг 14)

export function sanitizePrefs(d) {
  const o = DEFAULT_PREFS(); if (!d || typeof d !== 'object') return o;
  if (typeof d.lefty === 'boolean') o.lefty = d.lefty;
  if (UI_SCALES.some(([, v]) => v === d.ui)) o.ui = d.ui;
  if (typeof d.vibrate === 'boolean') o.vibrate = d.vibrate;
  if (typeof d.fps === 'boolean') o.fps = d.fps;
  if (typeof d.hints === 'boolean') o.hints = d.hints;
  if (typeof d.ascii === 'boolean') o.ascii = d.ascii;
  if (typeof d.retro === 'boolean') o.retro = d.retro;
  if (['auto', 'low', 'mid', 'high'].includes(d.quality)) o.quality = d.quality;
  if (typeof d.eco === 'boolean') o.eco = d.eco;
  if (d.seen && typeof d.seen === 'object') for (const k of Object.keys(d.seen).slice(0, 40)) if (/^[a-z_]{1,20}$/.test(k) && d.seen[k] === true) o.seen[k] = true;
  return o;
}
export function loadPrefs(storage = globalThis.localStorage) { try { return sanitizePrefs(JSON.parse(storage.getItem(KEY) || 'null')); } catch (e) { return DEFAULT_PREFS(); } }
export function savePrefs(P, storage = globalThis.localStorage) { try { storage.setItem(KEY, JSON.stringify(P)); return true; } catch (e) { return false; } }

// подсказки новичку: условие показа смотрит на мир, каждая показывается один раз; desk — текст для компьютера (клавиши и мышь)
export const HINTS = [
  { id: 'move', text: 'Коснитесь экрана и ведите пальцем: герой идёт', desk: 'WASD или стрелки: герой идёт. Esc — меню, там все клавиши', when: W => W.t > 1.5 },
  { id: 'fight', text: 'Враг рядом: жмите «Удар» часто — серия, держите — тяжёлый удар. «Перекат» уводит от удара', desk: 'Враг рядом: пробел или левая кнопка — удар, держите — тяжёлый удар; Shift или правая — перекат', when: W => W.enemies.some(e => !e.dead && Math.hypot(e.x - W.player.x, e.z - W.player.z) < 9) },
  { id: 'hurt', text: 'Больно? Перекат даёт короткую неуязвимость, у костра здоровье лечится', when: W => W.player.hp < W.player.maxhp * .6 },
  { id: 'npc', text: 'Рядом житель: нажмите кнопку, чтобы торговать, взять задание или нанять бойца', desk: 'Рядом житель: E — торговать или нанять, Q — задания', when: W => !!W.nearNpc },
  { id: 'bag', text: 'В сумке вещи надеваются касанием, а карточка показывает бонусы сета', desk: 'Сумка — клавиша I: вещи надеваются щелчком, карточка показывает бонусы сета', when: W => W.inv.bag.length >= 2 },
  { id: 'lvl', text: 'Новый уровень: загляните в «Навыки», там очки', desk: 'Новый уровень: N — навыки, там очки', when: W => W.sp > 0 },
  { id: 'night', text: 'Ночью враги злее, а торговец спит. Держитесь у костра или в безопасных местах', when: W => W.night }
];
export function nextHint(W, P) {
  if (!P.hints) return null;
  for (const h of HINTS) if (!P.seen[h.id] && h.when(W)) return h;
  return null;
}
// короткая вибрация (на iPhone Safari не работает, на Android работает)
export function buzz(P, ms) { if (P.vibrate && typeof navigator !== 'undefined' && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ок */ } } }
