// Живой фон подземелий (4.13, просьба владельца): вместо чёрной пустоты вокруг залов — дымка ниже пола, угольки и пепел,
// далёкие обломки колонн, уходящие в глубину. Только вид, без источников света; пол залов непрозрачный и закрывает всё это.
// Числа — config3d.js → dungeons.bg.
import * as THREE from 'three';

const NOISE = `float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h2(i), h2(i + vec2(1., 0.)), f.x), mix(h2(i + vec2(0., 1.)), h2(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * n2(p); p *= 2.03; a *= .5; } return s; }`;

export function makeDungeonBG(cfg) {
  const B = cfg.dungeons && cfg.dungeons.bg, group = new THREE.Group(); group.visible = false;
  if (!B || !B.on) return { group, update() {}, setMap() {} };
  // дымка: плоскость под полом вокруг героя; медленный шум в мировых координатах, к краю кадра гаснет
  const MU = { uT: { value: 0 }, uC: { value: new THREE.Color(B.mist) }, uA: { value: B.mistA }, uP: { value: new THREE.Vector2() }, uR: { value: B.size / 2 } };
  const mist = new THREE.Mesh(new THREE.PlaneGeometry(B.size, B.size).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ uniforms: MU, transparent: true, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uT, uA, uR; uniform vec3 uC; uniform vec2 uP; varying vec3 vW; ${NOISE}
      void main(){ vec2 q = vW.xz * .07; float n = fbm(q + vec2(uT * .018, -uT * .011)) * .65 + fbm(q * 2.3 - vec2(uT * .03, uT * .02)) * .35;
        float edge = 1. - smoothstep(uR * .55, uR, length(vW.xz - uP)); gl_FragColor = vec4(uC * (.6 + n), uA * smoothstep(.25, .85, n) * edge); }` }));
  mist.position.y = B.mistY; mist.renderOrder = -1; group.add(mist);
  // угольки и пепел: точки в коробке вокруг героя, медленно поднимаются, по кругу
  const N = B.embers, pos = new Float32Array(N * 3), seed = new Float32Array(N), R = B.emberBox;
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - .5) * R; pos[i * 3 + 1] = Math.random() * B.emberH - 2; pos[i * 3 + 2] = (Math.random() - .5) * R; seed[i] = Math.random(); }
  const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const em = new THREE.Points(eg, new THREE.PointsMaterial({ color: B.emberC, size: B.emberS, transparent: true, opacity: .75, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  em.frustumCulled = false; group.add(em);
  // обломки колонн в глубине: столбы от -depth до чуть ниже пола, тёмные сверху вниз; ставятся на всю карту уровня
  const pg = new THREE.CylinderGeometry(.55, .8, 1, 6, 1).translate(0, -.5, 0), cols = new Float32Array(pg.attributes.position.count * 3);
  for (let i = 0; i < pg.attributes.position.count; i++) { const k = .35 + .65 * (pg.attributes.position.getY(i) + 1); cols[i * 3] = k; cols[i * 3 + 1] = k; cols[i * 3 + 2] = k; }
  pg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const pillars = new THREE.InstancedMesh(pg, new THREE.MeshBasicMaterial({ color: B.pillar, vertexColors: true, fog: false }), B.pillarMax); pillars.count = 0; group.add(pillars);
  function setMap(M, th) {
    if (th) { MU.uC.value.set(th.mist); MU.uA.value = th.mistA; em.material.color.set(th.ember); pillars.material.color.set(th.pillar); }     // 4.14: стиль подземелья
    const b = M && M.bounds; let n = 0; if (!b) { pillars.count = 0; return; }
    const O = new THREE.Object3D(); let h = 2166136261;
    const rnd = () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
    for (let x = b.x0 - 20; x < b.x1 + 20 && n < B.pillarMax; x += B.pillarStep) for (let z = b.z0 - 20; z < b.z1 + 20 && n < B.pillarMax; z += B.pillarStep) {
      if (rnd() > B.pillarChance) { rnd(); rnd(); continue; }
      const s = .7 + rnd() * .9, top = -1.6 - rnd() * 3; O.position.set(x + (rnd() - .5) * B.pillarStep * .7, top, z + (rnd() - .5) * B.pillarStep * .7); O.scale.set(s, B.depth, s); O.rotation.set(0, rnd() * 3, 0); O.updateMatrix(); pillars.setMatrixAt(n++, O.matrix);
    }
    pillars.count = n; pillars.instanceMatrix.needsUpdate = true;
  }
  let last = 0;
  function update(t, px, pz, calm) {
    const dt = Math.min(.1, Math.max(0, t - last)); last = t;
    mist.position.x = px; mist.position.z = pz; MU.uT.value = calm ? 0 : t; MU.uP.value.set(px, pz);
    em.position.set(px, 0, pz); if (calm) return;
    for (let i = 0; i < N; i++) { let y = pos[i * 3 + 1] + dt * (B.emberUp * (.5 + seed[i])); if (y > B.emberH) y -= B.emberH + 2; pos[i * 3 + 1] = y; pos[i * 3] += Math.sin(t * .7 + seed[i] * 40) * dt * .3; }
    eg.attributes.position.needsUpdate = true;
  }
  return { group, update, setMap };
}
