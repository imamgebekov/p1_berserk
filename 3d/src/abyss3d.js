// «Бездна» (этап 6 плана «круче»): бесконечные ярусы под лагерем. Ярус собирается из комнат по своему зерну (makeLevelMap),
// враги сильнее с каждым ярусом, у яруса 0–2 модификатора и время. Перебил всех — лестница вниз открыта; время вышло — выброс наверх.
// Рекорд — W.ach.c.abyss (сохраняется с подвигами). Пока идёт забег — W.abyss { tier, t, mods }. Числа — cfg.abyss.
import { makeLevelMap, resolve } from './map.js';
const mulberry32 = a => () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
import { CONTAINERS, rollLoot } from './data/loot.js';

export const ABYSS = 'abyss';
const MODS = {
  swift: { name: 'быстрые враги' }, thick: { name: 'толстокожие' }, frail: { name: 'хрупкость' },
  packs: { name: 'стаи' }, greedy: { name: 'щедрость' }, dark: { name: 'тьма' }
};
export const modName = id => (MODS[id] || { name: id }).name;
// ярус: комнаты цепочкой вдоль оси x (зал входа, коридоры, арены), спуск в последней арене
export function abyssDef(cfg, tier, back, fixed = null) {     // fixed — модификаторы недели (Затмение)
  const A = cfg.abyss, r = mulberry32((cfg.world.seed || 1) * 977 + tier * 7919), n = Math.min(A.arenas[1], A.arenas[0] + Math.floor(tier / A.arenaEvery));
  const rooms = [{ id: 'hall', x: 0, z: 0, w: 10, d: 8 }], spawns = []; let x = 5, zc = 0;
  for (let i = 1; i <= n; i++) {
    rooms.push({ id: 'c' + i, x: x + 3, z: 0, w: 6, d: 2.4 }); x += 6;
    const w = 10 + Math.round(r() * 4), d = 9 + Math.round(r() * 4); zc = Math.round((r() - .5) * 2 * (d / 2 - 2.2) * 10) / 10;
    rooms.push({ id: 'a' + i, x: x + w / 2, z: zc, w, d }); x += w;
    spawns.push({ room: 'a' + i, n: Math.round(A.foes[0] + tier * A.foes[1]) });
  }
  const mods = fixed ? fixed.slice() : [], pool = Object.keys(MODS); if (!fixed) for (let k = 0; k < Math.min(2, Math.floor(tier / A.modEvery)) && pool.length; k++) mods.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  if (mods.includes('packs')) for (const s of spawns) s.n = Math.round(s.n * A.mod.packs);
  const types = A.types.filter(([, from]) => tier >= from).map(([t]) => [t, 1]);
  return { id: ABYSS, name: `${fixed ? 'Затмение' : 'Бездна'} · ярус ${tier}`, abyss: true, tier, mods, level: A.level[0] + tier * A.level[1], depth: 1, danger: 3,
    rooms, doors: [], foes: types, spawns, entry: { x: -1.5, z: 0 }, exit: { x: -3.6, z: 0 }, back: { x: back.x, z: back.z }, chests: [],
    down: { x: x - 2.5, z: zc, to: ABYSS, tx: -1.5, tz: 0 }, guard: tier % A.guardEvery === 0 ? { type: types[types.length - 1][0], x: x - 6, z: zc, hp: A.guardHp, dmg: 1.2, key: null } : null };
}
function makeLevel(W, tier, fixed = null) {
  const cfg = W.cfg, A = cfg.abyss, def = abyssDef(cfg, tier, A.at, fixed), map = makeLevelMap(cfg, def), B = map.bounds, R = Math.max(-B.x0, B.x1, -B.z0, B.z1) + 2, n = Math.ceil(2 * R / cfg.dungeons.cell) + 2;
  for (const q of map.portals) if (!q.up) q.abyssNext = true;
  const rng = W.rng === Math.random || (W.levels && W.levels.surface.rng === Math.random) ? Math.random : mulberry32((cfg.world.seed || 1) * 31 + tier);
  return { id: ABYSS, def, map, enemies: [], drops: [], spawnT: 1, rng, seenN: n, seenR: R, seenC: cfg.dungeons.cell, revR: cfg.dungeons.reveal * (def.mods.includes('dark') ? A.mod.dark : 1), seen: new Uint8Array(n * n) };
}
// при создании мира: ярус 1 и люк у лагеря
export function initAbyss(W) {
  const A = W.cfg.abyss; if (!A || !A.on || !W.levels) return;
  W.levels[ABYSS] = makeLevel(W, 1);
  const surf = W.levels.surface.map, q = { x: A.at.x, z: A.at.z }; try { resolve(surf, q, .6); } catch (e) { /* без карты — как есть */ }
  surf.portals.push({ x: q.x, z: q.z, to: ABYSS, tx: -1.5, tz: 0, up: false, abyssEnter: true });
}
// модификаторы яруса — на врагов при появлении
function applyMods(W) {
  const A = W.cfg.abyss, m = W.levels[ABYSS].def.mods;
  for (const e of W.enemies) {
    if (m.includes('thick')) e.hp = e.maxhp = Math.round(e.maxhp * A.mod.thick);
    if (m.includes('swift')) e.spdMul = (e.spdMul || 1) * A.mod.swift;
    if (m.includes('frail')) e.dmgMul *= A.mod.frail;
    e.abyss = true;
  }
}
// вход и спуск: travel — из levels3d (передаётся, чтобы не было кольца импортов)
// «Затмение недели» (этап 6 «круче»): забег по Бездне с тремя модификаторами по номеру недели (свой генератор);
// цель — пройти ярус eclipse.goal (8); награда — раз в неделю
export const weekOf = ms => Math.floor((ms / 86400000 + 3) / 7);     // недели с понедельника
export function eclipseMods(week) { const r = mulberry32((week * 2654435761) >>> 0), pool = Object.keys(MODS).filter(m => m !== 'greedy'), out = []; while (out.length < 3) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]); return out; }
export const eclipseDoneThisWeek = (W, week) => !!(W.ach && W.ach.c.ewk === week);
export function abyssGo(W, q, travel, spawnFoes, week = null, start = 1) {     // week — забег «Затмения» этой недели; start — с какого яруса (боты баланса)
  const A = W.cfg.abyss;
  if (q.abyssEnter && W.lv < A.lv) { W.ev.push({ k: 'abyssLocked', lv: A.lv }); return false; }
  if (q.abyssNext && W.enemies.some(e => !e.dead)) { W.ev.push({ k: 'abyssClosed', n: W.enemies.filter(e => !e.dead).length }); return false; }
  const tier = q.abyssEnter ? start : W.abyss.tier + 1, wk = q.abyssEnter ? week : W.abyss.week ?? null, fixed = wk != null ? eclipseMods(wk) : null;
  if (q.abyssNext) { abyssCleared(W); W.enemies = []; W.drops = []; }     // старый ярус не уносим
  W.levels[ABYSS] = makeLevel(W, tier, fixed);
  const ok = travel(W, ABYSS, -1.5, 0); if (!ok) return false;
  if (!W.enemies.length) spawnFoes(W, W.levels[ABYSS]);
  applyMods(W);
  W.abyss = { tier, t: A.time + tier * A.timeTier, mods: W.levels[ABYSS].def.mods.slice(), week: wk };
  W.ev.push({ k: 'abyssEnter', tier, mods: W.abyss.mods.map(modName) });
  return true;
}
// ярус зачищен: награда, рекорд (событие abyssTier считают подвиги)
function abyssCleared(W) {
  const A = W.cfg.abyss, t = W.abyss.tier, greedy = W.abyss.mods.includes('greedy'), ash = Math.round(A.ash * t * (greedy ? A.mod.greedy : 1)); W.inv.ash += ash;
  const best = W.abyss.week != null ? 0 : Math.max(W.ach ? W.ach.c.abyss || 0 : 0, t);     // рекорд — только обычная Бездна
  W.ev.push({ k: 'abyssTier', tier: t, ash, best, eclipse: W.abyss.week != null });
  if (W.abyss.week != null && t === A.eclipse.goal && !eclipseDoneThisWeek(W, W.abyss.week)) { if (W.ach) W.ach.c.ewk = W.abyss.week; W.inv.ash += A.eclipse.ash; W.ev.push({ k: 'eclipseDone', week: W.abyss.week, ash: A.eclipse.ash }); }
}
export function abyssTick(W, dt, out) {     // out — подняться наверх (из sim)
  const S = W.abyss; if (!S) return;
  if (W.lvl !== ABYSS || W.player.dead) { W.ev.push({ k: 'abyssEnd', tier: S.tier }); W.abyss = null; return; }
  const left = W.enemies.filter(e => !e.dead).length;
  if (!left && !S.open) { S.open = true; const D = W.levels[ABYSS].def, p = W.player; p.hp = Math.min(p.maxhp, p.hp + p.maxhp * W.cfg.abyss.heal); W.ev.push({ k: 'abyssOpen', tier: S.tier });     // зачистил — передышка: часть здоровья
    if (S.tier % W.cfg.abyss.chestEvery === 0) for (const it of rollLoot(CONTAINERS.ironchest, W.rng, 1, W.gear.luck)) W.drops.push({ id: it.id, n: it.n, x: D.down.x - 1.5, z: D.down.z, t: 0, cd: 0 }); }
  if (S.open) return;
  if ((S.t -= dt) <= 0) { W.ev.push({ k: 'abyssTime', tier: S.tier }); W.abyss = null; out(); }     // время вышло — наверх, к люку
}
export function abyssLine(W) {
  const S = W.abyss; if (!S) return '';
  const left = W.enemies.filter(e => !e.dead).length, mm = `${Math.floor(Math.max(0, S.t) / 60)}:${String(Math.floor(Math.max(0, S.t) % 60)).padStart(2, '0')}`;
  return `${S.week != null ? 'Затмение' : 'Бездна'} · ярус ${S.tier}${S.week != null ? '/' + W.cfg.abyss.eclipse.goal : ''}${S.mods.length ? ` (${S.mods.map(modName).join(', ')})` : ''} · ${S.open ? 'спуск открыт' : `врагов ${left} · ${mm}`}`;
}
