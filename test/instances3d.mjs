// Подземелья зон (этап 5): два подземелья Акта I (Брод — 3 босса, Ольховый лес — 4), вход в своей зоне, путь до каждого босса,
// библиотека механик (лужи, луч, чтение и его сбивание, щит подмоги), своя добыча босса, героическая сложность с 60 уровня,
// бот отряда (герой + спутники уровня подземелья) побеждает каждого босса, а в одиночку — заметно реже.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, killEnemy, refreshGear, spawnBoss, spawnEnemy } from '../3d/src/sim.js';
import { travel, setHeroic, levelAt } from '../3d/src/levels3d.js';
import { pathStep } from '../3d/src/map.js';
import { zoneAt, zoneLevel } from '../3d/src/zones3d.js';
import { spawnAlly, squadMax } from '../3d/src/squad3d.js';
import { BY_ID } from '../3d/src/data/items.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const I = CFG3.dungeons.list.filter(d => d.inst), BL = CFG3.bosses.list.filter(b => b.inst);
const mk = (seed = 1, f) => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.events.on = false; c.wanderer.on = false; if (f) f(c); return createWorld(c, mulberry32(seed)); };
const run = (W, sec, inp = {}, each) => { for (let i = 0; i < Math.round(sec * 60); i++) { step(W, 1 / 60, inp); if (each) each(i); } };
const enter = (W, id) => { const d = W.cfg.dungeons.list.find(q => q.id === id); travel(W, id, d.entry.x, d.entry.z); step(W, 1 / 60, {}); return d; };
const bossIn = (W, type) => W.enemies.find(e => e.boss && e.type === type);

// ---------- 1. данные ----------
const WANT = { inst_brod: 3, inst_olkh: 4, inst_moss: 3, inst_pass: 3, inst_forge: 3, inst_tower: 3, inst_barrow: 3, inst_nest: 3, inst_abbey: 3, inst_dusk: 3, raid_hand: 5 };     // и рейд (этап 8)     // Акт I — два, Акт II — три, Акт III и IV — по два (этап 7)
ok(I.length === Object.keys(WANT).length && Object.entries(WANT).every(([id, n]) => I.some(d => d.id === id) && BL.filter(b => b.inst === id).length === n), 'подземелья или число боссов не те');
for (const d of I.filter(q => q.id !== 'inst_brod')) { const T = CFG3.instances.list.find(q => q.id === d.id), z = zoneAt(CFG3, d.at.x, d.at.z), lv = zoneLevel(CFG3, d.at.x, d.at.z); ok(z && z.id === T.zone && Math.abs(lv - T.lv) <= 1.5, `${d.id}: вход не в зоне ${T.zone} ур. ${T.lv} (${z && z.id}, ${lv && lv.toFixed(1)})`); }
for (const b of BL) { ok(b.loot && b.loot.length >= 2 && b.loot.every(id => BY_ID[id] && ((BY_ID[id].boss === b.type && BY_ID[id].pool === 'dungeon') || (BY_ID[id].pool === 'raid' && BY_ID[id].raidBosses.includes(b.type)))), `${b.type}: своей добычи нет`); ok(CFG3.enemies[b.type] && CFG3.enemies[b.type].boss, `${b.type}: нет врага-босса`); }
{ const kinds = new Set(BL.flatMap(b => b.attacks.map(a => a.kind))), ph = BL.flatMap(b => b.phases);
  for (const k of ['slam', 'nova', 'charge', 'beam', 'pools', 'cast']) ok(kinds.has(k), 'механика не используется: ' + k);
  ok(ph.some(p => p.shield) && ph.some(p => p.summon) && ph.some(p => p.enrage), 'фазы: щит, подмога, ярость'); }
// ---------- 2. вход в своей зоне, путь до каждого босса ----------
{ const brod = I.find(d => d.id === 'inst_brod'), olkh = I.find(d => d.id === 'inst_olkh'), lo = zoneLevel(CFG3, olkh.at.x, olkh.at.z);
  ok(zoneAt(CFG3, brod.at.x, brod.at.z).id === 'brod', 'Катакомбы не в Пепельном Броде'); ok(zoneAt(CFG3, olkh.at.x, olkh.at.z).id === 'olkh' && lo >= 20.5 && lo <= 23.5, 'Курган не в Ольховом лесу 21–23: ' + lo);
  const W = mk(); for (const d of I) { ok(W.map.portals.some(q => q.to === d.id && Math.hypot(q.x - d.at.x, q.z - d.at.z) < .1), d.id + ': нет входа наверху'); ok(!W.map.solids.some(s => Math.hypot(s.x - d.at.x, s.z - d.at.z) < s.r + 1.5), d.id + ': вход загорожен'); }
  for (const d of I) {
    enter(W, d.id); ok(W.lvl === d.id && W.enemies.some(e => !e.boss), d.id + ': внутри нет врагов');
    for (const b of BL.filter(q => q.inst === d.id)) {
      const e = bossIn(W, b.type); ok(e && !e.dead && e.lvl === d.level, `${b.type}: нет в зале или уровень не ${d.level}`);
      let x = d.entry.x, z = d.entry.z, n = 0; for (; n < 400 && Math.hypot(x - b.x, z - b.z) > 3; n++) { const wp = pathStep(W.map, x, z, b.x, b.z); const tx = wp ? wp.x : b.x, tz = wp ? wp.z : b.z, dd = Math.hypot(tx - x, tz - z) || 1; x += (tx - x) / dd * Math.min(.8, dd); z += (tz - z) / dd * Math.min(.8, dd); }
      ok(n < 400, `${b.type}: от входа не дойти`);
    }
    travel(W, 'surface', 0, 4);
  } }
// ---------- 3. механики ----------
const lab = (type, only, f) => { const W = mk(7); const b = BL.find(q => q.type === type), d = enter(W, b.inst); W.enemies = W.levels[d.id].enemies = W.enemies.filter(e => e.boss && e.type === type);
  const e = W.enemies[0]; e.b.def = { ...e.b.def, attacks: e.b.def.attacks.filter(a => a.kind === only), phases: f && f.phases || [] }; e.alert = true; e.b.cd = 0; W.player.x = e.x + 5; W.player.z = e.z; W.player.inv = 0; W.player.hp = W.player.maxhp = 1e5; W.cfg.player.hp = 1e5; return { W, e }; };
{ const { W, e } = lab('gravekeeper', 'pools'); let n = 0; run(W, 2, {}, () => { n = Math.max(n, (W.bzones || []).length); }); const z = W.bzones && W.bzones[0];
  ok(n >= 3 && z && Math.hypot(z.x - W.player.x, z.z - W.player.z) < 2, 'лужи не легли под героя');
  const h0 = W.player.hp; run(W, 2); ok(W.player.hp < h0, 'в луже не больно');
  W.player.x = e.x - 20; W.player.inv = 1e9; run(W, .1); W.player.inv = 0; const h1 = W.player.hp; e.b.cd = 99; e.b.def.attacks = []; run(W, 2); ok(W.player.hp === h1, 'вне луж больно');
  run(W, 10); ok(!(W.bzones || []).length, 'лужи не гаснут'); }
{ const { W, e } = lab('boneshepherd', 'beam'); e.b.def.attacks[0].sweep = 0; let on = false; const h0 = W.player.hp; run(W, 4, {}, () => { if (e.b.state === 'beam') on = true; });
  ok(on && W.player.hp < h0, 'луч не горит или не бьёт стоящего на линии');
  const L = lab('boneshepherd', 'beam'); L.e.b.def.attacks[0].sweep = 0; let moved = false, h2 = 0;     // луч нацелен на героя справа; загорелся — герой за спину босса
  run(L.W, 4, {}, () => { if (L.e.b.state === 'beam' && !moved) { moved = true; L.W.player.x = L.e.x - 6; L.W.player.z = L.e.z; h2 = L.W.player.hp; } });
  ok(moved && L.W.player.hp === h2, 'луч бьёт за спиной'); }
{ const { W, e } = lab('ashsister', 'cast'); W.player.x = e.x + 14; const h0 = W.player.hp; let casted = false, intr = false; run(W, 4, {}, () => { if (W.ev.some(v => v.k === 'bossCast')) casted = true; if (W.ev.some(v => v.k === 'bossInterrupt')) intr = true; W.ev.length = 0; });
  ok(casted && !intr && W.player.hp < h0, 'дочитанное заклинание не бьёт весь зал');
  const L = lab('ashsister', 'cast'); L.W.player.x = L.e.x + 14; const g0 = L.W.player.hp; let kicked = false; run(L.W, 4, {}, i => { if (i === 60) L.e.b.kick = true; if (L.W.ev.some(v => v.k === 'bossInterrupt')) kicked = true; L.W.ev.length = 0; });
  ok(kicked && L.W.player.hp === g0, 'тяжёлый удар не сбил чтение');
  const T = lab('ashsister', 'cast'); T.W.hero = 'vale'; T.W.player.x = T.e.x + 14; const t = spawnAlly(T.W, 'c_thorn'); t.x = T.e.x + 2; t.z = T.e.z; let tk = false; run(T.W, 4, {}, () => { t.hp = t.maxhp; if (T.W.ev.some(v => v.k === 'bossInterrupt')) tk = true; T.W.ev.length = 0; });
  ok(tk, 'защитник отряда не сбил чтение'); }
{ const { W, e } = lab('boneshepherd', 'slam', { phases: [{ at: .6, summon: { type: 'ghoul', n: 3 }, shield: true }] }); W.player.inv = 1e9; e.hp = e.maxhp * .59; run(W, .2);
  ok(e.b.shield && e.b.minions.length === 3 && W.hudBoss && W.hudBoss.shield, 'щит с подмогой не поднялся'); const h = e.hp; e.hp -= 500; run(W, .05); ok(e.hp >= h - 1, 'под щитом босс получает урон');
  for (const m of e.b.minions) killEnemy(W, m, 1); run(W, .1); ok(!e.b.shield, 'щит не пал без подмоги'); e.hp -= 500; run(W, .05); ok(e.hp < h - 400, 'после щита урон не проходит'); }
// ---------- 4. добыча и героическая ----------
{ const W = mk(100), def = BL.find(q => q.type === 'gravekeeper'); enter(W, 'inst_brod'); let own = 0, n2 = 0;     // у подземелья свой поток случайных чисел — бросаем 40 раз в одном мире
  for (let s = 0; s < 40; s++) { W.enemies = W.levels.inst_brod.enemies = W.enemies.filter(q => !q.boss); const e = spawnBoss(W, def); W.drops.length = 0; killEnemy(W, e, 1); const k = W.drops.filter(d => BY_ID[d.id].boss === 'gravekeeper').length; own += k >= 1 ? 1 : 0; n2 += k >= 2 ? 1 : 0; }
  ok(own === 40, 'босс не всегда роняет свою вещь'); ok(n2 >= 6 && n2 <= 24, 'вторая своя вещь не «с шансом»: ' + n2); }
{ const W = mk(9); W.lv = 59; ok(!setHeroic(W, 'inst_brod', true), 'героическая открыта до 60 уровня'); W.lv = 60; ok(setHeroic(W, 'inst_brod', true), 'героическая не включилась');
  enter(W, 'inst_brod'); const e = bossIn(W, 'gravekeeper'), t = W.enemies.find(q => !q.boss);
  ok(e && e.lvl === 60 && e.heroic && e.maxhp > CFG3.enemies.gravekeeper.hp * 1.6 * 2 && t && t.lvl === 60 && levelAt(W, 0, 0) === 60, 'героическая: босс и враги не 60-го уровня или слабы');
  W.drops.length = 0; killEnemy(W, e, 1); const own = W.drops.filter(d => BY_ID[d.id].boss === 'gravekeeper'), il = Math.max(...own.map(d => d.il));
  ok(own.length >= 2 && il >= 60 + CFG3.instances.heroic.il, 'героическая: добыча не богаче'); travel(W, 'surface', 0, 4);
  ok(setHeroic(W, 'inst_brod', false), 'героическая не выключилась'); enter(W, 'inst_brod'); ok(bossIn(W, 'boneshepherd').lvl === 14, 'после выключения уровень не 14'); }
// ---------- 5. бой: герой-бот и отряд против каждого босса ----------
const KIT = { weapon: 'w_sword_black', body: 'a_body_plate_black', head: 'a_head_helm_black', boots: 'a_boots_greaves_black', cloak: 'a_cloak_pelt_black', ring: 'r_ring_blood', amulet: 'm_talisman_blood' };
function fight(b, seed, party) {
  const W = mk(seed * 131 + 7); W.hero = 'vale'; const d = I.find(q => q.id === b.inst), lv = d.level; W.lv = lv;
  Object.assign(W.inv.eq, KIT); W.inv.il = Object.fromEntries(Object.keys(KIT).map(k => [k, lv])); refreshGear(W); W.player.hp = W.player.maxhp;
  enter(W, d.id); W.enemies = W.levels[d.id].enemies = W.enemies.filter(e => e.boss && e.type === b.type);
  const e0 = W.enemies[0], room = d.rooms.find(r => r.id === b.room), p = W.player; p.x = room.x - room.w * .35; p.z = room.z;
  if (party) for (const t of ['c_thorn', 'c_irga', 'c_jay', 'veteran'].slice(0, d.raid ? 4 : Math.min(3, squadMax(W)))) { const a = spawnAlly(W, t); a.x = p.x - 1; a.z = p.z + 1; }     // рейд — четыре бойца
  const dodge = mulberry32(seed + 5);
  for (let i = 0; i < 60 * 180; i++) {
    const e = W.enemies.find(x => x.boss && !x.dead); if (!e) return { win: true, t: i / 60 }; const dx = e.x - p.x, dz = e.z - p.z, dd = Math.hypot(dx, dz) || 1, C = CFG3.enemies[e.type];
    const inp = { mx: 0, mz: 0 }, tank = party && W.allies.some(a => !a.dead && a.type === 'c_thorn');
    const want = tank ? 2.6 : 3.2; if (dd > want) { inp.mx = dx / dd; inp.mz = dz / dd; } inp.attackPress = dd < CFG3.player.attackRange + W.gear.reach + C.radius * .5 + .3;
    const B = e.b; if (B.state === 'wind' && B.atk.kind !== 'cast' && B.atk.t > B.atk.wind - .22 && p.rollCd <= 0 && dodge() < .5) { inp.roll = true; inp.mx = -dx / dd; inp.mz = -dz / dd; inp.attackPress = false; }
    const z = (W.bzones || []).find(q => Math.hypot(q.x - p.x, q.z - p.z) < q.r + .8); if (z) { const zx = p.x - z.x, zz = p.z - z.z, zd = Math.hypot(zx, zz) || 1; inp.mx = zx / zd; inp.mz = zz / zd; inp.attackPress = false; }     // «не стой в огне»
    if (B.state === 'beam' || (B.state === 'wind' && B.atk.kind === 'beam')) { const a = B.atk, side = (p.x - e.x) * a.dz - (p.z - e.z) * a.dx, ahead = (p.x - e.x) * a.dx + (p.z - e.z) * a.dz; if (ahead > 0 && Math.abs(side) < a.width / 2 + 1.5) { const s = side >= 0 ? 1 : -1; inp.mx = a.dz * s; inp.mz = -a.dx * s; inp.attackPress = false; } }     // с линии луча — вбок
    for (const m of W.enemies) if (!m.boss && !m.dead && Math.hypot(m.x - p.x, m.z - p.z) < 4 && !z) { inp.mx = m.x - p.x; inp.mz = m.z - p.z; inp.attackPress = true; }
    if (B.shield && !z) { const m = B.minions.filter(q => !q.dead).sort((u, v) => Math.hypot(u.x - p.x, u.z - p.z) - Math.hypot(v.x - p.x, v.z - p.z))[0];     // щит: сперва подмога
      if (m) { const md = Math.hypot(m.x - p.x, m.z - p.z) || 1; inp.mx = (m.x - p.x) / md; inp.mz = (m.z - p.z) / md; inp.attackPress = md < CFG3.player.attackRange + W.gear.reach + CFG3.enemies[m.type].radius * .5 + .3; } }
    step(W, 1 / 60, inp); if (p.dead) return { win: false, t: i / 60 };
    void e0;
  }
  return { win: false, t: 180 };
}
// боссы сцен (Акт III–IV): бой на открытом месте ядра — уровень места ниже base, сила босса ровно base
const { ACT } = await import('../3d/src/story3d.js');
const SCENE = ACT.flatMap(c => c.goal.spawnBoss ? [{ type: c.goal.boss, ...c.goal.spawnBoss }] : c.goal.hunt ? c.goal.hunt : []);
function fieldFight(def, seed, party) {
  const W = mk(seed * 97 + 3, c => { c.bosses.list = []; }); W.hero = 'vale'; const lv = def.base; W.lv = lv;
  Object.assign(W.inv.eq, KIT); W.inv.il = Object.fromEntries(Object.keys(KIT).map(k => [k, lv])); refreshGear(W); W.player.hp = W.player.maxhp;
  const p = W.player; p.x = 60; p.z = 40; const e0 = spawnBoss(W, { ...def, x: 66, z: 40 }); e0.alert = true;
  if (party) for (const t of ['c_thorn', 'c_irga', 'c_jay']) { const a = spawnAlly(W, t); a.x = p.x - 1; a.z = p.z + 1; }
  const dodge = mulberry32(seed + 5);
  for (let i = 0; i < 60 * 180; i++) {
    const e = W.enemies.find(x => x.boss && !x.dead); if (!e) return { win: true, t: i / 60 }; const dx = e.x - p.x, dz = e.z - p.z, dd = Math.hypot(dx, dz) || 1, C = CFG3.enemies[e.type], B = e.b;
    const inp = { mx: 0, mz: 0 }; if (dd > (party ? 2.6 : 3.2)) { inp.mx = dx / dd; inp.mz = dz / dd; } inp.attackPress = dd < CFG3.player.attackRange + W.gear.reach + C.radius * .5 + .3;
    if (B.state === 'wind' && B.atk.kind !== 'cast' && B.atk.t > B.atk.wind - .22 && p.rollCd <= 0 && dodge() < .5) { inp.roll = true; inp.mx = -dx / dd; inp.mz = -dz / dd; inp.attackPress = false; }
    const z = (W.bzones || []).find(q => Math.hypot(q.x - p.x, q.z - p.z) < q.r + .8); if (z) { const zx = p.x - z.x, zz = p.z - z.z, zd = Math.hypot(zx, zz) || 1; inp.mx = zx / zd; inp.mz = zz / zd; inp.attackPress = false; }
    if (B.state === 'beam' || (B.state === 'wind' && B.atk.kind === 'beam')) { const a = B.atk, side = (p.x - e.x) * a.dz - (p.z - e.z) * a.dx, ahead = (p.x - e.x) * a.dx + (p.z - e.z) * a.dz; if (ahead > 0 && Math.abs(side) < a.width / 2 + 1.5) { const sg = side >= 0 ? 1 : -1; inp.mx = a.dz * sg; inp.mz = -a.dx * sg; inp.attackPress = false; } }
    for (const m of W.enemies) if (!m.boss && !m.dead && Math.hypot(m.x - p.x, m.z - p.z) < 4 && !z) { inp.mx = m.x - p.x; inp.mz = m.z - p.z; inp.attackPress = true; }
    step(W, 1 / 60, inp); if (p.dead) return { win: false, t: i / 60 };
  }
  return { win: false, t: 180 };
}
// поддержка врагов Акта IV: тролль зарастает, если его не бьют; кликуша лечит раненых своих
{ const W = mk(30, c => { c.bosses.list = []; }); W.player.inv = 1e9; W.player.x = 60; W.player.z = 40;
  const t = spawnEnemy(W, 'troll', 80, 40); t.hp = t.maxhp * .5; t.cd = 99; t.alert = false; for (let i = 0; i < 300; i++) step(W, 1 / 60, {}); ok(t.hp > t.maxhp * .55, 'тролль не зарастает');
  const s2 = spawnEnemy(W, 'shrieker', 90, 60), g = spawnEnemy(W, 'brute', 92, 60); s2.alert = true; g.hp = g.maxhp * .3; g.cd = 99; const h0 = g.hp; for (let i = 0; i < 300; i++) step(W, 1 / 60, {}); ok(g.hp > h0 + g.maxhp * .1, 'кликуша не лечит своих'); }
const N = Number(process.env.INST_N ?? 4);     // INST_N=0 — без боёв ботом (быстрый набор npm test); бои — в test:slow
for (const d of N && !process.env.INST_ONLY ? SCENE : []) {
  let wp = 0, ws = 0; for (let s2 = 0; s2 < N; s2++) { wp += fieldFight(d, s2, true).win ? 1 : 0; ws += fieldFight(d, s2, false).win ? 1 : 0; }
  console.log(`${CFG3.enemies[d.type].name} (сцена)`.padEnd(24), `с отрядом побед ${(wp / N * 100).toFixed(0)}%, в одиночку ${(ws / N * 100).toFixed(0)}%`);
  ok(wp / N >= .5, `${d.type}: отряд побеждает босса сцены реже половины боёв`);
}
const ONLY = (process.env.INST_ONLY || '').split(',').filter(Boolean);     // INST_ONLY=abbot,tidewyrm — только эти боссы
for (const b of N ? BL.filter(x => !ONLY.length || ONLY.includes(x.type)) : []) {
  let wp = 0, ws = 0, tp = 0; for (let s = 0; s < N; s++) { const r = fight(b, s, true); wp += r.win ? 1 : 0; tp += r.t; const q = fight(b, s, false); ws += q.win ? 1 : 0; }
  console.log(`${CFG3.enemies[b.type].name}`.padEnd(24), `с отрядом побед ${(wp / N * 100).toFixed(0)}% (${(tp / N).toFixed(0)} с), в одиночку ${(ws / N * 100).toFixed(0)}%`);
  ok(wp / N >= .5, `${b.type}: отряд уровня подземелья побеждает реже половины боёв`); ok(ws <= wp, `${b.type}: в одиночку легче, чем с отрядом`);
}

if (fails.length) { console.log('ПРОВАЛ:\n' + [...new Set(fails)].join('\n')); process.exit(1); }
console.log('Подземелья и боссы 3D: OK');
