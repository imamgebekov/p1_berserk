// Тест связок умений (2026-10-18): 16 связок (по 4 у героя) — умение a, потом b не позже окна: событие «связка» и своё усиление
// (сравнение с тем же b без связки на одинаковом поле); окно закрывается; b без a — без связки; цифры умений не портятся.
import { CFG3 } from '../3d/src/config3d.js';
import { ABILITIES } from '../3d/src/data/abilities3d.js';
import { createWorld, step, spawnEnemy, refreshGear } from '../3d/src/sim.js';
import { useAbility } from '../3d/src/abilities3d.js';
import { COMBOS, comboReady, boosted } from '../3d/src/combos3d.js';
import { applyStatus } from '../3d/src/status3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const WEAPON = { thorn: 'w_sword_iron', jay: 'w_bow_iron', vale: 'w_rapier_iron', irga: 'w_staff_iron', warlock: 'w_scythe_iron', priest: 'w_mace_iron', brand: 'w_greatsword_iron', hunter: 'w_sword_iron' }, X = CFG3.combos;
function mk(hero) {
  const cfg = JSON.parse(JSON.stringify(CFG3)); cfg.enemies.count = 0; cfg.map.places = []; cfg.weather.force = 'clear'; cfg.enemies.roam.on = false;
  const W = createWorld(cfg, () => .5); W.hero = hero; W.lv = 30; W.player.x = 300; W.player.z = 0; W.player.face = 0; W.player.inv = 1e9;
  W.inv.eq.weapon = WEAPON[hero]; for (const a of ABILITIES[hero]) W.ab[a.id] = 3; refreshGear(W); step(W, 1 / 60, {}); W.resHero = hero; W.res = 1e4; return W;
}
const foe = (W, dx, dz, hp = 1e5) => { const p = W.player, e = spawnEnemy(W, 'brute', p.x + dx, p.z + dz); e.hp = e.maxhp = hp; e.cd = 1e9; e.alert = false; e.imm = null; e.elite = false; return e; };
const cast = (W, id) => { W.res = 1e4; return useAbility(W, ABILITIES[W.hero].findIndex(a => a.id === id)); };
const run = (W, s) => { for (let i = 0; i < Math.round(s * 60); i++) step(W, 1 / 60, {}); };
const hurt = e => e.maxhp - e.hp;

// поле и мера для каждой связки: setup(W) → ctx; measure(W, ctx) → число или флаг; better(с, без) — связка сделала своё
const CASE = {
  bladestorm: { setup: W => ({ e: foe(W, 4.3, 0) }), m: (W, c) => hurt(c.e), better: (a, b) => a > 0 && b === 0 },
  dread: { setup: W => { const e = foe(W, 0, 2); return { e }; }, pre: (W, c) => {}, m: (W, c) => (c.e.st && c.e.st.stun ? c.e.st.stun.t : 0), better: (a, b) => a >= b * 1.9 },
  rift: { setup: W => { const e = foe(W, 2, 0); return { e }; }, pre: (W, c) => applyStatus(W, c.e, 'root', 0, 9), m: (W, c) => hurt(c.e), better: (a, b) => a > b * 1.5 },
  frenzy: { setup: () => ({}), m: W => W.abuf.rage, better: (a, b) => a > b * 1.4 },
  archerdance: { setup: W => ({ e: foe(W, 0, 8) }), m: W => W.proj.filter(q => q.friendly).length, better: (a, b) => a >= b + 3, now: true },     // со связкой — ещё и стрела отскока в полёте
  snare: { setup: W => ({ near: foe(W, 0, 4), held: foe(W, 6, 9) }), pre: (W, c) => applyStatus(W, c.held, 'root', 0, 9), m: (W, c) => { const z = W.zones[W.zones.length - 1]; return z ? Math.hypot(z.x - c.held.x, z.z - c.held.z) < .5 ? 1 : 0 : 0; }, better: (a, b) => a === 1 && b === 0, now: true },
  aimcold: { setup: W => ({ e: foe(W, 0, 8) }), m: W => (W.proj.find(q => q.friendly && q.freeze) || { pierce: 0 }).pierce, better: (a, b) => a > 10 && b < 5, now: true },
  icehail: { setup: W => ({ e: foe(W, 0, 6) }), m: W => (W.zones[W.zones.length - 1] || {}).slow || 0, better: (a, b) => a > 0 && !b, now: true },
  shadowstrike: { setup: W => ({ e: foe(W, 0, 5) }), m: (W, c) => (W.ev.some(v => v.k === 'hit' && v.crit && v.id === c.e.id) ? 1 : 0), better: (a, b) => a === 1 && b === 0, now: true, rng: .99 },
  bloodfan: { setup: W => ({ e: foe(W, 2, 0) }), pre: (W, c) => applyStatus(W, c.e, 'bleed', 1, 9), m: (W, c) => hurt(c.e), better: (a, b) => a > b * 1.4, now: true },
  riposte: { setup: W => { const e = foe(W, 0, 1.8, 1000); e.hp = 350; return { e }; }, m: (W, c) => (c.e.dead ? 1 : 0), better: (a, b) => a === 1 && b === 0, now: true },
  twindance: { setup: W => ({ e: foe(W, 2, 0), far: foe(W, -2, 0) }), m: (W, c) => hurt(c.far), better: (a, b) => a > b, time: 1.5 },
  detonate: { setup: W => ({ e: foe(W, 0, 7), o: foe(W, 3.9, 7) }), m: (W, c) => (W.ezones.some(z => z.kind === 'cloud') ? 0 : hurt(c.o)), better: (a, b) => a > 0 && b === 0, time: .45 },     // сосед вне взрыва шара, но в облаке
  frozenstorm: { setup: W => ({ es: [foe(W, 0, 5), foe(W, 2, 8), foe(W, 4, 11), foe(W, 6, 14), foe(W, 8, 17), foe(W, 10, 20), foe(W, 12, 23)] }), m: (W, c) => c.es.filter(e => hurt(e) > 0 && e.st && e.st.slow).length, better: (a, b) => a >= 6 && b < 6, now: true },
  icearmor: { setup: W => ({ e: foe(W, 5, 0) }), m: (W, c) => (W.buffs.some(b => b.src === 'icearmor') ? 1 : 0) + (hurt(c.e) > 0 ? 1 : 0), better: (a, b) => a === 2 && b === 0, now: true },
  breach: { setup: W => ({ e: foe(W, 0, 8) }), pre: (W, c) => applyStatus(W, c.e, 'shock', 10, 9), m: (W, c) => hurt(c.e), better: (a, b) => a > b * 1.4, now: true },
  verdict: { setup: W => ({ e: foe(W, 0, 6) }), m: (W, c) => hurt(c.e), better: (a, b) => a > b * 1.5, time: 4.4 },     // Морок: рок по проклятому
  feast: { setup: W => ({ e: foe(W, 0, 3) }), pre: W => { W.player.hp = W.player.maxhp * .4; }, m: W => W.player.hp, better: (a, b) => a > b, now: true },
  gravecall: { setup: W => ({ e: foe(W, 0, 8) }), m: W => W.proj.filter(q => q.friendly).length, better: (a, b) => a >= b + 3, now: true },
  bloodimp: { setup: () => ({}), m: W => (W.allies.find(a => a.imp) || { t: 0 }).t, better: (a, b) => a > b * 1.4, now: true },
  blessedwave: { setup: W => ({ e: foe(W, 0, 5.1) }), m: (W, c) => hurt(c.e), better: (a, b) => a > 0 && b === 0, now: true },     // Жрец (4.16): сияние шире
  purge: { setup: W => ({ e: foe(W, 0, 6) }), m: (W, c) => hurt(c.e), better: (a, b) => a > b * 1.3, time: .8 },
  sermon: { setup: () => ({}), pre: W => { W.player.hp = W.player.maxhp * .3; }, m: W => W.player.hp, better: (a, b) => a > b + 1, now: true },
  judgement: { setup: W => ({ e: foe(W, 0, 2.5) }), m: (W, c) => hurt(c.e), better: (a, b) => a > b * 1.3, time: 2.5 },
  brandrage: { setup: W => ({ e: foe(W, 0, 2.5) }), m: (W, c) => hurt(c.e), better: (a, b) => a > b * 1.3, now: true },     // Клеймёный (4.17)
  powder: { setup: W => ({ e: foe(W, 0, 7) }), m: (W, c) => hurt(c.e), better: (a, b) => a > b * 1.2, time: .9 },
  ironhowl: { setup: W => ({ e: foe(W, 5.6, 0) }), m: (W, c) => hurt(c.e), better: (a, b) => a > 0 && b === 0, now: true },
  darkpain: { setup: W => ({ e: foe(W, 0, 2.5) }), pre: W => { W.player.hp = W.player.maxhp * .3; }, m: W => W.player.hp, better: (a, b) => a > b + 1, now: true },
  glaivecut: { setup: W => ({ e: foe(W, 2.5, 0) }), m: (W, c) => hurt(c.e), better: (a, b) => a > b * 1.3, now: true },     // Бесогон (Г8): враг сбоку — клинок летит мимо, удар хаоса достаёт
  burnmark: { setup: W => ({ e: foe(W, 0, 14) }), m: (W, c) => hurt(c.e), better: (a, b) => a > b * 1.3, time: 1.2 },     // печать — впереди, враг дальше неё
  demonfall: { setup: () => ({}), m: W => W.abuf.morph || 0, better: (a, b) => a > b * 1.3, now: true },
  demonsight: { setup: () => ({}), m: W => (W.abuf.beam ? W.abuf.beam.t : 0), better: (a, b) => a > b * 1.4, now: true }
};
// прогон: с первым умением (связка) или без; первое бьёт в пустоту далеко, чтобы не трогать цели
function trial(hero, combo, withA) {
  const W = mk(hero), C = CASE[combo.id], ctx = C.setup(W);
  if (withA) { const far = foe(W, -40, -40); if (combo.a === 'trap' || combo.a === 'cloud') { /* ставятся у себя или у цели */ } const r = cast(W, combo.a); if (r !== 'ok') return { err: `${combo.a}: ${r}` }; void far; for (let i = 0; i < 60 && W.player.state === 'dash'; i++) step(W, 1 / 60, {}); }     // после рывка — как игрок, когда герой приземлился
  if (combo.a === 'cloud' && withA) { const z = W.ezones.find(q => q.kind === 'cloud'); if (z) { z.x = ctx.e.x; z.z = ctx.e.z; } }     // облако — под целью шара
  if (combo.a === 'shadow' && withA) { const d = W.allies.find(q => q.decoy); if (d) { d.x = W.player.x - 2.8; d.z = W.player.z; } }    // тень — у второго врага
  if (C.pre) C.pre(W, ctx); W.ev.length = 0; if (C.rng) W.rng = () => C.rng;
  const r = cast(W, combo.b); const ev = W.ev.slice();
  if (!C.now) run(W, C.time || .6);
  return { r, combo: ev.some(v => v.k === 'combo' && v.id === combo.id), v: C.m(W, ctx) };
}
let n = 0;
for (const [hero, list] of Object.entries(COMBOS)) for (const c of list) {
  n++; const ids = ABILITIES[hero].map(a => a.id);
  ok(ids.includes(c.a) && ids.includes(c.b) && X[c.id] && CASE[c.id], `${c.id}: нет умения, чисел или проверки`);
  const a = trial(hero, c, true), b = trial(hero, c, false);
  if (a.err) { ok(false, `${c.name}: первое умение не пошло (${a.err})`); continue; }
  ok(a.r === 'ok' && a.combo, `${c.name}: второе умение не дало связку (${a.r})`);
  ok(!b.combo, `${c.name}: связка без первого умения`);
  ok(CASE[c.id].better(a.v, b.v), `${c.name}: нет усиления — со связкой ${a.v}, без ${b.v}`);
}
ok(n === 32, 'связок не 32: ' + n);

// окно закрывается; подсветка; числа умения не портятся
{ const W = mk('thorn'); foe(W, 2, 0); cast(W, 'charge'); ok(comboReady(W).some(q => q.id === 'whirl'), 'после рывка нет подсветки вихря');
  run(W, X.window + .2); ok(!comboReady(W).length, 'подсветка не гаснет после окна'); W.ev.length = 0; cast(W, 'whirl'); ok(!W.ev.some(v => v.k === 'combo'), 'связка после окна'); }
{ const A = CFG3.abilities.thorn.whirl, B = boosted(A, X.bladestorm); ok(B.r > A.r && B.mul[2] > A.mul[2] && CFG3.abilities.thorn.whirl.r === A.r, 'усиление портит числа умения'); }

if (fails.length) { console.error('Связки умений 3D: ПРОВАЛ\n- ' + fails.join('\n- ')); process.exit(1); }
console.log('Связки умений 3D: OK (20)');
