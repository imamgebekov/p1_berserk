// Звук 3D: всё синтезируется (осцилляторы и шум), файлов нет. Контекст создаётся по первому касанию (правило iOS).
import { composePiece, birdSong, owlCall, frogCall, fightBar } from './soundscape3d.js';
import { CFG3 } from './config3d.js';
let ac = null, master = null, sfxBus = null, out = null, noiseBuf = null, amb = null, volume = .7, muted = false, lastT = {}, vp = 1;
const FX = () => ((A && A.fx) || CFG3.audio.fx);     // числа сведения: из cfg.audio (setScene) или по умолчанию

// кривая ограничителя: до k — прямая, выше — плавно к 1 (tanh)
export function limitCurve(k, n = 2048) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1, a = Math.abs(x); c[i] = a <= k ? x : Math.sign(x) * (k + (1 - k) * Math.tanh((a - k) / (1 - k))); }
  return c;
}
export function ensureAudio() {
  if (!ac) {
    try {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) return;
      ac = new AC(); master = ac.createGain(); master.gain.value = muted ? 0 : volume;
      // шаг 8: громкость → мягкий ограничитель → выход (наложение звуков не хрипит; тихое проходит как есть, без задержки)
      const L = FX().limit; if (ac.createWaveShaper && L) { const w = ac.createWaveShaper(); w.curve = limitCurve(L); w.oversample = '2x'; master.connect(w).connect(ac.destination); } else master.connect(ac.destination);
      sfxBus = ac.createGain(); sfxBus.gain.value = user.sfx; sfxBus.connect(master); out = sfxBus;
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // фон: ветер (шум через фильтр с медленным качанием) и низкий гул затмения
      const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
      src.buffer = noiseBuf; src.loop = true; f.type = 'bandpass'; f.frequency.value = 380; f.Q.value = .6; g.gain.value = 0;
      lfo.frequency.value = .11; lg.gain.value = 140; lfo.connect(lg).connect(f.frequency); src.connect(f).connect(g).connect(master); src.start(); lfo.start();
      const o1 = ac.createOscillator(), o2 = ac.createOscillator(), lf = ac.createBiquadFilter(), dg = ac.createGain();
      o1.type = o2.type = 'triangle'; o1.frequency.value = 55; o2.frequency.value = 55.7; lf.type = 'lowpass'; lf.frequency.value = 150; dg.gain.value = 0;
      o1.connect(lf); o2.connect(lf); lf.connect(dg).connect(master); o1.start(); o2.start();
      amb = { wind: g, drone: dg };
      buildAtmo();
    } catch (e) { ac = null; }
  }
  if (ac && ac.state !== 'running') { try { ac.resume(); } catch (e) { /* без звука */ } }
}
export const setVolume = v => { volume = Math.min(1, Math.max(0, Number(v) || 0)); if (master) master.gain.value = muted ? 0 : volume; };
let user = { music: 1, sfx: 1 };     // 4.08: ползунки игрока «Музыка» и «Звуки» (0–1), поверх чисел config3d
export function setUserMix(music, sfx) { const k = v => Math.min(1, Math.max(0, Number(v))); user = { music: k(music ?? 1), sfx: k(sfx ?? 1) }; if (sfxBus) sfxBus.gain.value = user.sfx; if (atmo) applyMix(); }
export const setMuted = m => { muted = !!m; if (master) master.gain.value = muted ? 0 : volume; };
export const isMuted = () => muted;
export function suspendAudio(on) { if (!ac) return; try { if (on) ac.suspend(); else ac.resume(); } catch (e) { /* без звука */ } }

// фон по времени суток: ночью ветер сильнее; гул — только ночью и в опасном месте (шаг 8); light 0..1
export function setAmbient(light, danger = 0) {
  if (!amb || !ac) return;
  const t = ac.currentTime, D = FX().drone, night = Math.min(1, Math.max(0, (.5 - light) / .3));
  amb.wind.gain.setTargetAtTime(.018 + (1 - light) * .03, t, .8);
  amb.drone.gain.setTargetAtTime(D.night * night + D.danger * danger, t, .8);
}

// тон: начинается с нуля за att (без щелчка), высокие срезаны фильтром (мягче «8 бит»); vp — разброс высоты текущего звука
function tone(f, dur, type = 'triangle', vol = .05, to = 0, delay = 0) {
  if (!ac || muted) return;
  const X = FX(), t = ac.currentTime + delay, o = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
  f *= vp; to *= vp;
  o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  lp.type = 'lowpass'; lp.frequency.value = Math.min(X.lpMax, Math.max(f, to) * X.lpK);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + X.att); g.gain.exponentialRampToValueAtTime(.001, t + Math.max(dur, X.att * 2));
  o.connect(lp).connect(g).connect(out); o.start(t); o.stop(t + dur + .02);
}
// шум: с разного места буфера (не одинаково), короткая атака, полоса фильтра со сдвигом высоты vp
function noise(dur, vol, fc, fc2, type = 'lowpass', delay = 0) {
  if (!ac || muted) return;
  const t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuf; s.loop = true; f.type = type; f.frequency.setValueAtTime(fc * vp, t); if (fc2) f.frequency.exponentialRampToValueAtTime(fc2 * vp, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .003); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  s.connect(f).connect(g).connect(out); s.start(t, Math.random() * .9); s.stop(t + dur + .02);
}

// набор звуков по событиям мира. Частые звуки не чаще раза в `gap` секунд, чтобы не превращаться в кашу.
const SFX = {
  swing: { gap: .06, f: () => noise(.14, .09, 1800, 500, 'bandpass') },
  roll: { gap: .2, f: () => noise(.2, .07, 700, 250) },
  hit: { gap: .04, f: () => { noise(.1, .12, 1500, 300); tone(150, .09, 'triangle', .08, 70); } },
  strike: { gap: .04, f: () => { noise(.12, .14, 1200, 250); tone(120, .12, 'sawtooth', .06, 55); } },
  finisher: { gap: .1, f: () => { tone(90, .3, 'sawtooth', .09, 40); noise(.25, .15, 900, 150); } },
  hurt: { gap: .1, f: () => { tone(200, .22, 'sawtooth', .08, 70); noise(.12, .1, 600, 200); } },
  die: { gap: .05, f: () => tone(260, .22, 'triangle', .064, 60) },
  eliteKill: { gap: .2, f: () => { noise(.3, .14, 1600, 200); tone(330, .3, 'triangle', .07, 165); tone(660, .35, 'triangle', .05, 0, .08); } },     // ощущение боя (этап 1)
  bossKill: { gap: 1, f: () => { noise(.8, .2, 900, 60); tone(65, .9, 'sawtooth', .12, 33); for (let i = 0; i < 4; i++) tone([392, 523, 659, 784][i], .6, 'triangle', .07, 0, .35 + i * .12); } },
  streak: { gap: .15, f: () => { tone(880, .07, 'triangle', .04); tone(1320, .1, 'triangle', .035, 0, .05); } },
  hurtBig: { gap: .25, f: () => { noise(.18, .18, 500, 90); tone(90, .25, 'sawtooth', .1, 45); } },
  slam: { gap: .2, f: () => { noise(.35, .16, 400, 60); tone(55, .4, 'sine', .12, 30); } },     // приёмы врагов (этап 2 «круче»)
  spit: { gap: .2, f: () => { noise(.18, .08, 1800, 600, 'bandpass'); tone(320, .12, 'triangle', .03, 180); } },
  howl: { gap: .5, f: () => { tone(330, .9, 'sawtooth', .04, 520); tone(495, .9, 'sawtooth', .03, 780, .05); } },
  pullStart: { gap: .3, f: () => noise(.5, .06, 300, 1200, 'bandpass') },
  pull: { gap: .3, f: () => { noise(.2, .12, 900, 200); tone(140, .2, 'triangle', .06, 90); } },
  skin: { gap: .5, f: () => { noise(.4, .12, 250, 120); tone(90, .4, 'triangle', .06, 70); } },
  phase: { gap: .5, f: () => { noise(.5, .07, 3000, 600, 'highpass'); tone(880, .4, 'sine', .03, 440); } },
  chill: { gap: .4, f: () => { noise(.3, .06, 4000, 1500, 'highpass'); tone(1200, .25, 'sine', .03, 900); } },     // свойства элиты (этап 2 «круче»)
  mirror: { gap: .2, f: () => { tone(1568, .12, 'triangle', .04); tone(1175, .15, 'triangle', .03, 0, .05); } },
  eliteCall: { gap: .5, f: () => { tone(220, .5, 'sawtooth', .04, 330); noise(.3, .06, 800, 300); } },
  heart: { gap: .3, f: () => { tone(58, .12, 'sine', .14, 40); tone(52, .14, 'sine', .11, 36, .17); } },
  dodge: { gap: .1, f: () => tone(700, .08, 'triangle', .03, 1000) },
  pickup: { gap: .05, f: () => { tone(740, .06, 'triangle', .056); tone(988, .08, 'triangle', .056, 0, .06); } },
  ash: { gap: .05, f: () => tone(1200, .05, 'triangle', .03) },
  open: { gap: .1, f: () => { noise(.18, .08, 500, 1400, 'bandpass'); tone(180, .12, 'triangle', .048, 120); } },
  unlock: { gap: .1, f: () => { tone(900, .05, 'triangle', .064); tone(1300, .08, 'triangle', .064, 0, .07); } },
  locked: { gap: .2, f: () => tone(110, .15, 'triangle', .096, 90) },
  full: { gap: .3, f: () => tone(130, .18, 'triangle', .08, 100) },
  heal: { gap: .3, f: () => { tone(520, .12, 'triangle', .05, 780); tone(780, .14, 'triangle', .04, 1040, .1); } },
  buff: { gap: .3, f: () => tone(330, .25, 'triangle', .05, 660) },
  level: { gap: .5, f: () => { for (let i = 0; i < 4; i++) tone([392, 494, 587, 784][i], .22, 'triangle', .08, 0, i * .1); } },
  questaccept: { gap: .3, f: () => { tone(330, .1, 'triangle', .05); tone(440, .14, 'triangle', .05, 0, .1); } },
  questready: { gap: .3, f: () => { tone(523, .1, 'triangle', .05); tone(784, .18, 'triangle', .05, 0, .1); } },
  questdone: { gap: .5, f: () => { for (let i = 0; i < 3; i++) tone([523, 659, 880][i], .2, 'triangle', .08, 0, i * .09); } },
  craft: { gap: .3, f: () => { tone(220, .06, 'triangle', .096); tone(330, .06, 'triangle', .096, 0, .08); noise(.1, .1, 2500, 800, 'bandpass', .14); } },
  upgrade: { gap: .3, f: () => { tone(180, .08, 'triangle', .112); noise(.16, .12, 3000, 900, 'bandpass', .06); tone(660, .2, 'triangle', .05, 990, .12); } },
  tome: { gap: .3, f: () => { noise(.25, .05, 1200, 2400, 'bandpass'); tone(440, .3, 'triangle', .04, 660, .1); } },
  hire: { gap: .3, f: () => { tone(196, .15, 'triangle', .08); tone(294, .2, 'triangle', .08, 0, .13); } },
  tomb: { gap: .3, f: () => { tone(440, .1, 'triangle', .05); tone(660, .3, 'triangle', .05, 0, .09); } },
  react: { gap: .1, f: () => { noise(.2, .12, 2200, 400); tone(300, .2, 'sawtooth', .05, 100); } },
  sun: { gap: .2, f: () => { noise(.25, .12, 2400, 600); for (let i = 0; i < 3; i++) tone([784, 988, 1175][i], .5, 'triangle', .06, 0, i * .03); } },     // золото (G3b): вспышка «Солнца»
  aegisUp: { gap: 1, f: () => { tone(1319, .4, 'sine', .04); tone(1760, .5, 'sine', .03, 0, .08); } },
  aegis: { gap: .15, f: () => { tone(1568, .18, 'triangle', .06); noise(.08, .06, 3000, 1500); } },
  reflect: { gap: .15, f: () => { tone(1175, .15, 'triangle', .048); tone(1568, .2, 'triangle', .04, 0, .04); } },
  boom: { gap: .15, f: () => { noise(.5, .22, 700, 80); tone(70, .4, 'sawtooth', .12, 35); } },
  bossaggro: { gap: 1, f: () => { tone(60, 1, 'sawtooth', .14, 38); tone(64, 1, 'sawtooth', .1, 40); noise(.8, .08, 300, 90); } },
  bossphase: { gap: 1, f: () => { tone(80, .7, 'sawtooth', .13, 45); noise(.5, .12, 600, 100); } },
  bossblast: { gap: .3, f: () => { noise(.55, .24, 600, 70); tone(55, .5, 'sawtooth', .14, 30); } },
  bossdead: { gap: 1, f: () => { for (let i = 0; i < 5; i++) tone(330 - i * 40, .5, 'sawtooth', .07, 90, i * .12); noise(.9, .1, 500, 80); } },
  dusk: { gap: 2, f: () => { tone(110, 1.4, 'sine', .08, 82); tone(165, 1.4, 'sine', .05, 123, .05); } },
  dawn: { gap: 2, f: () => { tone(330, 1.2, 'sine', .06, 494); tone(494, 1.2, 'sine', .04, 659, .1); } },
  shot: { gap: .1, f: () => { noise(.16, .08, 900, 2600, 'bandpass'); tone(520, .1, 'triangle', .03, 880); } },
  elite: { gap: 1.5, f: () => { tone(90, .5, 'sawtooth', .09, 50); tone(135, .5, 'square', .03, 75); } },
  travel: { gap: .5, f: () => { for (let i = 0; i < 3; i++) noise(.08, .07, 400, 150, 'lowpass', i * .13); tone(70, .45, 'sine', .07, 50, .05); } },
  rare: { gap: .3, f: () => { tone(880, .12, 'triangle', .05, 1320); tone(1320, .2, 'sine', .035, 1760, .08); } },
  brand: { gap: .5, f: () => { for (let i = 0; i < 4; i++) tone(660 * (1 + i * .25), .3, 'triangle', .045, 990 * (1 + i * .25), i * .07); noise(.4, .03, 3000, 6000, 'highpass', .1); } },
  wanderer: { gap: 1, f: () => { for (let i = 0; i < 6; i++) tone([1568, 1760, 2093, 1760, 2349, 2093][i], .35, 'sine', .03, 0, i * .11); } },   // бубенцы повозки
  evStart: { gap: 1, f: () => { tone(392, .25, 'triangle', .05); tone(523, .4, 'triangle', .05, 0, .2); } },      // рожок
  ambush: { gap: .8, f: () => { for (let i = 0; i < 3; i++) noise(.12, .06, 200, 80, 'lowpass', i * .14); tone(110, .5, 'sawtooth', .04, 70, .1); } },
  evDone: { gap: 1, f: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, .3, 'triangle', .045, 0, i * .1)); } },
  ability: { gap: .15, f: () => { tone(220, .25, 'sawtooth', .05, 440); noise(.3, .04, 600, 2400, 'bandpass'); tone(660, .2, 'triangle', .03, 990, .08); } },     // умение
  shoot: { gap: .08, f: () => { tone(520, .09, 'triangle', .04, 180); noise(.08, .03, 3000, 900, 'bandpass'); } },     // тетива
  recall: { gap: .5, f: () => { tone(330, .5, 'sine', .05, 990); noise(.5, .03, 400, 4000, 'bandpass'); } },
  spot: { gap: .4, f: () => { tone(160, .22, 'sawtooth', .05, 260); noise(.15, .04, 900, 300); } },
  block: { gap: .08, f: () => { tone(1400, .08, 'triangle', .08, 900); noise(.08, .08, 3000, 1500, 'bandpass'); } },
  fuse: { gap: .3, f: () => { noise(1.1, .05, 2500, 4000, 'highpass'); tone(300, 1.1, 'triangle', .032, 900); } },
  blink: { gap: .3, f: () => { tone(900, .25, 'sine', .05, 200); noise(.2, .04, 1200, 400); } },
  lunge: { gap: .2, f: () => noise(.3, .1, 600, 2400) },
  charge: { gap: .3, f: () => { tone(110, .55, 'sawtooth', .035, 220); noise(.5, .03, 300, 900, 'bandpass'); } },
  chargeFull: { gap: .3, f: () => { tone(660, .12, 'triangle', .06, 990); tone(990, .2, 'sine', .04, 1320, .06); } },
  heavy: { gap: .15, f: () => { noise(.25, .14, 2200, 300); tone(70, .35, 'sine', .12, 40, .08); noise(.3, .1, 400, 120, 'lowpass', .08); } },
  step: { gap: .1, f: () => noise(.05, .035, 500 + Math.random() * 300, 200) }
};
// at — где звучит (звуки мира): { x, z, px, pz, yaw } — точка, герой и поворот камеры (°); без at — по центру, как звук героя
export const spatial = (at, S) => {
  if (!at) return { g: 1, pan: 0 };
  const dx = at.x - at.px, dz = at.z - at.pz, d = Math.hypot(dx, dz), y = (at.yaw || 0) * Math.PI / 180;
  if (d > S.far) return null;
  return { g: 1 / (1 + d / S.k), pan: Math.max(-S.pan, Math.min(S.pan, (dx * Math.cos(y) - dz * Math.sin(y)) / S.panW * S.pan)) };     // вправо по экрану — плюс
};
export function sfx(name, at = null) {
  const d = SFX[name]; if (!d || !ac || muted) return;
  const X = FX(), sp = spatial(at, X.space); if (!sp) return;
  const now = ac.currentTime; if (now - (lastT[name] || -9) < d.gap) return; lastT[name] = now;
  const g = ac.createGain(); g.gain.value = sp.g * (1 + (Math.random() * 2 - 1) * X.vary.vol);     // разброс громкости
  if (sp.pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = sp.pan; g.connect(p).connect(sfxBus); } else g.connect(sfxBus);
  out = g; vp = 1 + (Math.random() * 2 - 1) * X.vary.pitch;
  try { d.f(); } finally { out = sfxBus; vp = 1; }
}
export const SFX_NAMES = Object.keys(SFX);


// ---- атмосфера (D1): журчание у реки, птицы и сова, своя музыка. Слои: шина природы и шина музыки (с эхом на задержке) ----
let atmo = null, A = null, vol = { music: .55, nature: .8 }, rnd = Math.random;
const voices = [];                                  // { s, e } — начало и конец каждого поставленного голоса (предел A.voices)
const stats = { notes: 0, skipped: 0, birds: 0, owls: 0, plips: 0, pieces: 0, maxVoices: 0 };
export const audioStats = () => ({ ...stats, voices: voices.length, state: ac ? ac.state : 'none', mix: atmo ? { ...atmo.mix } : null, playing: !!(atmo && atmo.piece) });
let ownOn = false;     // своя музыка игрока играет — музыка игры молчит (custom3d.js)
export const setOwnMusicOn = on => { ownOn = !!on; if (atmo) applyMix(); };
export function setAtmoVolumes(music, nature) { vol = { music: Number(music) || 0, nature: Number(nature) || 0 }; if (atmo) applyMix(); }
export const setAtmoRandom = f => { rnd = f; };     // для тестов
function buildAtmo() {
  const bus = v => { const g = ac.createGain(); g.gain.value = v; g.connect(master); return g; };     // шины природы и музыки — в общую громкость (и компрессор)
  const nature = bus(0), music = bus(0), fight = bus(0);     // fight — боевая музыка (этап 1 «круче»)
  // эхо для музыки: задержка с обратной связью через мягкий фильтр (дешевле свёртки)
  const send = ac.createGain(), dl = ac.createDelay(1), fb = ac.createGain(), lp = ac.createBiquadFilter(), wet = ac.createGain();
  send.gain.value = .35; dl.delayTime.value = .27; fb.gain.value = .38; lp.type = 'lowpass'; lp.frequency.value = 2400; wet.gain.value = .6;
  music.connect(send); send.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(master);
  // журчание: два слоя шума (шорох и плеск) с качанием фильтра; громкость — waterG
  const waterG = ac.createGain(); waterG.gain.value = 0; waterG.connect(nature);
  for (const [fc, q, lf, depth, v] of [[1500, .8, .37, 500, .6], [520, .7, .23, 160, .5]]) {
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), o = ac.createOscillator(), og = ac.createGain();
    src.buffer = noiseBuf; src.loop = true; src.playbackRate.value = fc > 1000 ? 1 : .93; f.type = 'bandpass'; f.frequency.value = fc; f.Q.value = q; g.gain.value = v;
    o.frequency.value = lf; og.gain.value = depth; o.connect(og).connect(f.frequency); src.connect(f).connect(g).connect(waterG); src.start(); o.start();
  }
  // шелест листвы (F2): светлый шум с качанием полосы; громкость — rustleG
  const rustleG = ac.createGain(); rustleG.gain.value = 0; rustleG.connect(nature);
  { const src = ac.createBufferSource(), hp = ac.createBiquadFilter(), bp = ac.createBiquadFilter(), o = ac.createOscillator(), og = ac.createGain();
    src.buffer = noiseBuf; src.loop = true; src.playbackRate.value = .87; hp.type = 'highpass'; hp.frequency.value = 1800; bp.type = 'bandpass'; bp.frequency.value = 4200; bp.Q.value = .5;
    o.frequency.value = .53; og.gain.value = 1300; o.connect(og).connect(bp.frequency); src.connect(hp).connect(bp).connect(rustleG); src.start(); o.start(); }
  // шум дождя (F3): глухой шорох и светлое шипение капель; громкость — rainG
  const rainG = ac.createGain(); rainG.gain.value = 0; rainG.connect(nature);
  for (const [type, fc, q, v] of [['lowpass', 1400, .7, .7], ['highpass', 5200, .5, .35]]) { const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); src.buffer = noiseBuf; src.loop = true; src.playbackRate.value = type === 'lowpass' ? .79 : 1.13; f.type = type; f.frequency.value = fc; f.Q.value = q; g.gain.value = v; src.connect(f).connect(g).connect(rainG); src.start(); }
  fight.connect(send);
  atmo = { fight, fightT: 0, fightBar: 0, fightSeed: 0, fightUntil: 0, nature, music, waterG, rustleG, rainG, mix: { water: 0, birds: 0, owl: 0, music: 0, combat: 0 }, piece: null, pieceT: 0, idx: 0, restUntil: 0, nextBird: 0, nextOwl: 0, nextPlip: 0, seed: 1 };
}
function applyMix() {
  const t = ac.currentTime, m = atmo.mix, tau = A ? A.combat.fade / 3 : .5;
  atmo.nature.gain.setTargetAtTime(vol.nature * user.sfx, t, .3);
  atmo.music.gain.setTargetAtTime(ownOn ? 0 : vol.music * user.music * (A ? A.music.vol : .07) * m.music, t, tau);
  { const FG = A && A.fight; atmo.fight.gain.setTargetAtTime(FG && FG.on && !ownOn ? vol.music * user.music * FG.vol * (m.fight > 0 ? 1 : 0) : 0, t, m.fight > 0 ? .4 : (FG ? FG.hold / 3 : 1)); }     // после боя затихает за hold с
  atmo.waterG.gain.setTargetAtTime((A ? A.water.vol : .09) * m.water, t, .6);
  atmo.rainG.gain.setTargetAtTime((A && A.rain ? A.rain.vol : .08) * (m.rain || 0), t, 1.2);
  atmo.rustleG.gain.setTargetAtTime((A && A.rustle ? A.rustle.vol : .06) * (m.rustle || 0), t, .4);
}
// mix — из mixOf (soundscape3d.js), cfg — cfg.audio
export function setScene(mix, cfg) { A = cfg; if (cfg) { vol.music = cfg.musicVol; vol.nature = cfg.natureVol; } if (!atmo || !ac) return; atmo.mix = mix; applyMix(); }

// голос с огибающей: тип волны, частота (или свист f0→f1), атака и спад; уходит в шину bus через фильтр (по желанию)
function voice(bus, o) {
  const now = ac.currentTime; for (let i = voices.length - 1; i >= 0; i--) if (voices[i].e < now) voices.splice(i, 1);
  const t = Math.max(o.t, now), end = t + o.d + (o.rel || .05);
  let live = 0; for (const v of voices) if (v.s <= t + .01 && v.e > t) live++;           // звучат в момент начала ноты
  if (live >= (A ? A.voices : 24) - (o.low ? 6 : 0)) { stats.skipped++; return false; }     // природа уступает музыке 6 голосов
  const g = ac.createGain(), oscs = [];
  for (const det of o.det || [0]) {
    const os = ac.createOscillator(); os.type = o.type || 'sine'; os.frequency.setValueAtTime(o.f0, t); os.detune.value = det;
    if (o.f1) os.frequency.exponentialRampToValueAtTime(o.f1, t + o.d);
    if (o.vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = o.vib; lg.gain.value = o.f0 * .006; l.connect(lg).connect(os.frequency); l.start(t); l.stop(end + .05); }
    oscs.push(os);
  }
  let head = g;
  if (o.formants) { head = ac.createGain(); for (const [fc, q] of o.formants) { const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fc; f.Q.value = q; head.connect(f); f.connect(g); } }
  else if (o.lp) { head = ac.createBiquadFilter(); head.type = 'lowpass'; head.frequency.value = o.lp; head.connect(g); }
  for (const os of oscs) os.connect(head);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(o.v, t + (o.att || .01));
  if (o.pluck) g.gain.exponentialRampToValueAtTime(.0005, t + o.d + (o.rel || .05));
  else { g.gain.setValueAtTime(o.v, t + Math.max(o.att || .01, o.d)); g.gain.linearRampToValueAtTime(0, end); }
  g.connect(bus); for (const os of oscs) { os.start(t); os.stop(end + .05); }
  voices.push({ s: t, e: end }); stats.maxVoices = Math.max(stats.maxVoices, live + 1); return true;
}
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
const PART = {
  flute: (n, t) => voice(atmo.music, { t, d: n.d, f0: hz(n.m), type: 'sine', det: [0, 4], v: .55 * n.v, att: .07, rel: .25, vib: 5.2 }),
  harp: (n, t) => voice(atmo.music, { t, d: n.d, f0: hz(n.m), type: 'triangle', v: .35 * n.v, att: .005, rel: .4, pluck: true }),
  pad: (n, t) => voice(atmo.music, { t, d: n.d, f0: hz(n.m), type: 'sawtooth', det: [-7, 7], lp: 1100, v: .12 * n.v, att: .5, rel: .5 }),
  bass: (n, t) => voice(atmo.music, { t, d: n.d, f0: hz(n.m), type: 'sine', v: .35 * n.v, att: .2, rel: .6 }),
  choir: (n, t) => voice(atmo.music, { t, d: n.d, f0: hz(n.m), type: 'sawtooth', det: [-5, 6], formants: [[720, 7], [1150, 8]], v: .5 * n.v, att: .5, rel: 1, vib: 4.6 })
};
const FPART = {     // боевая музыка (этап 1 «круче»): своя шина, ударные — короткий свист частоты вниз
  kick: (n, t) => voice(atmo.fight, { t, d: n.d, f0: 95, f1: 42, type: 'sine', v: .9 * n.v, att: .004, rel: .06 }),
  tom: (n, t) => voice(atmo.fight, { t, d: n.d, f0: 170, f1: 105, type: 'sine', v: .5 * n.v, att: .004, rel: .06 }),
  fbass: (n, t) => voice(atmo.fight, { t, d: n.d, f0: hz(n.m), type: 'sawtooth', lp: 520, v: .32 * n.v, att: .01, rel: .08 }),
  stab: (n, t) => voice(atmo.fight, { t, d: n.d, f0: hz(n.m), type: 'sawtooth', det: [-6, 6], lp: 1800, v: .14 * n.v, att: .01, rel: .12 }),
  brass: (n, t) => voice(atmo.fight, { t, d: n.d, f0: hz(n.m), type: 'sawtooth', det: [-4, 5], lp: 1400, v: .2 * n.v, att: .04, rel: .2 }),
  choir: (n, t) => voice(atmo.fight, { t, d: n.d, f0: hz(n.m), type: 'sawtooth', det: [-5, 6], formants: [[720, 7], [1150, 8]], v: .45 * n.v, att: .4, rel: .8, vib: 4.6 })
};
// планировщик: вызывать часто (каждые ~0,2 с); ставит ноты, трели и бульки на A.look секунд вперёд
export function tickAudio() {
  if (!ac || !atmo || !A || muted || ac.state !== 'running') return;
  const now = ac.currentTime, ahead = now + A.look, m = atmo.mix, M = A.music;
  // музыка: кусок, потом тишина; в бою и под землёй шина молчит, но кусок доигрывается
  if (!atmo.piece && now >= atmo.restUntil && m.music > 0) { atmo.piece = composePiece(atmo.seed++, m.night, M); atmo.pieceT = now + .2; atmo.idx = 0; stats.pieces++; }
  const P = atmo.piece;
  if (P) {
    while (atmo.idx < P.notes.length && atmo.pieceT + P.notes[atmo.idx].t < ahead) {
      const n = P.notes[atmo.idx++], t = atmo.pieceT + n.t;
      if (t >= now && m.music > .02 && PART[n.part](n, t)) stats.notes++;
    }
    if (atmo.idx >= P.notes.length && now > atmo.pieceT + P.dur) { atmo.piece = null; atmo.restUntil = now + M.rest[0] + rnd() * (M.rest[1] - M.rest[0]); }
  }
  // боевая музыка: такты подряд, пока идёт бой и ещё hold с после; новый бой — новое зерно
  { const FG = A.fight;
    if (FG && FG.on) {
      if (m.fight > 0) atmo.fightUntil = now + FG.hold;
      if (now < atmo.fightUntil) {
        if (atmo.fightT < now) { atmo.fightT = now + .05; atmo.fightBar = 0; atmo.fightSeed++; }
        while (atmo.fightT < ahead) { const B = fightBar(atmo.fightSeed, atmo.fightBar++, m.fight, !!m.boss, FG); for (const n of B.notes) { const t = atmo.fightT + n.t; if (t >= now && FPART[n.part](n, t)) stats.fightNotes = (stats.fightNotes || 0) + 1; } atmo.fightT += B.dur; }
      } else atmo.fightT = 0;
    } }
  // птицы днём, сова ночью
  if (m.birds > .05 && now >= atmo.nextBird) {
    const s = birdSong(rnd), t0 = now + .1 + rnd() * .5, v = A.birds.vol * m.birds * (.4 + .6 * rnd());
    for (const q of s.syl) voice(atmo.nature, { t: t0 + q.t, d: q.d, f0: q.f0, f1: q.f1, type: 'sine', v: v * q.v, att: .008, rel: .03, low: true });
    stats.birds++; atmo.nextBird = now + (A.birds.gap[0] + rnd() * (A.birds.gap[1] - A.birds.gap[0])) / Math.max(.3, m.birds);
  } else if (m.birds <= .05 && atmo.nextBird < now) atmo.nextBird = now + 1;
  if (m.owl > .05 && now >= atmo.nextOwl) {
    const t0 = now + .2; for (const q of owlCall(rnd)) voice(atmo.nature, { t: t0 + q.t, d: q.d, f0: q.f0, f1: q.f1, type: 'sine', v: A.birds.owlVol * m.owl * q.v, att: .08, rel: .2, low: true });
    stats.owls++; atmo.nextOwl = now + A.birds.owlGap[0] + rnd() * (A.birds.owlGap[1] - A.birds.owlGap[0]);
  } else if (m.owl <= .05 && atmo.nextOwl < now) atmo.nextOwl = now + 3;
  if ((m.frog || 0) > .05 && now >= (atmo.nextFrog || 0)) {     // лягушки у воды (2026-10-18)
    const t0 = now + .1; for (const q of frogCall(rnd)) voice(atmo.nature, { t: t0 + q.t, d: q.d, f0: q.f0, f1: q.f1, type: 'triangle', v: A.birds.frogVol * m.frog * q.v, att: .01, rel: .05, low: true });
    stats.frogs = (stats.frogs || 0) + 1; atmo.nextFrog = now + A.birds.frogGap[0] + rnd() * (A.birds.frogGap[1] - A.birds.frogGap[0]);
  }
  // бульки у воды: короткий свист вверх (пузырёк)
  if (m.water > .05) {
    if (atmo.nextPlip < now) atmo.nextPlip = now;
    while (atmo.nextPlip < ahead) {
      const f = 500 + rnd() * 900;
      if (voice(atmo.nature, { t: atmo.nextPlip, d: .05 + rnd() * .04, f0: f, f1: f * (1.6 + rnd() * .6), type: 'sine', v: A.water.vol * m.water * (.15 + .25 * rnd()), att: .004, rel: .02, low: true })) stats.plips++;
      atmo.nextPlip += -Math.log(1 - rnd() * .999) / (A.water.plips * m.water);
    }
  }
}
export const __ctx = () => ac;     // для тестов (рендер без колонок)
