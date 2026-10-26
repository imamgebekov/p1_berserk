// Тест атмосферы звука 3D (шаг D1): уровни слоёв по месту (река, день и ночь, бой, подземелье, опасность), своя музыка
// (повторяемость по зерну, лад, диапазон, такты 3/4, форма AABA, длина куска, ночь — минор и медленнее), птицы и сова,
// движок на поддельном AudioContext: предел голосов, ноты только в будущем, отдых между кусками, бой и «без звука» глушат.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, mulberry32, spawnEnemy } from '../3d/src/sim.js';
import { waterDist } from '../3d/src/terrain3d.js';
import { mixOf, composePiece, birdSong, owlCall, fightBar, underSound, surfaceOf } from '../3d/src/soundscape3d.js';
import { biomeAt } from '../3d/src/worldgen3d.js';
import { travel } from '../3d/src/levels3d.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const musicOn = c => { for (const k of ['music', 'fight', 'tracks']) if (c.audio[k]) c.audio[k].on = true; return c; };     // 5.04: в игре встроенная музыка выключена — тест включает её и проверяет код
const clone = () => musicOn(JSON.parse(JSON.stringify(CFG3)));
const A = clone().audio;
ok(['music', 'fight', 'tracks'].every(k => !CFG3.audio[k] || CFG3.audio[k].on === false), 'встроенная музыка в игре не выключена');     // 5.04: владелец ставит свою музыку
const mk = (c = clone()) => { c.enemies.count = 0; c.bosses.list = []; c.events.on = false; c.wanderer.on = false; return createWorld(c, mulberry32(1)); };

// ---------- 1. уровни слоёв ----------
{
  const W = mk(), p = W.player, rv = W.map.river, P = rv.pts[rv.pts.length >> 1], Q = rv.pts[(rv.pts.length >> 1) + 1];
  const dx = Q.x - P.x, dz = Q.z - P.z, l = Math.hypot(dx, dz), nx = -dz / l, nz = dx / l;
  const side = Math.hypot(P.x + nx * 10, P.z + nz * 10) < Math.hypot(P.x - nx * 10, P.z - nz * 10) ? 1 : -1;      // к центру мира
  W.light = 1; W.night = false;
  let prev = 2; const lv = [];
  for (const off of [rv.w / 2 + 1, 5, 10, 15, 20, 24, 30, 40]) { p.x = P.x + nx * side * off; p.z = P.z + nz * side * off; const m = mixOf(W, A); lv.push([waterDist(rv, p.x, p.z).toFixed(1), m.water.toFixed(2)]); ok(m.water <= prev + 1e-9, 'журчание не стихает с расстоянием: ' + JSON.stringify(lv)); prev = m.water; }
  ok(+lv[0][1] > .95 && +lv[lv.length - 1][1] === 0, 'у берега не громко или далеко не тихо: ' + JSON.stringify(lv));
  p.x = P.x + nx * side * 3; p.z = P.z + nz * side * 3;
  const day = mixOf(W, A); ok(day.birds > .95 && day.owl === 0 && day.music === 1 && !day.under, 'днём нет птиц или музыки: ' + JSON.stringify(day));
  W.light = .1; W.night = true; const night = mixOf(W, A);
  ok(night.birds === 0 && night.owl > .95 && Math.abs(night.music - A.music.nightVol) < 1e-9 && night.night, 'ночью птицы, нет совы или музыка не тише: ' + JSON.stringify(night));
  W.light = 1; W.night = false;
  for (let i = 0; i < A.combat.n; i++) { const e = spawnEnemy(W, 'brute', p.x + 3 + i, p.z); e.alert = true; }
  const fight = mixOf(W, A); ok(fight.combat === 1 && fight.music === 0 && fight.birds === 0, 'бой не глушит музыку и птиц: ' + JSON.stringify(fight));
  ok(fight.fight === 1 && !fight.boss, 'в бою нет боевой музыки или ложный босс: ' + JSON.stringify(fight));     // этап 1 «круче»
  W.enemies.forEach(e => { e.alert = false; }); ok(mixOf(W, A).combat === 0 && mixOf(W, A).fight === 0, 'спокойные враги считаются боем');
  { const b = spawnEnemy(W, 'brute', p.x + 20, p.z); b.boss = true; b.alert = true; const m = mixOf(W, A); ok(m.boss && m.fight === 1, 'босс в бою без своей темы: ' + JSON.stringify(m)); b.dead = true; }
  W.enemies.length = 0;
  W.place = { danger: 3 }; ok(mixOf(W, A).birds < .25, 'в опасном месте птицы поют как в лагере'); W.place = null;
  W.lvl = 'crypt'; const und = mixOf(W, A); ok(und.under && !und.water && !und.birds && !und.owl && !und.music, 'под землёй слышна природа или музыка'); W.lvl = 'surface';
  p.dead = true; ok(mixOf(W, A).music === 0, 'музыка играет над павшим героем'); p.dead = false;
  const c = clone(); c.terrain.on = false; const F = mk(c); ok(mixOf(F, A).water === 0, 'без реки слышно воду');
}

// ---------- 2. музыка ----------
{
  const pcs = s => s.map(v => ((v % 12) + 12) % 12), MAJ = pcs([62, 64, 66, 67, 69, 71, 73]), MIN = pcs([62, 64, 65, 67, 69, 70, 72]);
  const flute = P => P.notes.filter(n => n.part === 'flute');
  const a = composePiece(5), b = composePiece(5), c2 = composePiece(6);
  ok(JSON.stringify(a) === JSON.stringify(b), 'одно зерно — разная музыка');
  ok(JSON.stringify(flute(a).map(n => n.m)) !== JSON.stringify(flute(c2).map(n => n.m)), 'разные зёрна — одна мелодия');
  const melodies = new Set(); for (let s = 1; s <= 20; s++) melodies.add(flute(composePiece(s)).map(n => n.m).join());
  ok(melodies.size >= 18, 'мало разных мелодий на 20 зёрен: ' + melodies.size);
  for (const night of [false, true]) for (let s = 1; s <= 12; s++) {
    const P = composePiece(s, night, A.music), F = flute(P), sc = night ? MIN : MAJ, tag = `${night ? 'ночь' : 'день'} ${s}`;
    ok(P.notes.every(n => sc.includes(((n.m % 12) + 12) % 12)), `${tag}: ноты вне лада`);
    ok(P.dur >= 60 && P.dur <= 90, `${tag}: кусок ${P.dur.toFixed(0)} с вне 60–90`);
    ok(P.bars === A.music.phrase * A.music.form.length, `${tag}: тактов ${P.bars}`);
    ok(F.every(n => n.m >= 67 && n.m <= 90), `${tag}: флейта вне диапазона`);
    ok(F.every((n, i) => !i || Math.abs(n.m - F[i - 1].m) <= 12), `${tag}: скачок мелодии больше октавы`);
    ok(((F[F.length - 1].m - 62) % 12 + 12) % 12 === 0, `${tag}: мелодия кончается не на тонике`);
    const barT = P.beat * 3, sums = new Array(P.bars).fill(0);
    for (const n of F) sums[Math.floor(n.t / barT + 1e-6)] += n.d / (.95 * P.beat);
    ok(sums.every(v => Math.abs(v - 3) < 1e-6), `${tag}: такт мелодии не 3/4: ${sums.map(v => v.toFixed(2)).join(' ')}`);
    const bar = (k, i) => { const j = k + i * A.music.phrase; return JSON.stringify(F.filter(n => Math.floor(n.t / barT + 1e-6) === j).map(n => [Math.round(n.t / P.beat * 4) / 4 - 3 * j, n.m])); };     // доля в такте и нота
    ok([0, 1, 2, 3, 4, 5].every(k => bar(k, 0) === bar(k, 1)), `${tag}: повтор A начинается не так же`);
    ok([0, 1, 2, 3, 4, 5, 6, 7].some(k => bar(k, 0) !== bar(k, 2)), `${tag}: средняя часть B совпадает с A`);
    ok(['pad', 'bass', 'harp', 'choir'].every(pt => P.notes.some(n => n.part === pt)), `${tag}: нет какого-то инструмента`);
    ok(P.notes.every((n, i) => !i || n.t >= P.notes[i - 1].t), `${tag}: ноты не по порядку`);
  }
  ok(composePiece(3, true, A.music).bpm < composePiece(3, false, A.music).bpm, 'ночная музыка не медленнее');
  ok(composePiece(3, true, A.music).notes.some(n => ((n.m - 62) % 12 + 12) % 12 === 3), 'ночью нет минорной терции');
}

// ---------- 3. птицы и сова ----------
{
  const r = mulberry32(9), kinds = new Set();
  for (let i = 0; i < 60; i++) { const s = birdSong(r); kinds.add(s.kind); ok(s.syl.length >= 2 && s.syl.every(q => q.f0 >= 1500 && q.f0 <= 6000 && q.f1 >= 1500 && q.f1 <= 7000 && q.d > 0 && q.d < .5), 'трель вне частот птиц'); }
  ok(kinds.size === 3, 'не все виды птиц');
  const o = owlCall(r); ok(o.length === 2 && o.every(q => q.f0 < 500 && q.f1 < 500), 'сова не низкая');
}

// ---------- 4. движок на поддельном AudioContext ----------
{
  const starts = []; let clock = 0, bad = '';
  class Param { constructor(v = 0) { this.value = v; } chk(v, k) { if (!Number.isFinite(v)) bad = bad || 'нечисловое значение в ' + k; } setValueAtTime(v) { this.chk(v, 'setValueAtTime'); } linearRampToValueAtTime(v) { this.chk(v, 'linearRamp'); } exponentialRampToValueAtTime(v) { this.chk(v, 'expRamp'); if (!(v > 0)) bad = bad || 'expRamp к нулю'; } setTargetAtTime(v) { this.chk(v, 'setTarget'); this.value = v; } connect() {} }
  class Node { connect(n) { return n || this; } }
  class Osc extends Node { constructor() { super(); this.frequency = new Param(440); this.detune = new Param(); } start(t) { starts.push({ t: t === undefined ? clock : t, at: clock, f: this.frequency }); } stop() {} }
  class Src extends Node { constructor() { super(); this.playbackRate = new Param(1); } start() {} stop() {} }
  class FakeAC { constructor() { this.state = 'running'; this.sampleRate = 8000; this.destination = new Node(); } get currentTime() { return clock; }
    createGain() { const n = new Node(); n.gain = new Param(1); return n; } createOscillator() { return new Osc(); } createBufferSource() { return new Src(); }
    createBiquadFilter() { const n = new Node(); n.frequency = new Param(); n.Q = new Param(); return n; } createDelay() { const n = new Node(); n.delayTime = new Param(); return n; }
    createBuffer(c, len) { const d = new Float32Array(len); return { getChannelData: () => d }; } resume() {} suspend() {} }
  globalThis.AudioContext = FakeAC;
  const au = await import('../3d/src/audio3d.js');
  au.setAtmoRandom(mulberry32(4)); au.ensureAudio();
  const day = { water: .8, birds: 1, owl: 0, music: 1, combat: 0, night: false };
  const run = (mix, sec, cfg = A) => { const end = clock + sec; while (clock < end) { au.setScene(mix, cfg); au.tickAudio(); clock = +(clock + .2).toFixed(3); } };
  // предел голосов: с пределом 8 в сцене «день у реки» лишние голоса пропускаются (первый прогон — счётчик пиков чистый)
  run(day, 30, { ...A, voices: 8 }); { const s = au.audioStats(); ok(s.maxVoices <= 8 && s.skipped > 0, 'предел голосов не работает: ' + JSON.stringify(s)); }
  const n0 = starts.length; run(day, 5);
  ok(starts.length > n0, 'днём у реки ничего не звучит');
  run(day, 120); const s1 = au.audioStats();
  ok(s1.notes > 300 && s1.birds >= 10 && s1.plips > 100, 'мало нот, трелей или бульков: ' + JSON.stringify(s1));
  ok(s1.maxVoices <= A.voices, `голосов больше предела: ${s1.maxVoices}`);
  ok(s1.notes >= 389 - 60, 'музыка теряет ноты из-за предела: ' + JSON.stringify(s1));
  ok(starts.every(q => q.t >= q.at - 1e-9), 'нота поставлена в прошлое');
  ok(starts.every(q => q.t <= q.at + A.look + .7 + 1e-9), 'нота поставлена дальше, чем на look вперёд');
  ok(s1.pieces >= 1 && s1.pieces <= 2, 'кусков за 125 с: ' + s1.pieces);
  ok(!bad, bad);
  // отдых между кусками: после конца первого куска новая музыка не раньше rest[0]
  { let t = 0; while (au.audioStats().playing && t < 120) { run(day, .2); t += .2; } const n1 = au.audioStats().notes; run(day, A.music.rest[0] - 1); ok(au.audioStats().notes === n1, 'музыка без отдыха между кусками'); }
  // бой: ноты музыки и трели не ставятся; «без звука» и тишина в слоях — ни одного голоса
  { run(day, 70); const b = au.audioStats(); run({ ...day, music: 0, birds: 0, combat: 1 }, 15); const a = au.audioStats(); ok(a.notes === b.notes && a.birds === b.birds, 'в бою играет музыка или поют птицы'); }
  { const k = starts.length; run({ water: 0, birds: 0, owl: 0, music: 0, combat: 0, night: false }, 20); ok(starts.length === k, 'в тишине создаются голоса'); }
  { au.setMuted(true); const k = starts.length; run(day, 20); ok(starts.length === k, '«без звука» — голоса всё равно создаются'); au.setMuted(false); }
  { const k = au.audioStats().owls; run({ water: 0, birds: 0, owl: 1, music: .6, combat: 0, night: true }, 60); ok(au.audioStats().owls > k + 1, 'ночью сова не ухает'); }
  // старые звуки на месте
  ok(au.SFX_NAMES.length > 40 && au.SFX_NAMES.includes('hit') && au.SFX_NAMES.includes('dusk'), 'пропали звуки событий');
}

// боевая музыка (этап 1 «круче»): такт 4/4, ноты внутри такта; лёгкий бой — ударные и бас; сильный — и струнные; босс — хор, медь, темп выше
{ const F = CFG3.audio.fight, lo = fightBar(3, 0, .3, false, F), hi = fightBar(3, 0, 1, false, F), bo = fightBar(3, 0, 1, true, F), parts = b => new Set(b.notes.map(n => n.part));
  ok(JSON.stringify(fightBar(3, 1, 1, false, F)) === JSON.stringify(fightBar(3, 1, 1, false, F)), 'такт боя не повторяется при том же зерне');
  ok(['kick', 'tom', 'fbass'].every(k => parts(lo).has(k)) && !parts(lo).has('stab'), 'лёгкий бой: не ударные и бас: ' + [...parts(lo)]);
  ok(parts(hi).has('stab') && !parts(hi).has('brass'), 'сильный бой без струнных или с медью');
  ok(parts(bo).has('choir') && parts(bo).has('brass') && bo.beat < hi.beat, 'босс без хора, меди или того же темпа');
  ok([lo, hi, bo].every(b => b.notes.every(n => n.t >= 0 && n.t < b.dur && n.d > 0)) && Math.abs(hi.dur - 4 * 60 / F.bpm) < 1e-9, 'ноты вне такта или такт не 4 доли'); }

// темы подземелий и их фон (план подземелий, 2е): 9 тем, у каждого подземелья своя из списка; затопленный зал — капель, кузнечные недра — гул
{ const T = CFG3.dungeons.themes, I = CFG3.dungeons.list.filter(d => d.inst); ok(Object.keys(T.list).length >= 9 && Object.values(T.list).every(t => t.sound), 'тем меньше 9 или без звука');
  ok(I.every(d => T.list[T.by[d.id]]), 'подземелье без своей темы: ' + I.filter(d => !T.list[T.by[d.id]]).map(d => d.id));
  const W = createWorld((() => { const c = clone(); c.enemies.count = 0; return c; })(), mulberry32(3));
  travel(W, 'inst_drown', 0, 0); const wet = mixOf(W, W.cfg.audio); ok(wet.under && wet.water > .3 && underSound(W).drip === 1, 'в затопленном зале нет капели: ' + JSON.stringify(wet));
  travel(W, 'inst_ash', 0, 0); const hot = mixOf(W, W.cfg.audio); ok(hot.under && !hot.water && underSound(W).rumble === 1, 'в кузнечных недрах капель или нет гула');
  travel(W, 'surface', 0, 4); ok(underSound(W) === null, 'подземный фон наверху'); }
// ---------- записи (2026-10-25): костёр, кузница, сверчки, поверхность для шагов ----------
{
  const W = mk(), p = W.player, F = (W.map.fires || [])[0], S = A.samples;
  ok(F, 'на карте нет костров');
  if (F) { p.x = F.x + 1; p.z = F.z; const a = mixOf(W, A).fire; p.x = F.x + S.fire.far + 5; const b = mixOf(W, A).fire; ok(a > .9 && b === 0, `костёр: рядом ${a}, далеко ${b}`); }
  const sm = W.map.buildings.find(b => b.npc && b.npc.kind === 'smith');
  ok(sm, 'нет кузницы с кузнецом');
  if (sm) { p.x = sm.npc.x; p.z = sm.npc.z; W.light = 1; const day = mixOf(W, A).smith; W.light = .1; const night = mixOf(W, A).smith; ok(day > .9 && night === 0, `кузница: днём ${day}, ночью ${night}`); ok(surfaceOf(W) === 'wood', 'в кузнице шаги не по дереву: ' + surfaceOf(W)); }
  W.light = .1; W.night = true; p.x = 400; p.z = 400; const nm = mixOf(W, A); W.light = 1; W.night = false; const dm = mixOf(W, A);
  ok(nm.crickets > .9 && dm.crickets < .05, `сверчки: ночью ${nm.crickets}, днём ${dm.crickets}`);
  const kinds = new Set(); for (let a = 0; a < 40; a++) { p.x = Math.sin(a) * (300 + a * 10); p.z = Math.cos(a) * (300 + a * 10); if (W.map.buildings.every(b => !(p.x > b.ix0 && p.x < b.ix1 && p.z > b.iz0 && p.z < b.iz1))) { const s = surfaceOf(W), bio = biomeAt(W.cfg, p.x, p.z); kinds.add(s); ok(s === (bio === 'mountains' ? 'stone' : bio === 'waste' || bio === 'coast' ? 'sand' : 'grass'), `шаги: биом ${bio} → ${s}`); } }
  ok(kinds.size >= 2, 'шаги: по миру одна поверхность: ' + [...kinds]);
  W.lvl = 'dummy-under'; ok(surfaceOf(W) === 'stone', 'под землёй шаги не по камню');
}

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Атмосфера звука 3D: OK');
