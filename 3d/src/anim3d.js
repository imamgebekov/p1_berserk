// Позы удара героя: чистые числа без графики (тестируется в Node). Рендер крутит по ним руку, оружие и корпус.
// У каждого типа оружия своё семейство движений; в семействе три замаха: a — прямой, b — обратный, fin — завершающий (каждый третий удар цепочки).
// Поза: yaw — поворот руки вокруг вертикали от плеча (− вправо-назад, + влево), pitch — наклон оружия вперёд (0 — вверх, π/2 — вперёд, больше — к земле),
// tilt — крен лезвия, reach — вынос руки вперёд, м, twist — поворот корпуса, lean — наклон корпуса вперёд, lift — подскок, м.

export const REST = { yaw: -.35, pitch: .25, tilt: -.12, reach: 0, twist: 0, lean: 0, lift: 0 };

export const FAMILY = {
  fists: 'fists',
  dagger: 'thrust', knife: 'thrust', rapier: 'thrust', spear: 'thrust',
  sword: 'slash', axe: 'slash', sickle: 'slash', halberd: 'slash',
  mace: 'smash', club: 'smash', hammer: 'smash', pick: 'smash',
  scythe: 'spin', greatsword: 'spin', war_axe: 'spin',
  flail: 'flail', chain_ball: 'flail'
};
export const familyOf = kind => FAMILY[kind] || 'slash';
export const FAMILY_NAME = { slash: 'рубящий', thrust: 'колющий', smash: 'дробящий', spin: 'круговой', flail: 'цепной', fists: 'кулаки' };

// какой из трёх замахов: завершающий — каждый третий, остальные чередуются
export const stepOf = (chain, fin) => (fin ? 'fin' : (chain % 2 === 1 ? 'a' : 'b'));

// ключевые позы: wind — конец замаха (герой «натянут»), strike — конец удара (оружие прошло цель)
const P = (yaw, pitch, o = {}) => ({ yaw, pitch, tilt: 0, reach: 0, twist: 0, lean: 0, lift: 0, ...o });
const TAU = Math.PI * 2;
export const KEYS = {
  slash: {
    a: [P(-1.7, .9, { twist: -.35 }), P(1.55, 1.45, { twist: .3, lean: .1 })],
    b: [P(1.45, 1.0, { twist: .35, tilt: .3 }), P(-1.6, 1.45, { twist: -.3, lean: .1, tilt: .3 })],
    fin: [P(0, -.65, { lean: -.15, lift: .12 }), P(0, 2.05, { lean: .32 })]
  },
  thrust: {
    a: [P(-.25, 1.45, { reach: -.35, twist: -.3 }), P(0, 1.55, { reach: .6, twist: .2, lean: .2 })],
    b: [P(.9, 1.2, { reach: -.3, twist: .55, tilt: .5 }), P(-.35, 1.55, { reach: .55, twist: -.35, lean: .2, tilt: .5 })],
    fin: [P(-.1, 1.4, { reach: -.5, twist: -.45, lean: -.1 }), P(0, 1.58, { reach: .95, twist: .15, lean: .38, lift: .05 })]
  },
  smash: {
    a: [P(-1.0, -.6, { lean: -.2, twist: -.35 }), P(.35, 1.95, { lean: .35, twist: .25 })],
    b: [P(1.1, -.5, { lean: -.18, tilt: .35, twist: .4 }), P(-.55, 1.85, { lean: .33, tilt: .35, twist: -.35 })],
    fin: [P(0, -1.0, { lean: -.25, lift: .4 }), P(0, 2.15, { lean: .45 })]
  },
  spin: {
    a: [P(-2.0, 1.2, { twist: -.5 }), P(2.0, 1.45, { twist: .5, lean: .1 })],
    b: [P(2.0, 1.2, { twist: .5, tilt: .3 }), P(-2.0, 1.45, { twist: -.5, lean: .1, tilt: .3 })],
    fin: [P(1.5, 1.35, { twist: -.6 }), P(1.5, 1.45, { twist: TAU - .6, lean: .1 })]
  },
  flail: {
    a: [P(-1.2, .15, { twist: -.3, lift: .05 }), P(1.3, 1.6, { twist: .3, lean: .15 })],
    b: [P(1.2, .15, { twist: .3, lift: .05 }), P(-1.3, 1.6, { twist: -.3, lean: .15 })],
    fin: [P(1.5, 1.3, { twist: -.4 }), P(1.5, 1.5, { twist: TAU - .4, lean: .15 })]
  },
  fists: {
    a: [P(-.2, 1.3, { reach: -.25, twist: -.25 }), P(0, 1.55, { reach: .5, twist: .25, lean: .12 })],
    b: [P(.2, 1.3, { reach: -.25, twist: .25 }), P(0, 1.55, { reach: .5, twist: -.25, lean: .12 })],
    fin: [P(0, 2.0, { reach: -.2, lean: .2, lift: -.05 }), P(0, .2, { reach: .3, lean: -.2, lift: .2 })]
  }
};

const mix = (a, b, k) => { const o = {}; for (const key of Object.keys(REST)) o[key] = a[key] + (b[key] - a[key]) * k; return o; };
const easeOut = k => 1 - Math.pow(1 - k, 3);
const easeInOut = k => (k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

// поза в момент t (0–1 от длительности удара); hit — доля, когда удар наносит урон (контакт в середине размаха)
export function swingPose(family, step, t, hit) {
  const K = (KEYS[family] || KEYS.slash)[step] || KEYS.slash.a, wind = K[0], strike = K[1];
  const tw = hit * .55, ts = Math.min(.92, hit + (1 - hit) * .35);     // конец замаха и конец размаха
  if (t <= 0) return { ...REST };
  if (t < tw) return mix(REST, wind, easeInOut(t / tw));
  if (t < ts) return mix(wind, strike, easeOut((t - tw) / (ts - tw)));
  if (t < 1) {
    const e = easeInOut((t - ts) / (1 - ts)), r = mix(strike, REST, e);
    if (strike.twist > Math.PI) r.twist = (strike.twist - TAU) * (1 - e);       // после полного оборота корпус доворачивается вперёд, а не раскручивается назад
    return r;
  }
  return { ...REST };
}

// след за клинком: видно ли его в этот момент (только во время размаха)
export const trailOn = (t, hit) => t > hit * .5 && t < Math.min(.95, hit + (1 - hit) * .45);
