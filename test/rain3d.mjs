// Тест дождя в бою 3D (шаг R): сила дождя берётся из расписания погоды, начало и конец — события; в дождь враги слышат и видят
// хуже, огонь поджигает реже и короче (и героя тоже), «Гроза» срабатывает чаще; в ядре для тестов баланса дождь на бой не влияет.
import { CFG3, CORE3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnEnemy, refreshGear } from '../3d/src/sim.js';
import { applyStatus, applyPlayer, rainK } from '../3d/src/status3d.js';
import { makeWeather } from '../3d/src/weather3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const RC = CFG3.weather.combat;
const mk = (rain, tweak, base = CFG3) => { const c = JSON.parse(JSON.stringify(base)); c.events.on = false; c.wanderer.on = false; c.enemies.count = 0; c.bosses.list = []; c.enemies.roam.on = false; c.weather.force = rain === null ? null : rain ? 'rain' : 'clear'; if (tweak) tweak(c);
  if (c.map) { c.map.outposts = []; c.map.citadel = null; }     // Мир 5.0: у (300, 0) — Застава Ольхи; бой — в чистом поле
  const W = createWorld(c, mulberry32(4)), P = W.map.cfg.places || []; let at = { x: 300, z: 0 };     // чистое поле у (300, 0): без мест и домов на 45 м (раскладка мира меняется)
  for (let r = 0; r < 400 && (P.some(q => Math.hypot(q.x - at.x, q.z - at.z) < (q.r || 8) + 45) || W.map.buildings.some(b => Math.hypot(b.x - at.x, b.z - at.z) < 45)); r += 10) at = { x: 300 + r * Math.cos(r * .37), z: r * Math.sin(r * .37) };
  W.player.x = at.x; W.player.z = at.z; W.player.inv = 1e9; step(W, 1 / 60, {}); return W; };

// ---------- 1. сила дождя и события ----------
{ const W = mk(null), S = makeWeather(CFG3.world.seed, CFG3.weather), seg = S.segs.find(s => s.kind === 'rain' && s.t1 - s.t0 > 40);
  W.t = seg.t0 - 30; W.ev.length = 0; let starts = 0, stops = 0, peak = 0;
  for (let i = 0; i < (seg.t1 - seg.t0 + 60) * 4; i++) { step(W, .25, {}); peak = Math.max(peak, W.rain); starts += W.ev.filter(v => v.k === 'rainStart').length; stops += W.ev.filter(v => v.k === 'rainStop').length; W.ev.length = 0; }
  ok(peak > .99 && starts === 1 && stops === 1, `дождь не по расписанию или события не по разу: сила ${peak.toFixed(2)}, начал ${starts}, кончился ${stops}`);
  ok(mk(true).rain === 1 && mk(false).rain === 0, 'принудительная погода не работает');
  ok(mk(true, null, CORE3).rain === 0, 'в ядре для баланса дождь влияет на бой'); }

// ---------- 2. слух и зрение ----------
const hears = rain => { const W = mk(rain, c => { c.enemies.posts.range = 0; c.enemies.posts.patrolSpeed = 0; }), p = W.player, D = 8.8;
  const e = spawnEnemy(W, 'imp', p.x + D, p.z, 'patrol'); e.pack = true;
  for (let i = 0; i < 60 * 3; i++) { const a = i / 60 * .3, tx = e.x - Math.cos(a) * D, tz = e.z - Math.sin(a) * D, d = Math.hypot(tx - p.x, tz - p.z) || 1; step(W, 1 / 60, { mx: (tx - p.x) / d, mz: (tz - p.z) / d }); if (e.alert) return true; }
  return false; };
ok(hears(false) && !hears(true), 'в дождь стайка слышит бегущего героя так же, как в ясную погоду');
const sees = rain => { const W = mk(rain, c => { c.enemies.posts.patrolSpeed = 0; }), p = W.player, e = spawnEnemy(W, 'imp', p.x, p.z + 13, 'guard'); e.face = Math.PI;
  for (let i = 0; i < 60 * 2; i++) { step(W, 1 / 60, {}); e.face = Math.atan2(p.x - e.x, p.z - e.z); if (e.alert) return true; } return false; };
ok(sees(false) && !sees(true), 'в дождь сторож видит героя за 13 м так же, как в ясную погоду');

// ---------- 3. огонь и гроза ----------
{ const dry = mk(false), wet = mk(true), a = spawnEnemy(dry, 'brute', 310, 0), b = spawnEnemy(wet, 'brute', 310, 0);
  applyStatus(dry, a, 'burn', 4, 4); applyStatus(wet, b, 'burn', 4, 4);
  ok(Math.abs(b.st.burn.t - a.st.burn.t * RC.fire) < 1e-9, `поджог в дождь не короче: ${b.st.burn.t} против ${a.st.burn.t}`);
  applyPlayer(dry, 'burn', 3, 4); applyPlayer(wet, 'burn', 3, 4); ok(wet.pst.burn.t < dry.pst.burn.t, 'герой в дождь горит так же долго');
  ok(Math.abs(rainK(wet, 'storm') - RC.storm) < 1e-9 && rainK(dry, 'storm') === 1, 'множитель грозы неверный'); }
const proc = (rain, weapon, kind, roll) => { const W = mk(rain), p = W.player; W.inv.eq.weapon = weapon; refreshGear(W); p.face = 0;
  const e = spawnEnemy(W, 'brute', p.x, p.z + 1.4); e.hp = e.maxhp = 1e6; e.cd = 99; const o = spawnEnemy(W, 'brute', p.x + 2, p.z + 2.5); o.hp = o.maxhp = 1e6; o.cd = 99;
  W.rng = () => roll; W.ev.length = 0; let chain = 0; step(W, 1 / 60, { attackPress: true }); for (let i = 0; i < 60; i++) { chain += W.ev.filter(v => v.k === 'chain').length; W.ev.length = 0; step(W, 1 / 60, {}); }
  return kind === 'burn' ? !!(e.st && e.st.burn) : chain > 0; };     // молния перескочила на соседа
ok(proc(false, 'w_sword_steel_fire', 'burn', .3) && !proc(true, 'w_sword_steel_fire', 'burn', .3), 'в дождь огненный клинок поджигает так же часто');
ok(!proc(false, 'w_sword_steel_storm', 'shock', .4) && proc(true, 'w_sword_steel_storm', 'shock', .4), 'в дождь «Гроза» не срабатывает чаще');

if (fails.length) { console.log('ПРОВАЛ:\n' + [...new Set(fails)].join('\n')); process.exit(1); }
console.log('Дождь в бою 3D: OK');
