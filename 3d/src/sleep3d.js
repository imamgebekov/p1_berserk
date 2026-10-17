// Сон (G4): ночью в таверне или у костра в безопасном месте — сон до утра с полным лечением. Время идёт честно: мир
// проживает ночь шагами по dt с (витрина обновляется, баффы кончаются, боссы и сундуки возрождаются, торговец приезжает).
// Враг, заметивший спящего ближе wakeR м, будит его — тогда без лечения. Чистая логика (проверяется в Node).
import { step } from './sim.js';
import { isNight, phaseOf } from './daynight.js';
import { fireNear } from './fires3d.js';
import { cleansePlayer } from './status3d.js';

const KEEP = new Set(['shopRare', 'wanderer', 'wanderLeave', 'dawn', 'dusk', 'fireFound', 'questready', 'evStart', 'evEnd']);   // события ночи, о которых скажем утром
// где можно спать: 'tavern' (внутри таверны), 'fire' (у костра лагеря или безопасного места) или null
export function sleepSpot(W) {
  if (W.lvl !== 'surface' || W.player.dead) return null;
  const b = W.inside >= 0 && W.map.buildings[W.inside]; if (b && b.kind === 'tavern') return 'tavern';
  const f = fireNear(W); return f && !f.danger ? 'fire' : null;
}
// почему нельзя уснуть (строка) или null
export function sleepBlock(W) {
  if (W.lvl !== 'surface') return 'Под землёй не уснуть';
  if (!sleepSpot(W)) return 'Нужна кровать в таверне или костёр в безопасном месте';
  if (!isNight(W.t, W.cfg.daynight)) return 'Спать можно только ночью';
  const p = W.player; if (W.enemies.some(e => !e.dead && e.alert && Math.hypot(e.x - p.x, e.z - p.z) < W.cfg.fires.safeR)) return 'Рядом враги — не уснуть';
  return null;
}
// когда проснуться: ближайшее утро (час wake по игровым часам)
export function wakeTime(W) {
  const D = W.cfg.daynight, target = (W.cfg.sleep.wake - 6) / 24, ph = phaseOf(W.t, D);
  return W.t + (((target - ph) % 1 + 1) % 1) * D.len + .25;              // запас: часы показывают 07:00, а не 06:59 (1 с игры — 3 минуты)
}
// уснуть: 'ok' — проспал до утра, 'woken' — разбудили, иначе строка-причина
export function sleep(W) {
  const why = sleepBlock(W); if (why) return why;
  const S = W.cfg.sleep, p = W.player, t0 = W.t, end = wakeTime(W), kept = [];
  let woken = false;
  W.sleeping = true;
  while (W.t < end - 1e-6) {
    p.inv = 1e9; step(W, Math.min(S.dt, end - W.t), {});
    for (const v of W.ev) if (KEEP.has(v.k)) kept.push(v); W.ev.length = 0;
    if (W.enemies.some(e => !e.dead && e.alert && Math.hypot(e.x - p.x, e.z - p.z) < S.wakeR)) { woken = true; break; }
  }
  W.sleeping = false; p.inv = 1;
  if (!woken) { p.hp = p.maxhp; cleansePlayer(W, Object.keys(W.pst || {})); for (const a of W.allies) if (!a.dead) a.hp = a.maxhp; }
  W.ev.push(...kept, { k: 'wake', woken, hours: Math.round((W.t - t0) / W.cfg.daynight.len * 24) });
  return woken ? 'woken' : 'ok';
}
