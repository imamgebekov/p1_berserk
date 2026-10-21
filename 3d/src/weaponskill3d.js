// Умение оружия (2026-10-18): у клеймёного (оранжевого) и золотого оружия — своё умение по типу оружия, клавиша F, общая
// перезарядка. Форму задаёт тип, стихию — сплав камней или свойство вещи (кладётся наверняка). Золотое сильнее и в конце даёт
// «Солнце». Удары — через готовое: abilityHit, abilityArrow, рывок героя. Числа — config3d.js → wskill.
import { BY_ID } from './data/items.js';
import { familyOf } from './anim3d.js';
import { canWield } from './data/heroes3d.js';
import { abilityHit, abilityArrow, sunFlash } from './sim.js';
import { applyStatus } from './status3d.js';
import { len } from './util3d.js';

export const WSKILL = {
  cleave: { name: 'Двойной разрез', icon: '⟳', fam: 'slash', text: 'Два широких взмаха вокруг себя.' },
  lunge: { name: 'Пронзающий выпад', icon: '➵', fam: 'thrust', text: 'Рывок на 6 м сквозь врагов: удар каждому на пути.' },
  shatter: { name: 'Раскол земли', icon: '✸', fam: 'smash', text: 'Удар о землю: волна вокруг, оглушение и трещина.' },
  reap: { name: 'Жатва', icon: '☾', fam: 'spin', text: 'Огромный замах перед собой, врагов отбрасывает.' },
  tempest: { name: 'Цепная буря', icon: '❂', fam: 'flail', text: 'Цепь крутится вокруг героя и бьёт всех рядом.' },
  elemshot: { name: 'Стрела стихии', icon: '➹', fam: 'bow', text: 'Стрела пробивает всех на линии и взрывается у первой цели.' },
  orb: { name: 'Сфера стихии', icon: '◉', fam: 'staff', text: 'Медленная сфера проходит сквозь врагов и бьёт стихией всех вокруг себя.' }
};
const BY_FAM = Object.fromEntries(Object.entries(WSKILL).map(([id, s]) => [s.fam, id]));

// умение вещи it (или null): клеймёное и золотое оружие
export function skillOfItem(it, cfg) {
  if (!it || it.slot !== 'weapon' || it.rar < cfg.wskill.minRar) return null;
  const id = BY_FAM[familyOf(it.kind)]; return id ? { id, ...WSKILL[id], gold: it.rar >= 5 } : null;
}
// умение в руке героя (своё оружие)
export function weaponSkillOf(W) {
  const id = W.inv.eq.weapon, it = id && BY_ID[id]; if (!it || !canWield(W.hero, it)) return null;
  return skillOfItem(it, W.cfg);
}
const near = (W, r) => W.enemies.filter(e => !e.dead && len(e.x - W.player.x, e.z - W.player.z) < r + W.cfg.enemies[e.type].radius);
function faceNearest(W, r) { const p = W.player; let best = null, bd = r; for (const e of W.enemies) { if (e.dead) continue; const d = len(e.x - p.x, e.z - p.z); if (d < bd) { bd = d; best = e; } } if (best) p.face = Math.atan2(best.x - p.x, best.z - p.z); return best; }

const ACT = {
  cleave(W, S, k) { const L = near(W, S.r); if (!L.length) return false; for (const e of L) abilityHit(W, e, S.mul * k, { knock: S.knock, mix: true }); W.wsk = { kind: 'cleave', t: S.gap, k }; },
  lunge(W, S, k) {
    const p = W.player, e = faceNearest(W, S.dist + 2), dist = e ? Math.max(1.2, Math.min(S.dist, len(e.x - p.x, e.z - p.z) - W.cfg.enemies[e.type].radius - .7)) : S.dist;     // встаёт перед ближним врагом и остаётся с края группы, а не пролетает её (3.98)
    Object.assign(p, { state: 'dash', dashT: 0, dashDur: S.time * dist / S.dist, dashV: S.dist / S.time, dashX: Math.sin(p.face), dashZ: Math.cos(p.face), dashHit: [], dashMul: S.mul * k, dashKnock: 1, dashMix: true, dashW: S.width, atkT: 0 });
    p.inv = Math.max(p.inv, S.time);
  },
  shatter(W, S, k) { const L = near(W, S.r); for (const e of L) { abilityHit(W, e, S.mul * k, { knock: .5, mix: true }); if (!e.dead) { applyStatus(W, e, 'stun', 0, e.boss ? Math.min(S.stun, W.cfg.elements.bossStun) : S.stun); applyStatus(W, e, 'crack', 0, S.crack); } } W.shake = Math.max(W.shake, W.cfg.fx.shake * 2.2); },
  reap(W, S, k) {
    const p = W.player; faceNearest(W, S.r + 1); let hit = 0;
    for (const e of near(W, S.r)) { const d = Math.atan2(e.x - p.x, e.z - p.z) - p.face; if (Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) > S.cone / 2 * Math.PI / 180) continue; abilityHit(W, e, S.mul * k, { knock: S.knock, heavy: true, mix: true }); hit++; }
    if (!hit) return false; W.shake = Math.max(W.shake, W.cfg.fx.shake * 1.8);
  },
  tempest(W, S, k) { if (!near(W, S.r).length) return false; W.wsk = { kind: 'tempest', t: S.t, acc: S.tick, k }; W.player.inv = Math.max(W.player.inv, .3); },
  orb(W, S, k) { const p = W.player; faceNearest(W, 18); abilityArrow(W, p.face, S.mul * k, { pierce: 99, mixAll: true, kind: 'orb', speedK: S.speed, pulse: { r: S.r, every: S.every, k: S.k, acc: 0 } }); },
  elemshot(W, S, k) { const p = W.player, e = faceNearest(W, 18); abilityArrow(W, p.face, S.mul * k, { pierce: S.pierce, mixAll: true, eblast: { r: S.r, k: S.k }, kind: 'elem' }); void e; }
};

// применить умение оружия: 'ok' | 'none' (нет умения) | 'cd' | 'busy' | 'target' (некого бить — перезарядка не тратится)
export function useWeaponSkill(W) {
  const s = weaponSkillOf(W), p = W.player; if (!s) return 'none';
  if ((W.wcd || 0) > 0) return 'cd';
  if (p.dead || p.state === 'roll' || p.state === 'dash') return 'busy';
  const S = W.cfg.wskill, k = s.gold ? S.gold : 1;
  if (ACT[s.id](W, S[s.id], k) === false) return 'target';
  W.wcd = S.cd; W.ev.push({ k: 'wskill', id: s.id, x: p.x, z: p.z, face: p.face, r: S[s.id].r || 0, gold: s.gold, el: W.wp.mix ? [W.wp.mix.a, W.wp.mix.b] : W.wp.el ? [W.wp.el] : [] });
  if (s.gold && W.wp.pm.sun && s.id !== 'tempest' && s.id !== 'cleave') sunFlash(W, p);     // золото: «Солнце» в конце
  return 'ok';
}
// раз в шаг: перезарядка, второй взмах «Двойного разреза», «Цепная буря»
export function tickWeaponSkill(W, dt) {
  if (W.wcd > 0) W.wcd = Math.max(0, W.wcd - dt);
  const b = W.wsk; if (!b) return;
  const S = W.cfg.wskill;
  if (b.kind === 'cleave') { if ((b.t -= dt) <= 0) { for (const e of near(W, S.cleave.r)) abilityHit(W, e, S.cleave.mul * b.k, { knock: S.cleave.knock, mix: true }); W.ev.push({ k: 'wskill2', x: W.player.x, z: W.player.z }); if (W.wcd > 0 && W.wp.pm.sun && b.k > 1) sunFlash(W, W.player); W.wsk = null; } return; }
  if (b.kind === 'tempest') {
    b.t -= dt; b.acc += dt;
    while (b.acc >= S.tempest.tick) { b.acc -= S.tempest.tick; for (const e of near(W, S.tempest.r)) abilityHit(W, e, S.tempest.mul * b.k, { knock: .3, mix: true }); }
    if (b.t <= 0 || W.player.dead) { if (b.k > 1 && W.wp.pm.sun) sunFlash(W, W.player); W.wsk = null; }
  }
}
// для интерфейса: { name, text, cd, cdMax, gold } или null
export function weaponSkillView(W) { const s = weaponSkillOf(W); return s ? { ...s, cd: W.wcd || 0, cdMax: W.cfg.wskill.cd } : null; }
