// Лагерь крупнее (2026-10-21, просьба владельца): ядро мира раздвигается от центра одним правилом. До rin м всё отходит
// от центра в k раз, от rin до rout — плавный переход (на rout — прежнее место), дальше ничего не меняется.
// Так вместе двигаются частокол, дома, сундуки, места, участки, боссы, входы, люк Бездны и река — расстояния между ними растут.
// Числа — config3d.js → world.stretch. Чистая логика.
export function warpOf(cfg) {
  const S = cfg.world && cfg.world.stretch; if (!S || !S.on || S.k === 1) return null;
  const { k, rin, rout } = S, f = d => (d <= rin ? d * k : d >= rout ? d : rin * k + (d - rin) * (rout - rin * k) / (rout - rin));
  const warp = p => { const d = Math.hypot(p.x, p.z); if (d < 1e-9 || d >= rout) return p; const s = f(d) / d; p.x *= s; p.z *= s; return p; };
  warp.scale = (x, z) => { const d = Math.hypot(x, z); return d < 1e-9 ? k : d >= rout ? 1 : f(d) / d; };     // во сколько раз растянуто место у точки
  return warp;
}
// раздвинуть ядро в исходных данных мира (один раз)
export function stretchCore(base) {
  const w = warpOf(base); if (!w || base.world.stretched) return base; base.world.stretched = true;
  const M = base.map, S = base.world.stretch;
  for (const b of M.buildings) w(b);
  for (const s of M.spots || []) w(s);
  for (const p of M.places || []) { const s = w.scale(p.x, p.z); w(p); if (p.r) p.r *= s; }
  for (const z of M.zones || []) { const s = w.scale(z.x, z.z); w(z); if (z.r) z.r *= s; if (z.w) { z.w *= s; z.d *= s; } }
  for (const b of (base.bosses && base.bosses.list) || []) if (Number.isFinite(b.x) && !b.level) w(b);     // боссы подземелий — в своих координатах
  for (const d of [...((base.dungeons && base.dungeons.list) || []), ...((base.instances && base.instances.list) || [])]) if (d.at && d.back) { const ox = d.back.x - d.at.x, oz = d.back.z - d.at.z; w(d.at); d.back = { x: d.at.x + ox, z: d.at.z + oz }; }     // выход наверху — рядом с люком, как было
  if (base.abyss && base.abyss.at) w(base.abyss.at);
  if (base.camp) { w(base.camp); base.camp.r *= S.k; }
  if (base.fires && base.fires.safeR) base.fires.safeR *= S.k;
  if (base.beasts && base.beasts.ring) base.beasts.ring = base.beasts.ring.map(v => v * S.k);
  return base;
}
// расстояние до растяжения: опасность места считается по нему — раздвинутый лагерь не делает окрестности опаснее
export function unwarpDist(cfg, d) {
  const S = cfg.world && cfg.world.stretch; if (!S || !S.on || S.k === 1 || d >= S.rout) return d;
  const { k, rin, rout } = S; return d <= rin * k ? d / k : rin + (d - rin * k) * (rout - rin) / (rout - rin * k);
}
