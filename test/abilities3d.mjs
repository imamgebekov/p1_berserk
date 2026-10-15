// Тест активных умений 3D (шаг B3a): отдельные очки умений с 3-го уровня, открытие по уровням 3/8/15/25/30, ранги до 5,
// перезарядки; умения Торна: рывок (бьёт всех на пути), клич (страх, броня), вихрь (по кругу), несокрушимость (меньше урона, без отброса),
// ярость (урон и скорость, тает здоровье); страх и корни не берут боссов; сброс за пепел; сохранение версии 4.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnEnemy, refreshGear, gainXp, hurtPlayer } from '../3d/src/sim.js';
import { applyStatus } from '../3d/src/status3d.js';
import { ABILITIES } from '../3d/src/data/abilities3d.js';
import { abilityPoints, canUpgrade, upgradeAbility, useAbility, respecAbilities, respecAbilityCost, abilityView } from '../3d/src/abilities3d.js';
import { createSaver, loadSave } from '../3d/src/save3d.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const clone = () => JSON.parse(JSON.stringify(CFG3));
const A = CFG3.abilities, T = A.thorn;
const mk = (lv = 30, seed = 1) => {
  const c = clone(); c.enemies.count = 0; c.bosses.list = []; c.map.places = []; c.events.on = false; c.wanderer.on = false; c.ambient.on = false;
  const W = createWorld(c, mulberry32(seed)); W.hero = 'thorn'; W.lv = lv; W.ap = abilityPoints(lv, c); W.inv.eq.weapon = 'w_sword_iron'; refreshGear(W);
  Object.assign(W.player, { x: 40, z: 40, face: 0, inv: 0 }); W.player.hp = W.player.maxhp; return W;
};
const max = (W, id) => { while (upgradeAbility(W, id) === 'ok'); };
const foe = (W, dx, dz, type = 'brute') => { const e = spawnEnemy(W, type, W.player.x + dx, W.player.z + dz); e.hp = e.maxhp = 1e4; e.cd = 99; return e; };
const still = W => { for (const e of W.enemies) { e.state = 'rec'; e.t = -1e9; e.vx = e.vz = 0; } };
const run = (W, sec, inp = {}) => { for (let i = 0; i < Math.round(sec * 60); i++) step(W, 1 / 60, typeof inp === 'function' ? inp(i) : inp); };
const mem = () => { const o = {}; return { getItem: k => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); }, removeItem: k => { delete o[k]; }, o }; };

// ---------- 1. данные и очки ----------
{
  const L = ABILITIES.thorn; ok(L.length === 5 && L.every(a => T[a.id] && a.icon && [0, 1, 2, 3, 4].every(r => typeof a.text(T[a.id], r) === 'string')), 'у Торна не 5 описанных умений');
  ok(A.unlock.join() === '3,8,15,25,30' && A.maxRank === 5, 'уровни открытия не 3/8/15/25/30');
  const c = clone(); c.enemies.count = 0; c.map.places = []; const W = createWorld(c, mulberry32(2)); W.hero = 'thorn';
  gainXp(W, 1e3); const lv = W.lv; ok(W.ap === Math.max(0, lv - 2), `очков умений ${W.ap} на уровне ${lv}`);
  for (let i = 0; i < 400 && W.lv < 30; i++) gainXp(W, 1e5);
  ok(W.lv === 30 && W.ap === 28 && W.sp === 29, `на 30-м уровне умений ${W.ap}, навыков ${W.sp}`);
}
// ---------- 2. открытие, ранги, перезарядка ----------
{
  const W = mk(7);
  ok(canUpgrade(W, 'charge') === 'ok' && canUpgrade(W, 'cry') === 'lvl', 'клич открыт раньше 8-го уровня');
  ok(useAbility(W, 0) === 'rank', 'невкачанное умение сработало');
  max(W, 'charge'); ok(W.ab.charge === 5 && canUpgrade(W, 'charge') === 'max', 'ранг выше 5');
  ok(W.ap === abilityPoints(7, CFG3) - 5, 'очки не списались');
  ok(useAbility(W, 0) === 'ok' && useAbility(W, 0) !== 'ok', 'рывок сработал дважды подряд');
  { const V = mk(); upgradeAbility(V, 'whirl'); ok(useAbility(V, 2) === 'ok' && useAbility(V, 2) === 'cd' && V.acd.whirl === T.whirl.cd[0], 'нет перезарядки'); }
  run(W, T.charge.cd[4] + .3); ok(useAbility(W, 0) === 'ok', 'перезарядка не прошла');
  const v = abilityView(W); ok(v.length === 5 && v[0].rank === 5 && !v[1].open && v[0].cdMax === T.charge.cd[4], 'вид умений для интерфейса не тот');
}
// ---------- 3. рывок ----------
{
  const W = mk(); upgradeAbility(W, 'charge'); const on = foe(W, 0, 3), off = foe(W, 4, 3); still(W);
  useAbility(W, 0); run(W, T.charge.time + .2, () => { still(W); return {}; });
  const moved = W.player.z - 40; ok(moved > T.charge.dist * .7, `рывок сдвинул на ${moved.toFixed(1)} м`);
  ok(on.hp < on.maxhp && off.hp === off.maxhp, 'рывок не ударил того, кто на пути, или ударил стороннего');
  ok(on.hp >= on.maxhp - 200, 'враг на пути ударен много раз');
}
// ---------- 4. клич: страх и броня; босс не боится ----------
{
  const W = mk(); upgradeAbility(W, 'cry'); const e = foe(W, 0, 1.5); e.cd = 0; const far = foe(W, 0, T.cry.r + 3);
  const arm0 = W.gear.armor; useAbility(W, 1); step(W, 1 / 60, {});
  ok(e.st && e.st.fear && !(far.st && far.st.fear), 'страх не тот');
  ok(W.gear.armor === arm0 + T.cry.armor[0], 'клич не дал брони');
  const hp0 = W.player.hp, d0 = Math.hypot(e.x - W.player.x, e.z - W.player.z); run(W, T.cry.fear[0] * .8);
  ok(W.player.hp === hp0 && Math.hypot(e.x - W.player.x, e.z - W.player.z) > d0 + 2, 'испуганный враг бьёт или не убегает');
  const b = foe(W, 3, 0); b.boss = true; ok(!applyStatus(W, b, 'fear', 0, 3) && !applyStatus(W, b, 'root', 0, 3), 'босс боится или в корнях');
}
// ---------- 5. вихрь ----------
{
  const W = mk(); upgradeAbility(W, 'whirl'); const ring = [0, 1, 2, 3].map(k => foe(W, Math.sin(k * 1.57) * 2, Math.cos(k * 1.57) * 2)), out = foe(W, 0, T.whirl.r + 2); still(W);
  useAbility(W, 2); ok(ring.every(e => e.hp < e.maxhp) && out.hp === out.maxhp, 'вихрь бьёт не по кругу');
}
// ---------- 6. несокрушимость ----------
{
  const W = mk(), hit = () => { const p = W.player; p.hp = p.maxhp; p.inv = 0; p.vx = p.vz = 0; hurtPlayer(W, 40, p.x, p.z - 2); return { d: p.maxhp - p.hp, v: Math.hypot(p.vx, p.vz) }; };
  const a = hit(); upgradeAbility(W, 'iron'); useAbility(W, 3); const b = hit();
  ok(Math.abs(b.d - Math.round(a.d * T.iron.taken)) <= 1 && b.v === 0, `несокрушимость: урон ${a.d} → ${b.d}, отброс ${b.v}`);
  run(W, T.iron.t[0] + .2); const c = hit(); ok(c.d === a.d, 'несокрушимость не кончилась');
}
// ---------- 7. ярость ----------
{
  const dealt = rage => { const W = mk(30, 9); const e = foe(W, 0, 1.4); still(W); if (rage) { upgradeAbility(W, 'rage'); useAbility(W, 4); }
    const hp0 = W.player.hp; let sw = 0; run(W, 2, i => { still(W); e.x = 40; e.z = 41.4; if (W.player.state === 'atk') sw = W.player.swingMul; return { attackPress: i % 30 === 0 }; }); return { d: e.maxhp - e.hp, hp: hp0 - W.player.hp, sw }; };
  const n = dealt(false), r = dealt(true);
  ok(r.d > n.d * 1.15, `ярость не добавила урона: ${n.d} → ${r.d}`);
  ok(r.sw < n.sw && r.hp > 0 && n.hp === 0, `ярость: удар ${n.sw}→${r.sw}, здоровье −${r.hp}`);
}
// ---------- 8. сброс и сохранение ----------
{
  const W = mk(20); max(W, 'charge'); upgradeAbility(W, 'cry'); W.inv.ash = 1e5; W.skills = { hand: 2 }; W.sp = 17;
  const st = mem(); createSaver(W, st).write(true); const s = loadSave(30, st);
  ok(s && s.prog.ab.charge === 5 && s.prog.ab.cry === 1 && s.prog.ap === W.ap, 'умения не сохранились');
  const d = JSON.parse(st.o['berserk3d.save']); d.prog.ap = 99; st.setItem('berserk3d.save', JSON.stringify(d));
  const s2 = loadSave(30, st); ok(s2 && !Object.keys(s2.prog.ab).length && s2.prog.ap === abilityPoints(20, CFG3) && s2.prog.skills.hand === 2, 'лишние очки умений сбросили не только умения');
  const d3 = JSON.parse(st.o['berserk3d.save']); d3.v = 3; delete d3.prog.ab; delete d3.prog.ap; st.setItem('berserk3d.save', JSON.stringify(d3));
  const s3 = loadSave(30, st); ok(s3 && s3.prog.ap === abilityPoints(20, CFG3), 'миграция 3 → 4 не дала очков по уровню');
  const cost = respecAbilityCost(W), ap = W.ap; ok(respecAbilities(W) === 'ok' && W.ap === ap + 6 && !Object.keys(W.ab).length && W.inv.ash === 1e5 - cost, 'сброс умений не вернул очки');
}

// ---------- 9. Сойка: отскок, залп, капкан, яд, град ----------
{
  const J = A.jay, mkJ = (seed = 1) => { const W = mk(30, seed); W.hero = 'jay'; W.inv.eq.weapon = 'w_bow_iron'; refreshGear(W); return W; };
  ok(ABILITIES.jay.length === 5 && ABILITIES.jay.every(a => J[a.id] && [0, 4].every(r => typeof a.text(J[a.id], r) === 'string')), 'у Сойки не 5 описанных умений');
  { const W = mkJ(); upgradeAbility(W, 'leap'); const e = foe(W, 0, 4); still(W); ok(useAbility(W, 0) === 'ok', 'отскок не сработал');
    run(W, .8, () => { still(W); return {}; }); ok(W.player.z < 40 - J.leap.dist * .7 && e.hp < e.maxhp, `отскок: герой на ${(W.player.z - 40).toFixed(1)}, враг цел ${e.hp === e.maxhp}`); }
  { const W = mkJ(); upgradeAbility(W, 'volley'); const s15 = 15 * Math.PI / 180, a = foe(W, 0, 7), b = foe(W, Math.sin(s15) * 9, Math.cos(s15) * 9); still(W);     // веер строится от ближайшего врага
    const n0 = W.proj.length; useAbility(W, 1); ok(W.proj.filter(q => q.friendly).length - n0 === J.volley.n, 'в залпе не столько стрел');
    run(W, 1, () => { still(W); return {}; }); ok(a.hp < a.maxhp && b.hp < b.maxhp, 'залп не задел цель и соседа в веере'); }
  { const W = mkJ(); upgradeAbility(W, 'trap'); useAbility(W, 2); const tp = W.traps[0];
    ok(tp && Math.abs(tp.z - (40 + J.trap.ahead)) < .01, 'капкан не впереди');
    const e = foe(W, 0, J.trap.ahead); run(W, .1); ok(e.hp < e.maxhp && e.st && e.st.root && !W.traps.length, 'капкан не схватил врага');
    const x0 = e.x, z0 = e.z; e.cd = 0; e.alert = true; W.player.x += 6; run(W, 1); ok(Math.hypot(e.x - x0, e.z - z0) < .3, 'враг в корнях ходит');
    W.acd = {}; for (let k = 0; k < 3; k++) { useAbility(W, 2); W.acd = {}; } ok(W.traps.length === J.trap.max, 'капканов больше предела'); }
  { const W = mkJ(); upgradeAbility(W, 'venom'); const e1 = foe(W, 0, 4), e2 = foe(W, 0, 7); still(W); useAbility(W, 3);
    run(W, .8, () => { still(W); return {}; }); ok(e1.st && e1.st.poison && e2.hp < e2.maxhp, 'ядовитая стрела не травит или не пробивает'); }
  { const W = mkJ(); upgradeAbility(W, 'rain'); const a = foe(W, 0, 9), b = foe(W, 1.5, 9), c = foe(W, 0, 9 + J.rain.r + 3); still(W); useAbility(W, 4);
    const zn = W.zones[0]; ok(zn && Math.hypot(zn.x - a.x, zn.z - a.z) < .1, 'град не над ближайшим врагом');
    run(W, J.rain.t + .2, () => { still(W); return {}; });
    const hitsA = a.maxhp - a.hp; ok(hitsA > 0 && b.hp < b.maxhp && c.hp === c.maxhp && !W.zones.length, 'град бьёт не по кругу или не кончился');
    ok(hitsA > (W.cfg.player.attackDamage + W.gear.dmg) * J.rain.mul[0] * 5, 'град ударил мало раз: ' + hitsA); }
}

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Умения 3D: OK');
