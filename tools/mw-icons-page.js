// Значки оружия Meshy (2026-10-29): снимок каждой вещи из data/meshyw.js → атлас (ячейка CELL px, по порядку ключей MW). Грузится в tools/mw-icons.html через tools/mw-icons.mjs.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MW } from '../3d/src/data/meshyw.js';
import { CATALOG } from '../3d/src/data/items.js';

export async function run(CELL = 96, only = null) {
  const ids = Object.keys(MW), cols = Math.ceil(Math.sqrt(ids.length)), SS = 2, R = CELL * SS;
  const gl = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); gl.setSize(R, R); gl.setClearColor(0, 0); gl.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.add(new THREE.AmbientLight(0xffffff, 2.6)); const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(-1, 1.5, 2); scene.add(sun);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10); cam.position.set(0, 0, 5); cam.lookAt(0, 0, 0);
  const atlas = document.createElement('canvas'); atlas.width = atlas.height = cols * CELL; const ax = atlas.getContext('2d');
  const tmp = document.createElement('canvas'); tmp.width = tmp.height = CELL; const tx = tmp.getContext('2d'); tx.imageSmoothingQuality = 'high';
  const sil = document.createElement('canvas'); sil.width = sil.height = CELL; const sx = sil.getContext('2d');
  const ld = new GLTFLoader(), geo = new Map(), kindOf = Object.fromEntries(CATALOG.map(i => [i.id, i.kind]));
  for (let n = 0; n < ids.length; n++) {
    const id = ids[n]; if (only && !only.includes(id)) continue;
    const [f, tint] = MW[id], kind = kindOf[id];
    if (!geo.has(f)) { const g = await ld.loadAsync(`/3d/models/mw/${f}.glb`); let me; g.scene.traverse(o => { if (o.isMesh && !me) me = o; }); geo.set(f, me); }
    const src = geo.get(f), mat = new THREE.MeshLambertMaterial({ map: src.material.map }); if (tint) mat.color.set(tint);
    const me = new THREE.Mesh(src.geometry, mat), inner = new THREE.Group(), outer = new THREE.Group(); inner.add(me); outer.add(inner);
    if (kind === 'shield') outer.rotation.y = -.35;
    else { if (/bow/.test(kind)) inner.rotation.x = -Math.PI / 2; outer.rotation.z = -Math.PI / 4; }     // лук и арбалет: длинная ось z → y; всё длинное — по диагонали, конец вправо-вверх
    scene.add(outer); outer.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(outer), c = b.getCenter(new THREE.Vector3()), h = Math.max(b.max.x - b.min.x, b.max.y - b.min.y) / 2 * 1.08;
    cam.left = c.x - h; cam.right = c.x + h; cam.top = c.y + h; cam.bottom = c.y - h; cam.updateProjectionMatrix();
    gl.render(scene, cam); scene.remove(outer); mat.dispose();
    tx.clearRect(0, 0, CELL, CELL); tx.drawImage(gl.domElement, 0, 0, CELL, CELL);
    sx.clearRect(0, 0, CELL, CELL); sx.globalCompositeOperation = 'source-over'; sx.drawImage(tmp, 0, 0); sx.globalCompositeOperation = 'source-in'; sx.fillStyle = '#140c0a'; sx.fillRect(0, 0, CELL, CELL);
    const x0 = (n % cols) * CELL, y0 = Math.floor(n / cols) * CELL, o = Math.max(1, CELL / 48);     // контур, как у прочих значков
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) ax.drawImage(sil, x0 + dx * o, y0 + dy * o);
    ax.drawImage(tmp, x0, y0);
  }
  return { url: atlas.toDataURL('image/webp', .88), cols, cell: CELL, n: ids.length };
}
