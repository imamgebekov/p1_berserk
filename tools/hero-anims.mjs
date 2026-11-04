// Общие клипы героев (2026-11-05): из риггованного Торна (Mixamo, клипы Meshy) → 3d/models/mh_anims.glb — только кости и анимации, без сетки и текстур.
// Запуск: node tools/hero-anims.mjs [файл=~/p1_berserk_models/heroes_raw/thorn_rigged.glb]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { statSync } from 'node:fs';
await MeshoptDecoder.ready;
const src = process.argv[2] || join(process.env.HOME, 'p1_berserk_models/heroes_raw/thorn_rigged.glb'), out = join(dirname(fileURLToPath(import.meta.url)), '..', '3d/models/mh_anims.glb');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder }), doc = await io.read(src), R = doc.getRoot();
for (const n of R.listNodes()) { n.setMesh(null); n.setSkin(null); }
for (const x of [...R.listMeshes(), ...R.listSkins(), ...R.listMaterials(), ...R.listTextures()]) x.dispose();
await doc.transform(prune({ keepLeaves: true }));
await io.write(out, doc); console.log('клипов', R.listAnimations().map(a => a.getName()).join(', '), '→', (statSync(out).size / 1024).toFixed(0), 'КБ');
