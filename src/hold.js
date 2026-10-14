// Системные «заморозки» игры: пауза игрока и поворот телефона. Панели (сумка и т.п.) используют W.paused отдельно.
import { W, keys } from './state.js';

const reasons = new Set();

function sync() { W.hold = reasons.size > 0; }

export function addHold(reason) {
  reasons.add(reason); sync();
  keys.l = keys.r = keys.atk = keys.jump = false;       // кнопки не «залипают»
}
export function removeHold(reason) { reasons.delete(reason); sync(); }
export const hasHold = reason => reasons.has(reason);
export function clearHolds() { reasons.clear(); sync(); }
