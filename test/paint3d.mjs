// Материалы (T0): выключенные не трогают материал; включённые встраиваются в шейдер Lambert, сохраняют чужие правки
// (ветер, сквозное окно) и различают виды; на «Низком» сила 0.
import * as THREE from 'three';
import { CFG3 } from '../3d/src/config3d.js';
import { initPaint, paintMat, paintOn, PAINT_KINDS, PART, tagKind } from '../3d/src/paint3d.js';
import { makeMap } from '../3d/src/map.js';
import { buildDecor } from '../3d/src/decor.js';
import { mulberry32 } from '../3d/src/sim.js';
import { qualityOf } from '../3d/src/quality3d.js';

const fail = []; const ok = (c, m) => { if (!c) fail.push(m); };
const fake = () => ({ uniforms: {}, vertexShader: 'void main() {\n#include <begin_vertex>\n}', fragmentShader: 'void main() {\n#include <color_fragment>\n}' });

initPaint({ ...CFG3.shaders.paint, on: false });
{ const m = new THREE.MeshLambertMaterial(); ok(paintMat(m, 'roof') === m && !m.onBeforeCompile.toString().includes('PAINT') && !m.userData.paint && !paintOn(), 'выключено — материал не тронут'); }

initPaint(CFG3.shaders.paint);
ok(paintOn(), 'включено по конфигу');
const kinds = {};
for (const k of PAINT_KINDS) {
  const m = new THREE.MeshLambertMaterial(); let prevRan = false;
  m.onBeforeCompile = sh => { prevRan = true; sh.vertexShader += '\n// prev'; }; m.customProgramCacheKey = () => 'wind';
  paintMat(m, k, { plank: .2 }); paintMat(m, k);     // повторный вызов — без второй вставки
  const sh = fake(); m.onBeforeCompile(sh, null);
  ok(prevRan && sh.vertexShader.includes('// prev'), `${k}: прежняя правка шейдера сохранена`);
  ok((sh.fragmentShader.match(/#define PAINT_KIND/g) || []).length === 1, `${k}: материал вставлен один раз`);
  ok(sh.vertexShader.includes('vPW = (modelMatrix') && sh.fragmentShader.includes('diffuseColor.rgb *= 1. + pk * d;'), `${k}: вершинная и пиксельная части на месте`);
  ok(sh.uniforms.uPK && sh.uniforms.uPS && sh.uniforms.uPlank.value > 0 && sh.uniforms.uTile.value > 0, `${k}: параметры переданы`);
  ok(m.customProgramCacheKey() === 'wind-paint' + k, `${k}: ключ программы учитывает и ветер, и материал`);
  kinds[k] = sh.fragmentShader.match(/#define PAINT_KIND (\d+)/)[1];
}
ok(new Set(Object.values(kinds)).size === PAINT_KINDS.length && PAINT_KINDS.length >= 8, 'каждый вид — свой вариант шейдера');
for (const k of PAINT_KINDS) ok(k === 'auto' || k === 'nature' || typeof CFG3.shaders.paint[k] === 'number', `сила вида ${k} — в конфиге`);
{ const m = paintMat(new THREE.MeshLambertMaterial(), 'auto', { plank: .16 }), sh = fake(); m.onBeforeCompile(sh); ok(sh.uniforms.uPlank.value === .16, 'своя ширина доски (сундуки)'); }
ok(qualityOf(CFG3, 'low', true).paint === 0 && qualityOf(CFG3, 'mid', true).paint === 1 && qualityOf(CFG3, 'auto', false).paint === 1, 'на «Низком» материалы выключены, на «Среднем» и «Авто» — включены');

// вид детали (T3): атрибут на слитой геометрии; декор — каменные постройки кладкой, навесы тканью, всё слито с атрибутом
{ const g = tagKind(new THREE.BoxGeometry(1, 1, 1), 'cloth'); ok([...g.attributes.pkind.array].every(v => v === PART.cloth), 'метка вида — на всех вершинах'); }
{ const sh = fake(), m = paintMat(new THREE.MeshLambertMaterial(), 'auto'); m.onBeforeCompile(sh); ok(sh.vertexShader.includes('attribute float pkind') && sh.fragmentShader.includes('pMasonry(an, q) : pStone(q)'), 'шейдер «auto» читает вид детали'); }
{ const map = makeMap(CFG3), D = buildDecor(map, mulberry32(CFG3.world.seed + 2), null), seen = new Set(); let meshes = 0, untagged = 0;
  D.group.traverse(o => { if (!o.isMesh || !o.material.isMeshLambertMaterial) return; meshes++; const a = o.geometry.attributes.pkind; if (!a) { untagged++; return; } for (const v of a.array) seen.add(v); });
  ok(meshes > 0 && untagged === 0, `декор: все слитые меши с видом детали (без вида ${untagged} из ${meshes})`);
  for (const k of ['masonry', 'cloth', 'metal']) ok(seen.has(PART[k]), `декор: есть детали вида ${k}`); }
// T4: узор в координатах детали — не плывёт на движущихся моделях; герой, враги, бойцы и звери получают свои виды
{ const sh = fake(), m = paintMat(new THREE.MeshLambertMaterial(), 'fur', { local: true }); m.onBeforeCompile(sh);
  ok(sh.vertexShader.startsWith('#define PAINT_LOCAL') && m.customProgramCacheKey().endsWith('furL'), 'локальный узор: свой define и ключ программы'); }
{ const { makeHero, makeMonster, makeSoldier, makeBeast } = await import('../3d/src/models.js'), kinds = o => { const k = new Set(); o.traverse(q => { if (q.isMesh && q.material.userData && q.material.userData.paint) k.add(q.material.userData.paint); }); return k; };
  const h = kinds(makeHero().group), imp = kinds(makeMonster('imp', CFG3).group), hound = kinds(makeMonster('hound', CFG3).group), drowned = kinds(makeMonster('drowned', CFG3).group), sol = kinds(makeSoldier(Object.keys(CFG3.squad.types)[0], CFG3).group), deer = kinds(makeBeast('deer').group);
  ok(h.has('cloth') && h.has('leather') && h.has('metal'), `герой: ткань, кожа, металл (${[...h]})`);
  ok(imp.has('hide') && imp.has('bone'), `бес: шкура и кость (${[...imp]})`); ok(hound.has('fur'), 'гончая: шерсть'); ok(drowned.has('scale'), 'утопленник: чешуя');
  ok(sol.has('cloth') && sol.has('metal'), `боец: ткань и металл (${[...sol]})`); ok(deer.has('fur'), 'олень: шерсть'); }
if (fail.length) { console.log('ПРОВАЛ:\n' + fail.join('\n')); process.exit(1); }
console.log('Материалы 3D: OK (виды: ' + Object.keys(kinds).join(', ') + ')');
