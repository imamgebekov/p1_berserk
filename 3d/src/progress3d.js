// Опыт, уровни и навыки.
import { depthAt, levelAt } from './levels3d.js';
import { canRank } from './data/skills3d.js';
import { refreshGear } from './sim.js';
import { abilityPointsAt } from './data/abilities3d.js';

// ---- опыт, уровни, навыки ----
export const xpNeed = (lv, cfg) => Math.round(cfg.level.base * Math.pow(lv, cfg.level.pow));
export function addXp(W, e, share = 1) {
  const L = W.cfg.level, depth = depthAt(W, e.x, e.z), C = W.cfg.enemies[e.type], lv = levelAt(W, e.x, e.z);
  gainXp(W, Math.round((C.xp || 5) * (1 + Math.min(1, depth) * .8) * (1 + Math.max(0, lv - L.core) * L.xp) *     // за ядром опыт растёт по уровню места (этап 0)
    (1 + W.cfg.enemies.dangerXp * (e.danger || 0)) * (e.elite ? W.cfg.elite.xp : 1) * share) || 1);
}
export function gainXp(W, n) {
  const L = W.cfg.level; if (W.lv >= L.max) return;
  n = Math.max(1, Math.round(n * W.dif.xp * (W.night ? W.cfg.daynight.night.xp : 1)));
  W.xp += n; W.ev.push({ k: 'xp', n, x: W.player.x, z: W.player.z });
  while (W.lv < L.max && W.xp >= xpNeed(W.lv, W.cfg)) {
    W.xp -= xpNeed(W.lv, W.cfg); W.lv++; W.sp++; W.ap += abilityPointsAt(W.lv, W.cfg) - abilityPointsAt(W.lv - 1, W.cfg);     // очко умений — каждый уровень с 3-го (2026-10-18)
    refreshGear(W); const p = W.player; p.hp = Math.min(p.maxhp, p.hp + p.maxhp * L.healOnUp);
    W.ev.push({ k: 'level', lv: W.lv, x: p.x, z: p.z });
  }
  if (W.lv >= L.max) W.xp = 0;
}
export function spendSkill(W, id) {
  const r = canRank(W.skills, id, W.sp); if (r !== 'ok') return r;
  W.skills[id] = (W.skills[id] || 0) + 1; W.sp--; refreshGear(W); return 'ok';
}
export const respecCost = W => W.cfg.respecBase * W.lv;
export function respec(W) {
  const spent = Object.values(W.skills).reduce((a, b) => a + b, 0); if (!spent) return 'none';
  const cost = respecCost(W); if (W.inv.ash < cost) return 'ash';
  W.inv.ash -= cost; W.sp += spent; W.skills = {}; refreshGear(W); return 'ok';
}

