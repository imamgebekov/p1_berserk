// Опыт, уровни и навыки.
import { clamp, len } from './util3d.js';
import { canRank } from './data/skills3d.js';
import { refreshGear } from './sim.js';

// ---- опыт, уровни, навыки ----
export const xpNeed = (lv, cfg) => Math.round(cfg.level.base * Math.pow(lv, cfg.level.pow));
export function addXp(W, e, share = 1) {
  const L = W.cfg.level, depth = clamp(len(e.x, e.z) / W.cfg.world.radius, 0, 1), C = W.cfg.enemies[e.type];
  gainXp(W, Math.round((C.xp || 5) * (1 + depth * .8) * (1 + W.cfg.enemies.dangerXp * (e.danger || 0)) * (e.elite ? W.cfg.elite.xp : 1) * share) || 1);
}
export function gainXp(W, n) {
  const L = W.cfg.level; if (W.lv >= L.max) return;
  n = Math.max(1, Math.round(n * W.dif.xp * (W.night ? W.cfg.daynight.night.xp : 1)));
  W.xp += n; W.ev.push({ k: 'xp', n, x: W.player.x, z: W.player.z });
  while (W.lv < L.max && W.xp >= xpNeed(W.lv, W.cfg)) {
    W.xp -= xpNeed(W.lv, W.cfg); W.lv++; W.sp++;
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

