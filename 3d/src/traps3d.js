// Ловушки подземелий (план подземелий, этап 2в, решение владельца 2026-10-24): в коридорах главного пути — шипы, огненная решётка
// и маятник. Шипы и огонь работают по кругу: покой → предупреждение (плиты светятся) → удар; маятник качается поперёк коридора.
// Рычаг у входа в коридор (со стороны входа в подземелье) выключает ловушку навсегда, до новой раскладки. Бьют героя, отряд
// и врагов (не боссов) — долей запаса здоровья, раз за круг. Числа — config3d.js → dungeons.traps. Чистая логика.
const KINDS = ['spikes', 'fire', 'blade'];
// раскладка: ловушки в коридорах главного пути; corrOf(li) — прямоугольник коридора связи li; rnd — зерно захода
export function placeTraps(cfg, def0, L, rooms, rnd) {
  const T = cfg.dungeons.traps; if (!T || !T.on) return [];
  const lim = def0.raid ? T.raid : T.dungeon, want = lim[0] + Math.floor(rnd() * (lim[1] - lim[0] + 1)), out = [];
  const onPath = [], P = L.path; for (let i = 1; i < P.length; i++) { const li = L.links.findIndex(([a, b]) => (a === P[i - 1] && b === P[i]) || (a === P[i] && b === P[i - 1])); if (li >= 0) onPath.push({ li, from: P[i - 1] }); }
  const cand = onPath.filter(o => { const r = rooms.find(q => q.id === 'k' + o.li); return r && Math.max(r.w, r.d) >= T.minLen; });
  while (out.length < want && cand.length) {
    const o = cand.splice(Math.floor(rnd() * cand.length), 1)[0], r = rooms.find(q => q.id === 'k' + o.li), along = r.w >= r.d ? 'x' : 'z', A = L.cells[o.from];
    const dir = along === 'x' ? Math.sign(r.x - A.x) || 1 : Math.sign(r.z - A.z) || 1, len = along === 'x' ? r.w : r.d, wid = along === 'x' ? r.d : r.w;
    const kind = KINDS[Math.floor(rnd() * KINDS.length)], span = Math.min(T.span, len - 2);
    const lx = along === 'x' ? r.x - dir * (len / 2 + 1) : r.x + wid / 2 + 1.2, lz = along === 'x' ? r.z + wid / 2 + 1.2 : r.z - dir * (len / 2 + 1);     // рычаг — в зале перед коридором, сбоку от прохода: мимо него не пройти случайно
    out.push({ id: out.length, kind, along, x: r.x, z: r.z, w: along === 'x' ? span : wid, d: along === 'x' ? wid : span, period: T.period[kind], off: rnd() * T.period[kind], lever: { x: lx, z: lz }, on: true });
  }
  return out;
}
// фаза ловушки: { arm: 0–1 — предупреждение, hot: бьёт ли, swing: −1…1 — положение маятника, cycle: номер круга }
export function trapPhase(cfg, q, t) {
  const T = cfg.dungeons.traps, P = q.period, u = ((t + q.off) % P + P) % P, cycle = Math.floor((t + q.off) / P);
  if (!q.on) return { arm: 0, hot: false, swing: 0, cycle };
  if (q.kind === 'blade') return { arm: 0, hot: true, swing: Math.sin(u / P * Math.PI * 2), cycle };
  const W = T.warn, H = T.hot[q.kind], a0 = P - W - H;
  return { arm: u >= a0 && u < a0 + W ? (u - a0) / W : 0, hot: u >= a0 + W, swing: 0, cycle };
}
// точка в зоне удара ловушки (с запасом pad — радиус бойца)
export function trapHits(cfg, q, ph, x, z, pad = 0) {
  if (!ph.hot) return false;
  if (q.kind === 'blade') { const half = (q.along === 'x' ? q.d : q.w) / 2 - .4, bx = q.along === 'x' ? q.x : q.x + ph.swing * half, bz = q.along === 'x' ? q.z + ph.swing * half : q.z; return Math.hypot(x - bx, z - bz) < cfg.dungeons.traps.bladeR + pad; }
  return Math.abs(x - q.x) < q.w / 2 + pad && Math.abs(z - q.z) < q.d / 2 + pad;
}
// шаг: рычаги и удары. Каждая цель получает удар ловушки не чаще раза за круг (маятник — раз в полкруга); hurtPlayer — из sim.js (без кругового импорта)
export function trapsTick(W, hurtPlayer) {
  const M = W.map, T = W.cfg.dungeons.traps; if (!M.traps || !M.traps.length || !T) return;
  const p = W.player;
  for (const q of M.traps) {
    if (q.on && !p.dead && Math.hypot(p.x - q.lever.x, p.z - q.lever.z) < T.leverR) { q.on = false; W.ev.push({ k: 'lever', x: q.lever.x, z: q.lever.z, kind: q.kind }); continue; }
    const ph = trapPhase(W.cfg, q, W.t); if (!ph.hot) continue;
    const tick = q.kind === 'blade' ? Math.floor((W.t + q.off) / (q.period / 2)) : ph.cycle, hit = q.hit || (q.hit = {});
    if (!p.dead && !(p.inv > 0) && hit.p !== tick && trapHits(W.cfg, q, ph, p.x, p.z, .35)) { hit.p = tick; hurtPlayer(W, Math.round(p.maxhp * T.dmg), q.x, q.z); W.ev.push({ k: 'trapHit', x: p.x, z: p.z, kind: q.kind }); }
    for (const e of W.enemies) if (!e.dead && !e.boss && hit['e' + e.id] !== tick && trapHits(W.cfg, q, ph, e.x, e.z, .35)) { hit['e' + e.id] = tick; W.fx.deal(e, Math.round(e.maxhp * T.dmgFoe), q.kind === 'fire' ? 'fire' : 'steel'); }
    for (const a of W.allies) if (!a.dead && hit['a' + a.id] !== tick && trapHits(W.cfg, q, ph, a.x, a.z, .35)) { hit['a' + a.id] = tick; a.hp = Math.max(1, a.hp - Math.round(a.maxhp * T.dmg)); }
  }
}
