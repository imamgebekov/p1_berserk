// Древо навыков: три ветки по пять навыков. Навык k в ветке открывается, когда в ветке уже вложено k × tierStep очков.
// stats: бонус за один ранг (те же ключи, что у вещей, плюс arc, rollcd, regen, stealth, trade).
export const BRANCHES = [
  { id: 'rage', name: 'Ярость', color: '#e8643a', skills: [
    { id: 'hand', name: 'Тяжёлая рука', max: 5, stats: { dmg: 2 }, text: '+2 урона за ранг' },
    { id: 'thirst', name: 'Жажда крови', max: 4, stats: { leech: 1.5 }, text: '+1,5% вампиризма за ранг' },
    { id: 'roar', name: 'Рёв', max: 5, stats: { crit: 3 }, text: '+3% шанс крита за ранг' },
    { id: 'sweep', name: 'Широкий замах', max: 3, stats: { arc: 14 }, text: '+14° ширины удара за ранг' },
    { id: 'frenzy', name: 'Неистовство', max: 4, stats: { swingMul: .95 }, text: 'удары быстрее на 5% за ранг' }
  ] },
  { id: 'guard', name: 'Стойкость', color: '#7fb069', skills: [
    { id: 'temper', name: 'Закалка', max: 5, stats: { hp: 10 }, text: '+10 здоровья за ранг' },
    { id: 'skin', name: 'Толстая кожа', max: 5, stats: { armor: 2 }, text: '+2 брони за ранг' },
    { id: 'breath', name: 'Второе дыхание', max: 4, stats: { regen: .5 }, text: '+0,5 здоровья в секунду за ранг' },
    { id: 'tumble', name: 'Кувырок', max: 4, stats: { rollcd: .08 }, text: 'перекат восстанавливается на 0,08 с быстрее за ранг' },
    { id: 'will', name: 'Несгибаемый', max: 3, stats: { hp: 8, armor: 2 }, text: '+8 здоровья и +2 брони за ранг' }
  ] },
  { id: 'wander', name: 'Скиталец', color: '#5d9cec', skills: [
    { id: 'step', name: 'Лёгкая поступь', max: 5, stats: { spd: 2 }, text: '+2% скорости за ранг' },
    { id: 'nose', name: 'Чутьё добычи', max: 5, stats: { luck: 4 }, text: '+4 удачи за ранг' },
    { id: 'eye', name: 'Меткий глаз', max: 3, stats: { reach: .2 }, text: '+0,2 дальности удара за ранг' },
    { id: 'sneak', name: 'Тихий шаг', max: 4, stats: { stealth: 6 }, text: 'шум тише: враги слышат на 6% ближе за ранг' },
    { id: 'haggle', name: 'Торговая жилка', max: 4, stats: { trade: 5 }, text: '+5% к цене продажи за ранг' }
  ] }
];
export const TIER_STEP = 3;           // очков в ветке на каждый следующий навык
export const SKILLS = Object.fromEntries(BRANCHES.flatMap(b => b.skills.map((s, i) => [s.id, { ...s, branch: b.id, tier: i }])));
export const MAX_RANKS = BRANCHES.flatMap(b => b.skills).reduce((a, s) => a + s.max, 0);

export const spentIn = (skills, branchId) => BRANCHES.find(b => b.id === branchId).skills.reduce((a, s) => a + (skills[s.id] || 0), 0);
// можно ли вложить очко в навык
export function canRank(skills, id, sp) {
  const s = SKILLS[id]; if (!s) return 'none';
  if ((skills[id] || 0) >= s.max) return 'max';
  if (spentIn(skills, s.branch) < s.tier * TIER_STEP) return 'locked';
  if (sp < 1) return 'sp';
  return 'ok';
}
// суммарный бонус навыков
export function skillStats(skills) {
  const g = {};
  for (const id of Object.keys(skills)) { const s = SKILLS[id]; if (!s) continue; const r = skills[id]; for (const [k, v] of Object.entries(s.stats)) { if (k === 'swingMul') g.swingMul = (g.swingMul || 1) * Math.pow(v, r); else g[k] = (g[k] || 0) + v * r; } }
  return g;
}
export const sanitizeSkills = d => { const out = {}; if (d && typeof d === 'object') for (const id of Object.keys(d)) { const s = SKILLS[id]; if (s && Number.isFinite(d[id]) && d[id] > 0) out[id] = Math.min(s.max, Math.floor(d[id])); } return out; };
