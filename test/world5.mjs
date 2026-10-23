// Тест «Мира 5.0» (2026-10-23, решение владельца): круг мира радиуса 1500 со сдвинутым центром — лагерь в (0,0) у юго-западного края;
// всё в круге мира, без повторов; места сбора, костры и повозки по всему кругу; уровень растёт от старта (дальше — выше);
// сетка тумана — вокруг центра мира; старое сохранение (другой world.gen) не тащит место, туман, могилу и знакомые места.
import { CFG3 } from '../3d/src/config3d.js';
import { zoneLevel } from '../3d/src/zones3d.js';
import { createWorld, mulberry32 } from '../3d/src/sim.js';
import { seenSize, loadSave } from '../3d/src/save3d.js';
import { wdist, wcOf } from '../3d/src/geo3d.js';
import { reveal, isSeen } from '../3d/src/places3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const C = CFG3, R = C.world.radius, O = wcOf(C);
ok(R === 1500 && O.x > 0 && O.z < 0 && R - Math.hypot(O.x, O.z) > 200 && R - Math.hypot(O.x, O.z) < 350, 'мир не 1500 или лагерь не у юго-западного края');
{
  const P = C.map.places;
  ok(P.every(p => wdist(C, p.x, p.z) < R), 'место за краем мира');
  ok(C.map.buildings.every(b => wdist(C, b.x, b.z) < R), 'дом за краем мира');
  ok(new Set(P.map(p => p.id)).size === P.length && new Set(P.map(p => p.name)).size >= P.length - 6, 'повторы id или имён мест');
  ok(P.filter(p => p.type === 'hamlet').length > 80, 'посёлков мало: ' + P.filter(p => p.type === 'hamlet').length);
  ok(C.dungeons.list.filter(d => d.at && d.inst).every(d => wdist(C, d.at.x, d.at.z) < R - 10), 'вход в подземелье за краем');
}
// уровень растёт от старта: среднее по кольцам расстояний от лагеря
{ const band = d => { let s = 0, n = 0; for (let a = 0; a < 6.28; a += .05) { const x = Math.sin(a) * d, z = Math.cos(a) * d; if (wdist(C, x, z) < R - 10) { s += zoneLevel(C, x, z); n++; } } return n ? s / n : null; };
  const L = [300, 700, 1200, 1800, 2400].map(band); ok(L.every((v, i) => v != null && (!i || v > L[i - 1] + 3)), 'уровень не растёт от старта: ' + L.map(v => v && v.toFixed(0)).join(' / ')); }
// мир: места сбора, костры, повозки по всему кругу (и в дальней половине)
{
  const W = createWorld(JSON.parse(JSON.stringify(C)), mulberry32(1)), S = W.levels.surface.map, far = q => Math.hypot(q.x, q.z) > Math.hypot(O.x, O.z);
  ok(S.nodes.filter(far).length >= 300, 'в дальней половине мало мест сбора: ' + S.nodes.filter(far).length);
  ok(S.fires.filter(far).length >= 30 && S.coaches.filter(far).length >= 6, 'в дальней половине мало костров или повозок');
  ok(W.seenN === seenSize(C) && W.seenX === O.x && W.seenZ === O.z, 'сетка тумана не вокруг центра мира');
  reveal(W, O.x + R - 20, O.z, 6); ok(isSeen(W, O.x + R - 20, O.z) && !isSeen(W, O.x - R + 20, O.z), 'туман у дальнего края не открывается');
}
// старое сохранение другого мира: место, туман, могила, знакомые места — сброс; уровень и пепел — на месте
{
  const st = { data: {}, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = String(v); }, removeItem(k) { delete this.data[k]; } };
  const KEY = 'berserk3d.save';
  st.data[KEY] = JSON.stringify({ v: 6, tree: 1, gen: 2, hero: 'thorn', prog: { lv: 33, xp: 0 }, inv: { bag: [], eq: {}, ash: 777 }, pos: { x: 100, z: 100 }, tomb: { x: 5, z: 5, ash: 10 }, known: { places: { v3: 1 } } });
  const s = loadSave(40, st);
  ok(s, 'старое сохранение не прочиталось'); if (s) ok(!s.pos && !s.tomb && !Object.keys((s.known && s.known.places) || {}).length && s.inv.ash === 777, 'старое сохранение тащит место, могилу или знакомые места');
}
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Мир 5.0 3D: OK');
