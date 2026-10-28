// Бьющиеся бочки, ящики, кувшины (план физики, этап 4): стоят в залах подземелий (не в коридорах, не в ключевых залах, не у проходов),
// твёрдые; бьются с запаса ударов (тяжёлый — за два), разбитый не твёрдый, внутри пепел; удар героя в бою разбивает; при возвращении
// на уровень после dungeons.respawnAway снова целы; выключено (phys.brk.on: false) — их нет.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32 } from '../3d/src/sim.js';
import { travel } from '../3d/src/levels3d.js';
import { resolve } from '../3d/src/map.js';
import { smashArc, resetBrk } from '../3d/src/brk3d.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const B = CFG3.phys.brk;
const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.events.on = false; c.wanderer.on = false;
const W = createWorld(c, mulberry32(11));
const lv = Object.values(W.levels).filter(L => L.map.brk && L.map.brk.length), all = lv.flatMap(L => L.map.brk.map(b => ({ b, L })));
ok(lv.length >= 5 && all.length >= 20, `мало бьющихся предметов: уровней ${lv.length}, предметов ${all.length}`);
// 1. где стоят: в зале-комнате (не коридор, не ключевой), не у прохода, твёрдые
{ let bad = 0, near = 0, solid = 0;
  for (const { b, L } of all) {
    const r = L.map.rooms.find(q => b.x > q.x0 && b.x < q.x1 && b.z > q.z0 && b.z < q.z1); if (!r || r.corridor || r.kind) bad++;
    if ((L.map.links || []).some(l => Math.hypot(l.x - b.x, l.z - b.z) < B.linkGap)) near++;
    const R = r ? { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 } : { x: b.x + 1, z: b.z }, ux = (R.x - b.x) / (Math.hypot(R.x - b.x, R.z - b.z) || 1), uz = (R.z - b.z) / (Math.hypot(R.x - b.x, R.z - b.z) || 1), o = { x: b.x + ux * .05, z: b.z + uz * .05 }; resolve(L.map, o, .4); if (Math.hypot(o.x - b.x, o.z - b.z) >= b.r + .4 - 1e-6) solid++;     // толкаем к середине зала: у стены стена толкает обратно
  }
  ok(!bad, `не в зале-комнате: ${bad}`); ok(!near, `у прохода: ${near}`); ok(solid === all.length, `не твёрдые: ${all.length - solid}`); }
// 2. удар: запас ударов, тяжёлый — за два; разбитый — не твёрдый, событие smash, пепел
{ const { b, L } = all.find(q => q.b.t === 'crate'); W.map = L.map; W.ev.length = 0; const ash0 = W.inv.ash, x = b.x, z = b.z - 1.2;
  smashArc(W, x, z, 0, .8, 1.6, false); ok(!b.gone && b.hp === b.max - 1, 'ящик разбит с одного удара');
  smashArc(W, x, z, Math.PI, .8, 1.6, false); ok(b.hp === b.max - 1, 'удар спиной к ящику его задел');
  smashArc(W, x, z, 0, .8, 1.6, false); ok(b.gone && W.ev.some(v => v.k === 'smash' && v.i === b.i), 'ящик не разбит вторым ударом');
  ok(W.inv.ash >= ash0 + B.ash[0], `пепла в ящике нет: ${W.inv.ash - ash0}`);
  const o = { x: b.x + .05, z: b.z }; resolve(L.map, o, .4); ok(Math.hypot(o.x - b.x - .05, o.z - b.z) < 1e-6, 'разбитый ящик остался твёрдым');
  const h = all.find(q => q.b.t === 'barrel' && q.L === L) || all.find(q => q.b.t === 'barrel'); W.map = h.L.map; smashArc(W, h.b.x, h.b.z - 1.2, 0, .8, 1.6, true); ok(h.b.gone, 'тяжёлый удар не разбил бочку сразу');
  resetBrk(L.map); resetBrk(h.L.map); ok(!b.gone && b.hp === b.max && !L.map.solids[b.si].gone && !h.b.gone, 'resetBrk не вернул целыми'); }
// 3. в бою: герой бьёт ящик ударом по кнопке; уход с уровня и возврат после respawnAway — снова цел
{ const { b, L } = all.find(q => q.b.t === 'jar') || all[0], id = Object.keys(W.levels).find(k => W.levels[k] === L);
  travel(W, id, b.x, b.z - 1.3); step(W, 1 / 60, {}); const p = W.player; p.x = b.x; p.z = b.z - 1.3; p.face = 0; p.hp = p.maxhp = 1e6;
  for (let i = 0; i < 60 && !b.gone; i++) step(W, 1 / 60, { attackPress: i % 30 === 0, aimPt: { x: b.x, z: b.z } });
  ok(b.gone, 'удар героя не разбил кувшин');
  travel(W, 'surface', 0, 0); W.t += c.dungeons.respawnAway + 1; travel(W, id, b.x, b.z - 2); ok(!b.gone, 'после возвращения кувшин не цел'); }
// 4. выключено — предметов нет
{ const c2 = JSON.parse(JSON.stringify(c)); c2.phys.brk.on = false; const W2 = createWorld(c2, mulberry32(11)); ok(Object.values(W2.levels).every(L => !L.map.brk || !L.map.brk.length), 'выключено, а предметы есть'); }

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log(`Бьющиеся предметы 3D: OK (${all.length} на ${lv.length} уровнях)`);
