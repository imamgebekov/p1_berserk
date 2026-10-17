// Тест спокойного мира 3D (шаг G1): наверху враги появляются стайками по 2–4 вне экрана (дальше ring[0] м) и бродят по маршруту;
// стоящего героя слышат ближе, бегущего — дальше, скрытность глушит слух; ушедшие далеко стайки забываются. Бот бежит 2 минуты
// по большому миру: тревоги и стычек заметно меньше, чем при прежнем напоре; ночью врагов больше, чем днём. Ядро — без стаек.
import { CFG3, CORE3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnEnemy, refreshGear } from '../3d/src/sim.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const R = CFG3.enemies.roam;
const mk = (seed, tweak) => { const c = JSON.parse(JSON.stringify(CFG3)); c.events.on = false; c.wanderer.on = false; c.bosses.list = []; if (tweak) tweak(c); return createWorld(c, mulberry32(seed)); };

// ---------- 1. стайки вне экрана ----------
ok(R.on && !CORE3.enemies.roam.on, 'стайки выключены в мире или включены в ядре');
for (let s = 1; s <= 4; s++) {
  const W = mk(s), p = W.player; p.x = 210 * Math.sin(s); p.z = 210 * Math.cos(s); const seen = new Set();
  for (let i = 0; i < 60 * 20; i++) {
    p.inv = 1e9; step(W, 1 / 60, {});
    const born = W.enemies.filter(e => !seen.has(e.id)); born.forEach(e => seen.add(e.id));
    const packs = born.filter(e => e.pack);
    if (packs.length) ok(packs.length >= R.pack[0] && packs.length <= R.pack[1], `зерно ${s}: в стайке ${packs.length}`);
    for (const e of packs) { ok(e.mode === 'patrol', 'стайка не патрулирует'); ok(Math.hypot(e.x - p.x, e.z - p.z) > R.ring[0] - 4, `зерно ${s}: стайка родилась у героя: ${Math.hypot(e.x - p.x, e.z - p.z).toFixed(0)} м`); }
  }
  ok(W.enemies.some(e => e.pack), `зерно ${s}: стаек нет`);
  // ушёл далеко — стайки забываются
  p.x = -p.x; p.z = -p.z; step(W, 1 / 60, {});
  ok(!W.enemies.some(e => e.pack && Math.hypot(e.x - p.x, e.z - p.z) > CFG3.enemies.sleep.drop), `зерно ${s}: дальние стайки не забылись`);
}

// ---------- 2. слух стайки: стоит — тише, бежит — громче, скрытность глушит ----------
{
  const D = 8.8;                                                    // бег слышно за hear (10) м, стоя — за 5,5 м, с «Тихим шагом» 4 — за 7,6 м
  const hears = (move, sneak) => {
    const W = mk(9, c => { c.enemies.count = 0; c.enemies.posts.range = 0; c.enemies.posts.patrolSpeed = 0; }), p = W.player;     // зрение выключено, враг стоит: проверяем только слух
    if (sneak) { W.skills.sneak = 4; refreshGear(W); }
    p.x = 230; p.z = 0; const e = spawnEnemy(W, 'imp', 230 + D, 0, 'patrol'); e.pack = true;
    for (let i = 0; i < 60 * 3; i++) {
      p.inv = 1e9; const a = i / 60 * .3;
      if (move) { const tx = e.x - Math.cos(a) * D, tz = e.z - Math.sin(a) * D, d = Math.hypot(tx - p.x, tz - p.z) || 1; step(W, 1 / 60, { mx: (tx - p.x) / d, mz: (tz - p.z) / d }); }
      else step(W, 1 / 60, {});
      if (e.alert) return true;
    }
    return false;
  };
  ok(!hears(false, false), `стоящего героя услышали за ${D} м`);
  ok(hears(true, false), `бегущего героя не услышали за ${D} м`);
  ok(!hears(true, true), 'скрытность не глушит слух стайки');
}

// ---------- 3. две минуты бега: стычек мало, ночью врагов больше ----------
function trip(seed, night, roam) {
  const W = mk(seed, c => { c.enemies.roam.on = roam; }), p = W.player; if (night) W.t = 200;
  const a0 = seed * 1.7; p.x = Math.sin(a0) * 200; p.z = Math.cos(a0) * 200; let dir = a0 + 2.2, alarm = 0, enc = 0, calm = 9, alive = 0;
  for (let i = 0; i < 60 * 120; i++) {
    p.inv = 1e9; p.hp = p.maxhp;
    if (Math.hypot(p.x, p.z) > 520) dir += Math.PI * .8;
    if (i % 600 === 0) dir += (seed % 3 - 1) * .5;
    const near = W.enemies.some(e => !e.dead && e.alert && Math.hypot(e.x - p.x, e.z - p.z) < 20);
    if (near) alarm += 1 / 60; if (near && calm > 3) enc++; calm = near ? 0 : calm + 1 / 60;     // новая стычка — после 3 с покоя
    if (i === 60 * 60) alive = W.enemies.filter(e => !e.dead && Math.hypot(e.x - p.x, e.z - p.z) < CFG3.enemies.sleep.r).length;
    step(W, 1 / 60, { mx: Math.sin(dir), mz: Math.cos(dir) });
  }
  return { alarm, enc, alive };
}
const avg = (night, roam, n) => { const o = { alarm: 0, enc: 0, alive: 0 }; for (let s = 1; s <= n; s++) { const r = trip(s, night, roam); for (const k in o) o[k] += r[k] / n; } return o; };
const day = avg(false, true, 4), nightR = avg(true, true, 4), old = avg(false, false, 2);
console.log(`день: тревога ${day.alarm.toFixed(0)} с, стычек ${day.enc.toFixed(1)}, врагов рядом ${day.alive.toFixed(1)}`);
console.log(`ночь: тревога ${nightR.alarm.toFixed(0)} с, стычек ${nightR.enc.toFixed(1)}, врагов рядом ${nightR.alive.toFixed(1)}`);
console.log(`прежний напор: тревога ${old.alarm.toFixed(0)} с, стычек ${old.enc.toFixed(1)}`);
ok(day.enc >= 1 && day.enc <= 5, 'днём стычек не 1–5 за 2 минуты: ' + day.enc.toFixed(1));
ok(day.alarm < old.alarm * .4, `тревоги не меньше прежнего: ${day.alarm.toFixed(0)} с против ${old.alarm.toFixed(0)} с`);
ok(nightR.alive > day.alive, 'ночью врагов не больше, чем днём');

if (fails.length) { console.log('ПРОВАЛ:\n' + [...new Set(fails)].join('\n')); process.exit(1); }
console.log('Спокойный мир 3D: OK');
