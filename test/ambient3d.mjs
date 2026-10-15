// Тест мелкого оживления 3D (шаг A6): жители ходят между точками на дорогах лагеря, не заходят в дома и в костёр, стоят у точек;
// вороны сидят вне лагеря и домов, взлетают при герое, улетают и возвращаются, только когда героя нет рядом;
// трубы есть у жилых домов; туман гуще на рассвете и как днём в полдень; без лагеря жителей нет.
import { CFG3 } from '../3d/src/config3d.js';
import { makeMap, insideOf, insideCamp, campOf } from '../3d/src/map.js';
import { mulberry32 } from '../3d/src/sim.js';
import { villagerStops, makeVillagers, stepVillager, makeBirds, updateBirds, chimneys, fogMul } from '../3d/src/ambient3d.js';
import { phaseOf } from '../3d/src/daynight.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const A = CFG3.ambient, D = CFG3.daynight, M = makeMap(CFG3), C = campOf(CFG3);

// ---------- 1. жители ----------
{
  const stops = villagerStops(M, CFG3);
  ok(stops.length >= 3 && stops.every(s => insideCamp(C, s.x, s.z) && insideOf(M, s.x, s.z) < 0), `дверей ${stops.length}, все ли в лагере и вне домов`);
  ok(stops.every(s => Math.abs(Math.hypot(s.sx, s.sz) - A.fireGap) < 1e-6), 'спица не у костра');
  const rnd = mulberry32(3), vs = makeVillagers(stops, A.villagers, rnd);
  ok(vs.length === A.villagers, 'жителей не столько, сколько задано');
  const visited = new Set(); let inHouse = 0, inFire = 0, outCamp = 0, walked = 0;
  for (let i = 0; i < 60 * 240; i++) for (const v of vs) {
    const x0 = v.x, z0 = v.z; stepVillager(v, 1 / 60, stops, A, rnd); walked += Math.hypot(v.x - x0, v.z - z0);
    if (Math.hypot(v.x - x0, v.z - z0) > A.walk / 60 + 1e-6) fails.push('житель прыгнул');
    if (insideOf(M, v.x, v.z) >= 0) inHouse++; if (Math.hypot(v.x, v.z) < 1.2) inFire++; if (!insideCamp(C, v.x, v.z)) outCamp++;
    if (!v.moving && v.wait > 0) visited.add(stops.findIndex(s => Math.hypot(s.x - v.x, s.z - v.z) < 1e-6));
  }
  ok(!inHouse && !inFire && !outCamp, `житель в доме ${inHouse}, в костре ${inFire}, за частоколом ${outCamp}`);
  ok(visited.size === stops.length && !visited.has(-1) && walked > 100, `жители побывали у ${visited.size} точек, прошли ${walked.toFixed(0)} м`);
  const c2 = JSON.parse(JSON.stringify(CFG3)); c2.map.places = [];
  ok(villagerStops(makeMap(c2), c2).length === 0, 'без лагеря есть жители');
}
// ---------- 2. вороны ----------
{
  const bs = makeBirds(M, CFG3, mulberry32(5));
  ok(bs.length === A.birds && bs.every(b => !insideCamp(C, b.x, b.z, -4) && insideOf(M, b.x, b.z, 1) < 0), 'вороны в лагере или в домах');
  const b = bs[0]; let px = b.x + 30, pz = b.z;
  updateBirds(bs, px, pz, 1 / 60, A); ok(b.state === 'sit', 'ворона взлетела без героя');
  px = b.x + A.scare - .5; updateBirds(bs, px, pz, 1 / 60, A);
  ok(b.state === 'fly' && b.vx < 0, 'ворона не взлетела от героя или летит к нему');
  for (let i = 0; i < 60 * (A.flyTime + .5); i++) updateBirds(bs, px, pz, 1 / 60, A);
  ok(b.state === 'gone' && b.y > 2, 'ворона не улетела вверх');
  for (let i = 0; i < 60 * (A.back + 2); i++) updateBirds(bs, b.hx + 1, b.hz, 1 / 60, A);
  ok(b.state === 'gone', 'ворона вернулась, хотя герой рядом');
  for (let i = 0; i < 60 * 2; i++) updateBirds(bs, b.hx + 60, b.hz, 1 / 60, A);
  ok(b.state === 'sit' && b.x === b.hx && b.y === 0, 'ворона не вернулась на место');
}
// ---------- 3. трубы и туман ----------
{
  const ch = chimneys(M, CFG3);
  ok(ch.length >= 5 && ch.every(c => M.buildings.some(b => c.x > b.x0 && c.x < b.x1 && c.z > b.z0 && c.z < b.z1)), `труб ${ch.length}, все ли над домами`);
  const at = ph => { const t = ((ph - D.start + 1) % 1) * D.len; { const e = ((phaseOf(t, D) - ph) % 1 + 1) % 1; ok(e < 1e-6 || e > 1 - 1e-6, 'перевод фазы'); } return fogMul(t, D, A); };
  ok(Math.abs(at(A.fogPeak) - (1 + A.fogAmp)) < 1e-6, 'на рассвете туман не самый густой');
  ok(at(.3) === 1 && at(.5) === 1 && at(A.fogPeak + A.fogWidth + .01) === 1, 'туман гуще не только утром');
  ok(Math.abs(at(A.fogPeak + A.fogWidth / 2) - (1 + A.fogAmp / 2)) < .01 && Math.abs(at(A.fogPeak - A.fogWidth / 2) - (1 + A.fogAmp / 2)) < .01 && at(A.fogPeak + A.fogWidth * .95) < 1.05, 'туман сгущается и редеет не плавно');
}

if (fails.length) { console.log('ПРОВАЛ:\n' + [...new Set(fails)].join('\n')); process.exit(1); }
console.log('Оживление 3D: OK');
