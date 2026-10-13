// Отложенные события в игровом времени (вместо setTimeout): паузятся вместе с игрой
// и детерминированы в тесте.
import { W } from './state.js';

export function after(sec, fn) { W.timers.push({ t: W.T + sec, fn }); }

export function runTimers() {
  const ts = W.timers;
  if (!ts.length) return;
  let keep = 0;
  const due = [];
  for (let i = 0; i < ts.length; i++) {
    if (ts[i].t <= W.T) due.push(ts[i]); else ts[keep++] = ts[i];
  }
  ts.length = keep;
  for (const d of due) d.fn();
}
