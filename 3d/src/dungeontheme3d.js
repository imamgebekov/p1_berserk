// Стили подземелий (4.14, просьба владельца 2026-10-22): не только тёмный склеп — светлая зелёная пещера, ледяной грот,
// кузня с лавой, затопленный храм. Стиль — на подземелье: свет, туман, цвет пола и стен, фон (dungeonbg3d), светящиеся
// кристаллы, грибы или лава в залах. Только вид. Числа и привязка к подземельям — config3d.js → dungeons.themes.
import * as THREE from 'three';

export function themeOf(cfg, def) {
  const T = cfg.dungeons && cfg.dungeons.themes; if (!T || !T.on) return null;
  const id = (def && (def.theme || T.by[def.id] || (def.abyss ? T.abyss : null))) || T.def;
  return { id, ...T.list[id] };
}
// светящиеся вещи в залах: по glow.n на зал, у стен, не в проходах; по хешу номера зала — стабильно
export function glowParts(M, th, open) {
  const G = th && th.glow; if (!G || !G.n) return null;
  const parts = [], h = (a, b) => Math.abs(Math.sin(a * 12.9898 + b * 78.233) * 43758.5453) % 1;
  for (const r of M.rooms) {
    if (r.corridor || r.shape === 'round' || r.shape === 'oct') continue;
    for (let k = 0; k < G.n; k++) {
      const u = h(r.i, k), v = h(r.i + 50, k), side = Math.floor(h(r.i + 99, k) * 4), w = r.x1 - r.x0, d = r.z1 - r.z0;
      const x = side < 2 ? r.x0 + .6 + u * (w - 1.2) : side === 2 ? r.x0 + .7 : r.x1 - .7, z = side < 2 ? (side ? r.z1 - .7 : r.z0 + .7) : r.z0 + .6 + v * (d - 1.2);
      if (open && open(x, z)) continue;
      if (G.kind === 'lava') { parts.push(new THREE.CircleGeometry(.8 + u * .9, 9).rotateX(-Math.PI / 2).scale(1, 1, .6 + v * .5).translate(x, .02, z)); continue; }
      for (let c = 0; c < 3; c++) {     // кристаллы или грибы — гроздь из трёх
        const s = .5 + h(r.i + c, k + 7) * .7, ox = (h(r.i, k + c * 3) - .5) * .7, oz = (h(r.i + 3, k + c) - .5) * .7;
        const g = G.kind === 'mushroom' ? new THREE.CylinderGeometry(.22 * s, .06 * s, .35 * s, 7).translate(0, .45 * s, 0) : new THREE.ConeGeometry(.16 * s, .9 * s, 5).translate(0, .45 * s, 0).rotateZ((h(r.i, c) - .5) * .5);
        parts.push(g.translate(x + ox, 0, z + oz));
      }
    }
  }
  return parts.length ? parts.map(g => (g.index ? g.toNonIndexed() : g)) : null;
}
