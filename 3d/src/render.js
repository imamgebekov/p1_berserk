// Сцена Three.js: мир, свет, камера, спецэффекты. Рисует в маленьком разрешении и растягивает без сглаживания.
import { makeMap, propsBlocked, campGates } from './map.js';
import { buildDecor } from './decor.js';
import { buildTown } from './town.js';
import { buildLevelView, buildSurfaceView } from './levelview.js';
import { buildHeights, heightAt } from './terrain3d.js';
import { createAscii, OVERLAY } from './ascii3d.js';
import { makeField, pickShafts } from './sunlight3d.js';
import { windAt, grassSpots } from './wind3d.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeHero, animateHero, makeMonster, animateMonster, makeCampfire, addTree, addRock, makeNpc, makeCart, makeCrow, makeSoldier, animateSoldier } from './models.js';
import { heroOf } from './data/heroes3d.js';
import { villagerStops, makeVillagers, stepVillager, makeBirds, updateBirds, chimneys, fogMul } from './ambient3d.js';
import { mulberry32 } from './sim.js';
import { questMark } from './quests3d.js';
import { skyAt } from './daynight.js';
import { BY_ID, RARITY } from './data/items.js';
import { trailOn } from './anim3d.js';
import { createFx } from './fx3d.js';

const FOG = '#150c0b';

function groundTexture(look) {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), r = mulberry32(5);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const v = r(); g.fillStyle = v < .08 ? look.ground[2] : v < .3 ? look.ground[1] : look.ground[0]; g.fillRect(x, y, 1, 1);     // трава: пятнышки светлее
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(70, 70);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function skyDome(look) {
  const geo = new THREE.SphereGeometry(500, 24, 16), col = [], pos = geo.attributes.position;
  const top = new THREE.Color(look.skyTop), hor = new THREE.Color(look.skyHor), tmp = new THREE.Color();
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
  camera.layers.enable(OVERLAY);
  const ovl = o => { o.traverse(c => c.layers.set(OVERLAY)); return o; };     // чёткие метки боя: в фильтре ASCII рисуются поверх символов
  let ascii = null, asciiOn = false;

  // свет: тусклое «багровое» небо, холодный свет затмения и тёплый костёр
  const hemi = new THREE.HemisphereLight('#a8847a', '#2a1a16', 2.4); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffa080', 1.7); sun.position.set(-30, 50, -40); scene.add(sun);
  const dome = skyDome(cfg.look); scene.add(dome);
  let lastLight = -1;

  const gtex = groundTexture(cfg.look);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshLambertMaterial({ map: gtex }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -1.2; scene.add(ground);     // ниже дна реки: внутри мира землю рисуют холмы

  const map = makeMap(cfg);
  // рельеф (C2): поле высот только для вида; Y — высота земли под точкой (в подземельях 0)
  const hf = buildHeights(cfg, map); let groundOn = true;
  const Y = (x, z) => (groundOn ? heightAt(hf, x, z) : 0);
  if (hooks.onText) { const f = hooks.onText; hooks.onText = (x, y, z, ...a) => f(x, y + Y(x, z), z, ...a); }
  // земля с холмами: сетка высот под всем миром, светлее на буграх и темнее в низинах, у воды — песок
  const hills = (() => {
    const S = hf.R * 2, seg = hf.n - 1, g = new THREE.PlaneGeometry(S, S, seg, seg); g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position, uv = g.attributes.uv, col = new Float32Array(pos.count * 3), sand = new THREE.Color(cfg.look.sand), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = heightAt(hf, x, z, false); pos.setY(i, h);     // под мостом — русло, не настил
      uv.setXY(i, (x + 250) / 500, 1 - (z + 250) / 500);                // та же текстура и масштаб, что у плоской земли
      const k = 1 + h * .12; c.setRGB(k, k, k);
      if (map.river && h < -.15) c.lerp(sand, Math.min(1, -h / .8) * .7);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: gtex, vertexColors: true })); scene.add(m); return m;
  })();
  // свет сквозь облака (E2): пятна света на холмах (та же сетка, текстура поля плывёт по ветру) и столбы света над яркими
  const SL = cfg.sunlight, field = SL && SL.on ? makeField(cfg.world.seed) : null, sunGroup = new THREE.Group();
  let lightMat = null; const shafts = [];
  if (field) {
    const n = field.n, c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'), im = g.createImageData(n, n);
    field.data.forEach((v, i) => { im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = Math.round(v * 255); im.data[i * 4 + 3] = 255; }); g.putImageData(im, 0, 0);
    const lt = new THREE.CanvasTexture(c); lt.wrapS = lt.wrapT = THREE.RepeatWrapping; lt.flipY = false; lt.repeat.set(500 / SL.size, -500 / SL.size);
    lightMat = new THREE.MeshBasicMaterial({ map: lt, color: SL.day, transparent: true, opacity: SL.dayK, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const lm = new THREE.Mesh(hills.geometry, lightMat); lm.renderOrder = 1; sunGroup.add(lm);
    // столб: вертикальный градиент (ярко у земли, к верху тает), мягкие края
    const sc = document.createElement('canvas'); sc.width = 32; sc.height = 64; const sg = sc.getContext('2d'), si = sg.createImageData(32, 64);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 32; x++) { const a = Math.pow(1 - y / 63, 1.4) * Math.pow(Math.sin(Math.PI * (x + .5) / 32), 2), k = (y * 32 + x) * 4; si.data[k] = si.data[k + 1] = si.data[k + 2] = Math.round(a * 255); si.data[k + 3] = 255; }
    sg.putImageData(si, 0, 0); const st = new THREE.CanvasTexture(sc); st.flipY = false;
    const S = SL.shafts, sgeo = new THREE.PlaneGeometry(S.w, S.h).translate(0, S.h / 2, 0), yaw = cfg.view.camYaw * Math.PI / 180;
    for (let i = 0; i < S.n; i++) { const m = new THREE.Mesh(sgeo, new THREE.MeshBasicMaterial({ map: st, color: SL.day, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.rotation.set(0, yaw, S.tilt); m.visible = false; sunGroup.add(m); shafts.push({ m, a: 0, x: 0, z: 0, want: null }); }
    scene.add(sunGroup);
  }
  let shaftT = 0, picks = []; const sunCol = new THREE.Color();
  // вода: лента вдоль русла чуть ниже берега; мосты: настил, доски, перила, столбы
  const river = map.river, waterMat = new THREE.MeshLambertMaterial({ color: '#28485a', transparent: true, opacity: .88, emissive: '#0a1a24', side: THREE.DoubleSide }), riverGroup = new THREE.Group();
  if (river) {
    const P = river.pts, v = [], idx = [], hw = river.w / 2 + .5;
    P.forEach((p, i) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
      v.push(p.x + nx * hw, cfg.terrain.water, p.z + nz * hw, p.x - nx * hw, cfg.terrain.water, p.z - nz * hw); if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); } });
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); wg.setIndex(idx); wg.computeVertexNormals();
    riverGroup.add(new THREE.Mesh(wg, waterMat));
    const wood = new THREE.MeshLambertMaterial({ color: '#5a3e26' }), dark = new THREE.MeshLambertMaterial({ color: '#3a2818' }), dk = cfg.terrain.bridge.deck;
    for (const b of river.bridges) {
      const g = new THREE.Group(); g.position.set(b.x, 0, b.z); g.rotation.y = b.ang;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(b.w, .16, b.len), wood); deck.position.y = dk - .08; g.add(deck);
      for (let k = -b.len / 2 + .4; k < b.len / 2; k += .55) { const pl = new THREE.Mesh(new THREE.BoxGeometry(b.w + .1, .04, .08), dark); pl.position.set(0, dk + .01, k); g.add(pl); }
      for (const s of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(.1, .1, b.len), dark); rail.position.set(s * (b.w / 2 - .05), dk + .7, 0); g.add(rail);
        for (let k = -b.len / 2; k <= b.len / 2 + .01; k += b.len / 3) { const post = new THREE.Mesh(new THREE.BoxGeometry(.14, 1.5, .14), dark); post.position.set(s * (b.w / 2 - .05), dk + .1, k); g.add(post); } }
      riverGroup.add(g);
    }
    scene.add(riverGroup);
  }
  const town = buildTown(map, cfg, mulberry32(cfg.world.seed + 1)); scene.add(town.group);
  const decor = buildDecor(map, mulberry32(cfg.world.seed + 2)); scene.add(decor.group);
  const npcs = [];
  for (const b of map.buildings) if (b.npc) { const n = makeNpc(b.npc.kind); n.group.position.set(b.npc.x, 0, b.npc.z); n.pos = b.npc; n.mark = new THREE.Mesh(new THREE.OctahedronGeometry(.22), new THREE.MeshBasicMaterial({ color: '#e8c04a' })); n.mark.position.set(0, 2.6, 0); n.mark.visible = false; n.group.add(n.mark); scene.add(n.group); npcs.push(n); }

  // ветер (F2): общие uniform для шейдеров крон и травы; смещение — после всех преобразований, по миру (одно направление)
  const WC = cfg.wind, WU = { uTime: { value: 0 }, uWind: { value: 0 }, uDir: { value: new THREE.Vector2(0, 1) } };
  const TREE_PV = `vec4 mvPosition = vec4( transformed, 1.0 );
  { float k = sway; vec2 wp = mvPosition.xz;
    float sw = uWind * uAmp * k * k * ( 0.55 + 0.45 * sin( uTime * ( 1.1 + uWind * 1.6 ) + wp.x * .21 + wp.y * .17 ) );
    float fl = uWind * uLeaf * step( .7, k ) * sin( uTime * 9. + wp.x * 3.1 + wp.y * 2.3 + mvPosition.y * 4. );
    mvPosition.xz += uDir * sw + vec2( fl, -fl * .6 ); }
  mvPosition = modelViewMatrix * mvPosition;
  gl_Position = projectionMatrix * mvPosition;`;
  const GRASS_PV = `vec4 mvPosition = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    mvPosition = instanceMatrix * mvPosition;
  #endif
  { float k = clamp( position.y / uH, 0., 1. ); vec2 wp = mvPosition.xz;
    float sw = uWind * uAmp * k * k * ( 0.5 + 0.5 * sin( uTime * ( 1.6 + uWind * 2.4 ) + wp.x * .35 + wp.y * .27 ) );
    mvPosition.xz += uDir * sw; }
  mvPosition = modelViewMatrix * mvPosition;
  gl_Position = projectionMatrix * mvPosition;`;
  const windy = (mat, kind) => {
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, WU, { uAmp: { value: kind === 'tree' ? WC.sway.tree : WC.sway.grass }, uLeaf: { value: WC.sway.leaf }, uH: { value: WC.grass.h } });
      sh.vertexShader = (kind === 'tree' ? 'attribute float sway;\n' : '') + 'uniform float uTime, uWind, uAmp, uLeaf, uH; uniform vec2 uDir;\n' + sh.vertexShader.replace('#include <project_vertex>', kind === 'tree' ? TREE_PV : GRASS_PV);
    };
    mat.customProgramCacheKey = () => 'wind-' + kind; return mat;
  };
  // деревья и камни одним мешем (один вызов отрисовки)
  const rnd = mulberry32(cfg.world.seed), parts = [], treeXZ = [];
  for (let i = 0; i < cfg.world.props; i++) {
    const a = rnd() * Math.PI * 2, d = 7 + Math.sqrt(rnd()) * (cfg.world.radius - 8), x = Math.cos(a) * d, z = Math.sin(a) * d;
    const tree = rnd() < .65;
    if (propsBlocked(map, x, z)) continue;                             // не растим деревья в домах, на дорогах и в областях
    if (tree) treeXZ.push(x, z);
    const k0 = parts.length; (tree ? addTree : addRock)(parts, rnd, x, z, cfg.look); const gy = Y(x, z); for (let k = k0; k < parts.length; k++) parts[k].translate(0, gy, 0);     // на холме
  }
  // граница мира: частокол из мёртвых стволов
  for (let i = 0; i < 70; i++) { const a = i / 70 * Math.PI * 2, R = cfg.world.radius + 1.5; addTree(parts, rnd, Math.cos(a) * R, Math.sin(a) * R, cfg.look); }
  for (const g of parts) if (!g.attributes.sway) g.setAttribute('sway', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count), 1));     // камни не качаются
  const props = new THREE.Mesh(mergeGeometries(parts, false), WC && WC.on ? windy(new THREE.MeshLambertMaterial({ vertexColors: true }), 'tree') : new THREE.MeshLambertMaterial({ vertexColors: true }));
  // трава (F2): пучки из трёх травинок по всему миру, качаются по ветру
  const grass = (() => {
    if (!WC || !WC.on || !WC.grass.on) return new THREE.Group();
    const spots = grassSpots(map, cfg, cfg.world.seed), H = WC.grass.h, v = [], col = [], dark = new THREE.Color(cfg.look.leaf[1]), tip = new THREE.Color(cfg.look.leaf[2]).multiplyScalar(1.6);
    for (let b = 0; b < 3; b++) { const a = b * Math.PI / 3, c = Math.cos(a), s = Math.sin(a), lean = (b - 1) * .08;
      v.push(-.11 * c, 0, -.11 * s, .11 * c, 0, .11 * s, lean * s, H * (.8 + b * .12), lean * c); col.push(dark.r, dark.g, dark.b, dark.r, dark.g, dark.b, tip.r, tip.g, tip.b); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
    // участки 16×16 м — отдельные меши: что вне кадра, отсекается и не рисуется
    const mat = windy(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), 'grass'), cells = new Map(), group = new THREE.Group();
    spots.forEach((g, i) => { const k = Math.floor(g.x / 16) + ',' + Math.floor(g.z / 16); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(i); });
    const M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), P3 = new THREE.Vector3(), S3 = new THREE.Vector3(), c = new THREE.Color();
    for (const ids of cells.values()) {
      const m = new THREE.InstancedMesh(geo, mat, ids.length);
      ids.forEach((i, j) => { const g = spots[i]; e.set(0, g.rot, 0); q.setFromEuler(e); P3.set(g.x, Y(g.x, g.z), g.z); S3.set(g.s, g.s, g.s); M4.compose(P3, q, S3); m.setMatrixAt(j, M4); c.setHSL(.27 + (i % 7) * .012, .45, .38 + (i % 5) * .04); m.setColorAt(j, c); });
      m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere(); m.boundingSphere.radius += 1; group.add(m);
    }
    group.userData.count = spots.length; scene.add(group); return group;
  })();
  let windNow = { s: 0, dir: [0, 1] };
  scene.add(props);

  const fire = makeCampfire(); scene.add(fire.group);
  // фонарь героя: светит только в подземельях (там нет неба и солнца)
  const lantern = new THREE.PointLight('#ffb070', 22, 16, 1.4); lantern.visible = false; scene.add(lantern);   // спрятанный свет не считается в шейдерах поверхности
  const asciiLamp = new THREE.PointLight('#ffe8d0', cfg.view.ascii.lamp[0], cfg.view.ascii.lamp[1], 1.5); asciiLamp.visible = false; scene.add(asciiLamp);   // ASCII: пятно света вокруг героя, чтобы он читался

  // пепел в воздухе
  const ashN = 140, ashPos = new Float32Array(ashN * 3);
  for (let i = 0; i < ashN; i++) { ashPos[i * 3] = (rnd() - .5) * 60; ashPos[i * 3 + 1] = rnd() * 14; ashPos[i * 3 + 2] = (rnd() - .5) * 60; }
  const ashGeo = new THREE.BufferGeometry(); ashGeo.setAttribute('position', new THREE.BufferAttribute(ashPos, 3));
  const ash = new THREE.Points(ashGeo, new THREE.PointsMaterial({ color: '#bfb5a0', size: 2, sizeAttenuation: false, transparent: true, opacity: .6 }));
  scene.add(ash);

  // герой и враги
  // виды уровней строятся при первом входе; поверхность прячется, пока герой внизу
  // частокол лагеря: брёвна по кругу одним мешем, у ворот — столбы с перекладиной и факелы
  const palisade = new THREE.Group();
  if (map.camp) {
    const C = map.camp, logs = [], tops = [], rnd = mulberry32(cfg.world.seed + 9), gapA = (C.gateW / 2) / C.r, n = Math.ceil(2 * Math.PI * C.r / (C.step * .55));
    for (let i = 0; i < n; i++) {
      const a = i / n * 2 * Math.PI;
      if (C.gates.some(g => { let d = Math.abs(a - g * Math.PI / 180) % (2 * Math.PI); if (d > Math.PI) d = 2 * Math.PI - d; return d < gapA; })) continue;
      const h = C.h * (.85 + rnd() * .3), x = C.x + Math.sin(a) * C.r, z = C.z + Math.cos(a) * C.r;
      logs.push(new THREE.BoxGeometry(.38, h, .38).translate(0, h / 2, 0).rotateY(a).translate(x, 0, z));
      tops.push(new THREE.ConeGeometry(.24, .4, 4).translate(0, h + .2, 0).rotateY(a).translate(x, 0, z));
    }
    const ring = []; for (const y of [.6, 1.6]) for (let i = 0; i < n; i += 2) { const a = i / n * 2 * Math.PI; if (C.gates.some(g => { let d = Math.abs(a - g * Math.PI / 180) % (2 * Math.PI); if (d > Math.PI) d = 2 * Math.PI - d; return d < gapA + .05; })) continue; ring.push(new THREE.BoxGeometry(.9, .1, .44).translate(0, y, 0).rotateY(a + Math.PI / 2).translate(C.x + Math.sin(a) * C.r, 0, C.z + Math.cos(a) * C.r)); }
    palisade.add(new THREE.Mesh(mergeGeometries(logs), new THREE.MeshLambertMaterial({ color: '#5a3e26' })), new THREE.Mesh(mergeGeometries(tops), new THREE.MeshLambertMaterial({ color: '#3e2a18' })), new THREE.Mesh(mergeGeometries(ring), new THREE.MeshLambertMaterial({ color: '#2e2016' })));
    const posts = [], beams = [], flames = [];
    for (const g of campGates(C)) {
      const a = g.a * Math.PI / 180, w = C.gateW / 2 + .2, tx = Math.cos(a), tz = -Math.sin(a);       // вдоль частокола
      for (const s of [-1, 1]) { const px = g.x + tx * w * s, pz = g.z + tz * w * s; posts.push(new THREE.BoxGeometry(.6, C.h + 1.2, .6).translate(px, (C.h + 1.2) / 2, pz)); flames.push(new THREE.BoxGeometry(.22, .3, .22).translate(px, C.h + 1.45, pz)); }
      beams.push(new THREE.BoxGeometry(C.gateW + 1.2, .4, .5).rotateY(a + Math.PI / 2).translate(g.x, C.h + .9, g.z));
    }
    palisade.add(new THREE.Mesh(mergeGeometries(posts), new THREE.MeshLambertMaterial({ color: '#4a3220' })), new THREE.Mesh(mergeGeometries(beams), new THREE.MeshLambertMaterial({ color: '#3a2618' })), new THREE.Mesh(mergeGeometries(flames), new THREE.MeshBasicMaterial({ color: '#ffb050' })));
    scene.add(palisade);
  }
  const cart = makeCart(); cart.group.visible = false; scene.add(cart.group);   // повозка сказочного торговца
  const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // оживление: жители лагеря, вороны, дым из труб (только вид; числа — cfg.ambient)
  const AMB = cfg.ambient, arnd = mulberry32(cfg.world.seed + 21), life = new THREE.Group();
  const vStops = AMB.on ? villagerStops(map, cfg) : [], villagers = makeVillagers(vStops, AMB.villagers, arnd).map((v, i) => { const m = makeNpc('villager', ['#5a4a3a', '#4a3a4a', '#3a4a3a', '#6a5040', '#4a4436'][i % 5]); life.add(m.group); return { v, m }; });
  const crows = (AMB.on ? makeBirds(map, cfg, arnd) : []).map(b => { const m = makeCrow(); m.group.rotation.y = b.face; life.add(m.group); return { b, m }; });
  const pipes = AMB.on ? chimneys(map, cfg) : [];
  if (pipes.length) life.add(new THREE.Mesh(mergeGeometries(pipes.map(c => new THREE.BoxGeometry(.5, AMB.chimneyH + .6, .5).translate(c.x, c.y - AMB.chimneyH / 2 + .3, c.z))), new THREE.MeshLambertMaterial({ color: '#3a302a' })));
  const puffN = pipes.length * AMB.smoke, puffs = new THREE.InstancedMesh(new THREE.BoxGeometry(.5, .5, .5), new THREE.MeshBasicMaterial({ color: '#8a8078', transparent: true, opacity: .32, depthWrite: false }), Math.max(1, puffN));
  puffs.count = calm ? 0 : puffN; puffs.frustumCulled = false; life.add(puffs);
  const puffM = new THREE.Matrix4(), puffQ = new THREE.Quaternion(), puffS = new THREE.Vector3(), puffP = new THREE.Vector3();
  scene.add(life);
  const surfaceObjs = [hills, riverGroup, sunGroup, grass, life, dome, ground, town.group, decor.group, props, fire.group, ash, palisade, ...npcs.map(n => n.group)];
  const views = new Map(); let shownLvl = null, conts = null, curView = null;
  function showLevel(W) {
    const id = W.lvl, L = W.levels[id];
    if (!views.has(id)) { const v = L.def ? buildLevelView(L, cfg) : buildSurfaceView(L, Y); scene.add(v.group); views.set(id, v); }
    for (const [k, v] of views) v.group.visible = k === id;
    const up = !L.def; for (const o of surfaceObjs) o.visible = up;
    sun.visible = up; lantern.visible = !up;
    if (!up) { scene.fog.color.set('#070504'); scene.background.set('#070504'); hemi.color.set('#6a5a50'); hemi.groundColor.set('#1a1210'); hemi.intensity = .9; }
    lastLight = -1; shownLvl = id; curView = views.get(id); conts = curView.conts; fx.clear();
  }
  const hero = makeHero(); scene.add(hero.group); let heroLook = null;
  // тень-двойник Вейла: тёмная копия героя с его клинком
  const decoyModel = () => { const h = makeHero(); h.setLook({ cloth: '#1a1824', cape: '#2a1838', hair: '#0a0810', legs: '#14121c', shoulder: false, hood: false, quiver: false, capeLen: .7 }); h.setWeapon('rapier', 'black'); h.root.rotation.x = .12; return h; };
  // кольцо заряда тяжёлого удара под героем: растёт с зарядом, при полном — оранжевое и пульсирует
  const chargeRing = new THREE.Mesh(new THREE.RingGeometry(.82, 1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd9c0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  chargeRing.visible = false; scene.add(ovl(chargeRing));
  function updateCharge(p, t) {
    const on = p.state === 'charge'; chargeRing.visible = on; if (!on) return;
    const H = cfg.player.heavy, k = Math.min(1, p.chargeT / H.full), full = k >= 1;
    chargeRing.position.set(p.x, .06 + Y(p.x, p.z), p.z); chargeRing.scale.setScalar(.6 + 1.4 * k + (full ? Math.sin(t * 18) * .08 : 0));
    chargeRing.material.color.set(full ? '#ff8a30' : '#ffd9c0'); chargeRing.material.opacity = .35 + .45 * k;
  }
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
    const w = hero.weapon, P = cfg.player, sw = p.swingMul || W.gear.swing || 1;
    if (w && p.state === 'atk' && hero.family !== 'bow' && trailOn(p.atkT / (P.attackTime * sw), P.attackHitAt / P.attackTime)) {
      hero.group.updateMatrixWorld(true);
      trailS.push({ a: w.base.getWorldPosition(new THREE.Vector3()), b: w.tip.getWorldPosition(new THREE.Vector3()), age: 0 });
      if (trailS.length > TRAIL_N) trailS.shift();
    }
    trail.visible = trailS.length > 1; if (!trail.visible) return;
    const perk = (W.wp.perks || []).find(k => PERK_TRAIL[k]), str = p.heavy ? .6 + .5 * p.heavy : p.fin ? .8 : .5;
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
  const arc = new THREE.Mesh(new THREE.CircleGeometry(1, 24), arcMat); arc.rotation.x = -Math.PI / 2; arc.position.y = .08; scene.add(ovl(arc));
  let arcFor = -1, swingFx = 0;
  function arcGeometry(deg) {
    if (arcFor === deg) return;
    arcFor = deg; arc.geometry.dispose();
    const a = deg * Math.PI / 180; arc.geometry = new THREE.CircleGeometry(1, 24, Math.PI / 2 - a / 2, a);
  }

  // эффекты боя: частицы, пятна на земле, вспышки (fx3d.js)
  const fx = createFx(scene, camera, undefined, Y), BLOOD = '#4a080c', HURT_T = .22;
  for (const k of ['burst', 'flash', 'spray', 'ash']) { const f = fx[k]; fx[k] = (x, y, z, ...a) => f(x, y + Y(x, z), z, ...a); }     // эффекты — над землёй
  const burst = fx.burst;
  const DECAL_FX = { burn: '#1a1410', venom: '#2e4a1a', bleed: BLOOD };      // холод и гроза пятен не оставляют
  // попадание: брызги прочь от героя, искры, вспышка, пятно; урон от статусов и молний — только мелкие брызги своего цвета
  function hitFx(v, p) {
    const col = v.fx ? FXCOL[v.fx] : '#a1121f';
    if (v.fx && !v.crit && !v.fin && v.dmg < 12) { burst(v.x, 1.1, v.z, 4, col, 2.5); return; }
    let dx = v.x - p.x, dz = v.z - p.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    const big = v.crit || v.fin;
    fx.spray(v.x, 1.1, v.z, dx, dz, big ? 12 : 7, col, big ? 7 : 5, .75);
    fx.spray(v.x, 1.2, v.z, dx, dz, big ? 6 : 3, v.crit ? '#ffd27a' : '#fff1d0', big ? 9 : 7, .5, { life: .22, g: 6, s: .07 });
    fx.flash(v.x + dx * .3, 1.2, v.z + dz * .3, big ? 1.6 : .9, v.crit ? '#ffd27a' : '#ffe8d0');
    const dc = v.fx ? DECAL_FX[v.fx] : BLOOD;
    if (dc && Math.random() < (big ? 1 : .6)) fx.decal(v.x + dx * (.4 + Math.random() * .6), v.z + dz * (.4 + Math.random() * .6), big ? .75 : .45, dc, dx, dz);
  }
  // смерть: кровь веером, пепел вверх, большое пятно
  function dieFx(v, p) {
    let dx = v.x - p.x, dz = v.z - p.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    const s = (cfg.enemies[v.type] && cfg.enemies[v.type].scale) || 1;
    fx.spray(v.x, 1, v.z, dx, dz, Math.round(10 * s), '#6d0c14', 6, 1.1);
    fx.ash(v.x, .6, v.z, Math.round(16 * s));
    fx.decal(v.x, v.z, 1.1 * s, BLOOD);
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
      scene.add(m.group, sh, ovl(ring));
      en = { m, sh, ring }; ents.set(e.id, en);
    }
    return en;
  }
  function bar(e, color = '#a1121f') {
    let b = bars.get(e.id);
    if (!b) {
      const g = new THREE.Group();
      const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .16), new THREE.MeshBasicMaterial({ color: '#120d0c', depthTest: false, fog: false }));     // полоса — интерфейс: без тумана
      const fill = new THREE.Mesh(new THREE.PlaneGeometry(1, .1), new THREE.MeshBasicMaterial({ color, depthTest: false, fog: false }));
      fill.geometry.translate(.5, 0, 0); fill.position.set(-.5, 0, .01); bg.renderOrder = 10; fill.renderOrder = 11;
      g.add(bg, fill); scene.add(ovl(g)); b = { g, fill }; bars.set(e.id, b);
    }
    return b;
  }

  // ---- размеры: рисуем в маленьком разрешении, растягиваем CSS-ом без сглаживания ----
  let cssW = 1, cssH = 1;
  function resize(w, h) {
    cssW = w || cssW; cssH = h || cssH;
    if (asciiOn) {                                                    // ASCII: холст в родной плотности экрана (до view.ascii.dpr), сцена — в клетки
      const dpr = Math.min(cfg.view.ascii.dpr, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1);
      if (!ascii || ascii.dpr !== dpr) { if (ascii) ascii.dispose(); ascii = createAscii(gl, cfg, calm, dpr); }
      const w = Math.max(8, Math.floor(cssW * dpr)), h = Math.max(8, Math.floor(cssH * dpr)); gl.setSize(w, h, false); ascii.resize(w, h);
    } else { const ps = Math.max(1, Math.round(cfg.view.pixelScale)); gl.setSize(Math.max(8, Math.floor(cssW / ps)), Math.max(8, Math.floor(cssH / ps)), false); }
    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    camera.aspect = cssW / cssH; camera.updateProjectionMatrix();
  }
  const cam = { x: 0, z: 8, y: 0, init: false };
  const screen = new THREE.Vector3();

  function project(x, y, z) {
    screen.set(x, y, z).project(camera);
    return { x: (screen.x * .5 + .5) * cssW, y: (-screen.y * .5 + .5) * cssH, vis: screen.z < 1 };
  }

  // молния между врагами и расходящееся кольцо: короткие эффекты из пула
  const fxPool = []; let tomb = null;
  function zap(x1, z1, x2, z2) {
    const len = Math.hypot(x2 - x1, z2 - z1), m = new THREE.Mesh(new THREE.BoxGeometry(.12, .12, len), new THREE.MeshBasicMaterial({ color: '#ffe27a' }));
    m.position.set((x1 + x2) / 2, 1.2 + Y((x1 + x2) / 2, (z1 + z2) / 2), (z1 + z2) / 2); m.rotation.y = Math.atan2(x2 - x1, z2 - z1); scene.add(m); fxPool.push({ m, t: .18, kind: 'zap' });
  }
  function ringFx(x, z, r, color) {
    const m = new THREE.Mesh(new THREE.RingGeometry(.85, 1, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .8, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, .1 + Y(x, z), z); scene.add(m); fxPool.push({ m, t: .35, kind: 'ring', r });
  }
  // предупреждение босса: круг, кольцо или линия рывка, пока идёт замах
  const teleRing = new THREE.Mesh(new THREE.RingGeometry(.97, 1, 48), new THREE.MeshBasicMaterial({ color: '#ff3a2a', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  const teleDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: '#ff3a2a', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  const teleInner = new THREE.Mesh(new THREE.RingGeometry(.97, 1, 32), new THREE.MeshBasicMaterial({ color: '#8affc0', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  const teleLine = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#ff3a2a', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  for (const m of [teleRing, teleDisc, teleInner, teleLine]) { m.rotation.x = -Math.PI / 2; m.position.y = .09; m.visible = false; scene.add(ovl(m)); }
  // стрелы и пятна колдовства: небольшие пулы мешей
  const projMeshes = [], hazMeshes = [];
  // капканы и круги града стрел (умения Сойки)
  const trapMeshes = [0, 1, 2, 3].map(() => { const g = new THREE.Group(), mt = new THREE.MeshLambertMaterial({ color: '#6a6458' }); for (const s of [-1, 1]) { const j = new THREE.Mesh(new THREE.BoxGeometry(.9, .12, .12), mt); j.position.set(0, .08, s * .22); g.add(j); for (let k = -2; k <= 2; k++) { const t = new THREE.Mesh(new THREE.BoxGeometry(.06, .14, .06), mt); t.position.set(k * .18, .16, s * .16); g.add(t); } } g.add(new THREE.Mesh(new THREE.BoxGeometry(.3, .05, .3), new THREE.MeshLambertMaterial({ color: '#3a2a1a' }))); g.visible = false; scene.add(g); return g; });
  const zoneMeshes = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(.92, 1, 40), new THREE.MeshBasicMaterial({ color: '#eef4ff', transparent: true, opacity: .55, side: THREE.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(ovl(m)); return m; });
  for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(.14, .14, .9), new THREE.MeshBasicMaterial({ color: '#ffd27a' })); m.visible = false; m.userData.k = 'foe'; scene.add(m); projMeshes.push(m); }
  for (let i = 0; i < 6; i++) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(.94, 1, 40), new THREE.MeshBasicMaterial({ color: '#d060ff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 36), new THREE.MeshBasicMaterial({ color: '#8a30c0', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    for (const m of [ring, disc]) { m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(ovl(m)); }
    ring.position.y = .1; disc.position.y = .08; hazMeshes.push({ ring, disc });
  }
  function updateFoes(W, t) {
    trapMeshes.forEach((g, i) => { const tp = W.traps[i]; g.visible = !!tp; if (tp) g.position.set(tp.x, Y(tp.x, tp.z), tp.z); });
    zoneMeshes.forEach((m, i) => { const zn = W.zones[i]; m.visible = !!zn; if (zn) { m.position.set(zn.x, .06 + Y(zn.x, zn.z), zn.z); m.scale.setScalar(zn.r); if (Math.random() < .5) burst(zn.x + (Math.random() - .5) * zn.r * 1.6, 3.5, zn.z + (Math.random() - .5) * zn.r * 1.6, 1, '#eef4ff', 1); } });
    projMeshes.forEach((m, i) => { const q = W.proj[i]; m.visible = !!q; if (q) { const k = q.friendly ? q.kind : 'foe'; if (m.userData.k !== k) { m.userData.k = k; m.material.color.set(k === 'foe' ? '#ffd27a' : k === 'bolt' ? '#b8c4d8' : k === 'venom' ? '#7ad060' : '#eef4ff'); m.scale.set(k === 'bolt' ? 1.4 : 1, k === 'bolt' ? 1.4 : 1, k === 'bolt' ? .8 : 1); } m.position.set(q.x, 1.1 + Y(q.x, q.z), q.z); m.rotation.y = Math.atan2(q.vx, q.vz); } });     // свои стрелы светлые, болт толще
    hazMeshes.forEach((h, i) => {
      const z = W.haz[i]; h.ring.visible = h.disc.visible = !!z; if (!z) return;
      const k = Math.min(1, z.t / z.delay), pulse = .3 + .25 * Math.sin(t * 28) + .25 * k, fire = z.by === 'elite' || z.bomber, col = fire ? '#ff7a20' : '#d060ff';      // взрыв (элита, тлеющий) — оранжевый, колдовство — фиолетовое
      h.ring.material.color.set(col); h.disc.material.color.set(fire ? '#c04a10' : '#8a30c0');
      h.ring.position.set(z.x, .1 + Y(z.x, z.z), z.z); h.disc.position.set(z.x, .08 + Y(z.x, z.z), z.z); h.ring.scale.setScalar(z.r); h.disc.scale.setScalar(z.r * k);
      h.ring.material.opacity = .9; h.disc.material.opacity = pulse * .6;
    });
  }
  // полоса прицела копейщика: прямоугольник на земле перед ним, наливается к рывку
  const lineTele = [];
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, .5), new THREE.MeshBasicMaterial({ color: '#ff3a2a', transparent: true, opacity: 0, depthWrite: false })); m.visible = false; scene.add(ovl(m)); lineTele.push(m); }
  function updateLines(W, t) {
    let i = 0;
    for (const e of W.enemies) {
      if (i >= lineTele.length) break;
      if (e.dead || e.state !== 'aim' || !e.tele) continue;
      const m = lineTele[i++], k = Math.min(1, e.t / e.tele.aim);
      m.visible = true; m.position.set(e.x, .07 + Y(e.x, e.z), e.z); m.rotation.y = e.face; m.scale.set(e.tele.w, 1, e.tele.len * (.3 + .7 * k)); m.material.opacity = .25 + .35 * k + .1 * Math.sin(t * 30);
    }
    for (; i < lineTele.length; i++) lineTele[i].visible = false;
  }
  function updateTele(W, t) {
    teleRing.visible = teleDisc.visible = teleInner.visible = teleLine.visible = false;
    for (const e of W.enemies) {
      if (!e.boss || e.dead || !e.b || e.b.state !== 'wind') continue;
      const a = e.b.atk, k = Math.min(1, a.t / a.wind), pulse = .25 + .25 * Math.sin(t * 30) + .2 * k;
      if (a.kind === 'charge') {
        teleLine.visible = true; teleLine.scale.set(a.width, a.len, 1); teleLine.position.set(a.x + a.dx * a.len / 2, .09 + Y(a.x, a.z), a.z + a.dz * a.len / 2);
        teleLine.rotation.set(-Math.PI / 2, 0, -Math.atan2(a.dx, a.dz)); teleLine.rotation.order = 'YXZ'; teleLine.rotation.set(-Math.PI / 2, Math.atan2(a.dx, a.dz), 0); teleLine.material.opacity = pulse;
      } else {
        teleRing.visible = true; teleRing.position.set(a.x, .09 + Y(a.x, a.z), a.z); teleRing.scale.setScalar(a.r); teleRing.material.opacity = .9;
        teleDisc.visible = true; teleDisc.position.set(a.x, .08 + Y(a.x, a.z), a.z); teleDisc.scale.setScalar(a.r * (a.kind === 'nova' ? 1 : k)); teleDisc.material.opacity = pulse * .6;
        if (a.kind === 'nova') { teleInner.visible = true; teleInner.position.set(a.x, .1 + Y(a.x, a.z), a.z); teleInner.scale.setScalar(a.inner); teleInner.material.opacity = .9; }
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
    groundOn = W.lvl === 'surface';
    if (!cam.init) { cam.x = p.x; cam.z = p.z; cam.y = Y(p.x, p.z); cam.init = true; }
    const k = 1 - Math.exp(-cfg.view.camFollow * dt);
    cam.x += (p.x - cam.x) * k; cam.z += (p.z - cam.z) * k; cam.y += (Y(p.x, p.z) - cam.y) * k;
    const pitch = cfg.view.camPitch * Math.PI / 180, dist = cfg.view.camDist;
    const sh = W.shake * .35;
    camera.fov = cfg.view.fov; camera.updateProjectionMatrix();
    const yaw = cfg.view.camYaw * Math.PI / 180, hd = Math.cos(pitch) * dist;
    camera.position.set(cam.x + Math.sin(yaw) * hd + (Math.random() - .5) * sh, Math.sin(pitch) * dist + cfg.view.camLookUp + cam.y + (Math.random() - .5) * sh, cam.z + Math.cos(yaw) * hd);
    camera.lookAt(cam.x, cfg.view.camLookUp + cam.y, cam.z);
    if (W.lvl !== shownLvl) showLevel(W);
    const under = W.lvl !== 'surface';
    if (W.hero !== heroLook) { heroLook = W.hero; hero.setLook(heroOf(W.hero).look); }
    scene.fog.density = under ? cfg.view.fogDensity * 2.2 : cfg.view.fogDensity * (AMB.on ? fogMul(W.t, cfg.daynight, AMB) : 1);     // на рассвете туман гуще
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
    { const w = W.wanderer; cart.group.visible = !under && !!w;
      if (w && !under) {
        cart.group.position.set(w.x, Y(w.x, w.z), w.z); cart.group.rotation.y = w.face;
        const nx = w.x + Math.cos(w.face) * 1.6 + Math.sin(w.face) * .6, nz = w.z - Math.sin(w.face) * 1.6 + Math.cos(w.face) * .6;
        cart.npc.group.rotation.y = Math.atan2(p.x - nx, p.z - nz) - w.face;
        cart.lamp.material.color.setHSL(.78, .9, .72 + (calm ? 0 : .12 * Math.sin(t * 4)));
        if (!calm) { cart.mark.position.y = 3.4 + Math.sin(t * 2.5) * .15; cart.mark.rotation.y = t * 2; if (Math.random() < dt * 5) burst(nx + (Math.random() - .5) * 3, 1.5 + Math.random() * 1.5, nz + (Math.random() - .5) * 3, 1, Math.random() < .5 ? '#c8a0ff' : '#ffe8a0', .6); }
      } }
    // оживление: жители ходят, вороны взлетают, дым из труб
    if (!under) {
      for (const { v, m } of villagers) { stepVillager(v, dt, vStops, AMB, Math.random); m.group.position.set(v.x, Y(v.x, v.z), v.z); m.group.rotation.y = v.face; m.root.position.y = v.moving && !calm ? Math.abs(Math.sin(t * 8 + v.id)) * .07 : 0; m.armL.rotation.x = v.moving && !calm ? Math.sin(t * 8 + v.id) * .5 : 0; m.armR.rotation.x = -m.armL.rotation.x; }
      updateBirds(crows.map(c => c.b), p.x, p.z, dt, AMB);
      for (const { b, m } of crows) { m.group.visible = b.state !== 'gone'; if (!m.group.visible) continue; m.group.position.set(b.x, b.y + Y(b.x, b.z), b.z); m.group.rotation.y = b.face; const fl = b.state === 'fly' ? Math.sin(t * 22) * .9 : (b.peck < .3 ? .2 : 0); m.wl.rotation.z = fl; m.wr.rotation.z = -fl; }
      for (let i = 0; i < puffs.count; i++) {
        const c = pipes[(i / AMB.smoke) | 0], k = ((t / 4 + (i % AMB.smoke) / AMB.smoke + c.x * .013) % 1), s = .35 + k * 1.1 * (1 - k * .6);
        const dr = .4 + 2.6 * windNow.s; puffP.set(c.x + k * dr * windNow.dir[0] + Math.sin(t + i) * .15, c.y + .3 + k * 3.2 * (1 - .4 * windNow.s), c.z + k * dr * windNow.dir[1]);     // дым сносит ветром puffS.set(s, s, s); puffM.compose(puffP, puffQ, puffS); puffs.setMatrixAt(i, puffM);
      }
      if (puffs.count) puffs.instanceMatrix.needsUpdate = true;
    }
    if (!under && river && !calm) waterMat.emissive.setRGB(.04 + .015 * Math.sin(t * 1.3), .1 + .02 * Math.sin(t * 1.7 + 1), .14 + .02 * Math.sin(t * 1.1));
    // костёр: мерцание света и пламени
    const fl = .8 + .2 * Math.sin(t * 17) + .1 * Math.sin(t * 29.3);
    fire.light.intensity = 26 * fl; fire.flames.forEach((f, i) => { f.scale.y = .8 + .35 * Math.sin(t * (9 + i * 4) + i); f.rotation.y = t * (2 + i); });
    // пепел
    const ap = ashGeo.attributes.position;
    for (let i = 0; i < ashN; i++) { let y = ap.getY(i) - dt * (.6 + (i % 5) * .15), x = ap.getX(i) - dt * .5; if (y < 0) { y = 14; } ap.setY(i, y); ap.setX(i, x); }
    ap.needsUpdate = true; ash.position.set(cam.x, 0, cam.z);

    // герой
    const py = Y(p.x, p.z); hero.group.position.set(p.x, py, p.z);
    asciiLamp.visible = asciiOn && !under; if (asciiLamp.visible) asciiLamp.position.set(p.x, py + 2.6, p.z); hero.group.rotation.y = p.face;
    { const it = W.inv.eq.weapon && BY_ID[W.inv.eq.weapon]; hero.setWeapon(W.wp.kind, it ? it.mat : 'steel'); }
    { const o = W.inv.eq.offhand && BY_ID[W.inv.eq.offhand]; hero.setOff(o ? o.id : '', o && o.kind, o && o.mat, o && o.form); }
    if (hero.hurtT > 0) hero.hurtT = Math.max(0, hero.hurtT - dt);
    animateHero(hero, p, t, dt, cfg, p.swingMul || W.gear.swing || 1);
    updateCharge(p, t);
    updateTrail(W, p, dt);
    heroShadow.position.set(p.x, .03 + py, p.z);
    // дуга удара
    arcGeometry(Math.min(360, (W.wp.trait.arc || cfg.player.attackArc) + (W.gear.arc || 0)));       // ширина и дальность дуги — как у надетого оружия
    if (swingFx > 0) swingFx = Math.max(0, swingFx - dt * 5);
    arc.position.set(p.x, .08 + py, p.z); arc.rotation.z = p.face; arc.scale.setScalar(cfg.player.attackRange + (W.gear.reach || 0)); arcMat.opacity = swingFx * .5;

    // враги
    const alive = new Set();
    for (const e of W.enemies) {
      alive.add(e.id);
      const en = entity(e);
      const ey = Y(e.x, e.z); en.m.group.position.set(e.x, ey, e.z); en.m.group.rotation.y = e.face;
      { const base = cfg.enemies[e.type].scale * (e.scaleMul || 1); if (en.m.group.scale.x !== base) en.m.group.scale.setScalar(base); }
      animateMonster(en.m, e, t, cfg);
      if (e.elite) {
        if (!en.elite) { en.elite = new THREE.Mesh(new THREE.RingGeometry(.95, 1.25, 28), new THREE.MeshBasicMaterial({ color: e.affColor, transparent: true, opacity: .8, depthWrite: false, side: THREE.DoubleSide })); en.elite.rotation.x = -Math.PI / 2; scene.add(ovl(en.elite)); }
        en.elite.position.set(e.x, .07 + ey, e.z); en.elite.visible = !e.dead; en.elite.scale.setScalar(cfg.enemies[e.type].scale * (e.scaleMul || 1) * (1 + .06 * Math.sin(t * 5)));
      }
      en.sh.position.set(e.x, .03 + ey, e.z);
      const wind = e.state === 'wind' && !e.dead;
      en.ring.position.set(e.x, .06 + ey, e.z); en.ring.scale.setScalar(cfg.enemies[e.type].range + .5);
      en.ring.material.opacity = wind && !cfg.enemies[e.type].ranged ? .35 + .3 * Math.sin(t * 40) : 0;
      const b = bar(e, e.elite ? e.affColor : undefined), dmg = (e.hp < e.maxhp || e.elite) && !e.dead;
      b.g.visible = dmg; if (dmg) { b.g.position.set(e.x, 2.5 * cfg.enemies[e.type].scale + .3 + ey, e.z); b.g.quaternion.copy(camera.quaternion); b.fill.scale.x = Math.max(.001, e.hp / e.maxhp); }
    }
    // отряд
    const aliveA = new Set();
    for (const a of W.allies) {
      aliveA.add(a.id);
      let en = allyEnts.get(a.id);
      if (!en) { const m = a.decoy ? decoyModel() : a.guest ? (a.cart ? makeCart(false) : makeNpc('traveler')) : makeSoldier(a.type, cfg), sh = shadow(a.cart ? 1.4 : .5); scene.add(m.group, sh); en = { m, sh }; allyEnts.set(a.id, en); }
      const ay = Y(a.x, a.z); en.m.group.position.set(a.x, ay, a.z); en.m.group.rotation.y = a.face;
      if (!a.guest) animateSoldier(en.m, a, t);
      else { en.m.group.visible = !a.dead; if (en.m.root) en.m.root.position.y = calm ? 0 : Math.abs(Math.sin(t * (a.moving ? 9 : 2))) * (a.moving ? .08 : .02); } en.sh.position.set(a.x, .03 + ay, a.z); en.sh.visible = !a.dead;
      const b = bar({ id: 'a' + a.id }, a.guest ? '#d8b040' : '#3a8a4a'), show = (a.guest || a.hp < a.maxhp) && !a.dead;
      b.g.visible = show; if (show) { b.g.position.set(a.x, (a.cart ? 3.4 : 2.7) + ay, a.z); b.g.quaternion.copy(camera.quaternion); b.fill.scale.x = Math.max(.001, a.hp / a.maxhp); }
    }
    for (const [id, en] of allyEnts) if (!aliveA.has(id)) { scene.remove(en.m.group, en.sh); allyEnts.delete(id); const b = bars.get('a' + id); if (b) { scene.remove(b.g); bars.delete('a' + id); } }
    for (const [id, en] of ents) if (!alive.has(id)) { scene.remove(en.m.group, en.sh, en.ring); if (en.elite) scene.remove(en.elite); ents.delete(id); const b = bars.get(id); if (b) { scene.remove(b.g); bars.delete(id); } }

    // события боя → эффекты и подписи (подписи отдаёт hooks.onText)
    for (const v of W.ev) {
      hooks.onEvent && hooks.onEvent(v);
      if (v.k === 'hit') { hitFx(v, p); hooks.onText && hooks.onText(v.x, 2, v.z, String(v.dmg) + (v.crit ? '!' : ''), v.crit ? 'crit' : v.fin ? 'fin' : ''); }
      else if (v.k === 'die') dieFx(v, p);
      else if (v.k === 'hurt') { burst(v.x, 1.2, v.z, 10, '#c0222c'); fx.decal(v.x + (Math.random() - .5), v.z + (Math.random() - .5), .4, BLOOD); hero.hurtT = HURT_T; hooks.onText && hooks.onText(v.x, 2.4, v.z, '−' + v.dmg, 'hurt'); hooks.onHurt && hooks.onHurt(); }
      else if (v.k === 'open') burst(v.x, .9, v.z, 10, '#ffc860', 3)
      else if (v.k === 'heal') hooks.onText && hooks.onText(v.x, 2.4, v.z, '+' + v.n + ' ♥', 'loot')
      else if (v.k === 'ash') hooks.onText && hooks.onText(v.x, 2.4, v.z, '+' + v.n + ' пепла', 'loot')
      else if (v.k === 'buff') burst(v.x, 1.2, v.z, 10, '#9fd0ff', 2)
      else if (v.k === 'dot') { hooks.onText && hooks.onText(v.x, 2.2, v.z, String(v.dmg), 'dot-' + v.fx); }
      else if (v.k === 'react') { burst(v.x, 1.2, v.z, 16, '#bfe8ff', 5); hooks.onText && hooks.onText(v.x, 3, v.z, v.name + '!', 'react'); W.shake = Math.max(W.shake, .3); }
      else if (v.k === 'bossblast') { ringFx(v.x, v.z, v.r || 3, '#ff6a3a'); burst(v.x, .5, v.z, 22, v.kind === 'nova' ? '#ff8a30' : '#6a5a4a', 7); }
      else if (v.k === 'chain') { zap(v.x, v.z, v.x2, v.z2); }
      else if (v.k === 'boom') { ringFx(v.x, v.z, v.r, '#ffe27a'); burst(v.x, .8, v.z, 12, '#ffe27a', 5); }
      else if (v.k === 'drop' && BY_ID[v.id] && BY_ID[v.id].rar >= 4) { fx.flash(v.x, 1.4, v.z, 2.6, RARITY[4].color); burst(v.x, 1, v.z, 12, RARITY[4].color, 4); }
      else if (v.k === 'ability') {                   // умения: вспышки и кольца
        const col = { charge: '#e8d8c0', cry: '#ffd27a', whirl: '#f0e0c8', iron: '#9fd0ff', rage: '#ff4a30', blink: '#c8a0ff', parry: '#fff0c0', dance: '#c8d8ff', shadow: '#2a1838', execute: '#ff3030', leap: '#c8e0b0', volley: '#eef4ff', trap: '#8a8478', venom: '#7ad060', rain: '#eef4ff' }[v.id] || '#ffe8b0';
        if (v.id === 'cry' || v.id === 'whirl') for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = v.id === 'cry' ? 2.5 : 1.8; burst(v.x + Math.sin(a) * r, 1, v.z + Math.cos(a) * r, 2, col, 3); }
        else burst(v.x, 1.2, v.z, 18, col, 3);
        fx.flash(v.x, 1.3, v.z, v.id === 'whirl' ? 2.6 : 1.6, col);
        if (v.id === 'cry' && hooks.onText) hooks.onText(v.x, 3.2, v.z, 'А-а-а!', 'alarm');
      }
      else if (v.k === 'blink') { burst(v.x, 1.2, v.z, 14, '#8a6ad8', 3); burst(v.x2, 1.2, v.z2, 18, '#c8a0ff', 3); fx.flash(v.x2, 1.2, v.z2, 1.6, '#c8a0ff'); }
      else if (v.k === 'parry') { fx.flash(v.x + Math.sin(v.face) * .8, 1.3, v.z + Math.cos(v.face) * .8, 1.8, '#ffffff'); burst(v.x, 1.3, v.z, 12, '#fff0c0', 4); hooks.onText && hooks.onText(v.x, 2.8, v.z, 'Парирование!', 'crit'); }
      else if (v.k === 'danceHit') burst(v.x, 1.2, v.z, 6, '#c8d8ff', 3)
      else if (v.k === 'shadowEnd') burst(v.x, 1.2, v.z, 16, '#2a1838', 2)
      else if (v.k === 'execute') { fx.flash(v.x, 1.3, v.z, 2.4, '#ff3030'); hooks.onText && hooks.onText(v.x, 3, v.z, 'Казнь!', 'crit'); }
      else if (v.k === 'trapSnap') { burst(v.x, .4, v.z, 14, '#8a8478', 3); hooks.onText && hooks.onText(v.x, 2.2, v.z, 'Капкан!', 'alarm'); }
      else if (v.k === 'evFight' || v.k === 'evRaid') { burst(v.x, 1.4, v.z, 14, '#ffb040', 3); hooks.onText && hooks.onText(v.x, 3, v.z, '!', 'alarm'); }
      else if (v.k === 'evDone') { burst(v.x, 1.4, v.z, 30, '#ffd27a', 4); fx.flash(v.x, 1.4, v.z, 1.8, '#ffe8a0'); }
      else if (v.k === 'wanderer' || v.k === 'wanderLeave') { burst(v.x, 1.6, v.z, 26, '#c8a0ff', 3); fx.ash(v.x, 1, v.z, 10, ['#8a7aa0', '#c8b8e0', '#5a4a70']); }
      else if (v.k === 'recall') { burst(v.x, 1.2, v.z, 30, '#c8a0ff', 4); fx.flash(v.x, 1.2, v.z, 2.2, '#e0c8ff'); }
      else if (v.k === 'spot') hooks.onText && hooks.onText(v.x, 2.9, v.z, '!', 'alarm');
      else if (v.k === 'lost') hooks.onText && hooks.onText(v.x, 2.9, v.z, '?', 'lost');
      else if (v.k === 'block') { const p0 = W.player; let dx = p0.x - v.x, dz = p0.z - v.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d; fx.spray(v.x + dx * .6, 1.1, v.z + dz * .6, dx, dz, 8, '#ffe8b0', 6, .9, { life: .25, g: 8, s: .07 }); fx.flash(v.x + dx * .6, 1.1, v.z + dz * .6, 1.1, '#ffffff'); hooks.onText && hooks.onText(v.x, 2.2, v.z, 'щит', 'dodge'); }
      else if (v.k === 'blink') { fx.ash(v.x, .4, v.z, 10, ['#2a2a3a', '#4a4a60', '#101018']); fx.ash(v.x2, .4, v.z2, 10, ['#2a2a3a', '#4a4a60', '#c0d0ff']); }
      else if (v.k === 'lunge') burst(v.x, .3, v.z, 6, '#6a5a4a', 3);
      else if (v.k === 'chargeFull') fx.flash(v.x, 1.6, v.z, 1.4, '#ff8a30');
      else if (v.k === 'heavy') { ringFx(v.x + Math.sin(v.face) * 1.6, v.z + Math.cos(v.face) * 1.6, 2.5 + 1.5 * v.power, '#ff9a50'); }
      else if (v.k === 'finisher') { ringFx(v.x, v.z, 3, '#ffd9c0'); burst(v.x, .6, v.z, 10, '#ffd9c0', 5); fx.flash(v.x + Math.sin(v.face) * 1.5, .8, v.z + Math.cos(v.face) * 1.5, 2.2, '#ffd9c0'); }
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
    if (WC && WC.on) { windNow = windAt(t, WC, cfg.world.seed); WU.uTime.value = t; WU.uWind.value = calm ? 0 : windNow.s; WU.uDir.value.set(windNow.dir[0], windNow.dir[1]); }     // ветер: «Уменьшить движение» — всё стоит
    if (field && !under) {                                           // свет сквозь облака: плывёт по ветру, днём тёплый, ночью лунный
      const tt = calm ? 0 : t, L = W.light, rep = 500 / SL.size;
      lightMat.map.offset.set((SL.wind[0] * tt - 250) / SL.size, rep + (SL.wind[1] * tt - 250) / SL.size);
      lightMat.color.set(SL.night).lerp(sunCol.set(SL.day), L); lightMat.opacity = SL.nightK + (SL.dayK - SL.nightK) * L;
      if ((shaftT -= dt) <= 0) { shaftT = .5; picks = pickShafts(field, p.x, p.z, tt, SL); }
      shafts.forEach((s, i) => {
        const w = picks[i], far = !w || Math.hypot(w.x - s.x, w.z - s.z) > 1;
        if (far && s.a > .01) s.a = Math.max(0, s.a - dt * 1.5);                // старое место гаснет
        else { if (w && far) { s.x = w.x; s.z = w.z; } s.a = Math.min(w ? w.k : 0, s.a + dt * 1.5); }
        s.m.visible = s.a > .01; if (!s.m.visible) return;
        s.m.position.set(s.x, Y(s.x, s.z), s.z); s.m.material.opacity = s.a * SL.shafts.op * (.4 + .6 * L); s.m.material.color.copy(lightMat.color);
        if (!calm && Math.random() < dt * SL.motes * s.a) burst(s.x + (Math.random() - .5) * SL.shafts.w * .6, 1 + Math.random() * 4, s.z + (Math.random() - .5) * 2, 1, '#fffbe0', .3);
      });
    }
    fx.update(dt);

    stepFx(dt); updateTele(W, t); updateLines(W, t); updateFoes(W, t);
    if (W.tomb && (W.tomb.lvl || 'surface') === W.lvl) { if (!tomb) { tomb = new THREE.Group(); const m = new THREE.MeshLambertMaterial({ color: '#8a867c' }); const a = new THREE.Mesh(new THREE.BoxGeometry(.7, 1, .18), m); a.position.y = .5; const b = new THREE.Mesh(new THREE.BoxGeometry(.4, .2, .18), m); b.position.y = 1.1; const g = new THREE.Mesh(new THREE.OctahedronGeometry(.2), new THREE.MeshBasicMaterial({ color: '#ffd45a' })); g.position.y = 1.9; tomb.add(a, b, g); tomb.userData.gem = g; scene.add(tomb); } tomb.visible = true; tomb.position.set(W.tomb.x, Y(W.tomb.x, W.tomb.z), W.tomb.z); tomb.userData.gem.position.y = 1.9 + Math.sin(t * 3) * .1; tomb.userData.gem.rotation.y = t * 2; } else if (tomb) tomb.visible = false;
    for (const e of W.enemies) if (e.st && !e.dead) { const r = Math.random(); if (e.st.burn && r < dt * 9) burst(e.x, 1.5, e.z, 1, '#ff8a30', 1); else if (e.st.poison && r < dt * 5) burst(e.x, 1.4, e.z, 1, '#7ad060', .8); else if (e.st.freeze && r < dt * 4) burst(e.x, 1.2, e.z, 1, '#cfeeff', .8); }
    if (asciiOn) ascii.render(scene, camera, t, under ? .3 : W.light); else gl.render(scene, camera);
  }
  function setAscii(on) {                                           // атлас строится в resize под плотность экрана
    asciiOn = !!on; gtex.minFilter = asciiOn ? THREE.LinearMipmapLinearFilter : THREE.NearestFilter; gtex.needsUpdate = true;     // в клетках мелкая трава без сглаживания даёт муар
    resize();
  }

  const treesNear = (x, z) => { if (!WC) return 0; let n = 0; const r2 = WC.rustle.r * WC.rustle.r; for (let i = 0; i < treeXZ.length; i += 2) { const dx = treeXZ[i] - x, dz = treeXZ[i + 1] - z; if (dx * dx + dz * dz < r2) n++; } return Math.min(1, n / WC.rustle.full); };
  return { render, resize, project, setAscii, wind: () => windNow, treesNear, ascii: () => (asciiOn ? ascii : null), sun: () => (field ? { op: lightMat.opacity, shafts: shafts.filter(s => s.m.visible).length, on: sunGroup.visible !== false } : null), gl, camera, scene, town, info: () => gl.info.render, hero, fx, life: () => ({ villagers: villagers.map(({ v }) => ({ x: v.x, z: v.z, moving: v.moving })), crows: crows.map(({ b }) => ({ x: b.hx, z: b.hz, state: b.state })), puffs: puffs.count, fog: scene.fog.density }) };
}
