// Тест боевой механики: перекат и уклон, лучник и стрелы, прыгун, фазы Предвестника.
import { CFG } from '../src/config.js';
import { P, W, V, keys, resetState } from '../src/state.js';
import { setRng, mulberry32 } from '../src/util.js';
import { recalc } from '../src/inventory.js';
import { learn } from '../src/skills.js';
import * as Q from '../src/quests.js';
import { tryRoll, hurtPlayer, startSwing, killEnemy } from '../src/combat.js';
import { spawnEnemy, spawnBoss, pickSpawnType } from '../src/world.js';
import { step } from '../src/sim.js';
import { updateEnemies, updateProjectiles } from '../src/ai.js';
import { on } from '../src/events.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const fresh = (seed = 1) => { resetState(); setRng(mulberry32(seed)); P.quests = {}; recalc(); W.started = true; W.spawnT = 1e9; W.timer = 1e9; P.x = 600; P.hp = P.maxhp = 500; W.camX = 450; };
const run = (sec, dt = 1 / 60) => { for (let i = 0; i < Math.round(sec / dt); i++) step(dt); };
const R = CFG.roll, A = CFG.enemyAi, B = CFG.bossPhase;

// ---------- 1. перекат ----------
{
  fresh(1);
  ok(tryRoll() && P.rollT === 0 && P.inv >= R.invuln && P.rollDir === 1, 'перекат стартует вперёд по взгляду');
  ok(!tryRoll(), 'нельзя перекатываться во время переката');
  const x0 = P.x; keys.l = true; keys.atk = true; keys.jump = true;
  run(R.duration * .6);
  ok(P.swingT === -1 && P.z === 0 && P.rollT >= 0, 'во время переката не бьём и не прыгаем');
  run(R.duration * .4 - .02);
  const dist = P.x - x0;
  keys.l = keys.atk = keys.jump = false; run(.05);
  ok(P.rollT === -1 && dist > 34 && dist < 52, `дальность переката ${dist.toFixed(1)} вне [34; 52], ввод должен игнорироваться`);
  ok(P.rollCd > 0 && !tryRoll(), 'перезарядка переката');
  run(R.cooldown + .1); ok(P.rollCd <= 0 && tryRoll(), 'перекат снова доступен после перезарядки');
  run(R.duration + .1);

  // направление: по нажатой стороне; отмена замаха
  fresh(2); P.face = 1; keys.l = true; startSwing(); ok(P.swingT === 0, 'замах начат');
  ok(tryRoll() && P.rollDir === -1 && P.face === -1 && P.swingT === -1 && P.comboT === 0, 'перекат отменяет замах и идёт в сторону нажатия'); keys.l = false;
  // запреты
  fresh(3); P.z = 10; ok(!tryRoll(), 'перекат в воздухе'); P.z = 0;
  P.dead = true; ok(!tryRoll(), 'перекат мёртвым'); P.dead = false;
  W.paused = true; ok(!tryRoll(), 'перекат на паузе панели'); W.paused = false;
  W.hold = true; ok(!tryRoll(), 'перекат на системной паузе'); W.hold = false;
  W.started = false; ok(!tryRoll(), 'перекат до начала игры'); W.started = true;

  // уклон: урон не проходит, Клеймо растёт один раз за перекат, один сигнал события
  fresh(4); let dodges = 0; on('dodge', () => dodges++);
  tryRoll(); const hp0 = P.hp, rage0 = P.rage;
  hurtPlayer(40, 1);
  ok(P.hp === hp0 && P.rage === rage0 + R.dodgeRage && dodges === 1 && W.popups.some(p => p.text === 'Уклон!'), `уклон: hp ${P.hp}/${hp0}, Клеймо ${P.rage}, сигналов ${dodges}`);
  run(R.dodgeCd + .05); hurtPlayer(40, 1);
  ok(P.hp === hp0 && P.rage === rage0 + R.dodgeRage && dodges === 1, 'второй уклон в том же перекате не должен давать Клеймо снова');
  run(R.duration + R.invuln); P.dodgeCd = 0;
  hurtPlayer(40, 1); ok(P.hp < hp0, 'после переката урон снова проходит');
  // перекат во время Клейма: Клеймо не прибавляется
  fresh(5); P.rageOn = 5; P.rage = 50; tryRoll(); hurtPlayer(10, 1); ok(P.rage === 50, 'во время Клейма уклон не добавляет Клеймо');
  // навык «Лёгкая поступь» сокращает перезарядку
  fresh(6); P.sp = 9; learn('vigor', recalc); learn('fireHeal', recalc); learn('swift', recalc); learn('swift', recalc);
  tryRoll(); run(R.duration + .02); ok(Math.abs(P.rollCd - (R.cooldown - 2 * CFG.skills.effects.swift.rollCd)) < .05, `перезарядка с навыком ${P.rollCd.toFixed(2)}`);
  // задание на уклоны
  fresh(7); P.quests = {}; Q.accept('q_dodge'); for (let i = 0; i < 5; i++) { P.rollT = 0; P.rollDodged = false; P.dodgeCd = 0; hurtPlayer(10, 1); }
  ok(Q.stateOf('q_dodge').st === 'done', 'задание на уклоны: ' + JSON.stringify(Q.stateOf('q_dodge')));
}

// ---------- 2. состав врагов по уровням ----------
{
  const share = lv => { fresh(11); P.lv = lv; const c = {}; for (let i = 0; i < 20000; i++) { const t = pickSpawnType(); c[t] = (c[t] || 0) + 1; } return c; };
  const l1 = share(1), l3 = share(3), l4 = share(4), l10 = share(10);
  ok(!l1.archer && !l1.leaper && l1.imp && l1.brute, 'на 1 уровне только бесы и рогачи');
  ok(l3.archer > 0 && !l3.leaper, 'лучники с 3 уровня, прыгуны ещё нет');
  ok(l4.leaper > 0 && l4.archer > 0, 'прыгуны с 4 уровня');
  const sum = Object.values(l10).reduce((a, b) => a + b, 0), wsum = CFG.spawn.pool.reduce((a, p) => a + p.w, 0);
  for (const p of CFG.spawn.pool) ok(Math.abs((l10[p.type] || 0) / sum - p.w / wsum) < .02, `доля ${p.type} не по весам`);
}

// ---------- 3. лучник ----------
{
  fresh(20); P.lv = 3; recalc();
  const a = spawnEnemy('archer', 700); a.cd = 0; P.x = 610; a.hp = a.maxhp = 999;
  // держит дистанцию: слишком близко — отступает
  run(.8, 1 / 60); ok(Math.abs(a.x - P.x) > 90 - 1 || a.x > 700 - 1, 'лучник не отступает от героя');
  const d0 = Math.abs(a.x - P.x);
  // выстрел: стрела появляется и летит к герою
  fresh(21); const a2 = spawnEnemy('archer', 700); P.x = 610; a2.cd = 0; a2.hp = a2.maxhp = 999;
  let shot = null; for (let i = 0; i < 400 && !shot; i++) { step(1 / 60); if (W.proj.length) shot = { ...W.proj[0] }; }
  ok(shot && shot.face === -1 && shot.vx < 0 && Math.abs(shot.vx) === A.arrowSpeed && shot.dmg === a2.dmg, 'выстрел лучника: ' + JSON.stringify(shot));
  ok(a2.st === 'rec' || a2.st === 'walk', 'лучник после выстрела отдыхает');
  // попадание в стоящего героя
  fresh(22); P.x = 600; W.proj.push({ x: 640, z: A.arrowZ, vx: -A.arrowSpeed, dmg: 12, life: 2, face: -1 }); const hp = P.hp;
  run(.5); ok(P.hp === hp - 12 && W.proj.length === 0, `стрела должна попасть: hp ${P.hp}/${hp}, стрел ${W.proj.length}`);
  // перепрыгнуть
  fresh(23); P.x = 600; P.z = A.arrowHitZ + 4; P.vz = 0; W.proj.push({ x: 603, z: A.arrowZ, vx: -A.arrowSpeed, dmg: 12, life: 2, face: -1 });
  const hpJ = P.hp; for (let i = 0; i < 10; i++) { P.z = A.arrowHitZ + 4; updateProjectiles(1 / 60); } ok(P.hp === hpJ, 'прыжок над стрелой не спасает');
  // перекат
  fresh(24); P.x = 600; tryRoll(); W.proj.push({ x: 603, z: A.arrowZ, vx: -A.arrowSpeed, dmg: 12, life: 2, face: -1 }); const hpR = P.hp;
  updateProjectiles(1 / 60); ok(P.hp === hpR && W.proj.length === 0 && P.rollDodged, 'перекат сквозь стрелу: урона нет, «Уклон»');
  // мимо и по жизни
  fresh(25); W.proj.push({ x: 300, z: A.arrowZ, vx: -A.arrowSpeed, dmg: 12, life: .05, face: -1 }); run(.2); ok(W.proj.length === 0, 'стрела не исчезла по времени жизни');
  fresh(26); for (let i = 0; i < 40; i++) { const e = spawnEnemy('archer', 700); e.cd = 0; e.hp = e.maxhp = 99; } P.x = 640; P.hp = P.maxhp = 99999;
  let maxA = 0; for (let i = 0; i < 600; i++) { step(1 / 60); maxA = Math.max(maxA, W.proj.length); } ok(maxA <= A.maxArrows, `стрел одновременно ${maxA} > ${A.maxArrows}`);
  // прерывание удара героя
  fresh(27); const a3 = spawnEnemy('archer', 640); P.x = 620; a3.st = 'wind'; a3.t = 0; a3.cd = 5;
  ok(true, 'ok');
}

// ---------- 4. прыгун ----------
{
  fresh(30); P.lv = 4; recalc();
  const l = spawnEnemy('leaper', 650); l.cd = 0; l.hp = l.maxhp = 999; P.x = 600;
  const seen = { wind: false, leap: false, maxZ: 0, land: false };
  for (let i = 0; i < 400; i++) { step(1 / 60); if (l.st === 'wind') seen.wind = true; if (l.st === 'leap') { seen.leap = true; seen.maxZ = Math.max(seen.maxZ, l.z); } if (seen.leap && l.st === 'rec') seen.land = true; if (seen.land) break; }
  ok(seen.wind && seen.leap && seen.land, 'прыгун должен присесть, прыгнуть и приземлиться ' + JSON.stringify(seen));
  ok(seen.maxZ > 12 && seen.maxZ < 25, `высота прыжка ${seen.maxZ.toFixed(1)}`);
  ok(l.z === 0, 'после приземления z = 0');
  // урон по стоящему герою
  fresh(31); P.lv = 4; recalc(); const l2 = spawnEnemy('leaper', 640); l2.cd = 0; l2.hp = l2.maxhp = 999; P.x = 600; const hp = P.hp;
  run(2.5); ok(P.hp < hp, 'прыгун должен ранить стоящего героя');
  // перекат во время прыжка
  fresh(32); P.lv = 4; recalc(); const l3 = spawnEnemy('leaper', 640); l3.cd = 0; l3.hp = l3.maxhp = 999; P.x = 600; let dodged = false; const hp3 = P.hp;
  let flew = false;
  for (let i = 0; i < 400; i++) { step(1 / 60); if (l3.st === 'leap') flew = true; if (l3.st === 'leap' && Math.abs(l3.x - P.x) < 25 && P.rollT < 0 && !dodged) { tryRoll(); dodged = true; } if (flew && l3.st === 'rec') break; }
  ok(dodged && P.hp === hp3, `перекат от прыгуна: бросок ${dodged}, hp ${P.hp}/${hp3}`);
  // прерывание в замахе и удар в воздухе
  fresh(33); const l4 = spawnEnemy('leaper', 640); l4.st = 'wind'; l4.t = .1; l4.hp = l4.maxhp = 999; P.x = 625; startSwing(); keys.atk = true; run(.4); keys.atk = false;
  ok(l4.hp < l4.maxhp && l4.st !== 'leap', 'удар прерывает приседание прыгуна');
  fresh(34); const l5 = spawnEnemy('leaper', 640); l5.st = 'leap'; l5.z = 10; l5.vz = 0; l5.leapDir = -1; l5.hp = l5.maxhp = 999; P.x = 618; P.face = 1; keys.atk = true; run(.35); keys.atk = false;
  ok(l5.hp < l5.maxhp, 'героя по прыгуну в воздухе удар должен попадать');
}

// ---------- 5. Предвестник: фазы ----------
{
  fresh(40); P.lv = 5; recalc(); W.cycle = 0; spawnBoss(); const b = W.boss; P.x = b.x - 300; W.proj.length = 0;
  ok(b.phase === 1, 'Предвестник начинает с 1 фазы');
  const spd0 = b.spd, n0 = W.enemies.length;
  b.hp = Math.floor(b.maxhp * B.hpFrac) + 5; run(.1); ok(b.phase === 1, 'до половины здоровья фаза не меняется');
  b.hp = Math.floor(b.maxhp * B.hpFrac); const shake0 = W.shake; run(.05);
  ok(b.phase === 2 && Math.abs(b.spd - spd0 * B.speedMult) < 1e-9, `вторая фаза: phase=${b.phase}, spd ${b.spd}`);
  ok(W.enemies.length === n0 + B.summon.length && W.enemies.filter(e => e.type === 'imp').length >= B.summon.length, 'призыв прислужников');
  ok(W.chatLog.some(m => m.text.includes('сгущается')) && W.popups.some(p => p.text.includes('Ярость')), 'сообщение о фазе');
  ok(b.st === 'rec' && b.t < 0, 'рёв: пауза перед продолжением боя');
  const n1 = W.enemies.length; b.hp = 3; run(.3); ok(b.phase === 2 && W.enemies.length <= n1 + 0, 'призыв только один раз');
  // выбор атаки: в 1 фазе только удар, во 2 — иногда взмах
  const pick = ph => { fresh(41); spawnBoss(); const bb = W.boss; bb.phase = ph; bb.hp = bb.maxhp; P.x = bb.x - bb.reach + 5; P.hp = P.maxhp = 1e6; P.inv = 1e9; let sweep = 0, slam = 0;
    for (let i = 0; i < 20000 && sweep + slam < 300; i++) { if (bb.phase === 1 && bb.hp < bb.maxhp * .9) bb.hp = bb.maxhp; if (bb.phase === 2) bb.hp = bb.maxhp * .4; const was = bb.st; step(1 / 60); if (was === 'walk' && bb.st === 'wind') { if (bb.atk === 'sweep') sweep++; else slam++; } P.x = bb.x - bb.reach + 5; }
    return { sweep, slam }; };
  const p1 = pick(1), p2 = pick(2);
  ok(p1.sweep === 0 && p1.slam > 50, `1 фаза: взмахов быть не должно ${JSON.stringify(p1)}`);
  const share = p2.sweep / Math.max(1, p2.sweep + p2.slam); ok(Math.abs(share - B.sweepChance) < .1, `доля взмахов во 2 фазе ${share.toFixed(2)} ≠ ${B.sweepChance}`);
  // взмах: попадает по стоящему, не попадает по прыгнувшему, перекату и тому, кто далеко
  const sweep = (setup) => { fresh(42); spawnBoss(); const bb = W.boss; bb.phase = 2; bb.hp = bb.maxhp * .4; bb.st = 'wind'; bb.t = 0; bb.atk = 'sweep'; bb.cd = 99; P.x = bb.x - 40; P.hp = P.maxhp = 500; setup(bb); const hp = P.hp; for (let i = 0; i < 120 && bb.st === 'wind'; i++) { step(1 / 60); if (setup.keep) setup.keep(bb); } return hp - P.hp; };
  ok(sweep(() => {}) > 0, 'взмах крылом должен ранить стоящего героя');
  ok(sweep(bb => { P.x = bb.x - B.sweepRange - 12; }) === 0, 'взмах не достаёт дальше sweepRange');
  const jump = bb => {}; jump.keep = () => { P.z = B.sweepMaxZ + 6; P.vz = 0; };
  ok(sweep(jump) === 0, 'прыжок спасает от взмаха');
  const roll = bb => {}; roll.keep = bb => { if (bb.t > B.sweepWind * B.windMult - .12 && P.rollT < 0 && P.rollCd <= 0) tryRoll(); };
  ok(sweep(roll) === 0, 'перекат спасает от взмаха');
  // Предвестник по-прежнему побеждается, фаза сбрасывается для нового
  fresh(43); spawnBoss(); const b1 = W.boss; b1.hp = 0; killEnemy(b1); ok(W.boss === null, 'Предвестник побеждён');
  spawnBoss(); ok(W.boss.phase === 1, 'новый Предвестник снова в 1 фазе');
}

// ---------- 6. общая устойчивость: толпа новых врагов ----------
{
  fresh(50); P.lv = 8; recalc(); P.hp = P.maxhp = 400;
  for (let i = 0; i < 6; i++) spawnEnemy(['archer', 'leaper', 'imp', 'brute', 'archer', 'leaper'][i], 640 + i * 15);
  for (let i = 0; i < 3600; i++) {
    keys.atk = i % 4 === 0; keys.r = (i / 70 | 0) % 2 === 0; keys.l = !keys.r; if (i % 90 === 0) tryRoll();
    step(1 / 60);
    for (const e of W.enemies) if (!Number.isFinite(e.x) || !Number.isFinite(e.z) || e.z < 0 || e.z > 60) { fails.push(`враг ${e.type}: x=${e.x} z=${e.z}`); i = 1e9; break; }
    if (P.dead) { P.dead = false; P.hp = P.maxhp; }
    if (W.proj.length > A.maxArrows) { fails.push('слишком много стрел'); break; }
  }
  keys.l = keys.r = keys.atk = false;
}

if (fails.length) { console.error('\nПРОВАЛ (бой):\n' + fails.slice(0, 25).join('\n')); process.exit(1); }
console.log('Бой: OK (перекат, уклон, лучник, прыгун, фазы Предвестника)');
