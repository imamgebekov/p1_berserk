// Модели героев из Meshy → игра (2026-11-05): упрощение до N треугольников, только цвет (base color) 1024 px webp, один файл 3d/models/mh_<герой>.glb.
// Запуск: node tools/hero-import.mjs <герой> [треугольников=15000] [папка с исходниками=~/p1_berserk_models/heroes_raw]
// Исходники тяжёлые (до миллиона треугольников) — сами в репозиторий не кладём. Скелет — автоскелет игры (autorig3d.js), у моделей с готовым скелетом (Бранд) — его же.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, prune, dedup, textureCompress, flatten, join } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { join as pj, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { statSync } from 'node:fs';

const [hero, tri = '15000', src = pj(process.env.HOME, 'p1_berserk_models/heroes_raw')] = process.argv.slice(2);
if (!hero) { console.log('node tools/hero-import.mjs <герой> [треугольников] [папка]'); process.exit(1); }
const root = pj(dirname(fileURLToPath(import.meta.url)), '..'), out = pj(root, '3d/models', `mh_${hero}.glb`), target = Number(tri);
await MeshoptSimplifier.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(pj(src, hero + '.glb')), R = doc.getRoot();
const count = () => { let n = 0; for (const m of R.listMeshes()) for (const p of m.listPrimitives()) { const i = p.getIndices(); n += (i ? i.getCount() : p.getAttribute('POSITION').getCount()) / 3; } return n; };
const t0 = count(); console.log(hero, 'исходно', Math.round(t0), 'треугольников');
// только цвет: нормали, металл-шероховатость, окклюзия и свечение игре не нужны (материалы без PBR, память телефона)
for (const m of R.listMaterials()) { m.setNormalTexture(null); m.setOcclusionTexture(null); m.setMetallicRoughnessTexture(null); m.setEmissiveTexture(null); m.setMetallicFactor(0); m.setRoughnessFactor(1); m.setEmissiveFactor([0, 0, 0]); }
const skinned = R.listSkins().length > 0;     // со скелетом сетки не склеиваем: кости привязаны к узлам
await doc.transform(...(skinned ? [weld()] : [flatten(), join(), weld()]));
await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, target / t0), error: 0.01, lockBorder: false }));
await doc.transform(dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 82 }));
await io.write(out, doc);
console.log(hero, 'теперь', Math.round(count()), 'треугольников,', (statSync(out).size / 1024).toFixed(0), 'КБ →', out);
