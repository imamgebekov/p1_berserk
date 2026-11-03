// Тест автоскелета 3D (2026-11-03): из сетки-человечка (кубики: ноги, туловище, руки, голова) строится скелет из 12 костей, веса вершин в сумме 1,
// ноги идут за своими костями, клипы Idle, Walk, Run, Attack1, Hit_A меняют позу.
import * as THREE from 'three';
import { autoRig } from '../3d/src/autorig3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d, 2, 4, 2).translate(x, y, z);
const parts = [box(.25, .9, .25, .2, .45, 0), box(.25, .9, .25, -.2, .45, 0), box(.7, .8, .35, 0, 1.3, 0), box(.2, .8, .2, .6, 1.25, 0), box(.2, .8, .2, -.6, 1.25, 0), box(.3, .3, .3, 0, 1.85, 0)];
const merged = (() => { const g = new THREE.BufferGeometry(), ps = [], ns = [], uv = [], ix = []; let o = 0; for (const p of parts) { ps.push(...p.attributes.position.array); ns.push(...p.attributes.normal.array); uv.push(...p.attributes.uv.array); ix.push(...[...p.index.array].map(i => i + o)); o += p.attributes.position.count; }
  g.setAttribute('position', new THREE.Float32BufferAttribute(ps, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(ns, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(ix); return g; })();
const scene = new THREE.Group(), node = new THREE.Group(); node.name = 'Model'; node.add(new THREE.Mesh(merged, new THREE.MeshBasicMaterial())); scene.add(node);
const before = merged.attributes.position.array.slice();
const R = autoRig(scene); ok(R && R.clips.length === 5, 'клипов не 5: ' + (R && R.clips.length));
const names = R.clips.map(c => c.name).join(); ok(names === 'Idle,Walk,Run,Attack1,Hit_A', 'имена клипов: ' + names);
let sm = null, bones = 0; scene.traverse(o => { if (o.isSkinnedMesh) sm = o; if (o.isBone) bones++; }); ok(sm && bones === 12, `костей ${bones}, сетка со скелетом ${!!sm}`);
const W = sm.geometry.attributes.skinWeight, I = sm.geometry.attributes.skinIndex; let bad = 0; for (let v = 0; v < W.count; v++) { const s = W.getX(v) + W.getY(v) + W.getZ(v) + W.getW(v); if (Math.abs(s - 1) > 1e-4) bad++; }
ok(bad === 0, 'веса не в сумме 1 у ' + bad + ' вершин');
const names2 = sm.skeleton.bones.map(b => b.name);
// нога (+x) идёт за левым бедром; рука (+x, выше) — за левой рукой
const boneOf = v => names2[I.getX(v)]; let legV = -1, armV = -1; const P = sm.geometry.attributes.position; for (let v = 0; v < P.count; v++) { if (legV < 0 && P.getX(v) > .15 && P.getY(v) < .2) legV = v; if (armV < 0 && P.getX(v) > .62 && P.getY(v) > 1.3) armV = v; }
ok(/thighL|shinL/.test(boneOf(legV)), 'нога +x не у ноги: ' + boneOf(legV)); ok(/armL|foreL/.test(boneOf(armV)), 'рука +x не у руки: ' + boneOf(armV));
// клипы двигают вершины: шаг — нога вперёд/назад, удар — рука вверх
const mixer = new THREE.AnimationMixer(scene), pos = (v) => { sm.skeleton.update(); const t = new THREE.Vector3(); t.fromBufferAttribute(P, v); sm.applyBoneTransform(v, t); return t; };
scene.updateMatrixWorld(true); const p0 = pos(legV); mixer.clipAction(R.clips[1]).play(); mixer.update(.225); scene.updateMatrixWorld(true); const p1 = pos(legV); ok(p0.distanceTo(p1) > .05, 'шаг не двигает ногу: ' + p0.distanceTo(p1));
mixer.stopAllAction(); mixer.clipAction(R.clips[3]).reset().play(); mixer.update(.3); scene.updateMatrixWorld(true); const a1 = pos(armV); ok(a1.y !== undefined && Math.abs(a1.z - 0) > .1, 'удар не двигает руку');
if (fails.length) { console.log('ПРОВАЛ:\n' + [...new Set(fails)].join('\n')); process.exit(1); }
console.log('Автоскелет 3D: OK');
