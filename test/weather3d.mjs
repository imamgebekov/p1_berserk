// Тест погоды 3D (шаг F3): расписание по зерну (повторяемо, разное для разных зёрен), начало — ясно, бывают все три вида
// в долях около весов, переходы плавные; действие погоды: дождь гуще туман, темнее земля, тише птицы, меньше света;
// ясно — без изменений; птицы молчат в дождь (mixOf), шум дождя не слышен под землёй.
import { CFG3 } from '../3d/src/config3d.js';
import { makeWeather, weatherAt, effectsOf } from '../3d/src/weather3d.js';
import { createWorld, mulberry32 } from '../3d/src/sim.js';
import { mixOf } from '../3d/src/soundscape3d.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const C = CFG3.weather;

// ---------- 1. расписание ----------
const S = makeWeather(CFG3.world.seed, C);
ok(JSON.stringify(S) === JSON.stringify(makeWeather(CFG3.world.seed, C)) && JSON.stringify(S) !== JSON.stringify(makeWeather(CFG3.world.seed + 1, C)), 'расписание не повторяется или не зависит от зерна');
for (let sd = 1; sd <= 20; sd++) { const Q = makeWeather(sd, C); ok(Q.segs[0].kind === 'clear' && weatherAt(Q, 0, C).rain === 0 && weatherAt(Q, 0, C).cloud === 0, 'игра начинается не с ясной погоды (зерно ' + sd + ')'); }
ok(S.segs.every(s => { const [, a, b] = C.kinds[s.kind]; return s.t1 - s.t0 >= a - 1e-9 && s.t1 - s.t0 <= b + 1e-9; }), 'кусок погоды вне своей длины');
{ const share = { clear: 0, cloudy: 0, rain: 0 }; for (let t = 0; t < S.total; t += 1) share[weatherAt(S, t, C).kind]++;
  const tot = Object.values(C.kinds).reduce((s, k) => s + k[0] * (k[1] + k[2]) / 2, 0);
  for (const k of Object.keys(share)) { const want = C.kinds[k][0] * (C.kinds[k][1] + C.kinds[k][2]) / 2 / tot, got = share[k] / Math.floor(S.total); ok(Math.abs(got - want) < .15, `доля «${k}» ${got.toFixed(2)} вместо ~${want.toFixed(2)}`); } }
{ let jump = 0, prev = weatherAt(S, 0, C); for (let t = .5; t < S.total * 2; t += .5) { const w = weatherAt(S, t, C); jump = Math.max(jump, Math.abs(w.rain - prev.rain), Math.abs(w.cloud - prev.cloud)); prev = w; }
  ok(jump < .1, 'погода меняется скачком: ' + jump.toFixed(3)); }

// ---------- 2. действие погоды ----------
const E0 = effectsOf({ rain: 0, cloud: 0 }, C), E1 = effectsOf({ rain: 1, cloud: 1 }, C);
ok(E0.fog === 1 && E0.light === 1 && E0.wet === 1 && E0.birds === 1 && E0.drops === 0, 'ясная погода что-то меняет');
ok(E1.fog > 1.5 && E1.light < .3 && E1.wet < .9 && E1.birds === 0 && E1.drops === C.drops, 'дождь не меняет туман, свет, землю или птиц: ' + JSON.stringify(E1));
ok(effectsOf(null, C).drops === 0, 'без погоды идут капли');

// ---------- 3. звук ----------
{ const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.bosses.list = []; c.events.on = false; c.wanderer.on = false;
  const W = createWorld(c, mulberry32(1)), A = CFG3.audio; W.player.x = 40; W.player.z = 40; W.light = 1; W.night = false;
  const dry = mixOf(W, A, { wind: .3, trees: .5, rain: 0 }), wet = mixOf(W, A, { wind: .3, trees: .5, rain: 1 });
  ok(dry.birds > .9 && wet.birds === 0, 'в дождь поют птицы');
  ok(dry.rain === 0 && wet.rain === 1, 'нет уровня шума дождя');
  W.lvl = 'crypt'; ok(mixOf(W, A, { wind: .3, trees: .5, rain: 1 }).rain === 0, 'дождь слышен под землёй'); }

if (fails.length) { console.log('ПРОВАЛ:\n' + [...new Set(fails)].join('\n')); process.exit(1); }
console.log('Погода 3D: OK');
