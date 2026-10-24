// Замок Мира 5.0 (этап 4, просьба владельца 2026-10-23): ~45 уровень, втрое больше лагеря; каменные стены и ворота на четыре стороны —
// герой проходит, враги нет; двор без чужих мест, домов, точек интереса и чужих дорог; донжон (вход как в дом, без загрузки), лавка,
// кузня, таверна, казарма; костёр лечит и даёт ночлег; враги внутри не рождаются; лучшие торговцы (витрина лучше лагерей, кузнец — 3-я ступень).
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32 } from '../3d/src/sim.js';
import { zoneLevel } from '../3d/src/zones3d.js';
import { wdist } from '../3d/src/geo3d.js';
import { insideCamp, campAt, resolve, blockFoe, insideOf } from '../3d/src/map.js';
import { shopOf } from '../3d/src/economy3d.js';
import { smithShop } from '../3d/src/smithtrade3d.js';
import { sleepSpot } from '../3d/src/sleep3d.js';
import { BY_ID } from '../3d/src/data/items.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const C = CFG3.map.citadel, D = CFG3.citadel;
ok(C, 'замка нет');
if (C) {
  const H = C.H, inS = (x, z, p = 0) => Math.abs(x - C.x) < H + p && Math.abs(z - C.z) < H + p;
  ok(Math.abs(zoneLevel(CFG3, C.x, C.z) - D.lv) <= 3, `замок на ${zoneLevel(CFG3, C.x, C.z).toFixed(1)} ур. при ${D.lv}`);
  ok(2 * H >= 2.5 * 2 * CFG3.outposts.r, `замок не втрое больше лагеря: ${2 * H} м против ${2 * CFG3.outposts.r}`);
  ok(wdist(CFG3, C.x, C.z) < CFG3.world.radius - H * 1.42, 'замок у края мира');
  const kinds = CFG3.map.buildings.filter(b => b.vil === C.id).map(b => b.kind + ':' + (b.npc || ''));
  ok(['keep:captain', 'shop:merchant', 'smithy:smith', 'tavern:', 'barracks:'].every(k => kinds.includes(k)), 'в замке не все дома: ' + kinds);
  ok(!CFG3.map.places.some(p => p.id !== C.id && inS(p.x, p.z, (p.r || 4) * .5)), 'чужое место во дворе замка');
  ok(!CFG3.map.buildings.some(b => b.vil !== C.id && inS(b.x, b.z, 4)), 'чужой дом во дворе замка');
  ok(!(CFG3.map.pois || []).some(q => inS(q.x, q.z, q.r)), 'точка интереса во дворе замка');
  const segIn = ([a, b]) => { for (let t = 0; t <= 1; t += .02) { const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t; if (inS(x, z, -1)) return true; } return false; };
  ok(!CFG3.map.links.some(segIn), 'чужая дорога через двор замка');
  ok(CFG3.map.links.some(([a, b]) => [a, b].some(q => Math.abs(Math.hypot(q.x - C.x, q.z - C.z) - H - 8) < 2)), 'нет дороги к воротам замка');

  const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; const W = createWorld(c, mulberry32(5)); W.lv = 45; step(W, 1 / 60, {});
  const M = W.map, Q = M.citadel;
  // стены и ворота
  ok(resolve(M, { x: C.x + H, z: C.z + H * .3 }, .5), 'стена замка не держит');
  { const o = { x: C.x, z: C.z + H }; ok(!resolve(M, o, .5), 'в южных воротах героя не пускает'); }
  { const e = { x: C.x, z: C.z + H - .3 }; ok(blockFoe(M, e, .5) && e.z > C.z + H, 'враг проходит в ворота замка'); }
  ok(campAt(M, C.x, C.z) === Q && insideCamp(Q, C.x + H - 3, C.z + H - 3) && !insideCamp(Q, C.x + H + 3, C.z), 'campAt не видит замок');
  // донжон — дом: вход без загрузки
  { const k = M.buildings.find(b => b.kind === 'keep'); ok(k && insideOf(M, k.x, k.z) >= 0 && W.lvl === 'surface', 'в донжон не войти с поверхности'); }
  // костёр, лечение, ночлег
  { const f = M.fires.find(q => q.id === C.id); ok(f && f.camp && insideCamp(Q, f.x, f.z), 'нет костра во дворе');
    if (f) { const p = W.player; p.x = f.x + 1; p.z = f.z; p.hp = p.maxhp * .3; p.calm = 0; W.inside = -1; for (let i = 0; i < 120; i++) step(W, 1 / 60, {}); ok(p.hp > p.maxhp * .3 + 1, 'костёр замка не лечит'); ok(sleepSpot(W) === 'fire', 'у костра замка не уснуть'); } }
  // враги не рождаются во дворе
  { const c2 = JSON.parse(JSON.stringify(CFG3)); c2.enemies.count = 40; const W2 = createWorld(c2, mulberry32(9)); W2.player.x = C.x; W2.player.z = C.z + 10; for (let i = 0; i < 600; i++) step(W2, 1 / 60, {});
    ok(!W2.enemies.some(q => !q.dead && !q.boss && insideCamp(W2.map.citadel, q.x, q.z, -2)), 'враги рождаются в замке'); }
  // лучшие торговцы: витрина замка лучше лагеря того же уровня, кузнец — 3-я ступень
  { const at = (vil, kind) => { const b = M.buildings.find(q => q.vil === vil && q.npc && q.npc.kind === kind); W.player.x = b.npc.x + 1; W.player.z = b.npc.z; step(W, 1 / 60, {}); };
    const rar = sh => { const g = sh.stock.filter(s => BY_ID[s.id].slot); return g.reduce((a, s) => a + BY_ID[s.id].rar, 0) / Math.max(1, g.length); };
    at(C.id, 'merchant'); const sc = shopOf(W), rc = rar(sc); ok(sc !== W.shop && sc.stock.filter(s => BY_ID[s.id].slot).every(s => s.il === D.lv), 'у торговца замка не своя витрина или вещи не его уровня');
    const ow = M.outposts.find(o => o.lv === D.lv); if (ow) { at(ow.id, 'merchant'); const ro = rar(shopOf(W)); ok(rc >= ro - .3, `витрина замка не лучше лагеря ${ow.lv}: ${rc.toFixed(2)} / ${ro.toFixed(2)}`); }
    at(C.id, 'smith'); const ss = smithShop(W); ok(ss && ss.tier === 3, 'кузнец замка не 3-й ступени'); }
}
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log(`Замок Мира 5.0: OK (${C.name}, ${zoneLevel(CFG3, C.x, C.z).toFixed(0)} ур., ${2 * C.H}×${2 * C.H} м)`);
