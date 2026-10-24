// Лагерь крупнее (2026-10-21, просьба владельца): ядро мира раздвигается от центра одним правилом. До rin м всё отходит
// от центра в k раз, от rin до rout — плавный переход (rout уходит на to, по умолчанию — на прежнее место), дальше — сдвиг на to − rout.
// Так вместе двигаются частокол, дома, сундуки, места, участки, боссы, входы, люк Бездны и река — расстояния между ними растут.
// Числа — config3d.js → world.stretch. Чистая логика.
export function warpOf(cfg) {
  const S = cfg.world && cfg.world.stretch; if (!S || !S.on || S.k === 1) return null;
  const { k, rin, rout } = S, to = S.to || rout, f = d => (d <= rin ? d * k : d >= rout ? d + to - rout : rin * k + (d - rin) * (to - rin * k) / (rout - rin));     // to (5.04) — куда уходит прежний край ядра rout; дальше всё сдвинуто на to − rout
  const warp = p => { const d = Math.hypot(p.x, p.z); if (d < 1e-9 || (d >= rout && to === rout)) return p; const s = f(d) / d; p.x *= s; p.z *= s; return p; };
  warp.scale = (x, z) => { const d = Math.hypot(x, z); return d < 1e-9 ? k : f(d) / d; };     // во сколько раз растянуто место у точки
  return warp;
}
// раздвинуть ядро в исходных данных мира (один раз)
export function stretchCore(base) {
  const w = warpOf(base); if (!w || base.world.stretched) return base; base.world.stretched = true;
  const M = base.map, S = base.world.stretch;
  // 5.04: место за rin едет целиком — с домами, сундуками, областью, боссом и входом вниз (посёлок не рвётся); прочее — по точкам
  const grp = (M.places || []).filter(p => Math.hypot(p.x, p.z) > S.rin && S.to && S.to !== S.rout).map(p => { const c = w({ x: p.x, z: p.z }), d = Math.hypot(c.x, c.z), m = p.type === 'danger' && S.dangerMin > d ? S.dangerMin / d : 1; return { p, dx: c.x * m - p.x, dz: c.z * m - p.z }; });     // логово — не ближе dangerMin м
  const own = q => { let best = null, bd = Infinity; for (const g of grp) { const d = Math.hypot(g.p.x - q.x, g.p.z - q.z); if (d < (g.p.r || 4) + 3 && d < bd) { bd = d; best = g; } } return best; };
  const mv = q => { const g = own(q); if (g) { q.x += g.dx; q.z += g.dz; return q; } return w(q); }, own0 = new Map();
  for (const b of M.buildings) own0.set(b, own(b)); for (const s of M.spots || []) own0.set(s, own(s)); for (const z of M.zones || []) own0.set(z, own(z));
  const go = q => { const g = own0.get(q); if (g) { q.x += g.dx; q.z += g.dz; } else w(q); };
  for (const b of M.buildings) go(b);
  for (const s of M.spots || []) go(s);
  for (const z of M.zones || []) { const s = own0.get(z) ? 1 : w.scale(z.x, z.z); go(z); if (z.r) z.r *= s; if (z.w) { z.w *= s; z.d *= s; } }
  for (const b of (base.bosses && base.bosses.list) || []) if (Number.isFinite(b.x) && !b.level) mv(b);     // боссы подземелий — в своих координатах
  for (const d of [...((base.dungeons && base.dungeons.list) || []), ...((base.instances && base.instances.list) || [])]) if (d.at && d.back) { const ox = d.back.x - d.at.x, oz = d.back.z - d.at.z; mv(d.at); d.back = { x: d.at.x + ox, z: d.at.z + oz }; }     // выход наверху — рядом с люком, как было
  for (const p of M.places || []) { const g = grp.find(q => q.p === p); if (g) { p.x += g.dx; p.z += g.dz; continue; } const s = w.scale(p.x, p.z); w(p); if (p.r) p.r *= s; }
  if (base.abyss && base.abyss.at) w(base.abyss.at);
  if (base.camp) { w(base.camp); base.camp.r *= S.k; }
  if (base.fires && base.fires.safeR) base.fires.safeR *= S.k;
  if (base.beasts && base.beasts.ring) base.beasts.ring = base.beasts.ring.map(v => v * S.k);
  return base;
}
// расстояние до растяжения: опасность места считается по нему — раздвинутый лагерь не делает окрестности опаснее
export function unwarpDist(cfg, d) {
  const S = cfg.world && cfg.world.stretch; if (!S || !S.on || S.k === 1 || (d >= S.rout && !(S.to > S.rout))) return d;
  const { k, rin, rout } = S, to = S.to || rout; return d <= rin * k ? d / k : d >= to ? d - (to - rout) : rin + (d - rin * k) * (rout - rin) / (to - rin * k);
}
