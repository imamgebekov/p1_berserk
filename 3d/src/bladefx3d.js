// Стихия на клинке (2026-10-20, выбор владельца на странице «Стихии на клинке»): молния — бегущие разряды, огонь — раскалённый
// металл, лёд — ледяное сияние, яд — капли, кровь — пульсирующие прожилки. Только вид. Работает с любой моделью оружия
// (weaponview.js): рукоять в нуле, рабочая часть вдоль +y от base до tip; оболочка — по рамке частей оружия выше base.
import * as THREE from 'three';

const STYLE = { storm: 'arcs', fire: 'hot', ice: 'glow', venom: 'drips', blood: 'runes' };
let glowTex = null;
const glow = () => glowTex || (glowTex = (() => { if (typeof document === 'undefined') return null; const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'), r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.4, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })());
const spriteM = (color, blend = THREE.AdditiveBlending) => new THREE.SpriteMaterial({ map: glow(), color, blending: blend, transparent: true, depthWrite: false, fog: false });
const VS = 'varying vec3 vp; varying vec3 vn; varying vec3 vv; void main(){ vp = position; vn = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vv = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }';
// оболочки: uLen — длина рабочей части, uY0 — её начало (локально), uW — полуширина
const FS = {
  hot: 'uniform float t, uY0, uLen; varying vec3 vp; void main(){ float k = clamp((vp.y-uY0)/uLen,0.,1.); float p = .8+.2*sin(t*3.); vec3 c = mix(vec3(1.,.9,.5), vec3(1.,.3,.05), k)*p; float a = (1.-smoothstep(.1,.85,k))*.85; gl_FragColor = vec4(c*a, a); }',
  glow: 'uniform float t; varying vec3 vn; varying vec3 vv; void main(){ float f = pow(1.-abs(dot(vn,vv)),1.5); gl_FragColor = vec4(vec3(.3,.65,1.)*(.12+f*1.3)*(.85+.15*sin(t*2.)), .7); }',
  runes: 'uniform float t, uW; varying vec3 vp; void main(){ float x = vp.x/max(uW,.01)*.09; float vein = smoothstep(.012,.0,abs(x - sin(vp.y*9.+1.)*.035)) + smoothstep(.01,.0,abs(x + .03 - sin(vp.y*14.)*.02))*.7; float pulse = .5+.5*sin(t*4. - vp.y*6.); vec3 c = vec3(1.,.05,.08)*vein*(.4+pulse*1.2); gl_FragColor = vec4(c, vein); }'
};

// рамка рабочей части оружия в его локальных координатах
function bladeBox(w) {
  const g = w.group, y0 = w.base.position.y, y1 = w.tip.position.y, box = new THREE.Box3(), tmp = new THREE.Box3();
  g.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  g.traverse(o => { if (!o.isMesh || !o.geometry) return; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); tmp.copy(o.geometry.boundingBox).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)); if (tmp.max.y > y0) box.union(tmp); });
  if (box.isEmpty()) box.set(new THREE.Vector3(-.06, y0, -.02), new THREE.Vector3(.06, y1, .02));
  return { y0: Math.max(y0, box.min.y), y1: Math.min(Math.max(y1, y0 + .1), box.max.y), hw: Math.max(.03, Math.min(.35, (box.max.x - box.min.x) / 2)), hd: Math.max(.015, Math.min(.2, (box.max.z - box.min.z) / 2)), cx: (box.max.x + box.min.x) / 2, cz: (box.max.z + box.min.z) / 2 };
}

// эффекты одного оружия: set(w, [стихии]) — при смене оружия или камней; update(dt, t) — каждый кадр; world — сцена для капель
export function makeBladeFx(world) {
  let w = null, key = '', parts = [], B = null, arcT = 0, arcs = null, lit = null;
  const drops = [];     // капли летят в мире, не за клинком
  function clear() {
    for (const o of parts) { o.parent && o.parent.remove(o); o.traverse(q => { if (q.geometry) q.geometry.dispose(); if (q.material) q.material.dispose(); }); }
    parts = []; arcs = null; lit = null;
  }
  const add = o => { w.group.add(o); parts.push(o); return o; };
  const shell = (fs, uniforms) => { const m = new THREE.ShaderMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, uniforms: { t: { value: 0 }, ...uniforms }, vertexShader: VS, fragmentShader: fs });
    const s = add(new THREE.Mesh(new THREE.BoxGeometry(B.hw * 2 + .03, B.y1 - B.y0, B.hd * 2 + .03), m)); s.position.set(B.cx, (B.y0 + B.y1) / 2, B.cz); s.renderOrder = 3; return s; };
  const edgeLocal = () => { const y = B.y0 + Math.random() * (B.y1 - B.y0), k = 1 - Math.max(0, (y - (B.y1 - .15)) / .15); return new THREE.Vector3(B.cx + (Math.random() < .5 ? -1 : 1) * B.hw * k, y, B.cz + (Math.random() - .5) * B.hd); };
  function set(weapon, els) {
    const k2 = weapon ? weapon.kind + '|' + (els || []).join(',') : ''; if (weapon === w && k2 === key) return; clear(); w = weapon; key = k2; if (!w || !els || !els.length) return;
    B = bladeBox(w); const st = new Set(els.map(e => STYLE[e]).filter(Boolean)), U = { uY0: { value: B.y0 }, uLen: { value: B.y1 - B.y0 }, uW: { value: B.hw } };
    if (st.has('hot')) shell(FS.hot, U);
    if (st.has('glow')) shell(FS.glow, U);
    if (st.has('runes')) shell(FS.runes, U);
    if (st.has('arcs')) { arcs = add(new THREE.Group()); lit = add(new THREE.PointLight('#9fd0ff', 0, 3)); lit.position.y = (B.y0 + B.y1) / 2; }
    if (st.has('glow')) for (let i = 0; i < 8; i++) { const s = add(new THREE.Sprite(spriteM('#ffffff'))); s.userData.flake = { t: Math.random(), p: edgeLocal().multiplyScalar(1) }; s.position.copy(s.userData.flake.p); s.position.x *= 2.2; }
    if (st.has('drips')) { const sh = add(new THREE.Sprite(spriteM('#7ad060'))); sh.scale.set(B.hw * 6, (B.y1 - B.y0) * 1.2, 1); sh.position.set(B.cx, (B.y0 + B.y1) / 2, B.cz); sh.material.opacity = .22; }
    set.st = st;
  }
  const tube = (pts, r, col, op) => { const path = new THREE.CurvePath(); for (let i = 1; i < pts.length; i++) path.add(new THREE.LineCurve3(pts[i - 1], pts[i])); return new THREE.Mesh(new THREE.TubeGeometry(path, pts.length * 2, r, 4, false), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); };
  function bolt() {
    for (const c of [...arcs.children]) { arcs.remove(c); c.geometry.dispose(); c.material.dispose(); }
    const L = B.y1 - B.y0, n = 2 + (Math.random() * 2 | 0);
    for (let k = 0; k < n; k++) {
      const y0 = B.y0 + Math.random() * L * .4, y1 = Math.min(B.y1 + .1, y0 + L * (.35 + Math.random() * .6)), side = Math.random() < .5 ? -1 : 1, pts = [];
      for (let y = y0; y <= y1; y += .06 + Math.random() * .06) pts.push(new THREE.Vector3(B.cx + side * B.hw * (.5 + Math.random() * .9) * (Math.random() < .3 ? -1 : 1), y, B.cz + (Math.random() - .5) * B.hd * 3));
      if (pts.length < 2) continue; arcs.add(tube(pts, .012, '#ffffff', 1), tube(pts, .035, '#6ab8ff', .45));
      if (Math.random() < .45) { const s = pts[(pts.length * Math.random()) | 0], q = [s], d = new THREE.Vector3(side, Math.random() - .3, Math.random() - .5).normalize(); for (let i = 0; i < 4; i++) q.push(q[q.length - 1].clone().addScaledVector(d, .08 + Math.random() * .06).add(new THREE.Vector3((Math.random() - .5) * .05, (Math.random() - .5) * .05, 0))); arcs.add(tube(q, .008, '#ffffff', .9), tube(q, .025, '#6ab8ff', .35)); }
    }
    if (lit) lit.intensity = .8 + Math.random() * 1.4;
  }
  const drip = (color, n) => { if (!world || !w) return; for (let i = 0; i < n; i++) { const p = edgeLocal(); w.group.localToWorld(p); const s = new THREE.Sprite(spriteM(color, THREE.NormalBlending)); s.position.copy(p); s.scale.set(.05, .05, 1); world.add(s); drops.push({ s, t: 0, hang: .3 + Math.random() * .4, v: 0 }); } };
  function update(dt, t, calm = false) {
    for (const o of parts) if (o.isMesh && o.material.uniforms) o.material.uniforms.t.value = t;
    if (arcs && !calm && (arcT -= dt) <= 0) { arcT = .07; if (Math.random() < .85) bolt(); }
    if (arcs && calm && !arcs.children.length) bolt();
    for (const o of parts) { const f = o.userData.flake; if (!f) continue; f.t += dt; if (f.t > 1) { f.t = 0; f.p = edgeLocal(); } o.position.set(B.cx + (f.p.x - B.cx) * 2.2, f.p.y - f.t * .1, f.p.z); o.scale.setScalar(.06 * Math.sin(f.t * Math.PI)); }
    const st = set.st;
    if (w && st && !calm) { if (st.has('drips') && Math.random() < dt * 3) drip('#8aff60', 1); if (st.has('runes') && Math.random() < dt * .8) drip('#a00818', 1); }
    for (let i = drops.length - 1; i >= 0; i--) { const d = drops[i]; d.t += dt; if (d.t < d.hang) { d.s.scale.set(.05, .05 + d.t * .08, 1); d.s.position.y -= dt * .05; } else { d.v += 7 * dt; d.s.position.y -= d.v * dt; d.s.scale.set(.045, .1, 1); }
      if (d.t > d.hang + .8) { world.remove(d.s); d.s.material.dispose(); drops.splice(i, 1); } }
  }
  return { set, update, dispose: () => { clear(); for (const d of drops) { world && world.remove(d.s); d.s.material.dispose(); } drops.length = 0; w = null; key = ''; } };
}
// стихии оружия для эффекта: сплав камней (a, b) или своя стихия вещи
export const bladeEls = wp => { const mx = wp && wp.mix; return mx ? [...new Set([mx.a, mx.b].filter(Boolean))] : wp && wp.el ? [wp.el] : []; };
export const hasBladeStyle = el => !!STYLE[el];
