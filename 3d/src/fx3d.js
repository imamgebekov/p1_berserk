// Эффекты боя одним вызовом отрисовки на вид: частицы (искры, кровь, пепел), пятна на земле и вспышки попадания. Только графика.
// Частицы и пятна — InstancedMesh: сотни штук без лишних вызовов отрисовки (важно для iPhone).
import * as THREE from 'three';

export function createFx(scene, camera, n = { parts: 400, glow: 900, decals: 64, flashes: 8, debris: 300 }, groundY = () => 0) {
  const dummy = new THREE.Object3D(), col = new THREE.Color(), HIDE = new THREE.Matrix4().makeScale(0, 0, 0);

  const STRETCH = { 0: 1, 2: 1, 11: 1, 14: 1, 15: 1, 22: 1 };     // спрайты, что тянем вдоль полёта: линии, дуги, молнии
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
  const NG = n.glow || 0, Gp = { sp: new Float32Array(NG), x: new Float32Array(NG), y: new Float32Array(NG), z: new Float32Array(NG), vx: new Float32Array(NG), vy: new Float32Array(NG), vz: new Float32Array(NG), life: new Float32Array(NG), max: new Float32Array(NG), g: new Float32Array(NG), s: new Float32Array(NG) };
  // мягкое свечение (2026-11-03, просьба владельца «не кубики»): плоский квадрат лицом к камере с радиальной текстурой; быстрые частицы вытянуты вдоль полёта — штрихи-шлейфы
  const dotTex = (() => { if (typeof document === 'undefined') return null; const cv = document.createElement('canvas'); cv.width = cv.height = 64; const cx = cv.getContext('2d'), g = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.75)'); g.addColorStop(.6, 'rgba(255,255,255,.2)'); g.addColorStop(1, 'rgba(255,255,255,0)'); cx.fillStyle = g; cx.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  // атлас спрайтов Kenney Particle Pack (CC0, 2026-11-03): 5×5 ячеек по 96 px, ячейка 0 — мягкая точка; у частицы свой номер ячейки (aSp); пока атлас грузится — одна точка
  let atlasOn = 0;
  const ATL = 5, atlasTex = (() => { if (typeof Image === 'undefined' || !dotTex) return null; const im = new Image(), t = new THREE.Texture(im); t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; im.onload = () => { atlasOn = 1; t.needsUpdate = true; if (glowMat.userData.sh) glowMat.userData.sh.uniforms.uAt.value = 1; glowMat.map = t; glowMat.needsUpdate = true; }; im.src = new URL('../models/vfx_atlas.webp', import.meta.url).href; return t; })();
  const glowMat = new THREE.MeshBasicMaterial({ color: '#fff', map: dotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, depthTest: false });     // depthTest: false — крупные плоские спрайты не режутся землёй (прямой срез снизу); fog: false — туман подмешивал свой цвет в чёрные места спрайта (светлые квадраты)
  if (dotTex) glowMat.onBeforeCompile = sh => { glowMat.userData.sh = sh; sh.uniforms.uAt = { value: atlasOn };
    sh.vertexShader = 'attribute float aSp; uniform float uAt;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n if (uAt > .5) vMapUv = (uv + vec2(mod(aSp, 5.), 4. - floor(aSp / 5.))) / 5.;\n#endif'); };
  const glow = NG ? new THREE.InstancedMesh(dotTex ? new THREE.PlaneGeometry(1, 1) : new THREE.BoxGeometry(1, 1, 1), glowMat, NG) : null;
  const spA = new Float32Array(NG || 1); if (glow && dotTex) glow.geometry.setAttribute('aSp', new THREE.InstancedBufferAttribute(spA, 1));
  const camQ = new THREE.Quaternion(), rollQ = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1), cr = new THREE.Vector3(), cu = new THREE.Vector3();
  if (glow) { glow.frustumCulled = false; for (let i = 0; i < NG; i++) { glow.setMatrixAt(i, HIDE); glow.setColorAt(i, col.set('#000')); } glow.renderOrder = 2; scene.add(glow); }
  let gi = 0;
  // частица: add — светящаяся (огонь, искры), иначе обычная (дым, кровь, пузыри)
  function emit(x, y, z, vx, vy, vz, color, life, g, s, add = false, sp = 0) {
    if (!add || !glow) return emitP(x, y, z, vx, vy, vz, color, life, g, s);
    const i = gi = (gi + 1) % NG;
    Gp.x[i] = x; Gp.y[i] = y; Gp.z[i] = z; Gp.vx[i] = vx; Gp.vy[i] = vy; Gp.vz[i] = vz; Gp.life[i] = Gp.max[i] = life; Gp.g[i] = g; Gp.s[i] = s; Gp.sp[i] = sp; spA[i] = sp;
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

  // ---- обломки (план физики, этап 4): куски-клинья с вращением, отскоком от земли и трением; лёгшие не считаются; без теней ----
  const NB = n.debris || 0, Bd = { x: new Float32Array(NB), y: new Float32Array(NB), z: new Float32Array(NB), vx: new Float32Array(NB), vy: new Float32Array(NB), vz: new Float32Array(NB), rx: new Float32Array(NB), ry: new Float32Array(NB), wx: new Float32Array(NB), wy: new Float32Array(NB), life: new Float32Array(NB), s: new Float32Array(NB), rest: new Uint8Array(NB) };
  const deb = NB ? new THREE.InstancedMesh(new THREE.BoxGeometry(1, .35, .6), new THREE.MeshLambertMaterial({ color: '#fff' }), NB) : null;
  if (deb) { deb.frustumCulled = false; deb.castShadow = deb.receiveShadow = false; for (let i = 0; i < NB; i++) { deb.setMatrixAt(i, HIDE); deb.setColorAt(i, col.set('#000')); } scene.add(deb); }
  let bi = 0, bcap = NB, DB = { life: 4, bounce: .35, fric: .6 };
  // cnt кусков из (x, y, z) веером по (dx, dz) (0, 0 — во все стороны); colors — цвета набора; sp — скорость, size — размер
  function debris(x, y, z, dx, dz, cnt, colors, sp = 4, size = .18) {
    if (!deb || !bcap) return; const base = dx || dz ? Math.atan2(dx, dz) : 0, spread = dx || dz ? 1.1 : Math.PI;
    for (let k = 0; k < cnt; k++) {
      const i = bi = (bi + 1) % bcap, a = base + (Math.random() - .5) * 2 * spread, v = sp * (.35 + Math.random() * .65);
      Bd.x[i] = x + (Math.random() - .5) * .3; Bd.y[i] = y + Math.random() * .3; Bd.z[i] = z + (Math.random() - .5) * .3; Bd.vx[i] = Math.sin(a) * v; Bd.vy[i] = 2.5 + Math.random() * 3; Bd.vz[i] = Math.cos(a) * v;
      Bd.rx[i] = Math.random() * 6.28; Bd.ry[i] = Math.random() * 6.28; Bd.wx[i] = (Math.random() - .5) * 18; Bd.wy[i] = (Math.random() - .5) * 18; Bd.life[i] = DB.life * (.8 + Math.random() * .4); Bd.s[i] = size * (.6 + Math.random() * .8); Bd.rest[i] = 0;
      deb.setColorAt(i, col.set(colors[k % colors.length]));
    }
    deb.instanceColor.needsUpdate = true;
  }
  // предел кусков в кадре (телефон меньше) и числа отскока
  function debrisCfg(cap, o) { if (!deb) return; for (let i = Math.min(cap, NB); i < bcap; i++) { Bd.life[i] = 0; deb.setMatrixAt(i, HIDE); } bcap = Math.min(cap, NB); bi = 0; if (o) DB = { ...DB, ...o }; deb.instanceMatrix.needsUpdate = true; }

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
  // дым и взрывы (Kenney Smoke Particles, CC0, 2026-11-03): цветные спрайты с прозрачностью, обычное смешивание; ячейки 5×5 по 128 px: 0–6 белый дым, 7–11 чёрный, 12–16 взрыв, 17–21 вспышка, 22–24 ядовито-зелёный
  const NQ = dotTex ? (n.puff ?? 260) : 0, Q = { x: new Float32Array(NQ), y: new Float32Array(NQ), z: new Float32Array(NQ), vx: new Float32Array(NQ), vy: new Float32Array(NQ), vz: new Float32Array(NQ), life: new Float32Array(NQ), max: new Float32Array(NQ), g: new Float32Array(NQ), s: new Float32Array(NQ), gr: new Float32Array(NQ), sp: new Float32Array(NQ) };
  let puff = null, qi = 0; const opA = new Float32Array(NQ || 1);
  if (NQ) { const im = new Image(), t = new THREE.Texture(im); t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter;
    const mat = new THREE.MeshBasicMaterial({ color: '#fff', map: t, transparent: true, depthWrite: false });
    mat.onBeforeCompile = sh => { sh.vertexShader = 'attribute float aSp; attribute float aOp; varying float vOp;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n vOp = aOp;\n#ifdef USE_MAP\n vMapUv = (uv + vec2(mod(aSp, 5.), 4. - floor(aSp / 5.))) / 5.;\n#endif'); sh.fragmentShader = 'varying float vOp;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', '#include <opaque_fragment>\n gl_FragColor.a *= vOp;'); };
    puff = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, NQ); puff.frustumCulled = false; puff.visible = false; puff.renderOrder = 1; puff.geometry.setAttribute('aSp', new THREE.InstancedBufferAttribute(new Float32Array(NQ), 1)); puff.geometry.setAttribute('aOp', new THREE.InstancedBufferAttribute(opA, 1));
    for (let i = 0; i < NQ; i++) { puff.setMatrixAt(i, HIDE); puff.setColorAt(i, col.set('#fff')); } scene.add(puff); im.onload = () => { t.needsUpdate = true; puff.visible = true; }; im.src = new URL('../models/vfx_puff.webp', import.meta.url).href; }
  // облако: sp — ячейка атласа, gr — во сколько раз вырастает за жизнь
  function emitPuff(x, y, z, vx, vy, vz, color, life, g, s, sp = 0, gr = 1.2) {
    if (!NQ) return; const i = qi = (qi + 1) % NQ;
    Q.x[i] = x; Q.y[i] = y; Q.z[i] = z; Q.vx[i] = vx; Q.vy[i] = vy; Q.vz[i] = vz; Q.life[i] = Q.max[i] = life; Q.g[i] = g; Q.s[i] = s; Q.gr[i] = gr; Q.sp[i] = sp; puff.geometry.attributes.aSp.array[i] = sp; puff.setColorAt(i, col.set(color));
  }
  const flashes = [];
  for (let i = 0; i < n.flashes; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#fff', map: dotTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, depthTest: false })); m.visible = false; m.userData.t = 0; scene.add(m); flashes.push(m); }
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
      if (dotTex) { camera.updateMatrixWorld(); camQ.copy(camera.quaternion); cr.setFromMatrixColumn(camera.matrixWorld, 0); cu.setFromMatrixColumn(camera.matrixWorld, 1); }
      for (let i = 0; i < NG; i++) {
        if (Gp.life[i] <= 0) continue;
        Gp.life[i] -= dt; if (Gp.life[i] <= 0) { glow.setMatrixAt(i, HIDE); continue; }
        Gp.vy[i] -= Gp.g[i] * dt; Gp.x[i] += Gp.vx[i] * dt; Gp.y[i] += Gp.vy[i] * dt; Gp.z[i] += Gp.vz[i] * dt;
        const k = Math.min(1, Gp.life[i] / Gp.max[i] * 1.4), s = Gp.s[i] * k;
        dummy.position.set(Gp.x[i], Gp.y[i], Gp.z[i]);
        const STR = STRETCH[Gp.sp[i]];
        if (dotTex && !STR) { rollQ.setFromAxisAngle(zAxis, (Gp.sp[i] === 16 || Gp.sp[i] === 23 || Gp.sp[i] === 6 ? Gp.life[i] * 2.5 : 0)); dummy.quaternion.copy(camQ).multiply(rollQ); dummy.scale.set(s * 2.2, s * 2.2, 1); }
        else if (dotTex) { const sx = Gp.vx[i] * cr.x + Gp.vy[i] * cr.y + Gp.vz[i] * cr.z, sy = Gp.vx[i] * cu.x + Gp.vy[i] * cu.y + Gp.vz[i] * cu.z, sp = Math.hypot(sx, sy), st = 1 + Math.min(3.2, sp * .3);     // штрих вдоль скорости на экране
          rollQ.setFromAxisAngle(zAxis, Math.atan2(sy, sx)); dummy.quaternion.copy(camQ).multiply(rollQ); dummy.scale.set(s * 2.2 * st, s * 2.2, 1); }
        else { dummy.rotation.set(Gp.life[i] * 5, Gp.life[i] * 7, 0); dummy.scale.set(s, s, s); }
        dummy.updateMatrix(); glow.setMatrixAt(i, dummy.matrix);
      }
      glow.instanceMatrix.needsUpdate = true; if (glow.instanceColor) glow.instanceColor.needsUpdate = true; if (dotTex) glow.geometry.attributes.aSp.needsUpdate = true;
    }
    if (NQ && puff.visible) {
      camera.updateMatrixWorld(); camQ.copy(camera.quaternion);
      for (let i = 0; i < NQ; i++) { if (Q.life[i] <= 0) continue; Q.life[i] -= dt; if (Q.life[i] <= 0) { puff.setMatrixAt(i, HIDE); opA[i] = 0; continue; }
        Q.vy[i] -= Q.g[i] * dt; Q.x[i] += Q.vx[i] * dt; Q.y[i] += Q.vy[i] * dt; Q.z[i] += Q.vz[i] * dt; const k = Q.life[i] / Q.max[i], sz = Q.s[i] * (1 + (1 - k) * Q.gr[i]); opA[i] = Math.min(1, k * 2.2) * Math.min(1, (1 - k) * 12 + .25);
        rollQ.setFromAxisAngle(zAxis, Q.sp[i] * 1.7 + (1 - k) * .6); dummy.position.set(Q.x[i], Q.y[i], Q.z[i]); dummy.quaternion.copy(camQ).multiply(rollQ); dummy.scale.set(sz, sz, 1); dummy.updateMatrix(); puff.setMatrixAt(i, dummy.matrix); }
      puff.instanceMatrix.needsUpdate = true; if (puff.instanceColor) puff.instanceColor.needsUpdate = true; puff.geometry.attributes.aOp.needsUpdate = true; puff.geometry.attributes.aSp.needsUpdate = true;
    }
    for (let i = 0; i < ND; i++) {
      if (D.life[i] <= 0) continue;
      D.life[i] -= dt;
      if (D.life[i] <= 0) { decals.setMatrixAt(i, HIDE); continue; }
      const k = Math.min(1, D.life[i] / 2);                                // последние 2 с — ужимается
      dummy.position.set(D.x[i], D.y[i], D.z[i]); dummy.rotation.set(0, D.r[i], 0); dummy.scale.set(D.sx[i] * k, 1, D.sz[i] * k); dummy.updateMatrix(); decals.setMatrixAt(i, dummy.matrix);
    }
    decals.instanceMatrix.needsUpdate = true;
    if (deb) { let ch = false;
      for (let i = 0; i < bcap; i++) {
        if (Bd.life[i] <= 0) continue;
        Bd.life[i] -= dt; if (Bd.life[i] <= 0) { deb.setMatrixAt(i, HIDE); ch = true; continue; }
        if (Bd.rest[i] && Bd.life[i] > .6) continue;     // лёг — матрица та же, пока не начал таять
        if (!Bd.rest[i]) {
          Bd.vy[i] -= 14 * dt; Bd.x[i] += Bd.vx[i] * dt; Bd.y[i] += Bd.vy[i] * dt; Bd.z[i] += Bd.vz[i] * dt; Bd.rx[i] += Bd.wx[i] * dt; Bd.ry[i] += Bd.wy[i] * dt;
          const gy = groundY(Bd.x[i], Bd.z[i]) + Bd.s[i] * .18;
          if (Bd.y[i] < gy) { Bd.y[i] = gy; if (Bd.vy[i] < 0) Bd.vy[i] *= -DB.bounce; Bd.vx[i] *= DB.fric; Bd.vz[i] *= DB.fric; Bd.wx[i] *= DB.fric; Bd.wy[i] *= DB.fric;
            if (Math.abs(Bd.vy[i]) < .7 && Math.hypot(Bd.vx[i], Bd.vz[i]) < .35) { Bd.rest[i] = 1; Bd.vy[i] = 0; Bd.rx[i] = Math.round(Bd.rx[i] / Math.PI) * Math.PI; } }     // лёг плашмя
        }
        const k = Math.min(1, Bd.life[i] / .6), s = Bd.s[i] * k;
        dummy.position.set(Bd.x[i], Bd.y[i], Bd.z[i]); dummy.rotation.set(Bd.rx[i], Bd.ry[i], 0); dummy.scale.set(s, s, s); dummy.updateMatrix(); deb.setMatrixAt(i, dummy.matrix); ch = true;
      }
      if (ch) deb.instanceMatrix.needsUpdate = true;
    }
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
    for (let i = 0; i < NQ; i++) { Q.life[i] = 0; puff.setMatrixAt(i, HIDE); }
    if (deb) { for (let i = 0; i < NB; i++) { Bd.life[i] = 0; deb.setMatrixAt(i, HIDE); } deb.instanceMatrix.needsUpdate = true; }
    parts.instanceMatrix.needsUpdate = decals.instanceMatrix.needsUpdate = true;
    for (const m of flashes) m.visible = false;
  }
  const live = () => { let a = 0, b = 0; for (let i = 0; i < NP; i++) if (P.life[i] > 0) a++; for (let i = 0; i < NG; i++) if (Gp.life[i] > 0) a++; for (let i = 0; i < ND; i++) if (D.life[i] > 0) b++; let c = 0; for (let i = 0; i < NB; i++) if (Bd.life[i] > 0) c++; return { parts: a, decals: b, debris: c }; };
  return { burst, spray, ash, decal, flash, update, clear, live, emit, emitPuff, debris, debrisCfg };
}
