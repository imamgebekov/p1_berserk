// Арена (2026-11-05, план «расширение мира в стиле WoW»): дуэль героя с ботом. Вызов — в окне разговора с ботом, ставка пеплом.
// Противник — боец-дуэлянт (`arena_<герой>`) в облике класса бота, силы по уровню бота; бой — обычный бой героя, но герой не гибнет (W.duelOn).
// Рейтинг Эло у героя и у каждого бота; таблица лидеров. Чистая логика: проверяется без браузера, окно — main.js и mailui.js.
import { len, clamp } from './util3d.js';
import { spawnEnemy, mulberry32 } from './sim.js';
import { onSurface } from './levels3d.js';
import { nearBot } from './botsocial3d.js';

export const arenaFresh = () => ({ rating: 1000, wins: 0, losses: 0, streak: 0, best: 1000, duel: null });
export const arenaOf = W => W.arena || (W.arena = arenaFresh());
const C = W => W.cfg.arena;
export const botRating = (W, a) => Math.round(C(W).base + a.lv * C(W).perLv + (a.kills || 0) * C(W).perKill + (a.arR || 0));
export const prizeOf = (W, a) => Math.round(C(W).prize + C(W).prizeLv * a.lv);
// шанс победы героя по Эло (для подсказки в окне)
export const winChance = (W, a) => 1 / (1 + Math.pow(10, (botRating(W, a) - arenaOf(W).rating) / 400));
export const dueling = W => !!arenaOf(W).duel;
const withOwnRng = (W, f) => { const keep = W.rng; W.rng = W.arng || (W.arng = mulberry32((W.cfg.world.seed * 4421 + 3) | 0)); try { return f(); } finally { W.rng = keep; } };     // свой поток: бой и добыча не сдвигаются
const quiet = W => { const p = W.player; for (const e of W.enemies) if (!e.dead && e.alert && len(e.x - p.x, e.z - p.z) < C(W).safeR) return false; return true; };

// почему нельзя вызвать: null — можно
export function duelBlock(W, a, bet) {
  const K = C(W); if (!K || !K.on) return 'off'; const p = W.player;
  if (arenaOf(W).duel) return 'busy'; if (p.dead) return 'dead'; if (!onSurface(W) || W.inside >= 0) return 'place';
  if (nearBot(W) !== a) return 'far'; if (a.dead || a.hp < a.maxhp * .5) return 'tired'; if ((a.duelCd || 0) > W.t) return 'rest';
  if (!K.bets.includes(bet)) return 'bet'; if (bet > W.inv.ash) return 'ash'; if (!quiet(W)) return 'danger';
  return null;
}
export function startDuel(W, a, bet) {
  const why = duelBlock(W, a, bet); if (why) return why; const K = C(W), p = W.player, S = arenaOf(W);
  W.inv.ash -= bet; a.arena = true;
  const t = 'arena_' + a.hero, E = W.cfg.enemies, L = W.cfg.level, e = withOwnRng(W, () => spawnEnemy(W, t, a.x, a.z));
  const grow = 1 + Math.max(0, a.lv - L.core) * L.grow;     // сила — по уровню бота, а не по месту боя
  e.lvl = a.lv; e.hp = e.maxhp = Math.max(60, Math.round(a.maxhp * K.hpK)); e.dmgMul = grow * (W.dif ? W.dif.dmg : 1) * K.dmgK; e.duel = true; e.alert = true; e.noLoot = true; e.nick = a.name; e.arenaBot = a.id; e.face = Math.atan2(p.x - a.x, p.z - a.z);
  S.duel = { id: e.id, bot: a.id, bet, t: 0, x: p.x, z: p.z, hp0: p.hp }; W.duelOn = true;
  W.ev.push({ k: 'arenaStart', name: a.name, bet, lv: a.lv, rating: botRating(W, a) });
  return 'ok';
}
function endDuel(W, win, why) {
  const S = arenaOf(W), D = S.duel; if (!D) return; S.duel = null; W.duelOn = false;
  const a = (W.bots || []).find(b => b.id === D.bot), K = C(W), p = W.player, rb = a ? botRating(W, a) : 1000, exp = 1 / (1 + Math.pow(10, (rb - S.rating) / 400)), d = Math.round(K.K * ((win ? 1 : 0) - exp));
  S.rating = Math.max(100, S.rating + d); S.best = Math.max(S.best, S.rating); let ash = 0, prize = 0;
  if (win) { S.wins++; S.streak++; prize = a ? prizeOf(W, a) : K.prize; ash = D.bet * 2 + prize; W.inv.ash += ash; } else { S.losses++; S.streak = 0; }
  if (a) { a.arena = false; a.duelCd = W.t + K.cd; a.arR = clamp((a.arR || 0) - d * .5, -150, 150); a.hp = Math.max(a.hp, a.maxhp * (win ? .5 : 1)); a.goal = null;
    W.ev.push({ k: 'allySay', x: a.x, z: a.z, text: K.say[win ? 'win' : 'lose'][D.id % K.say.win.length], kind: 'duel', bot: a.name }); }
  for (const e of W.enemies) if (e.id === D.id && !e.dead) { const i = W.enemies.indexOf(e); if (i >= 0) W.enemies.splice(i, 1); }     // побеждённый боец не остаётся трупом-врагом
  if (!win && !p.dead) p.hp = Math.max(1, Math.round(p.maxhp * K.loseHp));
  W.ev.push({ k: 'arenaEnd', win, why: why || '', name: a ? a.name : '', delta: d, rating: S.rating, ash, bet: D.bet });
}
export function arenaTick(W, dt) {
  const S = W.arena; if (!S || !S.duel) return; const D = S.duel, p = W.player; D.t += dt;
  const e = W.enemies.find(q => q.id === D.id);
  if (!onSurface(W)) return endDuel(W, false, 'left');
  if (!e || e.dead) return endDuel(W, true, 'win');
  if (p.dead || p.hp <= 1.01) return endDuel(W, false, 'down');
  if (D.t > C(W).time) return endDuel(W, false, 'time');
  if (len(p.x - D.x, p.z - D.z) > C(W).leash) return endDuel(W, false, 'fled');
}
// таблица лидеров: боты и герой по рейтингу
export function leaderboard(W, n = 10) {
  const S = arenaOf(W), rows = (W.bots || []).map(a => ({ name: a.name, rating: botRating(W, a), lv: a.lv, hero: a.hero, guild: a.guild || null }));
  rows.push({ name: 'Вы', rating: S.rating, lv: W.lv, me: true }); rows.sort((x, y) => y.rating - x.rating); return rows.slice(0, n).map((r, i) => ({ ...r, place: i + 1 }));
}
export const placeOf = W => { const S = arenaOf(W), rows = (W.bots || []).map(a => botRating(W, a)); return 1 + rows.filter(r => r > S.rating).length; };
export const serializeArena = W => { const S = arenaOf(W); return { rating: S.rating, wins: S.wins, losses: S.losses, streak: S.streak, best: S.best }; };
export function sanitizeArena(d) {
  const S = arenaFresh(); if (!d || typeof d !== 'object') return S; const n = (v, lo, hi, def) => (Number.isFinite(v) ? clamp(Math.floor(v), lo, hi) : def);
  S.rating = n(d.rating, 100, 4000, 1000); S.wins = n(d.wins, 0, 1e6, 0); S.losses = n(d.losses, 0, 1e6, 0); S.streak = n(d.streak, 0, 1e6, 0); S.best = Math.max(S.rating, n(d.best, 100, 4000, S.rating)); return S;
}
