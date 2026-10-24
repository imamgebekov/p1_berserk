// Откат награды подземелий и рейдов (план подземелий, этап 1б, решение владельца 2026-10-24): вход и бой — всегда, а именная добыча
// и печати с босса — раз в период: подземелье — до ближайшей полуночи, рейд — до понедельника; героическая сложность — отдельный откат.
// Время — настоящее (W.now, в тестах подменяется). Числа — config3d.js → lockout. Чистая логика.
export const nextMidnight = ms => { const d = new Date(ms); d.setHours(24, 0, 0, 0); return d.getTime(); };
export const nextMonday = ms => { const d = new Date(ms); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return d.getTime(); };
const nowOf = W => (W.now ? W.now() : Date.now());
export const lockKey = (id, heroic) => id + (heroic ? ':h' : '');
const lockOn = W => !!(W.cfg.lockout && W.cfg.lockout.on);
// откат подземелья id: { until, boss: [типы] } или null, если награда свободна
export function lockOf(W, id, heroic = false) {
  if (!lockOn(W)) return null; const x = W.lockout && W.lockout[lockKey(id, heroic)];
  return x && x.until > nowOf(W) ? x : null;
}
// убит ли босс type в этом периоде (для подписи у входа и трекера)
export const lockedBoss = (W, id, heroic, type) => { const x = lockOf(W, id, heroic); return !!x && x.boss.includes(type); };
// часов до обновления награды (вверх) или 0
export const lockHours = (W, id, heroic) => { const x = lockOf(W, id, heroic); return x ? Math.max(1, Math.ceil((x.until - nowOf(W)) / 3600000)) : 0; };
// босс убит: true — награда положена (и босс записан в откат); false — откат, только пепел и расходники
export function bossReward(W, e) {
  if (!lockOn(W) || !e.boss) return true;
  const L = W.levels && W.levels[W.lvl], d = L && L.def; if (!d || !d.inst || d.abyss) return true;     // откат — только у подземелий и рейдов
  const t = nowOf(W), k = lockKey(d.id, L.heroic), lk = W.lockout || (W.lockout = {});
  if (!(lk[k] && lk[k].until > t)) lk[k] = { until: d.raid ? nextMonday(t) : nextMidnight(t), boss: [] };
  if (lk[k].boss.includes(e.type)) return false;
  lk[k].boss.push(e.type); return true;
}
// для сохранения: только действующие откаты
export function packLockout(W) { const t = nowOf(W), r = {}; for (const [k, x] of Object.entries(W.lockout || {})) if (x && x.until > t) r[k] = { until: x.until, boss: x.boss.slice() }; return r; }
export function sanitizeLockout(s, t = Date.now()) {
  const r = {}; if (!s || typeof s !== 'object') return r;
  for (const [k, x] of Object.entries(s)) if (x && Number.isFinite(x.until) && x.until > t && Array.isArray(x.boss)) r[k] = { until: x.until, boss: x.boss.filter(b => typeof b === 'string') };
  return r;
}
