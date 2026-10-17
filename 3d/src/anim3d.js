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
  flail: 'flail', chain_ball: 'flail',
  bow: 'bow', longbow: 'bow', crossbow: 'bow'
};
export const familyOf = kind => FAMILY[kind] || 'slash';
export const FAMILY_NAME = { bow: 'стрелковый', slash: 'рубящий', thrust: 'колющий', smash: 'дробящий', spin: 'круговой', flail: 'цепной', fists: 'кулаки' };

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
  // стрельба: рука вперёд, натяжение (корпус развёрнут) и отдача после выстрела
  bow: {
    a: [P(-.15, 1.55, { reach: -.25, twist: -.55 }), P(-.1, 1.5, { reach: .05, twist: -.4, lean: -.06 })],
    b: [P(-.15, 1.55, { reach: -.25, twist: -.55 }), P(-.1, 1.5, { reach: .05, twist: -.4, lean: -.06 })],
    fin: [P(-.15, 1.55, { reach: -.3, twist: -.6 }), P(-.1, 1.48, { reach: .08, twist: -.4, lean: -.1 })]
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
// wound — удар начинается из позы замаха (тяжёлый удар после заряда), без подъёма из стойки
export function swingPose(family, step, t, hit, wound = false) {
  const K = (KEYS[family] || KEYS.slash)[step] || KEYS.slash.a, wind = K[0], strike = K[1];
  const tw = hit * .55, ts = Math.min(.92, hit + (1 - hit) * .35);     // конец замаха и конец размаха
  if (wound && t < tw) return { ...wind };
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

// заряд тяжёлого удара: из стойки в позу завершающего замаха за .15 с; при полном заряде оружие дрожит
export function chargePose(family, chargeT, full, time) {
  const wind = (KEYS[family] || KEYS.slash).fin[0], q = mix(REST, wind, easeInOut(Math.min(1, chargeT / .15))), k = Math.min(1, chargeT / full);
  q.yaw += Math.sin(time * 55) * .04 * k * k; q.pitch += Math.sin(time * 47) * .03 * k * k;
  return q;
}

// след за клинком: видно ли его в этот момент (только во время размаха)
export const trailOn = (t, hit) => t > hit * .5 && t < Math.min(.95, hit + (1 - hit) * .45);

// ---- тело (шаг G5): походка, дыхание, крен, выпад, приземление, отклик на удар, смерть. Чистые числа, только вид ----
const clamp01 = k => Math.max(0, Math.min(1, k));
// походка по настоящей скорости: run 0..1; стоя — дыхание (breath 0..1), на бегу — наклон вперёд
export function gait(speed, max, time, seed = 0) {
  const run = clamp01(speed / Math.max(.01, max)), ph = time * (5 + run * 8) + seed * 1.7;
  return { run, leg: Math.sin(ph) * .9 * run, arm: -Math.sin(ph) * .7 * run, bob: Math.abs(Math.sin(ph)) * .1 * run, lean: .2 * run, breath: (1 - run) * (.5 + .5 * Math.sin(time * 2.2 + seed)) };
}
// крен в поворот: скорость поворота (рад/с) × бег → наклон вбок, не больше .22
export const bank = (turnRate, run) => Math.max(-.22, Math.min(.22, -turnRate * .05 * run));
// удар: выпад вперёд к моменту попадания и возврат; сжатие перед попаданием (замах) и вытяжка сразу после
export function strikeBody(t, hit) {
  const lunge = t < hit ? .16 * easeInOut(clamp01(t / hit)) : .16 * (1 - easeOut(clamp01((t - hit) / (1 - hit))));
  const pre = clamp01((t - hit * .4) / (hit * .6)), post = clamp01((t - hit) / .18);
  const sy = t < hit ? 1 - .07 * Math.sin(Math.PI * pre) : 1 + .05 * Math.sin(Math.PI * post);
  return { lunge, sy };
}
// перекат: сжатие при приземлении (последние 20%)
export const rollLand = k => 1 - .2 * Math.sin(Math.PI * clamp01((k - .8) / .2));
// отклик на удар: наклон прочь от удара; a — откуда пришёл удар относительно лица (0 — спереди)
export const hitLean = (k, a) => ({ rx: -.45 * k * Math.cos(a), rz: .45 * k * Math.sin(a) });
// смерть героя: сначала на колени (0–.25 с), потом навзничь
export function heroDeath(t) {
  const kneel = easeOut(clamp01(t / .25)), fall = easeInOut(clamp01((t - .25) / .35));
  return { rx: .25 * kneel * (1 - fall) - 1.5 * fall, y: -.35 * kneel * (1 - fall) + .3 * fall };
}
// смерть врага: вид падения по номеру (назад, вперёд, на бок); с отскоком, потом оседает и тает
export function foeDeath(t, id) {
  const v = id % 4, k = clamp01(t / .3), b = k < 1 ? 1 + Math.sin(k * Math.PI) * .12 : 1, f = clamp01((t - .3) / .3), a = 1.4 * k * b;
  return { rx: v === 0 ? -a : v === 1 ? a : 0, rz: v === 2 ? a : v === 3 ? -a : 0, y: -.5 * k - .4 * f, scale: 1 - .75 * f };
}

// ---- сглаживание (шаг 3 аудита): затухание, не зависящее от частоты кадров ----
// доля пути к цели за dt при скорости lambda (1/с): за 1/lambda с проходится ~63% пути
export const dampK = (lambda, dt) => 1 - Math.exp(-lambda * Math.max(0, dt));
export const damp = (v, target, lambda, dt) => v + (target - v) * dampK(lambda, dt);
// угол в (−π, π]
export const wrapPi = a => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
// угол к цели коротким путём
export const dampAngle = (v, target, lambda, dt) => v + wrapPi(target - v) * dampK(lambda, dt);
// скорость сглаживания позы: в окне удара (от половины замаха до попадания + 0,1) — быстрая, чтобы удар остался резким
export const poseLambda = (atk, t, hit, B) => (atk && t >= hit * .5 && t <= hit + .1 ? B.hit : B.pose);
// слой сглаживания: каждый канал [объект, свойство, ось] подводится от прошлого значения к только что поставленной цели.
// store — где хранить прошлое (у модели); skip — каналы, которые ставятся напрямую (перекат): их прошлое = цель
export function smoothPose(store, channels, lambda, dt, skip = null) {
  const k = dampK(lambda, dt), S = store.sm || (store.sm = new Map());
  for (const ch of channels) {
    const [o, prop, ax] = ch, key = ch, cur = o[prop][ax], prev = S.get(key);
    if (prev === undefined || (skip && skip.has(ch))) { S.set(key, cur); continue; }
    const v = prev + (cur - prev) * k; o[prop][ax] = v; S.set(key, v);
  }
}
