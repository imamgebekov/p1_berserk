// Тест костров быстрого перемещения 3D (шаг C3d): костёр у каждого посёлка и у каждого опасного места, все — на свободном месте
// и в мире; костёр лагеря открыт сразу, другие — когда подходишь; перенос только от костра, только к открытому и не при
// встревоженных врагах рядом; отряд переносится с героем, погоня — нет; сохранение v6 хранит костры, старое — только лагерь.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnEnemy } from '../3d/src/sim.js';
import { resolve, nearBuilding } from '../3d/src/map.js';
import { fireNear, discoverFires, fastTravel, travelBlock, knownFires, sanitizeFires } from '../3d/src/fires3d.js';
import { createSaver, loadSave, migrate } from '../3d/src/save3d.js';
import { waterDist } from '../3d/src/terrain3d.js';
import { wdist } from '../3d/src/geo3d.js';     // Мир 5.0: край — от центра мира

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const mk = () => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.bosses.list = []; c.events.on = false; c.wanderer.on = false; return createWorld(c, mulberry32(2)); };
const mem = () => { const o = {}; return { getItem: k => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); }, removeItem: k => { delete o[k]; }, o }; };
const W = mk(), F = W.map.fires, P = CFG3.map.places;

// ---------- 1. где костры ----------
ok(F.length >= P.length * .4 && F.length <= P.length * .6, `костров ${F.length} при местах ${P.length} (с 3.86 — около половины)`);
{ const G = CFG3.fires; const must = f => f.home || (P.find(q => q.id === f.id) || {}).hub || (P.find(q => q.id === f.id) || {}).city; ok(F.every(f => must(f) || Math.hypot(f.x, f.z) >= G.campR - 1), 'костёр у лагеря'); ok(F.every((f, i) => must(f) || F.every((g, j) => i === j || must(g) || Math.hypot(f.x - g.x, f.z - g.z) >= G.gap - 1)), 'костры слишком близко'); }
ok(new Set(F.map(f => f.id)).size === F.length && F.some(f => f.home && f.x === 0 && f.z === 0), 'нет костра лагеря или повтор');
for (const f of F) {
  if (f.home) continue;
  const o = { x: f.x, z: f.z }; ok(!resolve(W.map, o, .5) && !nearBuilding(W.map, f.x, f.z, 2) && waterDist(W.map.river, f.x, f.z) > 2.5, `костёр «${f.name}» в стене, доме или воде`);
  ok(wdist(CFG3, f.x, f.z) < CFG3.world.radius - 3, 'костёр за краем мира');
  const pl = P.find(p => p.id === f.id); ok(pl && (pl.safe ? Math.hypot(pl.x - f.x, pl.z - f.z) < 15 : Math.hypot(pl.x - f.x, pl.z - f.z) > pl.r && Math.hypot(pl.x - f.x, pl.z - f.z) < pl.r + 20), `костёр «${f.name}» не у своего места`);
}
ok(W.map.decor.filter(d => d.fire).length === F.length - 1, 'не у каждого костра огонь');

// ---------- 2. открытие ----------
step(W, 1 / 60, {}); ok(Object.keys(W.fires).join() === 'camp', 'в начале открыт не только лагерь');
const far = F.find(f => f.id === 'v0') || F[5], p = W.player;
p.x = far.x + 12; p.z = far.z; step(W, 1 / 60, {}); ok(!W.fires[far.id], 'костёр открылся издалека');
p.x = far.x + 5; p.z = far.z; W.ev.length = 0; step(W, 1 / 60, {}); ok(W.fires[far.id] && W.ev.some(v => v.k === 'fireFound' && v.id === far.id), 'костёр не открылся рядом или нет надписи');

// ---------- 3. перенос ----------
{ p.x = 30; p.z = 30; ok(!fastTravel(W, 'camp') && travelBlock(W) === 'Подойдите к костру', 'перенос не от костра');
  p.x = far.x + 2; p.z = far.z; resolve(W.map, p, .5); ok(!!fireNear(W), 'у костра не находится костёр');
  const dark = F.find(f => !W.fires[f.id]); ok(!fastTravel(W, dark.id), 'перенос к неоткрытому костру');
  const e = spawnEnemy(W, 'imp', p.x + 6, p.z); e.alert = true; ok(!fastTravel(W, 'camp') && travelBlock(W) === 'Рядом враги', 'перенос при враге рядом'); e.alert = false;
  W.allies.push({ id: 99, type: 'spear', x: p.x + 1, z: p.z, hp: 10, maxhp: 10, vx: 0, vz: 0, dead: false });
  e.alert = false; const chaser = spawnEnemy(W, 'brute', p.x - 30, p.z); chaser.alert = true;
  W.ev.length = 0; ok(fastTravel(W, 'camp'), 'перенос к лагерю не прошёл');
  ok(Math.hypot(p.x, p.z) < 4 && !resolve(W.map, { x: p.x, z: p.z }, .45), 'герой не у костра лагеря или в стене');
  ok(Math.hypot(W.allies[0].x - p.x, W.allies[0].z - p.z) < 3, 'отряд не перенёсся с героем');
  ok(!W.enemies.includes(chaser), 'погоня перенеслась за героем');
  ok(W.ev.some(v => v.k === 'travel' && v.fire === 'camp'), 'нет события переноса');
  ok(knownFires(W).length === 2, 'список открытых костров неверный'); }

// ---------- 4. сохранение ----------
{ const st = mem(); createSaver(W, st).write(true); const s = loadSave(30, st);
  ok(s && s.fires.sort().join() === ['camp', far.id].sort().join(), 'костры не сохранились: ' + (s && s.fires));
  const d = JSON.parse(st.o['berserk3d.save']); d.v = 5; delete d.fires; const m = migrate(d); ok(m.v >= 6 && Array.isArray(m.fires) && !m.fires.length, 'старое сохранение не переведено');
  ok(JSON.stringify(sanitizeFires(['camp', 'нет такого', 5, far.id], F.map(f => f.id))) === JSON.stringify({ camp: 1, [far.id]: 1 }), 'мусор в кострах сохранения не отброшен'); }

if (fails.length) { console.log('ПРОВАЛ:\n' + [...new Set(fails)].join('\n')); process.exit(1); }
console.log('Костры 3D: OK');
