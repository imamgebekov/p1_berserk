// Стенд моделей (разбор стиля, 2026-10-22): ряды героев, спутников, врагов, боссов и оружия на сцене игры, со светом игры.
// Грузится в странице игры (?shot&models=1) через tools/shots-models.mjs. Только для снимков, в сборку не входит.
import * as THREE from 'three';
import { CFG3 as cfg } from '../3d/src/config3d.js';
import { loadActor, makeActor, loadKkWeapons, soldierActor } from '../3d/src/actors3d.js';
import { makeHero, makeMonster, makeSoldier, makeNpc } from '../3d/src/models.js';
import { makeWeapon, weaponKinds, kkWeapon } from '../3d/src/weaponview.js';
import { heroOf } from '../3d/src/data/heroes3d.js';

const A = cfg.actors, kitOf = k => A.kits[k];
export const HERO_W = { thorn: ['sword', ['shield', 'iron']], vale: ['dagger', ['dagger', 'steel']], jay: ['bow'], irga: ['staff'], warlock: ['scythe'], priest: ['mace', ['shield', 'iron']], brand: ['greatsword'], hunter: ['sword', ['sword', 'steel']] };

export async function ready() { await Promise.all([...Object.entries(A.kits).map(([k, kit]) => loadActor(k, kit)), loadKkWeapons()]); }

function idle(m, t = .6) { if (m.gltf) { m.play('idle', { fade: 0 }); m.update(t); } return m; }
function arm(m, id) { const [w, off] = HERO_W[id] || ['sword']; m.setWeapon(w, 'steel'); if (off && m.setOff) m.setOff(off[0], off[0], off[1] || 'steel'); return m; }
export function heroModel(id, key) { const k = key === undefined ? A.heroes[id] : key, m = k ? makeActor(k, kitOf(k), 'hero') : null; if (m) return idle(arm(m, id)); const h = makeHero(); h.setLook(heroOf(id).look); return arm(h, id); }
export function foeModel(type, procedural = false) { const k = A.foes[type], m = !procedural && k ? makeActor(k, { ...kitOf(k), tint: A.tints[type] }, type) : makeMonster(type, cfg); if (!m) throw new Error('нет модели ' + type + ' → ' + k); m.group.scale.setScalar(cfg.enemies[type].scale); return idle(m); }
export function keyModel(k, tint) { const m = makeActor(k, { ...kitOf(k), ...(tint ? { tint } : {}) }); return idle(m); }
export function soldierModel(t) { const A = soldierActor(cfg, t); return A ? idle(A) : makeSoldier(t, cfg); }
export function kkWeaponModel(kind, mat = 'steel') { return kkWeapon(kind, mat) || makeWeapon(kind, mat); }
export function npcModel(t) { const k = (A.npcs || {})[t]; return k ? keyModel(k) : makeNpc(t); }
export function weaponModel(kind, mat = 'steel') { return makeWeapon(kind, mat); }
export const weapons = () => weaponKinds();

// снимок ряда: items — [{ m, label }]; ряд стоит у героя, камера — сбоку-сверху; всё прочее в сцене на время снимка скрыто
export function shoot(R, W, items, { w = 1600, h = 520, elev = .32, gap = .5, bg = '#cfd6cc', ground = '#8c9a72', yaw = .35 } = {}) {
  const scene = R.scene, gl = R.gl, p = W.player; let y0 = 0;
  for (const c of scene.children) if (c.userData.actor && Math.hypot(c.position.x - p.x, c.position.z - p.z) < .6) y0 = c.position.y;     // высота земли — по модели героя
  const row = new THREE.Group(); row.position.set(p.x, y0, p.z);
  const sizes = items.map(({ m }) => { m.group.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(m.group); return { w: Math.max(.6, b.max.x - b.min.x, b.max.z - b.min.z), h: Math.max(.3, b.max.y - b.min.y) }; });
  const total = sizes.reduce((s, z) => s + z.w + gap, -gap); let x = -total / 2;
  const labels = [];
  items.forEach(({ m, label, rot }, i) => { const z = sizes[i]; m.group.position.set(x + z.w / 2, 0, 0); m.group.rotation.y = rot ?? yaw; row.add(m.group); labels.push({ label, x: x + z.w / 2, h: z.h }); x += z.w + gap; });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(total * .75 + 3, 48), new THREE.MeshLambertMaterial({ color: ground })); disc.rotation.x = -Math.PI / 2; disc.position.y = .01; disc.receiveShadow = true; row.add(disc);
  const keep = new Set(); scene.traverse(o => { if (o.isLight) { keep.add(o); if (o.target) keep.add(o.target); } });
  const vis = []; for (const c of scene.children) if (!keep.has(c)) { vis.push([c, c.visible]); c.visible = false; }
  scene.add(row); const fog = scene.fog, bg0 = scene.background; scene.fog = null; scene.background = new THREE.Color(bg);
  const hMax = Math.max(...sizes.map(s => s.h)), cam = new THREE.PerspectiveCamera(24, w / h, .1, 500);
  const tv = Math.tan(THREE.MathUtils.degToRad(12)), dist = Math.max((total / 2 + .4) / (tv * w / h), hMax * .62 / tv);
  const ty = hMax * .5; cam.position.set(p.x, y0 + ty + Math.sin(elev) * dist, p.z + Math.cos(elev) * dist); cam.lookAt(p.x, y0 + ty * .9, p.z); cam.updateMatrixWorld(true);
  const size = gl.getSize(new THREE.Vector2()), pr = gl.getPixelRatio(); gl.setPixelRatio(1); gl.setSize(w, h, false);
  gl.render(scene, cam); const url = gl.domElement.toDataURL('image/png');
  const pos = labels.map(l => { const v = new THREE.Vector3(p.x + l.x, y0 - .05, p.z).project(cam); return { label: l.label, x: Math.round((v.x + 1) / 2 * w), y: Math.round((1 - v.y) / 2 * h) }; });
  gl.setPixelRatio(pr); gl.setSize(size.x, size.y, false);
  scene.remove(row); scene.fog = fog; scene.background = bg0; for (const [c, v] of vis) c.visible = v;
  return { url, labels: pos, tris: count(items) };
}
function count(items) { let t = 0; for (const { m } of items) m.group.traverse(o => { if (o.isMesh && o.geometry) { const g = o.geometry; t += (g.index ? g.index.count : g.attributes.position.count) / 3; } }); return Math.round(t); }
export function triOf(m) { return count([{ m }]); }
export async function rawModel(url, height = 2) {     // модель из файла вне 3d/models (просмотр набора): рост height, первый клип «покоя»
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'); const g = await new GLTFLoader().loadAsync(url);
  const box = new THREE.Box3().setFromObject(g.scene), h = Math.max(.01, box.max.y - box.min.y), grp = new THREE.Group(); g.scene.scale.setScalar(height / h); g.scene.position.y = -box.min.y * height / h; grp.add(g.scene);
  const c = g.animations.find(a => /idle/i.test(a.name)) || g.animations[0]; if (c) { const mx = new THREE.AnimationMixer(g.scene); mx.clipAction(c).play(); mx.update(.4); }
  let tris = 0; g.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });
  return { group: grp, clips: g.animations.map(a => a.name), tris: Math.round(tris) };
}
