// Г7 «Живые спутники» (4.13): навык бота от номера (без генератора боя), реакция на круги атак с задержкой по навыку,
// места вокруг цели, умения ролей (стена щитов, круговой и мощный удар, залп, общее лечение, оберег), реплики, застрявший — к герою.
import { CORE3 as CFG3 } from '../3d/src/config3d.js';
CFG3.terrain.on = false;
import { createWorld, step, mulberry32, spawnEnemy } from '../3d/src/sim.js';
import { spawnAlly, skillOf } from '../3d/src/squad3d.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const mk = (seed = 1, hero = 'vale', lv = 20) => { const cfg = JSON.parse(JSON.stringify(CFG3)); cfg.enemies.count = 0; cfg.map.places = []; cfg.bosses.list = []; cfg.squad.gear.on = false; const W = createWorld(cfg, mulberry32(seed), hero); W.lv = lv; return W; };
const run = (W, sec, inp = {}, each) => { for (let i = 0; i < Math.round(sec * 60); i++) { step(W, 1 / 60, inp); if (each) each(); W.ev.length = 0; } };
const foe = (W, type, dx, dz, hp = 1e5) => { const e = spawnEnemy(W, type, W.player.x + dx, W.player.z + dz); e.hp = e.maxhp = hp; e.alert = true; return e; };
const L = CFG3.squad.live;

// навык: в пределах, у разных ботов разный, у одного и того же — тот же
{ const W = mk(1); const s = []; for (let i = 0; i < 8; i++) s.push(skillOf(W, spawnAlly(W, 'c_vale')));
  ok(s.every(k => k >= L.skill[0] && k <= L.skill[1]), 'навык вне пределов: ' + s.map(k => k.toFixed(2)).join(' '));
  ok(new Set(s.map(k => k.toFixed(3))).size >= 5, 'навык у всех одинаковый');
  const W2 = mk(1); const s2 = []; for (let i = 0; i < 8; i++) s2.push(skillOf(W2, spawnAlly(W2, 'c_vale'))); ok(s.join() === s2.join(), 'навык не повторяется от зерна'); }
// круг атаки: бот уходит; ловкий — раньше неловкого
{ const out = [];
  for (const sk of [L.skill[1], L.skill[0]]) { const W = mk(2); const a = spawnAlly(W, 'c_vale'); a.skill = sk; a.x = W.player.x + 4; a.z = W.player.z; run(W, 3);     // встал в строй
    W.haz.push({ x: a.x, z: a.z, r: 2, t: 0, delay: 1.2, dmg: 1, on: null, by: 99 }); const x0 = a.x, z0 = a.z; let t = 0, moved = -1;
    run(W, 1.1, {}, () => { t += 1 / 60; if (moved < 0 && Math.hypot(a.x - x0, a.z - z0) > .3) moved = t; }); out.push(moved); }
  ok(out[0] > 0 && out[1] > 0, 'бот не уходит из круга атаки: ' + out.join(' / '));
  ok(out[0] < out[1], `ловкий не быстрее неловкого: ${out[0].toFixed(2)} против ${out[1].toFixed(2)} с`); }
// боец: круговой удар по двум врагам рядом
{ const W = mk(3); const a = spawnAlly(W, 'c_vale'); const e1 = foe(W, 'brute', 2, 2), e2 = foe(W, 'brute', 2.8, 2.6); a.x = e1.x - 1.2; a.z = e1.z; e1.cd = e2.cd = 99;
  let cl = 0; run(W, 3, {}, () => { cl += W.ev.filter(v => v.k === 'allySkill' && v.s === 'cleave').length; a.hp = a.maxhp; }); ok(cl >= 1, 'боец не делает круговой удар'); }
// лекарь: общее лечение, когда ранены двое
{ const W = mk(4); const h = spawnAlly(W, 'c_irga'), v = spawnAlly(W, 'c_vale'); h.x = W.player.x + 2; v.x = W.player.x - 2; run(W, .05); W.player.hp = W.player.maxhp * .5; v.hp = v.maxhp * .5;
  let g = 0; run(W, 1.5, {}, () => { g += W.ev.filter(x => x.k === 'allySay' && x.kind === 'gheal').length; });
  ok(W.player.hp > W.player.maxhp * .6 && v.hp > v.maxhp * .6, 'общее лечение не сработало'); }
// защитник: стена щитов при низком здоровье — урон меньше
{ const W = mk(5); const t = spawnAlly(W, 'c_thorn'); const e = foe(W, 'brute', 3, 0); t.x = e.x - 1.5; t.z = e.z; t.hp = t.maxhp * .4; run(W, .5); ok(t.wallT > 0 || t.k1 > 0, 'защитник не поднял стену щитов'); }
// реплики: есть, не чаще общей паузы
{ const W = mk(6); const a = spawnAlly(W, 'c_vale'); a.x = W.player.x + 4; let n = 0, last = -99, tooFast = false;
  run(W, 20, {}, () => { if (W.t - (W._h || 0) > 1.3) { W.haz.push({ x: a.x, z: a.z, r: 2, t: 0, delay: 1.2, dmg: 1, on: null, by: 99 }); W._h = W.t; }
    for (const v of W.ev) if (v.k === 'allySay') { n++; if (W.t - last < L.say.gcd - .01) tooFast = true; last = W.t; } a.hp = a.maxhp; });
  ok(n >= 1, 'реплик нет'); ok(!tooFast, 'реплики чаще общей паузы'); }
// застрял: далеко от героя и не двигается — переносится к герою
{ const W = mk(7); const a = spawnAlly(W, 'c_vale'); W.cfg.squad.types.c_vale.speed = 0; a.x = W.player.x + 20; a.z = W.player.z;     // ноги «в нише»: стоит на месте
  let jumped = false; run(W, L.stuck[0] + 1, {}, () => { if (Math.hypot(a.x - W.player.x, a.z - W.player.z) < 4) jumped = true; }); ok(jumped, 'застрявший бот не вернулся к герою'); }

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Живые спутники 3D: OK');
