// Готовые 3D-модели (2026-10-20, выбор владельца): KayKit (CC0), Quaternius (CC0), Sketchfab (CC BY). Только графика.
// Модели грузятся в фоне; пока модель не пришла (или её нет) — рисуется своя, из кубиков. У модели — свой AnimationMixer:
// клип выбирается по состоянию героя или врага (стоит, идёт, бежит, бьёт, целится, перекат, ранен, умер).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { makeWeapon, kkWeapon, kkShield, setKkWeapons, kkReady } from './weaponview.js';
import { familyOf } from './anim3d.js';

const URLS = import.meta.glob('../models/*.glb', { query: '?url', import: 'default', eager: true });
const urlOf = k => URLS[`../models/${k}.glb`] || null;
const KK_ANIMS = ['kk_anim_general', 'kk_anim_movementbasic', 'kk_anim_movementadvanced', 'kk_anim_combatmelee', 'kk_anim_combatranged', 'kk_anim_special'];
const lib = new Map();     // ключ модели → { scene, clips, h } или промис загрузки
let kkClips = null, loader = null;
const ld = () => loader || (loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder));
const clipName = c => c.name.includes('|') ? c.name.slice(c.name.lastIndexOf('|') + 1) : c.name;

// действия → имена клипов по порядку предпочтения (первый найденный)
const ACT = {
  idle: ['Idle_A', 'Idle', 'idle', '@-Idle_01', 'travelidle', 'Warrior_Idle', 'Flying_Idle', 'Idle_Weapon', 'Skeletons_Idle'],
  walk: ['Walking_A', 'Walk', '@-walk_01', 'travelmove', 'Warrior_Walk', 'Fast_Flying', 'Flying_Idle', 'Skeletons_Walking'],
  run: ['Running_A', 'Run', '@-run_01', 'travelrun', 'Gallop', 'Run_Weapon', 'Fast_Flying', 'Walk'],
  hit: ['Hit_A', '@-hit_01', 'hurtsmall', 'Defence1', 'HitReact', 'RecieveHit', 'HitRecieve', 'Idle_HitReact_Left', 'Hit_B'],
  death: ['Death_A', 'Death', '@-death_01', 'dead', 'Skeletons_Death'],
  roll: ['Dodge_Forward', 'Roll', 'Jump'],
  a1: ['Melee_1H_Attack_Slice_Diagonal', 'Weapon', 'Attack1', 'Attack Combo', '@-attack_01', 'attack_2', 'Sword_Slash', 'Staff_Attack', 'Attack', 'Punch', 'Headbutt', 'Bite_Front'],
  a2: ['Melee_1H_Attack_Slice_Horizontal', 'Punch', 'Sword_Slash', 'Staff_Attack', 'Attack', 'Headbutt'],
  a3: ['Melee_1H_Attack_Chop', 'Weapon', 'Staff_Attack', 'Attack', 'Punch'],
  h1: ['Melee_2H_Attack_Slice', 'Weapon', 'Sword_Slash', 'Attack'], h2: ['Melee_2H_Attack_Chop', 'Weapon', 'Attack'], h3: ['Melee_2H_Attack_Spin', 'Weapon', 'Attack'],
  d1: ['Melee_Dualwield_Attack_Slice', 'Melee_1H_Attack_Slice_Diagonal'], d2: ['Melee_Dualwield_Attack_Stab', 'Melee_1H_Attack_Stab'], d3: ['Melee_Dualwield_Attack_Chop', 'Melee_1H_Attack_Chop'],
  p1: ['Melee_1H_Attack_Stab', 'Melee_2H_Attack_Stab', 'Weapon', 'Attack'],
  fist: ['Melee_Unarmed_Attack_Punch_A', 'Punch', 'Melee_Unarmed_Attack_Kick'],
  bow: ['Ranged_Bow_Release', 'Ranged_2H_Shoot', 'Spell1', 'Attack'], aim: ['Ranged_Bow_Draw', 'Ranged_Bow_Aiming_Idle', 'Ranged_Magic_Raise', 'Spell2', 'Idle_Attacking', 'Idle'],
  cast: ['Ranged_Magic_Shoot', 'Spell1', 'Ranged_Magic_Spellcasting', 'Staff_Attack', 'Punch'], spell: ['Ranged_Magic_Spellcasting', 'Spell2', 'Spell1', 'Ranged_Magic_Shoot'],
  block: ['Melee_Blocking', 'Melee_Block', 'Idle_Attacking', 'Idle'], charge: ['Melee_2H_Idle', 'Melee_Blocking', 'Idle_Attacking', 'Idle'],
  spawn: ['Skeletons_Awaken_Standing', 'Spawn_Ground', 'Idle'],
  graze: ['Eating', 'Bite_Front', 'Idle_2', 'Idle'], fly: ['Fast_Flying', 'Flying_Idle', 'Jump', 'Walk'], peck: ['Bite_Front', 'Eating', 'Idle'], work: ['Interact', 'Idle_Neutral', 'Idle']
};
// семейство оружия → три удара цепочки (прямой, обратный, завершающий)
const CHAIN = { slash: ['a1', 'a2', 'a3'], thrust: ['p1', 'a1', 'p1'], smash: ['h1', 'h2', 'h2'], spin: ['h1', 'h3', 'h3'], flail: ['h2', 'h1', 'h2'], dual: ['d1', 'd2', 'd3'], fists: ['fist', 'fist', 'a3'], bow: ['bow', 'bow', 'bow'], staff: ['cast', 'cast', 'spell'] };
const famKey = f => (CHAIN[f] ? f : 'slash');
const LOCO = new Set(['walk', 'run']);     // циклы шага: при смене — та же фаза ног

async function loadKk() {
  if (kkClips) return kkClips;
  const all = []; for (const k of KK_ANIMS) { const u = urlOf(k); if (u) all.push(...(await ld().loadAsync(u)).animations); }
  return (kkClips = all);
}
// клипы на месте (2026-10-21): у части моделей в ходьбе и ударе корень уходит вперёд — на стыке цикла модель прыгает назад, после удара
// отъезжает. У корневых костей убираем равномерный уход за клип (колебания шага остаются); двигает модель игра. Смерть не трогаем
const KEEP = new Set(ACT.death);     // смерть падает по-настоящему — её не трогаем
function inPlace(clips, scene) {
  const roots = new Set(); scene.traverse(o => { if (o.isBone && (!(o.parent && o.parent.isBone) || /hips|pelvis|root/i.test(o.name))) roots.add(THREE.PropertyBinding.sanitizeNodeName(o.name)); });
  for (const c of clips) { if (c.userData && c.userData.inPlace || KEEP.has(clipName(c))) continue; (c.userData = c.userData || {}).inPlace = true;
    for (const t of c.tracks) { const [node, prop] = [t.name.slice(0, t.name.lastIndexOf('.')), t.name.slice(t.name.lastIndexOf('.') + 1)]; if (prop !== 'position' || !roots.has(THREE.PropertyBinding.sanitizeNodeName(node))) continue;
      const v = t.values, n = t.times.length, T = t.times[n - 1] - t.times[0]; if (n < 2 || T <= 0) continue;
      for (let ax = 0; ax < 3; ax++) { const d = v[(n - 1) * 3 + ax] - v[ax]; let lo = Infinity, hi = -Infinity; for (let i = 0; i < n; i++) { lo = Math.min(lo, v[i * 3 + ax]); hi = Math.max(hi, v[i * 3 + ax]); }
        if (Math.abs(d) > (hi - lo) * .5 && Math.abs(d) > 1e-4) for (let i = 0; i < n; i++) v[i * 3 + ax] -= d * (t.times[i] - t.times[0]) / T; } } }
}
function recolor(scene, kit) {     // перекраска KayKit (путь А, 2026-10-22): текстура — сетка grid ячеек-полос, ячейка — часть одежды; recolor { 'столбец,строка': цвет }, перепад света в полосе сохраняется
  const done = new Map(), [gc, gr] = kit.grid || [8, 4], C = new THREE.Color();
  scene.traverse(o => { if (!o.isMesh || !o.material.map) return; const src = o.material.map;
    if (!done.has(src)) { const img = src.image, w = img.width, h = img.height, cv = document.createElement('canvas'); cv.width = w; cv.height = h; const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
      const D = cx.getImageData(0, 0, w, h), d = D.data, cw = w / gc, ch = h / gr;
      for (const [cell, col] of Object.entries(kit.recolor)) { const [c, r] = cell.split(',').map(Number), x0 = Math.round(c * cw), y0 = Math.round(r * ch), x1 = Math.round((c + 1) * cw), y1 = Math.round((r + 1) * ch); C.set(col);
        const T = [C.r, C.g, C.b].map(v => Math.round(Math.pow(v, 1 / 2.2) * 255)), lum = i => .3 * d[i] + .55 * d[i + 1] + .15 * d[i + 2]; let sum = 0, n = 0;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { sum += lum((y * w + x) * 4); n++; }
        const mean = Math.max(1, sum / n);
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * w + x) * 4, k = lum(i) / mean; for (let j = 0; j < 3; j++) d[i + j] = Math.min(255, T[j] * k); } }
      cx.putImageData(D, 0, 0); const t = src.clone(); t.image = cv; t.needsUpdate = true; done.set(src, t); }
    o.material.map = done.get(src); });
}
function cutAbove(scene, cut) {     // убрать часть меша (нимб у демонов): треугольники материала mat выше доли above его высоты в мире
  scene.updateMatrixWorld(true); const v = new THREE.Vector3();
  scene.traverse(o => { if (!o.isMesh) return; const c = cut.find(x => x.mat === o.material.name); if (!c) return;
    const geo = o.geometry, P = geo.attributes.position, I = geo.index ? geo.index.array : [...Array(P.count).keys()], ys = new Float32Array(P.count); let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); ys[i] = v.y; lo = Math.min(lo, v.y); hi = Math.max(hi, v.y); }
    const lim = lo + (hi - lo) * c.above, keep = []; for (let t = 0; t < I.length; t += 3) if ((ys[I[t]] + ys[I[t + 1]] + ys[I[t + 2]]) / 3 <= lim) keep.push(I[t], I[t + 1], I[t + 2]);
    geo.setIndex(keep); });
}
const PG = new Map(), pg = (k, f) => PG.get(k) || (PG.set(k, f()), PG.get(k));     // детали сборки боссов (пилот, 2026-10-22): гладкие формы в духе KayKit, размеры в метрах
const smooth = g => { g.computeVertexNormals(); g.userData.shared = true; return g; };
const PART = {
  moss: c => [[pg('moss', () => smooth(new THREE.IcosahedronGeometry(.5, 2))), c[0] || '#4f6e30', [0, 0, 0], [1, .55, 1]]],
  mushroom: c => [[pg('stem', () => smooth(new THREE.CylinderGeometry(.07, .09, .26, 10))), '#e6dcc0', [0, .13, 0]], [pg('cap', () => smooth(new THREE.SphereGeometry(.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2))), c[0] || '#a8402a', [0, .24, 0], [1, .8, 1]]],
  tusk: c => [[pg('tusk', () => smooth(new THREE.ConeGeometry(.07, .34, 10))), c[0] || '#e6dcc0', [0, .17, 0]]],
  crown: c => { const out = [[pg('ring', () => { const g = smooth(new THREE.CylinderGeometry(.2, .18, .12, 18, 1, true)); return g; }), c[0] || '#a9b0b4', [0, .06, 0], 1, true]];
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; out.push([pg('spike', () => smooth(new THREE.ConeGeometry(.04, .16, 8))), c[0] || '#a9b0b4', [Math.sin(a) * .19, .18, Math.cos(a) * .19]], [pg('pearl', () => smooth(new THREE.SphereGeometry(.035, 10, 8))), c[1] || '#e8e4d8', [Math.sin(a) * .19, .27, Math.cos(a) * .19]]); }
    return out; },
  helm: c => [[pg('helm', () => smooth(new THREE.CylinderGeometry(.3, .32, .44, 16))), c[0] || '#5b5f63', [0, 0, 0]], [pg('helmtop', () => smooth(new THREE.SphereGeometry(.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2))), c[0] || '#5b5f63', [0, .22, 0]], [pg('slit', () => smooth(new THREE.BoxGeometry(.4, .05, .06))), c[1] || '#ff8a2a', [0, .02, .3], 1, false, true]]
};
function attachParts(root, obj, kit, mats) {     // kit.attach: [{ p: вид детали, bone, at: [x, y, z] — смещение от кости в осях модели, м; rot — поворот в осях модели; s — размер; c — цвета }]
  root.updateMatrixWorld(true); const v = new THREE.Vector3();
  for (const a of kit.attach) { const bone = byName(obj, a.bone); if (!bone || !PART[a.p]) continue; const grp = new THREE.Group();
    for (const [geo, col, pos, sc, two, glow] of PART[a.p](a.c || [])) { const m = new THREE.MeshLambertMaterial({ color: col, side: two ? THREE.DoubleSide : THREE.FrontSide }); if (glow) m.emissive.set(col); mats.push(m);
      const me = new THREE.Mesh(geo, m); me.position.set(...pos); if (sc) Array.isArray(sc) ? me.scale.set(...sc) : me.scale.setScalar(sc); me.castShadow = true; grp.add(me); }
    bone.getWorldPosition(v); root.worldToLocal(v); grp.position.copy(v).add(new THREE.Vector3(...(a.at || [0, 0, 0]))); grp.scale.setScalar(a.s || 1); if (a.rot) grp.rotation.set(...a.rot);
    root.add(grp); grp.updateMatrixWorld(true); bone.attach(grp); }     // в позе покоя ставим в осях модели, потом крепим к кости с тем же положением
}
// загрузить модель (один раз); kit — описание из cfg.actors.kits
export function loadActor(key, kit) {
  if (lib.has(key)) return lib.get(key);
  const u = urlOf(kit.src || key); if (!u) { lib.set(key, null); return null; }     // src — другой файл модели (вариант с перекраской)
  const p = (async () => {
    const g = await ld().loadAsync(u), clips = [...g.animations, ...(kit.anims === 'kk' ? await loadKk() : [])];
    for (const [nm, [t0, t1]] of Object.entries(kit.split || {})) { const c = clips[0]; if (c) clips.push(THREE.AnimationUtils.subclip(c, nm, Math.round(t0 * 30), Math.round(t1 * 30), 30)); }     // одна склейка «поза-стойка-ходьба» → свои клипы
    g.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.geometry.userData.shared = true; o.frustumCulled = false; const ms = Array.isArray(o.material) ? o.material : [o.material]; o.material = ms.map(m => new THREE.MeshLambertMaterial({ name: m.name, map: m.map || null, color: m.color ? m.color.clone() : 0xffffff, transparent: m.transparent, alphaTest: m.alphaTest || 0, emissive: m.emissive ? m.emissive.clone().multiplyScalar(m.emissiveIntensity ?? 1) : 0x000000, emissiveMap: m.emissiveMap || null }))[0]; } });
    if (kit.recolor) recolor(g.scene, kit);
    if (kit.mats || kit.glow) g.scene.traverse(o => { if (!o.isMesh) return; const m = o.material, c = kit.mats && kit.mats[m.name], e = kit.glow && kit.glow[m.name]; if (c) m.color.set(c); if (e) m.emissive.set(e); });     // монстры без текстур: цвет и свечение по имени материала
    if (kit.cut) cutAbove(g.scene, kit.cut);
    inPlace(clips, g.scene);
    const box = new THREE.Box3().setFromObject(g.scene), h = Math.max(.01, box.max.y - box.min.y);
    const v = { scene: g.scene, clips, h, minY: box.min.y }; lib.set(key, v); return v;
  })().catch(e => { console.warn('модель не загрузилась:', key, e && e.message); lib.set(key, null); return null; });
  lib.set(key, p); return p;
}
export const actorReady = key => { const v = lib.get(key); return v && !(v instanceof Promise) ? v : null; };
export function preloadActors(cfg) { const A = cfg.actors; if (!A || !A.on) return; for (const [k, kit] of Object.entries(A.kits)) loadActor(k, kit); loadKkWeapons(); }
let kwP = null;     // оружие KayKit (путь А): грузится один раз, потом руки моделей KayKit берут его
export function loadKkWeapons() { if (kwP) return kwP; const u = urlOf('kk_weapons'); if (!u || OFF) return (kwP = Promise.resolve(null));
  return (kwP = ld().loadAsync(u).then(g => { const out = {}; g.scene.traverse(o => { if (o.isMesh) out[o.name] = o.geometry; }); setKkWeapons(out); return out; }).catch(e => { console.warn('оружие KayKit не загрузилось:', e && e.message); return null; })); }

// экземпляр модели: группа как у своих моделей (group, root, flash, kind), рука с оружием
const byName = (o, n) => o.getObjectByName(n) || o.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(n));     // загрузчик убирает точки из имён (handslot.r → handslotr)
export function makeActor(key, kit, kind = 'actor') {
  const src = actorReady(key); if (!src) return null;
  const obj = cloneSkinned(src.scene), g = new THREE.Group(), root = new THREE.Group(); g.add(root); root.add(obj); g.userData.actor = key;     // для тестов: какая модель
  const s = kit.height / src.h; obj.scale.setScalar(s); obj.position.y = -src.minY * s; if (kit.yaw) obj.rotation.y = kit.yaw;
  const mats = []; obj.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); mats.push(o.material); if (kit.tint) o.material.color.multiply(new THREE.Color(kit.tint)); } });
  for (const n of kit.hide || []) { const o = byName(obj, n); if (o) o.visible = false; }
  if (kit.attach) attachParts(root, obj, kit, mats);
  const mixer = new THREE.AnimationMixer(obj), names = new Map(src.clips.map(c => [clipName(c), c])), acts = new Map();
  const clipOf = a => { const b = a.endsWith('#') ? a.slice(0, -1) : a; for (const n of ACT[b] || [b]) if (names.has(n)) return names.get(n); return null; };
  const action = a => { if (acts.has(a)) return acts.get(a); const c = clipOf(a), x = c ? mixer.clipAction(a.endsWith('#') ? c.clone() : c) : null; acts.set(a, x); return x; };     // «имя#» — копия клипа: повтор того же удара смешивается сам с собой
  const A = { group: g, root, obj, mixer, mats, kind, gltf: true, key, kit, cur: null, curName: '', once: false, weapon: null, wkey: '', family: 'fists', okey: '', off: null, hurtT: 0,
    hand: byName(obj, kit.hand || 'handslot.r'), handL: byName(obj, kit.handL || 'handslot.l'), has: a => !!clipOf(a), dur: a => { const c = clipOf(a); return c ? c.duration : 1; } };
  // сыграть действие: fade — время смешивания, once — один раз и замереть на последнем кадре, speed — скорость, restart — сначала.
  // Смешивание своё (2026-10-21): прежние клипы гаснут за fade, новый получает остаток — сумма весов всегда 1 (без «провала» в исходную позу);
  // цикл, который ещё не погас, продолжается с того же кадра; шаг ↔ бег — в той же фазе ног
  A.fade = .15;
  A.play = (a, { fade = .15, once = false, speed = 1, restart = false } = {}) => {
    if (!action(a)) return false;
    if (A.curName === a && !restart) { A.cur.timeScale = speed; return true; }
    if (A.curName === a && restart && !once) { A.cur.time = 0; A.cur.timeScale = speed; return true; }
    const name = A.curName === a ? (A.alt = !A.alt) ? a + '#' : a : a, x = action(name) || action(a);     // тот же удар ещё раз — через копию
    const prev = A.cur, w0 = x.getEffectiveWeight(), live = x.isRunning() && w0 > .01;
    x.enabled = true; x.timeScale = speed; x.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); x.clampWhenFinished = once;
    if (once || restart || !live) { x.reset(); x.setEffectiveWeight(prev ? 0 : 1); }
    if (!once && prev && LOCO.has(A.curName) && LOCO.has(a)) { const pc = prev.getClip().duration, xc = x.getClip().duration; if (pc > 0 && xc > 0) x.time = (prev.time % pc) / pc * xc; }
    x.paused = false; x.play();
    A.cur = x; A.curName = a; A.once = once; A.fade = Math.max(0, fade); if (!prev || !A.fade) for (const y of acts.values()) if (y && y !== x) { y.setEffectiveWeight(0); y.stop(); } if (!prev || !A.fade) x.setEffectiveWeight(1);
    return true;
  };
  // шаг смешивания и анимации: прежние гаснут с одной скоростью, текущий — остаток до 1
  A.update = dt => {
    if (kit.anims === 'kk' && kkReady() && !A.kkOn) { A.kkOn = true; if (A.wArgs) A.setWeapon(...A.wArgs); if (A.oArgs) A.setOff(...A.oArgs); }     // оружие KayKit пришло позже модели
    let rest = 0; const k = A.fade > 0 ? dt / A.fade : 1;
    for (const y of acts.values()) { if (!y || y === A.cur || !y.enabled || y.getEffectiveWeight() <= 0) continue; const w = Math.max(0, y.getEffectiveWeight() - k); if (w <= 0) { y.setEffectiveWeight(0); y.stop(); } else { y.setEffectiveWeight(w); rest += w; } }     // гаснет и законченный удар, замерший на последнем кадре
    if (A.cur) A.cur.setEffectiveWeight(Math.max(0, 1 - rest));
    mixer.update(dt);
  };
  // вспышка при уроне и цвет статуса (как у своих моделей)
  for (const m of mats) m.userData.e0 = m.emissive.clone();     // своё свечение модели (лава голема) — основа, вспышка добавляется
  A.flash = (f, tint) => { for (const m of mats) { const e0 = m.userData.e0; if (tint) m.emissive.setRGB(e0.r + tint[0], e0.g + tint[1], e0.b + tint[2]); else m.emissive.setRGB(e0.r + f * .9, e0.g + f * .25, e0.b + f * .2); } };
  const scaleFix = () => { const v = new THREE.Vector3(); A.hand.getWorldScale(v); return v.x > 0 ? 1 / v.x : 1; };
  // оружие в руке: своя модель оружия (те же размеры, что у героя из кубиков), рукоять — в ладони
  A.setWeapon = (wk, mat) => {
    A.wArgs = [wk, mat];
    const key2 = wk + '|' + mat + (kit.anims === 'kk' && kkReady() ? '|kk' : ''); if (key2 === A.wkey || !A.hand) return; A.wkey = key2;     // |kk — оружие KayKit пришло: заменить своё
    if (A.weapon) A.hand.remove(A.weapon.group);
    A.family = familyOf(wk); if (wk === 'fists') { A.weapon = null; return; }
    g.updateMatrixWorld(true); const kw = kit.anims === 'kk' && kkWeapon(wk, mat);     // у KayKit — своё оружие KayKit в ладони, в единицах скелета
    const w = kw || makeWeapon(wk, mat); if (!kw) { w.group.scale.setScalar(scaleFix() * (kit.wScale || .55)); if (kit.wRot) w.group.rotation.set(...kit.wRot); }
    A.hand.add(w.group); A.weapon = w;
  };
  A.setOff = (key0, kindO, mat, form) => {
    A.oArgs = [key0, kindO, mat, form];
    const key2 = key0 && key0 + (kit.anims === 'kk' && kkReady() ? '|kk' : ''); if (key2 === A.okey || !A.handL) return; A.okey = key2;
    if (A.off) A.handL.remove(A.off); A.off = null; if (!key2) return;
    g.updateMatrixWorld(true); const o = new THREE.Group();
    const kwo = kit.anims === 'kk' && (kindO === 'shield' ? kkShield(form) : kkWeapon(kindO, mat));     // KayKit: щит и второе оружие из набора, без подгонки масштаба
    if (kwo) { o.add(kwo.group || kwo); A.handL.add(o); A.off = o; return; }
    if (kindO === 'shield') { const big = form === 'tower', M2 = new THREE.MeshLambertMaterial({ color: ({ iron: '#9a9890', tempered: '#b8b4a8', steel: '#cfc9bb', black: '#3e3a46' })[mat] || '#9a9890' });
      o.add(new THREE.Mesh(new THREE.BoxGeometry(.08, big ? 1.1 : .6, big ? .7 : .6), new THREE.MeshLambertMaterial({ color: '#5a3e26' })), new THREE.Mesh(new THREE.BoxGeometry(.03, big ? 1.14 : .64, big ? .74 : .64), M2).translateX(-.05)); o.rotation.y = Math.PI / 2; }
    else { const w = makeWeapon(kindO, mat); o.add(w.group); if (kit.wRot) o.rotation.set(...kit.wRot); }
    o.scale.multiplyScalar(scaleFix() * (kit.wScale || .55) * (kindO === 'shield' ? 1.35 : 1)); A.handL.add(o); A.off = o;     // щит крупнее: у готовых моделей кисть меньше, сверху щит виден ребром
  };
  // облик по броне: шлем/шляпа видны, если надето на голову; цвет плаща
  A.setLook = L => { for (const n of kit.helm || []) { const o = byName(obj, n); if (o) o.visible = !!(L && L.helm); } for (const n of kit.cape || []) { const o = byName(obj, n); if (o && L && L.cape && o.material) o.material.color.set(L.cape).lerp(new THREE.Color('#ffffff'), .45); } };
  // заглушки под код своих моделей (руки, ноги, голова, крылья): рендер может их крутить — на готовую модель это не влияет
  const dummy = () => new THREE.Object3D(); Object.assign(A, { armL: dummy(), armR: dummy(), head: dummy(), legs: [], wl: dummy(), wr: dummy() });
  // житель или зверь: действие (idle, walk, run, graze, fly…) и шаг анимации
  A.tick = (dt, act = 'idle', speed = 1) => { if (!A.play(act, { fade: .3, speed })) A.play('idle', { fade: .3 }); A.update(dt); };
  // конь: шаг по скорости, как у своей модели
  A.step = (t, sp) => { const d = Math.min(.1, Math.max(0, t - (A.lt ?? t))); A.lt = t; A.tick(d, sp > 5 ? 'run' : sp > .5 ? 'walk' : 'idle', sp > 5 ? sp / 9 : sp > .5 ? Math.max(.6, sp / 3) : 1); };
  if (kit.gear) { const [w, m, o, f] = kit.gear; A.setWeapon(w, m || 'iron'); if (o) A.setOff('gear', o, m || 'iron', f); }     // оружие врага; герой и спутник потом ставят своё
  A.play('idle', { fade: 0 }); g.userData.anim = A;     // для тестов и замеров плавности
  return A;
}

const AN = cfg => cfg.actors && cfg.actors.anim || { loco: .25, atk: .1, roll: .08, hit: .1, death: .15, hitGap: .8, walkOn: .1, walkOff: .05, runOn: .62, runOff: .48, sp: 10 };
// шаг по сглаженной скорости с запасом у порогов: на границе «шаг/бег» клип не переключается каждый кадр
function loco(A, sp, top, N) {
  const was = A.curName, mv = sp > top * (was === 'walk' || was === 'run' ? N.walkOff : N.walkOn), run = mv && sp > top * (was === 'run' ? N.runOff : N.runOn);
  return mv ? (run ? 'run' : 'walk') : 'idle';
}
// герой (и спутник-герой): клип по состоянию игрока p
export function driveHero(A, p, dt, cfg, swingMul = 1) {
  const P = cfg.player, N = AN(cfg), raw = Math.hypot(p.vx || 0, p.vz || 0);
  A.sp = A.sp === undefined ? raw : A.sp + (raw - A.sp) * (1 - Math.exp(-N.sp * dt)); A.hitGap = Math.max(0, (A.hitGap || 0) - dt);
  const speed = A.sp;
  if (p.dead || p.state === 'dead') { if (A.curName !== 'death') A.play('death', { once: true, fade: N.death }); }
  else if (p.state === 'roll') A.play('roll', { once: true, fade: N.roll, speed: A.dur('roll') / P.rollTime, restart: A.curName !== 'roll' });
  else if (p.state === 'atk') {
    const ch = CHAIN[famKey(A.family)], step = p.heavy > 0 || p.fin ? 2 : ((p.chain || 0) % 2), a = ch[step], len = P.attackTime * swingMul;
    const fresh = A.lastAtkT === undefined || p.atkT < A.lastAtkT - 1e-6;     // удар начался или следующий в серии (время удара пошло заново); atkId игра не задаёт — до 3.95 удар не проигрывался
    if (fresh) A.play(a, { once: true, fade: N.atk, speed: Math.max(.6, A.dur(a) * .8 / len), restart: true });
    A.lastAtkT = p.atkT;
  } else if (p.state === 'charge') A.play('charge', { fade: N.atk });
  else if (p.state === 'dash') A.play('run', { fade: N.roll, speed: 1.6 });
  else if (A.hurtT > 0 && A.curName !== 'hit' && !A.hitGap && raw < .5) { A.hitGap = N.hitGap; A.play('hit', { once: true, fade: N.hit, restart: true }); }     // не чаще раза в hitGap с
  else if (!(A.once && A.cur && A.cur.isRunning() && A.curName === 'hit')) {
    const st = loco(A, speed, P.speed, N); A.play(st, { fade: N.loco, speed: st === 'idle' ? 1 : Math.max(.6, speed / (st === 'run' ? P.speed : P.speed * .45)) });
  }
  if (p.state !== 'atk') A.lastAtkT = undefined;
  A.update(dt);
}
// враг: клип по состоянию e (замах, удар, отход, прицел, рывок, смерть) и по настоящей скорости
export function driveFoe(A, e, time, dt, cfg) {
  const C = cfg.enemies[e.type], N = AN(cfg);
  { const dtm = time - (A.lt ?? time); if (dtm > 0) { const v = Math.hypot(e.x - A.lx, e.z - A.lz) / dtm; A.sp = (A.sp || 0) + (Math.min(v, C.speed * 2) - (A.sp || 0)) * (1 - Math.exp(-N.sp * dtm)); } A.lt = time; A.lx = e.x; A.lz = e.z; }     // сглаживание не зависит от частоты кадров
  A.hitGap = Math.max(0, (A.hitGap || 0) - dt);
  const atkA = A.kit.atk || 'a1';
  if (e.dead) { if (A.curName !== 'death') A.play('death', { once: true, fade: N.death }); }
  else if (e.state === 'wind') { if (A.curName !== atkA) A.play(atkA, { once: true, fade: N.atk, speed: Math.max(.4, A.dur(atkA) * .45 / Math.max(.15, C.wind || .5)), restart: true }); }
  else if (e.state === 'rec') { if (A.curName === atkA && A.cur) A.cur.timeScale = Math.max(1, A.cur.timeScale); else A.play('idle', { fade: N.loco }); }
  else if (e.state === 'aim') A.play(A.kit.aim || 'aim', { fade: N.atk });
  else if (e.state === 'dash') A.play('run', { fade: N.roll, speed: 1.5 });
  else if (e.flash > 0 && A.curName !== 'hit' && !A.hitGap && (A.sp || 0) < .3) { A.hitGap = N.hitGap; A.play('hit', { once: true, fade: N.hit, restart: true }); }
  else if (!(A.curName === 'hit' && A.cur && A.cur.isRunning())) { const sp = A.sp || 0, st = loco(A, sp, C.speed, N); A.play(st, { fade: N.loco, speed: st === 'idle' ? 1 : Math.max(.6, sp / (st === 'run' ? C.speed : C.speed * .6)) }); }
  // у модели нет клипа удара или смерти — простой наклон корня (замах, удар, падение)
  { const R = A.root; R.rotation.set(0, 0, 0); R.position.set(0, 0, 0);
    if (e.dead && !A.has('death')) { const k = Math.min(1, (e.deadT || 0) / .5); R.rotation.z = -1.45 * k; R.position.y = -.15 * k; }
    else if (!A.has(atkA) && e.state === 'wind') { const k = Math.min(1, Math.max(0, e.t) / Math.max(.15, C.wind || .5)); R.rotation.x = -.3 * k; R.position.z = -.15 * k; }
    else if (!A.has(atkA) && e.state === 'rec') { const k = Math.min(1, e.t / .25); R.rotation.x = .4 * (1 - k); R.position.z = .3 * (1 - k); } }
  A.update(dt);
}
export function disposeActor(A) { if (!A) return; A.mixer.stopAllAction(); A.mixer.uncacheRoot(A.obj); for (const m of A.mats) m.dispose(); }
// ключ готовой модели героя (hero) или врага (foe) по виду; null — модели нет или готовые модели выключены
export function actorKey(cfg, kind, id) {
  const A = cfg.actors; if (!A || !A.on || OFF) return null;
  const k = kind === 'hero' ? A.heroes[id] : kind === 'npc' ? (A.npcs || {})[id] : kind === 'beast' ? (A.beasts || {})[id] : A.foes[id]; return k && A.kits[k] ? k : null;
}
// ?models=0 — только свои модели; в автотестах (webdriver) готовые модели включает только ?models=1
const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('models') : null;
const OFF = Q === '0' || (Q !== '1' && typeof navigator !== 'undefined' && navigator.webdriver);
// природа (nature.glb): геометрии по видам — дерево, сухое, мёртвое, куст, камень; тяжёлые варианты не берём
const NAT_SKIP = /^(tree_1_C|tree_2_D|tree_2_E|tree_3_|tree_4_C|bush_1_E|bush_1_G)/;
// запечённые модели (цвет в вершинах): имя → геометрия с индексом и Float32-атрибутами; userData: w, d, h — размеры
export async function loadBaked(file, skip = null) {
  const u = urlOf(file); if (!u || OFF) return null;
  const g = await ld().loadAsync(u), out = {};
  g.scene.traverse(o => { if (!o.isMesh || (skip && skip.test(o.name))) return; out[o.name] = flatGeo(o.geometry); });
  return out;
}
function flatGeo(src) {
  const geo = src.clone();
  if (!geo.index) geo.setIndex([...Array(geo.attributes.position.count).keys()]);
  for (const n of ['position', 'normal', 'uv', 'color']) { const at = geo.attributes[n]; if (!at) continue; const sz = n === 'color' ? 3 : at.itemSize; if (at.normalized || !(at.array instanceof Float32Array) || at.isInterleavedBufferAttribute || at.itemSize !== sz) { const a = new Float32Array(at.count * sz); for (let i = 0; i < at.count; i++) for (let j = 0; j < sz; j++) a[i * sz + j] = at.getComponent(i, j); geo.setAttribute(n, new THREE.BufferAttribute(a, sz)); } }
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
  geo.computeBoundingBox(); const B = geo.boundingBox; geo.userData.w = B.max.x - B.min.x; geo.userData.d = B.max.z - B.min.z; geo.userData.h = B.max.y - B.min.y;
  geo.translate(-(B.min.x + B.max.x) / 2, -B.min.y, -(B.min.z + B.max.z) / 2); geo.computeBoundingBox();     // 4.08: низом на землю, центром в начало — опора моделей посередине, дома и декор уходили под землю
  return geo;
}
export async function loadNature() {
  const u = urlOf('nature'); if (!u || OFF) return null;
  const g = await ld().loadAsync(u), lib = { tree: [], bare: [], dead: [], bush: [], rock: [] };
  g.scene.traverse(o => { if (!o.isMesh || NAT_SKIP.test(o.name)) return; const k = o.name.split('_')[0], geo = o.geometry.clone();
    if (!geo.index) geo.setIndex([...Array(geo.attributes.position.count).keys()]);
    if (geo.attributes.color.itemSize === 4 || geo.attributes.color.normalized || !(geo.attributes.color.array instanceof Float32Array)) { const c = geo.attributes.color, a = new Float32Array(c.count * 3); for (let i = 0; i < c.count; i++) { a[i * 3] = c.getX(i); a[i * 3 + 1] = c.getY(i); a[i * 3 + 2] = c.getZ(i); } geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); }
    for (const n of ['position', 'normal', 'uv']) { const at = geo.attributes[n]; if (at && (at.normalized || !(at.array instanceof Float32Array) || at.isInterleavedBufferAttribute)) { const a = new Float32Array(at.count * at.itemSize); for (let i = 0; i < at.count; i++) for (let j = 0; j < at.itemSize; j++) a[i * at.itemSize + j] = at.getComponent(i, j); geo.setAttribute(n, new THREE.BufferAttribute(a, at.itemSize)); } }
    geo.computeBoundingBox(); geo.translate(0, -geo.boundingBox.min.y, 0); geo.userData.h = geo.boundingBox.max.y - geo.boundingBox.min.y;
    (lib[k === 'tree' ? 'tree' : k] || lib.tree).push(geo); });
  return Object.values(lib).every(a => a.length) ? lib : null;
}
export const modelsOff = () => OFF;     // готовые модели и текстуры выключены (?models=0 или автотест без ?models=1)
