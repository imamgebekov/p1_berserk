# Сборка моделей KayKit в один .glb с цветом в вершинах (4.09, «Облик»): текстура-атлас KayKit — плоские пятна цвета,
# поэтому цвет берётся по UV каждой вершины. На выходе — меши по именам файлов, без текстур (так грузит actors3d.loadBaked).
# Запуск: python3 -I tools/bake-kk.py <папка gltf> <выход.glb> имя1 имя2 ...
import json, struct, sys, os
import numpy as np
from PIL import Image

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

def accessor(g, bins, i):
    a = g['accessors'][i]; v = g['bufferViews'][a['bufferView']]; b = bins[v['buffer']]
    n, k, dt = a['count'], NC[a['type']], CT[a['componentType']]
    off = v.get('byteOffset', 0) + a.get('byteOffset', 0); sz = np.dtype(dt).itemsize; st = v.get('byteStride', 0) or k * sz
    if st == k * sz: out = np.frombuffer(b, dt, count=n * k, offset=off).reshape(n, k).copy()
    else: out = np.array([np.frombuffer(b, dt, count=k, offset=off + j * st) for j in range(n)])
    if a.get('normalized'): out = out.astype(np.float32) / np.iinfo(dt).max
    return out.astype(np.float32) if dt == np.float32 or a.get('normalized') else out

def node_mat(nd):
    if 'matrix' in nd: return np.array(nd['matrix'], np.float64).reshape(4, 4).T
    t = np.array(nd.get('translation', [0, 0, 0])); q = nd.get('rotation', [0, 0, 0, 1]); s = np.array(nd.get('scale', [1, 1, 1]))
    x, y, z, w = q; R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    M = np.eye(4); M[:3, :3] = R * s; M[:3, 3] = t; return M

def bake(path):
    d = os.path.dirname(path)
    if path.endswith('.glb'):     # .glb: JSON и двоичный блок в одном файле
        raw = open(path, 'rb').read(); n = struct.unpack('<I', raw[12:16])[0]; g = json.loads(raw[20:20 + n]); o = 20 + n; ln = struct.unpack('<I', raw[o:o + 4])[0]; bins = [raw[o + 8:o + 8 + ln]]
    else: g = json.load(open(path)); bins = [open(os.path.join(d, b['uri']), 'rb').read() for b in g['buffers']]
    tex = {}
    P, N, C, I = [], [], [], []
    def walk(ni, M):
        nd = g['nodes'][ni]; M = M @ node_mat(nd)
        if 'mesh' in nd:
            for pr in g['meshes'][nd['mesh']]['primitives']:
                at = pr['attributes']; p = accessor(g, bins, at['POSITION']); n = accessor(g, bins, at['NORMAL']) if 'NORMAL' in at else np.zeros_like(p)
                mat = g['materials'][pr['material']] if 'material' in pr else {}; pbr = mat.get('pbrMetallicRoughness', {})
                base = np.array(pbr.get('baseColorFactor', [1, 1, 1, 1])[:3], np.float32)
                if 'baseColorTexture' in pbr and 'TEXCOORD_0' in at:
                    src = g['textures'][pbr['baseColorTexture']['index']]['source']; uri = g['images'][src]['uri']
                    if uri not in tex: tex[uri] = np.asarray(Image.open(os.path.join(d, uri)).convert('RGB'), np.float32) / 255
                    T = tex[uri]; uv = accessor(g, bins, at['TEXCOORD_0']); h, w = T.shape[:2]
                    px = np.clip((uv[:, 0] % 1) * w, 0, w - 1).astype(int); py = np.clip((uv[:, 1] % 1) * h, 0, h - 1).astype(int)
                    col = T[py, px] ** 2.2 * base
                else: col = np.tile(base, (len(p), 1))
                ph = np.c_[p, np.ones(len(p))] @ M.T; nn = n @ M[:3, :3].T; nn /= np.maximum(1e-9, np.linalg.norm(nn, axis=1, keepdims=True))
                idx = accessor(g, bins, pr['indices']).ravel().astype(np.uint32) if 'indices' in pr else np.arange(len(p), dtype=np.uint32)
                I.append(idx + sum(len(x) for x in P)); P.append(ph[:, :3].astype(np.float32)); N.append(nn.astype(np.float32)); C.append(col.astype(np.float32))
        for c in nd.get('children', []): walk(c, M)
    for r in g['scenes'][g.get('scene', 0)]['nodes']: walk(r, np.eye(4))
    return np.concatenate(P), np.concatenate(N), np.concatenate(C), np.concatenate(I)

def write_glb(out, meshes):
    blob = bytearray(); views, accs, gm, nodes = [], [], [], []
    def add(arr, target, typ, ctype, mm=False):
        while len(blob) % 4: blob.append(0)
        views.append({'buffer': 0, 'byteOffset': len(blob), 'byteLength': arr.nbytes, 'target': target}); blob.extend(arr.tobytes())
        a = {'bufferView': len(views) - 1, 'componentType': ctype, 'count': len(arr), 'type': typ}
        if mm: a['min'] = arr.min(0).tolist(); a['max'] = arr.max(0).tolist()
        accs.append(a); return len(accs) - 1
    for name, (P, N, C, I) in meshes:
        ip = add(P, 34962, 'VEC3', 5126, True); inn = add(N, 34962, 'VEC3', 5126); ic = add(C, 34962, 'VEC3', 5126)
        ii = add(I.astype(np.uint32 if len(P) > 65535 else np.uint16), 34963, 'SCALAR', 5125 if len(P) > 65535 else 5123)
        gm.append({'name': name, 'primitives': [{'attributes': {'POSITION': ip, 'NORMAL': inn, 'COLOR_0': ic}, 'indices': ii}]}); nodes.append({'name': name, 'mesh': len(gm) - 1})
    while len(blob) % 4: blob.append(0)
    js = json.dumps({'asset': {'version': '2.0', 'generator': 'bake-kk.py'}, 'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': gm, 'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': len(blob)}]}).encode()
    js += b' ' * (-len(js) % 4)
    with open(out, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob))); f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js); f.write(struct.pack('<II', len(blob), 0x004E4942)); f.write(blob)

if __name__ == '__main__':
    src, out, names = sys.argv[1], sys.argv[2], sys.argv[3:]
    meshes = []
    for spec in names:     # имя[=файл:длина:рукоять] — переименовать, привести длину по y и поставить рукоять (доля от низа) в ноль
        n, _, opt = spec.partition('='); f, ln, grip = (opt.split(':') + ['', '', ''])[:3] if opt else (n, '', '')
        fp = os.path.join(src, f + '.gltf'); fp = fp if os.path.exists(fp) else os.path.join(src, f + '.glb')
        P, N, C, I = bake(fp)
        if ln: lo, hi = P[:, 1].min(), P[:, 1].max(); k = float(ln) / (hi - lo); c = (P[:, [0, 2]].max(0) + P[:, [0, 2]].min(0)) / 2; P = P.copy(); P[:, 0] -= c[0]; P[:, 2] -= c[1]; P[:, 1] -= lo + (hi - lo) * float(grip or 0); P *= k
        meshes.append((n, (P, N, C, I)))
        print(f'{n}: {len(P)} вершин, {len(I) // 3} треуг., размер {np.round(P.max(0) - P.min(0), 2).tolist()}')
    write_glb(out, meshes); print(out, os.path.getsize(out) // 1024, 'КБ')
