// Сбор группы (4.07, решение владельца): подземелье отряда — на 4, рейд — на 10. При входе группа добирается наёмниками-ботами
// по раскладу ролей (cfg.party): герой занимает место своей роли, нанятые спутники — свои; на выходе наёмники уходят и в
// сохранение не попадают. Наёмник — спутник-герой нужной роли (защитник держит угрозу, лекарь лечит, бойцы бьют) в полную силу
// уровня героя. Чистая логика (Node-тесты); числа и имена — cfg.party.
import { spawnAlly, refreshAlly } from './squad3d.js';

export const roleOfType = T => (!T ? 'melee' : T.role === 'tank' ? 'tank' : T.role === 'heal' ? 'heal' : T.ranged || T.role === 'ranged' ? 'ranged' : 'melee');
export const heroRole = W => { const r = W.cfg.party && W.cfg.party.heroRole[W.hero]; return (Array.isArray(r) ? r[W.school || 0] : r) || 'melee'; };     // школы (2026-10-22): роль по школе
const groupOf = def => (!def ? null : def.raid ? 'raid' : def.inst ? 'dungeon' : null);
// сколько каждой роли не хватает: { tank, heal, melee, ranged }
export function partyNeed(W, def) {
  const P = W.cfg.party, g = groupOf(def); if (!P || !P.on || !g) return null;
  const need = { ...P[g] }; need[heroRole(W)] = Math.max(0, (need[heroRole(W)] || 0) - 1);
  for (const a of W.allies) { if (a.dead || a.guest || a.story) continue; const r = roleOfType(W.cfg.squad.types[a.type]);     // наёмники, что уже с героем, — тоже группа
    if (need[r] > 0) need[r]--; else { const dps = need.melee > 0 ? 'melee' : need.ranged > 0 ? 'ranged' : null; if (dps && (r === 'melee' || r === 'ranged')) need[dps]--; } }     // лишний боец закрывает место другого бойца
  return need;
}
// добрать группу: список наёмников [{ name, role }]
export function fillParty(W, def) {
  const need = partyNeed(W, def); if (!need) return [];
  const P = W.cfg.party, out = [], used = new Set(W.allies.map(a => a.name).filter(Boolean)); let k = W.aid || 0;
  for (const role of ['tank', 'heal', 'melee', 'ranged']) for (let i = 0; i < (need[role] || 0); i++) {
    const types = P.bots[role].filter(t => W.cfg.squad.types[t] && W.cfg.squad.types[t].hero !== W.hero), type = types[i % types.length] || P.bots[role][0];
    const a = spawnAlly(W, type); a.lfg = true; refreshAlly(W, a); a.hp = a.maxhp;     // метка — до пересчёта: полная сила
    const names = P.names[role]; let nm = names[(k++ * 7 + i) % names.length]; for (let j = 0; used.has(nm) && j < names.length; j++) nm = names[(names.indexOf(nm) + 1) % names.length]; used.add(nm);
    a.name = `${nm} · ${P.roleName[role]}`; out.push({ name: a.name, role });
  }
  if (out.length) W.ev.push({ k: 'partyFill', list: out, size: W.allies.filter(a => !a.dead && !a.guest && !a.story).length + 1 });
  return out;
}
// выход на поверхность: наёмники уходят
export function dismissHired(W) { const n = W.allies.filter(a => a.lfg).length; if (n) { W.allies = W.allies.filter(a => !a.lfg); W.ev.push({ k: 'partyLeave', n }); } return n; }
// после перехода (levels3d → travel): в подземелье отряда или рейд — добор, наверх — роспуск
export function partyTravel(W, id) { const L = W.levels && W.levels[id]; if (!L || !L.def) { dismissHired(W); return; } if (groupOf(L.def)) fillParty(W, L.def); }
