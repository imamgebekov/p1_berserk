// Тест закрытого лагеря 3D (шаг A1): частокол с воротами вокруг Пепельного Брода, торговец, кузнец и капитан внутри,
// враги не рождаются и не проходят ворота, снаружи теряют героя в лагере (и не стреляют внутрь), герой и отряд ходят через ворота,
// дороги не прошивают частокол; без места «Пепельный Брод» в конфиге лагеря нет (тесты чистого боя).
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnEnemy, spawnAlly } from '../3d/src/sim.js';
import { makeMap, insideCamp, campGates } from '../3d/src/map.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const clone = () => JSON.parse(JSON.stringify(CFG3));
const C = CFG3.camp;
const mk = (seed = 1, tweak) => { const c = clone(); c.bosses.list = []; if (tweak) tweak(c); return createWorld(c, mulberry32(seed)); };
const run = (W, sec, input = {}) => { for (let i = 0; i < Math.round(sec * 60); i++) step(W, 1 / 60, typeof input === 'function' ? input(i) : input); };
const walkTo = (W, tx, tz, sec = 20) => { const p = W.player; for (let i = 0; i < sec * 60; i++) { const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz); if (d < .8) return true; step(W, 1 / 60, { mx: dx / d, mz: dz / d }); } return false; };

// ---------- 1. геометрия ----------
{
  const M = makeMap(clone());
  ok(M.camp && M.blocks.length > 100 && M.foeBlocks.length === C.gates.length, 'нет частокола или ворот');
  for (const k of ['merchant', 'smith', 'captain']) { const b = M.buildings.find(x => x.npc && x.npc.kind === k); ok(b && insideCamp(M.camp, b.npc.x, b.npc.z), `${k} не в лагере`); }
  const hit = (a, w, pad = 0) => !(a.x1 < w.x0 - pad || a.x0 > w.x1 + pad || a.z1 < w.z0 - pad || a.z0 > w.z1 + pad);
  ok(!M.buildings.some(b => M.blocks.some(w => hit(b, w))), 'частокол врезается в дом');
  ok(!M.containers.some(c => M.blocks.some(w => hit({ x0: c.x, x1: c.x, z0: c.z, z1: c.z }, w, .6))), 'сундук в частоколе');
  ok(!M.solids.some(s => M.blocks.some(w => hit({ x0: s.x, x1: s.x, z0: s.z, z1: s.z }, w, s.r))), 'препятствие в частоколе');
  let cross = 0; for (const [a, b] of M.roads) for (let k = 0; k <= 60; k++) { const x = a.x + (b.x - a.x) * k / 60, z = a.z + (b.z - a.z) * k / 60; if (M.blocks.some(w => x > w.x0 && x < w.x1 && z > w.z0 && z < w.z1)) { cross++; break; } }
  ok(cross === 0, `дорог сквозь частокол: ${cross}`);
  const c2 = clone(); c2.map.places = []; ok(!makeMap(c2).camp && !makeMap(c2).blocks.length, 'без места лагерь остался');
}

// ---------- 2. враги не рождаются в лагере ----------
{
  const W = mk(2, c => { c.enemies.count = 8; }); W.player.inv = 1e9; W.player.x = 0; W.player.z = -20;     // у северного края: тут лагерь уже не «безопасное место» Брода
  let inside = 0; for (let i = 0; i < 60 * 60; i++) { step(W, 1 / 60, {}); if (W.enemies.some(e => !e.dead && !e.boss && insideCamp(C, e.x, e.z))) inside++; }
  ok(inside === 0, `враги в лагере ${inside} кадров`);
}

// ---------- 3. ворота для врагов закрыты, снаружи теряют героя ----------
{
  const W = mk(3, c => { c.enemies.count = 0; }); W.player.hp = W.player.maxhp = 1e6;
  const g = campGates(C).find(q => q.a === 0); W.player.x = g.x; W.player.z = g.z - 6;    // в лагере у южных ворот
  const es = ['brute', 'hound', 'imp', 'ghoul'].map((t, i) => { const e = spawnEnemy(W, t, g.x - 3 + i * 2, g.z + 5); e.alert = true; e.cd = 99; return e; });
  let in_ = 0; for (let i = 0; i < 60 * 15; i++) { step(W, 1 / 60, {}); if (es.some(e => !e.dead && insideCamp(C, e.x, e.z))) in_++; }
  ok(in_ === 0, `враг прошёл ворота (${in_} кадров)`);
  // враг, оказавшийся в проёме ворот, выталкивается наружу (ворота для врагов закрыты)
  const e2 = spawnEnemy(W, 'imp', g.x, g.z - .5); e2.cd = 99; step(W, 1 / 60, {}); step(W, 1 / 60, {});
  ok(!insideCamp(C, e2.x, e2.z) && Math.hypot(e2.x - g.x, e2.z - g.z) > C.foeDepth / 2, `враг в проёме не вытолкнут: ${e2.x.toFixed(2)}, ${e2.z.toFixed(2)}`);
  ok(es.every(e => !e.alert), 'враги снаружи не потеряли героя в лагере');
  // лучник у ворот не стреляет внутрь
  const W2 = mk(4, c => { c.enemies.count = 0; }); W2.player.x = g.x; W2.player.z = g.z - 7; W2.player.hp = W2.player.maxhp = 1e6;
  const ar = spawnEnemy(W2, 'archer', g.x, g.z + 6); ar.alert = true;
  let shots = 0; for (let i = 0; i < 60 * 10; i++) { step(W2, 1 / 60, {}); shots += W2.ev.filter(v => v.k === 'shot').length; W2.ev.length = 0; }
  ok(shots === 0, `лучник стреляет в лагерь (${shots})`);
}

// ---------- 4. герой и отряд проходят ворота ----------
{
  const W = mk(5, c => { c.enemies.count = 0; }); W.lv = 20; W.player.inv = 1e9;
  spawnAlly(W, 'guard'); spawnAlly(W, 'guard');
  W.allies.forEach((a, i) => { a.x = -22; a.z = 2 + i * 2; });          // бойцы у западного края лагеря
  const g = campGates(C).find(q => q.a === 90), out = { x: g.x + 8, z: g.z + 16 };   // герой выходит в восточные ворота и уходит на юго-восток
  ok(walkTo(W, g.x - 3, g.z) && walkTo(W, g.x + 6, g.z) && walkTo(W, out.x, out.z), 'герой не вышел из лагеря через ворота');
  run(W, 8);
  run(W, 4);
  ok(W.allies.every(a => Math.hypot(a.x - W.player.x, a.z - W.player.z) < 7 && !insideCamp(C, a.x, a.z)), 'отряд не вышел за героем: ' + W.allies.map(a => a.x.toFixed(1) + ',' + a.z.toFixed(1)).join(' | '));
  ok(walkTo(W, g.x + 6, g.z) && walkTo(W, g.x - 3, g.z) && walkTo(W, 0, 4), 'герой не вернулся в лагерь');
}

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Закрытый лагерь 3D: OK');
