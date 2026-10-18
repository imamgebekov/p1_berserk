// Статусы: горение, яд, кровотечение, заморозка, оглушение; метки стихий «мокрый», «разряд», «трещина»; замедление и «ослеп».
// Реакции между стихиями — в elements3d.js (при elements.react=false — только две прежние). Урон и события идут через W.fx.
import { react } from './elements3d.js';
export const STATUS_NAME = { burn: 'Горение', poison: 'Яд', bleed: 'Кровотечение', freeze: 'Заморозка', stun: 'Оглушение', fear: 'Страх', root: 'Корни', wet: 'Мокрый', shock: 'Разряд', crack: 'Трещина', slow: 'Замедление', blind: 'Ослеплён' };
export const STATUS_COLOR = { burn: '#ff8a30', poison: '#7ad060', bleed: '#d03030', freeze: '#7ac8ff', stun: '#ffe060', fear: '#c8a0ff', root: '#8ac060', wet: '#3f8fd0', shock: '#e9d24a', crack: '#b08a5c', slow: '#9ab8d0', blind: '#d8d8d8' };
export const DOT = ['burn', 'poison', 'bleed'];

// наложить статус на врага. dps/dur: для burn, poison, bleed — урон в секунду и длительность; для freeze, stun — длительность в dur
// дождь (шаг R): множитель свойства k при текущей силе дождя W.rain (1 — без дождя)
export const rainK = (W, k) => { const C = W.cfg.weather && W.cfg.weather.combat; return C && W.rain ? 1 + (C[k] - 1) * W.rain : 1; };
export function applyStatus(W, e, kind, dps, dur) {
  const C = W.cfg.enemies[e.type];
  if (e.dead || (C.immune && C.immune.includes(kind)) || (e.imm && e.imm.includes(kind))) return false;
  if (kind === 'burn') dur *= rainK(W, 'fire');                                // в дождь огонь гаснет быстрее
  const X = W.cfg.elements;
  if (X && X.react) {                                                         // таблица стихий: реакция вместо статуса или вместе с ним
    const v = { dps, dur };
    if (react(W, e, kind, v, (o, k, d, t) => applyStatus(W, o, k, d, t))) return true;
    return put(W, e, kind, v.dps, v.dur, v.hold);
  }
  const st = e.st || (e.st = {});
  if (kind === 'burn') {
    if (st.freeze) { delete st.freeze; if (!Object.keys(st).length) delete e.st; W.fx.react(e, 'Раскол', W.fx.hp(e, .07, 36)); return true; }                          // огонь по замёрзшему
    if (st.poison) { const n = st.poison.n; delete st.poison; if (!Object.keys(st).length) delete e.st; W.fx.react(e, 'Токсичный взрыв', 0, { r: 3.2, d: 12 * n }); return true; }   // огонь по отравленному
  }
  return put(W, e, kind, dps, dur);
}
// положить статус без реакций; hold — яд не спадает, пока враг замёрз или замедлен («Холодный яд»)
function put(W, e, kind, dps, dur, hold) {
  const st = e.st || (e.st = {});
  if (kind === 'burn') st.burn = { t: dur, dps };
  else if (kind === 'freeze') { delete st.burn; st.freeze = { t: Math.max(dur, st.freeze ? st.freeze.t : 0) }; }
  else if (kind === 'poison') { const n = Math.min(5, (st.poison ? st.poison.n : 0) + 1); st.poison = { t: dur, dps, n }; if (hold || (st.poison && st.poison.hold)) st.poison.hold = true; }
  else if (kind === 'bleed') st.bleed = { t: dur, dps };
  else if (kind === 'fear' || kind === 'root' || kind === 'blind') { if (e.boss) { if (!Object.keys(st).length) delete e.st; return false; } st[kind] = { t: Math.max(dur, st[kind] ? st[kind].t : 0) }; if (e.state === 'wind') { e.state = 'chase'; e.t = 0; e.cd = .6; } }     // страх, корни и пар (у боссов нет)
  else if (kind === 'stun') { st.stun = { t: Math.max(dur, st.stun ? st.stun.t : 0) }; if (e.state === 'wind') { e.state = 'chase'; e.t = 0; e.cd = .6; } }
  else if (kind === 'wet' || kind === 'shock') st[kind] = { t: Math.max(dur, st[kind] ? st[kind].t : 0) };
  else if (kind === 'crack') st.crack = { t: Math.max(dur, st.crack ? st.crack.t : 0), k: Math.max(dps || 0, st.crack ? st.crack.k || 0 : 0) || undefined };     // k — глубже трещина (Сейсмика)
  else if (kind === 'slow') st.slow = { t: Math.max(dur, st.slow ? st.slow.t : 0), k: Math.min(dps || .6, st.slow ? st.slow.k : 1) };
  else { if (!Object.keys(st).length) delete e.st; return false; }
  return true;
}
export const speedMul = e => (e.st && e.st.root ? 0 : e.st && e.st.freeze ? .55 : e.st && e.st.slow ? e.st.slow.k : 1);
export const isStunned = e => !!(e.st && (e.st.stun || e.st.blind));     // в пару враг теряет героя и не бьёт

// тик статусов врага (вызывается каждый кадр для живых)
export function tickEnemy(W, e, dt) {
  const st = e.st; if (!st) return;
  let dmg = 0, main = null, best = 0;
  const rot = st.poison && st.bleed && W.cfg.elements && W.cfg.elements.react ? W.cfg.elements.mix.rot.k : 1;     // «Гниль»: яд и кровь вместе бьют сильнее
  for (const k of DOT) { const s = st[k]; if (!s) continue; const d = s.dps * (s.n || 1) * dt * rot; dmg += d; if (d > best) { best = d; main = k; } if (!(s.hold && (st.freeze || st.slow))) s.t -= dt; if (s.t <= 0) delete st[k]; }
  for (const k of ['freeze', 'stun', 'fear', 'root', 'wet', 'shock', 'crack', 'slow', 'blind']) { const s = st[k]; if (s && (s.t -= dt) <= 0) delete st[k]; }
  if (dmg > 0) {
    e.hp -= dmg; e.dotAcc = (e.dotAcc || 0) + dmg; e.dotT = (e.dotT || 0) + dt; e.dotFx = main || e.dotFx;
    if (e.dotT >= 1) { W.ev.push({ k: 'dot', x: e.x, z: e.z, dmg: Math.round(e.dotAcc), fx: e.dotFx }); e.dotAcc = 0; e.dotT = 0; }
    if (e.hp <= 0) W.fx.kill(e);
  }
  if (!Object.keys(st).length) delete e.st;
}

// ---- статусы героя ----
export function applyPlayer(W, kind, dps, dur) {
  if (W.player.dead || !DOT.includes(kind)) return;
  if (kind === 'burn') dur *= rainK(W, 'fire');
  dps *= 1 - ((W.gear && W.gear.res && W.gear.res[kind]) || 0);     // камни в броне ослабляют горение, яд и кровотечение
  const st = W.pst, ex = st[kind];
  if (kind === 'poison') st.poison = { t: dur, dps, n: Math.min(5, (ex ? ex.n : 0) + 1) };
  else st[kind] = { t: Math.max(dur, ex ? ex.t : 0), dps };
  W.ev.push({ k: 'pstatus', kind, x: W.player.x, z: W.player.z });
}
export function tickPlayer(W, dt) {
  const st = W.pst; let dmg = 0;
  for (const k of DOT) { const s = st[k]; if (!s) continue; dmg += s.dps * (s.n || 1) * dt; s.t -= dt; if (s.t <= 0) delete st[k]; }
  if (dmg > 0) W.fx.dotPlayer(dmg);
}
export function cleansePlayer(W, kinds) { let any = false; for (const k of kinds) if (W.pst[k]) { delete W.pst[k]; any = true; } return any; }
