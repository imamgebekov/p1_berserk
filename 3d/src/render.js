// Сцена Three.js: мир, свет, камера, спецэффекты. Рисует в маленьком разрешении и растягивает без сглаживания.
import { makeMap, nearBuilding } from './map.js';
import { buildTown } from './town.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeHero, animateHero, makeMonster, animateMonster, makeCampfire, addTree, addRock } from './models.js';
import { mulberry32 } from './sim.js';

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
  const top = new THREE.Color('#0b0606'), hor = new THREE.Color('#5a1a14'), tmp = new THREE.Color();
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

export function createRenderer(canvas, cfg, hooks = {}) {
  const gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!hooks.preserve });
  gl.setPixelRatio(1);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FOG);
  scene.fog = new THREE.FogExp2(FOG, cfg.view.fogDensity);
  const camera = new THREE.PerspectiveCamera(cfg.view.fov, 1, .5, 700);

  // свет: тусклое «багровое» небо, холодный свет затмения и тёплый костёр
  scene.add(new THREE.HemisphereLight('#a8847a', '#2a1a16', 2.4));
  const sun = new THREE.DirectionalLight('#ffa080', 1.7); sun.position.set(-30, 50, -40); scene.add(sun);
  scene.add(skyDome());

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshLambertMaterial({ map: groundTexture() }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);

  const map = makeMap(cfg);
  const town = buildTown(map, cfg, mulberry32(cfg.world.seed + 1)); scene.add(town.group);

  // деревья и камни одним мешем (один вызов отрисовки)
  const rnd = mulberry32(cfg.world.seed), parts = [];
  for (let i = 0; i < cfg.world.props; i++) {
    const a = rnd() * Math.PI * 2, d = 7 + Math.sqrt(rnd()) * (cfg.world.radius - 8), x = Math.cos(a) * d, z = Math.sin(a) * d;
    const tree = rnd() < .65;
    if (nearBuilding(map, x, z, 3)) continue;                          // не растим деревья в домах и у стен
    (tree ? addTree : addRock)(parts, rnd, x, z);
  }
  // граница мира: частокол из мёртвых стволов
  for (let i = 0; i < 70; i++) { const a = i / 70 * Math.PI * 2, R = cfg.world.radius + 1.5; addTree(parts, rnd, Math.cos(a) * R, Math.sin(a) * R); }
  const props = new THREE.Mesh(mergeGeometries(parts, false), new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.add(props);

  const fire = makeCampfire(); scene.add(fire.group);

  // пепел в воздухе
  const ashN = 140, ashPos = new Float32Array(ashN * 3);
  for (let i = 0; i < ashN; i++) { ashPos[i * 3] = (rnd() - .5) * 60; ashPos[i * 3 + 1] = rnd() * 14; ashPos[i * 3 + 2] = (rnd() - .5) * 60; }
  const ashGeo = new THREE.BufferGeometry(); ashGeo.setAttribute('position', new THREE.BufferAttribute(ashPos, 3));
  const ash = new THREE.Points(ashGeo, new THREE.PointsMaterial({ color: '#bfb5a0', size: 2, sizeAttenuation: false, transparent: true, opacity: .6 }));
  scene.add(ash);

  // герой и враги
  const hero = makeHero(); scene.add(hero.group);
  const heroShadow = shadow(.7); scene.add(heroShadow);
  const ents = new Map();
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
  function bar(e) {
    let b = bars.get(e.id);
    if (!b) {
      const g = new THREE.Group();
      const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .16), new THREE.MeshBasicMaterial({ color: '#120d0c', depthTest: false }));
      const fill = new THREE.Mesh(new THREE.PlaneGeometry(1, .1), new THREE.MeshBasicMaterial({ color: '#a1121f', depthTest: false }));
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
    scene.fog.density = cfg.view.fogDensity;

    town.update(W.inside, dt, W.map);
    // костёр: мерцание света и пламени
    const fl = .8 + .2 * Math.sin(t * 17) + .1 * Math.sin(t * 29.3);
    fire.light.intensity = 26 * fl; fire.flames.forEach((f, i) => { f.scale.y = .8 + .35 * Math.sin(t * (9 + i * 4) + i); f.rotation.y = t * (2 + i); });
    // пепел
    const ap = ashGeo.attributes.position;
    for (let i = 0; i < ashN; i++) { let y = ap.getY(i) - dt * (.6 + (i % 5) * .15), x = ap.getX(i) - dt * .5; if (y < 0) { y = 14; } ap.setY(i, y); ap.setX(i, x); }
    ap.needsUpdate = true; ash.position.set(cam.x, 0, cam.z);

    // герой
    hero.group.position.set(p.x, 0, p.z); hero.group.rotation.y = p.face;
    animateHero(hero, p, t, dt, cfg);
    heroShadow.position.set(p.x, .03, p.z);
    // дуга удара
    arcGeometry(cfg.player.attackArc);
    if (swingFx > 0) swingFx = Math.max(0, swingFx - dt * 5);
    arc.position.set(p.x, .08, p.z); arc.rotation.z = p.face; arc.scale.setScalar(cfg.player.attackRange); arcMat.opacity = swingFx * .5;

    // враги
    const alive = new Set();
    for (const e of W.enemies) {
      alive.add(e.id);
      const en = entity(e);
      en.m.group.position.set(e.x, 0, e.z); en.m.group.rotation.y = e.face;
      animateMonster(en.m, e, t, cfg);
      en.sh.position.set(e.x, .03, e.z);
      const wind = e.state === 'wind' && !e.dead;
      en.ring.position.set(e.x, .06, e.z); en.ring.scale.setScalar(cfg.enemies[e.type].range + .5);
      en.ring.material.opacity = wind ? .35 + .3 * Math.sin(t * 40) : 0;
      const b = bar(e), dmg = e.hp < e.maxhp && !e.dead;
      b.g.visible = dmg; if (dmg) { b.g.position.set(e.x, 2.5 * cfg.enemies[e.type].scale + .3, e.z); b.g.quaternion.copy(camera.quaternion); b.fill.scale.x = Math.max(.001, e.hp / e.maxhp); }
    }
    for (const [id, en] of ents) if (!alive.has(id)) { scene.remove(en.m.group, en.sh, en.ring); ents.delete(id); const b = bars.get(id); if (b) { scene.remove(b.g); bars.delete(id); } }

    // события боя → эффекты и подписи (подписи отдаёт hooks.onText)
    for (const v of W.ev) {
      if (v.k === 'hit') { burst(v.x, 1.1, v.z, 8, v.crit ? '#ffd27a' : '#a1121f'); hooks.onText && hooks.onText(v.x, 2, v.z, String(v.dmg), v.crit ? 'crit' : ''); }
      else if (v.k === 'die') burst(v.x, 1, v.z, 18, '#6d0c14', 6);
      else if (v.k === 'hurt') { burst(v.x, 1.2, v.z, 10, '#c0222c'); hooks.onText && hooks.onText(v.x, 2.4, v.z, '−' + v.dmg, 'hurt'); hooks.onHurt && hooks.onHurt(); }
      else if (v.k === 'loot') { burst(v.x, .8, v.z, 12, v.type === 'heal' ? '#c0222c' : '#ffc860', 3); hooks.onText && hooks.onText(v.x, 1.8, v.z, v.type === 'heal' ? '+' + v.n + ' ♥' : '+' + v.n + ' пепла', 'loot'); }
      else if (v.k === 'swing') swingFx = 1;
      else if (v.k === 'roll') burst(v.x, .2, v.z, 6, '#6a5a4a', 2.5);
      else if (v.k === 'dodge') hooks.onText && hooks.onText(v.x, 2.6, v.z, 'Уклон!', 'dodge');
    }
    W.ev.length = 0;
    // частицы
    for (const m of pool) if (m.visible) { const u = m.userData; u.life -= dt; if (u.life <= 0) { m.visible = false; continue; } u.vy -= 14 * dt; m.position.x += u.vx * dt; m.position.y = Math.max(.07, m.position.y + u.vy * dt); m.position.z += u.vz * dt; }

    gl.render(scene, camera);
  }

  return { render, resize, project, gl, camera, scene, town, info: () => gl.info.render, hero };
}
