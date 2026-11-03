// Тест эффектов умений 3D (2026-11-03): у каждого из 288 умений есть эффект (частицы или вспышка), эффекты отличаются формой, цветом и числом частиц,
// отложенные части доигрываются, число частиц не растёт без меры.
import { createAbilityFx } from '../3d/src/abfx3d.js';
import { ABILITIES } from '../3d/src/data/abilities3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const run = (v, scale = 1) => { const rec = { emit: 0, flash: 0, colors: new Set(), maxY: 0, add: 0 }, fx = { emit: (x, y, z, vx, vy, vz, c, life, g, s, add) => { rec.emit++; rec.colors.add(c); rec.maxY = Math.max(rec.maxY, y); if (add) rec.add++; if (!(life > 0) || !Number.isFinite(x + y + z + vx + vy + vz)) rec.bad = true; }, flash: () => { rec.flash++; } };
  const A = createAbilityFx(fx, { scale: () => scale }); A.play(v); const first = rec.emit; for (let i = 0; i < 40; i++) A.update(.03); rec.first = first; rec.late = A.pending(); return rec; };
const sig = new Set(), kinds = new Set(), cols = new Set(); let n = 0, total = 0, maxE = 0;
for (const [hero, list] of Object.entries(ABILITIES)) for (const a of list) { n++;
  const r = run({ id: a.id, kind: a.kind || 'own', el: a.el, x: 5, z: 7, face: .6 }); ok(r.emit + r.flash > 0, `${a.id}: нет эффекта`); ok(!r.bad, `${a.id}: плохая частица`); ok(r.late === 0, `${a.id}: отложенное не доиграло`);
  total += r.emit; maxE = Math.max(maxE, r.emit); sig.add(a.id && [a.kind || 'own', a.el || '-', r.emit].join()); kinds.add(a.kind || a.id); for (const c of r.colors) cols.add(c); }
ok(sig.size >= 90, `разных эффектов (вид, стихия, число частиц) только ${sig.size} из ${n}`); ok(cols.size >= 18, `красок только ${cols.size}`); ok(maxE <= 320, `частиц у одного умения ${maxE}`);
const half = run({ id: 'th_slam', kind: 'cone', el: 'earth', x: 0, z: 0, face: 0 }, .5), full = run({ id: 'th_slam', kind: 'cone', el: 'earth', x: 0, z: 0, face: 0 }, 1); ok(half.emit < full.emit, 'низкое качество не режет частицы');
{ const f = run({ id: 'ir_ring', kind: 'nova', el: 'fire', x: 0, z: 0 }), e = run({ id: 'th_ring', kind: 'nova', el: 'earth', x: 0, z: 0 }); ok(f.add === f.emit && e.add > 0 && e.add < e.emit * .6, 'огонь светится целиком, земля — частично (ореол)'); }
if (fails.length) { console.log('ПРОВАЛ:\n' + [...new Set(fails)].slice(0, 15).join('\n')); process.exit(1); }
console.log(`Эффекты умений 3D: OK (умений ${n}, разных эффектов ${sig.size}, красок ${cols.size}, частиц в среднем ${Math.round(total / n)}, максимум ${maxE})`);
