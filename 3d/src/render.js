// Сцена Three.js: мир, свет, камера, спецэффекты. Рисует в маленьком разрешении и растягивает без сглаживания.
import { storyActors, storyTalkable } from './story3d.js';
import { makeMap, addFires, propsBlocked, campGates, insideOf, insideCamp } from './map.js';
import { firesOf } from './fires3d.js';
import { buildDecor } from './decor.js';
import { buildTown } from './town.js';
import { buildLevelView, buildSurfaceView } from './levelview.js';
import { buildHeights, heightAt, waterDist, lakeR, streamDist } from './terrain3d.js';
import { createAscii, OVERLAY } from './ascii3d.js';
import { makeField, pickShafts } from './sunlight3d.js';
import { windAt, grassSpots } from './wind3d.js';
import { makeWeather, weatherAt, effectsOf } from './weather3d.js';
import { overheadOf } from './overhead3d.js';
import { propsIn, grassIn, chunksAround, CHUNK } from './chunks3d.js';
import { pathSegs, distSeg } from './world3d.js';
import { groundMix, grassHSL, flowersIn, bushesIn } from './flora3d.js';
import { biomeTint, biomeAt, BIOMES, biomeWeights } from './worldgen3d.js';
import { inCliff } from './cliffs3d.js';
import * as THREE from 'three';
import { dressedLook, lookKey } from './look3d.js';
import { qualityOf } from './quality3d.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeBladeFx, bladeEls, hasBladeStyle } from './bladefx3d.js';
import { weaponMix, weaponElement } from './stones3d.js';
import { loadNature, loadBaked, modelsOff } from './actors3d.js';
import { setDecorLib } from './decor.js';
import { setNature } from './models.js';
import { makeActor, actorKey, actorReady, preloadActors, driveHero, driveFoe, disposeActor } from './actors3d.js';
import { makeHero, animateHero, makeMonster, animateMonster, makeCampfire, addTree, addRock, addBush, addCanopyTree, makeNpc, makeCart, makeHorse, makeCrow, makeSoldier, animateSoldier, makeBeast } from './models.js';
import { heroOf } from './data/heroes3d.js';
import { villagerStops, makeVillagers, stepVillager, makeBirds, updateBirds, chimneys, fogMul, makeBeasts, updateBeasts, makeDucks, updateDucks } from './ambient3d.js';
import { mulberry32 } from './sim.js';
import { questMark } from './quests3d.js';
import { skyAt } from './daynight.js';
import { BY_ID, RARITY } from './data/items.js';
import { trailOn, dampAngle } from './anim3d.js';
import { createFx } from './fx3d.js';
import { RATE, statusPart, emitCount, lightning, stunStar } from './vfx3d.js';
import { ELEMENT_COLOR } from './elements3d.js';
import { WSKILL } from './weaponskill3d.js';
import { groundNoise, pathMix, segsNear, contactGrid, contactShade } from './ground3d.js';
import { initPaint, paintMat, setPaintLevel } from './paint3d.js';
import { surfaceDetails } from './details3d.js';

const FOG = '#150c0b';

function groundTexture(look) {                                      // шаг 6: плавный тихий шум вместо зерна; mean — средний цвет (линейный)
  const G = look.groundNoise, n = G.n, c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d'), im = g.createImageData(n, n), { hue, lum } = groundNoise(n, 5, G);
  const a = new THREE.Color(look.ground[0]).convertLinearToSRGB(), b = new THREE.Color(look.ground[1]).convertLinearToSRGB(), sum = [0, 0, 0];
  for (let i = 0; i < n * n; i++) {
    const rgb = [a.r + (b.r - a.r) * hue[i], a.g + (b.g - a.g) * hue[i], a.b + (b.b - a.b) * hue[i]].map(v => Math.min(1, v * lum[i]));
    rgb.forEach((v, k) => { im.data[i * 4 + k] = Math.round(v * 255); sum[k] += v; }); im.data[i * 4 + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(70, 70);
  t.colorSpace = THREE.SRGBColorSpace;
  t.mean = new THREE.Color().setRGB(sum[0] / n / n, sum[1] / n / n, sum[2] / n / n, THREE.SRGBColorSpace);
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
const GCOL = { fire: '#ff8a30', ice: '#9fdcff', water: '#5aa8e8', storm: '#ffe27a', venom: '#7ad060', blood: '#d0303a', earth: '#c09a68', steel: '#e8e0d0', shadow: '#a87ae8', light: '#ffe8a0' };     // стихии новых умений древа

export function createRenderer(canvas, cfg, hooks = {}) {
  initPaint(cfg.shaders && cfg.shaders.paint);     // материалы (T0) — до постройки домов, декора и сундуков
  const gl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!hooks.preserve });     // сглаживание краёв (шаг 2)
  gl.setPixelRatio(1);
  const scene = new THREE.Scene();
  // оптимизация (2026-10-18): что в кадре — пирамида камеры раз в кадр; живое вне кадра не анимируется, события вне кадра не рисуются
  const FR = new THREE.Frustum(), PV = new THREE.Matrix4(), SPH = new THREE.Sphere();
  const inView = (x, y, z, r = 2.5) => { SPH.center.set(x, y, z); SPH.radius = r; return FR.intersectsSphere(SPH); };
  // освободить модель: геометрии и материалы экземпляра (общие из кэша — userData.shared — не трогаем)
  const disposeDeep = o => { if (!o) return; o.traverse(m => { if (!m.isMesh && !m.isInstancedMesh) return; if (m.geometry && !m.geometry.userData.shared) m.geometry.dispose(); for (const mt of [].concat(m.material || [])) if (!mt.userData.shared) mt.dispose(); }); };
  // неподвижное: матрицы — один раз; дальнее — снять со сцены (не обходится каждый кадр), ближнее — вернуть
  const freeze = o => { o.traverse(q => { q.updateMatrix(); q.matrixAutoUpdate = false; }); o.updateMatrixWorld(true); };
  const park = (o, far) => { if (far) { if (o.parent) { o.userData.home = o.parent; o.parent.remove(o); } } else if (!o.parent && o.userData.home) o.userData.home.add(o); };
  scene.background = new THREE.Color(FOG);
  scene.fog = new THREE.FogExp2(FOG, cfg.view.fogDensity);
  const camera = new THREE.PerspectiveCamera(cfg.view.fov, 1, .5, 700);
  camera.layers.enable(OVERLAY);
  const ovl = o => { o.traverse(c => c.layers.set(OVERLAY)); return o; };     // чёткие метки боя: в фильтре ASCII рисуются поверх символов
  let ascii = null, asciiOn = false;

  // свет: тусклое «багровое» небо, холодный свет затмения и тёплый костёр
  const hemi = new THREE.HemisphereLight('#a8847a', '#2a1a16', 2.4); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffa080', 1.7); sun.position.set(...cfg.daynight.sunPos); scene.add(sun, sun.target);
  // тени (шаг 14): карта теней вокруг героя, включается пресетом «Высокое» на компьютере; PCF с размытием (PCFSoft в three 0.186 удалён)
  const SHD = cfg.view.quality && cfg.view.quality.shadow, sunDir = new THREE.Vector3(...cfg.daynight.sunPos).normalize();
  gl.shadowMap.type = THREE.PCFShadowMap;
  const shR = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), sunDir).normalize(), shU = new THREE.Vector3().crossVectors(sunDir, shR), shT = new THREE.Vector3();     // базис света: сдвиг карты теней с шагом в тексель
  if (SHD) { sun.shadow.mapSize.set(SHD.size, SHD.size); const c = sun.shadow.camera; c.left = c.bottom = -SHD.span; c.right = c.top = SHD.span; c.near = .5; c.far = SHD.dist * 2.2; c.updateProjectionMatrix(); sun.shadow.radius = SHD.radius; sun.shadow.bias = SHD.bias; sun.shadow.normalBias = SHD.normalBias; }
  const dome = skyDome(cfg.look); scene.add(dome);
  let lastLight = -1;

  const gtex = groundTexture(cfg.look);
  const GW = (cfg.world.radius + 200) * 2, gtex2 = gtex.clone(); gtex2.repeat.set(70 * GW / 500, 70 * GW / 500); gtex2.needsUpdate = true;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(GW, GW), paintMat(new THREE.MeshLambertMaterial({ map: gtex2 }), 'ground'));     // под всем миром, тот же масштаб травы
  ground.rotation.x = -Math.PI / 2; ground.position.y = -1.2; scene.add(ground);     // ниже дна реки: внутри мира землю рисуют холмы

  const map = addFires(makeMap(cfg), cfg, firesOf);     // костры вне лагеря — та же карта, что у мира (раньше рендер строил её без костров)
  // рельеф (C2): поле высот только для вида; Y — высота земли под точкой (в подземельях 0)
  const hf = buildHeights(cfg, map); let groundOn = true;
  const Y = (x, z) => (groundOn ? heightAt(hf, x, z) : 0);
  if (hooks.onText) { const f = hooks.onText; hooks.onText = (x, y, z, ...a) => f(x, y + Y(x, z), z, ...a); }
  // земля с холмами (C3a): участками CHUNK м вокруг героя; светлее на буграх и темнее в низинах, у воды — песок
  const hillsMat = paintMat(new THREE.MeshLambertMaterial({ map: gtex, vertexColors: true }), 'ground'), sandC = new THREE.Color(cfg.look.sand), rel = h => { const t = new THREE.Color(h), g = gtex.mean; return new THREE.Color(t.r / g.r, t.g / g.g, t.b / g.b); }, rockC = rel('#6e6a60'), PATH = cfg.look.path, pathC = PATH ? rel(PATH.color) : null, roadSegs = pathSegs(map);     // скала и тропа: текстура травы × множитель ≈ нужный цвет (линейный)     // цвет материала — мокрость (F3)
  // текстуры земли (2026-10-20, выбор владельца): 8 слоёв — трава, тропа, камень, болото, грязь, снежная трава, снег, песок; смесь по долям в вершинах
  const GT = cfg.groundTex && cfg.groundTex.on && !modelsOff() ? cfg.groundTex : null, GU = { uGT: { value: null }, uGTK: { value: 0 }, uGTile: { value: GT ? GT.tile : 4 }, uGTGain: { value: GT ? GT.gain : 1 }, uGL0: { value: new THREE.Vector4(...(GT ? GT.layer.slice(0, 4) : [1, 1, 1, 1])) }, uGL1: { value: new THREE.Vector4(...(GT ? GT.layer.slice(4) : [1, 1, 1, 1])) } };
  if (GT) { const prev = hillsMat.onBeforeCompile, key0 = hillsMat.customProgramCacheKey ? hillsMat.customProgramCacheKey() : '';
    hillsMat.onBeforeCompile = (sh, r) => { if (prev) prev(sh, r); Object.assign(sh.uniforms, GU);
      sh.vertexShader = 'attribute vec4 tw0; attribute vec4 tw1; varying vec4 vTW0; varying vec4 vTW1; varying vec2 vGXZ;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vTW0 = tw0; vTW1 = tw1; vGXZ = (modelMatrix * vec4(transformed, 1.)).xz;');
      sh.fragmentShader = 'uniform highp sampler2DArray uGT; uniform float uGTK, uGTile, uGTGain; uniform vec4 uGL0, uGL1; varying vec4 vTW0; varying vec4 vTW1; varying vec2 vGXZ;\n' + sh.fragmentShader.replace('#include <map_fragment>',
        `#include <map_fragment>
  if (uGTK > 0.) { vec2 tu = vGXZ / uGTile; vec4 a = vTW0 * uGL0, b = vTW1 * uGL1; vec3 tc = texture(uGT, vec3(tu, 0.)).rgb * a.x + texture(uGT, vec3(tu, 1.)).rgb * a.y + texture(uGT, vec3(tu, 2.)).rgb * a.z + texture(uGT, vec3(tu, 3.)).rgb * a.w
      + texture(uGT, vec3(tu, 4.)).rgb * b.x + texture(uGT, vec3(tu, 5.)).rgb * b.y + texture(uGT, vec3(tu, 6.)).rgb * b.z + texture(uGT, vec3(tu, 7.)).rgb * b.w;
    vec4 base = vec4(1.);
#ifdef USE_MAP
    base = texture2D(map, vMapUv);
#endif
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb / max(base.rgb, vec3(.02)) * tc * uGTGain, uGTK); }`); };
    hillsMat.customProgramCacheKey = () => key0 + '-gtex';
    new THREE.ImageLoader().load(new URL('../models/ground.webp', import.meta.url).href, img => {
      const N = img.width, L = Math.round(img.height / N), c = document.createElement('canvas'); c.width = N; c.height = N * L; const g2 = c.getContext('2d'); g2.drawImage(img, 0, 0);
      const t = new THREE.DataArrayTexture(new Uint8Array(g2.getImageData(0, 0, N, N * L).data.buffer), N, N, L); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 4; t.needsUpdate = true;
      GU.uGT.value = t; GU.uGTK.value = 1; gtexOn = true; for (const k of [...liveLand.keys()]) dropLand(k);     // участки пересобираются с долями текстур
    }, undefined, e => console.warn('текстуры земли не загрузились', e)); }
  let gtexOn = false;
  // доли слоёв в точке: биом, тропа, берег, обрыв, верх плато; пятна внутри биома — по шуму
  const gnoise = (x, z) => { const s = Math.sin(x * .113 + Math.sin(z * .071) * 2.1) * Math.sin(z * .097 + Math.sin(x * .053) * 1.7); return .5 + .5 * s; };
  function groundW(x, z, h, pk) {
    const B = biomeWeights(cfg, x, z), n = gnoise(x, z), W = [0, 0, 0, 0, 0, 0, 0, 0];     // трава, тропа, камень, болото, грязь, снежная трава, снег, песок
    const add = (i, v) => { W[i] += v; };
    for (const [b, v] of Object.entries(B)) { if (!v) continue;
      if (b === 'core' || b === 'forest') { add(0, v * (1 - n * .25)); add(1, v * n * .25); }
      else if (b === 'swamp') { add(3, v * (1 - n * .45)); add(4, v * n * .45); }
      else if (b === 'mountains') { add(5, v * (1 - n * .5)); add(2, v * n * .5); }
      else if (b === 'waste') { add(1, v * (.55 + n * .25)); add(4, v * (.45 - n * .25)); }
      else if (b === 'coast') { add(7, v * (.6 + n * .3)); add(0, v * (.4 - n * .3)); } }
    if (map.river && h < -.15) { const k = Math.min(1, -h / .8) * .85; for (let i = 0; i < 8; i++) W[i] *= 1 - k; W[(B.swamp || 0) > .5 ? 4 : 7] += k; }     // у воды — песок, в болоте — грязь
    else if (pk > 0) { for (let i = 0; i < 8; i++) W[i] *= 1 - pk; W[1] += pk; }     // тропа
    if (map.plateaus.length) { if (inCliff(map.plateaus, x, z, .9)) { W.fill(0); W[2] = 1; } else for (const P of map.plateaus) if (Math.hypot(x - P.x, z - P.z) < P.r - 1.5) { const k = .75; for (let i = 0; i < 8; i++) W[i] *= 1 - k; W[6] += k; break; } }     // обрыв — камень, верх плато — снег
    const sum = W.reduce((a, b) => a + b, 0) || 1; return W.map(v => v / sum);
  }
  // деревья и камни участка: один раз на участок, нужны и земле (тень у стволов), и самим деревьям; старые забываются
  const propsMemo = new Map(), propsAt = (ci, cj) => { const k = ci + ',' + cj; let P = propsMemo.get(k); if (!P) { P = propsIn(map, cfg, ci, cj); propsMemo.set(k, P); if (propsMemo.size > 160) propsMemo.delete(propsMemo.keys().next().value); } return P; };
  const FL = cfg.flora && cfg.flora.on ? cfg.flora : null;
  const hillsGeo = (ci, cj) => {
    const g = new THREE.PlaneGeometry(CHUNK, CHUNK, CHUNK, CHUNK); g.rotateX(-Math.PI / 2); g.translate((ci + .5) * CHUNK, 0, (cj + .5) * CHUNK);
    const pos = g.attributes.position, uv = g.attributes.uv, col = new Float32Array(pos.count * 3), c = new THREE.Color(), tw0 = new Float32Array(pos.count * 4), tw1 = new Float32Array(pos.count * 4);
    const near = pathC ? segsNear(roadSegs, ci * CHUNK, (ci + 1) * CHUNK, cj * CHUNK, (cj + 1) * CHUNK, PATH.w[1] + PATH.edge + 1) : [];     // тропы рядом с участком
    const CS = cfg.shapes && cfg.shapes.contact, m = CS ? CS.r + .5 : 0, X0 = ci * CHUNK - m, X1 = (ci + 1) * CHUNK + m, Z0 = cj * CHUNK - m, Z1 = (cj + 1) * CHUNK + m;     // тень у домов и стволов (шаг 7)
    const blds = CS ? map.buildings.filter(b => b.x1 > X0 && b.x0 < X1 && b.z1 > Z0 && b.z0 < Z1) : [], trunks = [];
    if (CS) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const q of propsAt(ci + a, cj + b)) if (q.tree && q.x > X0 && q.x < X1 && q.z > Z0 && q.z < Z1) trunks.push(q.x, q.z);
    const shade = CS && (blds.length || trunks.length) ? contactGrid(CHUNK, ci * CHUNK, cj * CHUNK, blds, trunks, CS.r) : null;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = heightAt(hf, x, z, false); pos.setY(i, h);     // под мостом — русло, не настил
      uv.setXY(i, (x + 250) / 500, 1 - (z + 250) / 500);                // та же текстура и масштаб, что у плоской земли
      const k = 1 + h * .12, tn = biomeTint(cfg, x, z); c.setRGB(k * tn[0], k * tn[1], k * tn[2]);     // оттенок биома (C3b)
      if (FL) { const gm = groundMix(x, z, FL); c.setRGB(c.r * gm[0], c.g * gm[1], c.b * gm[2]); }     // пятна сочной и сухой травы, проплешины (зелень)
      if (gtexOn) { const pk = near.length ? pathMix(near, x, z, PATH) : 0, Wt = groundW(x, z, h, pk); tw0.set(Wt.slice(0, 4), i * 4); tw1.set(Wt.slice(4), i * 4); c.setRGB(1 + (c.r - 1) * GT.tint, 1 + (c.g - 1) * GT.tint, 1 + (c.b - 1) * GT.tint).multiplyScalar(k); }     // текстуры: цвет вершины — только свет и лёгкий оттенок биома
      else {
      if (map.river && h < -.15) c.lerp(sandC, Math.min(1, -h / .8) * .7);
      else if (near.length) { const pk = pathMix(near, x, z, PATH); if (pk > 0) c.lerp(pathC, pk); }     // тропа — цвет земли с мягким краем (шаг 6)
      if (map.plateaus.length && inCliff(map.plateaus, x, z, .9)) c.copy(rockC).multiplyScalar(k); }     // отвесный край — камень (C3c)
      if (shade) c.multiplyScalar(contactShade(shade[Math.round(z - cj * CHUNK) * (CHUNK + 1) + Math.round(x - ci * CHUNK)], CS));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('tw0', new THREE.BufferAttribute(tw0, 4)); g.setAttribute('tw1', new THREE.BufferAttribute(tw1, 4)); g.computeVertexNormals(); return g;
  };
  // свет сквозь облака (E2): пятна света на холмах (та же сетка, текстура поля плывёт по ветру) и столбы света над яркими
  const SL = cfg.sunlight, field = SL && SL.on ? makeField(cfg.world.seed) : null, sunGroup = new THREE.Group();
  let lightMat = null; const shafts = [];
  if (field) {
    const n = field.n, c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'), im = g.createImageData(n, n);
    field.data.forEach((v, i) => { im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = Math.round(v * 255); im.data[i * 4 + 3] = 255; }); g.putImageData(im, 0, 0);
    const lt = new THREE.CanvasTexture(c); lt.wrapS = lt.wrapT = THREE.RepeatWrapping; lt.flipY = false; lt.repeat.set(500 / SL.size, -500 / SL.size);
    lightMat = new THREE.MeshBasicMaterial({ map: lt, color: SL.day, transparent: true, opacity: SL.dayK, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
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
  // вода (V2a): рябь по течению, блики на гребнях, светлое мелководье и пена у берега — поверх освещения и тумана Lambert
  const WS = cfg.shaders && cfg.shaders.water, WaU = { uTime: { value: 0 }, uDay: { value: 1 } };
  if (WS && WS.on) {
    waterMat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, WaU, { uRip: { value: WS.ripple }, uGlint: { value: WS.glint }, uShallow: { value: new THREE.Color(WS.shallow) }, uFoam: { value: new THREE.Color(WS.foam) }, uShoreW: { value: WS.shoreW }, uFoamW: { value: WS.foamW }, uFlowK: { value: WS.flow } });
      sh.vertexShader = 'attribute vec2 bank; attribute vec2 flow; varying vec2 vBank; varying vec2 vFlow; varying vec3 vWPos;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vBank = bank; vFlow = flow; vWPos = (modelMatrix * vec4(transformed, 1.)).xyz;');
      sh.fragmentShader = 'uniform float uTime, uDay, uRip, uGlint, uShoreW, uFoamW, uFlowK; uniform vec3 uShallow, uFoam; varying vec2 vBank; varying vec2 vFlow; varying vec3 vWPos;\n'
        + 'float wh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n'
        + 'float wn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(wh(i), wh(i + vec2(1., 0.)), f.x), mix(wh(i + vec2(0., 1.)), wh(i + vec2(1., 1.)), f.x), f.y); }\n'
        + sh.fragmentShader
          .replace('#include <color_fragment>', `#include <color_fragment>
  vec2 wp = vWPos.xz, fl = vFlow * uFlowK * uTime;
  float rip = wn(wp * .55 - fl) * .6 + wn(wp * 1.4 - fl * 1.7 + 7.3) * .4;
  float shore = min(vBank.x, vBank.y - vBank.x);
  diffuseColor.rgb = mix(diffuseColor.rgb, uShallow, (1. - smoothstep(0., uShoreW, shore)) * .6);
  diffuseColor.rgb *= 1. + (rip - .5) * .45 * uRip;
  float foam = (1. - smoothstep(0., uFoamW, shore)) * smoothstep(.35, .7, wn(wp * 2.6 - fl * 2.));
  diffuseColor.rgb = mix(diffuseColor.rgb, uFoam, foam * .85);`)
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += vec3(1., .96, .86) * smoothstep(.8, .95, wn(wp * 3.2 - fl * 2.4 + 3.1) * .55 + rip * .45) * uGlint * (.25 + .75 * uDay) * (1. - foam);');
    };
    waterMat.customProgramCacheKey = () => 'water-v2';
  }
  if (river) {
    const P = river.pts, v = [], idx = [], hw = river.w / 2 + .5, bank = [], flow = [];
    P.forEach((p, i) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
      v.push(p.x + nx * hw, cfg.terrain.water, p.z + nz * hw, p.x - nx * hw, cfg.terrain.water, p.z - nz * hw); if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
      bank.push(0, hw * 2, hw * 2, hw * 2); flow.push(dx / l, dz / l, dx / l, dz / l); });     // до берега, м (V2), и направление течения
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); wg.setIndex(idx); wg.computeVertexNormals();
    wg.setAttribute('bank', new THREE.Float32BufferAttribute(bank, 2)); wg.setAttribute('flow', new THREE.Float32BufferAttribute(flow, 2));
    riverGroup.add(new THREE.Mesh(wg, waterMat));
    const wood = paintMat(new THREE.MeshLambertMaterial({ color: '#5a3e26' }), 'nature'), dark = paintMat(new THREE.MeshLambertMaterial({ color: '#3a2818' }), 'nature'), dk = cfg.terrain.bridge.deck;     // мосты: волокно и тон досок (T3)
    for (const b of river.bridges) {
      const g = new THREE.Group(); g.position.set(b.x, 0, b.z); g.rotation.y = b.ang;
      // дуга (F4): настил и перила — отрезками по профилю, к середине выше на arch
      const ar = cfg.terrain.bridge.arch || 0, yk = k => dk + ar * Math.max(0, 1 - Math.pow(2 * k / b.len, 2)), n = 12, sl = b.len / n;
      for (let i = 0; i < n; i++) { const k0 = -b.len / 2 + i * sl, k1 = k0 + sl, y0 = yk(k0), y1 = yk(k1), ang = -Math.atan2(y1 - y0, sl);
        const d = new THREE.Mesh(new THREE.BoxGeometry(b.w, .16, Math.hypot(sl, y1 - y0) + .03), wood); d.position.set(0, (y0 + y1) / 2 - .08, (k0 + k1) / 2); d.rotation.x = ang; g.add(d);
        for (const s of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(.1, .1, Math.hypot(sl, y1 - y0) + .03), dark); rail.position.set(s * (b.w / 2 - .05), (y0 + y1) / 2 + .7, (k0 + k1) / 2); rail.rotation.x = ang; g.add(rail); } }
      for (let k = -b.len / 2 + .4; k < b.len / 2; k += .55) { const pl = new THREE.Mesh(new THREE.BoxGeometry(b.w + .1, .04, .08), dark); pl.position.set(0, yk(k) + .01, k); pl.rotation.x = Math.atan(8 * ar * k / (b.len * b.len)); g.add(pl); }
      for (const s of [-1, 1]) for (let k = -b.len / 2; k <= b.len / 2 + .01; k += b.len / 4) { const post = new THREE.Mesh(new THREE.BoxGeometry(.14, 1.5, .14), dark); post.position.set(s * (b.w / 2 - .05), yk(k) + .1, k); g.add(post); }
      riverGroup.add(g);
    }
    // озёра (2026-10-18): веер от центра к неровному берегу, шейдер воды (bank — до берега, течения нет); камыш по кромке
    const reedMat = new THREE.MeshLambertMaterial({ color: '#5a6a2e' }), reedTop = new THREE.MeshLambertMaterial({ color: '#5a3a22' }), reeds = [];
    for (const L of river.lakes || []) {
      const N = 44, v = [L.x, cfg.terrain.water, L.z], idx = [], bank = [L.r, L.r * 2], flow = [0, 0];
      for (let i = 0; i <= N; i++) { const a = i / N * Math.PI * 2, R = lakeR(L, a) + .35; v.push(L.x + Math.sin(a) * R, cfg.terrain.water, L.z + Math.cos(a) * R); bank.push(0, L.r * 2); flow.push(0, 0); if (i) idx.push(0, i, i + 1); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx); g.computeVertexNormals();
      g.setAttribute('bank', new THREE.Float32BufferAttribute(bank, 2)); g.setAttribute('flow', new THREE.Float32BufferAttribute(flow, 2)); riverGroup.add(new THREE.Mesh(g, waterMat));
      const nr = Math.round(L.r * 1.6); for (let i = 0; i < nr; i++) { const h = Math.sin(i * 12.9898 + L.x) * 43758.5453, f = h - Math.floor(h), a = (i + f) / nr * Math.PI * 2; if (f < .35) continue; const R = lakeR(L, a) + .2 + f * .6; reeds.push([L.x + Math.sin(a) * R, L.z + Math.cos(a) * R, .8 + f * .6]); }
    }
    // ручьи: лента вдоль русла на высоте земли (русло чуть ниже), течение к устью
    for (const S of river.streams || []) {
      const P = S.pts, v = [], idx = [], bank = [], flow = [], hw = S.w / 2 + .15;
      P.forEach((p, i) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l, y = Y(p.x, p.z) + .14;
        v.push(p.x + nx * hw, y, p.z + nz * hw, p.x - nx * hw, y, p.z - nz * hw); if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
        bank.push(0, hw * 2, hw * 2, hw * 2); flow.push(dx / l * 1.6, dz / l * 1.6, dx / l * 1.6, dz / l * 1.6);
        if (i % 2 === 0) for (const s of [-1, 1]) { const h = Math.sin(i * 78.233 + p.x * s) * 43758.5453, f = h - Math.floor(h); if (f > .55) reeds.push([p.x + nx * s * (hw + .3 + f * .4), p.z + nz * s * (hw + .3 + f * .4), .6 + f * .4]); } });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx); g.computeVertexNormals();
      g.setAttribute('bank', new THREE.Float32BufferAttribute(bank, 2)); g.setAttribute('flow', new THREE.Float32BufferAttribute(flow, 2)); riverGroup.add(new THREE.Mesh(g, waterMat));
    }
    if (reeds.length) {     // камыш одним вызовом отрисовки: стебли и метёлки
      const st = new THREE.InstancedMesh(new THREE.BoxGeometry(.07, 1, .07), reedMat, reeds.length), tp = new THREE.InstancedMesh(new THREE.BoxGeometry(.11, .26, .11), reedTop, reeds.length), o = new THREE.Object3D();
      reeds.forEach(([x, z, h], i) => { const y = Y(x, z); o.position.set(x, y + h / 2, z); o.scale.set(1, h, 1); o.rotation.set(0, i, (i % 5 - 2) * .05); o.updateMatrix(); st.setMatrixAt(i, o.matrix); o.position.set(x, y + h + .1, z); o.scale.set(1, 1, 1); o.updateMatrix(); tp.setMatrixAt(i, o.matrix); });
      riverGroup.add(st, tp);
    }
    scene.add(riverGroup); freeze(riverGroup);     // вода и мосты неподвижны
  }
  const town = buildTown(map, cfg, mulberry32(cfg.world.seed + 1)); scene.add(town.group);
  const mkDecor = () => buildDecor({ ...map, decor: map.decor.concat(surfaceDetails(map, cfg)) }, mulberry32(cfg.world.seed + 2), cfg.shaders && cfg.shaders.grime);
  const decor = mkDecor(); scene.add(decor.group); freeze(decor.group);     // детали мира (T5) — только вид
  const decorCells = [...decor.group.children], CL = cfg.cull;     // клетки декора (снимаются вдали); дальности и доля травы — config3d.js → cull
  const npcs = [], storyNpcs = new Map();     // герои сюжета (этап 3)
  const markTex = Object.fromEntries(['!', '?'].map(ch => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.font = '900 54px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = '#1a0e06'; g.strokeText(ch, 32, 34); g.fillStyle = ch === '!' ? '#ffd23a' : '#d8d8e0'; g.fillText(ch, 32, 34); return [ch, new THREE.CanvasTexture(c)]; }));
  for (const b of map.buildings) if (b.npc) { const n = makeNpc(b.npc.kind); n.group.position.set(b.npc.x, 0, b.npc.z); n.pos = b.npc; n.mark = new THREE.Mesh(new THREE.OctahedronGeometry(.22), new THREE.MeshBasicMaterial({ color: '#e8c04a' })); n.mark.position.set(0, 2.6, 0); n.mark.visible = false; n.group.add(n.mark); scene.add(n.group); npcs.push(n); }

  // ветер (F2): общие uniform для шейдеров крон и травы; смещение — после всех преобразований, по миру (одно направление)
  const WC = cfg.wind, WU = { uTime: { value: 0 }, uWind: { value: 0 }, uDir: { value: new THREE.Vector2(0, 1) } };
  const TREE_PV = `vec4 mvPosition = vec4( transformed, 1.0 );
  { float k = sway; vec2 wp = mvPosition.xz;
    float sw = uWind * uAmp * k * k * ( 0.55 + 0.45 * sin( uTime * ( 1.1 + uWind * 1.6 ) + wp.x * .21 + wp.y * .17 ) );
    float fl = uWind * uLeaf * step( .7, k ) * sin( uTime * 9. + wp.x * 3.1 + wp.y * 2.3 + mvPosition.y * 4. );
    mvPosition.xz += uDir * sw + vec2( fl, -fl * .6 ); }
  vWP = ( modelMatrix * vec4( mvPosition.xyz, 1. ) ).xyz;
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
  const LS = cfg.shaders && cfg.shaders.leaf, LeU = { uDayL: { value: 1 } };
  const windy = (mat, kind) => {
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, WU, { uAmp: { value: kind === 'tree' ? WC.sway.tree : WC.sway.grass }, uLeaf: { value: WC.sway.leaf }, uH: { value: WC.grass.h } });
      sh.vertexShader = (kind === 'tree' ? 'attribute float sway; varying vec3 vWP;\n' : '') + 'uniform float uTime, uWind, uAmp, uLeaf, uH; uniform vec2 uDir;\n' + sh.vertexShader.replace('#include <project_vertex>', kind === 'tree' ? TREE_PV : GRASS_PV);
      if (kind === 'tree' && LS && LS.on) {                                       // листва (V2b): пятна цвета, прогретые участки, мягкий просвет
        Object.assign(sh.uniforms, LeU, { uVary: { value: LS.vary }, uLit: { value: LS.lit } });
        sh.fragmentShader = 'uniform float uVary, uLit, uDayL; varying vec3 vWP;\nfloat lh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\nfloat lvn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(lh(i), lh(i + vec2(1., 0.)), f.x), mix(lh(i + vec2(0., 1.)), lh(i + vec2(1., 1.)), f.x), f.y); }\n' + sh.fragmentShader
          .replace('#include <color_fragment>', `#include <color_fragment>
  float leaf = smoothstep(0., .05, diffuseColor.g - max(diffuseColor.r, diffuseColor.b));
  float pn = lvn(vWP.xz * .09) * .65 + lvn(vWP.xz * .33 + 5.) * .35;
  diffuseColor.rgb *= mix(1., .78 + .44 * pn, leaf * uVary);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.1, 1.07, .8), leaf * smoothstep(.55, .8, pn) * uVary * .6);`)
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * leaf * uLit * uDayL;');
      }
    };
    mat.customProgramCacheKey = () => 'wind-' + kind + (LS && LS.on ? '-leaf' : ''); return mat;
  };
  // деревья и камни одним мешем (один вызов отрисовки)
  const rnd = mulberry32(cfg.world.seed), parts = [], treeXZ = [];
  // граница мира: частокол из мёртвых стволов
  for (let i = 0; i < 70; i++) { const a = i / 70 * Math.PI * 2, R = cfg.world.radius + 1.5; addTree(parts, rnd, Math.cos(a) * R, Math.sin(a) * R, cfg.look); }
  // объём слоями (F4): деревья с кроной над тропой — в общий меш (качаются); арки и перекладины ворот — отдельной группой
  const OH = overheadOf(map, cfg), crnd = mulberry32(cfg.world.seed + 31);
  for (const c of OH.canopy) { const k0 = parts.length; addCanopyTree(parts, crnd, c, cfg.look); const gy = Y(c.x, c.z); for (let k = k0; k < parts.length; k++) parts[k].translate(0, gy, 0); treeXZ.push(c.x + c.toX * c.reach, c.z + c.toZ * c.reach); }
  const ohGroup = new THREE.Group();
  { const stone = paintMat(new THREE.MeshLambertMaterial({ color: '#8a857a' }), 'masonry'), stoneD = paintMat(new THREE.MeshLambertMaterial({ color: '#6e6a60' }), 'masonry'), wood = paintMat(new THREE.MeshLambertMaterial({ color: '#5a3e26' }), 'log'), vine = new THREE.MeshLambertMaterial({ color: cfg.look.leaf[1] });
    const box = (g, w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b; };
    for (const a of OH.arches) {
      const g = new THREE.Group(); g.position.set(a.x, Y(a.x, a.z), a.z); g.rotation.y = a.ang; const hs = a.span / 2;
      if (a.kind === 'stone') { for (const s of [-1, 1]) { box(g, .6, a.h, .6, s * hs, a.h / 2, 0, stone); box(g, .8, .3, .8, s * hs, .15, 0, stoneD); } box(g, a.span + .9, .5, .75, 0, a.h + .1, 0, stone); box(g, .65, .75, .8, 0, a.h + .35, 0, stoneD); }
      else { for (const s of [-1, 1]) for (const z of [-.9, .9]) box(g, .22, a.h, .22, s * hs, a.h / 2, z, wood);
        for (const z of [-1.1, -.37, .37, 1.1]) box(g, a.span + .6, .14, .14, 0, a.h, z, wood);
        for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.35 + (i % 3) * .1, 0), vine); m.position.set(-hs + (i / 8) * a.span, a.h + .15, ((i * 7) % 5 - 2) * .45); g.add(m); } }
      ohGroup.add(g);
    }
    scene.add(ohGroup); }
  for (const g of parts) if (!g.attributes.sway) g.setAttribute('sway', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count), 1));     // камни не качаются
  const propsMat = paintMat(WC && WC.on ? windy(new THREE.MeshLambertMaterial({ vertexColors: true }), 'tree') : new THREE.MeshLambertMaterial({ vertexColors: true }), 'nature');     // кора и камень с мхом (T2)
  const props = new THREE.Mesh(mergeGeometries(parts, false), propsMat);     // край мира и деревья над тропой; остальные деревья — по участкам
  // трава (F2): пучок из трёх травинок; строится по участкам вокруг героя, качается по ветру
  const flowerMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const grassOn = !!(WC && WC.on && WC.grass.on), grassMat = grassOn ? windy(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), 'grass') : null;
  const grassGeo = (() => { const H = WC ? WC.grass.h : .7, v = [], col = [], dark = new THREE.Color(cfg.look.leaf[1]), tip = new THREE.Color(cfg.look.leaf[2]).multiplyScalar(1.6);
    for (let b = 0; b < 3; b++) { const a = b * Math.PI / 3, c = Math.cos(a), s = Math.sin(a), lean = (b - 1) * .08;
      v.push(-.11 * c, 0, -.11 * s, .11 * c, 0, .11 * s, lean * s, H * (.8 + b * .12), lean * c); col.push(dark.r, dark.g, dark.b, dark.r, dark.g, dark.b, tip.r, tip.g, tip.b); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals(); return geo; })();
  // участок земли: холмы, пятна света, деревья и камни, трава (траву — кусками 16 м, чтобы отсекалась вне кадра)
  const land = new THREE.Group(), liveLand = new Map(), allSegs = pathSegs(map); scene.add(land);
  const M4 = new THREE.Matrix4(), Q4 = new THREE.Quaternion(), E4 = new THREE.Euler(), P4 = new THREE.Vector3(), S4 = new THREE.Vector3(), C4 = new THREE.Color();
  // постройка участка по частям (C5b): земля → деревья и камни → трава кусками; между частями — следующий кадр
  function* landJob(ci, cj) {
    if (cfg.shapes && cfg.shapes.contact) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (!propsMemo.has((ci + a) + ',' + (cj + b))) { propsAt(ci + a, cj + b); yield; }     // деревья соседей для тени у стволов — по участку за кадр (шаг 7)
    const g = new THREE.Group(), geo = hillsGeo(ci, cj), trees = [];
    { const hm = new THREE.Mesh(geo, hillsMat); hm.receiveShadow = shadowsOn; g.add(hm); }     // земля принимает тени (шаг 14)
    if (lightMat) { const lm = new THREE.Mesh(geo, lightMat); lm.renderOrder = 1; g.add(lm); }
    land.add(g); liveLand.set(ci + ',' + cj, { g, geo, trees }); yield;
    const spots = grassOn || FL ? grassIn(map, cfg, ci, cj, allSegs) : [], cseed = salt => (Math.imul(cfg.world.seed + 1013, 2654435761) ^ Math.imul(ci, 73856093) ^ Math.imul(cj, 19349663) ^ salt) >>> 0; yield;     // места травы — и для цветов и кустов
    const P = propsAt(ci, cj);
    for (let i0 = 0; i0 < P.length; i0 += 24) {                              // в роще деревьев много (G2): по 24 за кадр
      const pp = [];
      for (const q of P.slice(i0, i0 + 24)) { const k0 = pp.length; (q.tree ? addTree : addRock)(pp, mulberry32(q.seed), q.x, q.z, q.bare !== undefined ? { ...cfg.look, bare: q.bare } : cfg.look); const gy = Y(q.x, q.z); for (let k = k0; k < pp.length; k++) pp[k].translate(0, gy, 0); if (q.tree) trees.push(q.x, q.z); }
      if (pp.length) { for (const q of pp) if (!q.attributes.sway) q.setAttribute('sway', new THREE.BufferAttribute(new Float32Array(q.attributes.position.count), 1)); g.add(new THREE.Mesh(mergeGeometries(pp, false), propsMat)); pp.forEach(q => q.dispose()); }
      if (i0 + 24 < P.length) yield;
    }
    if (FL) {                                                                  // кусты: только вид, без столкновений; качаются как кроны
      const x0 = ci * CHUNK, z0 = cj * CHUNK, segs = segsNear(allSegs, x0, x0 + CHUNK, z0, z0 + CHUNK, 4), blds = map.buildings.filter(b => b.x1 > x0 - 4 && b.x0 < x0 + CHUNK + 4 && b.z1 > z0 - 4 && b.z0 < z0 + CHUNK + 4);
      const far = (x, z, c) => !segs.some(([a, b]) => distSeg(x, z, a, b) < c) && !blds.some(b => x > b.x0 - c && x < b.x1 + c && z > b.z0 - c && z < b.z1 + c);
      const pp = []; for (const q of bushesIn(cfg, spots, cseed(41), far)) { const k0 = pp.length; addBush(pp, mulberry32(q.seed), q.x, q.z, q.s, cfg.look); const gy = Y(q.x, q.z); for (let k = k0; k < pp.length; k++) pp[k].translate(0, gy, 0); }
      if (pp.length) { const pm = new THREE.Mesh(mergeGeometries(pp, false), propsMat); pm.castShadow = shadowsOn; g.add(pm); pp.forEach(q => q.dispose()); }
    }
    yield;
    if (grassOn) {
      const cells = new Map();
      spots.forEach((q, i) => { const k = Math.floor(q.x / 16) + ',' + Math.floor(q.z / 16); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(i); });
      let done = 0;
      for (const all of cells.values()) {
        const ids = (Q.grass < 1 ? all.filter(i => (i * .6180339) % 1 < Q.grass) : all).sort((a, b) => (a * .7548776) % 1 - (b * .7548776) % 1); if (!ids.length) continue;     // реже трава на «Низком» (шаг 14); порядок вперемешку — вдали отрезается равномерно
        const m = new THREE.InstancedMesh(grassGeo, grassMat, ids.length);
        ids.forEach((i, j) => { const q = spots[i]; E4.set(0, q.rot, 0); Q4.setFromEuler(E4); P4.set(q.x, Y(q.x, q.z), q.z); S4.set(q.s, q.s, q.s); M4.compose(P4, Q4, S4); m.setMatrixAt(j, M4); if (FL) { const [hh, ss, ll] = grassHSL(q.x, q.z, FL, i); C4.setHSL(hh, ss, ll); } else C4.setHSL(.27 + (i % 7) * .012, .45, .38 + (i % 5) * .04); m.setColorAt(j, C4); });
        m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere(); m.boundingSphere.radius += 1; g.add(m);
        m.userData.full = ids.length; m.userData.cx = m.boundingSphere.center.x; m.userData.cz = m.boundingSphere.center.z; (liveLand.get(ci + ',' + cj).grass ||= []).push(m);
        if (++done % 4 === 0) yield;
      }
    }
    if (FL) {                                                                  // цветы: поляны одного-двух цветов, головка — шестиугольник
      const fl = flowersIn(cfg, spots, cseed(43)), r = FL.flowers.r, v = new Float32Array(fl.length * 18 * 3), col = new Float32Array(fl.length * 18 * 3), nor = new Float32Array(fl.length * 18 * 3);
      fl.forEach((f, n) => { C4.set(f.c); const y = Y(f.x, f.z) + f.h; for (let t = 0; t < 6; t++) { const a0 = t * Math.PI / 3, a1 = a0 + Math.PI / 3, o = (n * 18 + t * 3) * 3;
        v.set([f.x, y, f.z, f.x + Math.cos(a1) * r, y, f.z + Math.sin(a1) * r, f.x + Math.cos(a0) * r, y, f.z + Math.sin(a0) * r], o);
        for (let q = 0; q < 3; q++) { col.set([C4.r, C4.g, C4.b], o + q * 3); nor.set([0, 1, 0], o + q * 3); } } });
      if (fl.length) { const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(v, 3)); fg.setAttribute('color', new THREE.BufferAttribute(col, 3)); fg.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.add(new THREE.Mesh(fg, flowerMat)); }
    }
  }
  const jobs = new Map();
  const buildLand = (ci, cj) => { for (const _ of landJob(ci, cj)); };      // целиком сразу (старт, перенос)
  function dropLand(key) { jobs.delete(key); const L = liveLand.get(key); land.remove(L.g); L.g.traverse(o => { if (o.isMesh && o.geometry !== grassGeo) o.geometry.dispose(); }); liveLand.delete(key); }
  // подгрузка: нужные участки вокруг камеры; если не хватает многих (старт, перенос) — все сразу, иначе по одному за кадр
  const LAND_VIEW = 96;
  function streamLand(x, z) {
    const need = chunksAround(x, z, LAND_VIEW, cfg.world.radius), keys = new Set(need.map(q => q.ci + ',' + q.cj)), miss = need.filter(q => !liveLand.has(q.ci + ',' + q.cj));
    if (miss.length > 4) { for (const [k, j] of jobs) { for (const _ of j); jobs.delete(k); const L = liveLand.get(k); if (L) freeze(L.g); } for (const q of miss) { buildLand(q.ci, q.cj); const L = liveLand.get(q.ci + ',' + q.cj); if (L) freeze(L.g); } }
    else {                                                                    // на ходу: один шаг постройки за кадр, ближний участок — первым
      if (!jobs.size && miss.length) { const q = miss[0], k = q.ci + ',' + q.cj; jobs.set(k, landJob(q.ci, q.cj)); }
      for (const [k, j] of jobs) { if (j.next().done) { jobs.delete(k); const L = liveLand.get(k); if (L) freeze(L.g); } break; }     // участок достроен — матрицы один раз
    }
    for (const key of [...liveLand.keys()]) if (!keys.has(key)) { const [ci, cj] = key.split(',').map(Number), cx = (ci + .5) * CHUNK, cz = (cj + .5) * CHUNK; if (Math.hypot(cx - x, cz - z) > LAND_VIEW + CHUNK * 1.5) dropLand(key); }
  }
  let windNow = { s: 0, dir: [0, 1] };
  // погода (F3): расписание по зерну, капли (отрезки у камеры), круги на воде; всплески — частицами
  const WE = cfg.weather, wsched = WE && WE.on ? makeWeather(cfg.world.seed, WE) : null; let wNow = { kind: 'clear', cloud: 0, rain: 0 }, eff = effectsOf(null, WE || { drops: 0, fog: 0, wet: 1 }), sunBase = 1;
  const rainGroup = new THREE.Group(), dropN = WE ? WE.drops : 0, dropPos = new Float32Array(dropN * 6), dropSeed = mulberry32(cfg.world.seed + 77);
  const drops = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#b8c8d8', transparent: true, opacity: .45, depthWrite: false }));
  drops.geometry.setAttribute('position', new THREE.BufferAttribute(dropPos, 3)); drops.frustumCulled = false; ovl(drops); rainGroup.add(drops);     // капли — на слое меток: в ASCII чёткие струйки поверх символов
  for (let i = 0; i < dropN; i++) dropPos[i * 6 + 1] = -99;                     // все капли «внизу» — родятся сверху при старте дождя
  const ripples = Array.from({ length: WE ? WE.ripples : 0 }, () => { const m = new THREE.Mesh(new THREE.RingGeometry(.8, 1, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#c8dce8', transparent: true, opacity: 0, depthWrite: false })); m.visible = false; rainGroup.add(m); return { m, t: 9 }; });
  scene.add(rainGroup);
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
    palisade.add(new THREE.Mesh(mergeGeometries(logs), paintMat(new THREE.MeshLambertMaterial({ color: '#5a3e26' }), 'log')), new THREE.Mesh(mergeGeometries(tops), new THREE.MeshLambertMaterial({ color: '#3e2a18' })), new THREE.Mesh(mergeGeometries(ring), paintMat(new THREE.MeshLambertMaterial({ color: '#2e2016' }))));
    const posts = [], beams = [], flames = [];
    for (const g of campGates(C)) {
      const a = g.a * Math.PI / 180, w = C.gateW / 2 + .2, tx = Math.cos(a), tz = -Math.sin(a);       // вдоль частокола
      for (const s of [-1, 1]) { const px = g.x + tx * w * s, pz = g.z + tz * w * s; posts.push(new THREE.BoxGeometry(.6, C.h + 1.2, .6).translate(px, (C.h + 1.2) / 2, pz)); flames.push(new THREE.BoxGeometry(.22, .3, .22).translate(px, C.h + 1.45, pz)); }
      beams.push(new THREE.BoxGeometry(C.gateW + 1.2, .4, .5).rotateY(a + Math.PI / 2).translate(g.x, C.h + .9, g.z));
    }
    palisade.add(new THREE.Mesh(mergeGeometries(posts), paintMat(new THREE.MeshLambertMaterial({ color: '#4a3220' }), 'log')), new THREE.Mesh(mergeGeometries(beams), paintMat(new THREE.MeshLambertMaterial({ color: '#3a2618' }))), new THREE.Mesh(mergeGeometries(flames), new THREE.MeshBasicMaterial({ color: '#ffb050' })));
    scene.add(palisade); freeze(palisade);
  }
  const cart = makeCart(); cart.group.visible = false; scene.add(cart.group);   // повозка сказочного торговца
  const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // оживление: жители лагеря, вороны, дым из труб (только вид; числа — cfg.ambient)
  const AMB = cfg.ambient, arnd = mulberry32(cfg.world.seed + 21), life = new THREE.Group();
  const vStops = AMB.on ? villagerStops(map, cfg) : [], villagers = makeVillagers(vStops, AMB.villagers, arnd).map((v, i) => { const m = makeNpc('villager', ['#5a4a3a', '#4a3a4a', '#3a4a3a', '#6a5040', '#4a4436'][i % 5]); life.add(m.group); return { v, m, f: i % 2 ? 'villagerF' : 'villager' }; });
  const crows = (AMB.on ? makeBirds(map, cfg, arnd) : []).map(b => { const m = makeCrow(); m.group.rotation.y = b.face; life.add(m.group); return { b, m }; });
  const swapIn = (old, A, parent) => { A.group.position.copy(old.group.position); A.group.rotation.copy(old.group.rotation); A.group.visible = old.group.visible; parent.remove(old.group); disposeDeep(old.group); parent.add(A.group); return A; };     // своя модель → готовая
  // звери (G2): вокруг героя, где можно стоять — не вода, не дом, не камень, не лагерь, не обрыв
  const BEA = cfg.beasts, beastOk = (x, z) => Math.hypot(x, z) < cfg.world.radius - 4 && !(map.camp && insideCamp(map.camp, x, z, -3)) && !(river && waterDist(river, x, z) < 1.5) && insideOf(map, x, z, 1) < 0 && !map.solids.some(q => Math.abs(q.x - x) < q.r + .6 && Math.abs(q.z - z) < q.r + .6) && !(map.plateaus.length && inCliff(map.plateaus, x, z, 1));
  const beasts = (BEA && BEA.on ? makeBeasts(BEA.n) : []).map(b => { const m = makeBeast(b.kind); m.group.visible = false; life.add(m.group); return { b, m, ms: { [b.kind]: m } }; });     // ms — модели по видам (вид меняется по биому)
  const beastModel = c => { if (!c.ms[c.b.kind]) { const m = ambMake('beast', c.b.kind) || makeBeast(c.b.kind); life.add(m.group); c.ms[c.b.kind] = m; } for (const [k, m] of Object.entries(c.ms)) if (k !== c.b.kind) m.group.visible = false; c.m = c.ms[c.b.kind]; return c.m; };
  // утки на озере, рыба, бабочки и летучие мыши (2026-10-18) — только вид
  const ducks = (BEA && BEA.on && BEA.ducks ? makeDucks(BEA.ducks.n) : []).map(b => { const m = makeBeast('duck'); m.group.visible = false; life.add(m.group); return { b, m }; });
  let fishT = 2;
  const FLY = BEA && BEA.fly, flies = FLY ? new THREE.InstancedMesh(new THREE.BoxGeometry(.16, .02, .1), new THREE.MeshBasicMaterial({ color: '#ffffff' }), FLY.n) : null;
  if (flies) { flies.frustumCulled = false; const cs = ['#f0d070', '#e8a0c8', '#a8d0f0', '#f0f0e8', '#f0a050']; for (let i = 0; i < FLY.n; i++) flies.setColorAt(i, new THREE.Color(cs[i % cs.length])); flies.count = 0; life.add(flies); }
  const flyO = new THREE.Object3D(), flyA = [];     // у каждой бабочки своё место на земле: герой проходит мимо, а не тащит их с собой
  const pipes = AMB.on ? chimneys(map, cfg) : [];
  if (pipes.length) life.add(new THREE.Mesh(mergeGeometries(pipes.map(c => new THREE.BoxGeometry(.5, AMB.chimneyH + .6, .5).translate(c.x, c.y - AMB.chimneyH / 2 + .3, c.z))), new THREE.MeshLambertMaterial({ color: '#3a302a' })));
  const puffN = pipes.length * AMB.smoke, puffs = new THREE.InstancedMesh(new THREE.BoxGeometry(.5, .5, .5), new THREE.MeshBasicMaterial({ color: '#8a8078', transparent: true, opacity: .32, depthWrite: false }), Math.max(1, puffN));
  puffs.count = calm ? 0 : puffN; puffs.frustumCulled = false; life.add(puffs);
  const puffM = new THREE.Matrix4(), puffQ = new THREE.Quaternion(), puffS = new THREE.Vector3(), puffP = new THREE.Vector3();
  scene.add(life);
  // сквозное окно (F4): у героя всё, что ближе к камере (кроны, крыши, частокол, мосты, арки), прорежено узором — герой виден
  const XR = cfg.overhead && cfg.overhead.xray, XU = { uHero: { value: new THREE.Vector3(0, 0, 2) }, uXrR: { value: XR ? XR.r : 0 }, uAsp: { value: 1 }, uXrCut: { value: XR ? XR.cut : 0 } };
  const xray = mat => {
    if (!XR || !XR.on || !mat || mat.userData.xray || mat === waterMat) return; mat.userData.xray = true;
    const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
    mat.onBeforeCompile = (sh, r) => {
      if (prev) prev(sh, r); Object.assign(sh.uniforms, XU);
      sh.vertexShader = 'varying vec3 vXr;\n' + sh.vertexShader.replace(/}\s*$/, '  vXr = gl_Position.xyz / gl_Position.w;\n}');
      sh.fragmentShader = 'uniform vec3 uHero; uniform float uXrR, uAsp, uXrCut; varying vec3 vXr;\nfloat xb2(vec2 a) { a = floor(a); return fract(dot(a, vec2(.5, a.y * .75))); }\n' +
        sh.fragmentShader.replace('void main() {', 'void main() {\n  { vec2 d = vec2((vXr.x - uHero.x) * uAsp, vXr.y - uHero.y); float k = 1. - smoothstep(uXrR * .55, uXrR, length(d)); if (k > 0. && vXr.z < uHero.z && xb2(.5 * gl_FragCoord.xy) * .25 + xb2(gl_FragCoord.xy) < k * uXrCut) discard; }');
    };
    mat.customProgramCacheKey = () => key + '-xray'; mat.needsUpdate = true;
  };
  for (const o of [props, town.group, decor.group, palisade, riverGroup, ohGroup]) if (o) o.traverse(m => { if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach(xray); });
  // море (C3b): за краем мира в секторе побережья — вода до горизонта (берег — край мира)
  const sea = (() => {
    const G = cfg.worldgen; if (!G || !G.on || cfg.world.radius <= G.coreR || !waterMat) return new THREE.Group();
    const R0 = cfg.world.radius - 3, R1 = cfg.world.radius + 260, i = BIOMES.indexOf('coast'), n = BIOMES.length, v = [], idx = [], y = cfg.terrain.water;
    const t0 = i / n - G.turn - .02, t1 = (i + 1) / n - G.turn + .02, K = 48;
    for (let k = 0; k <= K; k++) { const a = (t0 + (t1 - t0) * k / K) * Math.PI * 2; v.push(Math.sin(a) * R0, y, Math.cos(a) * R0, Math.sin(a) * R1, y, Math.cos(a) * R1); if (k) { const q = k * 2; idx.push(q - 2, q - 1, q, q - 1, q + 1, q); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx); g.computeVertexNormals();
    const bank = [], flow = []; for (let k = 0; k <= K; k++) { const a = (t0 + (t1 - t0) * k / K) * Math.PI * 2; bank.push(0, 1e4, R1 - R0, 1e4); flow.push(Math.sin(a) * .3, Math.cos(a) * .3, Math.sin(a) * .3, Math.cos(a) * .3); }     // прибой — к берегу
    g.setAttribute('bank', new THREE.Float32BufferAttribute(bank, 2)); g.setAttribute('flow', new THREE.Float32BufferAttribute(flow, 2));
    const m = new THREE.Mesh(g, waterMat); scene.add(m); return m;
  })();
  // ореолы ночью (V2c): светлые пятна к камере у фонарей и костров (без настоящих источников света); одним вызовом
  const HS = cfg.shaders && cfg.shaders.halo, haloSpots = [];
  for (const d of map.decor) { if (d.t === 'lamp') { const c = Math.cos(d.rot || 0), s = Math.sin(d.rot || 0); haloSpots.push({ x: d.x + .28 * c, y: 2.75, z: d.z - .28 * s, k: 'lamp' }); } else if (d.t === 'campfire') haloSpots.push({ x: d.x, y: .7, z: d.z, k: 'fire' }); }
  for (const f of map.fires || []) haloSpots.push({ x: f.x, y: .7, z: f.z, k: 'fire' });
  const halos = (() => { if (!HS || !HS.on) return null;
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffffff' }), HS.max);
    m.frustumCulled = false; m.count = 0; m.renderOrder = 3; scene.add(m); return m; })();
  const haloC = { lamp: new THREE.Color(HS ? HS.lamp[1] : '#fff'), fire: new THREE.Color(HS ? HS.fire[1] : '#fff') }, haloO = new THREE.Object3D(), haloTmp = new THREE.Color();
  function updateHalos(px, pz, night, t) {
    if (!halos) return; let n = 0;
    if (night > .02) for (const h of haloSpots) { if (n >= HS.max || Math.abs(h.x - px) > HS.near || Math.abs(h.z - pz) > HS.near) continue;
      const sz = HS[h.k][0] * (h.k === 'fire' && !calm ? 1 + .08 * Math.sin(t * 9 + h.x) : 1); haloO.position.set(h.x, h.y + Y(h.x, h.z), h.z); haloO.quaternion.copy(camera.quaternion); haloO.scale.set(sz, sz, 1); haloO.updateMatrix();
      halos.setMatrixAt(n, haloO.matrix); halos.setColorAt(n, haloTmp.copy(haloC[h.k]).multiplyScalar(night * .55)); n++; }
    halos.count = n; halos.instanceMatrix.needsUpdate = true; if (halos.instanceColor) halos.instanceColor.needsUpdate = true;
  }
  // отсечение по расстоянию (C3b): дальние дома, сундуки и клетки декора не рисуются и не обновляются (раз в 0,3 с)
  let cullT = 0;
  function cullFar(x, z) {
    for (const it of town.items) { const far = Math.hypot(it.b.x - x, it.b.z - z) > 120; if (far === it.far) continue; it.far = far; it.walls.visible = it.floor.visible = !far; if (it.glow) it.glow.visible = !far; if (far) it.roof.visible = false; }
    for (const g of decorCells) park(g, Math.hypot(g.userData.cx - x, g.userData.cz - z) >= CL.decor);     // дальний декор — со сцены
    if (curView && curView.conts && curView.conts.items) for (const it of curView.conts.items) park(it.g, Math.hypot(it.c.x - x, it.c.z - z) >= CL.box);     // дальние сундуки — со сцены
    for (const L of liveLand.values()) for (const m of L.grass || []) { const d = Math.hypot(m.userData.cx - x, m.userData.cz - z), k = CL.grass.find(q => d < q[0])[1]; m.count = Math.max(1, Math.round(m.userData.full * k)); }     // трава вдали реже
  }
  const surfaceObjs = [land, sea, riverGroup, sunGroup, rainGroup, ohGroup, life, dome, ground, town.group, decor.group, props, fire.group, ash, palisade, ...npcs.map(n => n.group)];
  const views = new Map(); let shownLvl = null, conts = null, curView = null;
  // второй этаж (2026-10-21): виден мир вокруг, как с первого этажа; этаж — над своим домом на высоте floors.lift
  let liftY = null;
  const floorL = W => { const L = W.levels && W.levels[W.lvl]; return L && L.map && L.map.floor ? L : null; };
  const floorBase = (W, L) => { const b = W.levels.surface.map.buildings[L.map.house]; return heightAt(hf, b.x, b.z) + (cfg.map.floors.lift || 2.6); };
  function showLevel(W) {
    const id = W.lvl, L = W.levels[id], FL = floorL(W);
    if (FL) { const S = W.levels.surface; if (!views.has('surface')) { const v = buildSurfaceView(S, Y); v.map = S.map; scene.add(v.group); views.set('surface', v); } }
    { const old = views.get(id); if (old && old.map !== L.map) { scene.remove(old.group); old.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); views.delete(id); } }     // новый ярус Бездны — новая карта (этап 6)
    if (!views.has(id)) { const v = L.def ? buildLevelView(L, cfg) : buildSurfaceView(L, Y); v.map = L.map; scene.add(v.group); views.set(id, v); }
    for (const [k, v] of views) v.group.visible = k === id || (!!FL && k === 'surface');
    if (FL) views.get(id).group.position.y = floorBase(W, FL);
    const up = !L.def || !!FL; for (const o of surfaceObjs) o.visible = up;
    sun.visible = up; lantern.visible = !up;
    if (!up) { scene.fog.color.set('#070504'); scene.background.set('#070504'); hemi.color.set('#6a5a50'); hemi.groundColor.set('#1a1210'); hemi.intensity = .9; }
    lastLight = -1; shownLvl = id; curView = views.get(id); conts = curView.conts; fx.clear();
  }
  // ободок силуэта (V2c): край фигуры светлее (эмиссия по краю), ночью сильнее — героя и врагов видно в темноте
  const RS = cfg.shaders && cfg.shaders.rim, RimU = { uRim: { value: RS ? RS.day : 0 } };
  const rimify = (root, color) => { if (!RS || !RS.on) return; const c = new THREE.Color(color); root.traverse(o => { const mats = !o.material ? [] : Array.isArray(o.material) ? o.material : [o.material];
    for (const mat of mats) { if (mat.userData.rim || !(mat.isMeshLambertMaterial || mat.isMeshPhongMaterial)) continue; mat.userData.rim = true; const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
      mat.onBeforeCompile = (sh, r) => { if (prev) prev(sh, r); Object.assign(sh.uniforms, RimU, { uRimC: { value: c }, uRimP: { value: RS.pow } });
        sh.fragmentShader = 'uniform float uRim, uRimP; uniform vec3 uRimC;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  { float rimK = pow(1. - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0., 1.), uRimP); totalEmissiveRadiance += uRimC * rimK * uRim; }'); };
      mat.customProgramCacheKey = () => key + '|rim'; mat.needsUpdate = true; } }); };
  let hero = makeHero(); scene.add(hero.group); let heroLook = null, rimKey = '';
  const heroBlade = makeBladeFx(scene), bladeOn = () => !!(cfg.bladeFx && cfg.bladeFx.on);     // стихия на клинке (2026-10-20)
  if (actorKey(cfg, 'hero', 'thorn') !== null || Object.keys((cfg.actors && cfg.actors.foes) || {}).length) preloadActors(cfg);     // готовые модели (2026-10-20): грузятся в фоне
  const kitOf = k => cfg.actors.kits[k];
  loadBaked('buildings').then(lib => { if (!lib) return; setDecorLib(lib); town.setShells(lib);     // постройки KayKit: декор пересобирается, у домов — наружный вид
    const nd = mkDecor(); for (const c of decorCells) { if (c.parent) c.parent.remove(c); c.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); } decorCells.length = 0;
    for (const c of [...nd.group.children]) { decor.group.add(c); decorCells.push(c); c.traverse(m => { if (m.material) [].concat(m.material).forEach(xray); if (m.isMesh && shadowsOn) m.castShadow = true; }); } freeze(decor.group); }).catch(e => console.warn('постройки не загрузились:', e && e.message));
  loadNature().then(lib => { if (!lib) return; setNature(lib); for (const k of [...liveLand.keys()]) dropLand(k); }).catch(e => console.warn('природа не загрузилась:', e && e.message));     // готовые деревья и камни: участки пересобираются
  // жители и звери (2026-10-20): готовая модель по виду, если пришла; tint и рост — по виду
  const ambMake = (g, id, tint) => { const k = actorKey(cfg, g, id); if (!k || !actorReady(k)) return null; const A0 = cfg.actors, h = (A0.sizes || {})[id]; return makeActor(k, { ...kitOf(k), ...(h ? { height: h } : {}), tint: tint || A0.tints[id] }, id); };
  let ambSwapT = 0;
  let horse = makeHorse(); horse.group.visible = false; scene.add(horse.group);     // ездовое животное (этап 6)
  // точки сбора (этап 6): по виду — основа и яркая метка, по одному InstancedMesh на часть (мало вызовов отрисовки); собранная — скрыта до роста
  const NODE_LOOK = { herb: [new THREE.ConeGeometry(.42, .7, 6), '#3e7a30', new THREE.SphereGeometry(.12, 6, 4), '#f0d860', .62], ore: [new THREE.DodecahedronGeometry(.55, 0), '#66666e', new THREE.BoxGeometry(.5, .1, .14), '#e8b040', .45], hide: [new THREE.BoxGeometry(1.1, .4, .6), '#6a4630', new THREE.BoxGeometry(.7, .08, .08), '#e8e0c8', .3] };
  let nodeParts = null, nodeT = 0; const NM = new THREE.Matrix4(), NQ = new THREE.Quaternion(), NS = new THREE.Vector3(), NP = new THREE.Vector3(), NY = new THREE.Vector3(0, 1, 0);
  function updateNodes(W, dt) {
    const L0 = W.levels ? W.levels.surface.map : W.map, list = L0.nodes || []; if (!list.length) return;
    if (!nodeParts) { nodeParts = []; for (const [kind, [g1, c1, g2, c2, ay]] of Object.entries(NODE_LOOK)) { const ns = list.filter(n => n.kind === kind); if (!ns.length) continue;
      const a = new THREE.InstancedMesh(g1, new THREE.MeshLambertMaterial({ color: c1 }), ns.length), b = new THREE.InstancedMesh(g2, new THREE.MeshBasicMaterial({ color: c2 }), ns.length); scene.add(a, b); nodeParts.push({ ns, a, b, ay }); } nodeT = 0; }
    if ((nodeT -= dt) > 0) return; nodeT = .5;
    const under = W.lvl && W.lvl !== 'surface' && !floorL(W);
    for (const P of nodeParts) { P.a.visible = P.b.visible = !under; if (under) continue;
      P.ns.forEach((n, i) => { const k = W.life && W.life.nodes[n.id] > W.t ? 0 : 1, y = Y(n.x, n.z); NQ.setFromAxisAngle(NY, (n.x * 7.3 + n.z) % 6.28); NS.setScalar(k * 1e-3 + k);
        NP.set(n.x, y + .3, n.z); NM.compose(NP, NQ, NS); P.a.setMatrixAt(i, NM); NP.set(n.x, y + P.ay, n.z); NM.compose(NP, NQ, NS); P.b.setMatrixAt(i, NM); });
      P.a.instanceMatrix.needsUpdate = P.b.instanceMatrix.needsUpdate = true; }
  }
  // повозки (этап 6): модель только рядом с героем (дальние — не рисуются)
  const coachEnts = new Map();
  function updateCoaches(W) {
    const L0 = W.levels ? W.levels.surface.map : W.map, p = W.player, under = W.lvl && W.lvl !== 'surface' && !floorL(W);
    for (const c of L0.coaches || []) { const near = !under && Math.hypot(c.x - p.x, c.z - p.z) < 70; let m = coachEnts.get(c.id);
      if (near && !m) { m = makeCart(false); m.group.position.set(c.x, Y(c.x, c.z), c.z); m.group.rotation.y = Math.atan2(-c.x, -c.z) + Math.PI / 2; scene.add(m.group); coachEnts.set(c.id, m); }
      if (m) m.group.visible = near; }
  }
  // тень-двойник Вейла: тёмная копия героя с его клинком
  const MATE_W = { thorn: 'sword', vale: 'dagger', jay: 'bow', irga: 'staff' };     // спутник-герой (этап 4): облик героя и его оружие
  const mateModel = T => { const k = actorKey(cfg, 'hero', T.hero), A = k && makeActor(k, kitOf(k), 'hero'); if (A) { A.setWeapon(MATE_W[T.hero] || 'sword', 'steel'); return A; } const h = makeHero(); h.setLook(heroOf(T.hero).look); h.setWeapon(MATE_W[T.hero] || 'sword', 'steel'); return h; };
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
  const trailS = [], trailC = new THREE.Color(), trailC2 = new THREE.Color(), trailMix = new THREE.Color(), PERK_TRAIL = { fire: FXCOL.fire, frost: FXCOL.frost, venom: FXCOL.venom, storm: FXCOL.storm, rend: FXCOL.bleed, siphon: FXCOL.bleed };
  function updateTrail(W, p, dt) {
    for (const s of trailS) s.age += dt;
    while (trailS.length && trailS[0].age > TRAIL_LIFE) trailS.shift();
    const w = hero.weapon, P = cfg.player, sw = p.swingMul || W.gear.swing || 1, mx = W.wp.mix;
    if (W.wsk && W.wsk.kind === 'tempest' && !calm) for (let i = 0; i < 2; i++) { const a = W.t * 9 + i * Math.PI, el = mx ? (i ? mx.b || mx.a : mx.a) : W.wp.el; fx.emit(p.x + Math.sin(a) * 2.4, .9 + Y(p.x, p.z), p.z + Math.cos(a) * 2.4, 0, .5, 0, el ? ELEMENT_COLOR[el] : '#d8c8a8', .4, 0, .1, true); }     // «Цепная буря»
    if (w && w.tip && mx && !calm && Math.random() < dt * 5) { const t = w.tip.getWorldPosition(new THREE.Vector3()), el = Math.random() < .5 || !mx.b ? mx.a : mx.b; if (!(cfg.bladeFx && cfg.bladeFx.on && hasBladeStyle(el))) fx.emit(t.x, t.y, t.z, (Math.random() - .5) * .3, .4 + Math.random() * .4, (Math.random() - .5) * .3, ELEMENT_COLOR[el], .5, -.2, .06, true); }     // оружие с камнями искрит цветом стихий
    if (w && p.state === 'atk' && hero.family !== 'bow' && hero.family !== 'staff' && trailOn(p.atkT / (P.attackTime * sw), P.attackHitAt / P.attackTime)) {
      hero.group.updateMatrixWorld(true);
      trailS.push({ a: w.base.getWorldPosition(new THREE.Vector3()), b: w.tip.getWorldPosition(new THREE.Vector3()), age: 0 });
      if (trailS.length > TRAIL_N) trailS.shift();
    }
    trail.visible = trailS.length > 1; if (!trail.visible) return;
    const perk = (W.wp.perks || []).find(k => PERK_TRAIL[k]), str = p.heavy ? .6 + .5 * p.heavy : p.fin ? .8 : .5;
    trailC.set(mx ? ELEMENT_COLOR[mx.a] : perk ? PERK_TRAIL[perk] : '#fff1dc'); trailC2.set(mx ? ELEMENT_COLOR[mx.b || mx.a] : trailC);     // сплав: след из двух цветов
    for (let i = 0; i < TRAIL_N; i++) {
      const s = trailS[Math.min(i, trailS.length - 1)], f = Math.max(0, 1 - s.age / TRAIL_LIFE) * str * (i < trailS.length ? 1 : 0), c = trailMix.copy(trailC).lerp(trailC2, i / TRAIL_N);
      trailPos.set([s.a.x, s.a.y, s.a.z, s.b.x, s.b.y, s.b.z], i * 6);
      trailCol.set([0, 0, 0, c.r * f, c.g * f, c.b * f], i * 6);     // у основания гаснет: виден только край размаха
    }
    trailGeo.attributes.position.needsUpdate = true; trailGeo.attributes.color.needsUpdate = true;
  }
  const heroShadow = shadow(.7); scene.add(heroShadow);
  // метки пути (2026-10-20, просьба владельца): шевроны на земле от героя к выбранному заданию (кнопка «Вести» в «Моих»), бегут вперёд
  const PM = cfg.view.pathMarks || { n: 7, step: 2.2, start: 2.4 }, chevGeo = (() => { const s = new THREE.Shape(); s.moveTo(0, .55); s.lineTo(.5, -.15); s.lineTo(.28, -.15); s.lineTo(0, .22); s.lineTo(-.28, -.15); s.lineTo(-.5, -.15); s.closePath(); return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2).rotateY(Math.PI); })();
  const chevMat = new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: .8, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const chevs = new THREE.InstancedMesh(chevGeo, chevMat, PM.n); chevs.frustumCulled = false; chevs.count = 0; scene.add(chevs); const CM = new THREE.Matrix4(), CQ = new THREE.Quaternion(), CP = new THREE.Vector3(), CS = new THREE.Vector3(), CY = new THREE.Vector3(0, 1, 0);
  function updateChevs(W, p, t) {
    const g = W.goal, on = W.goalFocus && g && Number.isFinite(g.x) && W.lvl === 'surface' && !p.dead; if (!on) { chevs.count = 0; return; }
    const dx = g.x - p.x, dz = g.z - p.z, d = Math.hypot(dx, dz); if (d < 5) { chevs.count = 0; return; }
    const ux = dx / d, uz = dz / d, yaw = Math.atan2(ux, uz), ph = calm ? 0 : (t * 1.6) % 1; CQ.setFromAxisAngle(CY, yaw); let n = 0;
    for (let i = 0; i < PM.n; i++) { const r = PM.start + (i + ph) * PM.step; if (r > d - 1.5) break; const x = p.x + ux * r, z = p.z + uz * r, k = Math.min(1, (i + 1 - ph) / 1.5) * (1 - (i + ph) / PM.n) * 1.3;
      CP.set(x, Y(x, z) + .07, z); CS.setScalar(Math.max(.01, 1.25 * k)); CM.compose(CP, CQ, CS); chevs.setMatrixAt(n++, CM); }
    chevs.count = n; chevs.instanceMatrix.needsUpdate = true;
  }
  const ents = new Map(), allyEnts = new Map();
  const markRing = new THREE.Mesh(new THREE.RingGeometry(.86, 1, 6), new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: .9, depthWrite: false, side: THREE.DoubleSide }));
  markRing.rotation.x = -Math.PI / 2; markRing.visible = false; scene.add(markRing);
  const bars = new Map();
  const arcMat = new THREE.MeshBasicMaterial({ color: '#ffd9c0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const arc = new THREE.Mesh(new THREE.CircleGeometry(1, 24), arcMat); arc.rotation.x = -Math.PI / 2; arc.position.y = .08; scene.add(ovl(arc));
  let arcFor = -1, swingFx = 0;
  function arcGeometry(deg) {
    if (arcFor === deg) return;
    arcFor = deg; arc.geometry.dispose();
    const a = deg * Math.PI / 180; arc.geometry = new THREE.CircleGeometry(1, 24, -Math.PI / 2 - a / 2, a);     // центр на −90°: после поворота на землю и rotation.z = face — вперёд по взгляду (было +90° — дуга за спиной)
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
    if (v.boss || v.elite) { const k = v.boss ? 2.4 : 1.4; fx.flash(v.x, 1.4 * s, v.z, 2.2 * k, v.boss ? '#fff4d8' : '#ffd27a'); fx.ash(v.x, 1, v.z, Math.round(30 * k)); }     // элита и босс — ярче (этап 1 «круче»)
  }
  function levelFx(v) {                                              // новый уровень: кольцо по земле и столб искр вверх (только вид)
    const gy = Y(v.x, v.z);
    for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; fx.emit(v.x + Math.cos(a) * .4, gy + .15, v.z + Math.sin(a) * .4, Math.cos(a) * 6, .4, Math.sin(a) * 6, '#ffd27a', .5, 0, .22, true); }
    for (let i = 0; i < 40; i++) fx.emit(v.x + (Math.random() - .5) * .6, gy + .2 + Math.random() * .6, v.z + (Math.random() - .5) * .6, (Math.random() - .5) * .6, 4 + Math.random() * 5, (Math.random() - .5) * .6, i % 3 ? '#ffd27a' : '#fff4d8', .9, -2, .2, true);
    fx.flash(v.x, gy + 1.2, v.z, 3, '#ffd27a');
  }

  function shadow(r) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 14), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: .5, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = .03; return m;
  }

  // статусы (V1): частицы горения, инея, яда, крови; звёзды оглушения; ледяные шипы у ног замороженного
  const SKINDS = ['burn', 'freeze', 'poison', 'bleed', 'wet', 'shock', 'crack'];
  function statusFx(holder, st, x, y, z, h, sc, dt) {
    holder.acc = holder.acc || {};
    for (const k of SKINDS) {
      if (!st || !st[k]) { holder.acc[k] = 0; continue; }
      const r = emitCount(holder.acc[k] || 0, RATE[k] * sc * (calm ? .5 : 1), dt); holder.acc[k] = r.acc;
      for (let i = 0; i < r.n; i++) { const q = statusPart(k, Math.random, h); fx.emit(x + q.dx * sc, y + q.dy, z + q.dz * sc, q.vx, q.vy, q.vz, q.color, q.life, q.g, q.s * Math.max(1, sc * .8), q.add); if (k === 'bleed' && Math.random() < .12) fx.decal(x + q.dx, z + q.dz, .25, BLOOD); }
    }
  }
  const starGeo = new THREE.BoxGeometry(.22, .22, .06), starMat = new THREE.MeshBasicMaterial({ color: '#ffe27a' }); starGeo.userData.shared = starMat.userData.shared = true;
  const iceGeo = new THREE.ConeGeometry(.17, 1.0, 4), iceMat = new THREE.MeshLambertMaterial({ color: '#cfefff', emissive: '#3a6a8a', transparent: true, opacity: .8 }); iceGeo.userData.shared = iceMat.userData.shared = true;
  function statusMarks(en, st, x, y, z, sc, dt, t) {
    const stun = st && st.stun, fr = st && st.freeze;
    if (stun && !en.stars) { en.stars = new THREE.Group(); for (let i = 0; i < 3; i++) en.stars.add(new THREE.Mesh(starGeo, starMat)); scene.add(en.stars); }
    if (en.stars) { en.stars.visible = !!stun; if (stun) { en.stars.position.set(x, y + 2.15 * sc, z); en.stars.children.forEach((m, i) => { const q = stunStar(i, 3, calm ? 0 : t, .42 * sc); m.position.set(q.x, q.y, q.z); m.rotation.set(0, 0, t * 6 + i); m.quaternion.premultiply(camera.quaternion); }); } }
    if (fr && !en.ice) { en.ice = new THREE.Group(); for (let i = 0; i < 7; i++) { const c = new THREE.Mesh(iceGeo, iceMat), a = i / 7 * Math.PI * 2 + i, r = .35 + (i % 3) * .12; c.position.set(Math.cos(a) * r, .25, Math.sin(a) * r); c.rotation.set(Math.sin(a) * .5, 0, -Math.cos(a) * .5); c.scale.setScalar(.7 + (i % 4) * .2); en.ice.add(c); } en.iceK = 0; scene.add(en.ice); }
    if (en.ice) { en.iceK = Math.max(0, Math.min(1, en.iceK + (fr ? dt * 6 : -dt * 3))); en.ice.visible = en.iceK > 0; if (en.ice.visible) { en.ice.position.set(x, y, z); en.ice.scale.setScalar(sc * en.iceK); } }
  }
  // враг вне кадра: спрятать модель, тень, кольца, звёзды, лёд и полоску (анимация не идёт)
  function hideEnt(id, en) { if (en.hid) return; en.hid = true; en.m.group.visible = en.sh.visible = en.ring.visible = false; if (en.elite) en.elite.visible = false; if (en.stars) en.stars.visible = false; if (en.ice) en.ice.visible = false; const b = bars.get(id); if (b) b.g.visible = false; }
  // убрать и освободить модель врага (умер, исчез или далеко); при возвращении в кадр соберётся заново
  function dropEnt(id, en) { if (en.m.gltf) disposeActor(en.m); scene.remove(en.m.group, en.sh, en.ring); disposeDeep(en.m.group); disposeDeep(en.sh); disposeDeep(en.ring); if (en.elite) { scene.remove(en.elite); disposeDeep(en.elite); } if (en.stars) scene.remove(en.stars); if (en.ice) scene.remove(en.ice); ents.delete(id); const b = bars.get(id); if (b) { scene.remove(b.g); disposeDeep(b.g); bars.delete(id); } }
  function entity(e) {
    let en = ents.get(e.id);
    if (!en) {
      const fk = actorKey(cfg, 'foe', e.type), m = (fk && makeActor(fk, { ...kitOf(fk), tint: cfg.actors.tints[e.type] }, e.type)) || makeMonster(e.type, cfg), sh = shadow(.55 * cfg.enemies[e.type].scale); rimify(m.group, RS && RS.foe); if (shadowsOn) { m.group.traverse(o => { if (o.isMesh) o.castShadow = true; }); sh.visible = false; }
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

  // ---- размеры: гладкий вид — полное разрешение до dprMax; «Ретро» — маленькое разрешение, растянутое без сглаживания ----
  let cssW = 1, cssH = 1, retro = false, dprMax = cfg.view.smooth ? cfg.view.smooth.dprMax.desk : 1;
  // качество (шаг 14): пресет и доля разрешения («Авто» меняет её по кадрам); тени — только в гладком виде
  let Q = { scale: 1, grass: 1, shafts: true, shadows: false }, resScale = 1, shadowsOn = false;
  function applyShadows() {
    const on = shadowsOn && !retro && !asciiOn; if (gl.shadowMap.enabled === on && sun.castShadow === on) return;
    gl.shadowMap.enabled = on; sun.castShadow = on;
    const cast = o => { if (o.isMesh && !o.isInstancedMesh) o.castShadow = on; };
    for (const g of [town.group, decor.group, props, palisade, hero.group]) if (g) g.traverse(cast);
    for (const n of npcs) n.group.traverse(cast);
    for (const en of ents.values()) { en.m.group.traverse(cast); en.sh.visible = !on; }
    land.traverse(o => { if (!o.isMesh) return; if (o.material === hillsMat) o.receiveShadow = on; else if (o.material === propsMat) o.castShadow = on; });
    heroShadow.visible = !on;
    scene.traverse(o => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });     // шейдеры с тенями и без — разные
  }
  function setQuality(id, desk) {
    const nq = qualityOf(cfg, id, desk), regrow = nq.grass !== Q.grass; Q = nq; resScale = nq.scale; shadowsOn = nq.shadows; setPaintLevel(nq.paint ?? 1);
    if (regrow) for (const k of [...liveLand.keys()]) dropLand(k);     // густота травы — при постройке участка: перестроить
    applyShadows(); resize();
  }
  function applyLook() {                                              // тональная кривая и фильтр земли по виду
    const smooth = !retro && !asciiOn;
    gl.toneMapping = smooth ? THREE.AgXToneMapping : THREE.NoToneMapping; gl.toneMappingExposure = smooth && cfg.view.smooth ? cfg.view.smooth.exposure : 1;
    for (const t of [gtex, gtex2]) { t.minFilter = smooth || asciiOn ? THREE.LinearMipmapLinearFilter : THREE.NearestFilter; t.magFilter = smooth ? THREE.LinearFilter : THREE.NearestFilter; t.needsUpdate = true; }
    canvas.classList.toggle('retro', retro && !asciiOn);
  }
  applyLook();
  function resize(w, h) {
    cssW = w || cssW; cssH = h || cssH;
    if (asciiOn) {                                                    // ASCII: холст в родной плотности экрана (до view.ascii.dpr), сцена — в клетки
      const dpr = Math.min(cfg.view.ascii.dpr, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1);
      if (!ascii || ascii.dpr !== dpr) { if (ascii) ascii.dispose(); ascii = createAscii(gl, cfg, calm, dpr); }
      const w = Math.max(8, Math.floor(cssW * dpr)), h = Math.max(8, Math.floor(cssH * dpr)); gl.setSize(w, h, false); ascii.resize(w, h);
    } else if (retro) { const ps = Math.max(1, Math.round(cfg.view.pixelScale)); gl.setSize(Math.max(8, Math.floor(cssW / ps)), Math.max(8, Math.floor(cssH / ps)), false); }
    else { const dpr = Math.min(dprMax, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1) * resScale; gl.setSize(Math.max(8, Math.floor(cssW * dpr)), Math.max(8, Math.floor(cssH * dpr)), false); }     // гладкий вид
    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    camera.aspect = cssW / cssH; camera.updateProjectionMatrix();
  }
  const cam = { x: 0, z: 8, y: 0, init: false };
  const screen = new THREE.Vector3();

  // точка земли под экранной точкой (sx, sy) на высоте y0: прицел по курсору
  const RC = new THREE.Raycaster(), NDC = new THREE.Vector2(), GP = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), HIT = new THREE.Vector3();
  function groundAt(sx, sy, y0 = hero.group.position.y) { NDC.set(sx / cssW * 2 - 1, -(sy / cssH) * 2 + 1); RC.setFromCamera(NDC, camera); GP.constant = -y0; return RC.ray.intersectPlane(GP, HIT) ? { x: HIT.x, z: HIT.z } : null; }
  function project(x, y, z) {
    screen.set(x, y, z).project(camera);
    return { x: (screen.x * .5 + .5) * cssW, y: (-screen.y * .5 + .5) * cssH, vis: screen.z < 1 };
  }

  // молния между врагами и расходящееся кольцо: короткие эффекты из пула
  const fxPool = []; let tomb = null; const heroFx = {};
  // молния (V1): ломаная с ветками — тонкая белая сердцевина и широкое жёлтое свечение, вспышка и искры у цели
  const boltO = new THREE.Object3D();
  function boltGeo(L, w) {
    const parts = [];
    for (const pts of [L.main, ...L.branches]) for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) || .01, g = new THREE.BoxGeometry(w, w, len + w);
      boltO.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); boltO.lookAt(b.x, b.y, b.z); boltO.updateMatrix(); g.applyMatrix4(boltO.matrix); parts.push(g);
    }
    const m = mergeGeometries(parts, false); parts.forEach(g => g.dispose()); return m;
  }
  function zap(x1, z1, x2, z2, col = '#fff2a0', col2 = '#ffc840', wk = 1) {     // col, col2, wk — цвет, ореол и толщина (копьё бездны — фиолетовое и толще)
    const a = { x: x1, y: 1.2 + Y(x1, z1), z: z1 }, b = { x: x2, y: 1.2 + Y(x2, z2), z: z2 }, L = lightning(a, b, Math.random);
    const core = new THREE.Mesh(boltGeo(L, .09 * wk), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .85, depthWrite: false, blending: THREE.AdditiveBlending }));     // без белой сердцевины (шаг 4)
    const halo = new THREE.Mesh(boltGeo(L, .34 * wk), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .8, depthWrite: false, blending: THREE.AdditiveBlending }));
    const outer = new THREE.Mesh(boltGeo(L, .8 * wk), new THREE.MeshBasicMaterial({ color: col2, transparent: true, opacity: .3, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(core, halo, outer); fxPool.push({ m: core, t: .25, kind: 'bolt' }, { m: halo, t: .25, kind: 'bolt' }, { m: outer, t: .25, kind: 'bolt' });
    fx.flash(b.x, b.y, b.z, 1.8, '#fff6c0');
    for (let i = 0; i < 12; i++) { const q = statusPart('shock', Math.random, 1); fx.emit(b.x, b.y - .4 + q.dy * .5, b.z, q.vx * 1.4, q.vy + 1, q.vz * 1.4, q.color, q.life * 2, 9, .07, true); }
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
  // лужи боссов (этап 5): «не стой в огне» — диск с ободом, гаснет к концу
  const poolMeshes = [0, 1, 2, 3, 4, 5, 6, 7].map(() => { const m = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ color: '#ff5a1a', transparent: true, opacity: .45, depthWrite: false, side: THREE.DoubleSide }));
    m.add(new THREE.Mesh(new THREE.RingGeometry(.92, 1, 32), new THREE.MeshBasicMaterial({ color: '#ffb040', transparent: true, opacity: .85, depthWrite: false, side: THREE.DoubleSide }))); m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(ovl(m)); return m; });
  // стрелы и пятна колдовства: небольшие пулы мешей
  const projMeshes = [], hazMeshes = [];
  // капканы и круги града стрел (умения Сойки)
  const trapMeshes = [0, 1, 2, 3].map(() => { const g = new THREE.Group(), mt = new THREE.MeshLambertMaterial({ color: '#6a6458' }); for (const s of [-1, 1]) { const j = new THREE.Mesh(new THREE.BoxGeometry(.9, .12, .12), mt); j.position.set(0, .08, s * .22); g.add(j); for (let k = -2; k <= 2; k++) { const t = new THREE.Mesh(new THREE.BoxGeometry(.06, .14, .06), mt); t.position.set(k * .18, .16, s * .16); g.add(t); } } g.add(new THREE.Mesh(new THREE.BoxGeometry(.3, .05, .3), new THREE.MeshLambertMaterial({ color: '#3a2a1a' }))); g.visible = false; scene.add(g); return g; });
  // области реакций стихий: диск цвета смеси и частицы (пар, лава, гололёд, трясина, отравленный источник)
  const EZ = { cloud: ['#4a8a30', '#9ae070', .6], steam: ['#e8eef2', '#ffffff', 2.2], lava: ['#e2683a', '#ffb040', 1.4], glaze: ['#bfe8ff', '#e8f8ff', .3], bog: ['#5a4a2e', '#8a7a4e', .2], spring: ['#5a9a40', '#a8f070', .8] };
  // прицел умения по площади (2026-10-20): круг удара под мышью и тонкий круг дальности вокруг героя; ok=false — точка дальше дальности (прижата)
  const aimFill = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: '#ffe8b0', transparent: true, opacity: .26, side: THREE.DoubleSide, depthWrite: false }));
  const aimEdge = new THREE.Mesh(new THREE.RingGeometry(.94, 1, 64), new THREE.MeshBasicMaterial({ color: '#ffe8b0', transparent: true, opacity: .85, side: THREE.DoubleSide, depthWrite: false }));
  const aimRange = new THREE.Mesh(new THREE.RingGeometry(.985, 1, 96), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .25, side: THREE.DoubleSide, depthWrite: false }));
  for (const m of [aimFill, aimEdge, aimRange]) { m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 5; scene.add(ovl(m)); }
  function setAim(o) {
    for (const m of [aimFill, aimEdge, aimRange]) m.visible = !!o; if (!o) return;
    const c = GCOL[o.el] || '#ffe8b0'; aimFill.material.color.set(c); aimEdge.material.color.set(c);
    const y = Y(o.x, o.z) + .08; aimFill.position.set(o.x, y, o.z); aimEdge.position.set(o.x, y + .01, o.z); aimFill.scale.setScalar(o.r); aimEdge.scale.setScalar(o.r);
    aimEdge.material.opacity = .65 + Math.sin(performance.now() / 160) * .2;
    aimRange.position.set(o.px, Y(o.px, o.pz) + .07, o.pz); aimRange.scale.setScalar(o.range);
  }
  const ezMeshes = [0, 1, 2, 3, 4, 5].map(() => { const m = new THREE.Mesh(new THREE.CircleGeometry(1, 36), new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: .3, side: THREE.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(ovl(m)); return m; });
  const zoneMeshes = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(.92, 1, 40), new THREE.MeshBasicMaterial({ color: '#eef4ff', transparent: true, opacity: .55, side: THREE.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.add(new THREE.Mesh(new THREE.CircleGeometry(.92, 40), new THREE.MeshBasicMaterial({ color: '#cfe6ff', transparent: true, opacity: .18, side: THREE.DoubleSide, depthWrite: false }))); m.visible = false; scene.add(ovl(m)); return m; });     // вьюга: кольцо и голубая заливка
  // умения Ирги заметнее (2026-10-18): падающий метеор, пузырь щита маны; вьюга и облако — гуще
  const meteorMeshes = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.75, 0), new THREE.MeshBasicMaterial({ color: '#ff7a20', fog: false })); m.visible = false; scene.add(ovl(m)); return m; });
  const shieldBubble = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 1), new THREE.MeshBasicMaterial({ color: '#6a7aff', transparent: true, opacity: .3, depthWrite: false })); shieldBubble.visible = false; scene.add(shieldBubble);
  for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(.14, .14, .9), new THREE.MeshBasicMaterial({ color: '#ffd27a' })); m.visible = false; m.userData.k = 'foe'; scene.add(m); projMeshes.push(m); }
  for (let i = 0; i < 6; i++) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(.94, 1, 40), new THREE.MeshBasicMaterial({ color: '#d060ff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 36), new THREE.MeshBasicMaterial({ color: '#8a30c0', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    for (const m of [ring, disc]) { m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(ovl(m)); }
    ring.position.y = .1; disc.position.y = .08; hazMeshes.push({ ring, disc });
  }
  function updateFoes(W, t) {
    trapMeshes.forEach((g, i) => { const tp = W.traps[i]; g.visible = !!tp; if (tp) g.position.set(tp.x, Y(tp.x, tp.z), tp.z); });
    ezMeshes.forEach((m, i) => { const zn = W.ezones && W.ezones[i]; m.visible = !!zn; if (!zn) return; const c = EZ[zn.kind] || EZ.steam; m.material.color.set(c[0]); m.material.opacity = (zn.kind === 'steam' ? .22 : .38) * Math.min(1, zn.t * 2); m.position.set(zn.x, .05 + Y(zn.x, zn.z), zn.z); m.scale.setScalar(zn.r);
      for (let k = 0; k < (zn.kind === 'cloud' && !calm ? 3 : 1); k++) if (Math.random() < .6) { const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * zn.r, px = zn.x + Math.cos(a) * r, pz = zn.z + Math.sin(a) * r; fx.emit(px, .2 + Y(px, pz), pz, 0, c[2], 0, c[1], zn.kind === 'steam' ? 1.2 : .7, zn.kind === 'steam' ? -.4 : 1, zn.kind === 'steam' ? .35 : zn.kind === 'cloud' ? .26 : .09, zn.kind === 'lava'); } });
    zoneMeshes.forEach((m, i) => { const zn = W.zones[i]; m.visible = !!zn; if (zn) { m.position.set(zn.x, .06 + Y(zn.x, zn.z), zn.z); m.scale.setScalar(zn.r); { const c = zn.el ? GCOL[zn.el] || '#eef4ff' : '#eef4ff'; if (m.userData.c !== c) { m.userData.c = c; m.material.color.set(c); } }     // поле нового умения — цвет стихии
      if (zn.el && !zn.snow && !calm) for (let k = 0; k < 3; k++) { const a = Math.random() * 6.283, rr = Math.sqrt(Math.random()) * zn.r, px = zn.x + Math.cos(a) * rr, pz = zn.z + Math.sin(a) * rr; fx.emit(px, .2 + Y(px, pz), pz, 0, zn.el === 'blood' ? .4 : 2.2, 0, GCOL[zn.el] || '#ffe8b0', .6, 0, .12, true); }
      if (!zn.el || zn.snow) for (let k = 0; k < (calm ? 1 : zn.snow ? 4 : 1); k++) { const a = Math.random() * 6.283, rr = Math.sqrt(Math.random()) * zn.r, px = zn.x + Math.cos(a) * rr, pz = zn.z + Math.sin(a) * rr; fx.emit(px, 3.5 + Math.random() * 1.5 + Y(px, pz), pz, Math.sin(t * 3 + a) * 1.2, -3.2, Math.cos(t * 3 + a) * 1.2, '#eef4ff', 1.1, 0, .11, true); } } });     // вьюга: снег кружит по всему кругу
    meteorMeshes.forEach((m, i) => { const q = W.meteors && W.meteors[i]; m.visible = !!q && (q.lvl || 'surface') === (W.lvl || 'surface'); if (!m.visible) return; const D = cfg.abilities.irga.meteor.delay, k = Math.max(0, q.t / D), gy = Y(q.x, q.z);     // метеор падает за время задержки
      m.position.set(q.x - k * 5, gy + .6 + k * 16, q.z - k * 3); m.rotation.set(t * 5, t * 3, 0); if (!calm) for (let n = 0; n < 3; n++) fx.emit(m.position.x, m.position.y, m.position.z, (Math.random() - .5) * 1.5 + 2, Math.random() * 1.5 + 3, (Math.random() - .5) * 1.5 + 1, n ? '#ff8a30' : '#ffe27a', .5, 0, .16, true); });
    { const on = !!(W.abuf && W.abuf.mshield > 0); shieldBubble.visible = on; if (on) { const p = W.player; shieldBubble.position.set(p.x, 1.1 + Y(p.x, p.z), p.z); shieldBubble.rotation.y = t * .6; shieldBubble.material.opacity = calm ? .3 : .28 + Math.sin(t * 5) * .07; } }     // щит маны — пузырь вокруг героя
    projMeshes.forEach((m, i) => { const q = W.proj[i]; m.visible = !!q; if (q) { const k = q.friendly ? q.kind : 'foe', kc = k + (q.el || ''); if (m.userData.k !== kc) { m.userData.k = kc; m.material.color.set(q.el && GCOL[q.el] ? GCOL[q.el] : k === 'foe' ? '#ffd27a' : k === 'bolt' ? '#b8c4d8' : k === 'venom' ? '#7ad060' : k === 'orb' ? '#c8a8ff' : '#eef4ff'); m.scale.set(k === 'bolt' ? 1.4 : k === 'orb' ? 3.2 : 1, k === 'bolt' ? 1.4 : k === 'orb' ? 3.2 : 1, k === 'bolt' ? .8 : k === 'orb' ? .3 : 1); }
        if (k === 'orb' && !calm && Math.random() < .7) { const c = q.el && GCOL[q.el] ? GCOL[q.el] : q.fx ? FXCOL[q.fx] || '#b48aff' : '#b48aff'; fx.emit(q.x, 1.1 + Y(q.x, q.z), q.z, (Math.random() - .5) * .6, .3, (Math.random() - .5) * .6, c, .35, 0, .09, true); } m.position.set(q.x, 1.1 + Y(q.x, q.z), q.z); m.rotation.y = Math.atan2(q.vx, q.vz); } });     // свои стрелы светлые, болт толще     // сфера оставляет искры
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
    poolMeshes.forEach((m, i) => { const z = W.bzones && W.bzones[i]; m.visible = !!z && z.lvl === W.lvl; if (!m.visible) return; m.position.set(z.x, .07 + Y(z.x, z.z), z.z); m.scale.setScalar(z.r); m.material.opacity = Math.min(.45, z.t * .3) * (.85 + .15 * Math.sin(t * 6 + i)); });
    for (const e of W.enemies) {
      if (!e.boss || e.dead || !e.b || (e.b.state !== 'wind' && e.b.state !== 'beam')) continue;
      const a = e.b.atk, k = Math.min(1, a.t / a.wind), pulse = .25 + .25 * Math.sin(t * 30) + .2 * k, live = e.b.state === 'beam';
      const col = a.kind === 'cast' ? '#b05aff' : live ? '#ffb040' : '#ff3a2a'; for (const m of [teleRing, teleDisc, teleLine]) m.material.color.set(col);
      if (a.kind === 'beam') {     // луч (этап 5): замах — тонкая линия к цели, потом яркий горящий луч
        const x = live ? e.x : a.x, z = live ? e.z : a.z;
        teleLine.visible = true; teleLine.scale.set(live ? a.width : a.width * .5, a.len, 1); teleLine.position.set(x + a.dx * a.len / 2, .09 + Y(x, z), z + a.dz * a.len / 2);
        teleLine.rotation.order = 'YXZ'; teleLine.rotation.set(-Math.PI / 2, Math.atan2(a.dx, a.dz), 0); teleLine.material.opacity = live ? .7 + .2 * Math.sin(t * 40) : pulse;
      } else if (a.kind === 'cast') {     // чтение: кольцо вокруг босса растёт — успейте сбить
        teleRing.visible = true; teleRing.position.set(e.x, .09 + Y(e.x, e.z), e.z); teleRing.scale.setScalar(3 + 4 * k); teleRing.material.opacity = .9;
        teleDisc.visible = true; teleDisc.position.set(e.x, .08 + Y(e.x, e.z), e.z); teleDisc.scale.setScalar(3 + 4 * k); teleDisc.material.opacity = pulse * .5;
      } else if (a.kind === 'charge') {
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
      if (f.kind === 'bolt' && f.m.material.transparent) f.m.material.opacity = (f.m.material.color.g > .9 ? .8 : .3) * (calm ? 1 : .55 + .45 * Math.random());     // молния мерцает (без мерцания при «уменьшить движение»)
      if (f.t <= 0) { scene.remove(f.m); f.m.geometry.dispose(); f.m.material.dispose(); fxPool.splice(i, 1); }
    }
  }

  let feelZoom = 0, cine = null, cineA = 0, cineT = 0;
  const cf = { x: 0, z: 0 };     // «кинокамера» сцен (этап 5 «круче»): точка, куда смотрит камера в разговоре
  function render(W, dt) {
    const t = W.t, p = W.player;
    // камера: плавно следует за героем под заданным углом
    const FL = floorL(W); groundOn = W.lvl === 'surface' || !!FL; liftY = FL ? floorBase(W, FL) : null;
    if (!cam.init) { cam.x = p.x; cam.z = p.z; cam.y = Y(p.x, p.z); cam.init = true; }
    const now = performance.now() / 1000, rdt = Math.min(.1, Math.max(0, now - (cineT || now))), C = cfg.view.cine; cineT = now;     // разговор идёт при паузе — время настоящее
    cineA += ((cine ? 1 : 0) - cineA) * (1 - Math.exp(-C.ease * rdt)); if (cineA < .002) cineA = 0;
    if (cine) { const kc = 1 - Math.exp(-C.follow * rdt); cf.x += (cine.x - cf.x) * kc; cf.z += (cine.z - cf.z) * kc; } else { cf.x = cam.x; cf.z = cam.z; }
    const k = 1 - Math.exp(-cfg.view.camFollow * dt), cfx = p.x + (cf.x - p.x) * cineA, cfz = p.z + (cf.z - p.z) * cineA, ka = cineA > 0 ? Math.max(k, 1 - Math.exp(-C.follow * rdt)) : k;
    cam.x += (cfx - cam.x) * ka; cam.z += (cfz - cam.z) * ka; cam.y += ((liftY ?? Y(p.x, p.z)) - cam.y) * (cfg.view.blend ? 1 - Math.exp(-cfg.view.blend.camY * dt) : k);     // высота над холмами — медленнее (шаг 3)
    const ca = calm ? 0 : cineA, pitch = (cfg.view.camPitch - C.pitch * ca) * Math.PI / 180, dist = cfg.view.camDist * (1 - feelZoom) * (1 - C.dist * ca);     // наезд камеры на убийстве босса и уровне (этап 1 «круче»)
    const FV = cfg.fx.view, sh = calm || !FV ? 0 : W.shake * FV.amp, wt = performance.now() / 1000;     // тряска — плавная (шаг 4), при «уменьшить движение» — нет
    camera.fov = cfg.view.fov; camera.updateProjectionMatrix();
    const yaw = cfg.view.camYaw * Math.PI / 180, hd = Math.cos(pitch) * dist;
    camera.position.set(cam.x + Math.sin(yaw) * hd + sh * (Math.sin(wt * FV.f[0] * 6.283) + .5 * Math.sin(wt * FV.f[1] * 6.283 + 1.3)) / 3, Math.sin(pitch) * dist + cfg.view.camLookUp + cam.y + sh * (Math.sin(wt * FV.f[1] * 6.283 + .7) + .5 * Math.sin(wt * FV.f[0] * 6.283 + 2.1)) / 3, cam.z + Math.cos(yaw) * hd);
    camera.lookAt(cam.x, cfg.view.camLookUp + cam.y, cam.z);
    camera.updateMatrixWorld(); PV.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); FR.setFromProjectionMatrix(PV);     // что в кадре
    if (sun.castShadow && SHD) {                                      // карта теней — за героем, шаг в тексель (тень не дрожит)
      const tx = 2 * SHD.span / SHD.size; shT.set(cam.x, cam.y, cam.z);
      const a = Math.round(shT.dot(shR) / tx) * tx, b = Math.round(shT.dot(shU) / tx) * tx, c = shT.dot(sunDir);
      shT.copy(shR).multiplyScalar(a).addScaledVector(shU, b).addScaledVector(sunDir, c);
      sun.target.position.copy(shT); sun.position.copy(shT).addScaledVector(sunDir, SHD.dist); sun.target.updateMatrixWorld();
    }
    if (W.lvl !== shownLvl || (views.get(W.lvl) && views.get(W.lvl).map !== W.map)) showLevel(W);
    const under = W.lvl !== 'surface' && !FL;
    if (!under) { streamLand(cam.x, cam.z); if ((cullT -= dt) <= 0) { cullT = .3; cullFar(cam.x, cam.z); } }     // участки земли (C3a), дальнее — скрыть (C3b)
    dome.position.set(cam.x, 0, cam.z);                              // небо — вокруг камеры (мир шире купола)
    { const k = actorKey(cfg, 'hero', W.hero); if ((k || '') !== (hero.key || '')) { const A = k && makeActor(k, kitOf(k), 'hero'); if (A || !k) { scene.remove(hero.group); if (hero.gltf) disposeActor(hero); disposeDeep(hero.group); hero = A || makeHero(); hero.key = k || ''; scene.add(hero.group); heroLook = null; rimKey = ''; if (shadowsOn) hero.group.traverse(o => { if (o.isMesh) o.castShadow = true; }); } } }     // готовая модель героя пришла или герой сменился
    { const cp = W.ach && W.ach.cape, lk = lookKey(W.hero, W.inv, cp); if (lk !== heroLook) { heroLook = lk; hero.setLook(dressedLook(heroOf(W.hero).look, W.inv, cp)); } }     // облик по надетому и цвет плаща — награда подвига
    if (wsched) { wNow = WE.force ? { kind: WE.force, cloud: WE.force === 'clear' ? 0 : WE.force === 'cloudy' ? .7 : 1, rain: WE.force === 'rain' ? 1 : 0 } : weatherAt(wsched, W.t, WE); eff = effectsOf(wNow, WE); }
    scene.fog.density = under ? cfg.view.fogDensity * (String(W.lvl).startsWith('up:') ? .5 : 2.2) : cfg.view.fogDensity * (AMB.on ? fogMul(W.t, cfg.daynight, AMB) : 1) * eff.fog;     // в дождь туман гуще     // на рассвете туман гуще
    if (under) { lantern.position.set(p.x, 3.2, p.z); if (curView.flame) curView.flame.material.color.setHSL(.08, 1, .55 + .08 * Math.sin(t * 13)); if (curView.update) curView.update(W, t); }
    else if (Math.abs(W.light - lastLight) > .004) {                  // небо, свет и туман по времени суток
      lastLight = W.light; const k = skyAt(W.light, cfg.daynight.sky);
      scene.fog.color.set(k.fog); scene.background.set(k.fog);
      hemi.color.set(k.hemiSky); hemi.groundColor.set(k.hemiGround); hemi.intensity = k.hemiI;
      sun.color.set(k.sun); sun.intensity = k.sunI; sunBase = k.sunI; dome.material.color.set(k.dome);
    }
    if (!under) { sun.intensity = sunBase * (1 - .45 * wNow.cloud); hillsMat.color.setScalar(eff.wet); ground.material.color.setScalar(eff.wet); }     // облака тусклее, мокрая земля темнее
    // дождь: капли падают косо по ветру вокруг камеры; всплески на земле, круги на реке («Уменьшить движение» — без капель)
    { const n = under || calm ? 0 : eff.drops, B = WE ? WE.box : [1, 1], sx = windNow.dir[0] * windNow.s * 5, sz = windNow.dir[1] * windNow.s * 5, L = .55;
      for (let i = 0; i < n; i++) {
        const k = i * 6; let x = dropPos[k], y = dropPos[k + 1], z = dropPos[k + 2];
        y -= WE.fall * dt; x += sx * dt; z += sz * dt;
        if (y < cam.y - .2 || Math.abs(x - cam.x) > B[0] / 2 || Math.abs(z - cam.z) > B[0] / 2) { x = cam.x + (dropSeed() - .5) * B[0]; z = cam.z + (dropSeed() - .5) * B[0]; y = cam.y + dropSeed() * B[1]; }
        dropPos[k] = x; dropPos[k + 1] = y; dropPos[k + 2] = z; dropPos[k + 3] = x - sx / WE.fall * L; dropPos[k + 4] = y + L; dropPos[k + 5] = z - sz / WE.fall * L;
      }
      drops.geometry.setDrawRange(0, n * 2); drops.geometry.attributes.position.needsUpdate = n > 0; drops.visible = n > 0; drops.material.opacity = .25 + .25 * eff.rain;
      if (n && Math.random() < dt * WE.splash * eff.rain) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 12, x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r; if (!river || waterDist(river, x, z) > .2) burst(x, .05, z, 2, '#c8d8e8', .8); }
      for (const q of ripples) {
        if (q.m.visible) { q.t += dt; const k = q.t / .9; q.m.scale.setScalar(.1 + .7 * k); q.m.material.opacity = .5 * (1 - k); if (k >= 1) q.m.visible = false; }
        else if (n && river && Math.random() < dt * 1.5 * eff.rain) { const P = river.pts[(Math.random() * river.pts.length) | 0], a = Math.random() * Math.PI * 2, r = Math.random() * (river.w / 2 - .4); if (Math.hypot(P.x - p.x, P.z - p.z) < 26) { q.t = 0; q.m.visible = true; q.m.position.set(P.x + Math.sin(a) * r, cfg.terrain.water + .03, P.z + Math.cos(a) * r); } }
      } }

    if (!under) { town.update(FL ? FL.map.house : W.inside, dt, W.levels ? W.levels.surface.map : W.map); const sv = views.get('surface'); if (sv && sv.stairs) for (const m of sv.stairs) m.visible = W.inside === m.userData.house; }     // лестница видна изнутри дома (снаружи — крыша)
    conts.update(W, t);
    // герои сюжета (этап 3): модель жителя своего цвета; над головой «!» — начать сцену, «?» — вернуться
    { const list = under ? [] : storyActors(W), seen = new Set();
      for (const a of list) { seen.add(a.kind); let s = storyNpcs.get(a.kind);
        if (!s) { const m = makeNpc(a.kind, a.tint), mk = new THREE.Sprite(new THREE.SpriteMaterial({ map: markTex['!'], depthTest: false, transparent: true })); mk.scale.set(.7, .7, 1); mk.position.y = 2.9; mk.renderOrder = 5; m.group.add(mk); scene.add(m.group); s = { m, mk }; storyNpcs.set(a.kind, s); }
        const g = s.m.group, y = Y(a.x, a.z); g.visible = true; g.position.set(a.x, y, a.z); const dx = p.x - a.x, dz = p.z - a.z; if (Math.hypot(dx, dz) < 10) g.rotation.y += angDiffTo(Math.atan2(dx, dz), g.rotation.y) * Math.min(1, dt * 6);
        s.m.root.position.y = Math.sin(t * 2 + a.x) * .02; s.mk.visible = !!a.mark; if (a.mark) { s.mk.material.map = markTex[a.mark]; s.mk.position.y = 2.9 + (calm ? 0 : Math.sin(t * 3) * .08); } }
      for (const [k, s] of storyNpcs) if (!seen.has(k)) s.m.group.visible = false; }
    const swapNow = (ambSwapT -= dt) <= 0 && (ambSwapT = 1, true);     // раз в секунду: не пришли ли готовые модели жителей и зверей
    if (swapNow) { for (let i = 0; i < npcs.length; i++) { const n = npcs[i]; if (n.gltf) continue; const A = ambMake('npc', n.pos.kind); if (A) { A.pos = n.pos; A.mark = n.mark; A.group.add(n.mark); npcs[i] = swapIn(n, A, scene); } }
      for (const c of villagers) if (!c.m.gltf) { const A = ambMake('npc', c.f); if (A) c.m = swapIn(c.m, A, life); }
      for (const c of crows) if (!c.m.gltf) { const A = ambMake('beast', 'crow'); if (A) c.m = swapIn(c.m, A, life); }
      for (const c of ducks) if (!c.m.gltf) { const A = ambMake('beast', 'duck'); if (A) c.m = swapIn(c.m, A, life); }
      for (const c of beasts) for (const [k, m] of Object.entries(c.ms)) if (!m.gltf && actorKey(cfg, 'beast', k) && actorReady(actorKey(cfg, 'beast', k))) { life.remove(m.group); disposeDeep(m.group); delete c.ms[k]; if (c.m === m) c.m = null; }
      if (!horse.gltf) { const A = ambMake('beast', 'horse'); if (A) horse = swapIn(horse, A, scene); } }
    for (const n of npcs) { if (n.gltf) n.tick(dt, 'idle'); const dx = p.x - n.pos.x, dz = p.z - n.pos.z; if (Math.hypot(dx, dz) < 9) n.group.rotation.y += angDiffTo(Math.atan2(dx, dz), n.group.rotation.y) * Math.min(1, dt * 6); n.root.position.y = Math.sin(t * 2) * .02; { const mk = storyTalkable(W, n.kind || n.pos.kind) ? 'available' : questMark(W, n.kind || n.pos.kind); n.mark.visible = !!mk; if (mk) { n.mark.material.color.set(mk === 'ready' ? '#7ad06a' : '#e8c04a'); n.mark.position.y = 2.6 + Math.sin(t * 3) * .08; n.mark.rotation.y = t * 2; } } n.armL.rotation.x = Math.sin(t * 1.6) * .08; n.armR.rotation.x = -Math.sin(t * 1.6) * .08; }
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
      for (const { v, m } of villagers) { stepVillager(v, dt, vStops, AMB, Math.random); if (!(m.group.visible = inView(v.x, 1 + Y(v.x, v.z), v.z, 2))) continue; m.group.position.set(v.x, Y(v.x, v.z), v.z); m.group.rotation.y = m.yawInit && cfg.view.blend ? dampAngle(m.group.rotation.y, v.face, cfg.view.blend.yawFoe, dt) : v.face; m.yawInit = true; m.root.position.y = v.moving && !calm ? Math.abs(Math.sin(t * 8 + v.id)) * .07 : 0; m.armL.rotation.x = v.moving && !calm ? Math.sin(t * 8 + v.id) * .5 : 0; m.armR.rotation.x = -m.armL.rotation.x; if (m.gltf) { m.root.position.y = 0; m.tick(dt, v.moving ? 'walk' : 'idle'); } }
      updateBirds(crows.map(c => c.b), p.x, p.z, dt, AMB);
      if (beasts.length && (W.lvl === 'surface' || liftY != null)) { const nOn = Math.max(2, Math.round(beasts.length * (Q.life ?? 1))); updateBeasts(beasts.slice(0, nOn).map(c => c.b), p.x, p.z, dt, BEA, Math.random, beastOk, (x, z) => biomeAt(cfg, x, z));
        for (let i = nOn; i < beasts.length; i++) for (const m of Object.values(beasts[i].ms)) m.group.visible = false;     // на «Низком» — меньше зверей
        for (const c of beasts.slice(0, nOn)) { const b = c.b, m = beastModel(c); m.group.visible = b.state !== 'gone' && inView(b.x, 1 + Y(b.x, b.z), b.z, 2); if (!m.group.visible) continue; const hop = b.kind === 'hare' && b.moving ? Math.abs(Math.sin(b.step * 2.2)) * .25 : 0; m.group.position.set(b.x, Y(b.x, b.z) + hop, b.z); m.group.rotation.y = m.yawInit && cfg.view.blend ? dampAngle(m.group.rotation.y, b.face, cfg.view.blend.yawFoe, dt) : b.face; m.yawInit = true; m.legs.forEach((l, i) => { l.rotation.x = b.moving ? Math.sin(b.step * (b.kind === 'deer' ? 3.2 : 4) + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * .7 : 0; }); (m.head || m.group.children[2]).rotation.x = b.state === 'graze' && (b.kind === 'deer' || b.kind === 'goat') ? .5 : 0;  if (m.gltf) { m.group.position.y -= hop; m.tick(dt, b.state === 'graze' ? 'graze' : b.moving ? (b.state === 'flee' || b.state === 'run' ? 'run' : 'walk') : 'idle'); }} }
      if (ducks.length && (W.lvl === 'surface' || liftY != null) && river) { updateDucks(ducks.map(c => c.b), p.x, p.z, dt, river.lakes, BEA.ducks, lakeR);
        for (const { b, m } of ducks) { m.group.visible = !!b.lake && inView(b.x, 0, b.z, 1); if (!b.lake) continue; m.group.position.set(b.x, cfg.terrain.water + .02 + Math.sin(t * 2 + b.id) * .02, b.z); m.group.rotation.y = b.face; if (m.gltf) m.tick(dt, 'idle'); } }
      if (river && river.lakes && (W.lvl === 'surface' || liftY != null) && (fishT -= dt) <= 0) { fishT = BEA.fish[0] + Math.random() * (BEA.fish[1] - BEA.fish[0]);     // рыба плеснула
        const L = river.lakes.find(q => Math.hypot(q.x - p.x, q.z - p.z) < q.r + 30); if (L && !calm) { const a = Math.random() * 6.283, rr = Math.random() * L.r * .6, x = L.x + Math.sin(a) * rr, z = L.z + Math.cos(a) * rr; ringFx(x, z, .9, '#d6e6dc'); for (let i = 0; i < 8; i++) fx.emit(x, cfg.terrain.water + .1, z, (Math.random() - .5) * 1.2, 1.6 + Math.random(), (Math.random() - .5) * 1.2, '#d8ecf4', .6, 6, .06, false); } }
      if (flies && (W.lvl === 'surface' || liftY != null) && !calm) {     // днём бабочки у травы, ночью летучие мыши повыше
        const n = Math.round(FLY.n * (Q.life ?? 1) * (W.rain > .3 ? 0 : 1)), night = !!W.night; flies.count = n; flies.material.color.set(night ? '#2a2026' : '#ffffff');
        for (let i = 0; i < n; i++) { let A = flyA[i];
          if (!A || Math.hypot(A.x - p.x, A.z - p.z) > FLY.r * 2.2) { const u = Math.random() * Math.PI * 2, d = FLY.r * (A ? .9 + Math.random() * .7 : .3 + Math.random()); A = flyA[i] = { x: p.x + Math.sin(u) * d, z: p.z + Math.cos(u) * d, t0: t, u: Math.random() * Math.PI * 2 }; }     // ушёл далеко — новое место у края, появляется плавно
          A.u += (Math.random() - .5) * dt; A.x += Math.sin(A.u) * .25 * dt; A.z += Math.cos(A.u) * .25 * dt;     // место медленно блуждает
          const ph = i * 2.399, sp = night ? 1.6 : .9, a = t * sp * (i % 2 ? 1 : -1) + ph, rr = night ? 2.2 : 1.1, x = A.x + Math.sin(a) * rr + Math.sin(t * 1.7 + i) * .4, z = A.z + Math.cos(a * .8) * rr;
          flyO.position.set(x, Y(x, z) + (night ? 3.2 + Math.sin(t * 3 + i) * .6 : .7 + Math.abs(Math.sin(t * 2.3 + i)) * .6), z); flyO.rotation.set(0, a, Math.sin(t * (night ? 30 : 18) + i) * .9); flyO.scale.setScalar((night ? 2 : 1.9) * Math.min(1, (t - A.t0) / 1.2)); flyO.updateMatrix(); flies.setMatrixAt(i, flyO.matrix); }
        flies.instanceMatrix.needsUpdate = true; } else if (flies) flies.count = 0;
      for (const { b, m } of crows) { m.group.visible = b.state !== 'gone' && inView(b.x, b.y + 1 + Y(b.x, b.z), b.z, 1.5); if (!m.group.visible) continue; m.group.position.set(b.x, b.y + Y(b.x, b.z), b.z); m.group.rotation.y = b.face; const fl = b.state === 'fly' ? Math.sin(t * 22) * .9 : (b.peck < .3 ? .2 : 0); m.wl.rotation.z = fl; m.wr.rotation.z = -fl; if (m.gltf) m.tick(dt, b.state === 'fly' ? 'fly' : b.peck < .3 ? 'peck' : 'idle', b.state === 'fly' ? 2 : 1); }
      for (let i = 0; i < puffs.count; i++) {
        const c = pipes[(i / AMB.smoke) | 0], k = ((t / 4 + (i % AMB.smoke) / AMB.smoke + c.x * .013) % 1), s = .35 + k * 1.1 * (1 - k * .6);
        const dr = .4 + 2.6 * windNow.s; puffP.set(c.x + k * dr * windNow.dir[0] + Math.sin(t + i) * .15, c.y + .3 + k * 3.2 * (1 - .4 * windNow.s), c.z + k * dr * windNow.dir[1]); puffS.set(s, s, s); puffM.compose(puffP, puffQ, puffS); puffs.setMatrixAt(i, puffM);     // дым сносит ветром
      }
      if (puffs.count) puffs.instanceMatrix.needsUpdate = true;
    }
    updateHalos(p.x, p.z, under ? 0 : Math.min(1, Math.max(0, (.55 - (W.light ?? 1)) / .4)), t);
    WaU.uTime.value = calm ? 0 : t; WaU.uDay.value = W.light ?? 1; LeU.uDayL.value = W.light ?? 1;
    if (!under && river && !calm) waterMat.emissive.setRGB(.04 + .015 * Math.sin(t * 1.3), .1 + .02 * Math.sin(t * 1.7 + 1), .14 + .02 * Math.sin(t * 1.1));
    // костёр: мерцание света и пламени
    const fl = .8 + .2 * Math.sin(t * 17) + .1 * Math.sin(t * 29.3);
    fire.light.intensity = 26 * fl; fire.flames.forEach((f, i) => { f.scale.y = .8 + .35 * Math.sin(t * (9 + i * 4) + i); f.rotation.y = t * (2 + i); });
    // пепел
    const ap = ashGeo.attributes.position;
    for (let i = 0; i < ashN; i++) { let y = ap.getY(i) - dt * (.6 + (i % 5) * .15), x = ap.getX(i) - dt * .5; if (y < 0) { y = 14; } ap.setY(i, y); ap.setX(i, x); }
    ap.needsUpdate = true; ash.position.set(cam.x, 0, cam.z);

    // герой
    const py = liftY ?? Y(p.x, p.z); hero.group.position.set(p.x, py, p.z);
    asciiLamp.visible = asciiOn && !under; if (asciiLamp.visible) asciiLamp.position.set(p.x, py + 2.6, p.z); { const BL = cfg.view.blend, early = p.state === 'atk' && p.atkT < cfg.player.attackHitAt * .6; hero.group.rotation.y = BL && hero.yawInit ? dampAngle(hero.group.rotation.y, p.face, early ? BL.yawWind : BL.yawHero, dt) : p.face; hero.yawInit = true; }     // поворот модели — плавно (шаг 3)
    { const it = W.inv.eq.weapon && BY_ID[W.inv.eq.weapon]; hero.setWeapon(W.wp.kind, it ? it.mat : 'steel'); if (hero.wkey !== rimKey) { rimKey = hero.wkey; rimify(hero.group, RS && RS.hero); } }
    if (RS) RimU.uRim.value = RS.night + (RS.day - RS.night) * Math.min(1, Math.max(0, ((W.light ?? 1) - .15) / .6));
    { const o = W.inv.eq.offhand && BY_ID[W.inv.eq.offhand]; hero.setOff(o ? o.id : '', o && o.kind, o && o.mat, o && o.form); }
    if (hero.hurtT > 0) hero.hurtT = Math.max(0, hero.hurtT - dt);
    heroBlade.set(hero.weapon, bladeOn() ? bladeEls(W.wp).filter(hasBladeStyle) : []); heroBlade.update(dt, t, calm);
    updateChevs(W, p, t);
    if (hero.gltf) { driveHero(hero, p, dt, cfg, p.swingMul || W.gear.swing || 1); hero.flash(p.inv > 0 && p.inv < 5 && p.state !== 'roll' ? .25 : 0); } else animateHero(hero, p, t, dt, cfg, p.swingMul || W.gear.swing || 1);
    { const on = !!(W.life && W.life.mount.on) && !p.dead; horse.group.visible = on;     // верхом: конь под героем, герой выше и сидит
      if (on) { horse.group.position.set(p.x, py, p.z); horse.group.rotation.y = hero.group.rotation.y; horse.step(t, Math.hypot(p.vx, p.vz)); hero.group.position.y = py + .95; if (hero.legL) hero.legL.rotation.x = hero.legR.rotation.x = -1.2; } }
    updateNodes(W, dt); updateCoaches(W);
    statusFx(heroFx, p.dead ? null : W.pst, p.x, Y(p.x, p.z), p.z, 1.7, 1, dt);
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
      { const sc0 = cfg.enemies[e.type].scale * (e.scaleMul || 1), far = Math.hypot(e.x - p.x, e.z - p.z) > CL.foe;     // вне кадра — не анимировать; дальше 70 м — освободить модель
        if (!e.boss && (far || !inView(e.x, Y(e.x, e.z) + 1.2 * sc0, e.z, 2.5 * sc0 + 1))) { const en0 = ents.get(e.id); if (en0) { if (far) dropEnt(e.id, en0); else hideEnt(e.id, en0); } continue; } }
      let en = entity(e);
      if (!en.m.gltf && !e.dead && (en.swapT = (en.swapT || 0) - dt) <= 0) { en.swapT = 1; const fk = actorKey(cfg, 'foe', e.type); if (fk && actorReady(fk)) { dropEnt(e.id, en); en = entity(e); } }     // готовая модель пришла позже — пересобрать
      if (en.hid) { en.hid = false; en.m.group.visible = en.sh.visible = en.ring.visible = true; }
      const ey = Y(e.x, e.z); en.m.group.position.set(e.x, ey, e.z); if (!en.yawInit || !cfg.view.blend) en.m.group.rotation.y = e.face; else if (!e.dead) en.m.group.rotation.y = dampAngle(en.m.group.rotation.y, e.face, e.state === 'dash' ? cfg.view.blend.hit : cfg.view.blend.yawFoe, dt); en.yawInit = true;     // поворот — плавно (шаг 3), мёртвый не крутится
      { const base = cfg.enemies[e.type].scale * (e.scaleMul || 1); if (en.m.group.scale.x !== base) en.m.group.scale.setScalar(base); }
      if (en.m.gltf) { driveFoe(en.m, e, t, dt, cfg); en.m.flash(e.flash > 0 ? .9 : 0, e.st && !e.dead ? (e.st.freeze ? [.04, .22, .45] : e.st.burn ? [.5, .16, 0] : e.st.poison ? [0, .3, .04] : null) : null); }
      else animateMonster(en.m, e, t, cfg, p.x, p.z);
      { const sc = cfg.enemies[e.type].scale * (e.scaleMul || 1), st = !e.dead && e.st; statusFx(en, st, e.x, ey, e.z, 1.7 * sc, sc, dt); statusMarks(en, st, e.x, ey, e.z, sc, dt, t); }
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
      if (!en) { const m = a.decoy ? decoyModel() : a.guest ? (a.cart ? makeCart(false) : makeNpc('traveler')) : cfg.squad.types[a.type] && cfg.squad.types[a.type].hero ? mateModel(cfg.squad.types[a.type]) : makeSoldier(a.type, cfg), sh = shadow(a.cart ? 1.4 : .5); scene.add(m.group, sh); en = { m, sh }; allyEnts.set(a.id, en); }
      { const T1 = cfg.squad.types[a.type], k1 = T1 && T1.hero && !a.guest && !a.decoy && !en.m.gltf && actorKey(cfg, 'hero', T1.hero); if (k1 && actorReady(k1)) { scene.remove(en.m.group); disposeDeep(en.m.group); en.m = mateModel(T1); en.lk = null; scene.add(en.m.group); } }     // готовая модель спутника пришла позже
      const ay = liftY ?? Y(a.x, a.z); en.m.group.position.set(a.x, ay, a.z); en.m.group.rotation.y = en.yawInit && cfg.view.blend ? dampAngle(en.m.group.rotation.y, a.face, cfg.view.blend.yawHero, dt) : a.face; en.yawInit = true;
      if (en.m.setLook && !a.guest) {     // спутник-герой (этап 4): анимация героя по «подставному» игроку — бег по скорости, удар по замаху
        if (a.eq) { const T0 = cfg.squad.types[a.type], lk = lookKey(T0.hero, a, null) + (a.eq.weapon || ''); if (en.lk !== lk) { en.lk = lk; en.m.setLook(dressedLook(heroOf(T0.hero).look, a, null)); const wi = a.eq.weapon && BY_ID[a.eq.weapon]; en.m.setWeapon(wi ? wi.kind : MATE_W[T0.hero] || 'sword', wi ? wi.mat : 'steel'); } }     // одежда бойца-героя (2026-10-20)
        const T = cfg.squad.types[a.type], AT = cfg.player.attackTime, k = dt > 0 ? 1 / dt : 0, pp = en.pp || (en.pp = { chain: 0, fin: false, heavy: 0, hand: 0, inv: 0, rollT: 0, chargeT: 0, dashT: 0, dashDur: 0 });
        pp.vx = en.lx === undefined ? 0 : (a.x - en.lx) * k; pp.vz = en.lz === undefined ? 0 : (a.z - en.lz) * k; en.lx = a.x; en.lz = a.z;
        pp.face = a.face; pp.dead = a.dead; pp.deadT = a.deadT; pp.state = a.state === 'wind' || a.state === 'rec' ? 'atk' : 'idle';
        pp.atkT = a.state === 'wind' ? AT * .5 * Math.min(1, a.t / T.wind) : AT * (.5 + .5 * Math.min(1, a.t / T.recover));
        if (en.m.gltf) driveHero(en.m, pp, dt, cfg); else animateHero(en.m, pp, t, dt, cfg); en.m.group.rotation.y = en.yawInit && cfg.view.blend ? dampAngle(en.m.group.rotation.y, a.face, cfg.view.blend.yawHero, dt) : a.face; en.yawInit = true;
        if (bladeOn() && a.eq) { const bl = en.blade || (en.blade = makeBladeFx(scene)), wi = a.eq.weapon && BY_ID[a.eq.weapon]; bl.set(en.m.weapon, wi ? bladeEls({ mix: weaponMix(wi, a.gem && a.gem.weapon), el: weaponElement(wi) }).filter(hasBladeStyle) : []); bl.update(dt, t, calm); }     // стихия на клинке спутника
      } else if (!a.guest) animateSoldier(en.m, a, t);
      else { en.m.group.visible = !a.dead; if (en.m.root) en.m.root.position.y = calm ? 0 : Math.abs(Math.sin(t * (a.moving ? 9 : 2))) * (a.moving ? .08 : .02); } en.sh.position.set(a.x, .03 + ay, a.z); en.sh.visible = !a.dead;
      const b = bar({ id: 'a' + a.id }, a.guest ? '#d8b040' : '#3a8a4a'), show = (a.guest || a.hp < a.maxhp) && !a.dead;
      b.g.visible = show; if (show) { b.g.position.set(a.x, (a.cart ? 3.4 : 2.7) + ay, a.z); b.g.quaternion.copy(camera.quaternion); b.fill.scale.x = Math.max(.001, a.hp / a.maxhp); }
    }
    { const mk = W.party && W.party.cmd === 'assist' && W.enemies.find(e => e.id === W.party.mark && !e.dead); markRing.visible = !!mk;     // метка «моей цели»
      if (mk) { const r = cfg.enemies[mk.type].radius + .5; markRing.position.set(mk.x, .08 + Y(mk.x, mk.z), mk.z); markRing.scale.setScalar(r); markRing.rotation.z = t * 1.5; } }
    for (const [id, en] of allyEnts) if (!aliveA.has(id)) { if (en.blade) en.blade.dispose(); if (en.m.gltf) disposeActor(en.m); scene.remove(en.m.group, en.sh); disposeDeep(en.m.group); disposeDeep(en.sh); allyEnts.delete(id); const b = bars.get('a' + id); if (b) { scene.remove(b.g); disposeDeep(b.g); bars.delete('a' + id); } }
    for (const [id, en] of ents) if (!alive.has(id)) dropEnt(id, en);

    // события боя → эффекты и подписи (подписи отдаёт hooks.onText)
    for (const v of W.ev) {
      hooks.onEvent && hooks.onEvent(v);     // интерфейс (сообщения, звук, экран смерти) — всегда, даже вне кадра
      if (v.x !== undefined && v.z !== undefined && !inView(v.x, 1 + Y(v.x, v.z), v.z, (v.r || 2) + 4)) continue;     // событие вне кадра — без частиц, вспышек и цифр
      if (v.k === 'hit') { hitFx(v, p); hooks.onText && hooks.onText(v.x, 2, v.z, String(v.dmg) + (v.crit ? '!' : ''), v.crit ? 'crit' : v.fin ? 'fin' : ''); }
      else if (v.k === 'die') dieFx(v, p);
      else if (v.k === 'level') levelFx(v);
      else if (v.k === 'hurt') { burst(v.x, 1.2, v.z, 10, '#c0222c'); fx.decal(v.x + (Math.random() - .5), v.z + (Math.random() - .5), .4, BLOOD); hero.hurtT = HURT_T; hooks.onText && hooks.onText(v.x, 2.4, v.z, '−' + v.dmg, 'hurt'); hooks.onHurt && hooks.onHurt(); }
      else if (v.k === 'open') burst(v.x, .9, v.z, 10, '#ffc860', 3)
      else if (v.k === 'heal') hooks.onText && hooks.onText(v.x, 2.4, v.z, '+' + v.n + ' ♥', 'loot')
      else if (v.k === 'ash') hooks.onText && hooks.onText(v.x, 2.4, v.z, '+' + v.n + ' пепла', 'loot')
      else if (v.k === 'buff') burst(v.x, 1.2, v.z, 10, '#9fd0ff', 2)
      else if (v.k === 'dot') { hooks.onText && hooks.onText(v.x, 2.2, v.z, String(v.dmg), 'dot-' + v.fx); }
      else if (v.k === 'react' && v.name === 'Раскол') { fx.flash(v.x, 1.2, v.z, 2.4, '#e8f8ff'); for (let i = 0; i < 26; i++) { const a = Math.random() * 6.283, sp = 3 + Math.random() * 4; fx.emit(v.x, 1 + Math.random() * .6, v.z, Math.cos(a) * sp, 2 + Math.random() * 3, Math.sin(a) * sp, ['#e8f8ff', '#bfe8ff', '#9fdcff'][i % 3], .6 + Math.random() * .4, 14, .1 + Math.random() * .12, false); } hooks.onText && hooks.onText(v.x, 3, v.z, v.name + '!', 'react'); W.shake = Math.max(W.shake, .35); }
      else if (v.k === 'react' && v.name === 'Токсичный взрыв') { ringFx(v.x, v.z, 3.4, '#7ad060'); for (let i = 0; i < 34; i++) { const a = Math.random() * 6.283, sp = .8 + Math.random() * 2.2; fx.emit(v.x, .4 + Math.random() * .8, v.z, Math.cos(a) * sp, .3 + Math.random() * .6, Math.sin(a) * sp, ['#7ad060', '#4a9a3a', '#a8f070'][i % 3], 1 + Math.random() * .6, -.3, .2 + Math.random() * .18, false); } hooks.onText && hooks.onText(v.x, 3, v.z, v.name + '!', 'react'); W.shake = Math.max(W.shake, .3); }
      else if (v.k === 'react') { const cs = v.key ? v.key.split('+').map(k => ELEMENT_COLOR[k]) : ['#bfe8ff', '#bfe8ff']; if (v.r) ringFx(v.x, v.z, v.r, cs[0]); burst(v.x, 1.2, v.z, 10, cs[0], 5); burst(v.x, 1.2, v.z, 10, cs[1], 5); hooks.onText && hooks.onText(v.x, 3, v.z, v.name + '!', 'react'); W.shake = Math.max(W.shake, .3); }     // цвета двух стихий смеси
      else if (v.k === 'bossblast') { ringFx(v.x, v.z, v.r || 3, '#ff6a3a'); burst(v.x, .5, v.z, 22, v.kind === 'nova' ? '#ff8a30' : '#6a5a4a', 7); }
      else if (v.k === 'chain') { zap(v.x, v.z, v.x2, v.z2); }
      else if (v.k === 'boom') { ringFx(v.x, v.z, v.r, '#ffe27a'); burst(v.x, .8, v.z, 12, '#ffe27a', 5); }
      else if (v.k === 'drop' && BY_ID[v.id] && BY_ID[v.id].rar >= 4) { const c = RARITY[BY_ID[v.id].rar].color; fx.flash(v.x, 1.4, v.z, 2.6, c); burst(v.x, 1, v.z, 12, c, 4); }
      else if (v.k === 'sun') { fx.flash(v.x, 1.2, v.z, v.r + 1, '#ffd86a'); burst(v.x, .8, v.z, 18, '#ffd86a', v.r * 1.6); }          // золото (G3b)
      else if (v.k === 'aegisUp' || v.k === 'aegis' || v.k === 'reflect') burst(v.x, 1.1, v.z, v.k === 'aegis' ? 10 : 6, '#f5c542', 2.2);
      else if (v.k === 'wskill') {                    // умение оружия: кольцо и вспышка цвета стихии, имя над героем
        const c1 = v.el && v.el[0] ? ELEMENT_COLOR[v.el[0]] : '#f0d8a8', c2 = v.el && v.el[1] ? ELEMENT_COLOR[v.el[1]] : c1, sx = Math.sin(v.face), sz = Math.cos(v.face);
        if (v.id === 'lunge') for (let i = 0; i < 10; i++) burst(v.x + sx * i * .6, 1, v.z + sz * i * .6, 2, i % 2 ? c1 : c2, 3);
        else if (v.id === 'reap') for (let i = 0; i < 14; i++) { const a = v.face + (i / 13 - .5) * 3.8; burst(v.x + Math.sin(a) * 3.2, 1, v.z + Math.cos(a) * 3.2, 2, i % 2 ? c1 : c2, 4); }
        else if (v.id !== 'elemshot') { ringFx(v.x, v.z, v.r || 3, c1); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; burst(v.x + Math.sin(a) * (v.r || 3) * .8, 1, v.z + Math.cos(a) * (v.r || 3) * .8, 2, i % 2 ? c1 : c2, 3); } }
        fx.flash(v.x, 1.3, v.z, 2.4, v.gold ? '#ffe27a' : c1); if (v.id === 'shatter') W.shake = Math.max(W.shake, .5);
        hooks.onText && hooks.onText(v.x, 3.3, v.z, WSKILL[v.id].name + '!', 'crit');
      }
      else if (v.k === 'nova') { ringFx(v.x, v.z, v.r, '#bfe8ff'); for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; burst(v.x + Math.sin(a) * v.r * .8, .8, v.z + Math.cos(a) * v.r * .8, 2, '#e8f8ff', 3); } fx.flash(v.x, 1.2, v.z, 2.4, '#cfeeff'); }
      else if (v.k === 'meteorMark') { ringFx(v.x, v.z, v.r, '#ff6a3a'); burst(v.x, 6, v.z, 10, '#ffb040', 2); }
      else if (v.k === 'meteor') { ringFx(v.x, v.z, v.r, '#ff8a30'); burst(v.x, .8, v.z, 40, '#ff8a30', 7); burst(v.x, .8, v.z, 20, '#ffe27a', 5); fx.flash(v.x, 1.4, v.z, 3.4, '#ffb060'); fx.ash(v.x, .6, v.z, 14, ['#3a302a', '#5a4a40', '#2a2420']); }
      else if (v.k === 'spear') { zap(v.x, v.z, v.x2, v.z2, '#e0c8ff', '#8a5aff', 1.8); for (let i = 1; i < 8; i++) { const k = i / 8; burst(v.x + (v.x2 - v.x) * k, 1.2, v.z + (v.z2 - v.z) * k, 3, '#b48aff', 2); } burst(v.x2, 1.2, v.z2, 24, '#8a5aff', 6); fx.flash(v.x2, 1.2, v.z2, 2.4, '#b48aff'); }
      else if (v.k === 'mshield') burst(v.x, 1.3, v.z, 6, '#7a8aff', 3)
      else if (v.k === 'combo') { hooks.onText && hooks.onText(v.x, 3.6, v.z, 'Связка: ' + v.name + '!', 'crit'); fx.flash(v.x, 1.4, v.z, 2.6, '#ffd27a'); burst(v.x, 1.4, v.z, 18, '#ffe8a8', 4); }
      else if (v.k === 'pulse') ringFx(v.x, v.z, v.r, '#c8a8ff')
      else if (v.k === 'splash') { ringFx(v.x, v.z, v.r, '#c8a8ff'); burst(v.x, 1.1, v.z, 10, '#d8c0ff', 4); }
      else if (v.k === 'wskill2') ringFx(v.x, v.z, 3.4, '#f0d8a8')
      else if (v.k === 'eblast') { const c1 = v.el && v.el[0] ? ELEMENT_COLOR[v.el[0]] : '#f0d8a8'; ringFx(v.x, v.z, v.r, c1); burst(v.x, 1.1, v.z, 24, c1, 5); if (v.el && v.el[1]) burst(v.x, 1.1, v.z, 14, ELEMENT_COLOR[v.el[1]], 5); fx.flash(v.x, 1.2, v.z, 2.2, c1); }
      else if (v.k === 'gfx') {                       // новые умения древа: эффект по виду действия, цвет — стихия
        const c = GCOL[v.el] || '#ffe8b0', K = v.kind;
        if (K === 'nova' || K === 'pull' || K === 'zone' || K === 'field' || K === 'cloud') { ringFx(v.x, v.z, v.r, c); if (K !== 'cloud') ringFx(v.x, v.z, v.r * .6, c);
          for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, rr = K === 'pull' ? v.r * .9 : v.r * .7; burst(v.x + Math.sin(a) * rr, .6, v.z + Math.cos(a) * rr, 2, c, K === 'pull' ? 1.5 : 3); }
          if (K === 'zone') { burst(v.x, 1.4, v.z, 30, c, 6); fx.flash(v.x, 1.2, v.z, 3, c); } else fx.flash(v.x, 1.2, v.z, 2, c); }
        else if (K === 'cone') { for (let i = -3; i <= 3; i++) { const a = v.face + i / 3 * (v.cone / 2) * Math.PI / 180; for (const d of [.45, .8]) burst(v.x + Math.sin(a) * v.r * d, 1, v.z + Math.cos(a) * v.r * d, 3, c, 3); } fx.flash(v.x + Math.sin(v.face) * 1.4, 1.2, v.z + Math.cos(v.face) * 1.4, 2.2, c); }
        else if (K === 'bolt') fx.flash(v.x + Math.sin(v.face) * .9, 1.2, v.z + Math.cos(v.face) * .9, 1.4, c);
        else if (K === 'strike') { fx.flash(v.x, 1.2, v.z, 2.2, c); burst(v.x, 1.2, v.z, 20, c, 4); }
        else if (K === 'dash') { burst(v.x, 1, v.z, 16, c, 3); fx.ash(v.x, .4, v.z, 10, [c, '#ffffff', c]); }
        else if (K === 'mark') { burst(v.x, 2.2, v.z, 14, c, 2); fx.flash(v.x, 1.6, v.z, 1.6, c); hooks.onText && hooks.onText(v.x, 3, v.z, 'Метка', 'alarm'); }
        else { for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; burst(v.x + Math.sin(a) * 1.1, .3, v.z + Math.cos(a) * 1.1, 2, c, 2.5); } fx.flash(v.x, 1.4, v.z, 2, c); if (K === 'heal' && hooks.onText) hooks.onText(v.x, 3, v.z, 'Лечение', 'loot'); }     // усиление и лечение — столб искр вокруг героя
      }
      else if (v.k === 'ability') {                   // умения: вспышки и кольца
        const col = { charge: '#e8d8c0', cry: '#ffd27a', whirl: '#f0e0c8', iron: '#9fd0ff', rage: '#ff4a30', blink: '#c8a0ff', parry: '#fff0c0', dance: '#c8d8ff', shadow: '#2a1838', execute: '#ff3030', leap: '#c8e0b0', volley: '#eef4ff', trap: '#8a8478', venom: '#7ad060', rain: '#eef4ff', fireball: '#ff8a30', chain: '#ffe27a', cloud: '#7ad060', meteor: '#ff6a3a', shield: '#7a8aff', blizzard: '#e8f8ff', spear: '#8a5aff' }[v.id] || '#ffe8b0';
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
      else if (v.k === 'slam') burst(v.x, .3, v.z, 10, '#6a5a4a', 4);
      else if (v.k === 'mirror') hooks.onText && hooks.onText(v.x, 2.2, v.z, '−' + v.dmg, 'hurt');
      else if (v.k === 'chill') burst(v.x, 1, v.z, 10, '#9ad8ff', 2);     // приёмы врагов (этап 2 «круче»): подсказка над врагом
      else if (v.k === 'spit') burst(v.x, 1.4, v.z, 8, '#7ac04a', 3);
      else if (v.k === 'howl' || v.k === 'skin' || v.k === 'phase' || v.k === 'pullStart') hooks.onText && hooks.onText(v.x, 2.6, v.z, { howl: 'Вой стаи', skin: 'Каменная кожа', phase: 'Сквозь тьму', pullStart: 'Тянет!' }[v.k], 'sys');
      else if (v.k === 'chargeFull') fx.flash(v.x, 1.6, v.z, 1.4, '#ff8a30');
      else if (v.k === 'heavy') { ringFx(v.x + Math.sin(v.face) * 1.6, v.z + Math.cos(v.face) * 1.6, 2.5 + 1.5 * v.power, '#ff9a50'); }
      else if (v.k === 'finisher') { ringFx(v.x, v.z, 3, '#ffd9c0'); burst(v.x, .6, v.z, 10, '#ffd9c0', 5); fx.flash(v.x + Math.sin(v.face) * 1.5, .8, v.z + Math.cos(v.face) * 1.5, 2.2, '#ffd9c0'); }
      else if (v.k === 'pstatus') burst(v.x, 1.2, v.z, 8, v.kind === 'poison' ? '#7ad060' : v.kind === 'burn' ? '#ff8a30' : '#d03030', 2);
      else if (v.k === 'pdot') hooks.onText && hooks.onText(v.x, 2.6, v.z, '−' + v.dmg, 'hurt')
      else if (v.k === 'cleanse') burst(v.x, 1.2, v.z, 10, '#9fe8ff', 2.5);
      else if (v.k === 'allyhurt') { burst(v.x, 1.1, v.z, 6, '#3a6aa8'); hooks.onText && hooks.onText(v.x, 2.5, v.z, '−' + v.dmg, 'ally'); }
      else if (v.k === 'allydead') burst(v.x, 1, v.z, 14, '#3a6aa8', 5);
      else if (v.k === 'foeheal') burst(v.x, 1.4, v.z, 8, '#8ae08a');     // кликуша лечит своих (Акт IV)
      else if (v.k === 'allyheal') { burst(v.x, 1.2, v.z, 8, '#7ae07a'); hooks.onText && hooks.onText(v.x, 2.5, v.z, '+' + v.amt, 'loot'); }     // лекарь отряда
      else if (v.k === 'taunt') { ringFx(v.x, v.z, v.r, '#ffd27a'); burst(v.x, 1.6, v.z, 10, '#ffd27a', 4); hooks.onText && hooks.onText(v.x, 2.9, v.z, 'Ко мне!', 'alarm'); }     // вызов защитника
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
      lightMat.color.set(SL.night).lerp(sunCol.set(SL.day), L); lightMat.opacity = (SL.nightK + (SL.dayK - SL.nightK) * L) * eff.light;     // за тучами просветов меньше
      if ((shaftT -= dt) <= 0) { shaftT = .5; picks = pickShafts(field, p.x, p.z, tt, SL); }
      if (!Q.shafts) shafts.forEach(s => { s.m.visible = false; });     // столбы света выключены пресетом (шаг 14)
      else shafts.forEach((s, i) => {
        const w = picks[i], far = !w || Math.hypot(w.x - s.x, w.z - s.z) > 1;
        if (far && s.a > .01) s.a = Math.max(0, s.a - dt * 1.5);                // старое место гаснет
        else { if (w && far) { s.x = w.x; s.z = w.z; } s.a = Math.min(w ? w.k : 0, s.a + dt * 1.5); }
        s.m.visible = s.a > .01; if (!s.m.visible) return;
        s.m.position.set(s.x, Y(s.x, s.z), s.z); s.m.material.opacity = s.a * SL.shafts.op * (.4 + .6 * L) * eff.light; s.m.material.color.copy(lightMat.color);
        if (!calm && Math.random() < dt * SL.motes * s.a) burst(s.x + (Math.random() - .5) * SL.shafts.w * .6, 1 + Math.random() * 4, s.z + (Math.random() - .5) * 2, 1, '#fffbe0', .3);
      });
    }
    fx.update(dt);

    stepFx(dt); updateTele(W, t); updateLines(W, t); updateFoes(W, t);
    if (W.tomb && (W.tomb.lvl || 'surface') === W.lvl) { if (!tomb) { tomb = new THREE.Group(); const m = new THREE.MeshLambertMaterial({ color: '#8a867c' }); const a = new THREE.Mesh(new THREE.BoxGeometry(.7, 1, .18), m); a.position.y = .5; const b = new THREE.Mesh(new THREE.BoxGeometry(.4, .2, .18), m); b.position.y = 1.1; const g = new THREE.Mesh(new THREE.OctahedronGeometry(.2), new THREE.MeshBasicMaterial({ color: '#ffd45a' })); g.position.y = 1.9; tomb.add(a, b, g); tomb.userData.gem = g; scene.add(tomb); } tomb.visible = true; tomb.position.set(W.tomb.x, Y(W.tomb.x, W.tomb.z), W.tomb.z); tomb.userData.gem.position.y = 1.9 + Math.sin(t * 3) * .1; tomb.userData.gem.rotation.y = t * 2; } else if (tomb) tomb.visible = false;
    for (const e of W.enemies) if (e.st && !e.dead) { const r = Math.random(); if (e.st.burn && r < dt * 9) burst(e.x, 1.5, e.z, 1, '#ff8a30', 1); else if (e.st.poison && r < dt * 5) burst(e.x, 1.4, e.z, 1, '#7ad060', .8); else if (e.st.freeze && r < dt * 4) burst(e.x, 1.2, e.z, 1, '#cfeeff', .8); }
    if (XR && XR.on) { XU.uHero.value.set(p.x, py + 1.1, p.z).project(camera); XU.uAsp.value = camera.aspect; }     // окно — вокруг груди героя
    if (asciiOn) ascii.render(scene, camera, t, under ? .3 : W.light); else gl.render(scene, camera);
  }
  function setAscii(on) {                                           // атлас строится в resize под плотность экрана
    asciiOn = !!on; applyLook(); applyShadows();                                      // в клетках мелкая трава без сглаживания даёт муар
    resize();
  }
  function setRetro(on) { retro = !!on; applyLook(); applyShadows(); resize(); }     // «Ретро»: крупные пиксели, как раньше
  function setDprMax(v) { dprMax = v; resize(); }

  const treesNear = (x, z) => { if (!WC) return 0; let n = 0; const r2 = WC.rustle.r * WC.rustle.r, count = A => { for (let i = 0; i < A.length; i += 2) { const dx = A[i] - x, dz = A[i + 1] - z; if (dx * dx + dz * dz < r2) n++; } }; count(treeXZ); for (const L of liveLand.values()) count(L.trees); return Math.min(1, n / WC.rustle.full); };
  return { dbg: { scene, gl }, render, setZoom: z => { feelZoom = Math.max(0, Math.min(.4, z || 0)); }, setCine: f => { if (f && !cine) { cf.x = cam.x; cf.z = cam.z; } cine = f || null; }, cineAmt: () => cineA, resize, project, groundAt, setAim, setAscii, setRetro, setDprMax, setQuality, setResScale: v => { resScale = v; resize(); }, quality: () => ({ ...Q, shadowsOn: gl.shadowMap.enabled, resScale }), look: () => ({ retro, ascii: asciiOn, w: canvas.width, h: canvas.height, tone: gl.toneMapping }), vfx: () => ({ bolts: fxPool.filter(f => f.kind === 'bolt').length, ...fx.live() }), xray: () => XU, land: () => ({ live: liveLand.size, built: hf.built, keys: [...liveLand.keys()] }), wind: () => windNow, treesNear, weather: () => ({ ...wNow, drops: drops.visible ? drops.geometry.drawRange.count / 2 : 0, fog: scene.fog.density }), ascii: () => (asciiOn ? ascii : null), sun: () => (field ? { op: lightMat.opacity, shafts: shafts.filter(s => s.m.visible).length, on: sunGroup.visible !== false } : null), gl, camera, scene, town, info: () => gl.info.render, hero, fx, life: () => ({ villagers: villagers.map(({ v }) => ({ x: v.x, z: v.z, moving: v.moving })), crows: crows.map(({ b }) => ({ x: b.hx, z: b.hz, state: b.state })), puffs: puffs.count, fog: scene.fog.density }) };
}
