// Материалы (T0): выключенные не трогают материал; включённые встраиваются в шейдер Lambert, сохраняют чужие правки
// (ветер, сквозное окно) и различают виды; на «Низком» сила 0.
import * as THREE from 'three';
import { CFG3 } from '../3d/src/config3d.js';
import { initPaint, paintMat, paintOn } from '../3d/src/paint3d.js';
import { qualityOf } from '../3d/src/quality3d.js';

const fail = []; const ok = (c, m) => { if (!c) fail.push(m); };
const fake = () => ({ uniforms: {}, vertexShader: 'void main() {\n#include <begin_vertex>\n}', fragmentShader: 'void main() {\n#include <color_fragment>\n}' });

initPaint({ ...CFG3.shaders.paint, on: false });
{ const m = new THREE.MeshLambertMaterial(); ok(paintMat(m, 'roof') === m && !m.onBeforeCompile.toString().includes('PAINT') && !m.userData.paint && !paintOn(), 'выключено — материал не тронут'); }

initPaint(CFG3.shaders.paint);
ok(paintOn(), 'включено по конфигу');
const kinds = {};
for (const k of ['ground', 'auto', 'roof', 'log']) {
  const m = new THREE.MeshLambertMaterial(); let prevRan = false;
  m.onBeforeCompile = sh => { prevRan = true; sh.vertexShader += '\n// prev'; }; m.customProgramCacheKey = () => 'wind';
  paintMat(m, k, { plank: .2 }); paintMat(m, k);     // повторный вызов — без второй вставки
  const sh = fake(); m.onBeforeCompile(sh, null);
  ok(prevRan && sh.vertexShader.includes('// prev'), `${k}: прежняя правка шейдера сохранена`);
  ok((sh.fragmentShader.match(/#define PAINT_KIND/g) || []).length === 1, `${k}: материал вставлен один раз`);
  ok(sh.vertexShader.includes('vPW = (modelMatrix') && sh.fragmentShader.includes('diffuseColor.rgb *= 1. + pk * d;'), `${k}: вершинная и пиксельная части на месте`);
  ok(sh.uniforms.uPK && sh.uniforms.uPS && sh.uniforms.uPlank.value > 0 && sh.uniforms.uTile.value > 0, `${k}: параметры переданы`);
  ok(m.customProgramCacheKey() === 'wind-paint' + k, `${k}: ключ программы учитывает и ветер, и материал`);
  kinds[k] = sh.fragmentShader.match(/#define PAINT_KIND (\d)/)[1];
}
ok(new Set(Object.values(kinds)).size === 4, 'четыре вида — четыре варианта шейдера');
{ const m = paintMat(new THREE.MeshLambertMaterial(), 'auto', { plank: .16 }), sh = fake(); m.onBeforeCompile(sh); ok(sh.uniforms.uPlank.value === .16, 'своя ширина доски (сундуки)'); }
ok(qualityOf(CFG3, 'low', true).paint === 0 && qualityOf(CFG3, 'mid', true).paint === 1 && qualityOf(CFG3, 'auto', false).paint === 1, 'на «Низком» материалы выключены, на «Среднем» и «Авто» — включены');

if (fail.length) { console.log('ПРОВАЛ:\n' + fail.join('\n')); process.exit(1); }
console.log('Материалы 3D: OK (виды: ' + Object.keys(kinds).join(', ') + ')');
