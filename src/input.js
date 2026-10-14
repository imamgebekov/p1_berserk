// Ввод: большие кнопки пульта (pointer events, мультитач) и клавиатура для отладки на компьютере.
import { keys } from './state.js';
import { ensureAudio } from './audio.js';
import { tryBrand, tryRoll } from './combat.js';

export function bindInput(doc, win) {
  doc.querySelectorAll('.btn').forEach(b => {
    const k = b.dataset.k;
    const on = e => {
      e.preventDefault(); ensureAudio();
      try { b.setPointerCapture(e.pointerId); } catch (_) { /* не критично */ }
      b.classList.add('on');
      if (k === 'brand') tryBrand(); else if (k === 'roll') tryRoll(); else keys[k] = true;
    };
    const off = () => { b.classList.remove('on'); if (k !== 'brand' && k !== 'roll') keys[k] = false; };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('lostpointercapture', off);
  });
  win.addEventListener('contextmenu', e => e.preventDefault());
  // iOS Safari игнорирует user-scalable=no: глушим щипок и двойной тап явно
  for (const t of ['gesturestart', 'gesturechange', 'gestureend']) win.addEventListener(t, e => e.preventDefault());

  const KM = { ArrowLeft: 'l', ArrowRight: 'r', z: 'atk', Z: 'atk', x: 'jump', X: 'jump', ArrowUp: 'jump' };
  win.addEventListener('keydown', e => {
    if (e.key === 'c' || e.key === 'C') tryBrand(); else if (e.key === 'v' || e.key === 'V') tryRoll(); else if (KM[e.key]) keys[KM[e.key]] = true;
  });
  win.addEventListener('keyup', e => { if (KM[e.key]) keys[KM[e.key]] = false; });
  const release = () => { keys.l = keys.r = keys.atk = keys.jump = false; };
  win.addEventListener('blur', release);
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) release(); });
}
