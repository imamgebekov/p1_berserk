// Эффекты боя одним вызовом отрисовки на вид: частицы (искры, кровь, пепел), пятна на земле и вспышки попадания. Только графика.
// Частицы и пятна — InstancedMesh: сотни штук без лишних вызовов отрисовки (важно для iPhone).
import * as THREE from 'three';

export function createFx(scene, camera, n = { parts: 400, glow: 300, decals: 64, flashes: 8 }, groundY = () => 0) {
  const dummy = new THREE.Object3D(), col = new THREE.Color(), HIDE = new THREE.Matrix4().makeScale(0, 0, 0);

  // ---- частицы: позиция, скорость, жизнь, гравитация, размер ----
  const NP = n.parts, P = { x: new Float32Array(NP), y: new Float32Array(NP), z: new Float32Array(NP), vx: new Float32Array(NP), vy: new Float32Array(NP), vz: new Float32Array(NP), life: new Float32Array(NP), max: new Float32Array(NP), g: new Float32Array(NP), s: new Float32Array(NP) };
  const parts = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#fff' }), NP);
  parts.frustumCulled = false; for (let i = 0; i < NP; i++) { parts.setMatrixAt(i, HIDE); parts.setColorAt(i, col.set('#000')); }
  scene.add(parts);
  let pi = 0;
  function emitP(x, y, z, vx, vy, vz, color, life, g, s) {
    const i = pi = (pi + 1) % NP;
    P.x[i] = x; P.y[i] = y; P.z[i] = z; P.vx[i] = vx; P.vy[i] = vy; P.vz[i] = vz; P.life[i] = P.max[i] = life; P.g[i] = g; P.s[i] = s;
    parts.setColorAt(i, col.set(color));
  }
  // светящиеся частицы (V1): огонь, искры, иней — аддитивно, без тяжести о землю; своя кольцевая очередь
  const NG = n.glow || 0, Gp = { x: new Float32Array(NG), y: new Float32Array(NG), z: new Float32Array(NG), vx: new Float32Array(NG), vy: new Float32Array(NG), vz: new Float32Array(NG), life: new Float32Array(NG), max: new Float32Array(NG), g: new Float32Array(NG), s: new Float32Array(NG) };
  const glow = NG ? new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), NG) : null;
  if (glow) { glow.frustumCulled = false; for (let i = 0; i < NG; i++) { glow.setMatrixAt(i, HIDE); glow.setColorAt(i, col.set('#000')); } glow.renderOrder = 2; scene.add(glow); }
  let gi = 0;
  // частица: add — светящаяся (огонь, искры), иначе обычная (дым, кровь, пузыри)
  function emit(x, y, z, vx, vy, vz, color, life, g, s, add = false) {
    if (!add || !glow) return emitP(x, y, z, vx, vy, vz, color, life, g, s);
    const i = gi = (gi + 1) % NG;
    Gp.x[i] = x; Gp.y[i] = y; Gp.z[i] = z; Gp.vx[i] = vx; Gp.vy[i] = vy; Gp.vz[i] = vz; Gp.life[i] = Gp.max[i] = life; Gp.g[i] = g; Gp.s[i] = s;
    glow.setColorAt(i, col.set(color));
  }
  // во все стороны (как раньше)
  function burst(x, y, z, cnt, color, sp = 4) {
    for (let k = 0; k < cnt; k++) { const a = Math.random() * 6.283, v = sp * Math.random(); emitP(x, y, z, Math.cos(a) * v, 2 + Math.random() * 3, Math.sin(a) * v, color, .5 + Math.random() * .4, 14, .14); }
  }
  // веером по направлению (dx, dz): брызги от удара летят прочь от бьющего; spread — разброс, рад
  function spray(x, y, z, dx, dz, cnt, color, sp = 5, spread = .8, o = {}) {
    const base = Math.atan2(dx, dz);
    for (let k = 0; k < cnt; k++) {
      const a = base + (Math.random() - .5) * 2 * spread, v = sp * (.45 + Math.random() * .55);
      emitP(x, y, z, Math.sin(a) * v, (o.up || 2.2) + Math.random() * 2.2, Math.cos(a) * v, color, (o.life || .45) + Math.random() * .3, o.g ?? 14, o.s || .12);
    }
  }
  // пепел: медленно поднимается и тает (смерть врага)
  function ash(x, y, z, cnt, colors = ['#3a3430', '#58504a', '#2a2420', '#ff8a30']) {
    for (let k = 0; k < cnt; k++) { const a = Math.random() * 6.283, r = Math.random() * .5; emitP(x + Math.cos(a) * r, y + Math.random() * .8, z + Math.sin(a) * r, Math.cos(a) * .6, .6 + Math.random() * 1.2, Math.sin(a) * .6, colors[k % colors.length], .8 + Math.random() * .6, -.8, .1 + Math.random() * .08); }
  }

  // ---- пятна на земле: плоские квадраты, со временем уменьшаются и исчезают ----
  const ND = n.decals, D = { x: new Float32Array(ND), z: new Float32Array(ND), r: new Float32Array(ND), sx: new Float32Array(ND), sz: new Float32Array(ND), life: new Float32Array(ND), y: new Float32Array(ND) };
  const decals = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#fff', polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false }), ND);
  decals.frustumCulled = false; for (let i = 0; i < ND; i++) { decals.setMatrixAt(i, HIDE); decals.setColorAt(i, col.set('#000')); }
  decals.renderOrder = 1; scene.add(decals);
  let di = 0; const DLIFE = 9;
  function decal(x, z, size, color, dx = 0, dz = 0) {
    const i = di = (di + 1) % ND, stretch = dx || dz ? 1.6 : 1;
    D.x[i] = x; D.z[i] = z; D.y[i] = groundY(x, z) + .025; D.r[i] = dx || dz ? Math.atan2(dx, dz) : Math.random() * 6.283; D.sx[i] = size * (.8 + Math.random() * .3); D.sz[i] = size * stretch; D.life[i] = DLIFE;
    decals.setColorAt(i, col.set(color)); decals.instanceColor.needsUpdate = true;
  }

  // ---- вспышки попадания: светлая плоскость к камере, гаснет за доли секунды ----
  const flashes = [];
  for (let i = 0; i < n.flashes; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); m.visible = false; m.userData.t = 0; scene.add(m); flashes.push(m); }
  let fi = 0;
  function flash(x, y, z, size, color) { const m = flashes[fi = (fi + 1) % flashes.length]; m.visible = true; m.position.set(x, y, z); m.material.color.set(color); m.userData = { t: .1, s: size }; }

  function update(dt) {
    for (let i = 0; i < NP; i++) {
      if (P.life[i] <= 0) continue;
      P.life[i] -= dt;
      if (P.life[i] <= 0) { parts.setMatrixAt(i, HIDE); continue; }
      P.vy[i] -= P.g[i] * dt; P.x[i] += P.vx[i] * dt; P.y[i] += P.vy[i] * dt; P.z[i] += P.vz[i] * dt;
      if (P.y[i] < .07) { P.y[i] = .07; P.vy[i] *= -.25; P.vx[i] *= .6; P.vz[i] *= .6; }       // о землю: гасит скорость
      const k = Math.min(1, P.life[i] / P.max[i] * 1.6), s = P.s[i] * k;
      dummy.position.set(P.x[i], P.y[i], P.z[i]); dummy.rotation.set(0, P.life[i] * 7, 0); dummy.scale.set(s, s, s); dummy.updateMatrix(); parts.setMatrixAt(i, dummy.matrix);
    }
    parts.instanceMatrix.needsUpdate = true; if (parts.instanceColor) parts.instanceColor.needsUpdate = true;
    if (glow) {
      for (let i = 0; i < NG; i++) {
        if (Gp.life[i] <= 0) continue;
        Gp.life[i] -= dt; if (Gp.life[i] <= 0) { glow.setMatrixAt(i, HIDE); continue; }
        Gp.vy[i] -= Gp.g[i] * dt; Gp.x[i] += Gp.vx[i] * dt; Gp.y[i] += Gp.vy[i] * dt; Gp.z[i] += Gp.vz[i] * dt;
        const k = Math.min(1, Gp.life[i] / Gp.max[i] * 1.4), s = Gp.s[i] * k;
        dummy.position.set(Gp.x[i], Gp.y[i], Gp.z[i]); dummy.rotation.set(Gp.life[i] * 5, Gp.life[i] * 7, 0); dummy.scale.set(s, s, s); dummy.updateMatrix(); glow.setMatrixAt(i, dummy.matrix);
      }
      glow.instanceMatrix.needsUpdate = true; if (glow.instanceColor) glow.instanceColor.needsUpdate = true;
    }
    for (let i = 0; i < ND; i++) {
      if (D.life[i] <= 0) continue;
      D.life[i] -= dt;
      if (D.life[i] <= 0) { decals.setMatrixAt(i, HIDE); continue; }
      const k = Math.min(1, D.life[i] / 2);                                // последние 2 с — ужимается
      dummy.position.set(D.x[i], D.y[i], D.z[i]); dummy.rotation.set(0, D.r[i], 0); dummy.scale.set(D.sx[i] * k, 1, D.sz[i] * k); dummy.updateMatrix(); decals.setMatrixAt(i, dummy.matrix);
    }
    decals.instanceMatrix.needsUpdate = true;
    for (const m of flashes) if (m.visible) {
      const u = m.userData; u.t -= dt; if (u.t <= 0) { m.visible = false; continue; }
      const k = u.t / .1; m.quaternion.copy(camera.quaternion); m.scale.setScalar(u.s * (1.4 - .6 * k)); m.material.opacity = k * .9;
    }
  }
  // смена уровня: пятна и частицы прошлого уровня не переносятся
  function clear() {
    for (let i = 0; i < NP; i++) { P.life[i] = 0; parts.setMatrixAt(i, HIDE); }
    if (glow) { for (let i = 0; i < NG; i++) { Gp.life[i] = 0; glow.setMatrixAt(i, HIDE); } glow.instanceMatrix.needsUpdate = true; }
    for (let i = 0; i < ND; i++) { D.life[i] = 0; decals.setMatrixAt(i, HIDE); }
    parts.instanceMatrix.needsUpdate = decals.instanceMatrix.needsUpdate = true;
    for (const m of flashes) m.visible = false;
  }
  const live = () => { let a = 0, b = 0; for (let i = 0; i < NP; i++) if (P.life[i] > 0) a++; for (let i = 0; i < NG; i++) if (Gp.life[i] > 0) a++; for (let i = 0; i < ND; i++) if (D.life[i] > 0) b++; return { parts: a, decals: b }; };
  return { burst, spray, ash, decal, flash, update, clear, live, emit };
}
