// Мягкие «рисованные» материалы (T0–T2): доски, брёвна, кора, камень с мхом, кладка, черепица, ткань, металл и земля по виду
// поверхности (трава, тропа, песок, скала) считаются в шейдере по мировым координатам — без картинок и развёртки. Деталь крупная и плавная (курс «мягко и просто»). Сила — cfg.shaders.paint, на «Низком» выключено (uPK = 0).
import * as THREE from 'three';
let P = null;
const PU = { uPK: { value: 1 } };     // общий множитель силы: качество «Низкое» — 0

export function initPaint(cfgPaint) { P = cfgPaint && cfgPaint.on ? cfgPaint : null; }
export function setPaintLevel(k) { PU.uPK.value = k; }
export const paintOn = () => !!P;

const KIND = { ground: 0, auto: 1, roof: 2, log: 3, nature: 4, masonry: 5, cloth: 6, metal: 7 };
export const PAINT_KINDS = Object.keys(KIND);
// вид детали на слитой геометрии (T3): атрибут pkind уточняет «auto» и «roof» — masonry: серое кладкой (дерево — деревом),
// cloth — ткань, metal — металл, wood — доски, plain — без узора; без атрибута — 0 (по цвету)
export const PART = { auto: 0, masonry: 1, cloth: 2, metal: 3, wood: 4, plain: 5 };
export function tagKind(geo, part) {
  const v = PART[part] ?? 0, n = geo.attributes.position.count, a = new Float32Array(n).fill(v);
  geo.setAttribute('pkind', new THREE.BufferAttribute(a, 1)); return geo;
}

const VERT = `vec4 pw4 = vec4(transformed, 1.);
#ifdef USE_INSTANCING
  pw4 = instanceMatrix * pw4;
#endif
  vPW = (modelMatrix * pw4).xyz; vPN = normalize(mat3(modelMatrix) * objectNormal); vPKo = pkind;`;

const FUNCS = `uniform float uPK, uPS, uPlank, uTile; varying vec3 vPW; varying vec3 vPN; varying float vPKo;
float pH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float pN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(pH(i), pH(i + vec2(1., 0.)), f.x), mix(pH(i + vec2(0., 1.)), pH(i + vec2(1., 1.)), f.x), f.y); }
float pWood(vec3 an) {
  bool top = an.y > .7;
  float across = top ? vPW.z : vPW.y, along = top ? vPW.x : (an.x > an.z ? vPW.z : vPW.x);
  float py = across / uPlank, row = floor(py), e = abs(fract(py) - .5) * 2.;
  float tone = pH(vec2(row, floor(along / (uPlank * 6.) + row * .37))), grain = pN(vec2(along * 1.3, across * 12.));
  return (tone - .5) * .22 + (grain - .5) * .16 - smoothstep(.8, .97, e) * .3;
}
float pStone(vec2 q) { float s = pN(q * 1.6) * .6 + pN(q * 4.1 + 3.) * .4; return (s - .5) * .42; }
float pLog(vec3 an) {
  float along = an.x > an.z ? vPW.z : vPW.x;
  return (pH(vec2(floor(vPW.x * 2.6), floor(vPW.z * 2.6))) - .5) * .18 + (pN(vec2(along * 9., vPW.y * 1.2)) - .5) * .2;
}
float pMoss(vec3 n, float k) { return smoothstep(.45, .85, n.y) * (.45 + .55 * smoothstep(.3, .7, pN(vPW.xz * 1.3 + 4.))) * k; }
float pBark(vec3 an) { float along = an.x > an.z ? vPW.z : vPW.x, g = pN(vec2(along * 7., vPW.y * .9)); return (g - .5) * .34 - smoothstep(.72, .9, g) * .2; }
float pMasonry(vec3 an, vec2 q) {
  if (an.y > .7) { vec2 t = q / 1.1; t.x += floor(t.y) * .5; vec2 e = abs(fract(t) - .5) * 2.;
    return (pH(floor(t)) - .5) * .2 - smoothstep(.86, .97, max(e.x, e.y)) * .32 + (pN(q * 2.) - .5) * .12; }
  float py = vPW.y / .45, row = floor(py), along = an.x > an.z ? vPW.z : vPW.x, u = along / .9 + row * .5;
  float ey = abs(fract(py) - .5) * 2., ex = abs(fract(u) - .5) * 2.;
  return (pH(vec2(row, floor(u))) - .5) * .22 - smoothstep(.82, .96, max(ey, ex)) * .34 + (pN(q * 2.2) - .5) * .12;
}
float pCloth(vec3 an, vec2 q) {
  float along = an.y > .7 ? vPW.x : (an.x > an.z ? vPW.z : vPW.x);
  return sin(along * 7. + pN(q * 1.4) * 4.) * .07 + (pN(q * 1.1) - .5) * .16;
}
float pMetal(vec2 q) { return (pN(vec2(q.x * 1.2, q.y * 14.)) - .5) * .14 - smoothstep(.62, .85, pN(q * 1.7 + 9.)) * .16; }
float pRoof(vec3 an, bool straw) {
  float py = vPW.y / uTile, row = floor(py), lap = smoothstep(0., .4, fract(py));
  float along = an.x > an.z ? vPW.z : vPW.x;
  if (straw) return (pN(vec2(along * 7., py * 1.5)) - .5) * .3 - (1. - lap) * .2;
  float u = along / (uTile * 1.4) + row * .5;
  return (pH(vec2(row, floor(u))) - .5) * .2 - (1. - lap) * .3 - smoothstep(.82, .97, abs(fract(u) - .5) * 2.) * .18;
}`;

const FRAG = `if (uPK > 0.) {
    float pk = uPK * uPS; vec3 an = abs(vPN), c = diffuseColor.rgb;
    vec2 q = an.y > .7 ? vPW.xz : (an.x > an.z ? vPW.zy : vPW.xy);
    float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), rel = (mx - mn) / max(mx, 1e-4), d = 0.;
    bool wood = rel >= .32 && c.r >= c.g && c.g > c.b && c.g > c.r * .3, straw = wood && c.g > c.r * .56;
#if PAINT_KIND == 0
    float b1 = pN(vPW.xz * .21), b2 = pN(vPW.xz * .83 + 11.);
    if (rel < .3) d = pStone(vPW.xz);
    else if (c.g >= c.r) { d = (b1 * .6 + b2 * .4 - .5) * .35; diffuseColor.rgb = mix(c, c * vec3(1.08, 1.04, .86), pk * smoothstep(.6, .85, b1) * .5); }
    else if (mx > .18) d = sin(dot(vPW.xz, vec2(.8, .6)) * 5. + pN(vPW.xz * .5) * 5.) * .06 + (b2 - .5) * .2;
    else d = (b2 - .5) * .3 + smoothstep(.7, .85, pN(vPW.xz * 3.1)) * .14 - smoothstep(.72, .9, pN(vPW.xz * 1.9 + 3.)) * .12;
#elif PAINT_KIND == 3
    d = pLog(an);
#elif PAINT_KIND == 4
    if (rel < .32) { d = pStone(q * 1.4) * 1.4; diffuseColor.rgb = mix(c, vec3(.05, .1, .03), pMoss(vPN, .7 * pk)); }
    else if (wood) d = pBark(an);
#elif PAINT_KIND == 5
    d = pMasonry(an, q);
#elif PAINT_KIND == 6
    d = pCloth(an, q);
#elif PAINT_KIND == 7
    d = pMetal(q);
#else
    int ov = int(vPKo + .5);
    if (ov == 2) d = pCloth(an, q); else if (ov == 3) d = pMetal(q); else if (ov == 4) d = pWood(an); else if (ov == 5) d = 0.; else
  #if PAINT_KIND == 2
    if (an.y > .3 && an.y < .97) d = pRoof(an, straw); else
  #endif
    if (rel < .32) d = ov == 1 ? pMasonry(an, q) : pStone(q); else if (wood) d = pWood(an); else d = (pN(q * .9) - .5) * .2;
#endif
    diffuseColor.rgb *= 1. + pk * d;
  }`;

// kind: ground (трава, тропа, песок, скала — по цвету) | auto (серое — камень, бурое — доски, прочее — лёгкие пятна) |
// roof (скаты — черепица или солома) | log (стоячие брёвна) | nature (кора, камень с мхом сверху; листву не трогает) |
// masonry (кладка рядами, на полу — плиты) | cloth (мягкие складки) | metal (шлифовка и потемнения)
export function paintMat(mat, kind = 'auto', opt = {}) {
  if (!P || !mat || mat.userData.paint) return mat;
  mat.userData.paint = kind;
  const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
  const own = { uPS: { value: P[kind === 'auto' || kind === 'nature' ? 'wood' : kind] ?? 1 }, uPlank: { value: opt.plank || P.plank }, uTile: { value: P.tile } };
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    Object.assign(sh.uniforms, PU, own);
    sh.vertexShader = 'attribute float pkind; varying vec3 vPW; varying vec3 vPN; varying float vPKo;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT);
    sh.fragmentShader = `#define PAINT_KIND ${KIND[kind]}\n` + FUNCS + '\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  ' + FRAG);
  };
  mat.customProgramCacheKey = () => key + '-paint' + kind;
  return mat;
}
