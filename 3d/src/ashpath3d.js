// «Путь пепла» (шаг 13 аудита): одна нить игры из готового — костры, боссы, склеп, финал. Босс-веха после первой победы
// засчитана навсегда (возрождается только «эхо» ради добычи — бой не меняется). Системы открываются по вехам: кузнец и журнал —
// после первой победы над боссом, наём — с уровня cfg.path.squadLv, блок сета — когда надеты 2 вещи одного сета.
// Чистые функции (проверяются в Node); состояние — W.path { slain: {тип: true}, crypt, sets, end, shown }.
import { setCounts } from './inv.js';

const surf = W => (W.levels ? W.levels.surface.map : W.map);
const firesLit = W => Object.keys(W.fires || {}).filter(id => !(surf(W).fires || []).some(f => f.id === id && f.home)).length;
const lair = (W, type) => { const d = W.cfg.bosses.list.find(b => b.type === type); return d ? { x: d.x, z: d.z } : null; };
const bossName = (W, type) => (W.cfg.enemies[type] || {}).name || type;

// вехи: text(W) — что сделать, at(W) — где (для миникарты), done(W) — сделано
export const PATH = [
  { id: 'fires', text: W => `зажгите костры — ${Math.min(firesLit(W), W.cfg.path.fires)}/${W.cfg.path.fires}`, at: W => nearFire(W), done: W => firesLit(W) >= W.cfg.path.fires },
  { id: 'devourer', boss: 'devourer' },
  { id: 'crypt', text: () => 'пройдите Склеп Погоста до сокровищницы', at: W => { const d = W.cfg.dungeons.list.find(q => q.id === 'crypt_pogost'); return d ? { x: d.at.x, z: d.at.z } : null; }, done: W => !!W.path.crypt },
  { id: 'lord', boss: 'lord' },
  { id: 'chief', boss: 'chief' },
  { id: 'end', text: () => 'путь пройден', at: () => null, done: () => true }
].map(s => (s.boss ? { ...s, text: W => `одолейте: ${bossName(W, s.boss)}`, at: W => lair(W, s.boss), done: W => !!W.path.slain[s.boss] } : s));
function nearFire(W) {
  const p = W.player; let best = null, bd = Infinity;
  for (const f of surf(W).fires || []) if (!f.home && !(W.fires && W.fires[f.id])) { const d = Math.hypot(f.x - p.x, f.z - p.z); if (d < bd) { bd = d; best = f; } }
  return best ? { x: best.x, z: best.z } : null;
}
// номер текущей вехи (первая несделанная)
export const pathIndex = W => { const i = PATH.findIndex(s => !s.done(W)); return i < 0 ? PATH.length - 1 : i; };
// новое состояние; ветерану — по уже сделанному (убитые боссы из бестиария)
export function pathFresh(W) {
  const slain = {}; for (const s of PATH) if (s.boss && W.known && W.known.bestiary && W.known.bestiary[s.boss]) slain[s.boss] = true;
  return { slain, crypt: false, sets: setCounts(W.inv).some(c => c.n >= 2), end: false, shown: false };
}
export function sanitizePath(s, W) {
  if (!s || typeof s !== 'object') return pathFresh(W);
  const slain = {}; for (const st of PATH) if (st.boss && s.slain && s.slain[st.boss] === true) slain[st.boss] = true;
  return { slain, crypt: !!s.crypt, sets: !!s.sets, end: !!s.end, shown: !!s.shown };
}
// событие мира: победа над боссом (первая — навсегда)
export function pathEvent(W, v) { if (W.path && v.k === 'bossdead' && v.type) W.path.slain[v.type] = true; }
// раз в кадр (или реже): склеп, сеты, вехи; вернёт { k: 'step', i, text } при новой вехе, { k: 'end' } при финале, иначе null
export function pathTick(W) {
  const P = W.path; if (!P) return null;
  if (!P.crypt && W.lvl === 'crypt_pogost') { const r = W.map.rooms && W.map.rooms.find(q => q.id === 'vault'), p = W.player; if (r && p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1) P.crypt = true; }
  if (!P.sets && setCounts(W.inv).some(c => c.n >= 2)) P.sets = true;
  const i = pathIndex(W), was = P.at ?? i; P.at = i;
  if (PATH[i].id === 'end' && !P.end) { P.end = true; return { k: 'end' }; }
  return i > was ? { k: 'step', i, text: PATH[i].text(W) } : null;
}
// строка цели и точка: «Путь пепла 2/6: …»
export function pathGoal(W) { const i = pathIndex(W), s = PATH[i]; return s.id === 'end' ? null : { text: `Путь пепла ${i + 1}/${PATH.length - 1}: ${s.text(W)}`, at: s.at(W) }; }
// что открыто: кузнец и журнал — после первой победы над боссом; наём — с уровня; блок сета — после 2 вещей сета
export function unlocks(W) {
  const P = W.path || { slain: {} }, boss = Object.keys(P.slain).length > 0 || !W.cfg.path.on;
  return { smith: boss, journal: boss, squad: !W.cfg.path.on || W.lv >= W.cfg.path.squadLv, sets: !W.cfg.path.on || !!P.sets };
}
// когда откроется закрытый житель — для подсказки
export const lockedHint = (W, npc) => (npc === 'smith' ? 'Кузнец раздует горн, когда падёт Пожиратель Погоста' : npc === 'captain' ? `Капитан берёт под начало героя с ${W.cfg.path.squadLv}-го уровня` : '');
