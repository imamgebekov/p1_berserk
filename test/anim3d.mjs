// Тест поз удара 3D (шаг P1): у каждого типа оружия есть семейство движений, позы конечные и непрерывные,
// начинаются и кончаются в стойке, прямой и обратный замахи идут в разные стороны, завершающий отличается, полный оборот не раскручивается назад.
import { CFG3 } from '../3d/src/config3d.js';
import { TRAITS } from '../3d/src/data/weapons3d.js';
import { FAMILY, KEYS, REST, familyOf, stepOf, swingPose, chargePose, trailOn, gait, bank, strikeBody, rollLand, hitLean, heroDeath, foeDeath, damp, dampAngle, wrapPi, poseLambda, smoothPose } from '../3d/src/anim3d.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const hit = CFG3.player.attackHitAt / CFG3.player.attackTime;
const keys = Object.keys(REST);
const near = (a, b, e = 1e-9) => keys.every(k => Math.abs(a[k] - b[k]) < e);

for (const kind of Object.keys(TRAITS)) ok(FAMILY[kind], `у типа «${kind}» нет семейства движений`);
ok(familyOf('нет_такого') === 'slash', 'неизвестный тип — рубящий по умолчанию');
ok(stepOf(1, false) === 'a' && stepOf(2, false) === 'b' && stepOf(3, true) === 'fin' && stepOf(4, false) === 'b' && stepOf(5, false) === 'a', 'чередование прямой / обратный, каждый третий — завершающий');

for (const fam of Object.keys(KEYS)) for (const step of ['a', 'b', 'fin']) {
  const tag = `${fam}/${step}`;
  ok(near(swingPose(fam, step, 0, hit), REST) && near(swingPose(fam, step, 1, hit), REST), `${tag}: не начинается или не кончается в стойке`);
  let prev = swingPose(fam, step, 0, hit), jump = 0;
  for (let i = 1; i <= 240; i++) {
    const q = swingPose(fam, step, i / 240, hit);
    ok(keys.every(k => Number.isFinite(q[k])), `${tag}: не число при t=${i / 240}`);
    for (const k of keys) { let d = Math.abs(q[k] - prev[k]); if (k === 'twist') d = Math.abs(((q[k] - prev[k]) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI); jump = Math.max(jump, d); }   // поворот корпуса — по кругу
    prev = q;
  }
  ok(jump < .45, `${tag}: рывок позы ${jump.toFixed(2)} за 1/240 удара`);
  // в момент попадания оружие уже движется к цели (не в стойке и не в замахе)
  const atHit = swingPose(fam, step, hit, hit), wind = KEYS[fam][step][0];
  ok(!near(atHit, wind, 1e-3) && !near(atHit, REST, 1e-3), `${tag}: в момент попадания поза не в размахе`);
}
// прямой и обратный — в разные стороны (по повороту руки или корпуса)
for (const fam of ['slash', 'spin', 'flail']) {
  const a = KEYS[fam].a[1], b = KEYS[fam].b[1];
  ok(Math.sign(a.yaw) !== Math.sign(b.yaw), `${fam}: прямой и обратный замахи в одну сторону`);
}
for (const fam of Object.keys(KEYS)) ok(JSON.stringify(KEYS[fam].fin) !== JSON.stringify(KEYS[fam].a), `${fam}: завершающий не отличается от прямого`);
// полный оборот: корпус проходит круг и доворачивается вперёд, не крутясь обратно
for (const fam of ['spin', 'flail']) {
  let max = -Infinity, back = 0, prev = 0;
  for (let i = 0; i <= 480; i++) { const tw = swingPose(fam, 'fin', i / 480, hit).twist; max = Math.max(max, tw); if (tw < prev - .5) back++; prev = tw; }
  ok(max > Math.PI * 1.8, `${fam}/fin: нет полного оборота (${max.toFixed(2)})`);
  ok(back <= 1, `${fam}/fin: корпус раскручивается назад`);
}
// колющие выносят руку вперёд, дробящие опускают оружие к земле
ok(KEYS.thrust.a[1].reach > .4 && KEYS.thrust.fin[1].reach > KEYS.thrust.a[1].reach, 'колющий выпад не выносит руку');
ok(KEYS.smash.a[0].pitch < 0 && KEYS.smash.a[1].pitch > 1.7, 'дробящий: не замах из-за головы к земле');
ok(KEYS.smash.fin[0].lift > .2, 'дробящий завершающий: нет прыжка');
// заряд: поднимается в позу завершающего замаха, при полном дрожит; тяжёлый удар стартует из неё без рывка
for (const fam of Object.keys(KEYS)) {
  const wind = KEYS[fam].fin[0], q0 = chargePose(fam, 0, .9, 0), q1 = chargePose(fam, .5, .9, 0);
  ok(near(q0, REST, 1e-9), `${fam}: заряд не начинается из стойки`);
  ok(Math.abs(q1.lift - wind.lift) < 1e-9 && Math.abs(q1.lean - wind.lean) < 1e-9, `${fam}: заряд не приходит в позу замаха`);
  const a = chargePose(fam, 2, .9, .1), b = chargePose(fam, 2, .9, .13);
  ok(Math.abs(a.yaw - b.yaw) > 1e-4, `${fam}: полный заряд не дрожит`);
  ok(near(swingPose(fam, 'fin', .01, hit, true), wind, 1e-9), `${fam}: тяжёлый удар стартует не из позы замаха`);
}
// след виден только в размахе
ok(!trailOn(.02, hit) && trailOn(hit, hit) && !trailOn(.99, hit), 'след виден не только в размахе');

// тело (G5): походка по скорости, дыхание стоя, крен, выпад и сжатие в ударе, приземление переката, отклик на удар, смерть
{ const still = gait(0, 5, 1.3), full = gait(5, 5, 1.3), half = gait(2.5, 5, 1.3);
  ok(still.leg === 0 && still.lean === 0 && still.breath >= 0 && still.breath <= 1, 'стоя машет ногами или не дышит');
  ok(full.breath === 0 && full.lean > .15 && Math.abs(full.leg) <= .9 && half.run === .5, 'на бегу дышит, не наклоняется или шаг не по скорости');
  let mx = 0; for (let t = 0; t < 3; t += .01) mx = Math.max(mx, Math.abs(gait(1, 5, t).leg)); ok(mx < .25, 'медленный шаг машет как бег: ' + mx.toFixed(2));
  ok(bank(10, 1) === -.22 && bank(-10, 1) === .22 && bank(10, 0) === 0, 'крен в поворот не ограничен или есть стоя');
  const h = .45, S = t => strikeBody(t, h);
  ok(S(0).lunge === 0 && S(h * .7).lunge > .06 && S(h * .7).lunge < .16 && Math.abs(S(h).lunge - .16) < 1e-9 && S(1).lunge < 1e-6, 'выпад не к моменту попадания');
  ok(S(h * .8).sy < 1 && S(h + .09).sy > 1 && Math.abs(S(0).sy - 1) < 1e-9 && Math.abs(S(1).sy - 1) < 1e-9, 'нет сжатия перед ударом или вытяжки после');
  ok(rollLand(.5) === 1 && rollLand(.9) < .85 && Math.abs(rollLand(1) - 1) < 1e-9, 'нет сжатия при приземлении');
  ok(hitLean(1, 0).rx < 0 && hitLean(1, Math.PI).rx > 0 && Math.abs(hitLean(1, Math.PI / 2).rz) > .4, 'отклик на удар не прочь от удара');
  const k = heroDeath(.25), d = heroDeath(1); ok(k.y < -.3 && k.rx > .2 && Math.abs(d.rx + 1.5) < 1e-6 && Math.abs(d.y - .3) < 1e-6, 'герой не встаёт на колени перед падением');
  const ends = [0, 1, 2, 3].map(id => foeDeath(1, id)); ok(new Set(ends.map(e => e.rx.toFixed(2) + '/' + e.rz.toFixed(2))).size === 4 && ends.every(e => Math.abs(e.scale - .25) < 1e-6 && e.y < -.85), 'враги падают одинаково или не тают');
  let prev = 0, mono = true; for (let t = 0; t <= .6; t += .02) { const y = foeDeath(t, 1).y; if (y > prev + 1e-9) mono = false; prev = y; } ok(mono, 'тело врага подпрыгивает при смерти'); }

// сглаживание (шаг 3 аудита): не зависит от частоты кадров, не перелетает цель, угол — коротким путём; в окне удара — резко
{ const run = (fps, sec) => { let v = 0; for (let i = 0; i < Math.round(fps * sec); i++) v = damp(v, 1, 18, 1 / fps); return v; };
  const a = run(30, .2), b = run(60, .2), c = run(120, .2);
  ok(Math.abs(a - b) < 1e-9 && Math.abs(b - c) < 1e-9 && b < 1 && b > .9, `сглаживание зависит от частоты кадров: ${a} / ${b} / ${c}`);
  ok(damp(0, 1, 18, 5) <= 1 && damp(0, 1, 18, 0) === 0, 'сглаживание перелетает цель или двигает без времени');
  const v = dampAngle(3, -3, 20, 1 / 60); ok(wrapPi(v - 3) > 0 && Math.abs(wrapPi(-3 - v)) < Math.abs(wrapPi(-3 - 3)), 'поворот идёт длинным путём через ноль');
  ok(Math.abs(wrapPi(7) - (7 - Math.PI * 2)) < 1e-9 && Math.abs(Math.abs(wrapPi(-Math.PI)) - Math.PI) < 1e-9 && Math.abs(wrapPi(.5) - .5) < 1e-12, 'приведение угла неверное');
  const B = { pose: 18, hit: 60 }, h = .45; ok(poseLambda(true, h, h, B) === 60 && poseLambda(true, .05, h, B) === 18 && poseLambda(false, h, h, B) === 18 && poseLambda(true, .9, h, B) === 18, 'окно резкого удара неверное');
  const o = { rotation: { x: 0 } }, ch = [o, 'rotation', 'x'], st = {};
  smoothPose(st, [ch], 18, 1 / 60); o.rotation.x = 1; smoothPose(st, [ch], 18, 1 / 60);
  ok(o.rotation.x > 0 && o.rotation.x < .5, 'поза не догоняет плавно: ' + o.rotation.x);
  o.rotation.x = 2; smoothPose(st, [ch], 18, 1 / 60, new Set([ch])); ok(o.rotation.x === 2 && st.sm.get(ch) === 2, 'канал напрямую (перекат) сглаживается'); }

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Позы ударов 3D: OK (семейств ' + Object.keys(KEYS).length + ', типов оружия ' + Object.keys(FAMILY).length + ')');
