// Костры быстрого перемещения (C3d): у центрального костра лагеря, в каждом посёлке и у входа в каждое опасное место.
// Костёр открывается, когда герой подходит ближе open м (костёр лагеря открыт сразу). У открытого костра можно перенестись к
// любому другому открытому, если рядом нет встревоженных врагов. Костры — только вид и логика: не препятствия, бой не меняют.
// Чистая логика (проверяется в Node).
import { reveal } from './places3d.js';
import { resolve, nearBuilding, insideCamp } from './map.js';
import { waterDist } from './terrain3d.js';
import { inCliff } from './cliffs3d.js';

// свободное место рядом с (x, z): по спирали, не в доме, не у препятствий, не в воде и не у обрыва
function freeNear(map, x, z, maxR = 14) {
  const ok = (px, pz) => !nearBuilding(map, px, pz, 2.5) && map.solids.every(q => Math.hypot(q.x - px, q.z - pz) > q.r + 1.8) && (!map.river || waterDist(map.river, px, pz) > 3) && !inCliff(map.plateaus, px, pz, 2) && (!map.camp || !insideCamp(map.camp, px, pz, -2.5) || Math.hypot(px, pz) < 1) && !resolve(map, { x: px, z: pz }, 1.2);     // и не у частокола, не в стене
  for (let r = 0; r <= maxR; r += 1.5) for (let k = 0, n = Math.max(1, Math.round(r * 2)); k < n; k++) { const a = k / n * Math.PI * 2, px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r; if (ok(px, pz)) return { x: px, z: pz }; }
  return null;
}
export function firesOf(map, cfg) {
  const F = cfg.fires; if (!F || !F.on) return [];
  const out = [], camp = map.camp;
  if (camp) out.push({ id: 'camp', name: 'Костёр лагеря', x: 0, z: 0, home: true });
  for (const p of cfg.map.places || []) {
    if (camp && p.id === camp.place) continue;
    if (p.safe) { const s = freeNear(map, p.x, p.z); if (s) out.push({ id: p.id, name: p.name, x: s.x, z: s.z }); continue; }
    const a0 = Math.atan2(-p.x, -p.z); let s = null;                            // у входа: со стороны лагеря, а если там занято — дальше по кругу
    for (let k = 0; k < 16 && !s; k++) { const a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.PI / 8; s = freeNear(map, p.x + Math.sin(a) * (p.r + F.gate), p.z + Math.cos(a) * (p.r + F.gate), 4); }
    if (s) out.push({ id: p.id, name: 'У входа: ' + p.name, x: s.x, z: s.z, danger: p.danger });
  }
  return out;
}
const fireById = (W, id) => (W.levels ? W.levels.surface.map : W.map).fires.find(f => f.id === id);
// костёр рядом с героем (на поверхности)
export function fireNear(W) {
  if (W.lvl !== 'surface' || W.player.dead) return null;
  const p = W.player; return (W.map.fires || []).find(f => Math.hypot(f.x - p.x, f.z - p.z) < W.cfg.fires.reach) || null;
}
// открыть костры поблизости; true — открыт новый
export function discoverFires(W) {
  if (W.lvl !== 'surface') return false;
  const p = W.player, F = W.cfg.fires; let n = false; W.fires = W.fires || {};
  for (const f of W.map.fires || []) if (!W.fires[f.id] && (f.home || Math.hypot(f.x - p.x, f.z - p.z) < F.open)) { W.fires[f.id] = 1; if (!f.home) { n = true; W.ev.push({ k: 'fireFound', id: f.id, name: f.name, x: f.x, z: f.z }); } }
  return n;
}
// почему нельзя перенестись (строка) или null
export function travelBlock(W) {
  const p = W.player, F = W.cfg.fires;
  if (W.lvl !== 'surface') return 'Под землёй костров нет';
  if (!fireNear(W)) return 'Подойдите к костру';
  if (W.enemies.some(e => !e.dead && e.alert && Math.hypot(e.x - p.x, e.z - p.z) < F.safeR)) return 'Рядом враги';
  return null;
}
// перенос к открытому костру id
export function fastTravel(W, id) {
  const f = fireById(W, id); if (!f || !W.fires || !W.fires[id] || travelBlock(W)) return false;
  const p = W.player, a = Math.atan2(-f.x, -f.z) || 0;                          // встать у костра, со стороны лагеря
  Object.assign(p, { x: f.x + Math.sin(a) * 2.2, z: f.z + Math.cos(a) * 2.2, vx: 0, vz: 0, state: 'idle', atkT: 0, rollT: 0, face: a + Math.PI });
  p.inv = Math.max(p.inv, 1); resolve(W.map, p, W.cfg.player.radius);
  W.proj.length = 0; W.haz.length = 0; W.inside = -1;
  W.enemies = W.enemies.filter(e => e.boss || Math.hypot(e.x - p.x, e.z - p.z) < 40 && !e.alert);    // погоня не переносится
  W.allies.forEach((q, i) => { if (q.dead || q.guest) return; const b = p.face + Math.PI + (i - 1) * .9; q.x = p.x + Math.sin(b) * 1.6; q.z = p.z + Math.cos(b) * 1.6; q.vx = q.vz = 0; resolve(W.map, q, .45); });
  reveal(W, p.x, p.z, W.revR); W.revealT = .3;
  W.ev.push({ k: 'travel', to: 'surface', up: false, fire: id });
  return true;
}
export const knownFires = W => (W.levels ? W.levels.surface.map : W.map).fires.filter(f => W.fires && W.fires[f.id]);
export const sanitizeFires = (list, ids) => { const o = {}; if (Array.isArray(list)) for (const id of list) if (typeof id === 'string' && ids.includes(id)) o[id] = 1; return o; };
