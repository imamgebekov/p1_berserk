// Тест боссов замков 3D (шаг C4b): босс живёт в тронном зале последнего этажа (не наверху); страж предпоследнего этажа —
// элита с ключом трона; убийство стража даёт ключ, босса — трофей и таймер возрождения на своём этаже; при долгом отсутствии
// этаж наполняется врагами, а босс остаётся; сохранённый мёртвый босс после загрузки мёртв. Бой: бот в лучшем снаряжении
// на 26 и 30 уровне (вместе) побеждает каждого босса замка в 40–92 % боёв.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, killEnemy, restoreBosses, refreshGear } from '../3d/src/sim.js';
import { travel } from '../3d/src/levels3d.js';
import { BY_ID } from '../3d/src/data/items.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const B = CFG3.bosses.list.filter(b => b.level), floors = CFG3.dungeons.list.filter(d => d.castle);
const mk = (seed = 1) => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.events.on = false; c.wanderer.on = false; return createWorld(c, mulberry32(seed)); };

// ---------- 1. где боссы и стражи ----------
ok(B.length === 2 && B.every(b => floors.some(d => d.id === b.level && d.throne)), 'боссы не в тронных залах');
{ const W = mk();
  for (const b of B) { const L = W.levels[b.level]; ok(L.enemies.some(e => e.boss && e.type === b.type && !e.dead), `${b.type}: нет на своём этаже`); ok(!W.levels.surface.enemies.some(e => e.type === b.type), `${b.type}: наверху`); }
  for (const d of floors.filter(q => q.guard)) {
    ok(d.floor === floors.filter(q => q.castle === d.castle).length - 1 && d.guard.key === d.castle + '_throne', 'страж не на предпоследнем этаже или не с ключом трона');
    ok(!d.chests.some(c => c.key === d.guard.key) && !floors.some(q => q.chests.some(c => c.key === d.guard.key)), 'ключ трона ещё и в сундуке');
    travel(W, d.id, d.entry.x, d.entry.z); step(W, 1 / 60, {});
    const g = W.enemies.find(e => e.guard); ok(g && g.elite && g.maxhp > CFG3.enemies[d.guard.type].hp * 4, 'стража нет или он слабый');
    if (g) { W.ev.length = 0; killEnemy(W, g, 1); ok(W.keys[d.guard.key] && W.ev.some(v => v.k === 'key'), 'страж не отдал ключ трона'); }
  } }
// ---------- 2. смерть, возрождение, сохранение ----------
{ const W = mk(), b = B[0], top = floors.find(d => d.id === b.level);
  travel(W, top.id, top.entry.x, top.entry.z); step(W, 1 / 60, {});
  const e = W.enemies.find(x => x.boss); W.drops.length = 0; killEnemy(W, e, 1);
  ok(W.bossDead[b.type] > 0 && W.drops.some(d => BY_ID[d.id] && BY_ID[d.id].pool === 'trophy'), 'нет таймера возрождения или трофея');
  travel(W, 'surface', 0, 4); W.bossDead[b.type] = .01; step(W, 1 / 60, {}); step(W, 1 / 60, {});
  ok(W.levels[top.id].enemies.some(x => x.boss && !x.dead) && !W.enemies.some(x => x.type === b.type), 'босс не вернулся на свой этаж');
  W.t += CFG3.dungeons.respawnAway + 10; travel(W, top.id, top.entry.x, top.entry.z);
  ok(W.enemies.filter(x => x.boss && !x.dead).length === 1 && W.enemies.some(x => !x.boss), 'после долгого отсутствия босс пропал или этаж пуст');
  const W2 = mk(); restoreBosses(W2, { [b.type]: 100 }); ok(W2.levels[top.id].enemies.some(x => x.boss && x.dead) && W2.bossDead[b.type] > 0, 'сохранённая смерть босса не восстановилась'); }

// ---------- 3. бой ----------
const BLACK = { weapon: 'w_greatsword_black', body: 'a_body_plate_black', head: 'a_head_helm_black', boots: 'a_boots_greaves_black', cloak: 'a_cloak_pelt_black', ring: 'r_ring_blood', amulet: 'm_talisman_blood' };
function fight(b, lv, seed) {
  const W = mk(seed * 131 + 7), top = floors.find(d => d.id === b.level), T = top.throne; W.lv = lv; Object.assign(W.inv.eq, BLACK); refreshGear(W); W.player.hp = W.player.maxhp;
  travel(W, top.id, T.x - T.w * .3, T.z); W.enemies = W.levels[top.id].enemies = W.enemies.filter(e => e.boss); const dodge = mulberry32(seed + 5), p = W.player;
  for (let i = 0; i < 60 * 180; i++) {
    const e = W.enemies.find(x => x.boss && !x.dead); if (!e) return { win: true, t: i / 60 }; const d = Math.hypot(e.x - p.x, e.z - p.z), C = CFG3.enemies[e.type];
    const inp = { mx: 0, mz: 0 };
    if (d > 3.2) { inp.mx = (e.x - p.x) / d; inp.mz = (e.z - p.z) / d; } inp.attackPress = d < CFG3.player.attackRange + W.gear.reach + C.radius * .5 + .3;
    if (e.b.state === 'wind' && e.b.atk.t > e.b.atk.wind - .22 && p.rollCd <= 0 && dodge() < .5) { inp.roll = true; inp.mx = -(e.x - p.x) / d; inp.mz = -(e.z - p.z) / d; inp.attackPress = false; }
    for (const m of W.enemies) if (!m.boss && !m.dead && Math.hypot(m.x - p.x, m.z - p.z) < 4 && d > 6) { inp.mx = m.x - p.x; inp.mz = m.z - p.z; inp.attackPress = true; }
    step(W, 1 / 60, inp); if (p.dead) return { win: false, t: i / 60 };
  }
  return { win: false, t: 180 };
}
const N = Number(process.env.CB_N || 10);
for (const b of B) { let all = 0;
  for (const lv of [26, 30]) {
    let w = 0, t = 0; for (let s = 0; s < N; s++) { const r = fight(b, lv, s); w += r.win ? 1 : 0; t += r.t; } all += w;
    console.log(`${CFG3.enemies[b.type].name} / ур. ${lv}`.padEnd(32), `побед ${(w / N * 100).toFixed(0)}%  среднее время ${(t / N).toFixed(0)} с`);
  }
  const k = all / (2 * N); ok(k >= .4 && k <= .92, `${b.type}: побед на 26–30 уровне ${(k * 100).toFixed(0)}% (нужно 40–92)`); }

if (fails.length) { console.log('ПРОВАЛ:\n' + [...new Set(fails)].join('\n')); process.exit(1); }
console.log('Боссы замков 3D: OK');
