// Тест боссов 3D: появление, агро, предупреждения и атаки, фазы, ярость, иммунитеты, возврат, добыча, возрождение, сохранение.
import { CFG3 } from '../3d/src/config3d.js';
import { BY_ID } from '../3d/src/data/items.js';
import { createWorld, step, mulberry32, spawnEnemy, hireAlly, restoreBosses, respawnPlayer, aliveEnemies } from '../3d/src/sim.js';
import { applyStatus } from '../3d/src/status3d.js';
import { placeAt, insideOf } from '../3d/src/map.js';
import { createSaver, loadSave } from '../3d/src/save3d.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const mk = (seed = 1) => { const cfg = JSON.parse(JSON.stringify(CFG3)); cfg.enemies.count = 0; cfg.player.autoAim = 0; cfg.player.hp = 100000; return createWorld(cfg, mulberry32(seed)); };
const run = (W, sec, inp = {}) => { for (let i = 0; i < Math.round(sec * 60); i++) step(W, 1 / 60, inp); };
const boss = (W, type) => W.enemies.find(e => e.boss && e.type === type);
const goto = (W, e, dx, dz = 0) => { W.player.x = e.x + dx; W.player.z = e.z + dz; W.player.inv = 0; W.player.hp = W.player.maxhp; };

// данные и появление
{ const W = mk(); const L = CFG3.bosses.list; ok(L.length === 3, 'три босса');
  for (const def of L) { const e = boss(W, def.type), C = CFG3.enemies[def.type]; ok(e && e.hp === C.hp && e.maxhp === C.hp && e.dmgMul === 1, 'босс не появился или здоровье не из конфига: ' + def.type); ok(C.boss && C.heavy && C.name && C.hp >= 2000, 'тип босса: ' + def.type);
    const pl = placeAt(W.map, def.x, def.z); ok(pl && pl.danger >= 2, `логово ${def.type} не в опасной зоне`); ok(insideOf(W.map, def.x, def.z) === -1, 'логово в доме');
    ok(!W.map.solids.some(s => Math.hypot(s.x - e.x, s.z - e.z) < s.r + C.radius - .05), `босс ${def.type} застрял в препятствии`); ok(!W.map.walls.some(w => { const cx = Math.max(w.x0, Math.min(w.x1, e.x)), cz = Math.max(w.z0, Math.min(w.z1, e.z)); return Math.hypot(e.x - cx, e.z - cz) < C.radius - .05; }), `босс ${def.type} застрял в стене`); }
  ok(L.every((d, i) => L.every((o, j) => i === j || Math.hypot(d.x - o.x, d.z - o.z) > 40)), 'логова слишком близко'); }
// иммунитеты
{ const W = mk(2); const e = boss(W, 'lord'); ok(!applyStatus(W, e, 'stun', 0, 2) && !applyStatus(W, e, 'freeze', 0, 2) && applyStatus(W, e, 'burn', 5, 3) && applyStatus(W, e, 'bleed', 3, 3), 'иммунитеты Слуги Затмения'); ok(!applyStatus(W, boss(W, 'devourer'), 'stun', 0, 2) && applyStatus(W, boss(W, 'devourer'), 'freeze', 0, 2), 'иммунитеты Пожирателя'); }
// агро только вблизи; не считается в числе обычных врагов
{ const W = mk(3); const e = boss(W, 'devourer'); goto(W, e, 55); run(W, 1); ok(!e.alert && !W.hudBoss, 'босс проснулся далеко'); goto(W, e, 20); run(W, .5); ok(e.alert && W.hudBoss && W.hudBoss.name === CFG3.enemies.devourer.name, 'босс не проснулся вблизи');
  const W2 = mk(4); W2.cfg.enemies.count = 2; W2.player.x = -75; W2.player.z = 10; W2.player.inv = 1e9; run(W2, 20); ok(aliveEnemies(W2).filter(x => !x.boss).length === 2, 'боссы занимают места обычных врагов'); }
// предупреждение перед ударом: до конца предупреждения урона нет, после есть; перекат спасает
{ const W = mk(5); const e = boss(W, 'devourer'); goto(W, e, 4); e.alert = true; e.b.cd = 0; const hp0 = W.player.hp; let wind = false, tele = null;
  for (let i = 0; i < 60 * 4; i++) { step(W, 1 / 60, {}); if (e.b.state === 'wind' && !tele) tele = { ...e.b.atk }; if (e.b.state === 'wind') { wind = true; ok(W.player.hp === hp0, 'урон во время предупреждения'); } if (wind && e.b.state !== 'wind') break; }
  ok(tele && tele.kind === 'slam' && tele.r >= 4, 'нет предупреждения (круг)'); ok(W.player.hp < hp0, 'удар босса не нанёс урон'); 
  const W2 = mk(6); const e2 = boss(W2, 'devourer'); goto(W2, e2, 4); e2.alert = true; e2.b.cd = 0; W2.player.x = e2.x + 3; const h2 = W2.player.hp;
  for (let i = 0; i < 60 * 3 && e2.b.state !== 'wind'; i++) step(W2, 1 / 60, {});
  while (e2.b.state === 'wind' && e2.b.atk.t < e2.b.atk.wind - .12) step(W2, 1 / 60, {});
  W2.player.rollCd = 0; step(W2, 1 / 60, { mx: 1, roll: true }); run(W2, .3); ok(W2.player.hp === h2 || h2 - W2.player.hp < 1, 'перекат в окне удара не спас'); }
// круг бьёт и союзников
{ const W = mk(7); W.lv = 10; W.nearNpc = 'captain'; const b = W.map.buildings.find(x => x.npc && x.npc.kind === 'captain'); W.player.x = b.npc.x + 1; W.player.z = b.npc.z; W.inv.ash = 1e5; step(W, 1 / 60, {}); hireAlly(W, 'soldier');
  const e = boss(W, 'devourer'); goto(W, e, 4); const al = W.allies[0]; al.x = e.x - 3; al.z = e.z; al.hp = al.maxhp; e.alert = true; e.b.cd = 0; const hp = al.hp; run(W, 3); ok(al.hp < hp || al.dead, 'удар по земле не задел союзника'); }
// рывок Слуги Затмения: движется по линии и бьёт один раз; донат «кольца» не задевает близких
{ const W = mk(8); const e = boss(W, 'lord'); goto(W, e, 11, 0); e.alert = true; e.b.cd = 0; e.b.last = -1; for (const k of Object.keys(e.b.cds)) delete e.b.cds[k];
  e.b.def = { ...e.b.def, attacks: [e.b.def.attacks[0]] }; const x0 = e.x, hp0 = W.player.hp; let hits = 0, lastHp = hp0;
  for (let i = 0; i < 60 * 3; i++) { step(W, 1 / 60, {}); if (W.player.hp < lastHp) { hits++; lastHp = W.player.hp; } }
  ok(Math.abs(e.x - x0) > 5, 'рывок не сдвинул босса: ' + (e.x - x0)); ok(hits >= 1, 'рывок не ударил героя'); }
{ const nova = dist => { const W = mk(9); const e = boss(W, 'lord'); e.b.def = { ...e.b.def, attacks: [e.b.def.attacks[1]] }; goto(W, e, dist); e.alert = true; e.b.cd = 0; const h = W.player.hp; for (let i = 0; i < 60 * 3; i++) { step(W, 1 / 60, {}); W.player.x = e.x + dist; W.player.z = e.z; } return h - W.player.hp; };
  ok(nova(1.5) === 0 && nova(5) > 20, `кольцо: внутри ${nova(1.5)}, на кольце ${nova(5)}`); }
// фазы: подмога по порогам здоровья, ярость
{ const W = mk(10); const e = boss(W, 'devourer'); goto(W, e, 15); e.alert = true; e.hp = e.maxhp * .6; run(W, .3); const n1 = W.enemies.filter(x => !x.boss && !x.dead).length; ok(n1 === 2 && e.b.done.has(0), 'подмога на 66%: ' + n1);
  run(W, .3); ok(W.enemies.filter(x => !x.boss && !x.dead).length === 2, 'подмога вызвана дважды'); e.hp = e.maxhp * .3; run(W, .3); ok(e.b.done.has(1), 'вторая фаза'); e.hp = e.maxhp * .25; run(W, .3); ok(e.b.enraged, 'нет ярости');
  const cap = CFG3.bosses.minionCap; ok(W.enemies.filter(x => !x.boss && !x.dead).length <= cap, 'подмога выше лимита'); }
// ярость делает босса быстрее и злее
{ const dmg = enr => { const W = mk(11); const e = boss(W, 'devourer'); goto(W, e, 4); e.alert = true; if (enr) e.b.enraged = true; e.b.cd = 0; const h = W.player.hp; for (let i = 0; i < 60 * 2.5 && W.player.hp === h; i++) step(W, 1 / 60, {}); return h - W.player.hp; }; ok(dmg(true) > dmg(false) * 1.1, 'ярость не усиливает урон'); }
// возврат в логово и лечение
{ const W = mk(12); const e = boss(W, 'chief'); goto(W, e, 15); e.alert = true; run(W, 2); e.hp = e.maxhp * .5; W.player.x = -75; W.player.z = 10; e.x += 12; e.z += 3; run(W, 12); ok(Math.hypot(e.x - e.b.home.x, e.z - e.b.home.z) < 2.5 && e.hp > e.maxhp * .8 && !e.alert, `босс не вернулся и не вылечился: ${e.hp}/${e.maxhp}`); }
// тяжёлый: удар не прерывает предупреждение
{ const W = mk(13); const e = boss(W, 'devourer'); goto(W, e, 4); W.inv.eq.weapon = 'w_sword_iron'; W.player.face = Math.atan2(e.x - W.player.x, e.z - W.player.z); e.alert = true; e.b.cd = 0; for (let i = 0; i < 200 && e.b.state !== 'wind'; i++) step(W, 1 / 60, {}); const st = e.b.state; for (let i = 0; i < 20; i++) step(W, 1 / 60, { attack: true }); ok(st === 'wind' && (e.b.state === 'wind' || e.b.state === 'rec'), 'удар сбил предупреждение босса'); }
// смерть: уникальный клинок, ключ, опыт; возрождение по таймеру; сохранение
{ const W = mk(14); const e = boss(W, 'chief'); goto(W, e, 3); e.alert = true; const xp0 = W.xp + (W.lv - 1) * 1e5; e.hp = 1; W.inv.eq.weapon = 'w_sword_iron'; W.player.face = Math.atan2(e.x - W.player.x, e.z - W.player.z); run(W, 1.2, { attack: true });
  ok(e.dead, 'босс не умер'); const got = W.drops.map(d => d.id).concat(W.inv.bag.map(s => s.id)); ok(got.includes('m_chief_fang') && got.includes('tome_set_rust'), 'нет трофея или книги босса: ' + got); ok(!got.some(id => id.startsWith('wu_') || id.startsWith('as_')), 'готовая именная вещь выпала'); ok(got.includes('key_black'), 'нет чёрного ключа'); ok(got.length >= 4, 'мало добычи: ' + got.length);
  ok(W.xp + (W.lv - 1) * 1e5 - xp0 >= 1000, 'опыт за босса'); ok(W.bossDead.chief > 590 && !W.hudBoss, 'таймер возрождения');
  const mem = {}, st = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; }, removeItem: k => { delete mem[k]; } }; createSaver(W, st).write(true); const l = loadSave(30, st); ok(l.bosses.chief > 500, 'таймер босса не сохранился');
  const W2 = mk(15); restoreBosses(W2, l.bosses); ok(boss(W2, 'chief').dead && boss(W2, 'devourer') && !boss(W2, 'devourer').dead, 'после загрузки убитый босс жив'); restoreBosses(W2, { chief: NaN, lord: -5, x: 'y' }); ok(!boss(W2, 'lord').dead, 'мусор в сохранении убил босса');
  W2.player.x = 0; W2.player.z = 6; W2.player.inv = 1e9; run(W2, 6); ok(W2.bossDead.chief < W2.cfg.bosses.respawn, 'таймер не идёт'); W2.bossDead.chief = .5; run(W2, 1); const nb = W2.enemies.find(x => x.boss && x.type === 'chief' && !x.dead); ok(nb && nb.hp === CFG3.enemies.chief.hp && W2.bossDead.chief === undefined, 'босс не возродился с полным здоровьем'); }
// возрождение героя не убирает живых боссов
{ const W = mk(16); W.player.x = 0; W.player.z = 6; W.player.hp = 0; W.player.dead = true; respawnPlayer(W); ok(W.enemies.filter(e => e.boss && !e.dead).length === 3, 'возрождение убрало боссов'); }
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Боссы 3D: OK');
