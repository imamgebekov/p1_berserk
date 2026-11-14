// Kenney Nature Kit и Fantasy Town Kit (CC0) → один файл 3d/models/kenney.glb (2026-11-13): цвет из палитры/материала запечён в вершины, без текстур и материалов, у узлов имена.
// Запуск: node tools/bake-kenney.mjs [папка с распакованными наборами = ~/p1_berserk_models]
import { NodeIO, Document } from '@gltf-transform/core';
import { prune, dedup, mergeDocuments, unpartition } from '@gltf-transform/functions';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

const base = process.argv[2] || join(process.env.HOME, 'p1_berserk_models'), io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const NAT = join(base, 'dl_kenney_nature/x/Models/GLTF format'), TOWN = join(base, 'dl_kenney_town/x/Models/GLB format');
const pick = (dir, names, pre) => names.map(n => [join(dir, n + '.glb'), pre + n.replace(/-/g, '_')]);
const natureNames = ['flower_purpleA', 'flower_purpleB', 'flower_purpleC', 'flower_redA', 'flower_redB', 'flower_redC', 'flower_yellowA', 'flower_yellowB', 'flower_yellowC', 'mushroom_red', 'mushroom_redGroup', 'mushroom_redTall', 'mushroom_tan', 'mushroom_tanGroup', 'mushroom_tanTall',
    'plant_bush', 'plant_bushDetailed', 'plant_bushLarge', 'plant_bushLargeTriangle', 'plant_bushSmall', 'plant_bushTriangle', 'plant_flatShort', 'plant_flatTall', 'grass', 'grass_large', 'grass_leafs', 'grass_leafsLarge',
    'log', 'log_large', 'log_stack', 'stump_old', 'stump_oldTall', 'stump_round', 'stump_square', 'lily_large', 'lily_small', 'cactus_short', 'cactus_tall', 'hanging_moss',
    'tree_oak', 'tree_fat', 'tree_thin', 'tree_tall', 'tree_default', 'tree_simple', 'tree_small', 'tree_detailed', 'tree_blocks', 'tree_plateau', 'tree_cone', 'tree_palm', 'tree_palmBend', 'tree_palmTall', 'tree_palmShort',
    'tree_pineTallA', 'tree_pineTallB', 'tree_pineTallC', 'tree_pineTallD', 'tree_pineRoundA', 'tree_pineRoundB', 'tree_pineRoundC', 'tree_pineRoundD', 'tree_pineSmallA', 'tree_pineSmallB', 'tree_pineSmallC', 'tree_pineSmallD',
    'rock_largeA', 'rock_largeB', 'rock_largeC', 'rock_largeD', 'rock_largeE', 'rock_largeF', 'rock_tallA', 'rock_tallB', 'rock_tallC', 'rock_tallD', 'rock_tallE', 'rock_tallF', 'rock_tallG', 'rock_tallH', 'rock_tallI', 'rock_tallJ',
    'campfire_stones', 'campfire_logs', 'sign', 'statue_obelisk', 'statue_column', 'statue_head', 'tent_detailedOpen', 'tent_smallOpen', 'crops_wheatStageB', 'crops_cornStageD', 'crop_pumpkin', 'crop_melon', 'bed', 'pot_large', 'pot_small'];
const townList = ['windmill', 'watermill', 'stall', 'stall-red', 'stall-green', 'stall-bench', 'cart', 'cart-high', 'fountain-round', 'fountain-square', 'hedge', 'hedge-large', 'lantern', 'banner-red', 'banner-green', 'fence', 'fence-gate', 'fence-broken', 'pillar-stone', 'pillar-wood', 'tree', 'tree-crooked', 'tree-high', 'rock-large', 'rock-small', 'rock-wide', 'wheel', 'chimney', 'poles',
  'wall', 'wall-wood', 'wall-door', 'wall-wood-door', 'wall-window-shutters', 'wall-wood-window-shutters', 'wall-window-glass', 'wall-corner', 'wall-wood-corner', 'wall-arch', 'wall-broken', 'wall-wood-broken', 'wall-half', 'roof', 'roof-gable', 'roof-gable-end', 'roof-corner', 'roof-high', 'roof-high-gable', 'roof-point', 'roof-window', 'stairs-wood', 'stairs-stone', 'planks', 'balcony-wall'];
const flat = [...pick(NAT, natureNames, 'n_'), ...pick(TOWN, townList, 't_')];
const out = new Document(), buf = out.createBuffer(), mat = out.createMaterial('vc').setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(1), scene = out.createScene('s');
const lin = c => Math.pow(c / 255, 2.2);
let done = 0, missing = [];
for (const [file, name] of flat) {
  let d; try { d = await io.read(file); } catch (e) { missing.push(name); continue; }
  const R = d.getRoot(); let tex = null;
  for (const m of R.listMaterials()) { const t = m.getBaseColorTexture(); if (t && !tex) { const img = t.getImage(); const { data, info } = await sharp(Buffer.from(img)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); tex = { data, w: info.width, h: info.height }; } }
  for (const me of R.listMeshes()) for (const p of me.listPrimitives()) {
    const pos = p.getAttribute('POSITION'), uv = p.getAttribute('TEXCOORD_0'), m = p.getMaterial(), f = m ? m.getBaseColorFactor() : [1, 1, 1, 1], bt = m && m.getBaseColorTexture(), n = pos.getCount(), col = new Float32Array(n * 3), v = [];
    for (let i = 0; i < n; i++) { let r = f[0], g = f[1], b = f[2];
      if (bt && tex && uv) { uv.getElement(i, v); const x = Math.min(tex.w - 1, Math.max(0, Math.floor((v[0] % 1 + 1) % 1 * tex.w))), y = Math.min(tex.h - 1, Math.max(0, Math.floor((v[1] % 1 + 1) % 1 * tex.h))), k = (y * tex.w + x) * 4; r *= lin(tex.data[k]); g *= lin(tex.data[k + 1]); b *= lin(tex.data[k + 2]); }
      col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b; }
    p.setAttribute('COLOR_0', d.createAccessor().setType('VEC3').setArray(col)); p.setAttribute('TEXCOORD_0', null); p.setMaterial(null);
  }
  const map = mergeDocuments(out, d);     // детали из набора — в общий документ
  const sc = R.listScenes()[0], nodes = sc ? sc.listChildren() : [];
  const root = out.createNode(name); let any = false;
  for (const nd of nodes) { for (const q of [nd, ...nd.listChildren()]) if (q.getMesh()) any = true; root.addChild(map.get ? (map.get(nd) || nd) : nd); }
  if (any) { scene.addChild(root); done++; } else missing.push(name);
}
for (const me of out.getRoot().listMeshes()) for (const p of me.listPrimitives()) p.setMaterial(mat);
await out.transform(prune(), dedup(), unpartition());
const bin = await io.writeBinary(out); writeFileSync(join(process.cwd(), '3d/models/kenney.glb'), bin);
console.log('моделей', done, 'пропущено', missing.length, missing.slice(0, 10).join(','), 'размер КБ', Math.round(bin.length / 1024));
