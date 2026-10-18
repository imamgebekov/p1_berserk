// Модели из кубиков (никаких внешних файлов): герой, бес, рогач, дерево, камень, костёр.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeWeapon } from './weaponview.js';
import { CFG3 } from './config3d.js';
import { familyOf, stepOf, swingPose, chargePose, REST, gait, bank, strikeBody, rollLand, hitLean, heroDeath, foeDeath, dampK, smoothPose, poseLambda } from './anim3d.js';

const lam = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });

// скруглённый кубик для героя, врагов и жителей (шаг 7 аудита): общий на одинаковые размеры, модели геометрию не освобождают
const roundGeo = new Map();
function boxGeo(w, h, d) {
  const R = CFG3.shapes && CFG3.shapes.round; if (!R || !R.on) return new THREE.BoxGeometry(w, h, d);
  const key = w + ',' + h + ',' + d; let g = roundGeo.get(key);
  if (!g) { g = new RoundedBoxGeometry(w, h, d, R.seg, Math.min(R.max, Math.min(w, h, d) * R.k)); roundGeo.set(key, g); }
  return g;
}
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(boxGeo(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}
// «шарнир»: группа в точке, внутри неё кубик со смещением (чтобы вращать конечности от сустава)
function limb(w, h, d, mat, x, y, z, dy = -h / 2) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  g.add(box(w, h, d, mat, 0, dy, 0));
  return g;
}

// Список материалов экземпляра: ими управляет вспышка при попадании
function flasher(mats) {
  return (f, tint) => { for (const m of mats) { if (f > 0) m.emissive.setRGB(f, f * .85, f * .8); else if (tint) m.emissive.setRGB(tint[0], tint[1], tint[2]); else m.emissive.setRGB(0, 0, 0); } };
}

// ---------- герой ----------
export function makeHero() {
  const mats = [];
  const M = (c, o) => { const m = lam(c, o); mats.push(m); return m; };
  const g = new THREE.Group(), root = new THREE.Group(); g.add(root);
  const cloth = M('#6a5148'), skin = M('#cdb89a'), dark = M('#3a2c28'), cape = M('#7a1e26'), legs = M('#4a3a35');
  const legL = limb(.28, .8, .32, legs, .2, .8, 0), legR = limb(.28, .8, .32, legs, -.2, .8, 0);
  const torso = box(.78, .85, .45, cloth, 0, 1.25, 0);
  const belt = box(.8, .12, .47, M('#2a2422'), 0, .88, 0);
  const shoulder = box(.4, .28, .5, M('#4a463f'), .42, 1.6, 0);
  const head = box(.46, .46, .46, skin, 0, 1.92, .02);
  const hair = box(.5, .22, .5, dark, 0, 2.1, -.02);
  const hair2 = box(.5, .36, .12, dark, 0, 1.98, -.22);
  const eyeL = box(.07, .07, .04, basic('#1a1210'), .1, 1.95, .24), eyeR = box(.07, .07, .04, basic('#1a1210'), -.1, 1.95, .24);
  const cloak = new THREE.Group(); cloak.position.set(0, 1.6, -.26); cloak.add(box(.78, 1.25, .1, cape, 0, -.62, 0));
  // рука с оружием: swing крутится вокруг вертикали от плеча, sword — держатель (наклон и вынос), в нём модель надетого оружия
  const swing = new THREE.Group(); swing.position.set(0, 1.55, 0);
  const sword = new THREE.Group(); sword.position.set(-.48, 0, .12);
  swing.add(sword);
  const armL = limb(.2, .75, .22, cloth, .5, 1.62, 0);
  const hood = new THREE.Group(); hood.add(box(.54, .2, .54, cape, 0, 2.18, -.02), box(.54, .5, .14, cape, 0, 1.95, -.26)); hood.visible = false;
  const quiver = new THREE.Group(); quiver.position.set(-.18, 1.35, -.34); quiver.rotation.z = .35; quiver.add(box(.18, .7, .18, M('#6a4a2a'), 0, 0, 0), box(.04, .22, .04, M('#d8c8a0'), .04, .45, 0), box(.04, .26, .04, M('#d8c8a0'), -.04, .47, 0)); quiver.visible = false;
  root.add(legL, legR, torso, belt, shoulder, head, hair, hair2, eyeL, eyeR, cloak, swing, armL, hood, quiver);
  const set = f => flasher(mats)(f);
  const h = { group: g, root, legL, legR, cloak, swing, sword, armL, head, flash: set, kind: 'hero', weapon: null, wkey: '', family: 'fists' };
  // вид героя (data/heroes3d.js → look): цвета одежды, плаща, волос; наплечник, капюшон, колчан, длина плаща
  h.setLook = L => { cloth.color.set(L.cloth); cape.color.set(L.cape); dark.color.set(L.hair); legs.color.set(L.legs); shoulder.visible = L.shoulder; hood.visible = L.hood; hair.visible = !L.hood; quiver.visible = L.quiver; cloak.scale.y = L.capeLen; };
  // вторая рука: щит (форма buckler/tower) или второй клинок; key — что надето, null — пусто
  h.okey = ''; h.off = null;
  h.setOff = (key, kind, mat, form) => {
    if (key === h.okey) return; h.okey = key;
    if (h.off) armL.remove(h.off); h.off = null; if (!key) return;
    const g2 = new THREE.Group(); g2.position.set(.05, -.72, .12);
    if (kind === 'shield') { const big = form === 'tower', M2 = lam(({ iron: '#9a9890', tempered: '#b8b4a8', steel: '#cfc9bb', black: '#3e3a46' })[mat] || '#9a9890');
      g2.add(box(.1, big ? 1.1 : .55, big ? .7 : .55, lam('#5a3e26'), .12, big ? .1 : 0, .05), box(.04, big ? 1.14 : .6, big ? .74 : .6, M2, .17, big ? .1 : 0, .05), box(.08, .16, .16, M2, .22, 0, .05)); }
    else { const w = makeWeapon(kind, mat); w.group.rotation.x = Math.PI / 2; w.group.scale.setScalar(.85); g2.add(w.group); }
    armL.add(g2); h.off = g2;
  };
  // надеть модель оружия (kind — тип, mat — материал); у кулаков модель — сам кулак
  h.setWeapon = (kind, mat) => {
    const key = kind + '|' + mat; if (key === h.wkey) return; h.wkey = key;
    if (h.weapon) sword.remove(h.weapon.group);
    h.weapon = makeWeapon(kind, mat); sword.add(h.weapon.group);
    h.family = familyOf(kind);
  };
  return h;
}

export function animateHero(h, p, time, dt, cfg, swingMul = 1) {
  { const left = p.state === 'atk' && p.hand === 1; h.swing.scale.x = left ? -1 : 1; if (h.off) h.off.visible = !left; }     // удар левым клинком: размах зеркально, клинок «в замахе»
  const speed = Math.hypot(p.vx, p.vz), G = gait(speed, cfg.player.speed, time), run = G.run;
  const roll = p.state === 'roll', atk = p.state === 'atk', dead = p.dead;
  h.legL.rotation.x = G.leg; h.legR.rotation.x = -G.leg; h.armL.rotation.x = G.arm + G.breath * .06;
  // крен в поворот (G5): скорость поворота лица, сглаженная
  { let d = p.face - (h.lastFace ?? p.face); while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; h.lastFace = p.face; const tk = dampK(cfg.view.blend ? cfg.view.blend.turn : 10, dt); h.turn = (h.turn || 0) * (1 - tk) + (dt > 0 ? d / dt : 0) * tk; }
  h.root.position.y = G.bob; h.root.position.z = 0; h.root.rotation.x = G.lean; h.root.rotation.z = roll || atk ? 0 : bank(h.turn, run); h.root.scale.set(1, 1 + G.breath * .015, 1);
  h.head.rotation.x = -G.breath * .04;
  h.cloak.rotation.x = .12 + run * .55 + Math.sin(time * (3 + run * 6)) * (.05 + run * .06);
  // оружие: поза удара по семейству движений и шагу цепочки (прямой, обратный, завершающий); swingMul — скорость удара от вещей
  const hit = cfg.player.attackHitAt / cfg.player.attackTime;
  const q = atk ? swingPose(h.family, p.heavy ? 'fin' : stepOf(p.chain, p.fin), p.atkT / (cfg.player.attackTime * swingMul), hit, p.heavy > 0)
    : p.state === 'charge' ? chargePose(h.family, p.chargeT, cfg.player.heavy.full, time)
    : p.state === 'dash' ? swingPose(h.family, 'fin', Math.min(.9, .3 + p.dashT / p.dashDur * .6), .5) : REST;     // рывок умения — размах завершающего удара
  h.swing.rotation.y = q.yaw; h.sword.rotation.x = q.pitch; h.sword.rotation.z = q.tilt; h.sword.position.z = .12 + q.reach;
  h.root.rotation.y = q.twist; h.root.rotation.x += q.lean; h.root.position.y += q.lift;
  if (atk) { const B = strikeBody(p.atkT / (cfg.player.attackTime * swingMul), hit); h.root.position.z = B.lunge; h.root.scale.set(2 - B.sy, B.sy, 2 - B.sy); }     // выпад и сжатие (G5)
  if (roll) {
    const k = p.rollT / cfg.player.rollTime, sq = rollLand(k);
    h.root.rotation.x = k * Math.PI * 2; h.root.position.y = .85 + Math.sin(k * Math.PI) * .25; h.root.scale.set(.85 * (2 - sq), .75 * sq, .85 * (2 - sq));
  }
  if (dead) { const D = heroDeath(p.deadT); h.root.rotation.x = D.rx; h.root.rotation.z = 0; h.root.position.y = D.y; h.root.scale.set(1, 1, 1); }     // на колени, потом навзничь
  else if (!roll && h.hurtT > 0) { const k = h.hurtT / .22; h.root.rotation.x -= .4 * k; h.root.position.y += .06 * k; }     // ранен: вздрагивает назад
  // сглаживание (шаг 3 аудита): кости плавно догоняют позу; в окне удара — быстро; перекат ставится напрямую
  const BL = cfg.view.blend;
  if (BL) {
    const ch = h.chans || (h.chans = [[h.legL, 'rotation', 'x'], [h.legR, 'rotation', 'x'], [h.armL, 'rotation', 'x'], [h.head, 'rotation', 'x'], [h.cloak, 'rotation', 'x'],
      [h.swing, 'rotation', 'y'], [h.sword, 'rotation', 'x'], [h.sword, 'rotation', 'z'], [h.sword, 'position', 'z'],
      [h.root, 'position', 'y'], [h.root, 'position', 'z'], [h.root, 'rotation', 'x'], [h.root, 'rotation', 'y'], [h.root, 'rotation', 'z'], [h.root, 'scale', 'x'], [h.root, 'scale', 'y'], [h.root, 'scale', 'z']]);
    if (!h.rollSkip) h.rollSkip = new Set(ch.slice(9));
    smoothPose(h, ch, poseLambda(atk, p.atkT / (cfg.player.attackTime * swingMul), hit, BL), dt, roll ? h.rollSkip : null);
    if (roll) { const rx = h.sm.get(ch[11]); h.sm.set(ch[11], rx - Math.round(rx / (Math.PI * 2)) * Math.PI * 2); }     // после кувырка — без раскрутки назад
  }
  // вспышка при уроне: мигаем во время неуязвимости
  { const IV = cfg.fx.invuln, on = p.inv > 0 && p.inv < 5 && !roll && p.state !== 'dash';     // неуязвимость: мягкая пульсация вместо строба (шаг 4); долгая (тесты, сон) не светится
    h.flash(!on || !IV ? 0 : CALM ? IV.base : IV.base + IV.pulse * Math.sin(time * IV.pulseHz * 6.283)); }
}

const CALM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- враги ----------
// облик по виду: цвета и особенности
const LOOKS = {
  imp: { body: '#3b3345', dark: '#1a121a', eye: '#ff3030' },
  brute: { body: '#4a3430', dark: '#2a1c1a', eye: '#ff3030' },
  hound: { body: '#55503f', dark: '#2a2620', eye: '#ffb020' },
  ghoul: { body: '#58675a', dark: '#2a3a30', eye: '#b8ff90' },
  archer: { shape: 'imp', body: '#52402e', dark: '#20160e', eye: '#ffc030' },
  witch: { shape: 'imp', body: '#3a2450', dark: '#140a1e', eye: '#e070ff', crown: '#9a48d0' },
  devourer: { shape: 'ghoul', body: '#3c4e44', dark: '#1a2a22', eye: '#e8ff60', crown: '#c8d8a0' },
  lord: { shape: 'imp', body: '#2a2028', dark: '#0e0a10', eye: '#ff7a20', crown: '#ff9a40' },
  castellan: { shape: 'brute', body: '#4a4440', dark: '#1e1a18', eye: '#ff6a20', crown: '#c8a060', prop: 'shield' },     // замки (C4)
  queen: { shape: 'imp', body: '#3a3428', dark: '#14100a', eye: '#a8ff60', crown: '#e8d890', ghost: true },
  chief: { shape: 'brute', body: '#5a2c24', dark: '#2a1210', eye: '#ffc030', crown: '#d8c8a8' },
  shield: { shape: 'brute', body: '#5a4a3a', dark: '#2a2018', eye: '#ffb030', prop: 'shield' },
  bomber: { shape: 'imp', body: '#4a2a1a', dark: '#1e1008', eye: '#ffd040', prop: 'ember' },
  lunger: { shape: 'bones', body: '#cfc4a8', dark: '#5a5244', eye: '#80ffd0', prop: 'spear' },
  shade: { shape: 'imp', body: '#2a2a3a', dark: '#101018', eye: '#c0d0ff', ghost: true }
};
export function makeMonster(kind, cfg) {
  const mats = [], L = LOOKS[kind] || LOOKS.imp;
  const M = (c, o) => { const m = lam(c, o); mats.push(m); return m; };
  const body = M(L.body), dark = M(L.dark), bone = M('#d8cfbd');
  const g = new THREE.Group(), root = new THREE.Group(); g.add(root);
  const shape = L.shape || kind, hound = shape === 'hound', ghoul = shape === 'ghoul', bones = shape === 'bones';
  root.add(box(hound ? .6 : bones ? .5 : .8, hound ? .7 : .85, hound ? .8 : bones ? .3 : .55, body, 0, .95, 0));
  if (bones) for (let i = 0; i < 3; i++) root.add(box(.62, .06, .36, dark, 0, .8 + i * .16, 0));     // рёбра
  const head = box(.55, .5, hound ? .7 : .5, body, 0, hound ? 1.45 : 1.65, hound ? .35 : .05); root.add(head);
  root.add(box(.1, .1, .05, basic(L.eye), .12, hound ? 1.5 : 1.7, hound ? .72 : .31), box(.1, .1, .05, basic(L.eye), -.12, hound ? 1.5 : 1.7, hound ? .72 : .31));
  if (shape === 'brute') { root.add(box(.12, .5, .12, bone, .3, 2.05, .05)); root.add(box(.12, .5, .12, bone, -.3, 2.05, .05)); }
  else if (hound) { root.add(box(.14, .35, .1, dark, .2, 1.8, .3)); root.add(box(.14, .35, .1, dark, -.2, 1.8, .3)); root.add(box(.12, .12, .6, body, 0, 1.1, -.65)); }
  else if (ghoul) { root.add(box(.5, .1, .5, dark, 0, 1.95, .05)); root.add(box(.2, .5, .12, dark, 0, 1.5, -.3)); }
  else { root.add(box(.14, .3, .1, body, .3, 1.95, 0)); root.add(box(.14, .3, .1, body, -.3, 1.95, 0)); }
  if (L.crown) { const cm = basic(L.crown); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; root.add(box(.1, .42, .1, cm, Math.cos(a) * .3, 2.25 + (i % 2) * .12, Math.sin(a) * .3 + .05)); } root.add(box(.3, .4, .3, cm, .62, 1.7, 0), box(.3, .4, .3, cm, -.62, 1.7, 0)); }
  // предметы видов: щит спереди, тлеющее пузо, копьё
  let ember = null;
  if (L.prop === 'shield') { const sm = M('#6a645a'), rim = M('#3a342c'); root.add(box(1.0, 1.15, .14, sm, 0, 1.05, .5)); root.add(box(1.08, .12, .16, rim, 0, 1.6, .5)); root.add(box(1.08, .12, .16, rim, 0, .5, .5)); root.add(box(.22, .22, .2, M('#a89a70'), 0, 1.05, .6)); }
  if (L.prop === 'ember') { ember = basic('#ff7a20'); root.add(new THREE.Mesh(new THREE.BoxGeometry(.6, .5, .1), ember).translateY(.95).translateZ(.29)); }
  const al = ghoul ? 1.05 : bones ? .95 : .75;
  const armL = limb(.22, al, .24, body, .55, 1.3, 0), armR = limb(.22, al, .24, body, -.55, 1.3, 0);
  const legL = limb(.3, .6, .3, dark, .22, .6, 0), legR = limb(.3, .6, .3, dark, -.22, .6, 0);
  armL.add(box(.1, .22, .08, bone, 0, -al - .07, .1)); armR.add(box(.1, .22, .08, bone, 0, -al - .07, .1));
  if (L.prop === 'spear') { armR.add(box(.08, 2.6, .08, M('#5a3e26'), 0, -al, .6).rotateX(Math.PI / 2)); armR.add(box(.16, .4, .05, M('#b8b4a8'), 0, -al, 1.95).rotateX(Math.PI / 2)); }
  root.add(armL, armR, legL, legR);
  if (L.ghost) for (const m of mats) { m.transparent = true; m.opacity = .55; m.depthWrite = false; }      // тень: полупрозрачная
  const s = cfg.enemies[kind].scale; g.scale.set(s, s, s);
  return { group: g, root, armL, armR, legL, legR, head, flash: flasher(mats), kind, ember, ghost: !!L.ghost, mats };
}

export function animateMonster(m, e, time, cfg, hx, hz) {
  if (hx !== undefined && e.flash > 0 && !m.hitSet) { m.hitA = Math.atan2(hx - e.x, hz - e.z) - e.face; m.hitSet = true; } else if (!(e.flash > 0)) m.hitSet = false;     // откуда ударили (G5)
  const C = cfg.enemies[e.type];
  // походка по настоящей скорости (G5): патрульный бредёт, стоящий дышит, а не машет ногами на месте
  { const dtm = time - (m.lt ?? time); if (dtm > 0) { const v = Math.hypot(e.x - m.lx, e.z - m.lz) / dtm, sk = dampK(cfg.view.blend ? cfg.view.blend.speed : 13, dtm); m.sp = (m.sp || 0) * (1 - sk) + Math.min(v, C.speed * 2) * sk; } m.dt = Math.min(.1, Math.max(0, dtm)); m.lt = time; m.lx = e.x; m.lz = e.z; }
  const G = gait(e.dead ? 0 : m.sp || 0, C.speed, time * (1 + C.speed * .08), e.id);
  m.legL.rotation.x = G.leg * .9; m.legR.rotation.x = -G.leg * .9;
  m.armL.rotation.x = G.arm * .85 - G.breath * .08; m.armR.rotation.x = -G.arm * .85 - G.breath * .08;
  m.root.position.y = G.bob * .8; m.root.rotation.x = G.lean * .7; m.root.rotation.z = 0; m.root.position.z = 0; m.root.position.x = 0; m.root.scale.set(1, 1 + G.breath * .025, 1);
  let red = 0;
  if (e.state === 'aim') { const k = Math.min(1, e.t / .2); m.root.rotation.x = .25 * k; m.armR.rotation.x = -1.4 * k; m.armL.rotation.x = -1.1 * k; red = .25 + .25 * Math.sin(time * 30); }
  else if (e.state === 'dash') { m.root.rotation.x = .45; m.armR.rotation.x = -1.5; m.armL.rotation.x = -1.2; m.legL.rotation.x = .9; m.legR.rotation.x = -.9; }
  else if (e.state === 'fuse') { const k = e.t / C.fuse.t; m.root.position.x = Math.sin(time * 60) * .05 * k; m.root.scale.set(1 + .2 * k, 1 - .1 * k, 1 + .2 * k); red = .3 + .5 * k * (.5 + .5 * Math.sin(time * (10 + 40 * k))); }
  else if (e.state === 'wind') {
    const k = Math.min(1, Math.max(0, e.t) / C.wind);
    m.armL.rotation.x = m.armR.rotation.x = -2.4 * k; m.root.rotation.x = -.3 * k; m.root.position.z = -.15 * k;
    m.root.position.y = -.08 * k; m.root.position.x = Math.sin(time * 50 + e.id) * .025 * k * k; m.root.scale.set(1 + .05 * k, 1 - .06 * k, 1 + .05 * k);     // присед и дрожь перед ударом (G5)
    red = .35 + .35 * Math.sin(time * 40);
  } else if (e.state === 'rec') {
    const k = Math.min(1, e.t / .25);
    m.armL.rotation.x = m.armR.rotation.x = -2.4 + 3.2 * Math.min(1, k * 3); m.root.rotation.x = .4 * (1 - k); m.root.position.z = .25 * (1 - k);
  }
  // попадание: откидывается назад и сплющивается (e.flash ставит симуляция)
  if (!e.dead && e.flash > 0) { const k = Math.min(1, e.flash / .12), L = hitLean(k, m.hitA ?? 0); m.root.rotation.x += L.rx; m.root.rotation.z += L.rz; m.root.position.z -= .12 * k * Math.cos(m.hitA ?? 0); m.root.scale.set(1 + .12 * k, 1 - .16 * k, 1 + .12 * k); }     // прочь от удара (G5)
  // смерть: валится за 0,3 с, потом оседает и тает (тело убирается через 0,6 с)
  if (e.dead) { const D = foeDeath(e.deadT, e.id); m.root.rotation.x = D.rx; m.root.rotation.z = D.rz; m.root.position.y = D.y; m.root.scale.setScalar(D.scale); red = 0; }     // падает в свою сторону (G5)
  // цвет статуса: горит, мёрзнет, отравлен, кровоточит, оглушён
  let tint = null; const st = e.st;
  if (st && !e.dead) {
    const pu = .6 + .4 * Math.sin(time * 14);
    tint = st.stun ? [.4 * pu, .38 * pu, .02] : st.freeze ? [.04, .22, .45] : st.burn ? [.5 * (.7 + .3 * Math.sin(time * 31)), .16, 0] : st.poison ? [0, .3, .04] : st.bleed ? [.38, 0, 0] : null;
  }
  if (m.ember) m.ember.color.setHSL(.07, 1, .45 + .15 * Math.sin(time * 9 + e.id) + (e.state === 'fuse' ? .2 : 0));
  if (m.ghost) { const o = e.dead ? .3 : .4 + .2 * Math.sin(time * 7 + e.id); for (const mm of m.mats) mm.opacity = o; }
  if (cfg.view.blend) {                                                       // сглаживание позы врага (шаг 3 аудита); удар по нему и рывок — резко
    const ch = m.chans || (m.chans = [[m.legL, 'rotation', 'x'], [m.legR, 'rotation', 'x'], [m.armL, 'rotation', 'x'], [m.armR, 'rotation', 'x'],
      [m.root, 'position', 'x'], [m.root, 'position', 'y'], [m.root, 'position', 'z'], [m.root, 'rotation', 'x'], [m.root, 'rotation', 'z'], [m.root, 'scale', 'x'], [m.root, 'scale', 'y'], [m.root, 'scale', 'z']]);
    smoothPose(m, ch, e.flash > 0 || e.state === 'dash' || e.state === 'fuse' ? cfg.view.blend.hit : cfg.view.blend.pose, m.dt || 0);
  }
  m.flash(Math.max(red, e.flash > 0 ? .9 : 0), tint);
}

// ---------- мир ----------
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
// Добавляет кубик в список, запекая трансформацию и цвет в вершины (потом всё сливается в один меш)
export function pushBox(list, w, h, d, x, y, z, rx, ry, rz, color) {
  const geo = new THREE.BoxGeometry(w, h, d);
  tmpE.set(rx, ry, rz); tmpQ.setFromEuler(tmpE); tmpP.set(x, y, z); tmpS.set(1, 1, 1);
  tmpM.compose(tmpP, tmpQ, tmpS); geo.applyMatrix4(tmpM);
  paint(geo, color, list.glow === true);
  list.push(geo);
}
// цвет в вершины; снизу вверх градиент shapes.grad (шаг 7: низ темнее, верх светлее — дешёвое затенение); светящимся (glow) — ровный
export function paint(geo, color, glow = false) {
  const c = new THREE.Color(color), p = geo.attributes.position, n = p.count, col = new Float32Array(n * 3), G = !glow && CFG3.shapes && CFG3.shapes.grad;
  let y0 = Infinity, y1 = -Infinity; if (G) for (let i = 0; i < n; i++) { const y = p.getY(i); if (y < y0) y0 = y; if (y > y1) y1 = y; }
  for (let i = 0; i < n; i++) { const k = G ? G[0] + (G[1] - G[0]) * (y1 > y0 ? (p.getY(i) - y0) / (y1 - y0) : 1) : 1; col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

// округлый «камешек» из многогранника (F1: меньше квадратного): икосаэдр или додекаэдр, растянутый по осям, цвет в вершинах
export function pushBlob(list, kind, sx, sy, sz, x, y, z, rx, ry, rz, color) {
  const geo = kind === 'dodeca' ? new THREE.DodecahedronGeometry(1, 0) : new THREE.IcosahedronGeometry(1, 0);
  tmpE.set(rx, ry, rz); tmpQ.setFromEuler(tmpE); tmpP.set(x, y, z); tmpS.set(sx, sy, sz);
  tmpM.compose(tmpP, tmpQ, tmpS); geo.applyMatrix4(tmpM);
  const n = geo.attributes.position.count; paint(geo, color); geo.setIndex([...Array(n).keys()]);     // с индексом — сливается с кубиками
  list.push(geo);
}
export function addTree(list, rnd, x, z, look = null) {
  const k0 = list.length, h = 2.6 + rnd() * 2.2, col = look ? look.trunk[rnd() < .5 ? 0 : 1] : rnd() < .5 ? '#1a1210' : '#221813';
  pushBox(list, .36, h, .36, x, h / 2, z, 0, 0, (rnd() - .5) * .15, col);
  const n = 2 + (rnd() * 3 | 0);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, y = h * (.45 + rnd() * .5), l = 1 + rnd() * 1.4;
    pushBox(list, .16, l, .16, x + Math.cos(a) * l * .35, y + l * .2, z + Math.sin(a) * l * .35, Math.sin(a) * .9, 0, -Math.cos(a) * .9, col);
  }
  if (look && rnd() >= look.bare) {                        // крона: 3–5 зелёных кубов у макушки
    const m = 3 + (rnd() * 3 | 0);
    for (let i = 0; i < m; i++) { const s = (1.1 + rnd() * 1.1) * .62, a = rnd() * Math.PI * 2, r = i ? .5 + rnd() * .7 : 0; pushBlob(list, 'ico', s, s * .85, s, x + Math.cos(a) * r, h + (i ? -.3 - rnd() * .6 : .2), z + Math.sin(a) * r, rnd() * .3, rnd() * 3, rnd() * .3, look.leaf[(rnd() * look.leaf.length) | 0]); }     // округлая крона
  }
  if (look) for (let k = k0; k < list.length; k++) { const p = list[k].attributes.position, sw = new Float32Array(p.count); for (let i = 0; i < p.count; i++) sw[i] = Math.max(0, Math.min(1, p.getY(i) / (h + 1))); list[k].setAttribute('sway', new THREE.BufferAttribute(sw, 1)); }     // F2: доля качания по высоте
}
// куст (зелень, 2026-10-17): 2–3 округлых куска листвы у земли размером около s м; качается слабее кроны
export function addBush(list, rnd, x, z, s, look) {
  const k0 = list.length, n = 2 + (rnd() * 2 | 0);
  for (let i = 0; i < n; i++) { const q = s * (.55 + rnd() * .45), a = rnd() * Math.PI * 2, r = i ? s * (.35 + rnd() * .3) : 0; pushBlob(list, 'ico', q, q * .8, q, x + Math.cos(a) * r, q * .62, z + Math.sin(a) * r, rnd() * .3, rnd() * 3, rnd() * .3, look.leaf[(rnd() * look.leaf.length) | 0]); }
  for (let k = k0; k < list.length; k++) { const p = list[k].attributes.position, sw = new Float32Array(p.count); for (let i = 0; i < p.count; i++) sw[i] = Math.max(0, Math.min(.45, p.getY(i) / (s * 3))); list[k].setAttribute('sway', new THREE.BufferAttribute(sw, 1)); }
}
// дерево у тропы (F4): ствол наклонён к тропе, крона из 4–6 округлых кусков висит над дорогой; качается как обычное
export function addCanopyTree(list, rnd, c, look) {
  const k0 = list.length, h = c.h, lean = Math.atan2(c.reach * .55, h), yaw = Math.atan2(c.toX, c.toZ);
  pushBox(list, .38, h + .3, .38, c.x + c.toX * c.reach * .28, (h + .3) / 2, c.z + c.toZ * c.reach * .28, lean * Math.cos(yaw), 0, -lean * Math.sin(yaw), look.trunk[1]);
  const cx = c.x + c.toX * c.reach, cz = c.z + c.toZ * c.reach, m = 4 + (rnd() * 3 | 0);
  for (let i = 0; i < m; i++) { const s = (1.2 + rnd() * .9) * .7, a = rnd() * Math.PI * 2, r = i ? .6 + rnd() * .9 : 0; pushBlob(list, 'ico', s, s * .8, s, cx + Math.cos(a) * r, h + .4 + (i ? -.2 - rnd() * .5 : .3), cz + Math.sin(a) * r, rnd() * .3, rnd() * 3, rnd() * .3, look.leaf[(rnd() * look.leaf.length) | 0]); }
  for (let k = k0; k < list.length; k++) { const p = list[k].attributes.position, sw = new Float32Array(p.count); for (let i = 0; i < p.count; i++) sw[i] = Math.max(0, Math.min(1, p.getY(i) / (h + 1))); list[k].setAttribute('sway', new THREE.BufferAttribute(sw, 1)); }
}
export function addRock(list, rnd, x, z, look = null) {
  const s = .5 + rnd() * 1.1, col = (look ? look.rock : ['#2a2420', '#332b26'])[rnd() < .5 ? 0 : 1];
  if (look) {                                              // F1: глыба из додекаэдров вместо кубов
    const k0 = list.length;
    pushBlob(list, 'dodeca', s * .75, s * .55, s * .6, x, s * .3, z, 0, rnd() * 3, 0, col);
    if (rnd() < .6) pushBlob(list, 'dodeca', s * .5, s * .45, s * .5, x + s * .5, s * .45, z + s * .2, .2, rnd() * 3, .3, col);
    for (let k = k0; k < list.length; k++) list[k].setAttribute('sway', new THREE.BufferAttribute(new Float32Array(list[k].attributes.position.count), 1));     // камень не качается (F2)
    return;
  }
  pushBox(list, s * 1.4, s, s * 1.1, x, s * .4, z, 0, rnd() * 3, 0, col);
  if (rnd() < .6) pushBox(list, s, s * .8, s * .9, x + s * .5, s * .7, z + s * .2, .2, rnd() * 3, .3, col);
}

export function makeCampfire() {
  const g = new THREE.Group();
  const log = lam('#3a2616');
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, l = box(.22, 1.5, .22, log, Math.cos(a) * .35, .3, Math.sin(a) * .35); l.rotation.set(Math.sin(a) * 1.0, 0, -Math.cos(a) * 1.0); g.add(l); }
  const f1 = box(.7, .9, .7, basic('#e0602a'), 0, .7, 0), f2 = box(.4, .7, .4, basic('#ffd27a'), 0, .75, 0), f3 = box(.25, .5, .25, basic('#fff0b0'), 0, .8, 0);
  g.add(f1, f2, f3);
  const light = new THREE.PointLight('#ff7a30', 28, 18, 1.6); light.position.set(0, 1.4, 0); g.add(light);
  return { group: g, flames: [f1, f2, f3], light };
}

// торговец: человек в фартуке и шляпе, стоит за прилавком и поворачивается к герою
export function makeNpc(kind = 'merchant', tint = '#5a4a3a') {
  const g = new THREE.Group(), root = new THREE.Group(); g.add(root);
  const smith = kind === 'smith', cap = kind === 'captain', wand = kind === 'wanderer', trav = kind === 'traveler', m = c => lam(c);
  root.add(box(.5, .8, .3, m(smith ? '#2a2420' : '#4a3a2c'), 0, .4, 0), box(.7, .9, .4, m(smith ? '#6a4a3a' : cap ? '#3a4a68' : wand ? '#4a2e6e' : trav ? '#4a5a34' : tint), 0, 1.25, 0), box(.5, .5, .42, m(smith ? '#2a2420' : '#8a7a62'), 0, smith ? 1.1 : 1.0, .02), box(.42, .42, .42, m(smith ? '#b89a7a' : '#cdb89a'), 0, 1.95, 0));
  if (cap) root.add(box(.5, .3, .5, m('#8a8f98'), 0, 2.2, 0), box(.1, .35, .14, m('#a1121f'), 0, 2.5, 0), box(.1, 1.6, .1, m('#6a5a46'), .72, .8, .1));
  else if (kind === 'villager') root.add(box(.44, .16, .44, m('#3a2a1e'), 0, 2.2, 0));     // житель: простая шапка
  else if (trav) root.add(box(.6, .12, .6, m('#3a2a1a'), 0, 2.2, 0), box(.36, .7, .3, m('#6a4a2a'), 0, 1.3, -.32));     // шляпа и котомка
  else if (wand) root.add(box(.9, .08, .9, m('#2e1e48'), 0, 2.2, 0), box(.46, .4, .46, m('#2e1e48'), 0, 2.42, 0), box(.3, .4, .3, m('#2e1e48'), .05, 2.8, -.04), box(.16, .3, .16, m('#c8a04a'), .1, 3.1, -.08));
  else if (!smith) root.add(box(.8, .08, .8, m('#2a1c12'), 0, 2.2, 0), box(.46, .3, .46, m('#2a1c12'), 0, 2.38, 0));
  else root.add(box(.5, .12, .46, m('#1a1614'), 0, 2.2, 0), box(.12, .5, .12, m('#6a645c'), .72, .8, .1), box(.34, .2, .2, m('#6a645c'), .72, 1.1, .1));
  const armL = limb(.2, .7, .2, m('#5a4a3a'), .5, 1.6, 0), armR = limb(.2, .7, .2, m('#5a4a3a'), -.5, 1.6, 0);
  root.add(armL, armR);
  return { group: g, root, armL, armR };
}

// ворона: тело и два крыла (крылья машут в полёте)
export function makeCrow() {
  const g = new THREE.Group(), black = lam('#141012');
  g.add(box(.22, .2, .42, black, 0, .16, 0), box(.16, .16, .18, black, 0, .3, .22), box(.06, .05, .12, lam('#3a3020'), 0, .28, .36));
  const wl = new THREE.Group(), wr = new THREE.Group(); wl.position.set(.1, .22, 0); wr.position.set(-.1, .22, 0);
  wl.add(box(.42, .04, .26, black, .21, 0, 0)); wr.add(box(.42, .04, .26, black, -.21, 0, 0)); g.add(wl, wr);
  return { group: g, wl, wr };
}

// звери (G2): олень и заяц из коробок; legs — ноги для шага
export function makeBeast(kind) {
  const g = new THREE.Group(), legs = [];
  if (kind === 'deer') {
    const fur = lam('#8a5a32'), pale = lam('#d8c8a8'), dark = lam('#3a2616');
    g.add(box(.5, .5, 1.2, fur, 0, 1.0, 0), box(.3, .55, .3, fur, 0, 1.4, .55), box(.26, .26, .46, fur, 0, 1.68, .72), box(.2, .16, .06, pale, 0, 1.05, -.62));
    for (const sx of [-1, 1]) g.add(box(.05, .45, .05, dark, sx * .12, 2.0, .62), box(.24, .05, .05, dark, sx * .2, 2.18, .62));
    for (const [x, z] of [[-.17, -.45], [.17, -.45], [-.17, .45], [.17, .45]]) { const l = new THREE.Group(); l.position.set(x, .78, z); l.add(box(.1, .78, .1, fur, 0, -.39, 0)); g.add(l); legs.push(l); }
  } else if (kind === 'fox') {     // лиса (2026-10-18)
    const fur = lam('#c8642a'), pale = lam('#f0e4d0'), dark = lam('#2a1a12');
    g.add(box(.26, .26, .66, fur, 0, .42, 0), box(.22, .22, .26, fur, 0, .56, .38), box(.12, .1, .16, pale, 0, .5, .56), box(.06, .12, .04, dark, -.07, .72, .4), box(.06, .12, .04, dark, .07, .72, .4), box(.14, .14, .44, fur, 0, .46, -.5), box(.14, .14, .12, pale, 0, .46, -.76));
    for (const [x, z] of [[-.09, -.22], [.09, -.22], [-.09, .22], [.09, .22]]) { const l = new THREE.Group(); l.position.set(x, .3, z); l.add(box(.07, .3, .07, dark, 0, -.15, 0)); g.add(l); legs.push(l); }
  } else if (kind === 'goat') {     // горный козёл
    const fur = lam('#d8d0c0'), dark = lam('#5a4a3a'), horn = lam('#8a7a62');
    g.add(box(.36, .38, .8, fur, 0, .78, 0), box(.2, .3, .24, fur, 0, 1.06, .44), box(.16, .16, .26, fur, 0, 1.14, .6), box(.06, .2, .06, dark, 0, .95, .74));
    for (const sx of [-1, 1]) g.add(box(.05, .26, .05, horn, sx * .07, 1.32, .5), box(.05, .05, .18, horn, sx * .07, 1.44, .42));
    for (const [x, z] of [[-.12, -.3], [.12, -.3], [-.12, .3], [.12, .3]]) { const l = new THREE.Group(); l.position.set(x, .6, z); l.add(box(.08, .6, .08, dark, 0, -.3, 0)); g.add(l); legs.push(l); }
  } else if (kind === 'heron') {     // цапля на болоте: длинные ноги и шея
    const gray = lam('#a8acb0'), pale = lam('#e8ecec'), dark = lam('#3a3a3a'), beak = lam('#d8a83a');
    g.add(box(.26, .28, .5, gray, 0, 1.1, 0), box(.08, .5, .08, pale, 0, 1.45, .22), box(.12, .12, .16, pale, 0, 1.72, .26), box(.04, .04, .28, beak, 0, 1.7, .46), box(.24, .06, .3, dark, 0, 1.22, -.24));
    for (const x of [-.06, .06]) { const l = new THREE.Group(); l.position.set(x, .96, 0); l.add(box(.03, .96, .03, dark, 0, -.48, 0)); g.add(l); legs.push(l); }
  } else if (kind === 'duck') {     // утка на воде (без ног)
    const body = lam('#7a5a3a'), head = lam('#2a6a4a'), beak = lam('#d8a83a'), pale = lam('#e8e0d0');
    g.add(box(.26, .16, .4, body, 0, .08, 0), box(.14, .14, .14, head, 0, .24, .16), box(.08, .04, .1, beak, 0, .22, .27), box(.27, .04, .1, pale, 0, .14, .05));
  } else {
    const fur = lam('#9a8a6a'), pale = lam('#e8e0d0');
    g.add(box(.28, .26, .46, fur, 0, .3, 0), box(.2, .2, .22, fur, 0, .42, .24), box(.05, .26, .08, fur, -.05, .64, .24), box(.05, .26, .08, fur, .05, .64, .24), box(.12, .12, .1, pale, 0, .34, -.26));
    for (const [x, z] of [[-.09, -.15], [.09, -.15], [-.09, .18], [.09, .18]]) { const l = new THREE.Group(); l.position.set(x, .2, z); l.add(box(.07, .2, .1, fur, 0, -.1, 0)); g.add(l); legs.push(l); }
  }
  return { group: g, legs };
}

// повозка сказочного торговца: кузов, колёса, полог, светящийся фонарь и сам торговец в остроконечной шляпе
export function makeCart(wanderer = true) {
  const g = new THREE.Group(), wood = lam('#5a3e26'), dark = lam('#2e2018'), cloth = lam(wanderer ? '#4a2e6e' : '#8a7a5a'), trim = lam(wanderer ? '#c8a04a' : '#5a4a32');
  g.add(box(1.8, .5, 3, wood, 0, .9, 0), box(1.9, .12, 3.1, dark, 0, 1.18, 0));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const w = box(.14, .9, .9, dark, x, .45, z); g.add(w); }
  g.add(box(1.7, 1.2, 2.6, cloth, 0, 1.85, -.1), box(1.8, .3, 2.7, cloth, 0, 2.5, -.1), box(.12, .32, 2.75, trim, .86, 2.5, -.1), box(.12, .32, 2.75, trim, -.86, 2.5, -.1), box(.1, .1, 1.6, dark, 0, .75, 2.2));
  for (const z of [-.9, .3]) g.add(box(.5, .4, .5, lam('#6a4a2a'), .3, 1.4, z), box(.4, .3, .4, lam('#3a5a4a'), -.3, 1.35, z + .4));
  const pole = box(.08, 1.6, .08, dark, .95, 2.2, 1.3), lamp = box(.26, .34, .26, basic(wanderer ? '#e0c0ff' : '#ffc870'), .95, 2.9, 1.3); g.add(pole, lamp);
  if (!wanderer) { const horse = new THREE.Group(), hide = lam('#4a3020'); horse.add(box(.7, .7, 1.7, hide, 0, 1.2, 0), box(.4, .7, .5, hide, 0, 1.75, .95), box(.2, .25, .4, lam('#2a1a10'), 0, 1.95, 1.3)); for (const [x, z] of [[-.25, -.6], [.25, -.6], [-.25, .6], [.25, .6]]) horse.add(box(.16, .85, .16, hide, x, .42, z)); horse.position.set(0, 0, 3.1); g.add(horse); return { group: g, lamp }; }
  const npc = makeNpc('wanderer'); npc.group.position.set(1.6, 0, .6); g.add(npc.group);
  const mark = new THREE.Mesh(new THREE.OctahedronGeometry(.26), basic('#c8a0ff')); mark.position.set(1.6, 3.4, .6); g.add(mark);
  return { group: g, npc, lamp, mark };
}

// боец отряда: цвет накидки и оружие зависят от вида
export function makeSoldier(type, cfg) {
  const T = cfg.squad.types[type], mats = [];
  const M = c => { const m = lam(c); mats.push(m); return m; };
  const g = new THREE.Group(), root = new THREE.Group(); g.add(root);
  const tint = M(T.tint), metal = M('#8a8f98'), skin = M('#cdb89a'), dark = M('#2a2420'), cloth = M('#4a3a2c');
  root.add(box(.62, .8, .38, tint, 0, 1.25, 0), box(.64, .12, .4, dark, 0, .88, 0), box(.4, .4, .4, skin, 0, 1.85, 0));
  const helm = type === 'guard' ? box(.46, .22, .46, metal, 0, 2.08, 0) : type === 'soldier' ? box(.46, .34, .46, metal, 0, 2.05, 0) : box(.5, .4, .5, M('#1a1a1e'), 0, 2.06, 0);
  root.add(helm);
  if (type === 'soldier') root.add(box(.1, .22, .06, metal, 0, 1.9, .26));
  if (type === 'veteran') root.add(box(.1, .35, .14, M('#a1121f'), 0, 2.4, -.05));
  const armL = limb(.2, .7, .22, tint, .42, 1.55, 0), armR = limb(.2, .7, .22, tint, -.42, 1.55, 0);
  const legL = limb(.26, .6, .28, cloth, .16, .6, 0), legR = limb(.26, .6, .28, cloth, -.16, .6, 0);
  // оружие в правой руке
  if (type === 'guard') armR.add(box(.07, 2.1, .07, M('#6a5a46'), 0, -.2, .25), box(.12, .3, .05, metal, 0, .95, .25));
  else if (type === 'soldier') { armR.add(box(.08, 1.0, .12, metal, 0, -.55, .3)); armL.add(box(.1, .62, .5, tint, .1, -.35, .15), box(.12, .2, .2, metal, .1, -.35, .15)); }
  else armR.add(box(.12, 1.7, .08, metal, 0, -.45, .3), box(.34, .1, .12, dark, 0, .35, .3));
  root.add(armL, armR, legL, legR);
  return { group: g, root, armL, armR, legL, legR, flash: f => { for (const m of mats) m.emissive.setRGB(f, f * .8, f * .8); } };
}
export function animateSoldier(m, a, time) {
  const mv = a.moving && !a.dead, ph = time * 10 + a.id * 1.3;
  m.legL.rotation.x = mv ? Math.sin(ph) * .8 : 0; m.legR.rotation.x = mv ? -Math.sin(ph) * .8 : 0;
  m.armL.rotation.x = mv ? -Math.sin(ph) * .5 : 0; m.armR.rotation.x = mv ? Math.sin(ph) * .5 : 0;
  m.root.rotation.x = 0; m.root.position.y = mv ? Math.abs(Math.sin(ph)) * .06 : 0; m.root.position.z = 0; m.root.rotation.z = 0;
  if (a.state === 'wind') { const k = Math.min(1, a.t / .3); m.armR.rotation.x = -2.2 * k; m.root.rotation.x = -.2 * k; }
  else if (a.state === 'rec') { m.armR.rotation.x = -2.2 + 3 * Math.min(1, a.t * 6); m.root.rotation.x = .25; }
  if (a.dead) { const k = Math.min(1, a.deadT / .5); m.root.rotation.z = 1.4 * k; m.root.position.y = -.4 * k; }
  m.flash(a.flash > 0 ? .8 : 0);
}
