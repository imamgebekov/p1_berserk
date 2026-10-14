// Дерево навыков: три ветки, 8 узлов. Числа эффектов — в config.js (skills.effects).
import { CFG } from '../config.js';

const E = () => CFG.skills.effects;
const pct = v => Math.round(v * 100);

export const BRANCHES = [
  { id: 'blade', name: 'Меч', nodes: ['heavy', 'chain', 'crit'] },
  { id: 'brand', name: 'Клеймо', nodes: ['brandGain', 'brandDur'] },
  { id: 'grit', name: 'Выживание', nodes: ['vigor', 'fireHeal', 'swift'] }
];

// req — узел, который нужно изучить хотя бы на 1 ранг; effect(r) — текст эффекта на ранге r
export const SKILLS = {
  heavy:     { name: 'Сокрушение',     max: 3, req: null,        desc: 'Тяжёлый удар бьёт сильнее.', effect: r => `Тяжёлый удар +${pct(r * E().heavy.heavyMult)}% урона` },
  chain:     { name: 'Длинная цепь',   max: 2, req: 'heavy',     desc: 'Цепочка ударов длиннее, завершающий удар сильнее.', effect: r => `Цепочка ${3 + r * E().chain.extraHits} удара, завершающий +${pct(r * E().chain.finisherMult)}%` },
  crit:      { name: 'Меткость',       max: 2, req: 'chain',     desc: 'Удары чаще находят слабое место.', effect: r => `Шанс крита +${r * E().crit.crit}%` },
  brandGain: { name: 'Жажда',          max: 2, req: null,        desc: 'Клеймо наполняется быстрее.', effect: r => `Набор Клейма +${r * E().brandGain.rage}%` },
  brandDur:  { name: 'Тлеющее Клеймо', max: 3, req: 'brandGain', desc: 'Клеймо горит дольше.', effect: r => `Клеймо длится на ${(r * E().brandDur.seconds).toFixed(1).replace('.0', '')} с дольше` },
  vigor:     { name: 'Живучесть',      max: 3, req: null,        desc: 'Больше здоровья.', effect: r => `Здоровье +${r * E().vigor.hp}` },
  fireHeal:  { name: 'Целебный огонь', max: 3, req: 'vigor',     desc: 'Костёр лечит быстрее и дальше.', effect: r => `Лечение у костра +${pct(r * E().fireHeal.healMult)}%, радиус +${r * E().fireHeal.radius}` },
  swift:     { name: 'Лёгкая поступь', max: 2, req: 'fireHeal',  desc: 'Быстрее ходьба.', effect: r => `Скорость +${r * E().swift.speed}%, перекат быстрее на ${(r * E().swift.rollCd).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')} с` }
};

export const SKILL_IDS = Object.keys(SKILLS);
export const TOTAL_RANKS = SKILL_IDS.reduce((s, id) => s + SKILLS[id].max, 0);
