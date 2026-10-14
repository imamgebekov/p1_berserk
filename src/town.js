// Город: кто из NPC рядом с героем.
import { CFG } from './config.js';
import { P } from './state.js';

export const TOWN_NPCS = [
  { id: 'merchant', name: 'Торговец', x: () => CFG.town.merchantX },
  { id: 'smith', name: 'Кузнец', x: () => CFG.town.smithX }
];

export function nearNpc() {
  let best = null, bd = CFG.town.talkRange;
  for (const n of TOWN_NPCS) {
    const d = Math.abs(P.x - n.x());
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}
