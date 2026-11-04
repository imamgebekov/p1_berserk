// Эффекты умений (2026-11-03, просьба владельца: «красивые эффекты, и разные у множества скиллов»). Форма — по виду умения (удар — дуга, конус — волны веером,
// волна — расходящееся кольцо, стрела — вспышка и шлейф, зона — вихрь, усиление — спираль, лечение — всплывающие искры, притяжение — сходящееся кольцо…),
// цвет и повадка частиц — по стихии (огонь поднимается, лёд сыплется, молния рвётся, яд пузырится, земля — комья, свет парит, тьма дымит, кровь брызжет),
// у каждого умения свой разброс (поворот, число, вторая краска — от id). Свои умения без вида и стихии — по таблице OWN. Только графика; всё идёт через fx3d.
const PAL = { steel: ['#cfe0ff', '#7f9cc8'], earth: ['#d8b078', '#7a5a3a'], light: ['#ffe890', '#ffb830'], blood: ['#ff6a78', '#8a1a2a'], fire: ['#ffb040', '#ff4a10'], shadow: ['#c090ff', '#3a2058'],
  ice: ['#a8ecff', '#3fb0e8'], water: ['#80c8ff', '#2f78d0'], storm: ['#ffe860', '#4a98ff'], venom: ['#a8f070', '#3a9a20'], none: ['#ffd890', '#ff9830'] };     // краски насыщенные: светящиеся частицы складываются со светлой землёй и иначе уходят в белое
// повадка частиц стихии: add — светятся, g — тяжесть (минус — всплывают), life, s — размер, up — подъём, jit — дрожь
// номера ячеек атласа vfx_atlas.webp (Kenney Particle Pack, fx3d.js): 0 точка, 4 язык пламени, 6 руна-кольцо, 8–9 дым, 11 молния, 12 и 13 звёзды, 14 серп, 15 штрих, 16 вихрь, 17 свечение, 18 сердце, 21 брызги, 22 разряд, 23 руна, 24 лоскут пламени
const SPR = { fire: [4, 24, 0, 4], ice: [12, 13, 0, 15], storm: [11, 22, 0], venom: [8, 0], earth: [21, 0], light: [13, 12, 17, 0], shadow: [8, 9, 0], blood: [21, 0], steel: [12, 0, 15], water: [0, 17], none: [0, 12] };
const FLAVOR = { fire: { add: 1, g: -3, life: .75, s: .16, up: 1.5 }, ice: { add: 1, g: 5, life: .8, s: .12, up: 1 }, storm: { add: 1, g: 0, life: .22, s: .1, up: 0, jit: 2 }, venom: { add: 0, g: -1.5, life: .9, s: .15, up: 1.2 },
  earth: { add: 0, g: 16, life: .6, s: .2, up: 3 }, light: { add: 1, g: -1, life: 1, s: .12, up: 1.2 }, shadow: { add: 0, g: -1, life: .9, s: .2, up: .8 }, blood: { add: 0, g: 14, life: .55, s: .12, up: 2 },
  steel: { add: 1, g: 8, life: .35, s: .09, up: 1.5 }, water: { add: 0, g: 9, life: .6, s: .12, up: 2 }, none: { add: 1, g: 4, life: .5, s: .12, up: 1.5 } };
// свои умения без вида: [форма, стихия]
const OWN = { charge: ['dash', 'steel'], cry: ['nova', 'light'], whirl: ['nova', 'steel'], iron: ['ward', 'steel'], rage: ['buff', 'blood'], bash: ['zone', 'light'], quake: ['nova', 'earth'], blood: ['cone', 'blood'],
  fireball: ['bolt', 'fire'], nova: ['nova', 'fire'], chain: ['bolt', 'storm'], cloud: ['cloud', 'venom'], meteor: ['zone', 'fire'], shield: ['ward', 'water'], blizzard: ['field', 'ice'], spear: ['bolt', 'shadow'],
  chaos: ['cone', 'fire'], djump: ['jump', 'shadow'], felrush: ['dash', 'fire'], glaive: ['bolt', 'steel'], blades: ['cone', 'steel'], eyebeam: ['bolt', 'fire'], sigil: ['zone', 'shadow'], meta: ['buff', 'shadow'],
  cleaver: ['strike', 'steel'], cannon: ['bolt', 'fire'], volley: ['bolt', 'steel'], fury: ['buff', 'blood'], endure: ['ward', 'earth'], rush: ['dash', 'blood'], darkcut: ['cone', 'shadow'], howl: ['nova', 'blood'],
  smite: ['bolt', 'light'], mend: ['heal', 'light'], sanctum: ['ward', 'light'], hymn: ['gheal', 'light'], radiance: ['nova', 'light'], hallow: ['zone', 'light'], vtouch: ['mark', 'shadow'], penance: ['strike', 'light'],
  hex: ['mark', 'shadow'], drain: ['pull', 'blood'], summon: ['zone', 'shadow'], terror: ['nova', 'shadow'], grasp: ['pull', 'shadow'], pact: ['buff', 'blood'], souls: ['pull', 'shadow'], doom: ['bolt', 'shadow'],
  leap: ['jump', 'earth'], trap: ['zone', 'steel'], venom: ['cloud', 'venom'], rain: ['field', 'steel'], frost: ['bolt', 'ice'], firearrow: ['bolt', 'fire'], hawk: ['buff', 'light'],
  blink: ['blink', 'shadow'], parry: ['ward', 'steel'], dance: ['cone', 'steel'], shadow: ['buff', 'shadow'], execute: ['strike', 'blood'], fan: ['cone', 'steel'], smoke: ['cloud', 'shadow'], bloodlet: ['cone', 'blood'] };
const dim = (c, k) => '#' + [1, 3, 5].map(i => Math.round(parseInt(c.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');     // светящиеся частицы складываются — темним краску, чтобы не уходила в белое
// дым и взрывы по стихии: [первая ячейка атласа vfx_puff, сколько вариантов, краска-оттенок]; 0–6 белый дым, 7–11 чёрный, 12–16 взрыв, 17–21 вспышка, 22–24 зелёный
const PUFF = { fire: [12, 5, '#ffffff'], earth: [0, 7, '#a88a68'], ice: [0, 7, '#b8e4ff'], water: [0, 7, '#9fd0ff'], storm: [17, 5, '#dfe8ff'], light: [17, 5, '#fff0b0'], venom: [22, 3, '#ffffff'], shadow: [7, 5, '#8a60c8'], blood: [7, 5, '#e05060'], steel: [0, 7, '#dfe8ff'], none: [0, 7, '#ffffff'] };
const hash = s => { let h = 7; for (let i = 0; i < s.length; i++) h = Math.imul(h, 31) + s.charCodeAt(i) | 0; return h >>> 0; };
const rnd = (h, k) => ((Math.imul(h ^ (k * 2654435761), 0x45d9f3b) >>> 0) % 1000) / 1000;     // одно и то же число для пары (умение, k)

// fx — createFx; hooks.scale — множитель числа частиц (качество); возвращает { play(v), update(dt), pending() }
export function createAbilityFx(fx, hooks = {}) {
  const jobs = []; const S = () => Math.max(.3, hooks.scale ? hooks.scale() : 1);
  const at = (t, fn) => { if (t <= 0) fn(); else jobs.push({ t, fn }); };
  function recipe(v) {
    const own = OWN[v.id], kind = v.kind && v.kind !== 'own' ? v.kind : own ? own[0] : 'strike', el = v.el || (own && own[1]) || 'none', h = hash(v.id || ''), P = PAL[el] || PAL.none, F = FLAVOR[el] || FLAVOR.none;
    const alt = rnd(h, 1) > .5, c1 = alt ? P[1] : P[0], c2 = alt ? P[0] : P[1], n = k => Math.max(1, Math.round(k * 2.3 * S() * (.85 + rnd(h, 2) * .3))), ph = rnd(h, 3) * 6.283, f = v.face || 0, sx = Math.sin(f), cz = Math.cos(f);
    const X = v.x, Z = v.z, ahead = d => [X + sx * d, Z + cz * d];
    const p = (x, y, z, vx, vy, vz, c, k = 1) => { const j = F.jit ? 1 + (Math.random() - .5) * F.jit : 1, vy2 = vy + F.up * Math.random(), L = F.life * 1.25 * (.7 + Math.random() * .6) * k, sz = F.s * 1.1 * (.8 + Math.random() * .5);
      const sl = SPR[el] || SPR.none; fx.emit(x, y, z, vx * j, vy2, vz, F.add ? dim(c, .85) : c, L, F.g, sz, !!F.add, F.add ? sl[Math.floor(Math.random() * sl.length)] : 0);
      if (!F.add && Math.random() < .5) fx.emit(x, y, z, vx * j, vy2, vz, dim(c, .6), L * .8, 0, sz * 1.3, true, 0); };
    const puff = (x, y, z, size, life = .7, up = .6, gr = 1.4, vx = 0, vz = 0) => { if (!fx.emitPuff) return; const q = PUFF[el] || PUFF.none; fx.emitPuff(x, y, z, vx, up, vz, q[2], life * (.8 + Math.random() * .4), -.2, size, q[0] + Math.floor(Math.random() * q[1]), gr); };     // облако дыма или взрыва; нет слоя дыма (тесты) — пропуск
    const big = (x, y, z, size, c, spr, life = .5, up = 0) => fx.emit(x, y, z, 0, up, 0, dim(c, .8), life, 0, size / 2.2, true, spr);     // один крупный спрайт: кольцо, руна, сердце, серп     // тёмные и тяжёлые частицы (тьма, земля, кровь, яд) — с мягким ореолом: иначе тонут
    const ring = (cx, cz0, r, cnt, c, out = 3, y = .35) => { for (let i = 0; i < cnt; i++) { const a = i / cnt * 6.283 + ph; p(cx + Math.sin(a) * r, y, cz0 + Math.cos(a) * r, Math.sin(a) * out, .4, Math.cos(a) * out, i % 3 ? c : c === c1 ? c2 : c1); } };
    switch (kind) {
      case 'strike': {     // дуга клинка перед героем и удар в точке
        { const [bx, bz] = ahead(1.6); fx.emit(bx, 1.2, bz, sx * 7, 0, cz * 7, dim(c1, .8), .22, 0, 1.3, true, 14); }
        for (let s = 0; s < 3; s++) at(s * .045, () => { for (let i = 0; i < n(6); i++) { const a = f + (-.95 + (s * 6 + i) / 18 * 1.9) * (rnd(h, 4) > .5 ? 1 : -1), r = 1.5 + s * .3; p(X + Math.sin(a) * r, 1.1 + s * .15, Z + Math.cos(a) * r, Math.sin(a) * 2, .5, Math.cos(a) * 2, c1); } });
        at(.1, () => { const [x, z] = ahead(2.3); puff(x, .8, z, 1.8, .6, .5, 1.5); fx.flash(x, 1.1, z, 3, c1); for (let i = 0; i < n(10); i++) { const a = f + (Math.random() - .5) * 2; p(x, .9, z, Math.sin(a) * 4, 1, Math.cos(a) * 4, c2); } }); break; }
      case 'cone': for (let w = 0; w < 3; w++) at(w * .07, () => { const [x, z] = ahead(1.4 + w * 1.5); puff(x, .8, z, 1.3 + w * .5, .6, .5, 1.5, sx * 2, cz * 2); for (let i = 0; i < n(7 + w * 2); i++) { const a = f + (Math.random() - .5) * (.7 + w * .25); p(x, .8, z, Math.sin(a) * (4 + w), .6, Math.cos(a) * (4 + w), i % 2 ? c1 : c2); } if (!w) fx.flash(x, 1, z, 2.6, c1); }); break;
      case 'nova': { fx.flash(X, 1, Z, 4.2, c1); puff(X, .9, Z, 2.6, .8, .4, 2.2); for (let k = 0; k < 6; k++) at(.08, () => { const a = k / 6 * 6.283 + ph; puff(X + Math.sin(a) * 2.4, .6, Z + Math.cos(a) * 2.4, 1.5, .8, .5, 1.6, Math.sin(a) * 2.5, Math.cos(a) * 2.5); }); for (let r = 0; r < 4; r++) at(r * .07, () => { ring(X, Z, 1 + r * 1.2, n(14 + r * 4), r % 2 ? c2 : c1, 3.5 + r * .5); big(X, .5, Z, 2 * (1.2 + r * 1.3), r % 2 ? c2 : c1, r % 2 ? 17 : 6, .45); }); break; }
      case 'zone': case 'field': { const [x, z] = ahead(kind === 'zone' ? 3.5 : 4.5); fx.flash(x, .8, z, 3.2, c1); big(x, .4, z, kind === 'zone' ? 4.5 : 6, c2, 23, 1.1); for (let k = 0; k < 4; k++) at(k * .1, () => puff(x + (Math.random() - .5) * 3, .5, z + (Math.random() - .5) * 3, 1.8, 1, .6, 1.5)); big(x, .45, z, kind === 'zone' ? 3 : 4, c1, 16, 1); for (let t = 0; t < 6; t++) at(t * .07, () => { for (let i = 0; i < n(6); i++) { const a = ph + t * 1.1 + i / 6 * 6.283, r = 1.5 - t * .12; p(x + Math.sin(a) * r, .3 + t * .12, z + Math.cos(a) * r, -Math.cos(a) * 2.2, 1.2, Math.sin(a) * 2.2, i % 2 ? c1 : c2); } }); at(.1, () => ring(x, z, 2.2, n(16), c2, 1.5)); break; }
      case 'cloud': { const [x, z] = ahead(3.5); for (let k = 0; k < 6; k++) at(k * .09, () => puff(x + (Math.random() - .5) * 3, .5, z + (Math.random() - .5) * 3, 2.2, 1.6, .4, 1.8)); for (let t = 0; t < 5; t++) at(t * .08, () => { for (let i = 0; i < n(7); i++) { const a = Math.random() * 6.283, r = Math.random() * 1.8; p(x + Math.sin(a) * r, .6 + Math.random() * .6, z + Math.cos(a) * r, Math.sin(a) * .8, .3, Math.cos(a) * .8, i % 2 ? c1 : c2, 1.6); } }); break; }
      case 'bolt': case 'strike2': { const [mx, mz] = ahead(1.2); fx.flash(mx, 1.25, mz, 2.6, c1); for (let d = 0; d < 7; d++) at(d * .03, () => { const [x, z] = ahead(1.5 + d * 1.1); for (let i = 0; i < n(3); i++) p(x + (Math.random() - .5) * .3, 1.2 + (Math.random() - .5) * .3, z + (Math.random() - .5) * .3, sx * 1.5, .2, cz * 1.5, i % 2 ? c1 : c2, .8); }); break; }
      case 'buff': case 'ward': { big(X, .5, Z, 3.4, c2, kind === 'ward' ? 6 : 17, .8, .5); for (let t = 0; t < 7; t++) at(t * .06, () => { for (let s = 0; s < 2; s++) { const a = ph + t * .9 + s * 3.14; p(X + Math.sin(a) * 1.1, .2 + t * .3, Z + Math.cos(a) * 1.1, 0, .6, 0, s ? c2 : c1); } }); fx.flash(X, 1, Z, 3.2, c1);
        if (kind === 'ward') for (let t = 0; t < 3; t++) at(t * .09, () => ring(X, Z, 1.3, n(12), c1, .2, .3 + t * .5)); else ring(X, Z, 1, n(10), c2, 2); break; }
      case 'heal': case 'gheal': { for (let i = 0; i < 3; i++) at(i * .12, () => big(X + (Math.random() - .5) * 1.2, .8, Z + (Math.random() - .5) * 1.2, .9, c1, 18, 1.1, 1.4)); for (let i = 0; i < n(18); i++) at(i * .022, () => { const a = Math.random() * 6.283, r = Math.random() * 1.1; p(X + Math.sin(a) * r, .2, Z + Math.cos(a) * r, 0, 1.8, 0, i % 3 ? c1 : c2, 1.3); }); fx.flash(X, 1.2, Z, 3, c1); if (kind === 'gheal') ring(X, Z, 2.6, n(18), c2, .6); break; }
      case 'mark': { const [x, z] = ahead(3); fx.flash(x, 1.8, z, 2.6, c1); big(x, 1.8, z, 2.2, c1, 23, .8); for (let i = 0; i < n(12); i++) { const a = i / 12 * 6.283 + ph; at(i * .015, () => p(x + Math.sin(a) * 1.4, 1.8 + Math.sin(a * 2) * .4, z + Math.cos(a) * 1.4, -Math.sin(a) * 3, -.5, -Math.cos(a) * 3, i % 2 ? c1 : c2, .7)); } break; }
      case 'pull': { fx.flash(X, 1, Z, 2.6, c2); puff(X, .8, Z, 1.8, .6, .3, -.4); for (let t = 0; t < 3; t++) at(t * .08, () => { const r = 4.2 - t * 1.2; for (let i = 0; i < n(12); i++) { const a = i / 12 * 6.283 + ph + t; p(X + Math.sin(a) * r, .6, Z + Math.cos(a) * r, -Math.sin(a) * 5, .3, -Math.cos(a) * 5, i % 2 ? c1 : c2, .7); } }); break; }
      case 'dash': case 'jump': { puff(X, .3, Z, 1.3, .6, .3, 1.5, -sx * 2, -cz * 2); for (let i = 0; i < n(12); i++) p(X + (Math.random() - .5) * .8, .2, Z + (Math.random() - .5) * .8, -sx * 3 + (Math.random() - .5) * 2, .6, -cz * 3 + (Math.random() - .5) * 2, i % 2 ? c1 : c2); fx.flash(X, .6, Z, 1.2, c1); if (kind === 'jump') ring(X, Z, .8, n(10), c2, 2.5, .2); break; }
      case 'blink': { fx.flash(X, 1.2, Z, 3.2, c1); for (let i = 0; i < n(16); i++) p(X + (Math.random() - .5), .2 + Math.random() * 1.6, Z + (Math.random() - .5), 0, .8, 0, i % 2 ? c1 : c2, 1.2); break; }
      default: fx.flash(X, 1.2, Z, 3, c1);
    }
    return kind;
  }
  return { play: v => recipe(v), update(dt) { for (let i = jobs.length - 1; i >= 0; i--) { const j = jobs[i]; if ((j.t -= dt) <= 0) { jobs.splice(i, 1); j.fn(); } } }, pending: () => jobs.length };
}
export const ABILITY_FX_OWN = OWN;
