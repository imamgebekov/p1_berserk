// Рыбалка (2026-11-13): удочка в сумке, вода рядом, заброс — ожидание — «клюёт» — подсечка в окно; рано и поздно — ничего; отошёл — оборвалось; улов из таблицы, предметы существуют
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32 } from '../3d/src/sim.js';
import { startFish, hook, fishNear, fishState, waterSpot } from '../3d/src/fishing3d.js';
import { BY_ID } from '../3d/src/data/items.js';
import { lakeR } from '../3d/src/terrain3d.js';
import { entryOf } from '../3d/src/inv.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.events.on = false; c.wanderer.on = false; const W = createWorld(c, mulberry32(7)); step(W, 1 / 60, {}); W.inv.bag.length = 0;
ok(c.fish.catch.every(([id]) => BY_ID[id]) && BY_ID[c.fish.rod], 'в таблице улова есть несуществующие предметы');
// берег: за краем озера, лицом к воде
const Lk = W.map.river.lakes.find(L => L.r >= 8 && Math.hypot(L.x, L.z) < 900) || W.map.river.lakes[0], p = W.player;
const shore = () => { for (let a = 0; a < 6.28; a += .35) { const R = lakeR(Lk, a) + 1.2, x = Lk.x + Math.sin(a) * R, z = Lk.z + Math.cos(a) * R; p.x = x; p.z = z; p.vx = p.vz = 0; p.face = Math.atan2(Lk.x - x, Lk.z - z); if (waterSpot(W)) return true; } return false; };
ok(shore(), 'не нашла берег озера для проверки'); ok(fishNear(W), 'у воды «рядом» нет');
ok(startFish(W) === 'norod', 'без удочки забросила');
W.inv.bag.push(entryOf(c.fish.rod, 0, null, 0, null)); W.inv.bag[0] = { id: c.fish.rod, n: 1 };
ok(startFish(W) === 'ok' && fishState(W).s === 'wait', 'не забросилось'); ok(startFish(W) === 'busy', 'второй заброс при первом');
ok(hook(W) === 'early' && fishState(W).s === 'idle', 'подсечка раньше поклёвки не «рано»');
// ждём поклёвку, подсекаем в окно
let got = 0, junk = 0, tries = 0; const seen = new Set();
for (let n = 0; n < 60; n++) { for (let i = 0; i < 40 && fishState(W).cd > 0; i++) step(W, 1 / 60, {}); shore(); if (startFish(W) !== 'ok') { ok(false, 'заброс не удался на попытке ' + n); break; }
  let bite = false; for (let i = 0; i < 60 * 8 && !bite; i++) { step(W, 1 / 60, {}); bite = fishState(W).s === 'bite'; shore(); }
  ok(bite, 'не клюнуло за 8 секунд'); const before = W.inv.bag.reduce((s, q) => s + q.n, 0); const r = hook(W); ok(r === 'catch', 'не подсекла в окно: ' + r);
  const after = W.inv.bag.reduce((s, q) => s + q.n, 0); ok(after === before + 1, 'улов не лёг в сумку'); tries++; }
for (const q of W.inv.bag) if (q.id.startsWith('fish_')) { seen.add(q.id); if (q.id === 'fish_boot') junk += q.n; else got += q.n; }
ok(seen.size >= 3, 'улов однообразный: ' + [...seen]); ok(got > junk, 'мусора больше рыбы');
// поздно: пропустила окно
for (let i = 0; i < 60 && fishState(W).cd > 0; i++) step(W, 1 / 60, {}); shore(); startFish(W); for (let i = 0; i < 60 * 12 && fishState(W).s !== 'idle'; i++) { step(W, 1 / 60, {}); shore(); } ok(fishState(W).s === 'idle', 'после окна осталась в ловле');
// отошла — оборвалось
for (let i = 0; i < 60 && fishState(W).cd > 0; i++) step(W, 1 / 60, {}); shore(); startFish(W); p.x += 30; step(W, 1 / 60, {}); ok(fishState(W).s === 'idle', 'отошла, а ловля идёт');
p.x = 5; p.z = 5; ok(!fishNear(W), 'у лагеря «рядом вода»');
if (fails.length) { console.log('ПРОВАЛ:'); for (const f of fails) console.log(f); process.exit(1); }
console.log('Рыбалка 3D: OK');
