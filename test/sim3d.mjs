// Тест логики 3D-прототипа (без графики): бег, удар, автоприцел, перекат, ИИ врагов, смерть, границы, устойчивость.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, spawnEnemy, respawnPlayer, mulberry32, aliveEnemies, angDiff } from '../3d/src/sim.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const clone = () => { const c = JSON.parse(JSON.stringify(CFG3)); c.map.places = []; c.bosses.list = []; c.enemies.roam.on = false; return c; };     // механика кольца — в прежнем режиме (спокойный мир — в roam3d)      // без безопасных зон: враги рождаются где угодно
const mk = (seed = 1, tweak) => { const c = clone(); c.enemies.count = 0; if (tweak) tweak(c); const W = createWorld(c, mulberry32(seed)); W.player.x = 0; W.player.z = 0; return W; };
const run = (W, sec, input, dt = 1 / 60) => { for (let i = 0; i < Math.round(sec / dt); i++) step(W, dt, typeof input === 'function' ? input(i) : input); };
const P = CFG3.player;

// ---------- 1. бег ----------
{
  let W = mk(); run(W, 1, { mz: -1 });
  ok(W.player.z < -3.5 && W.player.z > -6 && Math.abs(W.player.x) < 1e-6, `бег вперёд за 1 с: z=${W.player.z.toFixed(2)}`);
  ok(Math.hypot(W.player.vx, W.player.vz) <= P.speed + 1e-9, 'скорость не выше предела');
  W = mk(); run(W, 2, { mx: 1, mz: 1 }); ok(Math.abs(Math.hypot(W.player.vx, W.player.vz) - P.speed) < 1e-6, 'по диагонали не быстрее: ' + Math.hypot(W.player.vx, W.player.vz));
  W = mk(); run(W, 1, { mx: .5, mz: 0 }); ok(Math.abs(W.player.vx - P.speed * .5) < 1e-6, 'аналоговый джойстик: половина наклона — половина скорости');
  W = mk(); run(W, .6, { mz: -1 }); run(W, 1, {}); ok(Math.hypot(W.player.vx, W.player.vz) < 1e-6 && W.player.state === 'idle', 'останавливается без ввода');
  W = mk(); run(W, 1, { mx: 1 }); ok(Math.abs(angDiff(W.player.face, Math.PI / 2)) < .01, `герой поворачивается по движению: ${W.player.face.toFixed(2)}`);
  W = mk(); run(W, 1, { mx: .05, mz: .05 }); ok(Math.hypot(W.player.vx, W.player.vz) < 1e-9, 'мёртвая зона джойстика');
  W = mk(); run(W, 30, { mx: 1 }); ok(Math.hypot(W.player.x, W.player.z) <= W.cfg.world.radius + 1e-6, 'граница мира');
}

// ---------- 2. удар ----------
{
  const setup = (dx, dz, face = 0) => { const W = mk(); W.player.face = face; const e = spawnEnemy(W, 'imp', dx, dz); e.cd = 99; return { W, e }; };
  let { W, e } = setup(0, 2);
  run(W, P.attackHitAt + .05, { attack: true });
  ok(e.hp < e.maxhp && W.ev.some(v => v.k === 'hit' && v.id === e.id), 'удар по врагу в дуге и в дальности');
  ok(e.vz > 0 || e.z > 2, 'враг отброшен');
  ({ W, e } = setup(0, 2)); run(W, P.attackHitAt - .05, { attack: true }); ok(e.hp === e.maxhp, 'урон не раньше attackHitAt');
  ({ W, e } = setup(0, P.attackRange + W.cfg.enemies.imp.radius + .6)); W.player.face = 0; run(W, .3, { attack: true }); ok(e.hp === e.maxhp, 'враг дальше дальности не задет');
  // автоприцел: враг сбоку (за пределами дуги), но в радиусе autoAim → герой повернётся к нему
  ({ W, e } = setup(3, 0, 0)); run(W, P.attackHitAt + .05, { attack: true });
  ok(Math.abs(angDiff(W.player.face, Math.PI / 2)) < .05 && e.hp < e.maxhp, 'автоприцел поворачивает к ближайшему врагу');
  // без автоприцела вне радиуса — удар «вникуда»
  ({ W, e } = setup(0, -P.autoAim - 3, 0)); run(W, .3, { attack: true }); ok(e.hp === e.maxhp && Math.abs(W.player.face) < .01, 'вне автоприцела направление не меняется');
  // дуга: враг сзади не задет, когда автоприцел выключен
  ({ W, e } = (() => { const W = mk(1, c => { c.player.autoAim = 0; }); W.player.face = 0; const e = spawnEnemy(W, 'imp', 0, -2); e.cd = 99; return { W, e }; })());
  run(W, .3, { attack: true }); ok(e.hp === e.maxhp, 'враг за спиной не задет');
  // несколько врагов в дуге
  { const W = mk(); W.player.face = 0; const es = [spawnEnemy(W, 'imp', 0, 2), spawnEnemy(W, 'imp', 1, 2), spawnEnemy(W, 'imp', -1, 1.8)]; es.forEach(x => x.cd = 99);
    run(W, .3, { attack: true }); ok(es.every(x => x.hp < x.maxhp), 'удар задевает всех в дуге'); }
  // удар не повторяется внутри одного замаха; серия — быстрыми нажатиями; удержание — заряд, отпускание — тяжёлый удар
  { const W = mk(); W.player.face = 0; const e = spawnEnemy(W, 'brute', 0, 2.2); e.cd = 99; e.hp = e.maxhp = 9999;
    run(W, P.attackTime - .03, { attack: true }); ok(W.ev.filter(v => v.k === 'hit').length === 1, 'один замах — один удар');
    run(W, .05, {}); W.ev.length = 0;
    for (let i = 0; i < Math.round(P.attackTime * 3 * 60); i++) step(W, 1 / 60, { attack: i % 6 < 2 });
    ok(W.ev.filter(v => v.k === 'hit').length >= 3, 'быстрые нажатия дают серию ударов'); }
  { const W = mk(); W.player.face = 0; const e = spawnEnemy(W, 'brute', 0, 2.2); e.cd = 99; e.hp = e.maxhp = 9999; const H = P.heavy;
    run(W, H.hold + P.attackTime + .1, { attack: true });
    ok(W.player.state === 'charge', 'удержание после удара — заряд: ' + W.player.state);
    const hits0 = W.ev.filter(v => v.k === 'hit').length; run(W, 2, { attack: true });
    ok(W.ev.filter(v => v.k === 'hit').length === hits0 && W.player.state === 'charge', 'пока держишь — не бьёт');
    ok(W.ev.some(v => v.k === 'chargeFull'), 'полный заряд отмечен');
    const hp0 = e.hp; W.ev.length = 0; run(W, P.attackTime * H.swing + .1, {});
    const heavyHit = W.ev.find(v => v.k === 'hit');
    ok(W.ev.some(v => v.k === 'heavy' && v.power === 1) && heavyHit && heavyHit.fin, 'отпустил — тяжёлый удар');
    ok(e.st && e.st.stun && e.st.stun.t > 0, 'тяжёлый удар оглушает');
    // сравнение с обычным ударом по такому же врагу (без крита и разброса не обойтись — сравниваем средние по многим ударам)
    const avg = heavy => { let sum = 0; for (let s = 0; s < 40; s++) { const Wx = mk(s + 50); Wx.player.face = 0; const ex = spawnEnemy(Wx, 'brute', 0, 2.2); ex.cd = 99; ex.hp = ex.maxhp = 99999;
      if (heavy) { run(Wx, H.hold + P.attackTime + H.full + .05, { attack: true }); Wx.ev.length = 0; run(Wx, P.attackTime * H.swing, {}); } else { run(Wx, P.attackTime, { attack: true }); }
      const h = Wx.ev.filter(v => v.k === 'hit' && !v.fx); sum += h.length ? h[h.length - 1].dmg : 0; } return sum / 40; };
    const r = avg(true) / avg(false);
    ok(r > H.mul * .85 && r < H.mul * 1.15, `тяжёлый удар сильнее обычного в ~${H.mul} раза: ${r.toFixed(2)}`); }
  // удар в рывке: нажатие во время переката — удар сразу после него (с бонусом rollAtk); нажатие до переката гаснет
  { const W = mk(); W.player.face = 0; const e = spawnEnemy(W, 'brute', 0, 4.2); e.cd = 99; e.hp = e.maxhp = 9999;
    step(W, 1 / 60, { roll: true, mz: 1 }); step(W, 1 / 60, { attackPress: true });
    let start = -1; for (let i = 0; i < 60 && start < 0; i++) { step(W, 1 / 60, {}); if (W.player.state === 'atk') start = i; }
    ok(start >= 0 && W.player.rollAtk, 'нажатие во время переката не дало удар в рывке');
    const W2 = mk(); W2.player.face = 0; spawnEnemy(W2, 'brute', 0, 4.2).cd = 99;
    step(W2, 1 / 60, { attackPress: true }); W2.player.state = 'idle'; step(W2, 1 / 60, { roll: true, mz: 1 }); let at = false;
    for (let i = 0; i < 60; i++) { step(W2, 1 / 60, {}); if (W2.player.state === 'atk') at = true; }
    ok(!at, 'нажатие до переката сработало после него'); }
  // короткий заряд (меньше min) — удара нет, возврат в стойку
  { const W = mk(); W.player.face = 0; const H = P.heavy; let i = 0;
    for (; i < 120 && W.player.state !== 'charge'; i++) step(W, 1 / 60, { attack: true });
    run(W, H.min * .5, { attack: true }); const st = W.player.state; W.ev.length = 0; run(W, .5, {});
    ok(st === 'charge' && !W.ev.some(v => v.k === 'heavy') && W.player.state !== 'charge', 'слабый заряд отменяется'); }
  // замах прерывается ударом
  { const W = mk(); W.player.face = 0; const e = spawnEnemy(W, 'imp', 0, 1.2); e.state = 'wind'; e.t = 0; e.cd = 99; run(W, P.attackHitAt + .02, { attack: true });
    ok(e.state === 'chase', 'удар прерывает замах врага'); }
  // убийство
  { const W = mk(); W.player.face = 0; const e = spawnEnemy(W, 'imp', 0, 2); e.hp = 1; e.cd = 99; run(W, .3, { attack: true });
    ok(e.dead && W.kills === 1 && W.ev.some(v => v.k === 'die'), 'убийство'); run(W, .8, {}); ok(!W.enemies.includes(e), 'труп убирается'); }
  // удар даёт «hit stop»
  { const W = mk(); W.player.face = 0; const e = spawnEnemy(W, 'imp', 0, 2); e.cd = 99; e.hp = e.maxhp = 999; run(W, P.attackHitAt + .02, { attack: true }); ok(W.freeze > 0 || W.shake > 0, 'эффекты удара'); }
}

// ---------- 3. перекат ----------
{
  let W = mk(); W.player.face = 0; run(W, 1 / 60, { roll: true, mx: 1 });
  ok(W.player.state === 'roll' && W.player.inv >= P.rollInvuln - .02, 'перекат стартует с неуязвимостью');
  const x0 = W.player.x; run(W, P.rollTime + .05, {}); const dist = W.player.x - x0;
  ok(dist > 2.4 && dist < 4.2 && W.player.state !== 'roll', `дальность переката ${dist.toFixed(2)}`);
  ok(W.player.rollCd > 0, 'перезарядка'); run(W, 1 / 60, { roll: true, mx: 1 }); ok(W.player.state !== 'roll', 'перекат не чаще перезарядки');
  run(W, P.rollCooldown + .1, {}); run(W, 1 / 60, { roll: true, mx: 1 }); ok(W.player.state === 'roll', 'перекат снова доступен');
  // без ввода — по взгляду
  W = mk(); W.player.face = Math.PI; run(W, 1 / 60, { roll: true }); run(W, .2, {}); ok(W.player.z < -.8, 'перекат по взгляду без ввода: z=' + W.player.z.toFixed(2));
  // уклон: враг бьёт во время переката
  W = mk(); const e = spawnEnemy(W, 'imp', 0, 1.3); e.state = 'wind'; e.t = W.cfg.enemies.imp.wind - .03; run(W, 1 / 60, { roll: true, mz: 0, mx: 0 }); // откат по взгляду
  W.player.x = 0; W.player.z = 0; e.x = 0; e.z = 1.3; run(W, .08, {});
  ok(W.player.hp === W.player.maxhp && W.ev.some(v => v.k === 'dodge'), `уклон во время переката: hp ${W.player.hp}, события ${W.ev.map(v => v.k)}`);
  // после переката урон проходит
  W = mk(); const e2 = spawnEnemy(W, 'imp', 0, 1.2); e2.state = 'wind'; e2.t = 0; W.player.z = 0; e2.cd = 99; run(W, .6, {}); ok(W.player.hp < W.player.maxhp, 'без переката удар врага проходит');
}

// ---------- 4. ИИ врагов ----------
{
  let W = mk(); const e = spawnEnemy(W, 'imp', 0, 8); const d0 = Math.hypot(e.x - W.player.x, e.z - W.player.z); run(W, 1, {});
  ok(Math.hypot(e.x - W.player.x, e.z - W.player.z) < d0 - 2, 'враг идёт к герою');
  W = mk(); const e3 = spawnEnemy(W, 'imp', 0, 40); e3.cd = 99; run(W, 1, {}); ok(Math.abs(e3.z - 40) < .01, 'враг за пределами слуха стоит');
  // полный цикл: приблизился → замах → удар → отдых
  W = mk(); const e4 = spawnEnemy(W, 'imp', 0, 1.4); e4.cd = 0; const seen = []; let hp0 = W.player.hp;
  let hpAtRec = null;
  for (let i = 0; i < 240; i++) { step(W, 1 / 60, {}); if (seen[seen.length - 1] !== e4.state) seen.push(e4.state); if (hpAtRec === null && e4.state === 'rec') hpAtRec = W.player.hp; }
  ok(seen.includes('wind') && seen.includes('rec') && hpAtRec === hp0 - W.cfg.enemies.imp.damage, `цикл врага ${seen} hp после первого удара ${hpAtRec}`);
  // «неуязвимость после удара»: за время hurtInvuln второй удар не проходит
  W = mk(); const a = spawnEnemy(W, 'imp', 0, 1.3), b = spawnEnemy(W, 'imp', .3, 1.3); a.state = b.state = 'wind'; a.t = b.t = W.cfg.enemies.imp.wind - .02; run(W, .1, {});
  ok(W.player.hp === W.player.maxhp - W.cfg.enemies.imp.damage, `два удара одновременно: урон один ${W.player.hp}`);
  // рогач сильнее
  W = mk(); const br = spawnEnemy(W, 'brute', 0, 2); br.state = 'wind'; br.t = W.cfg.enemies.brute.wind - .02; run(W, .1, {}); ok(W.player.hp === W.player.maxhp - Math.round(W.cfg.enemies.brute.damage * br.dmgMul), 'удар рогача');
  // враги не сливаются в одну точку
  W = mk(); for (let i = 0; i < 6; i++) { const x = spawnEnemy(W, 'imp', 5, 5); x.cd = 99; } run(W, 1, {}); let min = 1e9; const l = W.enemies; for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) min = Math.min(min, Math.hypot(l[i].x - l[j].x, l[i].z - l[j].z));
  ok(min > .5, 'враги расталкиваются: ' + min.toFixed(2));
  // герой не проходит сквозь врага
  W = mk(); const wall = spawnEnemy(W, 'brute', 0, -1.5); wall.cd = 99; wall.hp = wall.maxhp = 1e9; run(W, 1, { mz: -1 }); ok(Math.hypot(wall.x - W.player.x, wall.z - W.player.z) > .7, 'герой упирается во врага');
}

// ---------- 5. поддержание числа врагов, смерть ----------
{
  let W = mk(1, c => { c.enemies.count = 5; }); W.player.inv = 1e9; run(W, 30, {});
  ok(aliveEnemies(W).length === 5, `держит 5 врагов: ${aliveEnemies(W).length}`);
  const d = aliveEnemies(W).map(e => Math.hypot(e.x - W.player.x, e.z - W.player.z)); ok(d.every(v => v < W.cfg.enemies.ring[1] + 3), 'враги появляются рядом (по кольцу)');
  W = mk(1, c => { c.enemies.count = 0; }); run(W, 20, {}); ok(W.enemies.length === 0, 'count=0 — врагов нет');
  W = mk(3, c => { c.enemies.count = 12; c.enemies.brutePart = .3; }); W.player.inv = 1e9; run(W, 120, {}); const br = W.enemies.filter(e => e.type === 'brute').length; ok(br > 0 && br < 12, 'есть и рогачи, и бесы');
  // убили — через respawn появляется новый
  W = mk(1, c => { c.enemies.count = 2; c.enemies.respawn = 1; }); W.player.inv = 1e9; run(W, 5, {}); const first = aliveEnemies(W)[0]; first.hp = 0; first.dead = true; run(W, 3, {}); ok(aliveEnemies(W).length === 2, 'после гибели появляется новый враг');
  // смерть героя
  W = mk(); W.player.hp = 3; const e = spawnEnemy(W, 'brute', 0, 1.5); e.state = 'wind'; e.t = W.cfg.enemies.brute.wind - .02; run(W, .1, {});
  ok(W.player.dead && W.player.hp === 0 && W.ev.some(v => v.k === 'playerDead'), 'гибель героя'); const px = W.player.x; run(W, 1, { mx: 1, attack: true, roll: true }); ok(W.player.x === px && W.player.state === 'dead', 'мёртвый герой не двигается и не бьёт');
  respawnPlayer(W); ok(!W.player.dead && W.player.hp === W.player.maxhp && W.enemies.length === 0 && W.player.inv > 0, 'возрождение');
}

// ---------- 6. устойчивость и детерминизм ----------
{
  const fuzz = seed => { const W = mk(seed, c => { c.enemies.count = 8; }); const r = mulberry32(seed + 100); let hold = { mx: 0, mz: 0, attack: false }, bad = null, deaths = 0;
    for (let i = 0; i < 30000 && !bad; i++) {
      if (i % 20 === 0) hold = { mx: r() * 2 - 1, mz: r() * 2 - 1, attack: r() < .6 };
      step(W, 1 / 60, { ...hold, roll: r() < .02 });
      if (W.player.dead) { deaths++; if (r() < .02) respawnPlayer(W); }
      const p = W.player;
      for (const v of [p.x, p.z, p.vx, p.vz, p.face, p.hp, W.t, W.kills]) if (!Number.isFinite(v)) bad = 'NaN у героя';
      if (p.hp < 0 || p.hp > p.maxhp) bad = 'hp ' + p.hp;
      if (Math.hypot(p.x, p.z) > W.cfg.world.radius + 1e-3) bad = 'вне мира';
      for (const e of W.enemies) { for (const v of [e.x, e.z, e.vx, e.vz, e.hp]) if (!Number.isFinite(v)) bad = 'NaN у врага'; if (Math.hypot(e.x, e.z) > W.cfg.world.radius * 1.5) bad = 'враг улетел ' + Math.hypot(e.x, e.z); }
      if (W.enemies.length > 40) bad = 'врагов ' + W.enemies.length;
      if (W.ev.length > 200) bad = 'события не ограничены';
    }
    return { bad, W, deaths }; };
  for (const s of [1, 2, 3]) { const r = fuzz(s); ok(!r.bad, `фаззинг seed=${s}: ${r.bad}`); }
  const h = s => { const W = fuzz(s).W; return [W.kills, W.t.toFixed(3), W.player.x.toFixed(4), W.player.hp, W.enemies.length].join(); };
  ok(h(5) === h(5), 'детерминизм: один seed — один результат');
}

if (fails.length) { console.error('\nПРОВАЛ (3D-логика):\n' + fails.slice(0, 25).join('\n')); process.exit(1); }
console.log('3D-логика: OK');
