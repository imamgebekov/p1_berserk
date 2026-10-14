// Навыки: ранги, очки, сброс, итоговые модификаторы. Без DOM.
import { CFG } from './config.js';
import { P } from './state.js';
import { SKILLS, SKILL_IDS } from './data/skills.js';
import { chat } from './chat.js';
import { emit } from './events.js';

export const rankOf = id => P.skills[id] || 0;
export const spentPoints = () => SKILL_IDS.reduce((s, id) => s + rankOf(id), 0);

// Модификаторы от навыков (дёшево: 8 чтений)
export function mods() {
  const E = CFG.skills.effects, r = rankOf;
  return {
    heavy: r('heavy') * E.heavy.heavyMult + r('chain') * E.chain.finisherMult,
    chainHits: r('chain') * E.chain.extraHits,
    crit: r('crit') * E.crit.crit,
    rage: r('brandGain') * E.brandGain.rage,
    brandSeconds: r('brandDur') * E.brandDur.seconds,
    hp: r('vigor') * E.vigor.hp,
    healMult: 1 + r('fireHeal') * E.fireHeal.healMult,
    healRadius: r('fireHeal') * E.fireHeal.radius,
    speed: r('swift') * E.swift.speed
  };
}

// 'ok' | 'max' | 'locked' | 'points' | 'unknown'
export function canLearn(id) {
  const s = SKILLS[id];
  if (!s) return 'unknown';
  if (rankOf(id) >= s.max) return 'max';
  if (s.req && rankOf(s.req) < 1) return 'locked';
  if (P.sp < 1) return 'points';
  return 'ok';
}

export function learn(id, recalc) {
  const r = canLearn(id);
  if (r !== 'ok') return r;
  P.skills[id] = rankOf(id) + 1; P.sp--;
  recalc();
  emit('save');
  return 'ok';
}

export const respecCost = () => CFG.skills.respecBase + CFG.skills.respecPerLevel * P.lv;

// Сбросить все навыки за пепел: очки возвращаются. 'ok' | 'ash' | 'none'
export function respec(recalc) {
  const n = spentPoints();
  if (!n) return 'none';
  const cost = respecCost();
  if (P.ash < cost) return 'ash';
  P.ash -= cost; P.sp += n; P.skills = {};
  recalc();
  chat('', 'Навыки сброшены: очков ' + P.sp, 'sys');
  emit('save');
  return 'ok';
}
