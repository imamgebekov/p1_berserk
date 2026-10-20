// Готовые 3D-модели (2026-10-20, выбор владельца): KayKit (CC0), Quaternius (CC0), Sketchfab (CC BY). Только графика.
// Модели грузятся в фоне; пока модель не пришла (или её нет) — рисуется своя, из кубиков. У модели — свой AnimationMixer:
// клип выбирается по состоянию героя или врага (стоит, идёт, бежит, бьёт, целится, перекат, ранен, умер).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { makeWeapon } from './weaponview.js';
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
  spawn: ['Skeletons_Awaken_Standing', 'Spawn_Ground', 'Idle']
};
// семейство оружия → три удара цепочки (прямой, обратный, завершающий)
const CHAIN = { slash: ['a1', 'a2', 'a3'], thrust: ['p1', 'a1', 'p1'], smash: ['h1', 'h2', 'h2'], spin: ['h1', 'h3', 'h3'], flail: ['h2', 'h1', 'h2'], dual: ['d1', 'd2', 'd3'], fists: ['fist', 'fist', 'a3'], bow: ['bow', 'bow', 'bow'], staff: ['cast', 'cast', 'spell'] };
const famKey = f => (CHAIN[f] ? f : 'slash');

async function loadKk() {
  if (kkClips) return kkClips;
  const all = []; for (const k of KK_ANIMS) { const u = urlOf(k); if (u) all.push(...(await ld().loadAsync(u)).animations); }
  return (kkClips = all);
}
// загрузить модель (один раз); kit — описание из cfg.actors.kits
export function loadActor(key, kit) {
  if (lib.has(key)) return lib.get(key);
  const u = urlOf(key); if (!u) { lib.set(key, null); return null; }
  const p = (async () => {
    const g = await ld().loadAsync(u), clips = [...g.animations, ...(kit.anims === 'kk' ? await loadKk() : [])];
    for (const [nm, [t0, t1]] of Object.entries(kit.split || {})) { const c = clips[0]; if (c) clips.push(THREE.AnimationUtils.subclip(c, nm, Math.round(t0 * 30), Math.round(t1 * 30), 30)); }     // одна склейка «поза-стойка-ходьба» → свои клипы
    g.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.geometry.userData.shared = true; o.frustumCulled = false; const ms = Array.isArray(o.material) ? o.material : [o.material]; o.material = ms.map(m => new THREE.MeshLambertMaterial({ name: m.name, map: m.map || null, color: m.color ? m.color.clone() : 0xffffff, transparent: m.transparent, alphaTest: m.alphaTest || 0, emissive: m.emissive ? m.emissive.clone().multiplyScalar(m.emissiveIntensity ?? 1) : 0x000000, emissiveMap: m.emissiveMap || null }))[0]; } });
    const box = new THREE.Box3().setFromObject(g.scene), h = Math.max(.01, box.max.y - box.min.y);
    const v = { scene: g.scene, clips, h, minY: box.min.y }; lib.set(key, v); return v;
  })().catch(e => { console.warn('модель не загрузилась:', key, e && e.message); lib.set(key, null); return null; });
  lib.set(key, p); return p;
}
export const actorReady = key => { const v = lib.get(key); return v && !(v instanceof Promise) ? v : null; };
export function preloadActors(cfg) { const A = cfg.actors; if (!A || !A.on) return; for (const [k, kit] of Object.entries(A.kits)) loadActor(k, kit); }

// экземпляр модели: группа как у своих моделей (group, root, flash, kind), рука с оружием
const byName = (o, n) => o.getObjectByName(n) || o.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(n));     // загрузчик убирает точки из имён (handslot.r → handslotr)
export function makeActor(key, kit, kind = 'actor') {
  const src = actorReady(key); if (!src) return null;
  const obj = cloneSkinned(src.scene), g = new THREE.Group(), root = new THREE.Group(); g.add(root); root.add(obj);
  const s = kit.height / src.h; obj.scale.setScalar(s); obj.position.y = -src.minY * s; if (kit.yaw) obj.rotation.y = kit.yaw;
  const mats = []; obj.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); mats.push(o.material); if (kit.tint) o.material.color.multiply(new THREE.Color(kit.tint)); } });
  for (const n of kit.hide || []) { const o = byName(obj, n); if (o) o.visible = false; }
  const mixer = new THREE.AnimationMixer(obj), names = new Map(src.clips.map(c => [clipName(c), c])), acts = new Map();
  const clipOf = a => { for (const n of ACT[a] || [a]) if (names.has(n)) return names.get(n); return null; };
  const action = a => { if (acts.has(a)) return acts.get(a); const c = clipOf(a), x = c ? mixer.clipAction(c) : null; acts.set(a, x); return x; };
  const A = { group: g, root, obj, mixer, mats, kind, gltf: true, key, kit, cur: null, curName: '', once: false, weapon: null, wkey: '', family: 'fists', okey: '', off: null, hurtT: 0,
    hand: byName(obj, kit.hand || 'handslot.r'), handL: byName(obj, kit.handL || 'handslot.l'), has: a => !!clipOf(a), dur: a => { const c = clipOf(a); return c ? c.duration : 1; } };
  // сыграть действие: fade — время смешивания, once — один раз и замереть на последнем кадре, speed — скорость
  A.play = (a, { fade = .15, once = false, speed = 1, restart = false } = {}) => {
    const x = action(a); if (!x) return false;
    if (A.curName === a && !restart) { x.timeScale = speed; return true; }
    x.reset(); x.timeScale = speed; x.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); x.clampWhenFinished = once; x.enabled = true; x.setEffectiveWeight(1);
    if (A.cur && A.cur !== x) A.cur.crossFadeTo(x, fade, false); x.play();
    A.cur = x; A.curName = a; A.once = once; return true;
  };
  // вспышка при уроне и цвет статуса (как у своих моделей)
  for (const m of mats) m.userData.e0 = m.emissive.clone();     // своё свечение модели (лава голема) — основа, вспышка добавляется
  A.flash = (f, tint) => { for (const m of mats) { const e0 = m.userData.e0; if (tint) m.emissive.setRGB(e0.r + tint[0], e0.g + tint[1], e0.b + tint[2]); else m.emissive.setRGB(e0.r + f * .9, e0.g + f * .25, e0.b + f * .2); } };
  const scaleFix = () => { const v = new THREE.Vector3(); A.hand.getWorldScale(v); return v.x > 0 ? 1 / v.x : 1; };
  // оружие в руке: своя модель оружия (те же размеры, что у героя из кубиков), рукоять — в ладони
  A.setWeapon = (wk, mat) => {
    const key2 = wk + '|' + mat; if (key2 === A.wkey || !A.hand) return; A.wkey = key2;
    if (A.weapon) A.hand.remove(A.weapon.group);
    A.family = familyOf(wk); if (wk === 'fists') { A.weapon = null; return; }
    g.updateMatrixWorld(true); const w = makeWeapon(wk, mat); w.group.scale.setScalar(scaleFix() * (kit.wScale || .55)); if (kit.wRot) w.group.rotation.set(...kit.wRot);
    A.hand.add(w.group); A.weapon = w;
  };
  A.setOff = (key2, kindO, mat, form) => {
    if (key2 === A.okey || !A.handL) return; A.okey = key2;
    if (A.off) A.handL.remove(A.off); A.off = null; if (!key2) return;
    g.updateMatrixWorld(true); const o = new THREE.Group();
    if (kindO === 'shield') { const big = form === 'tower', M2 = new THREE.MeshLambertMaterial({ color: ({ iron: '#9a9890', tempered: '#b8b4a8', steel: '#cfc9bb', black: '#3e3a46' })[mat] || '#9a9890' });
      o.add(new THREE.Mesh(new THREE.BoxGeometry(.08, big ? 1.1 : .6, big ? .7 : .6), new THREE.MeshLambertMaterial({ color: '#5a3e26' })), new THREE.Mesh(new THREE.BoxGeometry(.03, big ? 1.14 : .64, big ? .74 : .64), M2).translateX(-.05)); o.rotation.y = Math.PI / 2; }
    else { const w = makeWeapon(kindO, mat); o.add(w.group); if (kit.wRot) o.rotation.set(...kit.wRot); }
    o.scale.multiplyScalar(scaleFix() * (kit.wScale || .55)); A.handL.add(o); A.off = o;
  };
  // облик по броне: шлем/шляпа видны, если надето на голову; цвет плаща
  A.setLook = L => { for (const n of kit.helm || []) { const o = byName(obj, n); if (o) o.visible = !!(L && L.helm); } for (const n of kit.cape || []) { const o = byName(obj, n); if (o && L && L.cape && o.material) o.material.color.set(L.cape).lerp(new THREE.Color('#ffffff'), .45); } };
  A.play('idle', { fade: 0 });
  return A;
}

// герой (и спутник-герой): клип по состоянию игрока p
export function driveHero(A, p, dt, cfg, swingMul = 1) {
  const P = cfg.player, speed = Math.hypot(p.vx || 0, p.vz || 0);
  if (p.dead || p.state === 'dead') { if (A.curName !== 'death') A.play('death', { once: true, fade: .1 }); }
  else if (p.state === 'roll') A.play('roll', { once: true, fade: .05, speed: A.dur('roll') / P.rollTime, restart: A.curName !== 'roll' });
  else if (p.state === 'atk') {
    const ch = CHAIN[famKey(A.family)], step = p.heavy > 0 || p.fin ? 2 : ((p.chain || 0) % 2), a = ch[step], len = P.attackTime * swingMul;
    const fresh = A.atkMark !== p.atkId && (A.lastAtkT === undefined || p.atkT < A.lastAtkT || A.curName !== a);
    if (fresh) { A.atkMark = p.atkId; A.play(a, { once: true, fade: .06, speed: Math.max(.6, A.dur(a) * .8 / len), restart: true }); }
    A.lastAtkT = p.atkT;
  } else if (p.state === 'charge') A.play('charge', { fade: .12 });
  else if (p.state === 'dash') A.play('run', { fade: .05, speed: 1.6 });
  else if (A.hurtT > 0 && A.curName !== 'hit' && speed < .5) A.play('hit', { once: true, fade: .05, restart: true });
  else if (!(A.once && A.cur && A.cur.isRunning() && A.curName === 'hit')) {
    const run = speed > P.speed * .55, mv = speed > .3;
    A.play(mv ? (run ? 'run' : 'walk') : 'idle', { fade: .18, speed: mv ? Math.max(.6, speed / (run ? P.speed : P.speed * .45)) : 1 });
  }
  if (p.state !== 'atk') A.lastAtkT = undefined;
  A.mixer.update(dt);
}
// враг: клип по состоянию e (замах, удар, отход, прицел, рывок, смерть) и по настоящей скорости
export function driveFoe(A, e, time, dt, cfg) {
  const C = cfg.enemies[e.type];
  { const dtm = time - (A.lt ?? time); if (dtm > 0) { const v = Math.hypot(e.x - A.lx, e.z - A.lz) / dtm; A.sp = (A.sp || 0) * .8 + Math.min(v, C.speed * 2) * .2; } A.lt = time; A.lx = e.x; A.lz = e.z; }
  const atkA = A.kit.atk || 'a1';
  if (e.dead) { if (A.curName !== 'death') A.play('death', { once: true, fade: .08 }); }
  else if (e.state === 'wind') { if (A.curName !== atkA) A.play(atkA, { once: true, fade: .08, speed: Math.max(.4, A.dur(atkA) * .45 / Math.max(.15, C.wind || .5)), restart: true }); }
  else if (e.state === 'rec') { if (A.curName === atkA && A.cur) A.cur.timeScale = Math.max(1, A.cur.timeScale); else A.play('idle', { fade: .2 }); }
  else if (e.state === 'aim') A.play(A.kit.aim || 'aim', { fade: .1 });
  else if (e.state === 'dash') A.play('run', { fade: .05, speed: 1.5 });
  else if (e.flash > 0 && A.curName !== 'hit' && (A.sp || 0) < .3) A.play('hit', { once: true, fade: .04, restart: true });
  else if (!(A.curName === 'hit' && A.cur && A.cur.isRunning())) { const sp = A.sp || 0, run = sp > C.speed * .6; A.play(sp > .25 ? (run ? 'run' : 'walk') : 'idle', { fade: .2, speed: sp > .25 ? Math.max(.6, sp / C.speed) : 1 }); }
  // у модели нет клипа удара или смерти — простой наклон корня (замах, удар, падение)
  { const R = A.root; R.rotation.set(0, 0, 0); R.position.set(0, 0, 0);
    if (e.dead && !A.has('death')) { const k = Math.min(1, (e.deadT || 0) / .5); R.rotation.z = -1.45 * k; R.position.y = -.15 * k; }
    else if (!A.has(atkA) && e.state === 'wind') { const k = Math.min(1, Math.max(0, e.t) / Math.max(.15, C.wind || .5)); R.rotation.x = -.3 * k; R.position.z = -.15 * k; }
    else if (!A.has(atkA) && e.state === 'rec') { const k = Math.min(1, e.t / .25); R.rotation.x = .4 * (1 - k); R.position.z = .3 * (1 - k); } }
  A.mixer.update(dt);
}
export function disposeActor(A) { if (!A) return; A.mixer.stopAllAction(); A.mixer.uncacheRoot(A.obj); for (const m of A.mats) m.dispose(); }
// ключ готовой модели героя (hero) или врага (foe) по виду; null — модели нет или готовые модели выключены
export function actorKey(cfg, kind, id) {
  const A = cfg.actors; if (!A || !A.on || OFF) return null;
  const k = kind === 'hero' ? A.heroes[id] : A.foes[id]; return k && A.kits[k] ? k : null;
}
// ?models=0 — только свои модели; в автотестах (webdriver) готовые модели включает только ?models=1
const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('models') : null;
const OFF = Q === '0' || (Q !== '1' && typeof navigator !== 'undefined' && navigator.webdriver);
