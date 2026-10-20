// «Новый круг» (этап 6 плана «круче»): после финала Акта IV сюжет и задания начинаются заново, уровень, вещи, пепел,
// подвиги и отряд остаются. Враги на каждом круге крепче и злее, элита чаще и всегда с двумя свойствами. Числа — cfg.ng.
import { storyFresh } from './story3d.js';

export const ngOpen = W => !!(W.cfg.ng && W.cfg.ng.on && W.story && W.story.st === 'end');
export function startNg(W) {
  if (!ngOpen(W)) return false;
  W.ng = (W.ng || 0) + 1; W.story = storyFresh(); W.quests = {};
  W.ev.push({ k: 'ngStart', n: W.ng });
  return true;
}
// множители врага на круге: здоровье, урон; прибавка к шансу элиты
export const ngMul = W => { const N = W.cfg.ng, n = (N && N.on && W.ng) || 0; return { hp: 1 + N.hp * n, dmg: 1 + N.dmg * n, elite: N.elite * n, dual: n > 0 }; };
