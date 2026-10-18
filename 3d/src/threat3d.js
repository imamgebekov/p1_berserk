// Угроза (этап 4), как в WoW: враг бьёт того, кто для него опаснее. Урон и лечение копят угрозу (e.thr: 0 — герой, иначе id союзника),
// со временем она тает. Пока угрозы нет — решает близость: союзник в пределах reach и не дальше героя + 1,5 м (как прежде).
// Защитник «вызовом» (e.taunt) на время забирает врага себе. Без союзников ничего не считается — бой героя один на один не меняется.
import { len } from './util3d.js';
import { insideOf } from './map.js';

const T = W => W.cfg.squad.threat;
export function addThreat(W, e, who, v) {
  if (!W.allies.length || e.dead || !(v > 0)) return;
  const t = e.thr || (e.thr = {}); t[who] = (t[who] || 0) + v;
}
export const topThreat = e => (e.thr ? Math.max(0, ...Object.values(e.thr)) : 0);
export function taunt(W, e, a, t) {
  const th = e.thr || (e.thr = {}); th[a.id] = Math.max(th[a.id] || 0, topThreat(e) * T(W).taunt + 10);
  e.taunt = { id: a.id, t }; e.alert = true;
}
// кого бить: союзника (вернёт его) или героя (null)
export function threatPick(W, e, dPlayer, dt) {
  if (!W.allies.length) return null;
  const C = T(W);
  if (e.thr) { const k = Math.exp(-dt / C.decay); for (const id in e.thr) { e.thr[id] *= k; if (e.thr[id] < .5) delete e.thr[id]; } }
  if (e.taunt) { e.taunt.t -= dt; const a = e.taunt.t > 0 && W.allies.find(x => x.id === e.taunt.id && !x.dead); if (a) return a; e.taunt = null; }
  const th = e.thr || {}, ie = insideOf(W.map, e.x, e.z), near = d => C.near * Math.max(0, C.reach - d), stick = Object.keys(th).length ? C.stick : 1;     // без угрозы — чистая близость
  let best = null, bs = W.player.dead ? -1 : ((th[0] || 0) * C.player + near(dPlayer + 1.5)) * (e.tgt ? 1 : stick);
  for (const a of W.allies) {
    if (a.dead) continue;
    const d = len(a.x - e.x, a.z - e.z), t = th[a.id] || 0;
    if (!t && (d >= C.reach || d >= dPlayer + 1.5)) continue;                         // без угрозы — только близкий (прежнее правило)
    if (d > C.lose || insideOf(W.map, a.x, a.z) !== ie) continue;
    let s = t + near(d) + (a.decoy ? 1e6 : 0); if (e.tgt === a.id) s *= stick;     // тень-приманка Вейла важнее любой угрозы     // текущую цель враг меняет неохотно (+10%)
    if (s > bs) { bs = s; best = a; }
  }
  return best;
}
