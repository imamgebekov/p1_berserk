// Общий бот героя (2026-10-23): вынесен из heroes-balance3d без изменений — им же играет outer3d (пояса уровней).
// Один уровень ума у всех героев, разный стиль: умения по ситуации, стрелки держат дистанцию, перекат от замаха.
import { aliveEnemies } from '../3d/src/sim.js';
import { lineBlocked, resolve, insideOf } from '../3d/src/map.js';
import { upgradeAbility, useAbility, heroAbilities } from '../3d/src/abilities3d.js';
import { resNow } from '../3d/src/resource3d.js';
import { schoolOfAbility } from '../3d/src/school3d.js';
import { ABILITIES } from '../3d/src/data/abilities3d.js';

export const RANGED = h => h === 'jay' || h === 'irga';     // стрелки: держат дистанцию

// школа бота (школы героев, 2026-10-22): боты написаны под все 8 базовых умений, поэтому по умолчанию школа не ограничивает; HB_SCHOOL=main — основная школа героя (больше базовых умений), HB_SCHOOL=n — школа n
export const mainSchool = (hero, cfg) => { const n = [0, 0, 0]; for (const a of ABILITIES[hero].slice(0, 8)) n[schoolOfAbility(hero, a.id, cfg) || 0]++; return process.env.HB_SCHOOL === 'main' ? n.indexOf(Math.max(...n)) : Number(process.env.HB_SCHOOL); };
export function spend(W) { const L = heroAbilities(W).slice(0, 8).filter(a => !process.env.HB_SCHOOL || (schoolOfAbility(W.hero, a.id, W.cfg) || 0) === (W.school || 0)); for (let pass = 0; pass < 6; pass++) for (const a of L) upgradeAbility(W, a.id); }     // бот — на прежних 8 умениях (новые умения древа — test/actives3d.mjs)

// ---- боты: один уровень ума, разный стиль ----
export const SKIP = (process.env.HB_SKIP || '').split(',').filter(Boolean).map(Number);     // умения, которые бот не жмёт (поиск сильного)
export const near = (W, r) => aliveEnemies(W).filter(e => Math.hypot(e.x - W.player.x, e.z - W.player.z) < r).length;
export const ready = (W, i) => { const a = heroAbilities(W)[i]; return a && (W.ab[a.id] || 0) > 0 && !(W.acd[a.id] > 0) && resNow(W) >= (W.cfg.abilities[W.hero][a.id].cost || 0); };     // и ресурса хватает
export function abilities(W, hero, tgt, bd) {
  if (process.env.HB_NOAB) return;
  const p = W.player, low = p.hp < p.maxhp * .5, use = i => !SKIP.includes(i) && ready(W, i) && useAbility(W, i) === 'ok';
  if (hero === 'thorn') {
    if (low && use(3)) return; if ((low || near(W, 6) >= 3) && use(1)) return; if (near(W, 3.4) >= 2 && use(2)) return;
    if (bd < 2.5 && p.hp > p.maxhp * .6 && use(4)) return;
    if (bd > 3 && bd < 6 && aliveEnemies(W).filter(o => Math.hypot(o.x - tgt.x, o.z - tgt.z) < 4).length <= 2 && use(0)) return;     // рывок — к одиночке, не в гущу
  } else if (hero === 'jay') {
    if (bd < 3 && use(0)) return; if (near(W, 14) >= 2 && use(4)) return; if (bd < 7 && tgt.alert && use(2)) return;
    if (near(W, 12) >= 2 && use(1)) return; if (bd < 14 && use(3)) return;
  } else if (hero === 'irga') {                                // Ирга: щит при беде, кольцо вплотную, по толпе — метеор, вьюга, облако; копьё — по сильным
    if ((low || near(W, 6) >= 2) && use(5)) return; if (near(W, 3.2) >= 1 && use(1)) return;     // кольцо льда — оторваться
    if (near(W, 14) >= 3 && (use(4) || use(6))) return; if (near(W, 14) >= 2 && use(3)) return;
    if ((tgt.boss || tgt.elite || tgt.maxhp > 150) && bd < 16 && use(7)) return;
    if (bd < 14 && use(2)) return; if (bd < 14 && use(0)) return;
  } else if (hero === 'warlock') {                             // Морок: бес у ног, ужас при беде, порча и рок по сильным, похищение — когда ранен
    if (!W.allies.some(a => a.imp && !a.dead) && near(W, 10) >= 1 && use(2)) return; if ((low || near(W, 4) >= 3) && use(3)) return;
    if (p.hp < p.maxhp * .75 && bd < 9 && use(1)) return; if (near(W, 12) >= 2 && use(4)) return;
    if (bd < 11 && !(tgt.st && tgt.st.crack) && use(0)) return; if ((tgt.elite || tgt.boss || tgt.maxhp > 150) && bd < 13 && use(7)) return;
    if (bd < 12 && use(6)) return; if (resNow(W) < 30 && p.hp > p.maxhp * .7 && use(5)) return;
  } else if (hero === 'priest' || hero === 'brand' || hero === 'hunter') {     // новые герои: общий бот по виду умения (лечение, оберег, по площади, выстрел, рывок)
    const L = heroAbilities(W), kind = i => (L[i] && ((W.cfg.abilities[hero][L[i].id] || {}).kind || L[i].kind)) || '';
    for (let i = 0; i < Math.min(8, L.length); i++) { const k = kind(i);
      if ((k === 'heal' || k === 'gheal') && p.hp < p.maxhp * .6 && use(i)) return;
      if ((k === 'ward' || k === 'buff') && (low || near(W, 8) >= 2) && use(i)) return;
      if (['nova', 'cone', 'field', 'cloud', 'zone', 'pull'].includes(k) && near(W, 6) >= 2 && use(i)) return;
      if (['bolt', 'mark'].includes(k) && bd < 12 && use(i)) return;
      if (k === 'strike' && bd < 3 && use(i)) return;
      if (k === 'dash' && bd > 4 && bd < 8 && use(i)) return; }
  } else {
    if (tgt.hp < tgt.maxhp * .35 && bd < 2.6 && use(4)) return; if ((low || near(W, 6) >= 3) && use(3)) return;
    if (near(W, 3) >= 2 && use(2)) return; if (bd > 4 && bd < 8 && use(0)) return;
  }
}
// отход стрелка: из 8 направлений — свободное (без стен, домов и деревьев на 2 м) и самое далёкое от врагов
export function escape(W, en) {
  const p = W.player; let best = null, bs = -1e9;
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, x = p.x + Math.sin(a) * 2, z = p.z + Math.cos(a) * 2;
    if (lineBlocked(W.map, p.x, p.z, x, z) || insideOf(W.map, x, z) >= 0 || resolve(W.map, { x, z }, .6) || Math.hypot(x, z) > W.cfg.world.radius - 3) continue;
    if (W._anchor && Math.hypot(x - W._anchor.x, z - W._anchor.z) > W._anchor.r && Math.hypot(x - W._anchor.x, z - W._anchor.z) > Math.hypot(p.x - W._anchor.x, p.z - W._anchor.z)) continue;     // у логова босса: не уводить его за поводок
    const s = Math.min(...en.map(e => Math.hypot(e.x - x, e.z - z))); if (s > bs) { bs = s; best = a; } }
  return best === null ? null : { mx: Math.sin(best), mz: Math.cos(best) };
}
export function bot(W, cfg, hero, en, dodge) {
  const p = W.player, inp = { mx: 0, mz: 0, attack: false, roll: false };
  let tgt = null, bd = 1e9; for (const e of en) { const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < bd) { bd = d; tgt = e; } }
  if (!tgt || bd > 30) return inp;
  const C = cfg.enemies[tgt.type], ux = (tgt.x - p.x) / bd, uz = (tgt.z - p.z) / bd, winding = tgt.state === 'wind' && bd < C.range + 1.2 && tgt.t > C.wind * .6;
  abilities(W, hero, tgt, bd);
  if (RANGED(hero)) {                                         // держит дистанцию 5–(дальность) и стреляет; вплотную — отходит
    const range = W.wp.trait.range * .85;
    const clear = !lineBlocked(W.map, p.x, p.z, tgt.x, tgt.z);
    if (bd < 4.5) { const es = escape(W, en); if (es) { inp.mx = es.mx; inp.mz = es.mz; } else { inp.mx = ux * .09; inp.mz = uz * .09; } if (bd < 2.2 && p.rollCd <= 0 && dodge() < .6) inp.roll = true; }     // отходит (в углу — стоит)
    else if (bd > range) { inp.mx = ux; inp.mz = uz; }
    else { inp.mx = ux * .09; inp.mz = uz * .09; }               // лёгкий шаг к цели — повернуться
    inp.attackPress = clear && bd < W.wp.trait.range;            // стреляет и на отходе: лук сам доворачивает на ближайшего видимого
    if (winding && p.rollCd <= 0 && dodge() < .5) { const es = escape(W, en); inp.roll = true; inp.mx = es ? es.mx : -ux; inp.mz = es ? es.mz : -uz; }
    return inp;
  }
  const reach = cfg.player.attackRange + W.gear.reach + C.radius * .5;
  if (bd > reach * .8) { inp.mx = ux; inp.mz = uz; }
  inp.attackPress = bd < reach + .4;
  if (winding && dodge() < .5) {
    if (hero === 'vale' && ready(W, 1)) useAbility(W, 1);       // Вейл парирует вместо переката, если может
    else if (p.rollCd <= 0) inp.roll = true;
  }
  return inp;
}
