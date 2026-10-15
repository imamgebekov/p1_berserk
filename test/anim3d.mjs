// Тест поз удара 3D (шаг P1): у каждого типа оружия есть семейство движений, позы конечные и непрерывные,
// начинаются и кончаются в стойке, прямой и обратный замахи идут в разные стороны, завершающий отличается, полный оборот не раскручивается назад.
import { CFG3 } from '../3d/src/config3d.js';
import { TRAITS } from '../3d/src/data/weapons3d.js';
import { FAMILY, KEYS, REST, familyOf, stepOf, swingPose, chargePose, trailOn } from '../3d/src/anim3d.js';

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

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Позы ударов 3D: OK (семейств ' + Object.keys(KEYS).length + ', типов оружия ' + Object.keys(FAMILY).length + ')');
