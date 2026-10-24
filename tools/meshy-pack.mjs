// Модель из Meshy → лёгкая модель для игры (2026-10-24): сетка упрощается до заданного числа треугольников (meshoptimizer из three.js),
// остаётся одна цветовая текстура (готовая JPEG, её ужимает питон). Без скелета и анимаций.
// Запуск: node tools/meshy-pack.mjs <вход.glb> <цвет.jpg> <выход.glb> [треугольников=12000]
import { readFileSync, writeFileSync } from 'node:fs';
import { MeshoptSimplifier } from 'three/examples/jsm/libs/meshopt_simplifier.module.js';

const [src, tex, out, tris = '12000'] = process.argv.slice(2);
const raw = readFileSync(src), jl = raw.readUInt32LE(12), g = JSON.parse(raw.subarray(20, 20 + jl).toString()), bin = raw.subarray(20 + jl + 8);
const T = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }, N = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const acc = i => { const a = g.accessors[i], v = g.bufferViews[a.bufferView], C = T[a.componentType], o = bin.byteOffset + (v.byteOffset || 0) + (a.byteOffset || 0); return new C(bin.buffer.slice(o, o + a.count * N[a.type] * C.BYTES_PER_ELEMENT)); };
const pr = g.meshes[0].primitives[0], P = acc(pr.attributes.POSITION), Nn = acc(pr.attributes.NORMAL), UV = acc(pr.attributes.TEXCOORD_0), I0 = Uint32Array.from(acc(pr.indices));

await MeshoptSimplifier.ready;
const want = Math.min(I0.length, Number(tris) * 3), [I1, err] = MeshoptSimplifier.simplify(I0, P, 3, want, .05, []);     // швы текстуры simplify держит сам (вершины с одной позицией)
const map = new Int32Array(P.length / 3).fill(-1), keep = []; for (const i of I1) if (map[i] < 0) { map[i] = keep.length; keep.push(i); }
const p = new Float32Array(keep.length * 3), n = new Float32Array(keep.length * 3), uv = new Float32Array(keep.length * 2), idx = (keep.length > 65535 ? Uint32Array : Uint16Array).from(I1, i => map[i]);
keep.forEach((s, d) => { p.set(P.subarray(s * 3, s * 3 + 3), d * 3); n.set(Nn.subarray(s * 3, s * 3 + 3), d * 3); uv.set(UV.subarray(s * 2, s * 2 + 2), d * 2); });

const parts = [], views = [], accs = []; let off = 0;
const add = (arr, target, extra) => { const b = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength); const pad = (4 - (b.length % 4)) % 4; views.push({ buffer: 0, byteOffset: off, byteLength: b.length, ...(target ? { target } : {}) }); parts.push(b, Buffer.alloc(pad)); off += b.length + pad; if (extra) accs.push({ bufferView: views.length - 1, ...extra }); return views.length - 1; };
const mn = [0, 1, 2].map(k => Math.min(...p.filter((_, i) => i % 3 === k))), mx = [0, 1, 2].map(k => Math.max(...p.filter((_, i) => i % 3 === k)));
add(p, 34962, { componentType: 5126, count: keep.length, type: 'VEC3', min: mn, max: mx }); add(n, 34962, { componentType: 5126, count: keep.length, type: 'VEC3' }); add(uv, 34962, { componentType: 5126, count: keep.length, type: 'VEC2' });
add(idx, 34963, { componentType: idx instanceof Uint32Array ? 5125 : 5123, count: idx.length, type: 'SCALAR' });
const iv = add(new Uint8Array(readFileSync(tex)));
const doc = { asset: { version: '2.0', generator: 'meshy-pack.mjs' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: 'Model', mesh: 0 }],
  meshes: [{ name: 'Model', primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }] }],
  materials: [{ name: 'Model', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1 } }],
  textures: [{ source: 0, sampler: 0 }], samplers: [{ magFilter: 9729, minFilter: 9987 }], images: [{ bufferView: iv, mimeType: 'image/jpeg' }],
  accessors: accs, bufferViews: views, buffers: [{ byteLength: off }] };
let js = Buffer.from(JSON.stringify(doc)); js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 32)]);
const body = Buffer.concat(parts), head = Buffer.alloc(12); head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + body.length, 8);
const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
writeFileSync(out, Buffer.concat([head, ch(js.length, 0x4E4F534A), js, ch(body.length, 0x004E4942), body]));
console.log(`${src}: ${I0.length / 3} → ${idx.length / 3} треуг. (ошибка ${err.toFixed(4)}), вершин ${keep.length}, файл ${(12 + 16 + js.length + body.length) >> 10} КБ`);
