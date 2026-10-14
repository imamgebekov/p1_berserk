// Модели из кубиков (никаких внешних файлов): герой, бес, рогач, дерево, камень, костёр.
import * as THREE from 'three';

const lam = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
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
  const cloth = M('#6a5148'), skin = M('#cdb89a'), dark = M('#3a2c28'), steel = M('#cfc9bb'), edge = M('#8d877b'), guard = M('#8a7a62'), grip = M('#2a1a12'), cape = M('#7a1e26');
  const legL = limb(.28, .8, .32, M('#4a3a35'), .2, .8, 0), legR = limb(.28, .8, .32, M('#4a3a35'), -.2, .8, 0);
  const torso = box(.78, .85, .45, cloth, 0, 1.25, 0);
  const belt = box(.8, .12, .47, M('#2a2422'), 0, .88, 0);
  const shoulder = box(.4, .28, .5, M('#4a463f'), .42, 1.6, 0);
  const head = box(.46, .46, .46, skin, 0, 1.92, .02);
  const hair = box(.5, .22, .5, dark, 0, 2.1, -.02);
  const hair2 = box(.5, .36, .12, dark, 0, 1.98, -.22);
  const eyeL = box(.07, .07, .04, basic('#1a1210'), .1, 1.95, .24), eyeR = box(.07, .07, .04, basic('#1a1210'), -.1, 1.95, .24);
  const cloak = new THREE.Group(); cloak.position.set(0, 1.6, -.26); cloak.add(box(.78, 1.25, .1, cape, 0, -.62, 0));
  // рука с мечом: swing крутится вокруг вертикали от плеча, sword — наклон лезвия
  const swing = new THREE.Group(); swing.position.set(0, 1.55, 0);
  const sword = new THREE.Group(); sword.position.set(-.48, 0, .12);
  sword.add(box(.12, .5, .12, grip, 0, 0, 0), box(.7, .12, .16, guard, 0, .28, 0), box(.24, 2.5, .09, steel, 0, 1.58, 0), box(.05, 2.5, .1, edge, .1, 1.58, 0), box(.2, .3, .08, steel, 0, 3.0, 0));
  swing.add(sword);
  const armL = limb(.2, .75, .22, cloth, .5, 1.62, 0);
  root.add(legL, legR, torso, belt, shoulder, head, hair, hair2, eyeL, eyeR, cloak, swing, armL);
  const set = f => flasher(mats)(f);
  return { group: g, root, legL, legR, cloak, swing, sword, armL, head, flash: set, kind: 'hero' };
}

export function animateHero(h, p, time, dt, cfg) {
  const speed = Math.hypot(p.vx, p.vz), run = Math.min(1, speed / cfg.player.speed);
  const ph = time * (7 + run * 6);
  const roll = p.state === 'roll', atk = p.state === 'atk', dead = p.dead;
  h.legL.rotation.x = Math.sin(ph) * .9 * run; h.legR.rotation.x = -Math.sin(ph) * .9 * run;
  h.armL.rotation.x = -Math.sin(ph) * .7 * run;
  const bob = Math.abs(Math.sin(ph)) * .1 * run;
  h.root.position.y = bob; h.root.rotation.x = 0; h.root.scale.set(1, 1, 1);
  h.cloak.rotation.x = .12 + run * .5 + Math.sin(time * 3) * .05;
  // меч
  let yaw = -.35, pitch = .25, tilt = -.12;
  if (atk) {
    const t = p.atkT / cfg.player.attackTime, hit = cfg.player.attackHitAt / cfg.player.attackTime;
    if (t < hit) { const k = t / hit; yaw = -.35 + (-1.7 + .35) * k; pitch = .25 + .65 * k; }
    else { const k = Math.min(1, (t - hit) / (1 - hit) * 1.6); const ease = 1 - Math.pow(1 - k, 3); yaw = -1.7 + 3.3 * ease; pitch = .9 + .6 * ease; if (k >= 1) { yaw = 1.6; pitch = 1.5; } }
    tilt = 0;
  }
  h.swing.rotation.y = yaw; h.sword.rotation.x = pitch; h.sword.rotation.z = tilt;
  if (roll) {
    const k = p.rollT / cfg.player.rollTime;
    h.root.rotation.x = k * Math.PI * 2; h.root.position.y = .85 + Math.sin(k * Math.PI) * .25; h.root.scale.set(.85, .75, .85);
  }
  if (dead) { h.root.rotation.x = -Math.min(1.5, p.deadT * 4); h.root.position.y = .3; }
  // вспышка при уроне: мигаем во время неуязвимости
  h.flash(p.inv > 0 && !roll && Math.floor(time * 20) % 2 ? .7 : 0);
}

// ---------- враги ----------
// облик по виду: цвета и особенности
const LOOKS = {
  imp: { body: '#3b3345', dark: '#1a121a', eye: '#ff3030' },
  brute: { body: '#4a3430', dark: '#2a1c1a', eye: '#ff3030' },
  hound: { body: '#55503f', dark: '#2a2620', eye: '#ffb020' },
  ghoul: { body: '#58675a', dark: '#2a3a30', eye: '#b8ff90' },
  devourer: { shape: 'ghoul', body: '#3c4e44', dark: '#1a2a22', eye: '#e8ff60', crown: '#c8d8a0' },
  lord: { shape: 'imp', body: '#2a2028', dark: '#0e0a10', eye: '#ff7a20', crown: '#ff9a40' },
  chief: { shape: 'brute', body: '#5a2c24', dark: '#2a1210', eye: '#ffc030', crown: '#d8c8a8' }
};
export function makeMonster(kind, cfg) {
  const mats = [], L = LOOKS[kind] || LOOKS.imp;
  const M = (c, o) => { const m = lam(c, o); mats.push(m); return m; };
  const body = M(L.body), dark = M(L.dark), bone = M('#d8cfbd');
  const g = new THREE.Group(), root = new THREE.Group(); g.add(root);
  const shape = L.shape || kind, hound = shape === 'hound', ghoul = shape === 'ghoul';
  root.add(box(hound ? .6 : .8, hound ? .7 : .85, hound ? .8 : .55, body, 0, .95, 0));
  const head = box(.55, .5, hound ? .7 : .5, body, 0, hound ? 1.45 : 1.65, hound ? .35 : .05); root.add(head);
  root.add(box(.1, .1, .05, basic(L.eye), .12, hound ? 1.5 : 1.7, hound ? .72 : .31), box(.1, .1, .05, basic(L.eye), -.12, hound ? 1.5 : 1.7, hound ? .72 : .31));
  if (shape === 'brute') { root.add(box(.12, .5, .12, bone, .3, 2.05, .05)); root.add(box(.12, .5, .12, bone, -.3, 2.05, .05)); }
  else if (hound) { root.add(box(.14, .35, .1, dark, .2, 1.8, .3)); root.add(box(.14, .35, .1, dark, -.2, 1.8, .3)); root.add(box(.12, .12, .6, body, 0, 1.1, -.65)); }
  else if (ghoul) { root.add(box(.5, .1, .5, dark, 0, 1.95, .05)); root.add(box(.2, .5, .12, dark, 0, 1.5, -.3)); }
  else { root.add(box(.14, .3, .1, body, .3, 1.95, 0)); root.add(box(.14, .3, .1, body, -.3, 1.95, 0)); }
  if (L.crown) { const cm = basic(L.crown); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; root.add(box(.1, .42, .1, cm, Math.cos(a) * .3, 2.25 + (i % 2) * .12, Math.sin(a) * .3 + .05)); } root.add(box(.3, .4, .3, cm, .62, 1.7, 0), box(.3, .4, .3, cm, -.62, 1.7, 0)); }
  const al = ghoul ? 1.05 : .75;
  const armL = limb(.22, al, .24, body, .55, 1.3, 0), armR = limb(.22, al, .24, body, -.55, 1.3, 0);
  const legL = limb(.3, .6, .3, dark, .22, .6, 0), legR = limb(.3, .6, .3, dark, -.22, .6, 0);
  armL.add(box(.1, .22, .08, bone, 0, -al - .07, .1)); armR.add(box(.1, .22, .08, bone, 0, -al - .07, .1));
  root.add(armL, armR, legL, legR);
  const s = cfg.enemies[kind].scale; g.scale.set(s, s, s);
  return { group: g, root, armL, armR, legL, legR, head, flash: flasher(mats), kind };
}

export function animateMonster(m, e, time, cfg) {
  const C = cfg.enemies[e.type];
  const spd = Math.hypot(e.vx, e.vz);
  const moving = e.state === 'chase' && !e.dead;
  const ph = time * (6 + C.speed) + e.id * 1.7;
  m.legL.rotation.x = moving ? Math.sin(ph) * .8 : 0; m.legR.rotation.x = moving ? -Math.sin(ph) * .8 : 0;
  m.armL.rotation.x = moving ? -Math.sin(ph) * .6 : 0; m.armR.rotation.x = moving ? Math.sin(ph) * .6 : 0;
  m.root.position.y = moving ? Math.abs(Math.sin(ph)) * .08 : 0; m.root.rotation.x = 0; m.root.rotation.z = 0; m.root.position.z = 0;
  let red = 0;
  if (e.state === 'wind') {
    const k = Math.min(1, e.t / C.wind);
    m.armL.rotation.x = m.armR.rotation.x = -2.4 * k; m.root.rotation.x = -.3 * k; m.root.position.z = -.15 * k;
    red = .35 + .35 * Math.sin(time * 40);
  } else if (e.state === 'rec') {
    const k = Math.min(1, e.t / .25);
    m.armL.rotation.x = m.armR.rotation.x = -2.4 + 3.2 * Math.min(1, k * 3); m.root.rotation.x = .4 * (1 - k); m.root.position.z = .25 * (1 - k);
  }
  if (e.dead) { const k = Math.min(1, e.deadT / .5); m.root.rotation.z = 1.4 * k; m.root.position.y = -.5 * k; red = 0; }
  // цвет статуса: горит, мёрзнет, отравлен, кровоточит, оглушён
  let tint = null; const st = e.st;
  if (st && !e.dead) {
    const pu = .6 + .4 * Math.sin(time * 14);
    tint = st.stun ? [.4 * pu, .38 * pu, .02] : st.freeze ? [.04, .22, .45] : st.burn ? [.5 * (.7 + .3 * Math.sin(time * 31)), .16, 0] : st.poison ? [0, .3, .04] : st.bleed ? [.38, 0, 0] : null;
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
  const c = new THREE.Color(color), n = geo.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  list.push(geo);
}

export function addTree(list, rnd, x, z) {
  const h = 2.6 + rnd() * 2.2, col = rnd() < .5 ? '#1a1210' : '#221813';
  pushBox(list, .36, h, .36, x, h / 2, z, 0, 0, (rnd() - .5) * .15, col);
  const n = 2 + (rnd() * 3 | 0);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, y = h * (.45 + rnd() * .5), l = 1 + rnd() * 1.4;
    pushBox(list, .16, l, .16, x + Math.cos(a) * l * .35, y + l * .2, z + Math.sin(a) * l * .35, Math.sin(a) * .9, 0, -Math.cos(a) * .9, col);
  }
}
export function addRock(list, rnd, x, z) {
  const s = .5 + rnd() * 1.1, col = rnd() < .5 ? '#2a2420' : '#332b26';
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
export function makeNpc(kind = 'merchant') {
  const g = new THREE.Group(), root = new THREE.Group(); g.add(root);
  const smith = kind === 'smith', cap = kind === 'captain', m = c => lam(c);
  root.add(box(.5, .8, .3, m(smith ? '#2a2420' : '#4a3a2c'), 0, .4, 0), box(.7, .9, .4, m(smith ? '#6a4a3a' : cap ? '#3a4a68' : '#5a4a3a'), 0, 1.25, 0), box(.5, .5, .42, m(smith ? '#2a2420' : '#8a7a62'), 0, smith ? 1.1 : 1.0, .02), box(.42, .42, .42, m(smith ? '#b89a7a' : '#cdb89a'), 0, 1.95, 0));
  if (cap) root.add(box(.5, .3, .5, m('#8a8f98'), 0, 2.2, 0), box(.1, .35, .14, m('#a1121f'), 0, 2.5, 0), box(.1, 1.6, .1, m('#6a5a46'), .72, .8, .1));
  else if (!smith) root.add(box(.8, .08, .8, m('#2a1c12'), 0, 2.2, 0), box(.46, .3, .46, m('#2a1c12'), 0, 2.38, 0));
  else root.add(box(.5, .12, .46, m('#1a1614'), 0, 2.2, 0), box(.12, .5, .12, m('#6a645c'), .72, .8, .1), box(.34, .2, .2, m('#6a645c'), .72, 1.1, .1));
  const armL = limb(.2, .7, .2, m('#5a4a3a'), .5, 1.6, 0), armR = limb(.2, .7, .2, m('#5a4a3a'), -.5, 1.6, 0);
  root.add(armL, armR);
  return { group: g, root, armL, armR };
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
