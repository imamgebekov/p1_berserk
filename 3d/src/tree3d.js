// Древо умений (2026-10-20, просьба владельца): у героя 96 узлов — три ветки по 32, как в WoW: от простых к сильным.
// В ветке 10 активных умений (слева и в первых рядах) и 22 пассивных: таланты (очки талантов W.sp, 1–5 рангов), таланты-усилители
// новых умений, мастерства прежних умений (4-й ранг, нужен полный 3-й). Активные — за очки умений W.ap, 3 ранга, каждый ждёт
// своего уровня. Ряд k открывается, когда в ветке вложено ROW_STEP×(k−2) очков. Чистая логика (Node-тесты).
import { ABILITIES, rankLvs } from './data/abilities3d.js';
import { branchesOf, SKILLS } from './data/skills3d.js';
import { OLD_BRANCH } from './data/actives3d.js';
import { canUpgrade, upgradeAbility } from './abilities3d.js';

export const ROWS = 10, COLS = 4, ROW_STEP = 2;     // 4.06: ряды 9–10 — умения 61–70 и таланты против врагов 70–80
// очков в ветке для ряда: первые два ряда открыты сразу — первое умение берётся первым очком умений (до 3.85 ряд 2 ждал 2 очка и на старте был недоступен)
export const rowNeed = row => Math.max(0, row - 2) * ROW_STEP;
const COMMON_SPLIT = [['step', 'nose'], ['eye', 'sneak'], ['haggle', 'pockets']];     // общие таланты в первый ряд веток
const ACT_ROW = [2, 1, 1, 1, 1, 2, 1, 1, 1, 1];     // активных в ряду 1–10 (всего 12); остальные места ряда — таланты (всего 28)
const FALL = { ranks: [[3], [6], [9], [12], [15], [19], [24], [30]], genLv: [3, 6, 10, 15, 21, 28, 36, 45] };     // без настроек — примерные уровни для порядка
const firstLv = (cfg, a, i) => cfg ? rankLvs(cfg, i, a)[0] : a.j !== undefined ? FALL.genLv[a.j] + a.br : FALL.ranks[i][0];
const cache = new Map();
// ветки героя (2026-10-20): в каждой 32 узла — 10 активных (8 прежних умений героя по веткам + 22 новых) и 22 пассивных
// (свои таланты, таланты-усилители новых умений, таланты характеристик, два общих, мастерства прежних умений)
export function treeOf(hero, cfg) {
  if (cache.has(hero)) return cache.get(hero);
  const abil = ABILITIES[hero] || [], all = branchesOf(hero), spec = all.filter(b => !b.common), common = all.find(b => b.common), own = OLD_BRANCH[hero] || {};
  const out = spec.map((b, bi) => {
    const A = abil.map((a, i) => ({ a, lv: firstLv(cfg, a, i) })).filter(x => (x.a.j !== undefined ? x.a.br : own[x.a.id]) === bi).sort((u, v) => u.lv - v.lv).map(x => x.a);
    const nodes = [], actRow = {}; let k = 0;
    ACT_ROW.forEach((n, ri) => { for (let c = 0; c < n && k < A.length; c++, k++) { const a = A[k]; actRow[a.id] = ri + 1; nodes.push({ key: 'a:' + a.id, kind: 'active', id: a.id, name: a.name, row: ri + 1, col: c, max: 3, icon: 'n:' + a.id }); } });
    const late = new Set(A.slice(10).map(a => a.id)), tal = (s, want) => ({ want, late: !!(s.high || (s.boost && late.has(s.boost))), n: { key: 't:' + s.id, kind: 'talent', id: s.id, name: s.name, text: s.text, max: s.max, icon: s.icon || 'n:' + s.id } });
    const C = (COMMON_SPLIT[bi] || []).map(id => common && common.skills.find(s => s.id === id)).filter(Boolean), own6 = b.skills.filter(s => !s.boost && !s.gen && !s.high);
    const Q = [...C.map(s => tal(s, 1)), ...own6.map((s, i) => tal(s, 1 + i)), ...b.skills.filter(s => s.boost).map(s => tal(s, actRow[s.boost] || 4)), ...b.skills.filter(s => s.gen).map((s, i) => tal(s, 2 + 2 * i)), ...b.skills.filter(s => s.high).map((s, i) => tal(s, 20 + i))].sort((u, v) => u.want - v.want);
    const Qold = Q.filter(x => !x.late).map(x => x.n), Qlate = Q.filter(x => x.late).map(x => x.n);     // ряды 1–8 — как до 4.06, поздние — в ряды 9–10
    const M = A.filter(a => a.j === undefined).map(a => ({ key: 'm:' + a.id, kind: 'mastery', id: a.id, name: 'Мастерство: ' + a.name, max: 1, req: 'a:' + a.id, icon: 'n:' + a.id }));
    const slots = []; ACT_ROW.forEach((n, ri) => { for (let c = n; c < COLS; c++) slots.push({ row: ri + 1, col: c }); });
    const s8 = slots.filter(q => q.row <= 8), s9 = slots.filter(q => q.row > 8), list = [...Qold.slice(0, s8.length - M.length), ...M];
    list.forEach((n, i) => { if (s8[i]) nodes.push({ ...n, ...s8[i] }); }); Qlate.forEach((n, i) => { if (s9[i]) nodes.push({ ...n, ...s9[i] }); });
    return { id: b.id, name: b.name, color: b.color, role: b.role, nodes };
  });
  cache.set(hero, out); return out;
}
export const nodeCount = hero => treeOf(hero).reduce((s, b) => s + b.nodes.length, 0);
// ранг узла сейчас
export function rankOf(W, n) {
  if (n.kind === 'talent') return W.skills[n.id] || 0;
  const r = W.ab[n.id] || 0; return n.kind === 'active' ? Math.min(3, r) : r >= 4 ? 1 : 0;
}
export const spentInTree = (W, br) => br.nodes.reduce((s, n) => s + rankOf(W, n), 0);
const findNode = (hero, key, cfg) => { for (const b of treeOf(hero, cfg)) { const n = b.nodes.find(x => x.key === key); if (n) return { b, n }; } return null; };
// можно ли вложить очко: 'ok' | 'school' (ветка не своей школы) | 'max' | 'row' (мало очков в ветке) | 'req' (нет умения 3-го ранга) | 'level' | 'points' | 'none'
export function canBuy(W, key) {
  const f = findNode(W.hero, key, W.cfg); if (!f) return 'none'; const { b, n } = f, r = rankOf(W, n);
  if (treeOf(W.hero, W.cfg).indexOf(b) !== (W.school || 0)) return 'school';     // школы (2026-10-22): вкладывать — только в свою школу
  if (r >= n.max) return 'max';
  if (spentInTree(W, b) < rowNeed(n.row)) return 'row';
  if (n.kind === 'talent') { const need = SKILLS[n.id] && SKILLS[n.id].ab && SKILLS[n.id].ab.id; if (need && (ABILITIES[W.hero] || []).some(a => a.id === need) && !((W.ab || {})[need] > 0)) return 'reqab'; return W.sp >= 1 ? 'ok' : 'points'; }     // 2026-10-24 (просьба владельца): талант навыка («Опыт: …» и др.) — только после самого навыка
  if (n.kind === 'mastery' && (W.ab[n.id] || 0) < 3) return 'req';
  const u = canUpgrade(W, n.id); return u === 'ok' ? 'ok' : u === 'points' ? 'points' : u === 'max' ? 'max' : 'level';
}
export function buy(W, key, refreshGear) {
  const st = canBuy(W, key); if (st !== 'ok') return st; const { n } = findNode(W.hero, key, W.cfg);
  if (n.kind === 'talent') { W.skills[n.id] = (W.skills[n.id] || 0) + 1; W.sp--; if (refreshGear) refreshGear(W); return 'ok'; }
  return upgradeAbility(W, n.id);
}
// что нужно для следующего ранга — для подсказки
const nextLv = (W, n) => { const L = ABILITIES[W.hero] || [], i = L.findIndex(a => a.id === n.id); return i < 0 ? '?' : rankLvs(W.cfg, i, L[i])[(W.ab || {})[n.id] || 0] ?? '?'; };     // уровень следующего ранга умения (для подсказки, 2026-10-24)
export function needText(W, key) {
  const f = findNode(W.hero, key, W.cfg); if (!f) return ''; const { b, n } = f, st = canBuy(W, key);
  return st === 'school' ? 'Это не ваша школа. Сменить школу можно у костра.' : st === 'row' ? `Нужно ${rowNeed(n.row)} очков в ветке «${b.name}» (сейчас ${spentInTree(W, b)})` : st === 'req' ? 'Нужно умение 3-го ранга' : st === 'reqab' ? `Сначала изучите умение «${(SKILLS[n.id].ab && (ABILITIES[W.hero] || []).find(a => a.id === SKILLS[n.id].ab.id) || {}).name || ''}»` : st === 'level' ? `Следующий ранг — с ${nextLv(W, n)}-го уровня` : st === 'points' ? (n.kind === 'talent' ? 'Нет очков талантов' : 'Нет очков умений') : st === 'max' ? 'Максимум' : '';
}
