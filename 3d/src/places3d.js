// Места и туман войны: определение места под героем и открытие клеток карты.
import { placeAt } from './map.js';
import { questEvent } from './quests3d.js';

// ---- места и карта ----
export function trackPlace(W, dt) {
  const p = W.player, pl = placeAt(W.map, p.x, p.z);
  if ((pl && pl.id) !== (W.place && W.place.id)) { W.place = pl; if (pl) { if (W.lvl === 'surface' || !W.lvl) W.known.places[pl.id] = 1; questEvent(W, 'visit', { place: pl.id }); } W.ev.push({ k: 'place', place: pl }); }
  if ((W.revealT -= dt) <= 0) { W.revealT = .3; reveal(W, p.x, p.z, W.revR || W.cfg.map.reveal); }
}
export function reveal(W, x, z, r) {
  const c = W.seenC || W.cfg.map.cell, R = W.seenR || W.cfg.world.radius, n = W.seenN, ox = W.seenX || 0, oz = W.seenZ || 0; x -= ox; z -= oz; const i0 = Math.floor((x - r + R) / c), i1 = Math.floor((x + r + R) / c), j0 = Math.floor((z - r + R) / c), j1 = Math.floor((z + r + R) / c);     // seenX/Z — центр сетки (Мир 5.0)
  for (let j = Math.max(0, j0); j <= Math.min(n - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(n - 1, i1); i++) {
    const cx = (i + .5) * c - R, cz = (j + .5) * c - R; if (Math.hypot(cx - x, cz - z) <= r + c * .5) W.seen[j * n + i] = 1;
  }
}
export const isSeen = (W, x, z) => { const c = W.seenC || W.cfg.map.cell, R = W.seenR || W.cfg.world.radius, i = Math.floor((x - (W.seenX || 0) + R) / c), j = Math.floor((z - (W.seenZ || 0) + R) / c); return i >= 0 && j >= 0 && i < W.seenN && j < W.seenN && W.seen[j * W.seenN + i] === 1; };

