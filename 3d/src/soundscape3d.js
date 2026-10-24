// Атмосфера звука (D1): чистая логика без Web Audio (проверяется в Node).
// mixOf — громкость слоёв по месту героя: журчание у реки, птицы днём, сова ночью, музыка; бой и подземелье их глушат.
// composePiece — своя музыка «лесная сказка»: вальс 3/4, форма AABA из фраз по 8 тактов, мелодия по аккордам с зерном
// (каждый раз новая, ничего не копирует): флейта, арфа-переборы, струнный фон с басом, хор «а-а» без слов.
// birdSong / owlCall — трели птиц и уханье совы (слоги со свистом частоты).
import { waterDist, streamDist } from './terrain3d.js';
import { mulberry32 } from './sim.js';

const clamp01 = v => Math.max(0, Math.min(1, v));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// подземный фон темы (план подземелий, 2е): { drip, rumble, wind } из dungeons.themes.list[тема].sound; наверху — null
export function underSound(W) {
  const L = W.levels && W.levels[W.lvl], d = L && L.def, T = W.cfg.dungeons && W.cfg.dungeons.themes; if (!d || !T || !T.on || String(W.lvl).startsWith('up:')) return null;
  const id = d.theme || T.by[d.id] || (d.abyss ? T.abyss : null) || T.def; return (T.list[id] && T.list[id].sound) || null;
}
export function mixOf(W, A, env) {
  const p = W.player, under = W.lvl !== 'surface' && !String(W.lvl).startsWith('up:');     // второй этаж дома — не подземелье: музыка и птицы слышны
  let n = 0; for (const e of W.enemies) if (!e.dead && e.alert && Math.hypot(e.x - p.x, e.z - p.z) < A.combat.r) n++;
  const combat = p.dead ? 0 : clamp01(n / A.combat.n), danger = clamp01(W.place && W.place.danger ? W.place.danger / 3 : 0);
  const rv = !under && W.map.river, d = rv ? Math.max(0, Math.min(waterDist(rv, p.x, p.z), streamDist(rv, p.x, p.z) + 3)) : 1e9;     // ручей журчит тише реки (как будто на 3 м дальше)
  const US = under ? underSound(W) : null, water = rv ? 1 - smooth(A.water.near, A.water.far, d) : US ? US.drip * (A.water.under ?? .6) : 0;     // под землёй «бульки» — капель темы (2е)
  const day = under ? 0 : smooth(A.birds.day[0], A.birds.day[1], W.light);
  const wetK = env && env.rain ? clamp01(env.rain) : 0;
  const birds = day * (1 - danger * .8) * (1 - combat) * (1 - wetK), owl = under ? 0 : (1 - day) * (W.night ? 1 : 0) * (1 - combat);
  const music = under || p.dead ? 0 : (1 - combat) * (W.night ? A.music.nightVol : 1);
  const rustle = under || !env ? 0 : Math.pow(clamp01(env.wind), 1.5) * clamp01(env.trees);     // шелест: ветер и деревья рядом
  const frog = under || !A.birds.frogNear ? 0 : (1 - day) * Math.max(0, 1 - d / A.birds.frogNear) * (1 - combat) * (1 - wetK * .5);     // лягушки у воды в сумерках и ночью
  let boss = false; for (const e of W.enemies) if (e.boss && !e.dead && e.alert && Math.hypot(e.x - p.x, e.z - p.z) < A.combat.r * 2.5) boss = true;     // босс в бою — своя тема (этап 1 «круче»)
  const fight = A.fight && A.fight.on && !p.dead ? Math.max(combat, boss ? 1 : 0) : 0;
  return { water, birds, owl, frog, music, combat, fight, boss: boss && !p.dead, night: !!W.night, under, rustle, rain: under ? 0 : wetK };
}

// ---- музыка ----
const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10], ROOT = 62;     // ре мажор днём, ре минор ночью
export const midiOf = (deg, scale) => ROOT + 12 * Math.floor(deg / 7) + scale[((deg % 7) + 7) % 7];
const PROG = {
  day: { A: [[0, 3, 0, 4, 0, 3, 4, 0], [0, 5, 3, 4, 0, 5, 4, 0], [0, 4, 5, 3, 0, 3, 4, 0]], B: [[5, 3, 0, 4, 5, 3, 1, 4], [3, 4, 2, 5, 3, 4, 1, 4]] },
  night: { A: [[0, 5, 6, 0, 0, 3, 4, 0], [0, 6, 5, 6, 0, 3, 6, 0], [0, 3, 5, 4, 0, 5, 4, 0]], B: [[5, 6, 2, 3, 5, 6, 4, 4], [3, 2, 5, 6, 3, 2, 4, 4]] }
};
const RHYTHM = [[2, 1], [1, 1, 1], [3], [1.5, .5, 1], [1, .5, .5, 1], [1, 2]], CADENCE = [[3], [2, 1]];
const pick = (r, a) => a[Math.floor(r() * a.length)];

// мелодия фразы: первая нота такта — звук аккорда рядом с прошлой, остальные — шагом по ладу к «дуге» фразы; конец — тоника
function melody(r, chords, lo, hi, start, peak, keep = null) {
  const bars = []; let cur = start;
  for (let b = 0; b < chords.length; b++) {
    if (keep && keep[b]) { bars.push(keep[b]); cur = keep[b][keep[b].length - 1].deg; continue; }
    const end = b === chords.length - 1, half = b === chords.length / 2 - 1, rh = end || half ? pick(r, CADENCE) : pick(r, RHYTHM);
    const ch = [0, 2, 4].map(k => chords[b] + k), aim = lo + (peak - lo) * Math.sin(Math.PI * (b + .5) / chords.length), notes = []; let t = 0;
    rh.forEach((len, i) => {
      if (end && i === rh.length - 1) { const tons = [0, 7, 14, 21].filter(v => v >= lo && v <= hi); cur = tons.reduce((a, v) => (Math.abs(v - cur) < Math.abs(a - cur) ? v : a), tons[0]); }
      else if (i === 0) { const c = []; for (let o = -14; o <= 21; o += 7) for (const k of ch) { const v = k + o; if (v >= lo && v <= hi) c.push(v); } const nearC = c.filter(v => Math.abs(v - cur) <= 3); cur = nearC.length ? pick(r, nearC) : c.reduce((a, v) => (Math.abs(v - cur) < Math.abs(a - cur) ? v : a), c[0]); }
      else { const dir = cur < aim ? 1 : cur > aim ? -1 : (r() < .5 ? 1 : -1), step = r() < .2 ? 2 : 1; cur = Math.max(lo, Math.min(hi, cur + (r() < .8 ? dir : -dir) * step)); }
      notes.push({ t, len, deg: cur }); t += len;
    });
    bars.push(notes);
  }
  return bars;
}

export function composePiece(seed, night = false, M = { dayBpm: 84, nightBpm: 70, phrase: 8, form: 'AABA' }) {
  const r = mulberry32(seed * 7919 + 13), key = night ? 'night' : 'day', scale = night ? MINOR : MAJOR, P = PROG[key];
  const bpm = night ? M.nightBpm : M.dayBpm, beat = 60 / bpm, barT = beat * 3;
  const lo = night ? 5 : 7, hi = night ? 13 : 15;
  const progA = pick(r, P.A), progB = pick(r, P.B);
  const A1 = melody(r, progA, lo, hi, lo + 2, hi - 2);
  const keepA = A1.map((b, i) => (i < progA.length - 2 ? b : null));
  const phrases = [];
  for (let i = 0; i < M.form.length; i++) {
    const f = M.form[i];
    if (f === 'B') phrases.push({ f, prog: progB, mel: melody(r, progB, lo + 1, hi, A1[A1.length - 1][0].deg, hi) });
    else phrases.push({ f, prog: progA, mel: i === 0 ? A1 : melody(r, progA, lo, hi, lo + 2, hi - 2, keepA) });     // повтор A: начало то же, конец новый
  }
  const notes = []; let bar = 0;
  phrases.forEach((ph, pi) => {
    const last = pi === phrases.length - 1, rich = ph.f === 'B' || last;
    ph.prog.forEach((root, b) => {
      const t0 = bar * barT, chord = [0, 2, 4].map(k => root + k);
      for (const k of chord) notes.push({ part: 'pad', t: t0, d: barT * .9, m: midiOf(k, scale), v: .5 });
      notes.push({ part: 'bass', t: t0, d: barT, m: midiOf(root - 7, scale), v: .7 });
      if (pi > 0) [0, 2, 4, 7, 4, 2].forEach((k, i) => notes.push({ part: 'harp', t: t0 + i * beat / 2, d: beat * 1.5, m: midiOf(root + k - 7, scale), v: i ? .5 : .7 }));
      if (rich) for (const k of [root + 2, root + 4]) notes.push({ part: 'choir', t: t0, d: barT * 1.05, m: midiOf(k, scale), v: .5 });
      for (const n of ph.mel[b]) notes.push({ part: 'flute', t: t0 + n.t * beat, d: n.len * beat * .95, m: midiOf(n.deg, scale), v: .8, deg: n.deg });
      bar++;
    });
  });
  notes.sort((a, b) => a.t - b.t);
  return { bpm, beat, bars: bar, dur: bar * barT, night, scale, notes };
}

// ---- боевая музыка (этап 1 «круче»): такт 4/4 поверх стихшего вальса. Ре минор; бочка и том — всегда, бас-остинато,
// при сильном бою (intensity > .5) — удары струнных, с боссом — хор и медь. Ноты { part, t (доли такта в секундах), d, m, v } ----
const FIGHT_PROG = [[0, 0, 5, 4], [0, 3, 5, 4], [0, 5, 3, 4]];
export function fightBar(seed, bar, intensity = 1, boss = false, F = { bpm: 128, bossBpm: 138 }) {
  const r = mulberry32((seed * 7919 + bar * 104729) >>> 0), beat = 60 / (boss ? F.bossBpm : F.bpm), prog = FIGHT_PROG[seed % FIGHT_PROG.length], root = prog[bar % 4], notes = [];
  for (let b = 0; b < 4; b++) {
    notes.push({ part: 'kick', t: b * beat, d: .18, v: b % 2 ? .7 : 1 });
    if (b % 2) notes.push({ part: 'tom', t: b * beat + beat / 2, d: .16, v: .6 + .2 * r() });
    for (const h of [0, .5]) notes.push({ part: 'fbass', t: (b + h) * beat, d: beat * .45, m: midiOf(root - 14 + (h ? 4 : 0), MINOR), v: h ? .6 : .85 });
  }
  if (intensity > .5) for (const b of [0, 2.5]) for (const k of [0, 2, 4]) notes.push({ part: 'stab', t: b * beat, d: beat * .4, m: midiOf(root + k - 7, MINOR), v: .6 });
  if (boss) {
    for (const k of [0, 4]) notes.push({ part: 'choir', t: 0, d: beat * 4, m: midiOf(root + k, MINOR), v: .55 });
    for (const [b, k] of [[0, 7], [1.5, 6], [3, 4]]) notes.push({ part: 'brass', t: b * beat, d: beat * .9, m: midiOf(root + k - 7, MINOR), v: .7 });
  }
  return { beat, dur: beat * 4, notes };
}

// ---- птицы и сова: слоги { t, d, f0, f1, v } ----
export function birdSong(r) {
  const kind = Math.floor(r() * 3), out = [];
  if (kind === 0) { const n = 4 + Math.floor(r() * 6), f = 3000 + r() * 1500; for (let i = 0; i < n; i++) out.push({ t: i * .07, d: .045, f0: f, f1: f * 1.15, v: .7 + .3 * r() }); }                      // трель
  else if (kind === 1) { const n = 2 + Math.floor(r() * 2); let t = 0; for (let i = 0; i < n; i++) { const up = i % 2 === 0, f = 2000 + r() * 900; out.push({ t, d: .22, f0: up ? f : f * 1.35, f1: up ? f * 1.35 : f, v: .8 }); t += .3; } }  // свист
  else { const n = 2 + Math.floor(r() * 3); for (let i = 0; i < n; i++) out.push({ t: i * .13, d: .08, f0: 5200 - r() * 600, f1: 3000, v: .7 }); }     // чирик
  return { kind, syl: out };
}
// кваканье: два-три коротких низких «ква» с изломом частоты
export const frogCall = r => { const f = 150 + r() * 70, n = 2 + (r() * 2 | 0); return Array.from({ length: n }, (_, i) => ({ t: i * .19, d: .12, f0: f * 1.25, f1: f * .8, v: 1 - i * .15 })); };
export const owlCall = r => { const f = 360 + r() * 40; return [{ t: 0, d: .35, f0: f, f1: f * .92, v: 1 }, { t: .55, d: .5, f0: f * 1.02, f1: f * .88, v: .9 }]; };
