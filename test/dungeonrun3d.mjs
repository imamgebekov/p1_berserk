// Подземелья 2.0 (4.15), медленный: время прохода новой раскладки — герой-бот с группой сбора (4, в рейде — 10) зачищает всё:
// враги залов и боссы. Цель владельца: подземелье — 10+ мин боёв, рейд — 30–40+ мин. Герой не гибнет (меряем длину, не выживание).
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, refreshGear } from '../3d/src/sim.js';
import { travel } from '../3d/src/levels3d.js';
import { pathStep, roomAt } from '../3d/src/map.js';
import { navArea } from '../3d/src/wilds3d.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const KIT = { weapon: 'w_sword_black', body: 'a_body_plate_black', head: 'a_head_helm_black', boots: 'a_boots_greaves_black', cloak: 'a_cloak_pelt_black', ring: 'r_ring_blood', amulet: 'm_talisman_blood' };
const IDS = (process.env.RUN_IDS || 'inst_moss,raid_hand').split(',');
const LIM = { dungeon: [8, 25], raid: [25, 70] };     // минуты игры

function clear(id, seed) {
  const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.events.on = false; c.wanderer.on = false;
  const W = createWorld(c, mulberry32(seed)), d = c.dungeons.list.find(q => q.id === id); W.hero = 'vale'; W.lv = d.level;
  Object.assign(W.inv.eq, KIT); W.inv.il = Object.fromEntries(Object.keys(KIT).map(k => [k, d.level])); refreshGear(W); W.player.hp = W.player.maxhp;
  travel(W, id, d.entry.x, d.entry.z); step(W, 1 / 60, {});
  const p = W.player, rr = (x, z) => roomAt(W.map, x, z), opt = new Set(W.enemies.filter(e => !e.dead && rr(e.x, e.z) !== rr(p.x, p.z) && !pathStep(W.map, p.x, p.z, e.x, e.z, null)).map(e => e.id));     // за запертыми дверями (план подземелий, 2б) — необязательные, в норму прохода не входят
  const M = W.map, pocketLocked = e => { const a = navArea(M, e.x, e.z), l = M.nav.links.find(q => q.b === a && M.nav.areas[a].pocket), dd = l && l.door >= 0 ? M.doors[l.door] : null; return !!dd && !dd.gate; };
  if (M.wild) for (const e of W.enemies) if (!e.dead && !e.boss && pocketLocked(e)) opt.add(e.id);     // малый мир (этап Б): карман под ключ или за трещиной — необязательный
  const reach = e => !M.wild || navArea(M, e.x, e.z) === navArea(M, p.x, p.z) || !!pathStep(M, p.x, p.z, e.x, e.z, W.keys);     // за воротами — после босса
  const total = W.enemies.filter(e => !e.dead && !opt.has(e.id)).length, cap = 60 * 60 * 80;
  for (let i = 0; i < cap; i++) {
    p.inv = 1; const all = W.enemies.filter(e => !e.dead && !opt.has(e.id)); if (!all.length) return { t: i / 60, total, left: 0 };
    const near = i % 30 ? null : all.filter(reach), en = near && near.length ? (W._en = near) : (W._en && W._en.some(e => !e.dead) ? W._en.filter(e => !e.dead) : all);
    const skip = W._skip || (W._skip = new Map()), en2 = en.filter(e => !(skip.get(e.id) > i)), pool = en2.length ? en2 : en;     // упёрся — на время другая цель
    let tgt = null, bd = 1e9; for (const e of pool) { const dd = Math.hypot(e.x - p.x, e.z - p.z); if (dd < bd) { bd = dd; tgt = e; } }
    const inp = { mx: 0, mz: 0 }, wp = pathStep(W.map, p.x, p.z, tgt.x, tgt.z, W.keys);
    if (wp) { const dx = wp.x - p.x, dz = wp.z - p.z, dd = Math.hypot(dx, dz) || 1; inp.mx = dx / dd; inp.mz = dz / dd; inp.attackPress = bd < 2.2; }
    else { const C = c.enemies[tgt.type], reach = c.player.attackRange + W.gear.reach + C.radius * .5; if (bd > reach * .8) { inp.mx = (tgt.x - p.x) / bd; inp.mz = (tgt.z - p.z) / bd; } inp.attackPress = bd < reach + .4; }
    step(W, 1 / 60, inp); W.ev.length = 0;
    if (W._t !== tgt.id || tgt.hp < W._hp) { W._t = tgt.id; W._hp = tgt.hp; W._t0 = i; } else if (i - W._t0 > 20 * 60) { skip.set(tgt.id, i + 30 * 60); W._t = 0; }     // 20 с без урона по цели — пропустить её на 30 с
  }
  return { t: cap / 60, total, left: W.enemies.filter(e => !e.dead).length };
}
for (const id of IDS) {
  const raid = !!CFG3.dungeons.list.find(q => q.id === id).raid, r = clear(id, 3), min = r.t / 60, L = raid ? LIM.raid : LIM.dungeon;
  console.log(`${id.padEnd(12)} ${raid ? 'рейд' : 'подземелье'}: врагов ${r.total}, осталось ${r.left}, время ${min.toFixed(1)} мин (цель ${L[0]}–${L[1]})`);
  ok(!r.left, `${id}: не зачищено, осталось ${r.left}`); ok(min >= L[0] && min <= L[1], `${id}: ${min.toFixed(1)} мин вне ${L.join('–')}`);
}
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Проход подземелий 3D: OK');
