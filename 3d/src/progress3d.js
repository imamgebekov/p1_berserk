// Опыт, уровни и навыки.
import { depthAt, levelAt } from './levels3d.js';
import { canRank } from './data/skills3d.js';
import { refreshGear } from './sim.js';
import { abilityPointsAt } from './data/abilities3d.js';
import { ACT_ALL } from './data/story3d.js';

// ---- опыт, уровни, навыки ----
export const xpNeed = (lv, cfg) => Math.round(cfg.level.base * Math.pow(lv, cfg.level.pow));
// темп (этап 3 «круче»): уровень по сюжету — рекомендуемый у текущей сцены; после финала — предел
export const paceLv = W => { const S = W.story, c = S && ACT_ALL[S.i]; return c ? c.lv : W.cfg.level.max; };
const paceBand = (W, rec) => { const P = W.cfg.level.pace; return Math.max(P.min, Math.min(1, 1 - Math.max(0, W.lv - rec) / P.ahead)); };
// награда задания (kind 'quest') или сцены ('scene'): не больше доли уровня, меньше — если обгоняешь сюжет
export function paceXp(W, raw, kind) {
  const P = W.cfg.level.pace; if (!P || !P.on || !raw) return raw;
  return Math.max(1, Math.round(Math.min(raw, (kind === 'scene' ? P.fs : P.fq) * xpNeed(W.lv, W.cfg)) * paceBand(W, paceLv(W))));
}
// «серый» враг: ниже героя на grey и больше уровней — опыта меньше
export const greyMul = (W, elv) => { const P = W.cfg.level.pace; if (!P || !P.on || !elv) return 1; const d = W.lv - elv; return d < P.grey ? 1 : Math.max(P.min, 1 - (d - P.grey + 1) * P.greyK); };
export function addXp(W, e, share = 1) {
  const L = W.cfg.level, depth = depthAt(W, e.x, e.z), C = W.cfg.enemies[e.type], lv = levelAt(W, e.x, e.z);
  gainXp(W, Math.round(greyMul(W, e.lvl) * (C.xp || 5) * (1 + Math.min(1, depth) * .8) * (1 + Math.max(0, lv - L.core) * L.xp) *     // за ядром опыт растёт по уровню места (этап 0)
    (1 + W.cfg.enemies.dangerXp * (e.danger || 0)) * (e.elite ? W.cfg.elite.xp : 1) * share) || 1);
}
export const rankNeed = cfg => Math.round(xpNeed(cfg.level.max - 1, cfg) * cfg.level.ranks.k);
export function gainXp(W, n) {
  const L = W.cfg.level, R = L.ranks;
  if (W.lv >= L.max) {                                                       // пепельные ранги (этап 3 «круче»): опыт после 60-го
    if (!R || !R.on || (W.prank || 0) >= R.cap) return;
    n = Math.max(1, Math.round(n * W.dif.xp * (W.night ? W.cfg.daynight.night.xp : 1))); W.pxp = (W.pxp || 0) + n; W.ev.push({ k: 'xp', n, x: W.player.x, z: W.player.z });
    while ((W.prank || 0) < R.cap && W.pxp >= rankNeed(W.cfg)) { W.pxp -= rankNeed(W.cfg); W.prank = (W.prank || 0) + 1; refreshGear(W); W.ev.push({ k: 'prank', n: W.prank, x: W.player.x, z: W.player.z }); }
    return;
  }
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
  const r = canRank(W.skills, id, W.sp, W.hero); if (r !== 'ok') return r;
  W.skills[id] = (W.skills[id] || 0) + 1; W.sp--; refreshGear(W); return 'ok';
}
export const respecCost = W => W.cfg.respecBase * W.lv;
export function respec(W) {
  const spent = Object.values(W.skills).reduce((a, b) => a + b, 0); if (!spent) return 'none';
  const cost = respecCost(W); if (W.inv.ash < cost) return 'ash';
  W.inv.ash -= cost; W.sp += spent; W.skills = {}; refreshGear(W); return 'ok';
}

