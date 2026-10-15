// Сцена Three.js: мир, свет, камера, спецэффекты. Рисует в маленьком разрешении и растягивает без сглаживания.
import { makeMap, propsBlocked } from './map.js';
import { buildDecor } from './decor.js';
import { buildTown } from './town.js';
import { buildLevelView, buildSurfaceView } from './levelview.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeHero, animateHero, makeMonster, animateMonster, makeCampfire, addTree, addRock, makeNpc, makeSoldier, animateSoldier } from './models.js';
import { mulberry32 } from './sim.js';
import { questMark } from './quests3d.js';
import { skyAt } from './daynight.js';
import { BY_ID } from './data/items.js';
import { trailOn } from './anim3d.js';

const FOG = '#150c0b';

function groundTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), r = mulberry32(5);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const v = r(), base = v < .08 ? [46, 36, 30] : v < .3 ? [30, 23, 19] : [23, 17, 15];
    g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`; g.fillRect(x, y, 1, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(70, 70);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function skyDome() {
  const geo = new THREE.SphereGeometry(500, 24, 16), col = [], pos = geo.attributes.position;
  const top = new THREE.Color('#2a1a1c'), hor = new THREE.Color('#9a5a3a'), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { const k = Math.pow(Math.max(0, pos.getY(i) / 500), .6); tmp.copy(hor).lerp(top, k); col.push(tmp.r, tmp.g, tmp.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  const eclipse = new THREE.Group();
  eclipse.add(new THREE.Mesh(new THREE.CircleGeometry(38, 40), new THREE.MeshBasicMaterial({ color: '#030102', fog: false })));
  const ring = new THREE.Mesh(new THREE.RingGeometry(38, 46, 40), new THREE.MeshBasicMaterial({ color: '#c4161c', fog: false, transparent: true, opacity: .85 }));
  ring.position.z = -.1; eclipse.add(ring);
  const glow = new THREE.Mesh(new THREE.RingGeometry(46, 70, 40), new THREE.MeshBasicMaterial({ color: '#7a1010', fog: false, transparent: true, opacity: .25 }));
  glow.position.z = -.2; eclipse.add(glow);
  eclipse.position.set(-110, 200, -380); eclipse.lookAt(0, 0, 0);
  m.add(eclipse);
  return m;
}

const angDiffTo = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

const FXCOL = { fire: '#ff8a30', frost: '#9fdcff', venom: '#7ad060', storm: '#ffe27a', bleed: '#d03030' };

export function createRenderer(canvas, cfg, hooks = {}) {
  const gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!hooks.preserve });
  gl.setPixelRatio(1);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FOG);
  scene.fog = new THREE.FogExp2(FOG, cfg.view.fogDensity);
  const camera = new THREE.PerspectiveCamera(cfg.view.fov, 1, .5, 700);

  // свет: тусклое «багровое» небо, холодный свет затмения и тёплый костёр
  const hemi = new THREE.HemisphereLight('#a8847a', '#2a1a16', 2.4); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffa080', 1.7); sun.position.set(-30, 50, -40); scene.add(sun);
  const dome = skyDome(); scene.add(dome);
  let lastLight = -1;

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshLambertMaterial({ map: groundTexture() }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);

  const map = makeMap(cfg);
  const town = buildTown(map, cfg, mulberry32(cfg.world.seed + 1)); scene.add(town.group);
  const decor = buildDecor(map, mulberry32(cfg.world.seed + 2)); scene.add(decor.group);
  const npcs = [];
  for (const b of map.buildings) if (b.npc) { const n = makeNpc(b.npc.kind); n.group.position.set(b.npc.x, 0, b.npc.z); n.pos = b.npc; n.mark = new THREE.Mesh(new THREE.OctahedronGeometry(.22), new THREE.MeshBasicMaterial({ color: '#e8c04a' })); n.mark.position.set(0, 2.6, 0); n.mark.visible = false; n.group.add(n.mark); scene.add(n.group); npcs.push(n); }

  // деревья и камни одним мешем (один вызов отрисовки)
  const rnd = mulberry32(cfg.world.seed), parts = [];
  for (let i = 0; i < cfg.world.props; i++) {
    const a = rnd() * Math.PI * 2, d = 7 + Math.sqrt(rnd()) * (cfg.world.radius - 8), x = Math.cos(a) * d, z = Math.sin(a) * d;
    const tree = rnd() < .65;
    if (propsBlocked(map, x, z)) continue;                             // не растим деревья в домах, на дорогах и в областях
    (tree ? addTree : addRock)(parts, rnd, x, z);
  }
  // граница мира: частокол из мёртвых стволов
  for (let i = 0; i < 70; i++) { const a = i / 70 * Math.PI * 2, R = cfg.world.radius + 1.5; addTree(parts, rnd, Math.cos(a) * R, Math.sin(a) * R); }
  const props = new THREE.Mesh(mergeGeometries(parts, false), new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.add(props);

  const fire = makeCampfire(); scene.add(fire.group);
  // фонарь героя: светит только в подземельях (там нет неба и солнца)
  const lantern = new THREE.PointLight('#ffb070', 22, 16, 1.4); lantern.visible = false; scene.add(lantern);   // спрятанный свет не считается в шейдерах поверхности

  // пепел в воздухе
  const ashN = 140, ashPos = new Float32Array(ashN * 3);
  for (let i = 0; i < ashN; i++) { ashPos[i * 3] = (rnd() - .5) * 60; ashPos[i * 3 + 1] = rnd() * 14; ashPos[i * 3 + 2] = (rnd() - .5) * 60; }
  const ashGeo = new THREE.BufferGeometry(); ashGeo.setAttribute('position', new THREE.BufferAttribute(ashPos, 3));
  const ash = new THREE.Points(ashGeo, new THREE.PointsMaterial({ color: '#bfb5a0', size: 2, sizeAttenuation: false, transparent: true, opacity: .6 }));
  scene.add(ash);

  // герой и враги
  // виды уровней строятся при первом входе; поверхность прячется, пока герой внизу
  const surfaceObjs = [dome, ground, town.group, decor.group, props, fire.group, ash, ...npcs.map(n => n.group)];
  const views = new Map(); let shownLvl = null, conts = null, curView = null;
  function showLevel(W) {
    const id = W.lvl, L = W.levels[id];
    if (!views.has(id)) { const v = L.def ? buildLevelView(L, cfg) : buildSurfaceView(L); scene.add(v.group); views.set(id, v); }
    for (const [k, v] of views) v.group.visible = k === id;
    const up = !L.def; for (const o of surfaceObjs) o.visible = up;
    sun.visible = up; lantern.visible = !up;
    if (!up) { scene.fog.color.set('#070504'); scene.background.set('#070504'); hemi.color.set('#6a5a50'); hemi.groundColor.set('#1a1210'); hemi.intensity = .9; }
    lastLight = -1; shownLvl = id; curView = views.get(id); conts = curView.conts;
  }
  const hero = makeHero(); scene.add(hero.group);
  // след клинка: лента между началом и концом рабочей части оружия за последние кадры (светится и гаснет)
  const TRAIL_N = 14, TRAIL_LIFE = .16, trailPos = new Float32Array(TRAIL_N * 6), trailCol = new Float32Array(TRAIL_N * 6), trailIdx = [];
  for (let i = 0; i < TRAIL_N - 1; i++) trailIdx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
  const trailGeo = new THREE.BufferGeometry(); trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3)); trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3)); trailGeo.setIndex(trailIdx);
  const trail = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  trail.frustumCulled = false; trail.visible = false; scene.add(trail);
  const trailS = [], trailC = new THREE.Color(), PERK_TRAIL = { fire: FXCOL.fire, frost: FXCOL.frost, venom: FXCOL.venom, storm: FXCOL.storm, rend: FXCOL.bleed, siphon: FXCOL.bleed };
  function updateTrail(W, p, dt) {
    for (const s of trailS) s.age += dt;
    while (trailS.length && trailS[0].age > TRAIL_LIFE) trailS.shift();
    const w = hero.weapon, P = cfg.player, sw = W.gear.swing || 1;
    if (w && p.state === 'atk' && trailOn(p.atkT / (P.attackTime * sw), P.attackHitAt / P.attackTime)) {
      hero.group.updateMatrixWorld(true);
      trailS.push({ a: w.base.getWorldPosition(new THREE.Vector3()), b: w.tip.getWorldPosition(new THREE.Vector3()), age: 0 });
      if (trailS.length > TRAIL_N) trailS.shift();
    }
    trail.visible = trailS.length > 1; if (!trail.visible) return;
    const perk = (W.wp.perks || []).find(k => PERK_TRAIL[k]), str = p.fin ? .8 : .5;
    trailC.set(perk ? PERK_TRAIL[perk] : '#fff1dc');
    for (let i = 0; i < TRAIL_N; i++) {
      const s = trailS[Math.min(i, trailS.length - 1)], f = Math.max(0, 1 - s.age / TRAIL_LIFE) * str * (i < trailS.length ? 1 : 0);
      trailPos.set([s.a.x, s.a.y, s.a.z, s.b.x, s.b.y, s.b.z], i * 6);
      trailCol.set([0, 0, 0, trailC.r * f, trailC.g * f, trailC.b * f], i * 6);     // у основания гаснет: виден только край размаха
    }
    trailGeo.attributes.position.needsUpdate = true; trailGeo.attributes.color.needsUpdate = true;
  }
  const heroShadow = shadow(.7); scene.add(heroShadow);
  const ents = new Map(), allyEnts = new Map();
  const bars = new Map();
  const arcMat = new THREE.MeshBasicMaterial({ color: '#ffd9c0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const arc = new THREE.Mesh(new THREE.CircleGeometry(1, 24), arcMat); arc.rotation.x = -Math.PI / 2; arc.position.y = .08; scene.add(arc);
  let arcFor = -1, swingFx = 0;
  function arcGeometry(deg) {
    if (arcFor === deg) return;
    arcFor = deg; arc.geometry.dispose();
    const a = deg * Math.PI / 180; arc.geometry = new THREE.CircleGeometry(1, 24, Math.PI / 2 - a / 2, a);
  }

  // частицы-кубики
  const pool = []; const pg = new THREE.BoxGeometry(.14, .14, .14);
  for (let i = 0; i < 48; i++) { const m = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ color: '#a1121f' })); m.visible = false; m.userData = { life: 0, vx: 0, vy: 0, vz: 0 }; scene.add(m); pool.push(m); }
  let pi = 0;
  function burst(x, y, z, n, color, sp = 4) {
    for (let k = 0; k < n; k++) {
      const m = pool[pi = (pi + 1) % pool.length]; m.visible = true; m.material.color.set(color); m.position.set(x, y, z);
      const a = Math.random() * 6.283; m.userData = { life: .5 + Math.random() * .4, vx: Math.cos(a) * sp * Math.random(), vy: 2 + Math.random() * 3, vz: Math.sin(a) * sp * Math.random() };
    }
  }

  function shadow(r) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 14), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: .5, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = .03; return m;
  }

  function entity(e) {
    let en = ents.get(e.id);
    if (!en) {
      const m = makeMonster(e.type, cfg), sh = shadow(.55 * cfg.enemies[e.type].scale);
      const ring = new THREE.Mesh(new THREE.RingGeometry(.9, 1, 28), new THREE.MeshBasicMaterial({ color: '#ff3a2a', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = .06;
      scene.add(m.group, sh, ring);
      en = { m, sh, ring }; ents.set(e.id, en);
    }
    return en;
  }
  function bar(e, color = '#a1121f') {
    let b = bars.get(e.id);
    if (!b) {
      const g = new THREE.Group();
      const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .16), new THREE.MeshBasicMaterial({ color: '#120d0c', depthTest: false }));
      const fill = new THREE.Mesh(new THREE.PlaneGeometry(1, .1), new THREE.MeshBasicMaterial({ color, depthTest: false }));
      fill.geometry.translate(.5, 0, 0); fill.position.set(-.5, 0, .01); bg.renderOrder = 10; fill.renderOrder = 11;
      g.add(bg, fill); scene.add(g); b = { g, fill }; bars.set(e.id, b);
    }
    return b;
  }

  // ---- размеры: рисуем в маленьком разрешении, растягиваем CSS-ом без сглаживания ----
  let cssW = 1, cssH = 1;
  function resize(w, h) {
    cssW = w || cssW; cssH = h || cssH;
    const ps = Math.max(1, Math.round(cfg.view.pixelScale));
    gl.setSize(Math.max(8, Math.floor(cssW / ps)), Math.max(8, Math.floor(cssH / ps)), false);
    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    camera.aspect = cssW / cssH; camera.updateProjectionMatrix();
  }
  const cam = { x: 0, z: 8, init: false };
  const screen = new THREE.Vector3();

  function project(x, y, z) {
    screen.set(x, y, z).project(camera);
    return { x: (screen.x * .5 + .5) * cssW, y: (-screen.y * .5 + .5) * cssH, vis: screen.z < 1 };
  }

  // молния между врагами и расходящееся кольцо: короткие эффекты из пула
  const fxPool = []; let tomb = null;
  function zap(x1, z1, x2, z2) {
    const len = Math.hypot(x2 - x1, z2 - z1), m = new THREE.Mesh(new THREE.BoxGeometry(.12, .12, len), new THREE.MeshBasicMaterial({ color: '#ffe27a' }));
    m.position.set((x1 + x2) / 2, 1.2, (z1 + z2) / 2); m.rotation.y = Math.atan2(x2 - x1, z2 - z1); scene.add(m); fxPool.push({ m, t: .18, kind: 'zap' });
  }
  function ringFx(x, z, r, color) {
    const m = new THREE.Mesh(new THREE.RingGeometry(.85, 1, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .8, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, .1, z); scene.add(m); fxPool.push({ m, t: .35, kind: 'ring', r });
  }
  // предупреждение босса: круг, кольцо или линия рывка, пока идёт замах
  const teleRing = new THREE.Mesh(new THREE.RingGeometry(.97, 1, 48), new THREE.MeshBasicMaterial({ color: '#ff3a2a', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  const teleDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: '#ff3a2a', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  const teleInner = new THREE.Mesh(new THREE.RingGeometry(.97, 1, 32), new THREE.MeshBasicMaterial({ color: '#8affc0', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  const teleLine = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#ff3a2a', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  for (const m of [teleRing, teleDisc, teleInner, teleLine]) { m.rotation.x = -Math.PI / 2; m.position.y = .09; m.visible = false; scene.add(m); }
  // стрелы и пятна колдовства: небольшие пулы мешей
  const projMeshes = [], hazMeshes = [];
  for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(.14, .14, .9), new THREE.MeshBasicMaterial({ color: '#ffd27a' })); m.visible = false; scene.add(m); projMeshes.push(m); }
  for (let i = 0; i < 6; i++) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(.94, 1, 40), new THREE.MeshBasicMaterial({ color: '#d060ff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 36), new THREE.MeshBasicMaterial({ color: '#8a30c0', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    for (const m of [ring, disc]) { m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); }
    ring.position.y = .1; disc.position.y = .08; hazMeshes.push({ ring, disc });
  }
  function updateFoes(W, t) {
    projMeshes.forEach((m, i) => { const q = W.proj[i]; m.visible = !!q; if (q) { m.position.set(q.x, 1.1, q.z); m.rotation.y = Math.atan2(q.vx, q.vz); } });
    hazMeshes.forEach((h, i) => {
      const z = W.haz[i]; h.ring.visible = h.disc.visible = !!z; if (!z) return;
      const k = Math.min(1, z.t / z.delay), pulse = .3 + .25 * Math.sin(t * 28) + .25 * k, col = z.by === 'elite' ? '#ff7a20' : '#d060ff';
      h.ring.material.color.set(col); h.disc.material.color.set(z.by === 'elite' ? '#c04a10' : '#8a30c0');
      h.ring.position.x = h.disc.position.x = z.x; h.ring.position.z = h.disc.position.z = z.z; h.ring.scale.setScalar(z.r); h.disc.scale.setScalar(z.r * k);
      h.ring.material.opacity = .9; h.disc.material.opacity = pulse * .6;
    });
  }
  function updateTele(W, t) {
    teleRing.visible = teleDisc.visible = teleInner.visible = teleLine.visible = false;
    for (const e of W.enemies) {
      if (!e.boss || e.dead || !e.b || e.b.state !== 'wind') continue;
      const a = e.b.atk, k = Math.min(1, a.t / a.wind), pulse = .25 + .25 * Math.sin(t * 30) + .2 * k;
      if (a.kind === 'charge') {
        teleLine.visible = true; teleLine.scale.set(a.width, a.len, 1); teleLine.position.set(a.x + a.dx * a.len / 2, .09, a.z + a.dz * a.len / 2);
        teleLine.rotation.set(-Math.PI / 2, 0, -Math.atan2(a.dx, a.dz)); teleLine.rotation.order = 'YXZ'; teleLine.rotation.set(-Math.PI / 2, Math.atan2(a.dx, a.dz), 0); teleLine.material.opacity = pulse;
      } else {
        teleRing.visible = true; teleRing.position.set(a.x, .09, a.z); teleRing.scale.setScalar(a.r); teleRing.material.opacity = .9;
        teleDisc.visible = true; teleDisc.position.set(a.x, .08, a.z); teleDisc.scale.setScalar(a.r * (a.kind === 'nova' ? 1 : k)); teleDisc.material.opacity = pulse * .6;
        if (a.kind === 'nova') { teleInner.visible = true; teleInner.position.set(a.x, .1, a.z); teleInner.scale.setScalar(a.inner); teleInner.material.opacity = .9; }
      }
    }
  }
  function stepFx(dt) {
    for (let i = fxPool.length - 1; i >= 0; i--) {
      const f = fxPool[i]; f.t -= dt;
      if (f.kind === 'ring') { const k = 1 - f.t / .35; f.m.scale.setScalar(.4 + k * f.r); f.m.material.opacity = .8 * (1 - k); }
      if (f.t <= 0) { scene.remove(f.m); f.m.geometry.dispose(); f.m.material.dispose(); fxPool.splice(i, 1); }
    }
  }

  function render(W, dt) {
    const t = W.t, p = W.player;
    // камера: плавно следует за героем под заданным углом
    if (!cam.init) { cam.x = p.x; cam.z = p.z; cam.init = true; }
    const k = 1 - Math.exp(-cfg.view.camFollow * dt);
    cam.x += (p.x - cam.x) * k; cam.z += (p.z - cam.z) * k;
    const pitch = cfg.view.camPitch * Math.PI / 180, dist = cfg.view.camDist;
    const sh = W.shake * .35;
    camera.fov = cfg.view.fov; camera.updateProjectionMatrix();
    const yaw = cfg.view.camYaw * Math.PI / 180, hd = Math.cos(pitch) * dist;
    camera.position.set(cam.x + Math.sin(yaw) * hd + (Math.random() - .5) * sh, Math.sin(pitch) * dist + cfg.view.camLookUp + (Math.random() - .5) * sh, cam.z + Math.cos(yaw) * hd);
    camera.lookAt(cam.x, cfg.view.camLookUp, cam.z);
    if (W.lvl !== shownLvl) showLevel(W);
    const under = W.lvl !== 'surface';
    scene.fog.density = under ? cfg.view.fogDensity * 2.2 : cfg.view.fogDensity;
    if (under) { lantern.position.set(p.x, 3.2, p.z); if (curView.flame) curView.flame.material.color.setHSL(.08, 1, .55 + .08 * Math.sin(t * 13)); if (curView.update) curView.update(W, t); }
    else if (Math.abs(W.light - lastLight) > .004) {                  // небо, свет и туман по времени суток
      lastLight = W.light; const k = skyAt(W.light, cfg.daynight.sky);
      scene.fog.color.set(k.fog); scene.background.set(k.fog);
      hemi.color.set(k.hemiSky); hemi.groundColor.set(k.hemiGround); hemi.intensity = k.hemiI;
      sun.color.set(k.sun); sun.intensity = k.sunI; dome.material.color.set(k.dome);
    }

    if (!under) town.update(W.inside, dt, W.map);
    conts.update(W, t);
    for (const n of npcs) { const dx = p.x - n.pos.x, dz = p.z - n.pos.z; if (Math.hypot(dx, dz) < 9) n.group.rotation.y += angDiffTo(Math.atan2(dx, dz), n.group.rotation.y) * Math.min(1, dt * 6); n.root.position.y = Math.sin(t * 2) * .02; { const mk = questMark(W, n.kind || n.pos.kind); n.mark.visible = !!mk; if (mk) { n.mark.material.color.set(mk === 'ready' ? '#7ad06a' : '#e8c04a'); n.mark.position.y = 2.6 + Math.sin(t * 3) * .08; n.mark.rotation.y = t * 2; } } n.armL.rotation.x = Math.sin(t * 1.6) * .08; n.armR.rotation.x = -Math.sin(t * 1.6) * .08; }
    // костёр: мерцание света и пламени
    const fl = .8 + .2 * Math.sin(t * 17) + .1 * Math.sin(t * 29.3);
    fire.light.intensity = 26 * fl; fire.flames.forEach((f, i) => { f.scale.y = .8 + .35 * Math.sin(t * (9 + i * 4) + i); f.rotation.y = t * (2 + i); });
    // пепел
    const ap = ashGeo.attributes.position;
    for (let i = 0; i < ashN; i++) { let y = ap.getY(i) - dt * (.6 + (i % 5) * .15), x = ap.getX(i) - dt * .5; if (y < 0) { y = 14; } ap.setY(i, y); ap.setX(i, x); }
    ap.needsUpdate = true; ash.position.set(cam.x, 0, cam.z);

    // герой
    hero.group.position.set(p.x, 0, p.z); hero.group.rotation.y = p.face;
    { const it = W.inv.eq.weapon && BY_ID[W.inv.eq.weapon]; hero.setWeapon(W.wp.kind, it ? it.mat : 'steel'); }
    animateHero(hero, p, t, dt, cfg, W.gear.swing || 1);
    updateTrail(W, p, dt);
    heroShadow.position.set(p.x, .03, p.z);
    // дуга удара
    arcGeometry(Math.min(360, (W.wp.trait.arc || cfg.player.attackArc) + (W.gear.arc || 0)));       // ширина и дальность дуги — как у надетого оружия
    if (swingFx > 0) swingFx = Math.max(0, swingFx - dt * 5);
    arc.position.set(p.x, .08, p.z); arc.rotation.z = p.face; arc.scale.setScalar(cfg.player.attackRange + (W.gear.reach || 0)); arcMat.opacity = swingFx * .5;

    // враги
    const alive = new Set();
    for (const e of W.enemies) {
      alive.add(e.id);
      const en = entity(e);
      en.m.group.position.set(e.x, 0, e.z); en.m.group.rotation.y = e.face;
      { const base = cfg.enemies[e.type].scale * (e.scaleMul || 1); if (en.m.group.scale.x !== base) en.m.group.scale.setScalar(base); }
      animateMonster(en.m, e, t, cfg);
      if (e.elite) {
        if (!en.elite) { en.elite = new THREE.Mesh(new THREE.RingGeometry(.95, 1.25, 28), new THREE.MeshBasicMaterial({ color: e.affColor, transparent: true, opacity: .8, depthWrite: false, side: THREE.DoubleSide })); en.elite.rotation.x = -Math.PI / 2; scene.add(en.elite); }
        en.elite.position.set(e.x, .07, e.z); en.elite.visible = !e.dead; en.elite.scale.setScalar(cfg.enemies[e.type].scale * (e.scaleMul || 1) * (1 + .06 * Math.sin(t * 5)));
      }
      en.sh.position.set(e.x, .03, e.z);
      const wind = e.state === 'wind' && !e.dead;
      en.ring.position.set(e.x, .06, e.z); en.ring.scale.setScalar(cfg.enemies[e.type].range + .5);
      en.ring.material.opacity = wind && !cfg.enemies[e.type].ranged ? .35 + .3 * Math.sin(t * 40) : 0;
      const b = bar(e, e.elite ? e.affColor : undefined), dmg = (e.hp < e.maxhp || e.elite) && !e.dead;
      b.g.visible = dmg; if (dmg) { b.g.position.set(e.x, 2.5 * cfg.enemies[e.type].scale + .3, e.z); b.g.quaternion.copy(camera.quaternion); b.fill.scale.x = Math.max(.001, e.hp / e.maxhp); }
    }
    // отряд
    const aliveA = new Set();
    for (const a of W.allies) {
      aliveA.add(a.id);
      let en = allyEnts.get(a.id);
      if (!en) { const m = makeSoldier(a.type, cfg), sh = shadow(.5); scene.add(m.group, sh); en = { m, sh }; allyEnts.set(a.id, en); }
      en.m.group.position.set(a.x, 0, a.z); en.m.group.rotation.y = a.face; animateSoldier(en.m, a, t); en.sh.position.set(a.x, .03, a.z); en.sh.visible = !a.dead;
      const b = bar({ id: 'a' + a.id }, '#3a8a4a'), show = a.hp < a.maxhp && !a.dead;
      b.g.visible = show; if (show) { b.g.position.set(a.x, 2.7, a.z); b.g.quaternion.copy(camera.quaternion); b.fill.scale.x = Math.max(.001, a.hp / a.maxhp); }
    }
    for (const [id, en] of allyEnts) if (!aliveA.has(id)) { scene.remove(en.m.group, en.sh); allyEnts.delete(id); const b = bars.get('a' + id); if (b) { scene.remove(b.g); bars.delete('a' + id); } }
    for (const [id, en] of ents) if (!alive.has(id)) { scene.remove(en.m.group, en.sh, en.ring); if (en.elite) scene.remove(en.elite); ents.delete(id); const b = bars.get(id); if (b) { scene.remove(b.g); bars.delete(id); } }

    // события боя → эффекты и подписи (подписи отдаёт hooks.onText)
    for (const v of W.ev) {
      hooks.onEvent && hooks.onEvent(v);
      if (v.k === 'hit') { burst(v.x, 1.1, v.z, 8, v.fx ? FXCOL[v.fx] : v.crit ? '#ffd27a' : '#a1121f'); hooks.onText && hooks.onText(v.x, 2, v.z, String(v.dmg), v.crit ? 'crit' : ''); }
      else if (v.k === 'die') burst(v.x, 1, v.z, 18, '#6d0c14', 6);
      else if (v.k === 'hurt') { burst(v.x, 1.2, v.z, 10, '#c0222c'); hooks.onText && hooks.onText(v.x, 2.4, v.z, '−' + v.dmg, 'hurt'); hooks.onHurt && hooks.onHurt(); }
      else if (v.k === 'open') burst(v.x, .9, v.z, 10, '#ffc860', 3)
      else if (v.k === 'heal') hooks.onText && hooks.onText(v.x, 2.4, v.z, '+' + v.n + ' ♥', 'loot')
      else if (v.k === 'ash') hooks.onText && hooks.onText(v.x, 2.4, v.z, '+' + v.n + ' пепла', 'loot')
      else if (v.k === 'buff') burst(v.x, 1.2, v.z, 10, '#9fd0ff', 2)
      else if (v.k === 'dot') { hooks.onText && hooks.onText(v.x, 2.2, v.z, String(v.dmg), 'dot-' + v.fx); }
      else if (v.k === 'react') { burst(v.x, 1.2, v.z, 16, '#bfe8ff', 5); hooks.onText && hooks.onText(v.x, 3, v.z, v.name + '!', 'react'); W.shake = Math.max(W.shake, .3); }
      else if (v.k === 'bossblast') { ringFx(v.x, v.z, v.r || 3, '#ff6a3a'); burst(v.x, .5, v.z, 22, v.kind === 'nova' ? '#ff8a30' : '#6a5a4a', 7); }
      else if (v.k === 'chain') { zap(v.x, v.z, v.x2, v.z2); }
      else if (v.k === 'boom') { ringFx(v.x, v.z, v.r, '#ffe27a'); burst(v.x, .8, v.z, 12, '#ffe27a', 5); }
      else if (v.k === 'finisher') { ringFx(v.x, v.z, 3, '#ffd9c0'); burst(v.x, .6, v.z, 10, '#ffd9c0', 5); }
      else if (v.k === 'pstatus') burst(v.x, 1.2, v.z, 8, v.kind === 'poison' ? '#7ad060' : v.kind === 'burn' ? '#ff8a30' : '#d03030', 2);
      else if (v.k === 'pdot') hooks.onText && hooks.onText(v.x, 2.6, v.z, '−' + v.dmg, 'hurt')
      else if (v.k === 'cleanse') burst(v.x, 1.2, v.z, 10, '#9fe8ff', 2.5);
      else if (v.k === 'allyhurt') { burst(v.x, 1.1, v.z, 6, '#3a6aa8'); hooks.onText && hooks.onText(v.x, 2.5, v.z, '−' + v.dmg, 'ally'); }
      else if (v.k === 'allydead') burst(v.x, 1, v.z, 14, '#3a6aa8', 5);
      else if (v.k === 'swing') swingFx = 1;
      else if (v.k === 'roll') burst(v.x, .2, v.z, 6, '#6a5a4a', 2.5);
      else if (v.k === 'dodge') hooks.onText && hooks.onText(v.x, 2.6, v.z, 'Уклон!', 'dodge');
    }
    W.ev.length = 0;
    // частицы
    for (const m of pool) if (m.visible) { const u = m.userData; u.life -= dt; if (u.life <= 0) { m.visible = false; continue; } u.vy -= 14 * dt; m.position.x += u.vx * dt; m.position.y = Math.max(.07, m.position.y + u.vy * dt); m.position.z += u.vz * dt; }

    stepFx(dt); updateTele(W, t); updateFoes(W, t);
    if (W.tomb && (W.tomb.lvl || 'surface') === W.lvl) { if (!tomb) { tomb = new THREE.Group(); const m = new THREE.MeshLambertMaterial({ color: '#8a867c' }); const a = new THREE.Mesh(new THREE.BoxGeometry(.7, 1, .18), m); a.position.y = .5; const b = new THREE.Mesh(new THREE.BoxGeometry(.4, .2, .18), m); b.position.y = 1.1; const g = new THREE.Mesh(new THREE.OctahedronGeometry(.2), new THREE.MeshBasicMaterial({ color: '#ffd45a' })); g.position.y = 1.9; tomb.add(a, b, g); tomb.userData.gem = g; scene.add(tomb); } tomb.visible = true; tomb.position.set(W.tomb.x, 0, W.tomb.z); tomb.userData.gem.position.y = 1.9 + Math.sin(t * 3) * .1; tomb.userData.gem.rotation.y = t * 2; } else if (tomb) tomb.visible = false;
    for (const e of W.enemies) if (e.st && !e.dead) { const r = Math.random(); if (e.st.burn && r < dt * 9) burst(e.x, 1.5, e.z, 1, '#ff8a30', 1); else if (e.st.poison && r < dt * 5) burst(e.x, 1.4, e.z, 1, '#7ad060', .8); else if (e.st.freeze && r < dt * 4) burst(e.x, 1.2, e.z, 1, '#cfeeff', .8); }
    gl.render(scene, camera);
  }

  return { render, resize, project, gl, camera, scene, town, info: () => gl.info.render, hero };
}
