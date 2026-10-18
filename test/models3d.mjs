// Тест объёмных моделей (2026-10-18): у героя, врагов, бойцов, жителей и зверей — те же шарниры, что у прежних кубиков
// (анимации и эффекты держатся за них); детали одного материала в группе слиты (кадры); треугольников не больше прежнего;
// облик героя переключает мантию и капюшон; ?boxy (shapes.volume = false) даёт прежние модели.
import { CFG3 } from '../3d/src/config3d.js';
import { HEROES } from '../3d/src/data/heroes3d.js';
import { makeHero, makeMonster, makeSoldier, makeNpc, makeBeast, makeCrow } from '../3d/src/models.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const tris = o => { let t = 0; o.traverse(m => { if (m.isMesh) { const g = m.geometry; t += (g.index ? g.index.count : g.attributes.position.count) / 3; } }); return t; };
// в одной группе не должно остаться двух прямых деталей одного материала (иначе не слито)
const unbaked = o => { let bad = 0; o.traverse(g => { const seen = new Set(); for (const c of g.children) if (c.isMesh) { if (seen.has(c.material)) bad++; seen.add(c.material); } }); return bad; };
const build = vol => { CFG3.shapes.volume = vol; const r = {};
  for (const h of Object.keys(HEROES)) { const m = makeHero(); m.setLook(HEROES[h].look); r['hero:' + h] = m; }
  for (const t of Object.keys(CFG3.enemies).filter(k => CFG3.enemies[k] && CFG3.enemies[k].hp)) r['foe:' + t] = makeMonster(t, CFG3);
  for (const t of Object.keys(CFG3.squad.types)) r['ally:' + t] = makeSoldier(t, CFG3);
  for (const k of ['merchant', 'smith', 'captain', 'wanderer', 'traveler', 'villager']) r['npc:' + k] = makeNpc(k);
  for (const k of ['deer', 'hare', 'fox', 'goat', 'heron', 'duck']) r['beast:' + k] = makeBeast(k);
  r.crow = makeCrow(); return r; };
const old = build(false), vol = build(true);
const JOINTS = { hero: ['root', 'legL', 'legR', 'armL', 'swing', 'sword', 'head', 'cloak'], foe: ['root', 'armL', 'armR', 'legL', 'legR', 'head'], ally: ['root', 'armL', 'armR', 'legL', 'legR'], npc: ['root', 'armL', 'armR'], beast: ['legs'], crow: ['wl', 'wr'] };
for (const [k, m] of Object.entries(vol)) {
  const kind = k.split(':')[0], J = JOINTS[kind] || [];
  ok(J.every(j => m[j]), `${k}: нет шарнира ${J.filter(j => !m[j])}`);
  ok(unbaked(m.group) === 0, `${k}: детали не слиты (${unbaked(m.group)})`);
  ok(tris(m.group) <= tris(old[k].group) * 1.05 + 20, `${k}: треугольников больше прежнего: ${tris(m.group)} против ${tris(old[k].group)}`);
  if (m.legs) ok(m.legs.length === old[k].legs.length || k === 'beast:heron', `${k}: ног не столько, сколько было`);
}
ok(vol['beast:deer'].head, 'у оленя нет головы-группы (наклон к траве)');
{ const vis = m => { let n = 0; m.group.traverse(o => { let v = true; for (let q = o; q; q = q.parent) if (q.visible === false) v = false; if (o.isMesh && v) n++; }); return n; };
  ok(vis(vol['hero:irga']) > vis(vol['hero:vale']), 'у Ирги не видно мантии и капюшона'); }
{ const m = vol['foe:imp']; m.flash(.9); ok(m.mats.every(mt => mt.emissive.r > .5), 'вспышка попадания не красит объёмного беса'); m.flash(0); }
ok(Object.keys(old).length === Object.keys(vol).length && Object.keys(vol).length >= 35, 'моделей мало: ' + Object.keys(vol).length);
CFG3.shapes.volume = true;

if (fails.length) { console.error('Объёмные модели 3D: ПРОВАЛ\n- ' + fails.join('\n- ')); process.exit(1); }
console.log(`Объёмные модели 3D: OK (${Object.keys(vol).length} моделей)`);
