// Тест мастерства умений: 4-й ранг меняет поведение каждого из 32 умений (cfg.abilities.mastery.twist).
// Выборочно проверяем видимые следствия; при twist: false — прежнее поведение. Описание есть у всех 32.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnEnemy, refreshGear } from '../3d/src/sim.js';
import { ABILITIES, MASTERY_TEXT } from '../3d/src/data/abilities3d.js';
import { abilityPoints, upgradeAbility, useAbility, abilityView } from '../3d/src/abilities3d.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const mk = (hero, twist = true) => {
  const c = JSON.parse(JSON.stringify(CFG3)); c.map.buildings = c.map.buildings.filter(b => Math.hypot(b.x - 40, b.z - 40) > 30); c.map.zones = (c.map.zones || []).filter(z => Math.hypot(z.x - 40, z.z - 40) > 30); c.map.spots = (c.map.spots || []).filter(q => Math.hypot(q.x - 40, q.z - 40) > 30); /* поле боя у (40, 40) — без домов и заборов (ядро раздвинуто в 3.93) */ c.enemies.count = 0; c.bosses.list = []; c.map.places = []; c.events.on = false; c.wanderer.on = false; c.ambient.on = false; c.abilities.mastery.twist = twist;
  for (const R of Object.values(c.abilities.res)) Object.assign(R, { max: 1e9, start: 1e9, decay: 0 });
  const W = createWorld(c, mulberry32(3)); W.hero = hero; W.lv = 60; W.ap = abilityPoints(60, c); refreshGear(W);
  for (const a of ABILITIES[hero]) while (upgradeAbility(W, a.id) === 'ok');
  Object.assign(W.player, { x: 40, z: 40, face: 0, inv: 0 }); W.player.hp = W.player.maxhp; return W;
};
const foe = (W, dx, dz, type = 'brute') => { const e = spawnEnemy(W, type, W.player.x + dx, W.player.z + dz); e.hp = e.maxhp = 1e5; e.cd = 99; e.state = 'rec'; e.t = -1e9; return e; };
const use = (W, id) => { const i = ABILITIES[W.hero].findIndex(a => a.id === id); delete W.acd[id]; return useAbility(W, i); };
const run = (W, s) => { for (let i = 0; i < Math.round(s * 60); i++) step(W, 1 / 60, {}); };
const both = (hero, f) => [f(mk(hero, true)), f(mk(hero, false))];

// данные: у всех 32 есть описание, в окне умения — строка мастерства, ранги до 4
{
  const all = Object.values(ABILITIES).flat().filter(a => !a.kind); ok(all.length >= 32 && all.every(a => MASTERY_TEXT[a.id]), `описаний мастерства ${all.filter(a => MASTERY_TEXT[a.id]).length} из ${all.length}`);
  const W = mk('thorn'), v = abilityView(W).slice(0, 8); ok(v.every(a => a.rank === 4 && a.mt && a.mlv >= 33), 'окно умения: ранг 4 и строка мастерства');
  ok(abilityView(mk('thorn', false)).every(a => !a.mt), 'twist: false — строка мастерства видна');
}
// Торн
{
  const [d1, d0] = both('thorn', W => { const e = foe(W, 0, 4.6); const d = Math.hypot(e.x - W.player.x, e.z - W.player.z); use(W, 'whirl'); run(W, .3); return d - Math.hypot(e.x - W.player.x, e.z - W.player.z); });
  ok(d1 > .5 && d0 <= .01, `вихрь не тянет: ${d1.toFixed(2)} / без мастерства ${d0.toFixed(2)}`);
  const [h1, h0] = both('thorn', W => { W.player.hp = W.player.maxhp * .5; use(W, 'cry'); return W.player.hp / W.player.maxhp; });
  ok(h1 > .6 && h0 < .51, `клич не лечит: ${h1.toFixed(2)} / ${h0.toFixed(2)}`);
  const [r1, r0] = both('thorn', W => { use(W, 'rage'); return W.abuf.rageDrain; }); ok(r1 === 0 && r0 > 0, 'ярость тает здоровьем');
  const [b1, b0] = both('thorn', W => { const e = foe(W, 0, 1.8); use(W, 'bash'); return !!(e.st && e.st.crack && e.st.crack.k > 1); }); ok(b1 && !b0, 'сокрушающий удар не раскалывает броню (k > 1)');
  const [c1, c0] = both('thorn', W => { const e = foe(W, 0, 5); use(W, 'charge'); run(W, .4); return !!(e.st && e.st.stun); }); ok(c1 && !c0, 'рывок не оглушает');
  const [i1] = both('thorn', W => { W.pst.burn = { t: 5, dps: 3 }; use(W, 'iron'); return !W.pst.burn; }); ok(i1, 'несокрушимость не снимает горение');
}
// Сойка
{
  const [t1, t0] = both('jay', W => { use(W, 'trap'); return W.traps.length; }); ok(t1 === 2 && t0 === 1, `капканов ${t1} / ${t0}`);
  const [l1, l0] = both('jay', W => { foe(W, 0, 3); use(W, 'leap'); return W.traps.length; }); ok(l1 === 1 && l0 === 0, 'отскок не оставляет капкан');
  const [g1, g0] = both('jay', W => { foe(W, 0, 6); use(W, 'rain'); return W.zones[0] && W.zones[0].slow; }); ok(g1 > 0 && !g0, 'град не замедляет');
}
// Вейл
{
  const [s1, s0] = both('vale', W => { use(W, 'shadow'); return W.allies.filter(a => a.decoy).length; }); ok(s1 === 2 && s0 === 1, `теней ${s1} / ${s0}`);
  const [e1, e0] = both('vale', W => { const e = foe(W, 0, 1.6); e.hp = e.maxhp * .05; W.acd.blink = 9; use(W, 'execute'); return !(W.acd.blink > 0); }); ok(e1 && !e0, 'казнь не снимает перезарядку прыжка');
  const [k1, k0] = both('vale', W => { const e = foe(W, 0, 3); use(W, 'smoke'); return !!(e.st && e.st.blind); }); ok(k1 && !k0, 'дым не ослепляет');
}
// Ирга
{
  const [m1, m0] = both('irga', W => { foe(W, 0, 8); use(W, 'meteor'); return W.meteors.length; }); ok(m1 === 3 && m0 === 1, `метеоров ${m1} / ${m0}`);
  const [f1, f0] = both('irga', W => { const n = W.proj ? W.proj.length : 0; foe(W, 0, 8); use(W, 'fireball'); return W.proj.length - n; }); ok(f1 === 3 && f0 === 1, `огненных шаров ${f1} / ${f0}`);
  const [z1, z0] = both('irga', W => { foe(W, 0, 8); use(W, 'blizzard'); const zn = W.zones[0]; W.player.x += 5; run(W, .1); return zn && Math.hypot(zn.x - W.player.x, zn.z - W.player.z) < .5; }); ok(z1 && !z0, 'вьюга не идёт за Иргой');
  const [p1, p0] = both('irga', W => { const a = foe(W, 0, 4), b = foe(W, 0, 7); const hb = b.hp; use(W, 'spear'); return b.hp < hb; }); ok(p1 && !p0, 'копьё не пробивает второго на линии');
}
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Мастерство умений 3D: OK (32 умения)');
