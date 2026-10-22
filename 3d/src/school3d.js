// Школы героя (2026-10-22, решение владельца): ветка древа — школа, у героя активна одна. Данные активной школы лежат там же,
// где раньше (W.ab, W.skills, W.bar, очки W.ap и W.sp), две другие — в W.sch[i] ({ ab, skills, bar }). Смена школы — у костра,
// бесплатно; пока в школу ничего не вложено — где угодно. В каждой школе — все очки уровня: свободные считаются от уровня.
// Роль героя в группе — по школе (config3d.js → party.heroRole). Чистая логика (Node-тесты).
import { treeOf } from './tree3d.js';
import { abilityPointsAt, ranksOpenAt, ABILITIES } from './data/abilities3d.js';
import { sanitizeSkills } from './data/skills3d.js';

export const SCHOOLS = 3;
const MAP = new Map();
// id узла → школа: 'a:<умение>' (и мастерство того же умения), 't:<талант>'
function schoolMap(hero, cfg) {
  let m = MAP.get(hero); if (m) return m; m = new Map();
  treeOf(hero, cfg).forEach((b, i) => b.nodes.forEach(n => m.set((n.kind === 'talent' ? 't:' : 'a:') + n.id, i)));
  MAP.set(hero, m); return m;
}
export const schoolOfAbility = (hero, id, cfg) => schoolMap(hero, cfg).get('a:' + id);
export const schoolOfTalent = (hero, id, cfg) => schoolMap(hero, cfg).get('t:' + id);
const sum = o => Object.values(o || {}).reduce((a, b) => a + b, 0);
export const freeAp = (lv, ab, cfg) => Math.max(0, abilityPointsAt(lv, cfg) - sum(ab));
export const freeSp = (lv, skills) => Math.max(0, lv - 1 - sum(skills));
export const schoolSpent = W => sum(W.ab) + sum(W.skills);
export const schoolNames = (hero, cfg) => treeOf(hero, cfg).map(b => b.name);

// можно ли сменить школу: 'ok' | 'same' | 'fire' (вложены очки и не у костра) | 'none'
export function canSwitchSchool(W, i, nearFire) {
  if (!(Number.isInteger(i) && i >= 0 && i < SCHOOLS)) return 'none';
  if ((W.school || 0) === i) return 'same';
  return nearFire || !schoolSpent(W) ? 'ok' : 'fire';
}
// сменить школу: текущая уходит в W.sch, новая — из W.sch или пустая; очки пересчитываются от уровня
export function switchSchool(W, i, nearFire) {
  const st = canSwitchSchool(W, i, nearFire); if (st !== 'ok') return st;
  const cur = W.school || 0; W.sch = W.sch || {}; W.sch[cur] = { ab: W.ab || {}, skills: W.skills || {}, bar: W.bar || [] };
  const nx = W.sch[i] || { ab: {}, skills: {}, bar: [] }; delete W.sch[i];
  W.school = i; W.ab = nx.ab; W.skills = nx.skills; W.bar = nx.bar; W.ap = freeAp(W.lv, W.ab, W.cfg); W.sp = freeSp(W.lv, W.skills);
  W.acd = {}; W.lastAb = null; if (W.ev) W.ev.push({ k: 'school', i });
  return 'ok';
}

// сохранение: школы одного героя в допустимых пределах (свои id, ранги не выше открытого к уровню)
function cleanPart(hero, i, part, lv, cfg) {
  const ids = (ABILITIES[hero] || []).map(a => a.id), ab = {}, src = part && part.ab && typeof part.ab === 'object' ? part.ab : {};
  ids.forEach((id, k) => { const r = src[id]; if (Number.isInteger(r) && r > 0 && schoolOfAbility(hero, id, cfg) === i) { const m = Math.min(r, ranksOpenAt(lv, cfg, k, ABILITIES[hero][k])); if (m > 0) ab[id] = m; } });
  const skills = {}; for (const [id, r] of Object.entries(sanitizeSkills(part && part.skills, hero))) if (schoolOfTalent(hero, id, cfg) === i) skills[id] = r;
  const bar = Array.isArray(part && part.bar) ? part.bar.slice(0, 6).map(id => (typeof id === 'string' && ab[id] ? id : null)) : [];
  return { ab, skills, bar };
}
// прогресс героя из сохранения → со школами. Сохранение без школ (до 2026-10-22): школа — ветка, куда вложено больше всего,
// вложенное в другие ветки уходит в их школы (ничего не пропадает)
export function schoolsOf(hero, prog, pr, cfg) {
  if (Number.isInteger(pr.school) && pr.school >= 0 && pr.school < SCHOOLS) {
    const sch = {}; if (pr.sch && typeof pr.sch === 'object') for (let i = 0; i < SCHOOLS; i++) if (i !== pr.school && pr.sch[i]) { const p = cleanPart(hero, i, pr.sch[i], prog.lv, cfg); if (sum(p.ab) + sum(p.skills)) sch[i] = p; }
    return { ...prog, school: pr.school, sch };
  }
  const parts = [0, 1, 2].map(i => cleanPart(hero, i, { ab: prog.ab, skills: prog.skills, bar: prog.bar }, prog.lv, cfg));
  let best = 0; for (let i = 1; i < SCHOOLS; i++) if (sum(parts[i].ab) + sum(parts[i].skills) > sum(parts[best].ab) + sum(parts[best].skills)) best = i;
  const sch = {}; parts.forEach((p, i) => { if (i !== best && sum(p.ab) + sum(p.skills)) sch[i] = { ...p, bar: [] }; });
  const B = parts[best];
  return { ...prog, school: best, sch, ab: B.ab, skills: B.skills, bar: B.bar, ap: freeAp(prog.lv, B.ab, cfg), sp: freeSp(prog.lv, B.skills) };
}
