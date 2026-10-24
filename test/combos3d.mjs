// Тест связок умений (2026-10-18; школы 2026-10-22): 24 связки (по одной на школу) — умение a, потом b не позже окна: событие «связка» и своё усиление
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
  const cfg = JSON.parse(JSON.stringify(CFG3)); cfg.enemies.count = 0; cfg.map.places = []; cfg.map.outposts = []; cfg.map.citadel = null; cfg.weather.force = 'clear'; cfg.enemies.roam.on = false;
  const W = createWorld(cfg, () => .5); W.hero = hero; W.lv = 30; W.player.x = 300; W.player.z = 0; W.player.face = 0; W.player.inv = 1e9;
  W.inv.eq.weapon = WEAPON[hero]; for (const a of ABILITIES[hero]) W.ab[a.id] = 3; refreshGear(W); step(W, 1 / 60, {}); W.resHero = hero; W.res = 1e4; return W;
}
const foe = (W, dx, dz, hp = 1e5) => { const p = W.player, e = spawnEnemy(W, 'brute', p.x + dx, p.z + dz); e.hp = e.maxhp = hp; e.cd = 1e9; e.alert = false; e.imm = null; e.elite = false; return e; };
const cast = (W, id) => { W.res = 1e4; return useAbility(W, ABILITIES[W.hero].findIndex(a => a.id === id)); };
const run = (W, s) => { for (let i = 0; i < Math.round(s * 60); i++) step(W, 1 / 60, {}); };
const hurt = e => e.maxhp - e.hp;

// поле и мера для каждой связки: setup(W) → ctx; measure(W, ctx) → число или флаг; better(с, без) — связка сделала своё
const h0 = (W, c) => { c.h0 = c.e.hp; }, dealt = (W, c) => c.h0 - c.e.hp;     // урон только второго умения (первое могло задеть цель)
const last = k => W => { const L = W[k] || []; return L.length ? L[L.length - 1] : {}; };
const CASE = {     // школы (2026-10-22): по связке на школу, обе части — в одной школе
  dread: { setup: W => ({ near: foe(W, 0, 2), e: foe(W, Math.sin(.87) * 2.2, Math.cos(.87) * 2.2) }), m: (W, c) => hurt(c.e), better: (a, b) => a > 0 && b === 0, now: true },     // Торн-Страж: конус шире — задет сосед под 50°
  runup: { setup: W => ({ e: foe(W, 0, 4) }), pre: h0, m: dealt, better: (a, b) => a > b * 1.3, now: true },     // Торн-Палач
  rift: { setup: W => { const e = foe(W, 2, 0); return { e }; }, pre: (W, c) => applyStatus(W, c.e, 'root', 0, 9), m: (W, c) => hurt(c.e), better: (a, b) => a > b * 1.5 },
  aimcold: { setup: W => ({ e: foe(W, 0, 8) }), m: W => (W.proj.find(q => q.friendly && q.freeze) || { pierce: 0 }).pierce, better: (a, b) => a > 10 && b < 5, now: true },
  snaretrap: { setup: () => ({}), m: W => last('traps')(W).root || 0, better: (a, b) => a > b * 1.4, now: true },     // Сойка-Выживание
  poisonhail: { setup: () => ({}), m: W => last('zones')(W).mul || 0, better: (a, b) => a > b * 1.25, now: true },     // Сойка-Буря стрел
  riposte: { setup: W => { const e = foe(W, 0, 1.8, 1000); e.hp = 350; return { e }; }, pre: (W, c) => { c.e.hp = 350; c.e.st = {}; }, m: (W, c) => (c.e.dead ? 1 : 0), better: (a, b) => a === 1 && b === 0, now: true },
  shadowstrike: { setup: W => ({ e: foe(W, 0, 5) }), m: (W, c) => (W.ev.some(v => v.k === 'hit' && v.crit && v.id === c.e.id) ? 1 : 0), better: (a, b) => a === 1 && b === 0, now: true, rng: .99 },
  crimsonfan: { setup: W => ({ e: foe(W, CFG3.abilities.vale.bloodlet.r * 1.2 + .8, 0) }), m: (W, c) => hurt(c.e), better: (a, b) => a > 0 && b === 0, now: true },     // Вейл-Кровь: шире
  glaivecut: { setup: W => ({ e: foe(W, 0, 12.5) }), pre: h0, m: dealt, better: (a, b) => a > 0 && a > b * 1.3, now: true },     // Бесогон-Хаос: рывок вперёд к цели за пределом рывка
  firefall: { setup: () => ({}), m: W => last('zones')(W).r || 0, better: (a, b) => a > b * 1.3, now: true },     // Бесогон-Месть
  demonsight: { setup: () => ({}), m: W => (W.abuf.beam ? W.abuf.beam.t : 0), better: (a, b) => a > b * 1.4, now: true },
  brandrage: { setup: W => ({ e: foe(W, 0, 2.5) }), m: (W, c) => hurt(c.e), better: (a, b) => a > b * 1.3, now: true },
  ironram: { setup: W => ({ e: foe(W, 0, 5) }), pre: h0, m: dealt, better: (a, b) => a > b * 1.3, time: .6 },     // Клеймёный-Сталь
  darkpain: { setup: W => ({ e: foe(W, 0, 2.5) }), pre: h0, m: dealt, better: (a, b) => a > b * 1.3, now: true },     // Клеймёный-Тьма
  sermon: { setup: () => ({}), pre: W => { W.player.hp = W.player.maxhp * .3; }, m: W => W.player.hp, better: (a, b) => a > b + 1, now: true },
  judgement: { setup: W => ({ e: foe(W, 0, 2.5) }), pre: h0, m: dealt, better: (a, b) => a > b * 1.2, now: true },     // Жрец-Щиты
  purge: { setup: W => ({ e: foe(W, 0, 6) }), m: (W, c) => hurt(c.e), better: (a, b) => a > b * 1.3, time: .8 },
  verdict: { setup: W => ({ e: foe(W, 0, 6) }), m: (W, c) => hurt(c.e), better: (a, b) => a > b * 1.5, time: 4.4 },
  bloodfeast: { setup: W => ({ e: foe(W, 0, 4) }), pre: W => { W.player.hp = W.player.maxhp * .3; }, m: W => W.player.hp, better: (a, b) => a > b + 1, now: true },     // Морок-Кровь
  bloodimp: { setup: () => ({}), m: W => (W.allies.find(a => a.imp) || { t: 0 }).t, better: (a, b) => a > b * 1.4, now: true },
  firerain: { setup: () => ({}), m: W => last('meteors')(W).r || 0, better: (a, b) => a > b * 1.3, now: true },     // Ирга-Огонь
  icearmor: { setup: W => ({ e: foe(W, 5, 0) }), m: (W, c) => (W.buffs.some(b => b.src === 'icearmor') ? 1 : 0) + (hurt(c.e) > 0 ? 1 : 0), better: (a, b) => a === 2 && b === 0, now: true },
  breach: { setup: W => ({ e: foe(W, 0, 8) }), pre: (W, c) => applyStatus(W, c.e, 'shock', 10, 9), m: (W, c) => hurt(c.e), better: (a, b) => a > b * 1.4, now: true }
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
ok(n === 24, 'связок не 24: ' + n);

// окно закрывается; подсветка; числа умения не портятся
{ const W = mk('thorn'); foe(W, 2, 0); cast(W, 'charge'); ok(comboReady(W).some(q => q.id === 'bash'), 'после рывка нет подсветки сокрушающего удара');
  run(W, X.window + .2); ok(!comboReady(W).length, 'подсветка не гаснет после окна'); W.ev.length = 0; W.acd = {}; cast(W, 'bash'); ok(!W.ev.some(v => v.k === 'combo'), 'связка после окна'); }
{ const A = CFG3.abilities.thorn.whirl, B = boosted(A, { mul: { r: 1.4, mul: 1.3 } }); ok(B.r > A.r && B.mul[2] > A.mul[2] && CFG3.abilities.thorn.whirl.r === A.r, 'усиление портит числа умения'); }
// школы (2026-10-22): обе части каждой связки — в одной школе героя
{ const { schoolOfAbility } = await import('../3d/src/school3d.js');
  for (const [h, L] of Object.entries(COMBOS)) { ok(L.length === 3, `${h}: связок не 3`); L.forEach((c, i) => ok(schoolOfAbility(h, c.a, CFG3) === i && schoolOfAbility(h, c.b, CFG3) === i, `${h}/${c.name}: части не в школе ${i}`)); } }

if (fails.length) { console.error('Связки умений 3D: ПРОВАЛ\n- ' + fails.join('\n- ')); process.exit(1); }
console.log('Связки умений 3D: OK (24, по одной на школу)');
