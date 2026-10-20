// Древо умений (2026-10-20, просьба владельца): у героя 40 узлов в трёх ветках, как в WoW — от простых к сильным.
// Узел — талант (пассив, 1–5 рангов, очки талантов W.sp), активное умение (3 ранга, очки умений W.ap) или мастерство
// (4-й ранг умения, ставится над ним, нужен полный 3-й ранг). В каждой ветке — её шесть талантов, умения, которые эти
// таланты усиливают, их мастерства и два общих таланта «Скитальца». Ряд k открывается, когда в ветке вложено ROW_STEP×(k−1)
// очков; ранги умений по-прежнему ждут своего уровня. Раскладка строится из данных героя. Чистая логика (Node-тесты).
import { ABILITIES } from './data/abilities3d.js';
import { branchesOf } from './data/skills3d.js';
import { canUpgrade, upgradeAbility } from './abilities3d.js';

export const ROWS = 7, COLS = 4, ROW_STEP = 2;
// очков в ветке для ряда: первые два ряда открыты сразу — первое умение берётся первым очком умений (до 3.85 ряд 2 ждал 2 очка и на старте был недоступен)
export const rowNeed = row => Math.max(0, row - 2) * ROW_STEP;
const COMMON_SPLIT = [['step', 'nose'], ['eye', 'sneak'], ['haggle', 'pockets']];     // общие таланты в первый ряд веток
const cache = new Map();
// ветки героя: [{ id, name, color, role, nodes: [{ key, kind, id, name, row, col, max, req, icon }] }]
export function treeOf(hero) {
  if (cache.has(hero)) return cache.get(hero);
  const abil = ABILITIES[hero] || [], all = branchesOf(hero), spec = all.filter(b => !b.common), common = all.find(b => b.common);
  const owner = {}, cnt = bi => abil.filter(x => owner[x.id] === bi).length; spec.forEach((b, bi) => b.skills.forEach(s => { if (s.ab && abil.some(a => a.id === s.ab.id) && owner[s.ab.id] === undefined && cnt(bi) < 3) owner[s.ab.id] = bi; }));     // в ветке не больше трёх умений
  abil.forEach(a => { if (owner[a.id] === undefined) { const n = spec.map((_, bi) => abil.filter(x => owner[x.id] === bi).length); owner[a.id] = n.indexOf(Math.min(...n)); } });     // умение без усилителя — в ветку, где умений меньше
  const out = spec.map((b, bi) => {
    const T = b.skills, A = abil.filter(a => owner[a.id] === bi), C = (COMMON_SPLIT[bi] || []).map(id => common && common.skills.find(s => s.id === id)).filter(Boolean), nodes = [];
    const tal = (s, row, col) => s && nodes.push({ key: 't:' + s.id, kind: 'talent', id: s.id, name: s.name, text: s.text, row, col, max: s.max, icon: 'n:' + s.id });
    const act = (a, row, col) => a && nodes.push({ key: 'a:' + a.id, kind: 'active', id: a.id, name: a.name, row, col, max: 3, icon: 'n:' + a.id });
    const mst = (a, row, col) => a && nodes.push({ key: 'm:' + a.id, kind: 'mastery', id: a.id, name: 'Мастерство: ' + a.name, row, col, max: 1, req: 'a:' + a.id, icon: 'n:' + a.id });
    tal(C[0], 1, 0); tal(T[0], 1, 1); tal(C[1], 1, 2);
    act(A[0], 2, 0); tal(T[1], 2, 2);
    act(A[1], 3, 1); tal(T[2], 3, 3);
    act(A[2], 4, 2); tal(T[3], 4, 3);
    mst(A[0], 5, 0); tal(T[4], 5, 3);
    mst(A[1], 6, 1); mst(A[2], 6, 2);
    tal(T[5], 7, 1);
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
const findNode = (hero, key) => { for (const b of treeOf(hero)) { const n = b.nodes.find(x => x.key === key); if (n) return { b, n }; } return null; };
// можно ли вложить очко: 'ok' | 'max' | 'row' (мало очков в ветке) | 'req' (нет умения 3-го ранга) | 'level' | 'points' | 'none'
export function canBuy(W, key) {
  const f = findNode(W.hero, key); if (!f) return 'none'; const { b, n } = f, r = rankOf(W, n);
  if (r >= n.max) return 'max';
  if (spentInTree(W, b) < rowNeed(n.row)) return 'row';
  if (n.kind === 'talent') return W.sp >= 1 ? 'ok' : 'points';
  if (n.kind === 'mastery' && (W.ab[n.id] || 0) < 3) return 'req';
  const u = canUpgrade(W, n.id); return u === 'ok' ? 'ok' : u === 'points' ? 'points' : u === 'max' ? 'max' : 'level';
}
export function buy(W, key, refreshGear) {
  const st = canBuy(W, key); if (st !== 'ok') return st; const { n } = findNode(W.hero, key);
  if (n.kind === 'talent') { W.skills[n.id] = (W.skills[n.id] || 0) + 1; W.sp--; if (refreshGear) refreshGear(W); return 'ok'; }
  return upgradeAbility(W, n.id);
}
// что нужно для следующего ранга — для подсказки
export function needText(W, key) {
  const f = findNode(W.hero, key); if (!f) return ''; const { b, n } = f, st = canBuy(W, key);
  return st === 'row' ? `Нужно ${rowNeed(n.row)} очков в ветке «${b.name}» (сейчас ${spentInTree(W, b)})` : st === 'req' ? 'Нужно умение 3-го ранга' : st === 'level' ? 'Следующий ранг — с более высокого уровня' : st === 'points' ? (n.kind === 'talent' ? 'Нет очков талантов' : 'Нет очков умений') : st === 'max' ? 'Максимум' : '';
}
