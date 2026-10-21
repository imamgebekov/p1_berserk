// Рисованные значки умений (2026-10-21, выбор владельца): Painterly Spell Icons, J. W. Bjerk (eleazzaar), CC BY 3.0 —
// автор указан в 3d/ART-CREDITS.md и в меню. Значок — «семейство-цвет-сила» (как в наборе: fireball-red-2).
// Магии значок даётся по стихии и виду действия; удары оружием (рывок, рассечение, залп) остаются силуэтами game-icons.
import { ABILITIES } from './abilities3d.js';

// прежние умения героев — вручную; null — силуэт
const OLD = {
  charge: null, cry: 'horror-red', whirl: null, iron: 'protect-orange', rage: 'enchant-red', bash: null, quake: 'rock-plain', blood: 'enchant-magenta',
  fireball: 'fireball-red', nova: 'ice-sky', chain: 'lightning-blue', cloud: 'wild-acid', meteor: 'explosion-orange', shield: 'protect-royal', blizzard: 'ice-blue', spear: 'beam-eerie',
  hex: 'evil-eye-eerie', drain: 'beam-red', summon: 'wild-eerie', terror: 'horror-eerie', grasp: 'vines-eerie', pact: 'enchant-eerie', souls: 'fireball-eerie', doom: 'evil-eye-red',
  leap: 'haste-sky', volley: null, trap: 'vines-plain', venom: 'fireball-acid', rain: null, frost: 'ice-jade', firearrow: 'explosion-red', hawk: 'enchant-orange',
  blink: 'wind-magenta', parry: 'protect-blue', dance: null, shadow: 'horror-acid', execute: null, fan: null, smoke: 'wind-blue', bloodlet: 'explosion-magenta'
};
// новые умения древа: вид × стихия → семейство-цвет; «-» — силуэт
const BY = {
  bolt: { fire: 'fireball-red', ice: 'ice-sky', storm: 'lightning-blue', shadow: 'fireball-eerie', venom: 'fireball-acid', blood: 'beam-red', light: 'beam-orange', earth: 'rock-plain' },
  nova: { fire: 'explosion-red', ice: 'ice-blue', storm: 'lighting-royal', shadow: 'horror-eerie', blood: 'explosion-magenta', light: 'beam-orange', earth: 'rock-orange', venom: 'wild-acid' },
  cone: { fire: 'explosion-orange', ice: 'wind-sky', storm: 'lightning-orange', shadow: 'wind-magenta', blood: 'explosion-red', earth: 'rock-orange' },
  zone: { fire: 'explosion-orange', ice: 'ice-jade', storm: 'lighting-sky', shadow: 'runes-magenta', light: 'beam-orange', earth: 'rock-plain', blood: 'runes-orange' },
  field: { fire: 'explosion-red', ice: 'ice-blue', storm: 'lighting-royal', blood: 'runes-magenta', earth: 'vines-plain', shadow: 'runes-royal' },
  cloud: { venom: 'wild-acid' },
  pull: { shadow: 'wind-magenta', blood: 'wind-red', steel: 'wind-blue', earth: 'vines-jade' },
  mark: { shadow: 'evil-eye-eerie', fire: 'runes-orange', ice: 'runes-blue', steel: 'runes-royal', blood: 'evil-eye-red' },
  strike: { shadow: 'horror-eerie', venom: 'enchant-acid', blood: 'enchant-red' },
  dash: { fire: 'haste-fire', storm: 'haste-royal' },
  heal: { earth: 'heal-jade', water: 'heal-sky', blood: 'heal-royal', light: 'heal-jade', shadow: 'heal-royal' }
};
const BUFF = { armor: { ice: 'protect-sky', light: 'protect-orange', steel: 'protect-blue', _: 'protect-jade' }, spd: { fire: 'haste-fire', storm: 'haste-royal', _: 'haste-sky' }, regen: { _: 'leaf-jade' },
  dmg: { fire: 'enchant-red', blood: 'enchant-magenta', shadow: 'enchant-eerie', _: 'enchant-orange' }, crit: { ice: 'enchant-sky', storm: 'enchant-royal', blood: 'enchant-red', _: 'enchant-orange' }, leech: { blood: 'enchant-magenta', _: 'enchant-red' } };
const ST = { root: { earth: 'vines-plain', shadow: 'vines-eerie' }, fear: { shadow: 'horror-eerie', blood: 'horror-red' } };     // состояние важнее вида

const hash = s => [...s].reduce((h, c) => Math.imul(h, 31) + c.charCodeAt(0) | 0, 7) >>> 0;
// семейство-цвет умения def (или null — силуэт)
export function artFamily(def) {
  if (!def) return null;
  if (!def.kind) return OLD[def.id] ?? null;
  if (def.kind === 'buff') { const t = BUFF[def.p.stat] || {}; return t[def.el] || t._ || null; }
  const s = def.st && ST[def.st]; if (s && s[def.el]) return s[def.el];
  return (BY[def.kind] || {})[def.el] || null;
}
// полный значок: семейство-цвет-сила (1–3); сила — от id, чтобы у соседей с одним семейством значки различались
export function artOf(def) { const f = artFamily(def); return f ? `${f}-${1 + hash(def.id) % 3}` : null; }
// ключ значка древа ('n:<id>') → имя файла; только для умений
export const ART = Object.fromEntries(Object.values(ABILITIES).flat().map(a => ['n:' + a.id, artOf(a)]).filter(([, v]) => v));
