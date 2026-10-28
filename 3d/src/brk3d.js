// Бьющиеся бочки, ящики и кувшины (план физики, этап 4): в залах подземелий у стен, твёрдые (map.solids) с запасом ударов;
// разбит — твёрдое убрано (gone), событие smash (вид: обломки по удару), внутри мелочь — пепел и с шансом дешёвый расходник.
// Новая раскладка или возврат на уровень после dungeons.respawnAway — снова целы. Сундуки не бьются. Числа — cfg.phys.brk.
import { mulberry32, angDiff } from './sim.js';
import { len } from './util3d.js';
import { roomFree } from './map.js';

export const physBrk = cfg => (cfg.phys && cfg.phys.brk && cfg.phys.brk.on ? cfg.phys.brk : null);

// расставить по залам карты (только залы-комнаты; ключевые залы и коридоры — без них); seed — свой поток, бой наверху не сдвигается
export function placeBrk(cfg, map, seed) {
  const B = physBrk(cfg); if (!B || !map.rooms) return;
  const rnd = mulberry32(seed), out = map.brk = [], solids = map.solids || (map.solids = []);
  const nearLink = (x, z) => (map.links || []).some(l => Math.hypot(l.x - x, l.z - z) < B.linkGap);
  const nearThing = (x, z) => (map.portals || []).some(q => Math.hypot(q.x - x, q.z - z) < 2.5) || (map.containers || []).some(c => Math.hypot(c.x - x, c.z - z) < 1.6) || solids.some(q => Math.hypot(q.x - x, q.z - z) < q.r + B.gap);
  for (const r of map.rooms) {
    if (r.corridor || r.kind || r.fill === 'empty' || rnd() > B.room) continue;
    const n = B.n[0] + Math.floor(rnd() * (B.n[1] - B.n[0] + 1));
    for (let k = 0, tries = 0; k < n && tries < 30; tries++) {
      const side = rnd() * 3 | 0, u = rnd();     // у дальней стены (z0) или у боковых; ближняя к камере — без них
      const x = side === 0 ? r.x0 + 1 + u * (r.x1 - r.x0 - 2) : side === 1 ? r.x0 + .75 : r.x1 - .75, z = side === 0 ? r.z0 + .75 : r.z0 + 1 + u * (r.z1 - r.z0 - 2);
      if (!roomFree(r, x, z, .6) || nearLink(x, z) || nearThing(x, z)) continue;
      const t = B.kinds[rnd() * B.kinds.length | 0], D = B.kind[t];
      out.push({ i: out.length, t, x, z, r: D.r, hp: D.hp, max: D.hp, si: solids.length, gone: false, rot: rnd() * Math.PI * 2 }); solids.push({ x, z, r: D.r, brk: out.length - 1 }); k++;
    }
  }
}
// снова целы (новый заход на уровень)
export function resetBrk(map) { for (const b of map.brk || []) { b.gone = false; b.hp = b.max; if (map.solids[b.si]) map.solids[b.si].gone = false; } }

// удар героя дугой (half — полуугол, reach — дальность): бьёт целые предметы в дуге; вернёт число задетых
export function smashArc(W, x, z, face, half, reach, heavy) {
  const B = physBrk(W.cfg), L = W.map.brk; if (!B || !L || !L.length) return 0;
  let n = 0;
  for (const b of L) {
    if (b.gone) continue;
    const dx = b.x - x, dz = b.z - z, d = len(dx, dz);
    if (d > reach + b.r || Math.abs(angDiff(Math.atan2(dx, dz), face)) > half) continue;
    n++; b.hp -= heavy ? 2 : 1; W.ev.push({ k: 'brkHit', x: b.x, z: b.z, i: b.i, t: b.t });
    if (b.hp <= 0) smash(W, b, dx / (d || 1), dz / (d || 1));
  }
  return n;
}
function smash(W, b, dx, dz) {
  const B = physBrk(W.cfg); b.gone = true; if (W.map.solids[b.si]) W.map.solids[b.si].gone = true;
  W.ev.push({ k: 'smash', x: b.x, z: b.z, i: b.i, t: b.t, dx, dz });
  const ash = B.ash[0] + Math.floor(W.rng() * (B.ash[1] - B.ash[0] + 1)); if (ash > 0) { W.inv.ash += ash; W.ev.push({ k: 'ash', x: b.x, z: b.z, n: ash }); }
  if (W.rng() < B.item) { const id = B.items[W.rng() * B.items.length | 0], a = W.rng() * Math.PI * 2; W.drops.push({ id, n: 1, x: b.x + Math.sin(a) * .5, z: b.z + Math.cos(a) * .5, t: 0, cd: 0 }); W.ev.push({ k: 'drop', x: b.x, z: b.z, id }); }
}
