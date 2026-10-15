// Оружие в руке героя: модель из кубиков по типу (меч, копьё, молот…) и материалу (ржавое, костяное, чёрное…). Только графика.
// Рукоять в начале координат, оружие смотрит вверх (+y). base и tip — точки начала и конца рабочей части: по ним рисуется след удара.
import * as THREE from 'three';

const METAL = { rust: '#8a5a3a', iron: '#9a9890', tempered: '#b8b4a8', bone: '#d8ccb0', steel: '#cfc9bb', black: '#3e3a46', blood: '#8a1e22', unique: '#e2d2a2' };
const EDGE = { rust: '#5e3a24', iron: '#72706a', tempered: '#8c887e', bone: '#a89a80', steel: '#8d877b', black: '#26222c', blood: '#5a1014', unique: '#b89a5a' };
const WOOD = '#5a3e26', GRIP = '#2a1a12', GUARD = '#8a7a62';
const lam = c => new THREE.MeshLambertMaterial({ color: c });
const box = (g, w, h, d, m, x = 0, y = 0, z = 0, rz = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.rotation.z = rz; g.add(b); return b; };

const BAND = 1.1;   // след не шире этого, м: у длинного оружия — серп у края, а не веер от рукояти
// длина рабочей части по типу (для следа), м: где начинается и кончается то, чем бьют
const SPAN = {
  fists: [-.05, .2], dagger: [.25, .85], knife: [.25, .75], rapier: [.4, 2.0], sword: [.35, 1.9], greatsword: [.45, 3.1],
  sickle: [.45, 1.1], axe: [.8, 1.35], war_axe: [1.0, 1.85], halberd: [1.8, 2.9], spear: [1.9, 2.9], scythe: [1.6, 2.6],
  bow: [.2, .4], longbow: [.2, .4], crossbow: [.2, .4],
  mace: [.75, 1.15], club: [.6, 1.4], hammer: [1.2, 1.8], pick: [.9, 1.35], flail: [.9, 1.5], chain_ball: [1.0, 1.9]
};
const BUILD = {
  // ось y — вдоль руки (вперёд при выстреле): у луков плечи по z (встают вертикально), тетива ближе к герою; у арбалета ложе по y, дуга по x
  bow: (g, m) => { box(g, .1, .1, .3, lam(GRIP)); for (const s of [1, -1]) { box(g, .08, .08, .5, lam(WOOD), 0, .04, s * .38); box(g, .07, .07, .3, lam(WOOD), 0, -.06, s * .72); box(g, .06, .06, .06, m, 0, -.1, s * .88); } box(g, .02, .02, 1.75, lam('#d8d0b8'), 0, -.12, 0); },
  longbow: (g, m) => { box(g, .1, .1, .34, lam(GRIP)); for (const s of [1, -1]) { box(g, .08, .08, .7, lam(WOOD), 0, .05, s * .52); box(g, .07, .07, .45, lam(WOOD), 0, -.07, s * 1.05); box(g, .06, .06, .06, m, 0, -.12, s * 1.28); } box(g, .02, .02, 2.55, lam('#d8d0b8'), 0, -.14, 0); },
  crossbow: (g, m, e) => { box(g, .12, .3, .12, lam(GRIP)); box(g, .14, .9, .14, lam(WOOD), 0, .45, 0); box(g, 1.0, .1, .08, m, 0, .84, 0); box(g, .1, .1, .1, e, .5, .84, 0); box(g, .1, .1, .1, e, -.5, .84, 0); box(g, 1.0, .02, .02, lam('#d8d0b8'), 0, .66, 0); },
  fists: g => { box(g, .24, .24, .24, lam('#cdb89a'), 0, .06); box(g, .26, .08, .26, lam('#4a3a35'), 0, -.08); },
  dagger: (g, m, e) => { box(g, .1, .3, .1, lam(GRIP)); box(g, .32, .07, .12, lam(GUARD), 0, .17); box(g, .14, .62, .06, m, 0, .52); box(g, .04, .62, .07, e, .06, .52); },
  knife: (g, m, e) => { box(g, .1, .3, .1, lam(GRIP)); box(g, .12, .5, .05, m, .02, .48); box(g, .04, .5, .06, e, .07, .48); },
  rapier: (g, m, e) => { box(g, .09, .38, .09, lam(GRIP)); box(g, .3, .16, .3, lam(GUARD), 0, .24); box(g, .06, 1.7, .05, m, 0, 1.15); box(g, .02, 1.7, .06, e, .03, 1.15); },
  sword: (g, m, e) => { box(g, .11, .4, .11, lam(GRIP)); box(g, .5, .1, .14, lam(GUARD), 0, .24); box(g, .18, 1.6, .07, m, 0, 1.1); box(g, .04, 1.6, .08, e, .08, 1.1); box(g, .1, .18, .06, m, 0, 1.96); },
  greatsword: (g, m, e) => { box(g, .12, .5, .12, lam(GRIP)); box(g, .7, .12, .16, lam(GUARD), 0, .28); box(g, .24, 2.5, .09, m, 0, 1.58); box(g, .05, 2.5, .1, e, .1, 1.58); box(g, .2, .3, .08, m, 0, 3.0); },
  sickle: (g, m, e) => { box(g, .1, .55, .1, lam(WOOD), 0, .1); box(g, .1, .55, .05, m, .12, .6, 0, -.5); box(g, .1, .45, .05, m, .38, .95, 0, -1.3); box(g, .03, .45, .06, e, .36, .9, 0, -1.3); },
  axe: (g, m, e) => { box(g, .1, 1.35, .1, lam(WOOD), 0, .6); box(g, .45, .38, .06, m, .25, 1.12); box(g, .06, .46, .07, e, .48, 1.12); },
  war_axe: (g, m, e) => { box(g, .12, 1.9, .12, lam(WOOD), 0, .85); box(g, .55, .5, .07, m, .3, 1.55); box(g, .55, .5, .07, m, -.3, 1.55); box(g, .07, .58, .08, e, .58, 1.55); box(g, .07, .58, .08, e, -.58, 1.55); },
  halberd: (g, m, e) => { box(g, .1, 2.8, .1, lam(WOOD), 0, 1.3); box(g, .45, .5, .06, m, .24, 2.35); box(g, .06, .56, .07, e, .46, 2.35); box(g, .12, .55, .06, m, 0, 2.95); box(g, .22, .12, .06, m, -.15, 2.3); },
  spear: (g, m, e) => { box(g, .09, 2.6, .09, lam(WOOD), 0, 1.2); box(g, .18, .5, .05, m, 0, 2.7); box(g, .05, .5, .06, e, 0, 2.7); box(g, .14, .1, .14, lam(GUARD), 0, 2.42); },
  scythe: (g, m, e) => { box(g, .1, 2.6, .1, lam(WOOD), 0, 1.2); box(g, 1.25, .14, .05, m, -.55, 2.45, 0, -.18); box(g, 1.25, .04, .06, e, -.55, 2.38, 0, -.18); box(g, .25, .08, .08, lam(WOOD), .12, 1.4); },
  mace: (g, m, e) => { box(g, .1, 1.0, .1, lam(GRIP), 0, .4); box(g, .3, .36, .3, m, 0, .98); box(g, .44, .1, .1, e, 0, .98); box(g, .1, .1, .44, e, 0, .98); box(g, .1, .48, .1, e, 0, .98); },
  club: (g, m) => { box(g, .1, .35, .1, lam(GRIP)); box(g, .16, .5, .16, lam(WOOD), 0, .5); box(g, .24, .6, .24, lam(WOOD), 0, 1.0); box(g, .08, .08, .3, m, 0, 1.15); box(g, .3, .08, .08, m, 0, .9); },
  hammer: (g, m, e) => { box(g, .11, 1.7, .11, lam(WOOD), 0, .75); box(g, .7, .42, .42, m, 0, 1.6); box(g, .08, .46, .46, e, .36, 1.6); box(g, .08, .46, .46, e, -.36, 1.6); },
  pick: (g, m, e) => { box(g, .1, 1.3, .1, lam(WOOD), 0, .55); box(g, .9, .12, .1, m, 0, 1.18); box(g, .2, .08, .08, e, .52, 1.12, 0, -.4); box(g, .12, .14, .14, m, -.48, 1.18); },
  flail: (g, m, e) => { box(g, .1, .6, .1, lam(WOOD), 0, .2); for (let i = 0; i < 3; i++) box(g, .06, .12, .06, lam('#6a6458'), 0, .6 + i * .14); box(g, .32, .32, .32, m, 0, 1.2); box(g, .44, .08, .08, e, 0, 1.2); box(g, .08, .44, .08, e, 0, 1.2); },
  chain_ball: (g, m, e) => { box(g, .1, .5, .1, lam(GRIP), 0, .15); for (let i = 0; i < 6; i++) box(g, .07, .14, .07, lam('#6a6458'), 0, .5 + i * .16); box(g, .5, .5, .5, m, 0, 1.75); box(g, .66, .1, .1, e, 0, 1.75); box(g, .1, .66, .1, e, 0, 1.75); box(g, .1, .1, .66, e, 0, 1.75); }
};

export function makeWeapon(kind, mat) {
  const g = new THREE.Group(), k = BUILD[kind] ? kind : 'sword';
  BUILD[k](g, lam(METAL[mat] || METAL.steel), lam(EDGE[mat] || EDGE.steel));
  const [a, b] = SPAN[k], base = new THREE.Object3D(), tip = new THREE.Object3D();
  base.position.y = Math.max(a, b - BAND); tip.position.y = b; g.add(base, tip);      // след — только внешняя полоса размаха
  return { group: g, base, tip, kind: k };
}
export const weaponKinds = () => Object.keys(BUILD);
