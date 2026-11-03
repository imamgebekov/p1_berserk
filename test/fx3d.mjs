// Тест эффектов боя 3D (шаг P2): частицы и пятна живут и исчезают, не уходят под землю, пул не переполняется, смена уровня всё стирает.
import * as THREE from 'three';
import { createFx } from '../3d/src/fx3d.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(48, 1, .5, 700);
const fx = createFx(scene, camera);
const run = (sec, dt = 1 / 60) => { for (let i = 0; i < Math.round(sec / dt); i++) fx.update(dt); };
const parts = scene.children.find(o => o.isInstancedMesh && o.count === 400), glow = scene.children.find(o => o.isInstancedMesh && o.count === 900), decals = scene.children.find(o => o.isInstancedMesh && o.count === 64);
ok(parts && glow && decals, 'частицы, свечение (V1) и пятна — по одному InstancedMesh');
ok(scene.children.filter(o => o.isInstancedMesh).length === 4, 'лишних InstancedMesh нет (частицы, свечение, пятна, обломки)');
ok(glow.material.blending === THREE.AdditiveBlending && !glow.material.depthWrite, 'свечение не аддитивное');

fx.spray(0, 1.1, 0, 1, 0, 12, '#a1121f', 7, .75); fx.burst(0, 1, 0, 8, '#fff'); fx.ash(0, .6, 0, 16);
ok(fx.live().parts === 36, 'выпущено 36 частиц: ' + fx.live().parts);
// брызги летят прочь от бьющего: средняя скорость по x положительна
run(.15);
const m = new THREE.Matrix4(), v = new THREE.Vector3(); let below = 0, sumX = 0;
for (let i = 0; i < parts.count; i++) { parts.getMatrixAt(i, m); v.setFromMatrixPosition(m); if (v.y < .06 && v.lengthSq() > 0) below++; }
ok(below === 0, 'частицы под землёй: ' + below);
run(3);
ok(fx.live().parts === 0, 'частицы не исчезли за 3 с: ' + fx.live().parts);
// направление веера
fx.clear(); fx.spray(0, 1, 0, 1, 0, 20, '#fff', 6, .5); fx.update(1 / 60);
for (let i = 0; i < parts.count; i++) { parts.getMatrixAt(i, m); v.setFromMatrixPosition(m); sumX += v.x; }
ok(sumX > 0, 'брызги не летят по направлению удара');
// пятна: живут ~9 с, потом исчезают; ужимаются, а не пропадают разом
fx.clear(); fx.decal(1, 1, .5, '#4a080c', 1, 0); fx.decal(2, 2, .8, '#4a080c');
run(5); ok(fx.live().decals === 2, 'пятна пропали раньше времени');
run(4.5); ok(fx.live().decals === 0, 'пятна не исчезли за 9.5 с');
// пул: 1000 частиц и 200 пятен — не больше вместимости, без ошибок
for (let i = 0; i < 100; i++) fx.burst(i, 1, 0, 10, '#fff');
for (let i = 0; i < 200; i++) fx.decal(i, 0, .5, '#000');
for (let i = 0; i < 1000; i++) fx.emit(i, 1, 0, 0, 1, 0, '#ff8a30', .5, -2, .1, true);                  // светящиеся (V1)
ok(fx.live().parts <= 400 + 900 && fx.live().decals <= 64, 'пул переполнен: ' + JSON.stringify(fx.live()));
fx.update(1 / 60);
// смена уровня стирает всё
fx.flash(0, 1, 0, 1, '#fff'); fx.clear();
ok(fx.live().parts === 0 && fx.live().decals === 0, 'clear не стёр эффекты');
ok(scene.children.filter(o => o.isMesh && !o.isInstancedMesh).every(o => !o.visible), 'clear не спрятал вспышки');

// обломки (план физики, этап 4): один InstancedMesh; куски падают, отскакивают и ложатся не под землю; предел по устройству; clear стирает
{ const deb = scene.children.find(o => o.isInstancedMesh && o.count === 300 && o.material.isMeshLambertMaterial); ok(!!deb && !deb.castShadow, 'обломки — отдельный InstancedMesh без теней');
  fx.clear(); fx.debris(0, .5, 0, 1, 0, 40, ['#6b4a2c', '#4a3220'], 4, .2); ok(fx.live().debris === 40, 'выпущено 40 обломков: ' + fx.live().debris);
  run(1.5); let low = 0, sx = 0, n = 0; for (let i = 0; i < deb.count; i++) { deb.getMatrixAt(i, m); v.setFromMatrixPosition(m); if (v.lengthSq() === 0) continue; n++; sx += v.x; if (v.y < 0) low++; }
  ok(n === 40 && low === 0, `обломки под землёй: ${low} из ${n}`); ok(sx / n > .3, 'обломки летят не по удару');
  fx.debrisCfg(120); fx.debris(0, .5, 0, 0, 0, 200, ['#777'], 3, .2); ok(fx.live().debris <= 120, 'предел телефона не держится: ' + fx.live().debris);
  run(6); ok(fx.live().debris === 0, 'обломки не исчезают за life'); fx.debrisCfg(300); fx.debris(0, .5, 0, 0, 0, 10, ['#777']); fx.clear(); ok(fx.live().debris === 0, 'clear не стёр обломки'); }

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Эффекты боя 3D: OK');
