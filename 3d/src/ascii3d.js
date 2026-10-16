// Фильтр «ASCII» (E1): кадр из символов. Сцена рисуется в маленькую текстуру (несколько текселей на клетку), проход на весь
// экран заменяет каждую клетку символом из атласа: яркость выбирает плотность символа, оттенок — набор (зелень — штрихи
// травы, вода — волны, остальное — общая лестница). Цвет символа — цвет клетки, фон почти чёрный, яркие клетки светятся.
// Чёткие метки боя (полосы здоровья, круги замаха, телеграфы) лежат на слое 1 и рисуются поверх обычной графикой.
// Атлас строится при запуске на canvas из системного моноширинного шрифта; плотность каждого символа меряется по факту.
import * as THREE from 'three';

export const OVERLAY = 1;                       // слой чётких меток
export const GLYPHS = { base: " .`',:;=+*o#%@", grass: " .,'`;!|/\\", water: ' .-_~=' };
export const SETS = ['base', 'grass', 'water'];
export const EDGE = ['|', '\\', '-', '/'];             // контур: штрих вдоль края (по направлению перепада яркости)
// набор по цвету клетки (sRGB 0..1): та же формула, что в шейдере
export function setOf(r, g, b, A) {
  if (g > r * A.grass && g > b && g > .06) return 1;
  if (b > r * A.water && b >= g * .9 && b > .06) return 2;
  return 0;
}
// штрих контура по перепаду яркости (gx — вправо, gy — вверх): та же формула, что в шейдере
export const edgeOf = (gx, gy) => EDGE[(((Math.floor(Math.atan2(gy, gx) / Math.PI * 4 + .5)) % 4) + 4) % 4];
// символы набора по возрастанию «чернил»; levels — столько ступеней, символы растянуты на них (пробел — всегда первая)
export function levelsOf(chars, ink, levels) {
  const s = [...chars].map((ch, i) => ({ ch, v: ink[i] })).sort((a, b) => a.v - b.v || (a.ch === ' ' ? -1 : 1));
  return Array.from({ length: levels }, (_, k) => s[Math.round(k * (s.length - 1) / (levels - 1))].ch);
}

function buildAtlas(A) {
  const [cw, ch] = A.cell, L = A.levels, c = document.createElement('canvas'); c.width = cw * L; c.height = ch * (SETS.length + 1);
  const g = c.getContext('2d', { willReadFrequently: true }), font = `${A.font}px ui-monospace, Menlo, Consolas, monospace`;
  const ink = chr => { g.clearRect(0, 0, cw, ch); g.fillStyle = '#fff'; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(chr, cw / 2, ch / 2 + .5); const d = g.getImageData(0, 0, cw, ch).data; let s = 0; for (let i = 3; i < d.length; i += 4) s += d[i]; return s / (255 * cw * ch); };
  const rows = SETS.map(k => levelsOf(GLYPHS[k], [...GLYPHS[k]].map(ink), L)), inks = rows.map(row => row.map(ink));
  rows.push([...EDGE, ...new Array(L - EDGE.length).fill(' ')]);           // последняя строка — штрихи контура
  g.clearRect(0, 0, c.width, c.height); g.fillStyle = '#fff'; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  rows.forEach((row, s) => row.forEach((chr, k) => g.fillText(chr, k * cw + cw / 2, s * ch + ch / 2 + .5)));
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  return { tex: t, rows, inks, canvas: c };
}

const VERT = 'void main() { gl_Position = vec4(position.xy, 0., 1.); }';
const FRAG = `
uniform sampler2D tScene, tAtlas; uniform vec2 res, cell; uniform float L, gain, gamma, jit, glow, tm, flick, kG, kW, lo, edge; uniform vec3 bg;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float Y(vec2 u) { return dot(pow(max(texture2D(tScene, u).rgb, 0.), vec3(1. / 2.2)), vec3(.299, .587, .114)); }
void main() {
  vec2 px = gl_FragCoord.xy, ci = floor(px / cell), lc = fract(px / cell);
  vec2 u0 = (ci + .5) * cell / res, d = cell * .25 / res;
  vec3 c = pow(max(texture2D(tScene, u0).rgb, 0.), vec3(1. / 2.2));
  float l = dot(c, vec3(.299, .587, .114)), lv = pow(clamp(l * gain, 0., 1.), gamma), h = hash(ci);
  float k = floor(max(0., lv - lo) / (1. - lo) * (L - 1.) + (h - .5) * jit + .5);       // темнее lo — пусто
  k += step(1. - flick, hash(ci + floor(tm * 2.)));                           // редкое мерцание (не при «Уменьшить движение»)
  k = clamp(k, 0., L - 1.);
  float s = (c.g > c.r * kG && c.g > c.b && c.g > .06) ? 1. : (c.b > c.r * kW && c.b >= c.g * .9 && c.b > .06) ? 2. : 0.;
  // контур: перепад яркости между половинами клетки → штрих вдоль края
  float gx = Y(u0 + vec2(d.x, 0.)) - Y(u0 - vec2(d.x, 0.)), gy = Y(u0 + vec2(0., d.y)) - Y(u0 - vec2(0., d.y));
  bool e = length(vec2(gx, gy)) * gain > edge && lv > lo;
  float a = atan(gy, gx), q = mod(floor(a / 3.14159265 * 4. + .5), 4.);         // направление перепада: 0 — по x (край вертикальный)
  if (e) { s = 3.; k = q; }
  float ink = texture2D(tAtlas, vec2((k + lc.x) / L, (3. - s + lc.y) / 4.)).a;
  float m = max(max(c.r, c.g), c.b);
  vec3 col = c / max(m, .08) * (.3 + .7 * lv) * (e ? 1.25 : 1.);
  vec3 o = mix(bg, col, ink) + c * glow * smoothstep(.55, 1., lv) * (1. - ink);
  gl_FragColor = vec4(o, 1.);
}`;

export function createAscii(gl, cfg, calm) {
  const A = cfg.view.ascii, atlas = buildAtlas(A);
  const rt = new THREE.WebGLRenderTarget(8, 8, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });
  const U = {
    tScene: { value: rt.texture }, tAtlas: { value: atlas.tex }, res: { value: new THREE.Vector2(1, 1) }, cell: { value: new THREE.Vector2(...A.cell) },
    L: { value: A.levels }, gain: { value: A.gain }, gamma: { value: A.gamma }, jit: { value: A.jitter }, glow: { value: A.glow }, tm: { value: 0 },
    flick: { value: calm ? 0 : A.flicker }, kG: { value: A.grass }, kW: { value: A.water }, lo: { value: A.lo }, edge: { value: A.edge }, bg: { value: new THREE.Color(A.bg) }
  };
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false }));
  quad.frustumCulled = false; const qs = new THREE.Scene(); qs.add(quad); const qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let W = 1, H = 1;
  return {
    atlas,
    resize(w, h) { W = w; H = h; U.res.value.set(w, h); rt.setSize(Math.max(4, Math.ceil(w / A.cell[0]) * A.sub), Math.max(4, Math.ceil(h / A.cell[1]) * A.sub)); },
    size: () => ({ w: W, h: H, rt: [rt.width, rt.height], cols: Math.ceil(W / A.cell[0]), rows: Math.ceil(H / A.cell[1]) }),
    render(scene, camera, t) {
      U.tm.value = t;
      const mask = camera.layers.mask;
      camera.layers.set(0); gl.setRenderTarget(rt); gl.render(scene, camera);           // 1) сцена в клетки
      gl.setRenderTarget(null); gl.render(qs, qc);                                       // 2) символы на весь экран
      camera.layers.set(OVERLAY); const ac = gl.autoClear; gl.autoClear = false; gl.clearDepth();
      const bgc = scene.background; scene.background = null; gl.render(scene, camera); scene.background = bgc;   // 3) чёткие метки боя
      gl.autoClear = ac; camera.layers.mask = mask;
    },
    dispose() { rt.dispose(); atlas.tex.dispose(); quad.geometry.dispose(); quad.material.dispose(); }
  };
}
