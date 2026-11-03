// Выход из рейда или подземелья кнопкой (2026-11-03, просьба владельца): с любого места, но если убиты не все боссы подземелья —
// теряется половина добычи этого захода (пепла и вещей); убиты все — без потерь. Добыча = то, что прибавилось к сумке и надетому с момента входа
// (слепок W.run при входе с поверхности). Обычный выход через портал ничего не отнимает. Чистая логика (проверяется в Node).
import { BY_ID, SLOTS } from './data/items.js';
import { removeAt } from './inv.js';
import { isInstance, travel, SURFACE } from './levels3d.js';

const counts = inv => { const c = {}; for (const s of inv.bag) c[s.id] = (c[s.id] || 0) + (s.n || 1); for (const sl of SLOTS) { const id = inv.eq[sl]; if (id) c[id] = (c[id] || 0) + 1; } return c; };     // надетое — тоже счёт: снять и надеть добычей не считается
// слепок при входе в подземелье с поверхности; вызывается из travel
export function runStart(W, from, to) { if (isInstance(W, to) && !isInstance(W, from)) W.run = { id: to, ash: W.inv.ash, n: counts(W.inv) }; }
export function runEnd(W) { W.run = null; }
// все ли боссы подземелья убиты
export function allBossesDead(W, id) { const bs = W.cfg.bosses.list.filter(b => b.level === id); return bs.length > 0 && bs.every(b => W.bossDead[b.type] !== undefined); }
// почему нельзя выйти (строка) или null
export function exitBlock(W) { if (W.player.dead) return 'Вы мертвы'; if (!isInstance(W, W.lvl)) return 'Это не подземелье'; return null; }
// что отнимется при выходе: { free, ash, items: { id: n } }; free — все боссы убиты. Нечётную долю решает W.rng
function loss(W, roll) {
  const R = W.run, X = W.cfg.instances.exit, out = { free: allBossesDead(W, W.lvl), ash: 0, items: {} }; if (out.free || !R) return out;
  const half = n => { const f = n * X.loss, w = Math.floor(f); return w + (roll && f - w > 0 && W.rng() < f - w ? 1 : 0); };     // без броска (подсказка) — округляем вниз
  out.ash = Math.min(W.inv.ash, half(Math.max(0, W.inv.ash - R.ash)));
  const now = counts(W.inv); for (const id in now) { const g = now[id] - (R.n[id] || 0); if (g > 0) { const n = half(g); if (n > 0) out.items[id] = n; } }
  return out;
}
export const exitPreview = W => loss(W, false);
// выйти на поверхность; 'ok' или причина. Вещи берём с конца сумки — самые поздние
export function exitRun(W) {
  if (exitBlock(W)) return 'block';
  const q = W.map.portals.find(p => p.up && !p.stair), L = loss(W, true), inv = W.inv; let n = 0;
  inv.ash -= L.ash;
  for (const id in L.items) { let left = L.items[id]; for (let i = inv.bag.length - 1; i >= 0 && left > 0; i--) { const s = inv.bag[i]; if (s.id !== id) continue; const t = Math.min(left, s.n || 1); removeAt(inv, i, t); left -= t; n += t; } }
  const ok = q ? travel(W, q.to, q.tx, q.tz) : travel(W, SURFACE, W.surfPos ? W.surfPos.x : 0, W.surfPos ? W.surfPos.z : 0);
  if (ok) W.ev.push({ k: 'runExit', free: L.free, ash: L.ash, items: n });
  return ok ? 'ok' : 'block';
}
export const itemName = id => (BY_ID[id] || {}).name || id;
