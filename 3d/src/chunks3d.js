// Участки земли (C3a): что растёт на участке CHUNK×CHUNK м — деревья, камни, трава. У каждого участка своё зерно, поэтому
// участок можно построить в любой момент и в любом порядке: результат один и тот же. Чистая логика (проверяется в Node).
import { mulberry32 } from './sim.js';
import { propsBlocked } from './map.js';
import { waterDist, streamDist, CHUNK } from './terrain3d.js';
import { pathSegs, distSeg } from './world3d.js';
import { biomeAt } from './worldgen3d.js';
import { inCliff } from './cliffs3d.js';

export { CHUNK };
const seedOf = (seed, ci, cj, salt) => (Math.imul(seed * 73856093 ^ ci * 19349663 ^ cj * 83492791, 2654435761) ^ salt) >>> 0;
// рощи (G2): гладкий шум 0..1 → доля леса от lo до 1 (с запасом boost кандидатов: в роще гуще прежнего, на полянах — пусто)
export function groveAt(GR, x, z) {
  if (!GR) return 1; const k = 1 / GR.scale;
  const v = .5 + .25 * (Math.sin(x * k * 1.7 + Math.sin(z * k * 1.3) * 1.6) + Math.sin(z * k * 1.9 + Math.sin(x * k * 1.1) * 1.4));
  return GR.lo + (1 - GR.lo) * Math.max(0, Math.min(1, (v - .38) / .3));
}
// деревья и камни: плотность — как раньше (world.props на кольцо от 7 м до края)
export function propsIn(map, cfg, ci, cj) {
  // биом по месту каждого дерева: кандидатов — по самой густой плотности, лишние отсеиваются (в ядре плотность прежняя)
  const R = cfg.world.radius, area = Math.PI * ((R - 1) * (R - 1) - 49), T = cfg.worldgen && cfg.worldgen.on ? cfg.worldgen.trees : null;
  const GR = T && cfg.worldgen.groves, boost = GR ? GR.boost : 1, core = T ? cfg.worldgen.coreR : Infinity;
  const kMax = T ? Math.max(1, ...Object.values(T).map(t => t[0])) : 1, n = Math.round(cfg.world.props * CHUNK * CHUNK / area * kMax * boost);
  const r = mulberry32(seedOf(cfg.world.seed, ci, cj, 11)), out = [];
  for (let i = 0; i < n; i++) {
    const x = ci * CHUNK + r() * CHUNK, z = cj * CHUNK + r() * CHUNK, keep = r(), pick = r(), seed = (r() * 4294967296) >>> 0, d = Math.hypot(x, z);
    const bio = T && biomeAt(cfg, x, z), B = bio ? T[bio] : [1, .65, 0];      // биом: плотность, доля деревьев, доля сухих
    if (keep > B[0] / kMax * (d < core ? 1 / boost : groveAt(GR, x, z)) || d < 7 || d > R - 1 || propsBlocked(map, x, z)) continue;     // за ядром — рощами (G2)          // не в домах, на тропах, в областях и у воды
    out.push({ tree: pick < B[1], x, z, seed, bare: B[2] });
  }
  // край мира: стволы по кругу (на побережье — нет, там море)
  const step = 7.6 / (R + 1.5);
  for (let k = 0; k < Math.ceil(Math.PI * 2 / step); k++) {
    const a = k * step, x = Math.cos(a) * (R + 1.5), z = Math.sin(a) * (R + 1.5);
    if (x < ci * CHUNK || x >= (ci + 1) * CHUNK || z < cj * CHUNK || z >= (cj + 1) * CHUNK || biomeAt(cfg, x * .99, z * .99) === 'coast') continue;
    out.push({ tree: true, x, z, seed: seedOf(cfg.world.seed, k, 0, 47), bare: .5, edge: true });
  }
  // за краем (4.05): пояс леса или скал — декорация, пройти туда нельзя
  const HZ = cfg.world.horizon; if (HZ && HZ.on && T) { const rb = mulberry32(seedOf(cfg.world.seed, ci, cj, 53)), nb = Math.round(CHUNK * CHUNK / HZ.belt.per);
    for (let i = 0; i < nb; i++) {
      const x = ci * CHUNK + rb() * CHUNK, z = cj * CHUNK + rb() * CHUNK, pick = rb(), seed = (rb() * 4294967296) >>> 0, d = Math.hypot(x, z);
      if (d < R + HZ.belt.r[0] || d > R + HZ.belt.r[1]) continue;
      const bio = biomeAt(cfg, x * (R - 2) / d, z * (R - 2) / d) || 'forest'; if (bio === 'coast') continue;
      const B = T[bio] || [1, .65, 0], woods = bio === 'forest' || bio === 'swamp';
      if (!woods && pick > .55) continue;     // в горах и пустошах — реже, зато скалы
      out.push({ tree: woods ? pick < .92 : pick < .12, x, z, seed, bare: B[2], edge: true, beyond: true });
    } }
  return out;
}
// трава: сетка с шагом step м со сдвигом, только где можно (не тропа, не вода, не дом, не препятствие, в мире)
export function grassIn(map, cfg, ci, cj, segs = pathSegs(map)) {
  const G = cfg.wind.grass, R = cfg.world.radius - 2, r = mulberry32(seedOf(cfg.world.seed, ci, cj, 29)), out = [];
  const gk = (x, z) => { const b = biomeAt(cfg, x, z); return b && cfg.worldgen.grass ? cfg.worldgen.grass[b] : 1; };     // в пустоши и на берегу травы мало
  const x0 = ci * CHUNK, z0 = cj * CHUNK, m = 2 + G.step, near = segs.filter(([a, b]) => Math.max(a.x, b.x) > x0 - m && Math.min(a.x, b.x) < x0 + CHUNK + m && Math.max(a.z, b.z) > z0 - m && Math.min(a.z, b.z) < z0 + CHUNK + m);     // запас на шаг: последний ряд травы заходит за край участка
  const inBox = (ax0, ax1, az0, az1) => ax1 > x0 - m && ax0 < x0 + CHUNK + m && az1 > z0 - m && az0 < z0 + CHUNK + m;     // только то, что рядом с участком
  const blds = map.buildings.filter(b => inBox(b.x0, b.x1, b.z0, b.z1)), sols = map.solids.filter(q => inBox(q.x - q.r, q.x + q.r, q.z - q.r, q.z + q.r));
  for (let x = x0; x < x0 + CHUNK; x += G.step) for (let z = z0; z < z0 + CHUNK; z += G.step) {
    const px = x + r() * G.step, pz = z + r() * G.step, s = .7 + r() * .6, rot = r() * Math.PI;
    if (Math.hypot(px, pz) > R || r() > G.fill * gk(px, pz) || Math.hypot(px, pz) < 3) continue;
    if (map.river && (waterDist(map.river, px, pz) < 1.2 || streamDist(map.river, px, pz) < .5)) continue;     // не в воде и не в ручье
    if (inCliff(map.plateaus, px, pz, .4)) continue;
    if (blds.some(b => px > b.x0 - .5 && px < b.x1 + .5 && pz > b.z0 - .5 && pz < b.z1 + .5)) continue;
    if (sols.some(q => Math.hypot(q.x - px, q.z - pz) < q.r + .3)) continue;
    if (near.some(([a, b]) => distSeg(px, pz, a, b) < 1.4)) continue;
    out.push({ x: px, z: pz, s, rot });
  }
  return out;
}
// участки, которые нужны вокруг точки (центр участка ближе view м), ближние — первыми
export function chunksAround(x, z, view, R) {
  const out = [], c0 = Math.floor((x - view) / CHUNK), c1 = Math.floor((x + view) / CHUNK), d0 = Math.floor((z - view) / CHUNK), d1 = Math.floor((z + view) / CHUNK);
  for (let ci = c0; ci <= c1; ci++) for (let cj = d0; cj <= d1; cj++) {
    const cx = (ci + .5) * CHUNK, cz = (cj + .5) * CHUNK, d = Math.hypot(cx - x, cz - z);
    if (d < view + CHUNK * .71 && Math.hypot(cx, cz) < R + CHUNK * 1.6) out.push({ ci, cj, d });     // 4.05: и пояс за краем
  }
  return out.sort((a, b) => a.d - b.d);
}
