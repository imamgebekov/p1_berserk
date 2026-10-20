// Бот отряда-спутников (этап 4): угроза и вызов, лекарь, стрелок, команды «за мной / держать / моя цель», рост с уровнем,
// спутник-герой один и не тот, кем играете; отряд из трёх сам разбирает стаю и не «тупит» (не стоит, не теряется, не гибнет зря).
import { CORE3 as CFG3 } from '../3d/src/config3d.js';     // ручное ядро и плоское поле: поведение сравнимо от версии к версии
CFG3.terrain.on = false;
import { createWorld, step, mulberry32, spawnEnemy, hireAlly, restoreAllies, switchHero } from '../3d/src/sim.js';
import { spawnAlly, squadCommand, allyHp, hireable, liveAllies } from '../3d/src/squad3d.js';
import { threatPick } from '../3d/src/threat3d.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const mk = (seed = 1, hero = 'vale', lv = 20) => { const cfg = JSON.parse(JSON.stringify(CFG3)); cfg.enemies.count = 0; cfg.map.places = []; cfg.bosses.list = []; cfg.squad.gear.on = false; const W = createWorld(cfg, mulberry32(seed)); W.hero = hero; W.lv = lv; W.player.x = 60; W.player.z = 40; W.player.inv = 1e9; return W; };
const run = (W, sec, inp = {}, each) => { for (let i = 0; i < Math.round(sec * 60); i++) { step(W, 1 / 60, inp); if (each) each(); W.ev.length = 0; } };
const party = (W, ...types) => types.map((t, i) => { const a = spawnAlly(W, t); a.x = W.player.x + 1.5 + i; a.z = W.player.z + 1.5; return a; });
const foe = (W, type, dx, dz, hp = 1e5) => { const e = spawnEnemy(W, type, W.player.x + dx, W.player.z + dz); e.hp = e.maxhp = hp; e.alert = true; return e; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const T = CFG3.squad.types;

// данные: четыре спутника-героя с ролями, найм не показывает своего героя
{ const C = Object.entries(T).filter(([, t]) => t.hero); ok(C.length === 4 && ['tank', 'heal', 'ranged', 'melee'].every(r => C.some(([, t]) => t.role === r)), 'спутники-герои: защитник, лекарь, стрелок, боец');
  const W = mk(1, 'thorn'); ok(!hireable(W, 'c_thorn') && hireable(W, 'c_jay'), 'Торн нанимает себя'); }
// угроза: кто больше навредил, того и бьют; цель меняется только при перевесе > 10%
{ const W = mk(2); const [a] = party(W, 'c_vale'); const e = foe(W, 'brute', 0, 4); a.x = e.x + 1; a.z = e.z;
  e.thr = { 0: 100, [a.id]: 50 }; e.tgt = 0; ok(threatPick(W, e, 4, 0) === null, 'угроза: герой опаснее, а враг бьёт союзника');
  e.thr = { 0: 50, [a.id]: 100 }; ok(threatPick(W, e, 4, 0) === a, 'угроза: союзник опаснее, а враг бьёт героя');
  e.tgt = a.id; e.thr = { 0: 104, [a.id]: 100 }; ok(threatPick(W, e, 4, 0) === a, 'угроза: цель сменилась без перевеса');
  e.thr = { 0: 130, [a.id]: 100 }; ok(threatPick(W, e, 4, 0) === null, 'угроза: перевес героя не переключил врага');
  const W2 = mk(3); const e2 = foe(W2, 'brute', 0, 4); ok(threatPick(W2, e2, 4, 0) === null && !e2.thr, 'без отряда угроза не считается'); }
// защитник держит стаю: из 4 рогачей большую часть времени бьют его, а не героя
{ const W = mk(4); const [t] = party(W, 'c_thorn'); const es = [foe(W, 'brute', 3, 3), foe(W, 'brute', -3, 3), foe(W, 'brute', 3, -3), foe(W, 'brute', -3, -3)];
  es.forEach(e => { e.thr = { 0: 40 }; e.tgt = 0; });                 // герой уже ударил всех
  let onT = 0, n = 0, taunts = 0;
  run(W, 12, {}, () => { taunts += W.ev.filter(v => v.k === 'taunt').length; for (const e of es) if (!e.dead && e.alert) { n++; if (e.tgt === t.id) onT++; } t.hp = t.maxhp; });
  ok(taunts >= 1, 'защитник ни разу не вызвал'); ok(onT / n > .6, `защитник не держит врагов: на нём ${(onT / n * 100).toFixed(0)}% времени`); }
// лекарь лечит героя и бойца; враги у вылеченного злятся на лекаря
{ const W = mk(5); const [h, v] = party(W, 'c_irga', 'c_vale'); run(W, .05); W.player.hp = W.player.maxhp * .4; v.hp = v.maxhp * .4; const e = foe(W, 'brute', 0, 9); e.cd = 99; e.thr = { 0: 10 };
  let heals = 0; run(W, 10, {}, () => { heals += W.ev.filter(x => x.k === 'allyheal').length; });
  ok(heals >= 2, 'лекарь не лечит: ' + heals); ok(W.player.hp > W.player.maxhp * .6, 'героя не вылечили: ' + W.player.hp.toFixed(0) + '/' + W.player.maxhp); ok(v.hp > v.maxhp * .6, 'бойца не вылечили');
  ok((e.thr && e.thr[h.id]) > 0, 'лечение не даёт угрозу лекарю'); }
// стрелок бьёт издали и отходит от врага
{ const W = mk(6); const [j] = party(W, 'c_jay'); const e = foe(W, 'brute', 9, 0); e.cd = 99; const C = W.cfg.enemies.brute, sp = C.speed; C.speed = 0;
  let shots = 0, near = 0, n = 0; run(W, 5, {}, () => { shots += W.ev.filter(x => x.k === 'allyshoot').length; n++; if (dist(j, e) < 3) near++; });
  ok(shots >= 4 && e.hp < e.maxhp, 'стрелок не стреляет: ' + shots); ok(near / n < .15, 'стрелок лезет в упор');
  C.speed = sp; e.tgt = j.id; e.taunt = { id: j.id, t: 99 }; const d0 = dist(j, e); let back = false; run(W, 1, {}, () => { if (dist(j, e) > d0 + .5 || dist(j, e) > 3.5) back = true; });
  ok(back, 'стрелок не отходит от врага'); }
// команды: «держать» — стоят у точки, когда герой ушёл; далеко — догоняют; «моя цель» — все на метку, метка пала — снова «за мной»
{ const W = mk(7); const ps = party(W, 'c_thorn', 'c_jay'); run(W, 1); ok(squadCommand(W, 'hold') === 'ok' && W.party.cmd === 'hold', 'команда «держать»');
  const hx = W.party.hx, hz = W.party.hz; run(W, 4, { mz: 1 }); ok(ps.every(a => Math.hypot(a.x - hx, a.z - hz) < 4.5), 'при «держать» отряд ушёл за героем: ' + ps.map(a => Math.hypot(a.x - hx, a.z - hz).toFixed(1)));
  W.player.x -= 60; run(W, .2);     // к центру: у края карты героя не пустит дальше ok(W.party.cmd === 'follow', 'герой ушёл далеко, а отряд всё «держит»'); run(W, 4); ok(ps.every(a => dist(a, W.player) < 8), 'отряд не догнал героя');
  const W2 = mk(8); const qs = party(W2, 'c_thorn', 'c_vale', 'c_jay'); const near = foe(W2, 'brute', 2, 2, 400), far = foe(W2, 'imp', -6, 7, 300); near.cd = far.cd = 99; W2.party.last = far.id;
  ok(squadCommand(W2, 'assist') === 'ok' && W2.party.mark === far.id, 'метка не на последней цели героя'); let onMark = 0, n = 0, back = false;
  run(W2, 10, {}, () => { if (!far.dead) for (const a of qs) { if (a.state === 'wind') { n++; if (a.tg === far) onMark++; } } if (W2.ev.some(v => v.k === 'squadCmd' && v.auto)) back = true; });
  ok(far.dead, 'отряд не убил метку'); ok(n && onMark / n > .9, 'отряд бьёт не метку'); ok(back && W2.party.cmd === 'follow', 'после метки не вернулись к «за мной»');
  const W3 = mk(9); ok(squadCommand(W3, 'hold') === 'empty', 'команда без отряда'); party(W3, 'c_vale'); ok(squadCommand(W3, 'assist') === 'none', '«моя цель» без врагов'); }
// рост с уровнем; один спутник-герой; смена героя отпускает своего спутника и возвращает пепел
{ const W = mk(10, 'thorn', 1); const [a] = party(W, 'c_jay'); const h1 = a.maxhp; W.lv = 30; run(W, .1); ok(a.maxhp === allyHp(W, T.c_jay) && a.maxhp > h1 * 2, 'спутник не растёт с уровнем');
  const b = W.map.buildings.find(q => q.npc && q.npc.kind === 'captain'); W.player.x = b.npc.x + 1; W.player.z = b.npc.z; run(W, .1); W.inv.ash = 1e5;
  ok(hireAlly(W, 'c_jay') === 'taken', 'второй такой же спутник'); ok(hireAlly(W, 'c_thorn') === 'taken', 'нанят свой же герой');
  const ash = W.inv.ash; switchHero(W, 'jay'); ok(!W.allies.some(q => q.type === 'c_jay') && W.inv.ash === ash + T.c_jay.cost, 'Сойка-спутник осталась, став героем');
  const W2 = mk(11, 'vale', 30); restoreAllies(W2, [{ type: 'c_vale', hp: 50 }, { type: 'c_irga', hp: 50 }, { type: 'c_irga', hp: 50 }]); ok(W2.allies.length === 1 && W2.allies[0].type === 'c_irga', 'сохранение: свой герой или двойник в отряде'); }
// бот: отряд из трёх сам разбирает стаю, никто не стоит без дела, не гибнет и после боя идёт за героем
{ let kills = 0, deaths = 0, idle = 0, total = 0, lost = 0;
  for (let sd = 0; sd < 6; sd++) {
    const W = mk(100 + sd, 'vale', 20); const ps = party(W, 'c_thorn', 'c_irga', 'c_jay');
    const es = []; for (let i = 0; i < 6; i++) { const ang = i / 6 * Math.PI * 2; es.push(foe(W, i % 2 ? 'imp' : 'brute', Math.sin(ang) * 7, Math.cos(ang) * 7, CFG3.enemies[i % 2 ? 'imp' : 'brute'].hp * 1.5)); }
    run(W, 45, {}, () => { if (es.some(e => !e.dead)) for (const a of ps) if (!a.dead) { total++; if (a.state === 'idle' && !a.moving && !(a.hcd > 0)) idle++; } });
    kills += es.filter(e => e.dead).length; deaths += ps.filter(a => a.dead || !W.allies.includes(a)).length;
    run(W, 3); lost += liveAllies(W).filter(a => dist(a, W.player) > 7).length;
  }
  ok(kills === 36, `отряд не разобрал стаи: убито ${kills}/36`); ok(deaths <= 1, 'спутники гибнут: ' + deaths); ok(idle / total < .25, `спутники стоят без дела ${(idle / total * 100).toFixed(0)}% боя`); ok(!lost, 'после боя спутники не вернулись к герою: ' + lost);
  console.log(`бот отряда: убито ${kills}/36, гибелей ${deaths}, простой ${(idle / total * 100).toFixed(0)}%`); }
// босс тоже держится на защитнике
{ const cfg = JSON.parse(JSON.stringify(CFG3)); cfg.enemies.count = 0; const W = createWorld(cfg, mulberry32(12)); W.hero = 'vale'; W.lv = 30; const e = W.enemies.find(q => q.boss && q.type === 'devourer');
  W.player.x = e.x + 6; W.player.z = e.z; W.player.inv = 1e9; const [t] = party(W, 'c_thorn'); t.x = e.x + 2; t.z = e.z; e.alert = true; e.thr = { 0: 30 };
  let onT = 0, n = 0; run(W, 10, {}, () => { n++; if (e.tgt === t.id) onT++; t.hp = t.maxhp; }); ok(onT / n > .6, `босс не держится на защитнике: ${(onT / n * 100).toFixed(0)}%`); }

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Отряд-спутники 3D: OK');
