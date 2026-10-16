// Тест света сквозь облака и палитры 3D (шаг E2): поле света повторяемо, в 0..1, светлая доля как в конфиге, бесшовно;
// пятна плывут по ветру; столбы света — над яркими местами рядом с героем, не теснее gap; палитра поверхности зелёная
// и светлая днём (не красная); сетка холмов под мостом ниже настила.
import { CFG3 } from '../3d/src/config3d.js';
import { makeField, lightAt, pickShafts } from '../3d/src/sunlight3d.js';
import { makeMap } from '../3d/src/map.js';
import { buildHeights, heightAt } from '../3d/src/terrain3d.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const SL = CFG3.sunlight;

// ---------- 1. поле ----------
const F = makeField(CFG3.world.seed);
ok(JSON.stringify(Array.from(F.data.slice(0, 50))) === JSON.stringify(Array.from(makeField(CFG3.world.seed).data.slice(0, 50))), 'поле не повторяется по зерну');
ok(JSON.stringify(Array.from(F.data.slice(0, 50))) !== JSON.stringify(Array.from(makeField(CFG3.world.seed + 1).data.slice(0, 50))), 'другое зерно — то же поле');
ok(F.data.every(v => v >= 0 && v <= 1), 'поле вне 0..1');
{ let lit = 0; for (const v of F.data) if (v > .5) lit++; const k = lit / F.data.length; ok(Math.abs(k - .32) < .05, 'светлая доля ' + k.toFixed(2)); }
{ let bad = 0; for (let i = 0; i < 200; i++) { const x = (i * 7.3) % 300 - 150, z = (i * 13.1) % 300 - 150; if (Math.abs(lightAt(F, x, z, 0, SL) - lightAt(F, x + SL.size, z - SL.size, 0, SL)) > 1e-4) bad++; } ok(!bad, 'поле не бесшовное: ' + bad); }
{ let jump = 0; for (let x = -100; x < 100; x += .25) jump = Math.max(jump, Math.abs(lightAt(F, x + .25, 7, 0, SL) - lightAt(F, x, 7, 0, SL))); ok(jump < .2, 'резкие ступени в поле: ' + jump.toFixed(2)); }

// ---------- 2. ветер ----------
{ const t = 37; let bad = 0; for (let i = 0; i < 100; i++) { const x = i * 3.1 - 150, z = i * 1.7 - 80; if (Math.abs(lightAt(F, x, z, t, SL) - lightAt(F, x + SL.wind[0] * t, z + SL.wind[1] * t, 0, SL)) > 1e-4) bad++; } ok(!bad, 'пятна не плывут по ветру'); }
{ let moved = 0; for (let i = 0; i < 100; i++) if (Math.abs(lightAt(F, i * 2, 5, 0, SL) - lightAt(F, i * 2, 5, 30, SL)) > .05) moved++; ok(moved > 20, 'за 30 с свет почти не сдвинулся'); }

// ---------- 3. столбы света ----------
{ const S = SL.shafts; let total = 0;
  for (const [px, pz, t] of [[0, 0, 0], [40, -30, 12], [-60, 20, 100], [10, 70, 300]]) {
    const P = pickShafts(F, px, pz, t, SL); total += P.length;
    ok(P.length <= S.n, 'столбов больше предела');
    ok(P.every(q => q.k >= S.min && Math.hypot(q.x - px, q.z - pz) <= S.r + 1e-9), 'столб в тени или далеко от героя');
    ok(P.every((q, i) => !i || q.k <= P[i - 1].k), 'столбы не по яркости');
    ok(P.every((q, i) => P.every((w, j) => i === j || Math.hypot(q.x - w.x, q.z - w.z) >= S.gap)), 'столбы теснее gap');
    ok(JSON.stringify(P) === JSON.stringify(pickShafts(F, px, pz, t, SL)), 'выбор столбов не повторяется');
  }
  ok(total >= 4, 'столбов света почти нет: ' + total); }

// ---------- 4. палитра: зелено и светло ----------
{ const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255), lum = c => .299 * c[0] + .587 * c[1] + .114 * c[2];
  const L = CFG3.look, D = CFG3.daynight.sky.day, N = CFG3.daynight.sky.night;
  ok([...L.ground, ...L.leaf].every(h => { const c = rgb(h); return c[1] > c[0] * 1.1 && c[1] > c[2]; }), 'трава или листва не зелёные');
  ok(L.bare > 0 && L.bare < .5, 'сухих деревьев слишком много или нет вовсе');
  for (const k of ['fog', 'hemiSky', 'hemiGround']) { const c = rgb(D[k]); ok(c[0] <= c[1] * 1.05, `днём ${k} красный: ${D[k]}`); }
  ok(lum(rgb(D.fog)) > .3 && D.hemiI >= 2.8 && D.sunI >= 2, 'день тёмный');
  ok(lum(rgb(N.fog)) < lum(rgb(D.fog)) && N.hemiI < D.hemiI, 'ночь не темнее дня');
  { const c = rgb(SL.night); ok(c[1] >= c[2], 'лунный свет синее зелёного — трава станет водой в ASCII'); }
  { const c = rgb(SL.day); ok(c[1] > c[0] && c[1] > c[2], 'дневной свет не зелёно-тёплый'); } }

// ---------- 5. земля под мостом ----------
{ const map = makeMap(CFG3), hf = buildHeights(CFG3, map);
  for (const b of map.river.bridges) ok(heightAt(hf, b.x, b.z) >= hf.deck && heightAt(hf, b.x, b.z, false) < hf.deck - .2, 'сетка холмов на мосту поднята до настила'); }

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Свет сквозь облака и палитра 3D: OK');
