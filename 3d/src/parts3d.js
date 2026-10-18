// Объёмные детали героев и врагов (2026-10-18): низкополигональные формы с видимыми гранями (как Northgard).
// Грани — плоские нормали (геометрия без общих вершин), поэтому подходит любой материал. Формы одинаковых размеров
// делят геометрию (кэш), модели её не освобождают. Только графика, без внешних файлов.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const cache = new Map();
const facet = g => { const n = g.index ? g.toNonIndexed() : g; n.computeVertexNormals(); return n; };
const cached = (key, make) => { let g = cache.get(key); if (!g) { g = facet(make()); cache.set(key, g); } return g; };

// бочонок: сужение сверху вниз (rt, rb), высота h, граней seg, сплющен по глубине на k (1 — круглый)
export const barrelGeo = (rt, rb, h, seg = 7, k = 1) => cached(`b${rt},${rb},${h},${seg},${k}`, () => { const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1); g.scale(1, 1, k); return g; });
// капля-многогранник: полуоси rx, ry, rz; detail 0 — 20 граней, 1 — 80
export const blobGeo = (rx, ry, rz, detail = 1) => cached(`s${rx},${ry},${rz},${detail}`, () => { const g = new THREE.IcosahedronGeometry(1, detail); g.scale(rx, ry, rz); return g; });
// конус (рога, когти, уши, нос): основание r, высота h вдоль +y
export const coneGeo = (r, h, seg = 5) => cached(`c${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg, 1));
// гнутая пластина (плащ, капюшон сзади): дуга радиуса r на угол arc, высота h, открыта
export const panelGeo = (r, h, arc, seg = 5) => cached(`p${r},${h},${arc},${seg}`, () => new THREE.CylinderGeometry(r, r * 1.12, h, seg, 1, true, Math.PI - arc / 2, arc));

export function mesh(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); return m;
}
// сустав конечности: группа в точке (x, y, z); внутри — верх и низ с суставом, на конце — кисть или ступня.
// len — общая длина вниз; r0, r1, r2 — толщина у плеча, у сустава, у конца; end — деталь на конце или null
export function limbV(mat, x, y, z, len, r0, r1, r2, end = null, bend = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const a = len * .52, b = len - a;
  g.add(mesh(barrelGeo(r1, r0, a, 6), mat, 0, -a / 2, 0));                         // верх (бедро, плечо)
  g.add(mesh(blobGeo(r1 * 1.05, r1 * 1.05, r1 * 1.05, 0), mat, 0, -a, 0));         // сустав (колено, локоть)
  g.add(mesh(barrelGeo(r2, r1, b, 6), mat, 0, -a - b / 2, bend));                  // низ (голень, предплечье)
  if (end) { end.position.y += -len; g.add(end); }
  return g;
}

// слияние ради кадров: внутри группы детали одного материала — в одну сетку (трансформы запекаются). Вложенные группы
// (шарниры, переключаемые детали) остаются отдельными и сливаются внутри себя. noBake — не трогать (меняется на лету)
export function bakeDeep(obj) {
  const by = new Map();
  for (const c of obj.children) if (c.isMesh && !c.userData.noBake) { if (!by.has(c.material)) by.set(c.material, []); by.get(c.material).push(c); }
  for (const [mat, list] of by) {
    if (list.length < 2) continue;
    const geos = list.map(m => { m.updateMatrix(); const g = m.geometry.clone(); g.applyMatrix4(m.matrix); return g; });
    const merged = mergeGeometries(geos, false); if (!merged) continue;
    for (const m of list) obj.remove(m); obj.add(new THREE.Mesh(merged, mat));
  }
  for (const c of [...obj.children]) if (!c.isMesh) bakeDeep(c);
  return obj;
}
