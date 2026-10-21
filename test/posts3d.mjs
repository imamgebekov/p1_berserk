// Тест сторожей и патрулей 3D (шаг A2): сторож не замечает героя за спиной и за стеной, замечает спереди и на шум боя,
// кричит — встают соседи; патрульный обходит маршрут; погоня ограничена поводком от поста, потеряв — возвращается («?»);
// неслышавший не бредёт к герою; в областях появляются сторожа и патрули, а при modes: false — нет.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnEnemy } from '../3d/src/sim.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const clone = () => JSON.parse(JSON.stringify(CFG3));
const P = CFG3.enemies.posts;
const mk = (seed = 1, tweak) => { const c = clone(); c.enemies.count = 0; c.bosses.list = []; c.map.places = []; if (tweak) tweak(c); const W = createWorld(c, mulberry32(seed)); W.player.x = 46.5; W.player.z = 46.5; /* (40, 40) после растяжения ядра (3.93) */ W.player.hp = W.player.maxhp = 1e6; return W; };
const run = (W, sec, input = {}) => { for (let i = 0; i < Math.round(sec * 60); i++) step(W, 1 / 60, typeof input === 'function' ? input(i) : input); };
const guard = (W, dist, faceToHero, type = 'brute', mode = 'guard') => { const p = W.player, e = spawnEnemy(W, type, p.x, p.z + dist, mode); e.look = e.face = faceToHero ? Math.PI : 0; e.cd = 99; return e; };

// ---------- 1. зрение: за спиной не видит, спереди видит ----------
{
  const W = mk(1); const e = guard(W, 8, false); run(W, 3);
  ok(!e.alert, 'сторож заметил героя за спиной');
  ok(Math.hypot(e.x - e.home.x, e.z - e.home.z) < 1, 'сторож ушёл с поста, не заметив героя');
  const W2 = mk(2); const e2 = guard(W2, 8, true); W2.ev.length = 0; run(W2, .5);
  ok(e2.alert && W2.ev.some(v => v.k === 'spot' && v.id === e2.id), 'сторож не заметил героя прямо перед собой');
  const W3 = mk(3); const e3 = guard(W3, P.range + 3, true); run(W3, 1);
  ok(!e3.alert, 'сторож видит дальше дальности');
}
// ---------- 2. стена закрывает обзор ----------
{
  const c = clone(); c.enemies.count = 0; c.bosses.list = []; c.map.places = [];
  const W = createWorld(c, mulberry32(4)); W.player.hp = W.player.maxhp = 1e6;
  const b = W.map.buildings.find(x => x.kind === 'tavern');
  W.player.x = b.x; W.player.z = b.z1 + 3;                                   // за южной стеной таверны снаружи
  const e = spawnEnemy(W, 'brute', b.x, b.z0 - 3, 'guard'); e.look = e.face = 0; e.cd = 99;   // за северной стеной, смотрит на героя сквозь дом
  run(W, 1.5);
  ok(!e.alert, 'сторож видит сквозь дом');
}
// ---------- 3. слух: только бой ----------
{
  const W = mk(5); const e = guard(W, 10, false); run(W, 2, { mx: .01 });
  ok(!e.alert, 'сторож услышал шаги');
  run(W, 1, i => ({ attackPress: i % 25 === 0 }));
  ok(e.alert, 'сторож не услышал бой за спиной');
}
// ---------- 4. крик тревоги ----------
{
  const W = mk(6); const e = guard(W, 8, true); const n = spawnEnemy(W, 'imp', W.player.x + 6, W.player.z + 12); n.cd = 99;
  const far = spawnEnemy(W, 'imp', W.player.x - 30, W.player.z + 8, 'guard'); far.look = far.face = Math.PI * .5; far.cd = 99;
  run(W, .4);
  ok(e.alert && n.alert, 'сосед не поднялся на крик');
  ok(!far.alert, 'дальний поднялся на крик');
}
// ---------- 5. патрульный обходит маршрут ----------
{
  const W = mk(7); W.player.x = -3.5; W.player.z = 46.5;     // в 50 м: дальше обзора сторожа, но ближе границы сна врагов
  const e = spawnEnemy(W, 'imp', 46.5, 46.5, 'patrol'); e.cd = 99;
  ok(e.route && e.route.length === P.patrolPts, 'у патрульного нет маршрута');
  const visited = new Set(); for (let i = 0; i < 60 * 40; i++) { step(W, 1 / 60, {}); visited.add(e.ri); }
  ok(visited.size === P.patrolPts && !e.alert, `патрульный не обошёл маршрут (${visited.size})`);
  ok(Math.hypot(e.x - 46.5, e.z - 46.5) < P.patrolR + 2, 'патрульный ушёл с маршрута');
}
// ---------- 6. поводок: бросает погоню и возвращается ----------
{
  const W = mk(8); const e = guard(W, 8, true, 'imp'); run(W, .4); ok(e.alert, 'не заметил');
  W.ev.length = 0; let lost = false;
  for (let i = 0; i < 60 * 25 && !lost; i++) { step(W, 1 / 60, { mz: -1 }); if (W.ev.some(v => v.k === 'lost' && v.id === e.id)) lost = true; W.ev.length = 0; }
  ok(lost && !e.alert, 'сторож не бросил погоню за поводком');
  W.player.x = e.home.x + 70; W.player.z = e.home.z; run(W, 20);     // далеко, но ближе границы сна врагов (мир теперь шире)
  ok(Math.hypot(e.x - e.home.x, e.z - e.home.z) < 1, 'сторож не вернулся на пост: ' + Math.hypot(e.x - e.home.x, e.z - e.home.z).toFixed(1));
}
// ---------- 6б. у края поводка не мечется: бросил погоню — идёт к посту, не замечая героя (иначе «!» и «?» каждый кадр) ----------
{
  const W = mk(9); const e = guard(W, 8, true, 'imp'); e.z = e.home.z - P.leash - 1; e.x = e.home.x; W.player.x = e.x; W.player.z = e.z - 4; e.alert = true; e.face = Math.PI;
  let spot = 0, lost = 0; for (let i = 0; i < 60 * 3; i++) { step(W, 1 / 60, { attack: i % 20 < 3 }); for (const v of W.ev) if (v.id === e.id) { if (v.k === 'spot') spot++; if (v.k === 'lost') lost++; } W.ev.length = 0; }     // герой бьёт — шум боя слышно и спиной
  ok(spot <= 1 && lost <= 1, `сторож мечется у края поводка: заметил ${spot}, потерял ${lost} за 3 с`);
}
// ---------- 7. в областях появляются сторожа и патрули; modes: false — нет ----------
{
  const count = modes => { let posted = 0; for (let s = 0; s < 3; s++) { const W = mk(20 + s, c => { c.enemies.count = 8; c.enemies.posts.modes = modes; }); W.player.x = 59.5; W.player.z = -46.8; W.player.inv = 1e9; run(W, 30); posted += W.enemies.filter(e => e.mode === 'guard' || e.mode === 'patrol').length; } return posted; };
  ok(count(true) > 0, 'в лагере Ржавых нет сторожей и патрулей');
  ok(count(false) === 0, 'при modes: false сторожа появились');
}

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Сторожа и патрули 3D: OK');
