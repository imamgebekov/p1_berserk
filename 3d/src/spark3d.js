// «Первая искра» (шаг 12 аудита): обучающая цепочка сразу после выбора героя — к торговцу, прогнать бесов за оградой,
// собрать травы или руду (4.01), вернуться к костру, вложить очко навыка. Потом цель — ближайший неоткрытый костёр. Строка цели не бывает пустой,
// у цели есть точка для миникарты. Чистые функции (проверяются в Node); состояние — W.spark { i, kills, trader, done }.
import { insideCamp } from './map.js';

const camp = W => (W.levels ? W.levels.surface.map : W.map).camp;
const merchant = W => { const b = (W.levels ? W.levels.surface.map : W.map).buildings.find(q => q.npc && q.npc.kind === 'merchant'); return b ? b.npc : null; };
const spent = W => Object.values(W.skills || {}).reduce((a, b) => a + b, 0);
const outside = (W, x, z) => { const C = camp(W); return !C || !insideCamp(C, x, z, 0); };

// шаги: text(W) — строка цели, at(W) — точка цели для миникарты или null, done(W) — выполнен
export const SPARK = [
  { id: 'trader', text: () => 'Первая искра: загляните к торговцу в лагере', at: W => merchant(W), done: W => W.spark.trader || W.nearNpc === 'merchant' },
  { id: 'imps', text: W => `Первая искра: прогоните врагов за оградой — ${Math.min(W.spark.kills, W.cfg.spark.kills)}/${W.cfg.spark.kills}`, at: W => nearestFoe(W), done: W => W.spark.kills >= W.cfg.spark.kills },
  { id: 'gather', text: () => 'Первая искра: соберите травы, руду или тушу за оградой (подойдите, E)', at: W => nearestNode(W), done: W => W.spark.gathered || !(W.cfg.life && W.cfg.life.on && ((W.levels ? W.levels.surface.map : W.map).nodes || []).length) },     // 4.01: сбор — до костра (без мест сбора шаг пропускается)
  { id: 'fire', text: () => 'Первая искра: вернитесь к костру в лагере', at: () => ({ x: 0, z: 0 }), done: W => Math.hypot(W.player.x, W.player.z) < W.cfg.spark.fireR },
  { id: 'skill', text: W => (W.sp > 0 ? 'Первая искра: вложите очко в навыки (кнопка со звездой)' : 'Первая искра: наберите опыт до следующего уровня'), at: () => null, done: W => spent(W) > 0 }
];
function nearestNode(W) {
  const p = W.player; let best = null, bd = Infinity;
  for (const n of (W.levels ? W.levels.surface.map : W.map).nodes || []) { const d = Math.hypot(n.x - p.x, n.z - p.z); if (d < bd) { bd = d; best = n; } }
  return best ? { x: best.x, z: best.z } : null;
}
function nearestFoe(W) {
  let best = null, bd = Infinity; const p = W.player;
  for (const e of W.enemies) if (!e.dead && !e.boss && outside(W, e.x, e.z)) { const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < bd) { bd = d; best = e; } }
  if (best) return { x: best.x, z: best.z };
  const C = camp(W); return C ? { x: C.x + (C.r + 8) * Math.sin(1), z: C.z + (C.r + 8) * Math.cos(1) } : null;     // никого — за ограду
}

// новое состояние; ветерану (старое сохранение с прогрессом) цепочка не нужна
export const sparkFresh = W => ({ i: 0, kills: 0, trader: false, gathered: false, done: W.lv > 1 || W.kills > 0 });
// событие мира: убийство за оградой засчитывается на шаге «бесы»
export function sparkEvent(W, v) {
  const S = W.spark; if (!S || S.done) return;
  if (v.k === 'die' && SPARK[S.i] && SPARK[S.i].id === 'imps' && outside(W, v.x, v.z)) S.kills++;
  if (v.k === 'gather') S.gathered = true;
}
// раз в кадр: продвигает цепочку; вернёт 'step' (шаг выполнен) или 'done' (цепочка пройдена, награда выдана) или null
export function sparkTick(W) {
  const S = W.spark; if (!S || S.done) return null;
  if (!SPARK[S.i].done(W)) return null;
  S.i++; if (S.i < SPARK.length) return 'step';
  S.done = true; W.inv.ash += W.cfg.spark.ash; return 'done';
}
// строка и точка цели: событие и задания решает main.js; здесь — цепочка или ближайший неоткрытый костёр
export function goalOf(W) {
  const S = W.spark;
  if (S && !S.done) { const s = SPARK[S.i]; return { text: s.text(W), at: s.at(W) }; }
  const M = W.levels ? W.levels.surface.map : W.map, p = W.player; let best = null, bd = Infinity;
  for (const f of M.fires || []) if (!f.home && !(W.fires && W.fires[f.id])) { const d = Math.hypot(f.x - p.x, f.z - p.z); if (d < bd) { bd = d; best = f; } }
  if (best) return { text: `Цель: найдите костёр «${best.name}»`, at: { x: best.x, z: best.z } };
  return { text: 'Цель: исследуйте мир и одолейте хранителей замков', at: null };
}
// состояние из сохранения (защита от мусора)
export function sanitizeSpark(s, W) {
  if (!s || typeof s !== 'object') return sparkFresh(W);
  const i = Number.isInteger(s.i) ? Math.max(0, Math.min(SPARK.length - 1, s.i)) : 0;
  return { i, kills: Number.isFinite(s.kills) ? Math.max(0, Math.min(99, Math.floor(s.kills))) : 0, trader: !!s.trader, gathered: !!s.gathered, done: !!s.done };
}
